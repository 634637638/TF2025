'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const Service = require('../src/services/accessory-stock-correction.service')
const AccessoryService = require('../src/services/accessory.service')
const Repository = require('../src/repositories/accessory-stock-correction.repository')
const AccessoryRepository = require('../src/repositories/accessory.repository')
const Controller = require('../src/controllers/accessory.controller')
const { clearSchemaInspectorCache } = require('../src/utils/schema-inspector')
const { readFileSync } = require('node:fs')

const actor = { id: 7, name: '更正人', store_ids: [1, 2] }
const input = extra => ({ request_key: 'c'.repeat(32), accessory_id: 5, supplier_id: 9, store_id: 1,
  total_quantity: 5, purchase_cost: 12.5, usage_type: 'sale', serial_tracking: 0, serial_numbers: [], remarks: '更正数量和成本', ...extra })
const purchaseSnapshot = (accessory_id = 5, supplier_id = 8, store_id = 1) => ({ version: 1, accessory_id, supplier_id, store_id,
  name: '原商品', category: '充电器', brand_name: null, product_model: 'OLD', color_name: '白色', unit: '个', supplier_name: '原供应商', store_name: '原门店' })

/** 根模板锁替身串行同批事务；每个事务有独立暂存状态，失败不污染其他事务。 */
function fixture({ tracking = 0 } = {}) {
  let state = {
    purchases: [{ id: 10, batch_no: 'IN-10', accessory_id: 5, supplier_id: 8, store_id: 1, quantity: tracking ? 2 : 50,
      purchase_cost: 10, total_amount: tracking ? 20 : 500, status: 'completed', distribution: JSON.stringify([{ store_id: 1, quantity: tracking ? 2 : 50 }]),
      product_snapshot: purchaseSnapshot(), operator_id: 3, operator_name: '原入库员', inventory_time: '2026-11-13 10:00:00', remarks: '原备注' }],
    products: [{ id: 5, name: '原商品', category_id: 1, unit_id: 1, brand_id: null, status: 1, min_stock: 5 },
      { id: 6, name: '另一个商品', category_id: 1, unit_id: 1, brand_id: null, status: 1, min_stock: 2 }],
    events: [{ id: 1, accessory_id: 5, stock_in_id: 10, store_id: 1, event_type: 'stock_in', quantity_delta: tracking ? 2 : 50,
      purchase_cost: 10, usage_type: 'sale', serial_tracking: tracking }],
    stocks: [{ accessory_id: 5, store_id: 1, quantity: tracking ? 22 : 70, total_in: tracking ? 22 : 70, total_out: 0 }],
    serials: tracking ? ['SN-A', 'SN-B'].map((serial_number, index) => ({ id: index + 1, serial_number, accessory_id: 5, stock_in_id: 10,
      store_id: 1, status: 'in_stock', purchase_cost: 10, sale_id: null })) : [], serialEvents: [], corrections: [], paid: false
  }
  let ready = true, tail = Promise.resolve(), fail, lostResponse = false
  const calls = [], current = db => db?.state || state
  const connection = () => ({ state: null, committed: false,
    async execute(sql) { calls.push(sql) },
    async beginTransaction() { calls.push('begin') },
    async commit() {
      if (this.state) state = this.state
      this.committed = true; calls.push('commit')
      if (lostResponse) { lostResponse = false; throw Object.assign(new Error('lost response'), { code: 'ECONNRESET' }) }
    },
    async rollback() { calls.push('rollback') }, destroy() { calls.push('destroy') }
  })
  const repo = {
    async withConnection(callback) {
      const previous = tail
      let release
      tail = new Promise(resolve => { release = resolve })
      await previous
      const db = connection()
      try { return await callback(db) } finally { release() }
    },
    async ready() { return ready },
    async purchase(id, scope, db) {
      const row = current(db).purchases.find(row => Number(row.id) === Number(id))
      if (!row || !scope.allStores && !scope.storeIds.includes(Number(row.store_id))) return null
      return structuredClone(row)
    },
    async events(id, db) { return structuredClone(current(db).events.filter(event => Number(event.stock_in_id) === Number(id))) },
    async serials(id, db) { return structuredClone(current(db).serials.filter(unit => Number(unit.stock_in_id) === Number(id))) },
    async paymentExists(_id, db) { return current(db).paid },
    async byKey(key, db) { return current(db).corrections.find(row => row.request_key === key) },
    async cancelOriginal(id, db) { current(db).purchases.find(row => row.id === id).status = 'cancelled'; return true },
    async removeStock(accessoryId, storeId, quantity, _time, db) {
      const row = current(db).stocks.find(stock => stock.accessory_id === Number(accessoryId) && stock.store_id === Number(storeId))
      if (!row || row.quantity < quantity || row.total_in < quantity) return false
      row.quantity -= quantity; row.total_in -= quantity
      return true
    },
    async correctSerial(id, data, db) { Object.assign(current(db).serials.find(unit => unit.id === id), data); return true },
    async append(data, db) { if (fail === 'audit') throw new Error('audit-failed'); current(db).corrections.push({ id: current(db).corrections.length + 1, ...data }); return 1 }
  }
  const accessories = {
    withConnection: repo.withConnection,
    async assertUniqueFreeFilms(db) { assert.ok(db.state) },
    async getAccessoryById(id, db) { return structuredClone(current(db).products.find(product => Number(product.id) === Number(id))) },
    async lockAccessory(id, db) { calls.push(`root:${id}`); if (!db.state) db.state = structuredClone(state); return this.getAccessoryById(id, db) },
    async getReference(id) { return { id, status: 1, business_scope: 'both' } },
    async getBrandVariant(id, brandId, db) { return current(db).products.find(product => product.template_id === id && product.brand_id === brandId) },
    async createAccessory(data, db) { const id = 100 + current(db).products.length; current(db).products.push({ ...data, id }); return id },
    async updateAccessory(id, data, db) {
      Object.assign(current(db).products.find(product => product.id === id), data); return true
    },
    async syncProductProfileSnapshots(_id, rootId, db) {
      calls.push('profile-sync'); if (fail === 'profile') throw new Error('profile-failed')
      const root = current(db).products.find(product => product.id === rootId)
      for (const row of current(db).purchases) {
        const product = current(db).products.find(product => product.id === row.accessory_id)
        if (product && Number(product.template_id || product.id) === rootId) row.product_snapshot.product_model = root.product_model
      }
    },
    async purchaseSnapshotSource(accessoryId, supplierId, storeId, db) {
      const product = current(db).products.find(product => product.id === accessoryId)
      const root = current(db).products.find(root => root.id === Number(product.template_id || product.id))
      return { ...purchaseSnapshot(accessoryId, supplierId, storeId), name: accessoryId === 6 ? '另一个商品' : '后来的商品名', product_model: Object.hasOwn(root, 'product_model') ? root.product_model : 'LATER', supplier_name: '新供应商', store_name: '新门店' }
    },
    async lockStoreStock(accessoryId, storeId, db) { return current(db).stocks.find(row => row.accessory_id === Number(accessoryId) && row.store_id === Number(storeId)) },
    async createStockInRecord(data, db) {
      if (fail === 'purchase') throw new Error('purchase-failed')
      if (current(db).purchases.some(row => row.request_key === data.request_key)) throw Object.assign(new Error('duplicate'), { code: 'ER_DUP_ENTRY' })
      const id = current(db).purchases.length + 10
      current(db).purchases.push({ ...data, id }); return id
    },
    async updateAccessoryStock(accessoryId, storeId, quantity, _op, _min, db) {
      let row = await this.lockStoreStock(accessoryId, storeId, db)
      if (!row) { row = { accessory_id: Number(accessoryId), store_id: storeId, quantity: 0, total_in: 0, total_out: 0 }; current(db).stocks.push(row) }
      row.quantity += quantity; row.total_in += quantity
    },
    async lockSerials(numbers, db) { return current(db).serials.filter(unit => numbers.includes(unit.serial_number)) },
    async createSerial(data, db) { const id = current(db).serials.length + 1; current(db).serials.push({ ...data, id, status: 'in_stock', sale_id: null }); return id },
    async createSerialEvent(data, db) { if (fail === 'serial') throw new Error('serial-failed'); current(db).serialEvents.push(data) },
    async stockInReady() { return true },
    async getStockInByKey(key) {
      const row = state.purchases.find(row => row.request_key === key)
      return row ? { ...row, corrected: state.corrections.some(correction => correction.source_stock_in_id === row.id) } : null
    }
  }
  const inventory = {
    repository: {
      async batchConflict() { return fail === 'balance' },
      async append(data, db) { if (fail === 'event') throw new Error('event-failed'); current(db).events.push({ ...data, id: current(db).events.length + 1 }) }
    },
    async ensureBalance() {},
    async receive(data, quantity, db) { await this.repository.append({ ...data, event_type: 'stock_in', quantity_delta: quantity }, db) }
  }
  const accessoryService = new AccessoryService({ repository: accessories, inventoryService: inventory })
  const service = new Service({ repository: repo, accessoryService })
  return { service, repo, accessories, accessoryService, calls, get state() { return state }, notReady() { ready = false }, fail(value) { fail = value }, loseResponse() { lostResponse = true } }
}

