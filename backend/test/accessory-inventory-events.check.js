'use strict'
const test = require('node:test')
const assert = require('node:assert/strict')
const AccessoryService = require('../src/services/accessory.service')
const AccessoryInventoryRepository = require('../src/repositories/accessory-inventory.repository')
const { openingBatches, allocateBatches } = require('../src/utils/accessory-batches')
const inventoryFixture = require('./helpers/accessory-inventory')
const issueSale = require('./helpers/accessory-issue')
const actor = { id: 7, name: '操作员', store_ids: [1, 2] }
const purchase = extra => ({ request_key: require('node:crypto').randomBytes(16).toString('hex'), accessory_id: 5, store_id: 1, supplier_id: 8, total_quantity: 3, purchase_cost: 10, usage_type: 'sale', ...extra })
const outbound = extra => ({ accessory_id: 5, store_id: 1, quantity: 1, unit_price: 30, customer_name: '测试顾客', customer_phone: '13800138000', ...extra })
const move = extra => ({ accessory_id: 5, from_store_id: 1, to_store_id: 2, quantity: 2, request_key: 'a'.repeat(32), ...extra })
function fixture() {
  const state = { stocks: { 1: 0, 2: 0 }, serials: [], entries: [], sales: [], transfers: [] }
  let snapshot, tail = Promise.resolve()
  const connection = {
    async beginTransaction() { snapshot = structuredClone(state) }, async commit() {},
    async rollback() { Object.keys(state).forEach(key => delete state[key]); Object.assign(state, snapshot) }
  }
  const check = executor => assert.equal(executor, connection)
  const product = { id: 5, name: '充电器', status: 1, purchase_cost: 999, sale_price: 30 }
  const repository = {
    async withConnection(callback) { const previous = tail; let release; tail = new Promise(resolve => { release = resolve }); await previous; try { return await callback(connection) } finally { release() } },
    async getAccessoryById(id, db) { check(db); return id === 5 ? product : null },
    async lockAccessory(id, db) { check(db); return product },
    async getReference(id, field, db) { check(db); return { id, status: 1, business_scope: 'both' } },
    async lockStoreStock(id, store, db) { check(db); return { quantity: state.stocks[store], min_stock: 5 } },
    async countStockSerials(id, store, db) { check(db); return state.serials.filter(row => row.store_id === store && row.status === 'in_stock').length },
    async lockSerials(numbers, db) { check(db); return state.serials.filter(row => numbers.includes(row.serial_number)) },
    async createStockInRecord(data, db) { check(db); state.entries.push({ ...data, id: state.entries.length + 1 }); return state.entries.length },
    async updateAccessoryStock(id, store, quantity, op, min, db) { check(db); state.stocks[store] += quantity },
    async getAccessoryStock(id, db) { check(db); return { total_stock: state.stocks[1] + state.stocks[2] } },
    async createSalesRecord(data, db) { check(db); state.sales.push(data); return state.sales.length },
    async deductStock(id, store, quantity, db) { check(db); state.stocks[store] -= quantity; return true },
    async getTransferByKey(key, db) { check(db); return state.transfers.find(row => row.request_key === key) },
    async moveInventory(data, db) { check(db); state.stocks[data.from_store_id] -= data.quantity; state.stocks[data.to_store_id] += data.quantity; return true },
    async createTransfer(data, db) { check(db); const id = state.transfers.length + 1; state.transfers.push({ ...data, id }); return id }
  }
  require('./helpers/accessory-stock-in')(repository, () => state.entries)
  const inventoryService = inventoryFixture(state, check)
  const service = new AccessoryService({ repository, inventoryService })
  return { state, service, inventoryService }
}

test('同商品不同供应商批次按实际进价FIFO出库，划拨保留来源及成本，重试不重记', async () => {
  const { state, service } = fixture()
  assert.equal((await service.stockIn(purchase(), actor)).success, true)
  assert.equal((await service.stockIn(purchase({ supplier_id: 9, total_quantity: 2, purchase_cost: 20 }), actor)).success, true)
  assert.equal((await service.transfer(move(), actor)).success, true)
  const afterMove = structuredClone(state)
  assert.equal((await service.transfer(move(), actor)).data.replayed, true)
  assert.deepEqual(state, afterMove)
  assert.equal((await issueSale(service, outbound({ store_id: 2, quantity: 2 }), actor)).success, true)
  assert.equal(state.sales[0].purchase_cost, 20)
  assert.equal((await issueSale(service, outbound({ quantity: 3 }), actor)).success, true)
  assert.equal(state.sales[1].purchase_cost, 50)
  assert.equal(state.sales[1].profit, 40)
  assert.deepEqual(state.stocks, { 1: 0, 2: 0 })
  assert.deepEqual(state.inventoryEvents.filter(row => row.event_type === 'sale').map(row => [row.stock_in_id, row.quantity_delta, row.purchase_cost]), [[1, -2, 10], [1, -1, 10], [2, -2, 20]])
  assert.equal(state.entries.length, 2, '划拨不重复采购应付')
})

