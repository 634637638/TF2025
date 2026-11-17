'use strict'
const test = require('node:test')
const assert = require('node:assert/strict')
const AccessoryService = require('../src/services/accessory.service')
const inventoryFixture = require('./helpers/accessory-inventory')
const issueSale = require('./helpers/accessory-issue')
const AccessoryController = require('../src/controllers/accessory.controller')
const actor = { id: 7, name: '店员', store_id: 2, store_ids: [2, 3] }

function fixture({ tracking = 1, failEvent = false } = {}) {
  const state = { quantity: 2, serials: [
    { id: 1, serial_number: '00AA', accessory_id: 5, store_id: 2, status: 'in_stock', stock_in_id: 30, purchase_cost: '10.25' },
    { id: 2, serial_number: '00BB', accessory_id: 5, store_id: 2, status: 'in_stock', stock_in_id: 31, purchase_cost: '12.50' }
  ], sales: [], events: [], entries: [] }
  const transactions = []
  let tail = Promise.resolve()
  let snapshot
  const connection = {
    async beginTransaction() { snapshot = structuredClone(state); transactions.push('begin') },
    async commit() { transactions.push('commit') },
    async rollback() { Object.assign(state, snapshot); transactions.push('rollback') }
  }
  const product = { id: 5, status: 1, serial_tracking: tracking, sale_price: 20, purchase_cost: 10 }
  const check = executor => assert.equal(executor, connection)
  const repository = {
    async lockFilmConfiguration() { return false },
    async assertUniqueFreeFilms() {},
    async withConnection(callback) {
      const previous = tail
      let release
      tail = new Promise(resolve => { release = resolve })
      await previous
      try { return await callback(connection) } finally { release() }
    },
    async getAccessoryById(id, executor) { check(executor); return id === 5 ? product : null },
    async lockAccessory(id, executor) { check(executor); return product },
    async syncProductProfileSnapshots(id, rootId, executor) { check(executor); assert.equal(id, 5); assert.equal(rootId, 5) },
    async countStockSerials(id, store, executor) { check(executor); return state.serials.filter(item => item.accessory_id === id && item.store_id === store && item.status === 'in_stock').length },
    async lockStoreStock(id, store, executor) { check(executor); return { quantity: state.quantity } },
    async lockSerials(numbers, executor) { check(executor); return state.serials.filter(item => numbers.includes(item.serial_number)) },
    async createSalesRecord(data, executor) { check(executor); state.sales.push(data); return state.sales.length },
    async markSerialOut(id, saleId, type, time, executor) {
      check(executor)
      const unit = state.serials.find(item => item.id === id && item.status === 'in_stock')
      if (!unit) return false
      Object.assign(unit, { sale_id: saleId, status: type === 'gift' ? 'gifted' : 'sold' })
      return true
    },
    async createSerialEvent(data, executor) { check(executor); state.events.push(data); if (failEvent) throw new Error('simulated event failure') },
    async deductStock(id, store, quantity, executor) { check(executor); if (state.quantity < quantity) return false; state.quantity -= quantity; return true },
    async getReference(id, field, executor) { check(executor); return { id, name: field, status: 1 } },
    async createStockInRecord(data, executor) { check(executor); state.entries.push(data); return 31 },
    async updateAccessoryStock(id, store, quantity, operation, min, executor) { check(executor); state.quantity += quantity },
    async createSerial(data, executor) {
      check(executor)
      if (state.serials.some(item => item.serial_number === data.serial_number)) throw Object.assign(new Error('duplicate'), { code: 'ER_DUP_ENTRY' })
      state.serials.push({ ...data, id: state.serials.length + 1, status: 'in_stock' })
      return state.serials.length
    },
    async getAccessoryStock(id, executor) { check(executor); return { total_stock: state.quantity } }
  }
  require('./helpers/accessory-stock-in')(repository, () => state.entries)
  return { state, product, transactions, service: new AccessoryService({ repository, inventoryService: inventoryFixture(state, check) }), repository }
}
const outbound = extra => ({ accessory_id: 5, store_id: 2, quantity: 1, unit_price: 20, remarks: '活动赠送', customer_name: '顾客', customer_phone: '13800138000', serial_numbers: ['00aa'], ...extra })
const inbound = extra => ({ request_key: require('node:crypto').randomBytes(16).toString('hex'), accessory_id: 5, store_id: 2, supplier_id: 8, total_quantity: 1, purchase_cost: 15, serial_numbers: [{ serial_number: ' 00cc ', store_id: 2 }], ...extra })

test('SN保留前导零并统一大小写，禁止重复、超长、格式错误及越权门店', () => {
  const { service } = fixture()
  assert.deepEqual(service.normalizeSerials([' 00abc ']), ['00ABC'])
  for (const input of [['aa', 'AA'], ['a'.repeat(101)], ['xx yy'], [123], null]) assert.throws(() => service.normalizeSerials(input))
  assert.throws(() => service.normalizeSerials([{ serial_number: 'AA', store_id: 99 }], { storeIds: [2], isAllStores: false }))
})