test('原批次0进价可更正为非零，替代采购和库存成本一致且重试不重复写入', async () => {
  const f = fixture()
  Object.assign(f.state.purchases[0], { purchase_cost: 0, total_amount: 0 })
  f.state.events[0].purchase_cost = 0
  const request = input({ total_quantity: 50 })
  const receipt = await f.service.correct(actor, 10, request)
  const replacement = f.state.purchases.find(row => row.id === receipt.stock_in_id)
  assert.equal(replacement.purchase_cost, 12.5)
  assert.equal(replacement.total_amount, 625)
  assert.equal(f.state.events.find(row => row.stock_in_id === replacement.id && row.event_type === 'stock_in').purchase_cost, 12.5)
  assert.equal(f.state.purchases[0].purchase_cost, 0)
  assert.equal((await f.service.context(actor, replacement.id)).purchase_cost, 12.5)
  assert.equal((await f.service.correct(actor, 10, request)).replayed, true)
  assert.equal(f.state.purchases.length, 2)
})

test('原批次编辑回填原采购数量/进价/供应商及SN模式，不拿模板默认值覆盖', async () => {
  const f = fixture(), context = await f.service.context(actor, 10)
  assert.equal(context.total_quantity, 50); assert.equal(context.purchase_cost, 10); assert.equal(context.supplier_id, 8)
  assert.equal(context.accessory.product_model, 'OLD'); assert.equal(context.operator_name, '原入库员')
  assert.deepEqual(context.serial_numbers, [])
  assert.equal(Object.hasOwn(context, 'product_snapshot'), false)
  assert.equal(f.calls.includes('commit'), false)
})

