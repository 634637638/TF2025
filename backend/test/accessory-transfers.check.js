'use strict'
const test = require('node:test')
const assert = require('node:assert/strict')
const AccessoryService = require('../src/services/accessory.service')
const inventoryFixture = require('./helpers/accessory-inventory')
const AccessoryRepository = require('../src/repositories/accessory.repository')
const actor = { id: 7, name: '店员', store_ids: [1, 2, 3] }
const input = extra => ({ accessory_id: 5, from_store_id: 1, to_store_id: 2, quantity: 20, request_key: 'a'.repeat(32), ...extra })
function fixture({ fail = '', serials = [] } = {}) {
  const state = { stocks: { 1: 50, 2: 0, 3: 0 }, serials, transfers: [], procurement: 50, sales: 0 }
  let snapshot, tail = Promise.resolve()
  const tx = []
  const connection = {
    async beginTransaction() { snapshot = structuredClone(state); tx.push('begin') },
    async commit() { tx.push('commit') },
    async rollback() { Object.assign(state, snapshot); tx.push('rollback') }
  }
  const check = db => assert.equal(db, connection)
  const repository = {
    async withConnection(fn) { const previous = tail; let release; tail = new Promise(resolve => { release = resolve }); await previous; try { return await fn(connection) } finally { release() } },
    async getAccessoryById(id, db) { check(db); return id === 5 ? { id, template_id: 4 } : null },
    async lockAccessory(id, db) { check(db); assert.equal(id, 4); return { id: 4, serial_tracking: 0 } },
    async getTransferByKey(key, db) { check(db); return state.transfers.find(item => item.request_key === key) },
    async getReference(id, field, db) { check(db); return { id, status: id === 3 && fail === 'store' ? 0 : 1 } },
    async lockStoreStock(id, store, db) { check(db); return { quantity: state.stocks[store], min_stock: 5 } },
    async countStockSerials(id, store, db) { check(db); return state.serials.filter(item => item.store_id === store && item.status === 'in_stock').length },
    async lockSerials(numbers, db) { check(db); return state.serials.filter(item => numbers.includes(item.serial_number)) },
    async moveInventory(data, db) { check(db); state.stocks[data.from_store_id] -= data.quantity; state.stocks[data.to_store_id] += data.quantity; return true },
    async moveSerial(id, from, to, time, db) { check(db); if (fail === 'serial') return false; state.serials.find(item => item.id === id).store_id = to; return true },
    async createTransfer(data, db) { check(db); if (fail === 'record') throw new Error('simulated transfer failure'); state.transfers.push({ ...data, id: state.transfers.length + 1 }); return state.transfers.length }
  }
  return { state, repository, tx, service: new AccessoryService({ repository, inventoryService: inventoryFixture(state, check) }) }
}
const units = () => [1, 2].map(id => ({ id, accessory_id: 5, store_id: 1, serial_number: `00A${id}`, status: 'in_stock', stock_in_id: 81, purchase_cost: 12.5 }))

test('整批和部分划拨一次确认完成，库存守恒，保留采购及销量事实', async () => {
  const context = fixture()
  assert.equal((await context.service.transfer(input(), actor)).success, true)
  assert.deepEqual(context.state.stocks, { 1: 30, 2: 20, 3: 0 })
  assert.equal((await context.service.transfer(input({ quantity: 30, to_store_id: 3, request_key: 'b'.repeat(32) }), actor)).success, true)
  assert.deepEqual(context.state.stocks, { 1: 0, 2: 20, 3: 30 })
  assert.equal(context.state.procurement, 50)
  assert.equal(context.state.sales, 0)
  assert.equal(context.state.transfers[0].operator_id, 7)
})

test('请求重试仅移动一次；同标识改变数量拒绝，并发超量只有一单成功', async () => {
  const context = fixture()
  const same = await Promise.all([context.service.transfer(input(), actor), context.service.transfer(input(), actor)])
  assert.equal(same.filter(result => result.data?.replayed).length, 1)
  assert.equal(context.state.transfers.length, 1)
  assert.equal((await context.service.transfer(input({ quantity: 1 }), actor)).statusCode, 409)
  const competing = await Promise.all(['c', 'd'].map(key => context.service.transfer(input({ request_key: key.repeat(32), quantity: 25 }), actor)))
  assert.equal(competing.filter(result => result.success).length, 1)
  assert.equal(context.state.stocks[1], 5)
})