test('SN入库关联采购单、门店、逐件成本和认证人员；数量不一致及重复SN整单回滚', async () => {
  const context = fixture()
  assert.equal((await context.service.stockIn(inbound(), actor)).success, true)
  const unit = context.state.serials.at(-1)
  assert.equal(unit.serial_number, '00CC')
  assert.equal(unit.stock_in_id, 31)
  assert.equal(unit.purchase_cost, 15)
  assert.equal(context.state.events.at(-1).operator_id, actor.id)
  const before = structuredClone(context.state)
  assert.equal((await context.service.stockIn(inbound(), actor)).code, 'DUPLICATE_SERIAL')
  assert.deepEqual(context.state, before)
  assert.equal((await context.service.stockIn(inbound({ serial_tracking: 1, serial_numbers: [] }), actor)).code, 'VALIDATION_ERROR')
  assert.deepEqual(context.state, before)
})

for (const type of ['sale', 'gift']) {
  test(`SN${type}使用逐件成本、关联客户与操作员，状态及库存同事务更新`, async () => {
    const context = fixture()
    const result = await issueSale(context.service, outbound({ sale_type: type, unit_price: type === 'gift' ? 0 : 20, quantity: 2, serial_numbers: ['00aa', '00bb'], operator_id: 99 }), actor)
    assert.equal(result.success, true)
    assert.equal(context.state.quantity, 0)
    assert.equal(context.state.sales[0].purchase_cost, 22.75)
    assert.equal(context.state.sales[0].operator_id, actor.id)
    assert.equal(context.state.sales[0].customer_phone, '13800138000')
    assert.equal(context.state.serials[0].status, type === 'gift' ? 'gifted' : 'sold')
    assert.equal(context.state.events.length, 2)
    assert.deepEqual(context.transactions, ['begin', 'commit'])
  })
}

for (const [label, extra, expected] of [
  ['缺失SN', { serial_numbers: [] }, 'INSUFFICIENT_PLAIN_STOCK'],
  ['未知SN', { serial_numbers: ['UNKNOWN'] }, 'SERIAL_UNAVAILABLE'],
  ['错误门店', { store_id: 3 }, 'SERIAL_UNAVAILABLE'],
  ['重复SN', { quantity: 2, serial_numbers: ['00aa', '00AA'] }, 'DUPLICATE_SERIAL'],
  ['越权门店', { store_id: 99 }, 'STORE_SCOPE_DENIED'],
  ['缺少客户', { customer_phone: '' }, 'VALIDATION_ERROR'],
  ['赠送带金额', { sale_type: 'gift', unit_price: 1 }, 'VALIDATION_ERROR']
]) test(`SN出库拒绝${label}且不产生库存或单据变动`, async () => {
  const context = fixture()
  const before = structuredClone(context.state)
  assert.equal((await issueSale(context.service, outbound(extra), actor)).code, expected)
  assert.deepEqual(context.state, before)
})

test('同一SN同时销售与赠送仅一笔成功；后续再次出库拒绝', async () => {
  const context = fixture()
  const results = await Promise.all([
    issueSale(context.service, outbound(), actor),
    issueSale(context.service, outbound({ sale_type: 'gift', unit_price: 0 }), actor)
  ])
  assert.equal(results.filter(item => item.success).length, 1)
  assert.equal(context.state.sales.length, 1)
  assert.equal(context.state.quantity, 1)
  assert.equal((await issueSale(context.service, outbound(), actor)).code, 'SERIAL_UNAVAILABLE')
})

test('追踪写入失败时销售单、SN状态及库存全部回滚；普通配件继续按数量销售', async () => {
  const context = fixture({ failEvent: true })
  const before = structuredClone(context.state)
  assert.equal((await issueSale(context.service, outbound(), actor)).success, false)
  assert.deepEqual(context.state, before)
  assert.deepEqual(context.transactions, ['begin', 'rollback'])
  const plain = fixture({ tracking: 0 })
  plain.state.quantity = 4
  assert.equal((await issueSale(plain.service, outbound({ serial_numbers: undefined }), actor)).success, true)
  assert.equal(plain.state.quantity, 3)
  assert.equal(plain.state.events.length, 0)
})

test('SN开关只改变模板默认值不转换库存；锁定后模板已删除时拒绝更新', async () => {
  const context = fixture()
  context.repository.getAccessoryById = async () => context.product
  context.repository.updateAccessory = async (id, data) => { Object.assign(context.product, data); return true }
  const before = structuredClone(context.state)
  assert.equal((await context.service.updateAccessory(5, { serial_tracking: 0 })).success, true)
  assert.deepEqual(context.state, before)
  context.repository.lockAccessory = async () => null
  assert.equal((await context.service.updateAccessory(5, { serial_tracking: 0 })).code, 'NOT_FOUND')
})

