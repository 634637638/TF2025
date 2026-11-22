'use strict'

const assert = require('node:assert/strict')
const AccessoryService = require('../../src/services/accessory.service')
const AccessoryInventoryService = require('../../src/services/accessory-inventory.service')
const AccessoryInventoryRepository = require('../../src/repositories/accessory-inventory.repository')
const { clearSchemaInspectorCache } = require('../../src/services/schema-inspector.service')
const CustomerPointsLedgerService = require('../../src/services/customer-points-ledger.service')
const { ledgerExecutor } = require('./customer-points-ledger')

const actor = { id: 7, name: '销售员', store_ids: [1, 2] }
const time = '2026-11-13 16:00:00'
const incoming = (id, cost, qty, tracking = 0, usage = 'sale') => ({ id, accessory_id: 5, store_id: 1,
  stock_in_id: id, purchase_cost: cost, usage_type: usage, serial_tracking: tracking,
  event_type: 'stock_in', quantity_delta: qty, sale_id: null })

function fixture({ events = [incoming(1, 10, 2), incoming(2, 20, 2)], serials = [], installed = true } = {}) {
  clearSchemaInspectorCache()
  const state = { events: structuredClone(events), stocks: { 1: events.filter(row => row.accessory_id === 5).reduce((sum, row) => sum + row.quantity_delta, 0), 2: 0 }, extraStocks: {}, sales: [], serials,
    serialEvents: [], product: { id: 5, status: 1, template_id: 3, min_stock: 5 }, products: {}, storeActive: 1,
    customers: { 9: 0 }, entries: [], allocations: [], aftersales: [] }
  let active = false, failure = '', tail = Promise.resolve()
  const ledger = ledgerExecutor({ getState: () => state, isActive: () => active })
  const check = db => { assert.equal(db, connection); assert.equal(active, true) }
  const stock = (id, store) => id === 5 ? state.stocks : (state.extraStocks[id] ||= { [store]: 0 })
  const connection = {
    async execute(sql, params) {
      if (sql.includes('FROM sales_goods_exchanges e')) return [[]]
      if (sql === 'SELECT id, points FROM customers WHERE id = ?') return [state.customers[params[0]] === undefined ? [] : [{ id: params[0], points: state.customers[params[0]] }]]
      if (sql.startsWith('SELECT id, name, phone, points FROM customers WHERE id = ?')) return [state.customers[params[0]] === undefined ? [] : [{
        id: params[0], name: '客户', phone: '13800000000', points: state.customers[params[0]]
      }]]
      if (sql.includes('information_schema.COLUMNS')) return [installed ? [{ present: 1 }] : []]
      return ledger.execute(sql, params)
    },
    async query(sql, params) {
      check(connection)
      if (sql.startsWith('INSERT INTO accessory_inventory_events')) {
        const fields = sql.includes('source_event_id') ? ['accessory_id', 'store_id', 'stock_in_id', 'purchase_cost', 'usage_type', 'serial_tracking',
          'event_type', 'quantity_delta', 'sale_id', 'operator_id', 'operator_name', 'remarks', 'created_at', 'source_event_id', 'return_key', 'return_hash']
          : ['accessory_id', 'store_id', 'stock_in_id', 'purchase_cost', 'usage_type', 'serial_tracking', 'event_type', 'quantity_delta', 'transfer_id', 'sale_id',
            'operator_id', 'operator_name', 'remarks', 'created_at']
        const row = { id: state.events.length + 1, ...Object.fromEntries(fields.map((field, i) => [field, params[i]])) }
        state.events.push(row)
        if (failure === 'inventory' && sql.includes('source_event_id')) throw new Error('inventory-failed')
        return [{ insertId: row.id }]
      }
      if (sql.includes('FROM accessory_inventory_events WHERE sale_id')) { assert.match(sql, /FOR UPDATE/); return [state.events.filter(row => row.sale_id === params[0]).map(row => ({ ...row }))] }
      if (sql.includes('FROM accessory_inventory_events WHERE return_key')) { assert.match(sql, /FOR UPDATE/); return [state.events.filter(row => row.return_key === params[0]).map(row => ({ ...row }))] }
      if (sql.includes('FROM accessory_inventory_events e')) { assert.match(sql, /FOR UPDATE/); return [state.events.filter(row => row.accessory_id === params[0] && row.store_id === params[1]).map(row => ({ ...row }))] }
      if (sql.includes('FROM accessory_serials sn')) return [state.serials.filter(row => row.accessory_id === params[0] && row.store_id === params[1] && row.status === 'in_stock')]
      throw new Error(`未处理SQL：${sql}`)
    }
  }
  const repository = {
    async getAccessoryById(id, db) { check(db); return id === 5 ? { ...state.product } : state.products[id] ? { ...state.products[id] } : null },
    async lockAccessory(id, db) { check(db); const product = [state.product, ...Object.values(state.products)].find(row => row.template_id === id); return product ? { id, status: product.status } : null },
    async getReference(id, field, db) { check(db); return { id, status: state.storeActive } },
    async lockStoreStock(id, store, db) { check(db); return { quantity: stock(id, store)[store] || 0 } },
    async countStockSerials(id, store, db) { check(db); return state.serials.filter(row => row.accessory_id === id && row.store_id === store && row.status === 'in_stock').length },
    async lockSerials(numbers, db) { check(db); return state.serials.filter(row => numbers.includes(row.serial_number)) },
    async createSalesRecord(data, db) { check(db); const id = state.sales.length + 1; state.sales.push({ ...data, id }); return id },
    async saleForReturn(id, db) { check(db); return state.sales.find(row => row.id === id) },
    async deductStock(id, store, count, db) { check(db); stock(id, store)[store] -= count; return true },
    async restoreSaleStock(id, store, count, min, db) { check(db); stock(id, store)[store] = (stock(id, store)[store] || 0) + count; if (failure === 'stock') throw new Error('stock-failed'); return true },
    async markSerialOut(id, sale, type, date, db) { check(db); const row = state.serials.find(row => row.id === id); Object.assign(row, { sale_id: sale, status: type === 'gift' ? 'gifted' : 'sold' }); return true },
    async returnSerial(id, sale, store, date, db) { check(db); const row = state.serials.find(row => row.id === id); Object.assign(row, { sale_id: null, status: 'in_stock', store_id: store }); if (failure === 'serial') throw new Error('serial-failed'); return true },
    async createSerialEvent(data, db) { check(db); state.serialEvents.push(data); if (failure === 'serial_event' && data.event_type === 'return') throw new Error('serial-event-failed') }
  }
  const service = new AccessoryService({ repository, inventoryService: new AccessoryInventoryService({ repository: new AccessoryInventoryRepository() }) })
  service.generateSaleNo = async () => `PS261113${String(state.sales.length + 1).padStart(6, '0')}`
  const transaction = async operation => {
    const previous = tail
    let release
    tail = new Promise(resolve => { release = resolve })
    await previous
    const before = structuredClone(state)
    active = true
    try { return await operation(connection) }
    catch (error) { Object.assign(state, before); throw error }
    finally { active = false; release() }
  }
  const sell = (input = {}, context = {}) => transaction(db => service.issueSale({ accessory_id: 5, store_id: 1, quantity: 4, unit_price: 30,
    customer_name: '客户', customer_phone: '13800000000', ...input }, actor, db, { time, ...context }))
  const returnStock = (input = {}, user = actor) => transaction(async db => {
    const result = await service.returnSaleStock({ sale_id: 1, store_id: 1, quantity: 1, request_key: 'return:stock:1', ...input }, user, db, { time })
    if (failure === 'outer') throw new Error('refund-failed')
    return result
  })
  return { state, service, connection, transaction, sell, returnStock,
    pointsLedger: new CustomerPointsLedgerService({ tableExists: async () => true }), failAt(value) { failure = value } }
}

module.exports = fixture