test('数量50更正为5，同时改进价/供应商/门店，保留原单并仅调整本批实物及应付', async () => {
  const f = fixture(), original = structuredClone(f.state.purchases[0]), products = structuredClone(f.state.products)
  const result = await f.service.correct(actor, 10, input({ store_id: 2, product_model: 'NEW' }))
  assert.equal(result.quantity, 5); assert.equal(result.total_amount, 62.5); assert.equal(result.replayed, false)
  assert.deepEqual(f.state.purchases[0], { ...original, status: 'cancelled', product_snapshot: { ...original.product_snapshot, product_model: 'NEW' } })
  const after = f.state.purchases[1]
  assert.equal(after.supplier_id, 9); assert.equal(after.store_id, 2); assert.equal(after.product_snapshot.product_model, 'NEW')
  assert.equal(after.product_snapshot.name, '原商品'); assert.equal(after.operator_id, 3)
  assert.deepEqual(f.state.products, products.map(product => product.id === 5 ? { ...product, product_model: 'NEW' } : product))
  assert.deepEqual(f.state.stocks.map(row => [row.store_id, row.quantity, row.total_in, row.total_out]), [[1, 20, 20, 0], [2, 5, 5, 0]])
  assert.deepEqual(f.state.events.map(event => [event.stock_in_id, event.event_type, event.quantity_delta]), [[10, 'stock_in', 50], [10, 'stock_correct', -50], [11, 'stock_in', 5]])
  assert.equal(f.state.corrections[0].before_snapshot.quantity, 50)
  assert.equal(f.state.corrections[0].after_snapshot.quantity, 5)
  assert.equal(f.state.corrections[0].operator_id, 7)
  assert.equal(f.state.purchases.filter(row => row.status === 'completed').reduce((sum, row) => sum + row.total_amount, 0), 62.5)
})