test('控制器不保留脱离共同结算的销售或赠送入口，内部出库仍可供共同事务复用', () => {
  const controller = new AccessoryController(), { service } = fixture()
  for (const name of ['sell', 'gift', 'saveOutbound']) assert.equal(typeof controller[name], 'undefined')
  assert.equal(typeof service.sell, 'undefined')
  assert.equal(typeof service.issueSale, 'function')
})

test('SN查询仅使用认证门店范围，越权及无记录统一拒绝，分页必须是安全整数', async () => {
  const context = fixture()
  const calls = []
  context.repository.getSerials = async params => { calls.push(params); return { data: [], pagination: { total: 0 } } }
  context.repository.getSerialTrace = async (serial, scope) => { calls.push({ serial, scope }); return null }
  await context.service.getSerials(actor, 5, { search: '00aa', page: '2', page_size: '50' })
  assert.deepEqual(calls[0].scope.storeIds, [2, 3])
  assert.equal(calls[0].search, '00AA')
  await assert.rejects(context.service.getSerials(actor, 5, { store_id: 99 }), { code: 'STORE_SCOPE_DENIED' })
  for (const page of ['1.5', 'NaN', '9007199254740992', '-1']) await assert.rejects(context.service.getSerials(actor, 5, { page }), { code: 'VALIDATION_ERROR' })
  await assert.rejects(context.service.getSerialTrace(actor, '00aa'), { code: 'NOT_FOUND' })
  assert.equal(calls.at(-1).serial, '00AA')
})

test('SN嵌套追踪响应遵守成本、客户、门店、经办人和时间字段权限', async () => {
  const hiddenFields = ['price_info.purchase_cost', 'customer_info.customer_phone', 'stock_info.distribution', 'operator_info.operator_name', 'time_info.created_at', 'basic_info.serial_number']
  const controller = new AccessoryController({
    masking: { async getUserFieldPermissions() { return { hiddenFields } }, filterSensitiveFields: rows => rows }
  })
  const masked = await controller.mask({ user: actor }, { serial_number: '00AA', purchase_cost: 12, events: [{ serial_number: '00AA', customer_phone: '13800138000', store_name: '店铺', store_id: 2, operator_name: '店员', inventory_operator_name: '入库员', sale_time: '2026-11-12', created_at: '2026-11-12' }] })
  assert.equal(masked.serial_number, null)
  assert.equal(masked.purchase_cost, null)
  for (const value of Object.values(masked.events[0])) assert.equal(value, null)
})

test('SN一次入库只属于所选店铺；不同店SN或分配整单拒绝，同店多条成功', async () => {
  const context = fixture()
  const before = structuredClone(context.state)
  const wrongSerial = await context.service.stockIn(inbound({ serial_numbers: [{ serial_number: 'NEW', store_id: 3 }] }), actor)
  assert.equal(wrongSerial.code, 'SERIAL_STORE_MISMATCH')
  assert.deepEqual(context.state, before)
  const wrongDistribution = await context.service.stockIn(inbound({ distribution: [{ store_id: 3, quantity: 1 }] }), actor)
  assert.equal(wrongDistribution.code, 'SERIAL_STORE_MISMATCH')
  assert.deepEqual(context.state, before)
  const result = await context.service.stockIn(inbound({ total_quantity: 2, serial_numbers: [{ serial_number: 'NEW1', store_id: 2 }, { serial_number: 'NEW2', store_id: 2 }] }), actor)
  assert.equal(result.success, true)
  assert.equal(context.state.entries.length, 1)
  assert.equal(context.state.serials.slice(-2).every(item => item.store_id === 2), true)
})


test('同模板混合入库：每批模式独立，SN数量由后端计算，普通出库不可占用SN库存', async () => {
  const context = fixture({ tracking: 0 })
  assert.equal((await context.service.stockIn(inbound({ serial_tracking: 1, total_quantity: 999 }), actor)).success, true)
  assert.equal(context.state.entries.at(-1).quantity, 1)
  assert.equal((await context.service.stockIn(inbound({ serial_tracking: 0, serial_numbers: undefined, total_quantity: 4 }), actor)).success, true)
  assert.equal((await issueSale(context.service, outbound({ serial_numbers: [], quantity: 4 }), actor)).success, true)
  assert.equal((await issueSale(context.service, outbound({ serial_numbers: [] }), actor)).code, 'INSUFFICIENT_PLAIN_STOCK')
  assert.equal((await issueSale(context.service, outbound(), actor)).success, true)
  assert.equal(context.state.serials[0].status, 'sold')
})