test('SN从所选来源移动，保留采购来源及单件成本；普通划拨不能扣走SN库存', async () => {
  const context = fixture({ serials: units() })
  context.state.stocks[1] = 3
  assert.equal((await context.service.transfer(input({ quantity: 2 }), actor)).code, 'INSUFFICIENT_PLAIN_STOCK')
  assert.equal((await context.service.transfer(input({ quantity: 1, serial_numbers: ['00a1'] }), actor)).success, true)
  assert.deepEqual(context.state.serials[0], { ...units()[0], store_id: 2 })
  assert.equal(context.state.serials[1].store_id, 1)
  assert.equal(context.state.transfers[0].serial_numbers[0], '00A1')
})

for (const [label, extra, code] of [
  ['相同店铺', { to_store_id: 1 }, 'VALIDATION_ERROR'],
  ['越权来源', { from_store_id: 99 }, 'STORE_SCOPE_DENIED'],
  ['越权接收', { to_store_id: 99 }, 'STORE_SCOPE_DENIED'],
  ['数量不合法', { quantity: true }, 'VALIDATION_ERROR'],
  ['不足库存', { quantity: 51 }, 'INSUFFICIENT_STOCK'],
  ['SN数量不符', { quantity: 2, serial_numbers: ['00A1'] }, 'SERIAL_QUANTITY_MISMATCH'],
  ['重复SN', { quantity: 2, serial_numbers: ['00a1', '00A1'] }, 'DUPLICATE_SERIAL'],
  ['未知SN', { quantity: 1, serial_numbers: ['UNKNOWN'] }, 'SERIAL_UNAVAILABLE'],
  ['请求标识', { request_key: 'bad' }, 'VALIDATION_ERROR']
]) test(`划拨拒绝${label}，库存与单据均不变`, async () => {
  const context = fixture({ serials: units() })
  const before = structuredClone(context.state)
  assert.equal((await context.service.transfer(input(extra), actor)).code, code)
  assert.deepEqual(context.state, before)
})

for (const fail of ['serial', 'record', 'store']) test(`${fail}失败全事务回滚`, async () => {
  const context = fixture({ fail, serials: units() })
  const before = structuredClone(context.state)
  const result = await context.service.transfer(input({ quantity: 1, serial_numbers: ['00A1'], to_store_id: 3 }), actor)
  assert.equal(result.success, false)
  assert.deepEqual(context.state, before)
  assert.equal(context.tx.at(-1), 'rollback')
})

test('只列出双店均有权访问的划拨，SN库存筛选参数严格校验', async () => {
  const context = fixture()
  let passed
  context.repository.getTransfers = async (...args) => { passed = args; return [] }
  await context.service.getTransfers(actor, 5, { page: '2', page_size: '10' })
  assert.deepEqual(passed, [5, { allStores: false, requestedStoreId: null, storeIds: [1, 2, 3] }, 2, 10])
  await assert.rejects(context.service.getSerials(actor, 5, { stock_only: 'yes' }), { code: 'VALIDATION_ERROR' })
  const repository = new AccessoryRepository()
  const calls = []
  repository.getConnection = () => ({ query: async (sql, params) => { calls.push({ sql, params }); return [[{ total: 0 }]] } })
  repository.queryRows = async (sql, params) => { calls.push({ sql, params }); return [] }
  await repository.getTransfers(5, { allStores: false, storeIds: [1, 2] }, 1, 20)
  assert.match(calls[1].sql, /tr.from_store_id IN/)
  assert.match(calls[1].sql, /tr.to_store_id IN/)
  assert.deepEqual(calls[1].params, [5, 5, 1, 2, 1, 2, 20, 0])
})


test('划拨读取指定品牌商品库存，不把同模板其他品牌的库存算作可移动', async () => {
  const context = fixture()
  let args
  context.repository.getInventoryLocations = async (...input) => { args = input; return [] }
  await context.service.getInventoryLocations(actor, 5, { include_variants: 'false' })
  assert.equal(args[2], false)
  await assert.rejects(context.service.getInventoryLocations(actor, 5, { include_variants: 'bad' }), { code: 'VALIDATION_ERROR' })
  const repository = new AccessoryRepository()
  let query
  repository.queryRows = async (sql, params) => { query = { sql, params }; return [] }
  await repository.getInventoryLocations(5, { allStores: true }, false)
  assert.match(query.sql, /WHERE a.id = \?/)
  assert.doesNotMatch(query.sql, /OR a.template_id/)
  assert.deepEqual(query.params, [5])
})