test('多颜色批次更正先锁组父及全部颜色根，厂家型号同步整个模板而不合并库存', async () => {
  const f = fixture()
  Object.assign(f.state.products[0], { color_id: 3, color_template_id: 3 })
  Object.assign(f.state.products[1], { color_id: 4, color_template_id: 3 })
  f.state.products.push({ id: 3, name: '多色模板', status: 1, product_model: 'OLD' })
  const family = [{ template_id: 3, accessory_id: 5, color_id: 3 }, { template_id: 3, accessory_id: 6, color_id: 4 }]
  f.accessories.templateColors = { assertReady: async () => {}, families: async () => structuredClone(family) }
  f.accessories.getCompatibleModelIds = async () => []
  const { AccessoryTemplateColorService } = require('../src/services/accessory-template-color.service')
  f.accessoryService.templateColors = new AccessoryTemplateColorService(f.accessories)
  const result = await f.service.correct(actor, 10, input({ product_model: 'NEW-MODEL' }))
  assert.equal(result.quantity, 5)
  assert.deepEqual(f.calls.filter(call => call.startsWith('root:')).slice(0, 3), ['root:3', 'root:5', 'root:6'])
  assert.equal(f.state.products.every(product => product.product_model === 'NEW-MODEL'), true)
  assert.equal(f.state.purchases[1].accessory_id, 5)
  assert.equal(f.state.stocks.every(stock => stock.accessory_id === 5), true)
  assert.equal(f.state.purchases[0].quantity, 50); assert.equal(f.state.purchases[0].purchase_cost, 10)
})

test('原入库型号更正同步模板及同模板历史，失败回滚，原请求重放不重复同步', async () => {
  const f = fixture(), request = input({ product_model: 'NEW' })
  f.state.products.push({ id: 7, template_id: 5, product_model: '旧副本', brand_id: 2, status: 0 })
  f.state.purchases.push({ ...structuredClone(f.state.purchases[0]), id: 20, accessory_id: 7,
    product_snapshot: { ...purchaseSnapshot(7), product_model: '旧副本' } })
  await f.service.correct(actor, 10, request)
  assert.equal(f.state.products[0].product_model, 'NEW')
  assert.equal(f.state.purchases.find(row => row.id === 20).product_snapshot.product_model, 'NEW')
  assert.equal(f.state.products[1].product_model, undefined)
  const after = structuredClone(f.state)
  assert.equal((await f.service.correct(actor, 10, request)).replayed, true)
  assert.deepEqual(f.state, after)
  assert.equal(f.calls.filter(call => call === 'profile-sync').length, 1)
  const failed = fixture(), before = structuredClone(failed.state)
  failed.fail('profile')
  await assert.rejects(failed.service.correct(actor, 10, request), /profile-failed/)
  assert.deepEqual(failed.state, before)
  assert.equal(failed.calls.at(-1), 'rollback')
})