test('赠送批次不得收费，收费转赠送须原因且真实成本不归零', async () => {
  const { state, service } = fixture()
  await service.stockIn(purchase({ usage_type: 'gift', purchase_cost: 4, total_quantity: 2 }), actor)
  const before = structuredClone(state)
  assert.equal((await issueSale(service, outbound(), actor)).code, 'INVENTORY_LEDGER_CONFLICT')
  assert.deepEqual(state, before)
  assert.equal((await issueSale(service, outbound({ sale_type: 'gift', unit_price: 0 }), actor)).success, true)
  assert.equal(state.sales[0].purchase_cost, 4)
  await service.stockIn(purchase({ purchase_cost: 10, total_quantity: 1 }), actor)
  await issueSale(service, outbound({ sale_type: 'gift', unit_price: 0 }), actor)
  const saleOnly = structuredClone(state)
  assert.equal((await issueSale(service, outbound({ sale_type: 'gift', unit_price: 0 }), actor)).success, false)
  assert.deepEqual(state, saleOnly)
  assert.equal((await issueSale(service, outbound({ sale_type: 'gift', unit_price: 0, remarks: '促销赠送' }), actor)).success, true)
  assert.equal(state.sales.at(-1).purchase_cost, 10)
})

test('旧批次晚于新批次划入仍按原采购顺序出库，反向划拨守恒且清空后补货不重补期初', async () => {
  const { state, service } = fixture()
  await service.stockIn(purchase({ total_quantity: 2, purchase_cost: 5 }), actor)
  await service.stockIn(purchase({ store_id: 2, total_quantity: 2, purchase_cost: 20 }), actor)
  await service.transfer(move({ quantity: 1 }), actor)
  assert.equal((await issueSale(service, outbound({ store_id: 2 }), actor)).success, true)
  assert.equal(state.sales[0].purchase_cost, 5)
  assert.equal((await service.transfer(move({ from_store_id: 2, to_store_id: 1, request_key: 'b'.repeat(32) }), actor)).success, true)
  assert.equal((await issueSale(service, outbound({ quantity: 3 }), actor)).success, true)
  assert.equal(state.sales[1].purchase_cost, 45)
  assert.deepEqual(state.stocks, { 1: 0, 2: 0 })
  await service.stockIn(purchase({ total_quantity: 1, purchase_cost: 7 }), actor)
  assert.equal(state.inventoryEvents.some(row => row.event_type === 'legacy_opening'), false)
  assert.equal((await issueSale(service, outbound(), actor)).success, true)
  assert.equal(state.sales[2].purchase_cost, 7)
})

test('历史数量接续不猜采购来源或进价，成本及利润保持null，后续不会重复补期初', async () => {
  const { state, service } = fixture()
  state.stocks[1] = 10
  assert.equal((await issueSale(service, outbound(), actor)).success, true)
  assert.equal(state.sales[0].purchase_cost, null)
  assert.equal(state.sales[0].profit, null)
  assert.equal(state.inventoryEvents[0].event_type, 'legacy_opening')
  assert.equal(state.inventoryEvents[0].stock_in_id, null)
  assert.equal(state.inventoryEvents[0].quantity_delta, 10)
  await issueSale(service, outbound(), actor)
  assert.equal(state.inventoryEvents.filter(row => row.event_type === 'legacy_opening').length, 1)
  assert.equal(state.stocks[1], 8)
})

for (const operation of ['stock_in', 'transfer_in', 'sale']) test(`${operation}流水写入失败，库存、期初、销售、采购及划拨整单回滚`, async () => {
  const { state, service, inventoryService } = fixture()
  if (operation !== 'stock_in') await service.stockIn(purchase(), actor)
  const before = structuredClone(state)
  const append = inventoryService.repository.append.bind(inventoryService.repository)
  inventoryService.repository.append = async (row, db) => { await append(row, db); if (row.event_type === operation) throw new Error('模拟流水失败') }
  const result = operation === 'stock_in' ? await service.stockIn(purchase(), actor) : operation === 'sale' ? await issueSale(service, outbound(), actor) : await service.transfer(move(), actor)
  assert.equal(result.success, false)
  assert.deepEqual(state, before)
})