test('数量增加、实际品牌或商品选错均复用入库规则，跨模板锁按ID排序，不修改共享主档', async () => {
  const f = fixture()
  await f.service.correct(actor, 10, input({ accessory_id: 6, total_quantity: 60, brand_id: 2 }))
  assert.deepEqual(f.calls.filter(call => call.startsWith('root:')).slice(0, 2), ['root:5', 'root:6'])
  assert.equal(f.state.purchases[1].quantity, 60)
  assert.equal(f.state.purchases[1].product_snapshot.product_model, 'LATER')
  assert.equal(f.state.purchases[0].product_snapshot.product_model, 'OLD')
  assert.equal(f.state.products.at(-1).template_id, 6)
  assert.equal(f.state.products[0].name, '原商品')
  assert.equal(f.state.stocks[0].quantity, 20)
})

test('SN更正保留正确件ID、作废错误SN并新增替换件，下一次更正可恢复误删SN', async () => {
  const f = fixture({ tracking: 1 })
  const first = await f.service.correct(actor, 10, input({ serial_tracking: 1, serial_numbers: [{ serial_number: 'SN-A', store_id: 1 }, { serial_number: 'SN-C', store_id: 1 }] }))
  assert.equal(f.state.serials.find(unit => unit.serial_number === 'SN-A').id, 1)
  assert.equal(f.state.serials.find(unit => unit.serial_number === 'SN-B').status, 'voided')
  assert.equal(f.state.serials.filter(unit => unit.status === 'in_stock').length, 2)
  await f.service.correct(actor, first.stock_in_id, input({ request_key: 'd'.repeat(32), serial_tracking: 1,
    serial_numbers: [{ serial_number: 'SN-B', store_id: 1 }] }))
  assert.equal(f.state.serials.find(unit => unit.serial_number === 'SN-B').id, 2)
  assert.equal(f.state.serials.find(unit => unit.serial_number === 'SN-B').status, 'in_stock')
  assert.equal(f.state.serials.filter(unit => unit.status === 'in_stock').length, 1)
  assert.equal(f.state.corrections.length, 2)
})

test('普通和SN模式可互改；隐藏SN字段不能将原SN批次改为普通以绕过权限', async () => {
  const plain = fixture()
  await plain.service.correct(actor, 10, input({ serial_tracking: 1, serial_numbers: [{ serial_number: 'SN-N', store_id: 1 }] }))
  assert.equal(plain.state.purchases[1].quantity, 1)
  const tracked = fixture({ tracking: 1 }), before = structuredClone(tracked.state)
  await assert.rejects(tracked.service.correct(actor, 10, input(), { includeSerials: false }), { statusCode: 403 })
  assert.deepEqual(tracked.state, before)
  await tracked.service.correct(actor, 10, input())
  assert.equal(tracked.state.serials.every(unit => unit.status === 'voided'), true)
})

test('重复或其他批次SN拒绝，原单/新单/库存/累计数/流水/审计全部回滚', async () => {
  const f = fixture()
  f.state.serials.push({ id: 99, serial_number: 'OTHER', stock_in_id: 99, accessory_id: 6, store_id: 1, status: 'in_stock' })
  const before = structuredClone(f.state)
  await assert.rejects(f.service.correct(actor, 10, input({ serial_tracking: 1, serial_numbers: [{ serial_number: 'OTHER', store_id: 1 }] })), { code: 'DUPLICATE_SERIAL' })
  assert.deepEqual(f.state, before)
})

for (const event_type of ['sale', 'gift', 'transfer_out', 'transfer_in', 'sale_return', 'gift_return', 'legacy_opening']) {
  test(`原批次已有${event_type}时拒绝更正，净余量恢复也不能抹除历史`, async () => {
    const f = fixture(); f.state.events.push({ ...f.state.events[0], id: 2, event_type, quantity_delta: 0 })
    const before = structuredClone(f.state)
    await assert.rejects(f.service.correct(actor, 10, input()), { code: 'STOCK_CORRECTION_USED' })
    assert.deepEqual(f.state, before)
  })
}

test('存在付款及撤销付款历史均拦截；原采购锁先于付款读取', async () => {
  const f = fixture(); f.state.paid = true
  const before = structuredClone(f.state)
  await assert.rejects(f.service.correct(actor, 10, input()), { code: 'STOCK_CORRECTION_PAID' })
  assert.deepEqual(f.state, before)
})

test('两个并发相同更正只有一次替代采购；不同请求编辑过期原单返回409', async () => {
  const f = fixture()
  const results = await Promise.all([f.service.correct(actor, 10, input()), f.service.correct(actor, 10, input())])
  assert.deepEqual(results.map(row => row.replayed).sort(), [false, true])
  assert.equal(f.state.purchases.length, 2); assert.equal(f.state.corrections.length, 1)
  const before = structuredClone(f.state)
  await assert.rejects(f.service.correct(actor, 10, input({ request_key: 'd'.repeat(32) })), { code: 'STOCK_CORRECTION_STALE' })
  await assert.rejects(f.service.correct(actor, 10, input({ total_quantity: 6 })), { code: 'STOCK_CORRECTION_REQUEST_CONFLICT' })
  assert.deepEqual(f.state, before)
})

test('提交成功但响应断开时仍可重试原更正，且原入库幂等回执不因更正失效', async () => {
  const f = fixture(), request = { request_key: 'a'.repeat(32), accessory_id: 5, supplier_id: 8, store_id: 1, total_quantity: 50, purchase_cost: 10, usage_type: 'sale' }
  Object.assign(f.state.purchases[0], { request_key: request.request_key, request_hash: f.accessoryService.parseStockInInput(request, actor).hash, operator_id: 7 })
  f.loseResponse()
  await assert.rejects(f.service.correct(actor, 10, input()), { code: 'ECONNRESET' })
  const result = await f.service.correct(actor, 10, input())
  assert.equal(result.replayed, true); assert.equal(f.state.purchases.length, 2)
  const replay = await f.accessoryService.stockIn(request, actor)
  assert.equal(replay.success, true); assert.equal(replay.data.quantity, 50); assert.equal(replay.data.total_amount, 500)
  assert.equal(replay.data.stock_in_id, 10)
})

for (const failure of ['purchase', 'event', 'audit', 'balance', 'serial']) {
  test(`${failure}阶段失败回滚整批，不留下作废原单、库存差异或孤立更正`, async () => {
    const f = fixture({ tracking: 1 }), before = structuredClone(f.state)
    f.fail(failure)
    await assert.rejects(f.service.correct(actor, 10, input()))
    assert.deepEqual(f.state, before); assert.equal(f.calls.at(-1), 'rollback')
  })
}

test('越店、未知历史、错误原数量/成本和停用资料不被静默修补', async () => {
  const cross = fixture()
  await assert.rejects(cross.service.correct({ ...actor, store_ids: [2] }, 10, input({ store_id: 2 })), { statusCode: 404 })
  for (const corrupt of [f => { f.state.events = [] }, f => { f.state.events[0].quantity_delta = 49 }, f => { f.state.purchases[0].total_amount = 1 },
    f => { f.state.products[0].status = 0 }, f => { f.state.events[0].store_id = 99 }]) {
    const f = fixture(); corrupt(f); const before = structuredClone(f.state)
    await assert.rejects(f.service.correct(actor, 10, input()))
    assert.deepEqual(f.state, before)
  }
})