test('已接流水后汇总漂移必须拒绝，不能再次接续伪造补库；并发出库不超卖', async () => {
  const { state, service } = fixture()
  await service.stockIn(purchase({ total_quantity: 1 }), actor)
  state.stocks[1] = 2
  const before = structuredClone(state)
  assert.equal((await issueSale(service, outbound(), actor)).code, 'INVENTORY_LEDGER_CONFLICT')
  assert.deepEqual(state, before)
  state.stocks[1] = 1
  const results = await Promise.all([issueSale(service, outbound(), actor), issueSale(service, outbound(), actor)])
  assert.equal(results.filter(row => row.success).length, 1)
  assert.equal(state.sales.length, 1)
})

test('SN按逐件真实采购批次取成本，与普通库存隔离；期初SN数量异常拒绝', () => {
  const balances = [{ stock_in_id: 1, purchase_cost: 10, usage_type: 'sale', serial_tracking: 0, quantity: 5 },
    { stock_in_id: 2, purchase_cost: 15.25, usage_type: 'sale', serial_tracking: 1, quantity: 1 }]
  const result = allocateBatches({ balances, quantity: 1, serials: [{ stock_in_id: 2, purchase_cost: '15.25' }], operation: 'sale' })
  assert.equal(result.costCents, 1525)
  assert.equal(result.allocations[0].stock_in_id, 2)
  assert.throws(() => openingBatches(0, [{ stock_in_id: 2, purchase_cost: 15.25 }]), /历史SN/)
})

test('仓储使用传入连接、绑定参数，并保留未知成本null', async () => {
  const repository = new AccessoryInventoryRepository(), calls = []
  const executor = { async query(sql, params) { calls.push({ sql, params }); return [sql.startsWith('INSERT') ? { insertId: 9 } : []] } }
  await repository.balances(5, 2, executor)
  await repository.append({ accessory_id: 5, store_id: 2, stock_in_id: null, purchase_cost: null, usage_type: 'unclassified', serial_tracking: 0, event_type: 'legacy_opening', quantity_delta: 4, operator_id: 7, time: '2026-11-13 10:00:00' }, executor)
  assert.deepEqual(calls[0].params, [5, 2])
  assert.equal(calls[1].params[3], null)
  assert.match(calls[0].sql, /FOR UPDATE/)
})

test('批次余额当前读保留零余额、按原批次顺序汇总，防止清空后重复补历史', async () => {
  const rows = [
    { id: 1, stock_in_id: null, purchase_cost: null, usage_type: 'unclassified', serial_tracking: 0, quantity_delta: 2 },
    { id: 3, stock_in_id: null, purchase_cost: null, usage_type: 'unclassified', serial_tracking: 0, quantity_delta: -2 },
    { id: 2, stock_in_id: 9, purchase_cost: '3.50', usage_type: 'sale', serial_tracking: 0, quantity_delta: 3 }
  ]
  const repository = new AccessoryInventoryRepository()
  const groups = await repository.balances(5, 1, { async query() { return [rows] } })
  assert.deepEqual(groups.map(row => [row.stock_in_id, row.quantity]), [[null, 0], [9, 3]])
})

test('入库用途及备注非法时零写入；空汇总存在SN也不能继续加库', async () => {
  const { state, service } = fixture()
  for (const extra of [{ usage_type: 'unclassified' }, { usage_type: false }, { remarks: {} }, { remarks: '字'.repeat(1001) }]) {
    const before = structuredClone(state)
    assert.equal((await service.stockIn(purchase(extra), actor)).code, 'VALIDATION_ERROR')
    assert.deepEqual(state, before)
  }
  for (const remarks of [{}, '字'.repeat(1001)]) assert.equal((await issueSale(service, outbound({ remarks }), actor)).code, 'VALIDATION_ERROR')
  state.serials.push({ accessory_id: 5, store_id: 1, status: 'in_stock', stock_in_id: 1, purchase_cost: 2 })
  const before = structuredClone(state)
  assert.equal((await service.stockIn(purchase(), actor)).code, 'INVENTORY_LEDGER_CONFLICT')
  assert.deepEqual(state, before)
})