test('历史多店分配不能被单店表单静默合并或移库，读取和提交均保留原分配', async () => {
  for (const distribution of [[{ store_id: 1, quantity: 30 }, { store_id: 2, quantity: 20 }], [{ store_id: 2, quantity: 50 }]]) {
    const f = fixture()
    f.state.purchases[0].distribution = JSON.stringify(distribution)
    f.state.events = distribution.map((item, index) => ({ ...f.state.events[0], ...item, id: index + 1, quantity_delta: item.quantity }))
    const before = structuredClone(f.state)
    await assert.rejects(f.service.context(actor, 10), { statusCode: 409, code: 'STOCK_CORRECTION_DISTRIBUTION' })
    await assert.rejects(f.service.correct(actor, 10, input()), { statusCode: 409, code: 'STOCK_CORRECTION_DISTRIBUTION' })
    assert.deepEqual(f.state, before)
  }
})

test('更正输入沿用严格入库规则，拒绝脏值、隐藏模板写入和伪造元数据', async () => {
  for (const invalid of [{ total_quantity: '12abc' }, { total_quantity: true }, { purchase_cost: '1e3' }, { purchase_cost: -1 },
    { store_id: [1] }, { supplier_id: {} }, { serial_tracking: true }, { usage_type: 'bad' }, { sale_price: 99 }, { product_snapshot: {} },
    { operator_id: 100 }, { request_key: 'bad' }, { serial_numbers: ['SN'] }]) {
    const f = fixture()
    await assert.rejects(f.service.correct(actor, 10, input(invalid)), { statusCode: 400 })
    assert.equal(f.calls.length, 0)
  }
  const f = fixture(); f.notReady()
  await assert.rejects(f.service.correct(actor, 10, input()), { code: 'STOCK_CORRECTION_NOT_READY' })
  assert.equal(f.calls.length, 0)
})

test('更正仓储整单门店过滤及参数化写入；作废冲回不增加销售累计', async () => {
  const queries = [], db = { async query(sql, values) { queries.push({ sql, values }); return [[{ id: 10 }]] } }
  const repo = new Repository()
  await repo.purchase(10, { allStores: false, storeIds: [1, 2] }, db, true)
  assert.match(queries[0].sql, /JSON_CONTAINS/); assert.match(queries[0].sql, /FOR UPDATE/)
  assert.deepEqual(queries[0].values, [10, 1, 2, 1, 2])
  await repo.removeStock(5, 1, 50, '2026-11-14 10:00:00', db)
  assert.match(queries[1].sql, /total_in = total_in - \?/)
  assert.doesNotMatch(queries[1].sql, /total_out\s*=/)
  assert.deepEqual(queries[1].values, [50, 50, '2026-11-14 10:00:00', 5, 1, 50, 50])
})

test('原单只有正式更正关联才可继续核对入库回执，普通作废不能伪装已更正', async () => {
  clearSchemaInspectorCache()
  const repo = new AccessoryRepository(), row = { id: 10, status: 'cancelled' }
  let linked = true
  const db = { async execute() { return [[{}]] }, async query(sql) {
    return [sql.includes('FROM accessory_stock_in WHERE') ? [{ ...row }] : linked ? [{ id: 1 }] : []]
  } }
  assert.equal((await repo.getStockInByKey('key', db)).corrected, true)
  linked = false
  assert.equal((await repo.getStockInByKey('key', db)).corrected, false)
  clearSchemaInspectorCache()
})

test('更正HTTP入口要求编辑权限及字段拒写；错误不泄露底层数据库信息', async () => {
  const routes = readFileSync(require.resolve('../src/routes/accessories'), 'utf8')
  assert.match(routes, /router\.post\('\/stock-in\/:id\/corrections', unifiedAuth, requirePermission\('accessories:edit'\), rejectHiddenAccessoryWrites/)
  const res = () => ({ status(code) { this.statusCode = code; return this }, json(body) { this.body = body; return this } })
  let calls = 0, hidden = ['price_info.purchase_cost']
  const controller = new Controller({ correctionService: { async correct() { calls++; throw new Error('private-sql') } },
    masking: { async getUserFieldPermissions() { return { hiddenFields: hidden } }, filterSensitiveFields: rows => rows }, logger: { error() {} } })
  const request = { user: actor, params: { id: '10' }, body: input() }
  const denied = res(); await controller.correctStockIn(request, denied)
  assert.equal(denied.statusCode, 403); assert.equal(calls, 0)
  hidden = []
  const failed = res(); await controller.correctStockIn(request, failed)
  assert.equal(failed.statusCode, 500); assert.equal(JSON.stringify(failed.body).includes('private-sql'), false)
})

test('原资料读取明确区分未迁移和历史缺来源，409保留业务原因且不写库存', async () => {
  const f = fixture(), before = structuredClone(f.state)
  f.notReady()
  await assert.rejects(f.service.context(actor, 10), { statusCode: 409, code: 'STOCK_CORRECTION_NOT_READY' })
  assert.deepEqual(f.state, before)
  const prerequisites = fixture()
  prerequisites.accessories.stockInReady = async () => false
  await assert.rejects(prerequisites.service.context(actor, 10), { statusCode: 409, code: 'STOCK_CORRECTION_NOT_READY' })
  await assert.rejects(prerequisites.service.correct(actor, 10, input()), { statusCode: 409, code: 'STOCK_CORRECTION_NOT_READY' })
  assert.deepEqual(prerequisites.state, before)
  const legacy = fixture()
  legacy.state.purchases[0].product_snapshot = null
  const legacyBefore = structuredClone(legacy.state)
  await assert.rejects(legacy.service.context(actor, 10), { statusCode: 409, code: 'STOCK_CORRECTION_UNTRACKED' })
  await assert.rejects(legacy.service.correct(actor, 10, input()), { statusCode: 409, code: 'STOCK_CORRECTION_UNTRACKED' })
  assert.deepEqual(legacy.state, legacyBefore)
  const response = { status(code) { this.statusCode = code; return this }, json(body) { this.body = body; return this } }
  const controller = new Controller({ correctionService: legacy.service,
    masking: { filterSensitiveFields: rows => rows }, logger: { error() {} } })
  await controller.stockCorrectionContext({ user: actor, params: { id: 10 }, fieldPermissions: { hiddenFields: [] } }, response)
  assert.equal(response.statusCode, 409)
  assert.equal(response.body.code, 'STOCK_CORRECTION_UNTRACKED')
  assert.match(response.body.message, /历史入库缺少原资料快照/)
})

test('更正资料嵌套字段服从原权限脱敏，SN权限缺失拒绝原SN上下文', async () => {
  const response = () => ({ status(code) { this.statusCode = code; return this }, json(body) { this.body = body; return this } })
  const f = fixture(), req = { user: actor, params: { id: 10 }, fieldPermissions: { hiddenFields: [
    'basic_info.brand_name', 'basic_info.specifications', 'operator_info.operator_name', 'time_info.inventory_time', 'other_info.remarks', 'basic_info.serial_number'
  ] } }
  const controller = new Controller({ correctionService: f.service,
    masking: { filterSensitiveFields: rows => rows }, logger: { error() {} } })
  const plain = response(); await controller.stockCorrectionContext(req, plain)
  assert.equal(plain.statusCode, 200)
  assert.equal(plain.body.data.accessory.product_model, null)
  assert.equal(plain.body.data.accessory.brand_id, null)
  assert.equal(plain.body.data.operator_name, null); assert.equal(plain.body.data.inventory_time, null)
  assert.equal(plain.body.data.remarks, null); assert.equal(plain.body.data.serial_numbers, null)
  assert.equal(Object.hasOwn(plain.body.data, 'product_snapshot'), false)
  const serials = fixture({ tracking: 1 }); controller.corrections = serials.service
  const denied = response(); await controller.stockCorrectionContext(req, denied)
  assert.equal(denied.statusCode, 403); assert.equal(denied.body.code, 'FIELD_PERMISSION_DENIED')
  assert.equal(Object.hasOwn(denied.body, 'data'), false)
})
