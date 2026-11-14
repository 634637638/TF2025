'use strict'
const test = require('node:test')
const assert = require('node:assert/strict')
const AccessoryService = require('../src/services/accessory.service')
const AccessoryInventoryRepository = require('../src/repositories/accessory-inventory.repository')
const AccessoryController = require('../src/controllers/accessory.controller')
const actor = { id: 7, store_ids: [1, 2] }
const row = () => ({ row_key: 'event:91', accessory_id: 31, store_id: 2, stock_in_id: 11,
  quantity: 4, purchase_cost: '12.50', usage_type: 'sale', serial_tracking: 0, source_status: 'purchase',
  batch_no: 'BATCH-11', supplier_name: '采购供应商', brand_name: '实际品牌', product_model: 'MODEL-A',
  inventory_time: '2026-11-14 10:00:00', inventory_operator_name: '入库员' })
const fixture = () => {
  const calls = [], connection = {
    async execute(sql) { calls.push(['sql', sql]) },
    async beginTransaction() { calls.push(['begin']) },
    async rollback() { calls.push(['rollback']) }
  }
  const repository = {
    async withConnection(fn) { calls.push(['connection']); try { return await fn(connection) } finally { calls.push(['release']) } },
    async getAccessoryById(id, executor) { assert.equal(executor, connection); calls.push(['item', id]); return { id } }
  }
  const inventory = {
    async batchConflict(input, executor) { assert.equal(executor, connection); calls.push(['integrity', input]); return false },
    async currentBatches(input, executor) { assert.equal(executor, connection); calls.push(['read', input]); return { data: [row()], pagination: { page: input.page, page_size: input.pageSize, total: 41 } } }
  }
  const service = new AccessoryService({ repository, inventoryService: { repository: inventory }, tableExists: async (_table, executor) => { assert.equal(executor, connection); return true } })
  return { service, repository, inventory, calls }
}

test('批次查询严格校验参数和授权店铺，非法输入不得取得数据库连接', async () => {
  const { service, calls } = fixture()
  for (const id of [true, [], null, '', '1 OR 1=1', 0]) await assert.rejects(service.getInventoryBatches(actor, id), { statusCode: 400 })
  for (const query of [{ page: true }, { page: ['1'] }, { page: 1000001 }, { page: 1.5 }, { page_size: 101 },
    { page_size: 0 }, { store_id: '' }, { store_id: [1] }, { store_id: false }, { supplier_id: 2 }, { include_variants: false }]) {
    await assert.rejects(service.getInventoryBatches(actor, '31', query), { statusCode: 400 })
  }
  await assert.rejects(service.getInventoryBatches(actor, 31, { store_id: 3 }), { statusCode: 403 })
  await assert.rejects(service.getInventoryBatches(null, 31))
  assert.deepEqual(calls, [])
})

test('批次余额与总数在同连接只读RR快照读取，结束回滚且不接续历史', async () => {
  const { service, calls } = fixture()
  const result = await service.getInventoryBatches(actor, '31', { store_id: '2', page: '3', page_size: '20' })
  assert.equal(result.data[0].purchase_cost, '12.50')
  assert.equal(result.data[0].quantity, 4)
  assert.deepEqual(calls.map(call => call[0]), ['connection', 'sql', 'begin', 'item', 'integrity', 'read', 'rollback', 'release'])
  assert.match(calls[1][1], /REPEATABLE READ, READ ONLY/)
  assert.deepEqual(calls.find(call => call[0] === 'read')[1], { accessoryId: 31, scope: { allStores: false, requestedStoreId: 2, storeIds: [2] }, page: 3, pageSize: 20 })
})

test('结构缺失、商品不存在、余额冲突和查询失败均回滚且不返回伪造批次', async () => {
  for (const reason of ['schema', 'missing', 'conflict', 'database']) {
    const { service, repository, inventory, calls } = fixture()
    if (reason === 'schema') service.tableExists = async () => false
    if (reason === 'missing') repository.getAccessoryById = async () => null
    if (reason === 'conflict') inventory.batchConflict = async () => true
    if (reason === 'database') inventory.currentBatches = async () => { throw new Error('读取失败') }
    await assert.rejects(service.getInventoryBatches(actor, 31), reason === 'database' ? /读取失败/ : { statusCode: reason === 'missing' ? 404 : 409 })
    assert.deepEqual(calls.slice(-2), [['rollback'], ['release']])
    if (reason !== 'database') assert.equal(calls.some(call => call[0] === 'read'), false)
  }
})

test('无门店授权的读取条件为空集，模板与实际品牌商品均受相同门店范围限制', async () => {
  const repository = new AccessoryInventoryRepository()
  const empty = repository.batchQueries(31, { allStores: false, storeIds: [] })
  assert.match(empty.groups, /1 = 0/)
  assert.match(empty.stocks, /1 = 0/)
  const scoped = repository.batchQueries(31, { allStores: false, storeIds: [2, 4] })
  assert.deepEqual(scoped.params, [31, 31, 2, 4])
  assert.deepEqual(scoped.stockParams, [31, 31, 2, 4])
  assert.match(scoped.groups, /a.id = \? OR a.template_id = \?/)
  assert.match(scoped.groups, /e.store_id IN \(\?, \?\)/)
  assert.match(scoped.stocks, /st.store_id IN \(\?, \?\)/)
})

test('真实批次按原成本、用途、SN方式与当前店分组；仅剩余正数分页，未接续旧库存来源成本保持未知', async () => {
  const repository = new AccessoryInventoryRepository(), calls = []
  const executor = { async query(sql, params) {
    calls.push({ sql, params })
    return calls.length === 1 ? [[{ total: 41 }]] : [[row(), { ...row(), row_key: 'stock:31:2', stock_in_id: null, source_status: 'untracked', purchase_cost: null }]]
  } }
  const result = await repository.currentBatches({ accessoryId: 31, scope: { allStores: false, storeIds: [2] }, page: 3, pageSize: 20 }, executor)
  assert.deepEqual(result.pagination, { page: 3, page_size: 20, total: 41, total_pages: 3, has_next: false, has_prev: true })
  assert.equal(result.data[1].purchase_cost, null)
  assert.deepEqual(calls[0].params, [31, 31, 2, 31, 31, 2])
  assert.deepEqual(calls[1].params, [...calls[0].params, 20, 40])
  for (const { sql } of calls) {
    assert.match(sql, /SUM\(e.quantity_delta\)/)
    assert.match(sql, /GROUP BY e.accessory_id, e.store_id, e.stock_in_id, e.purchase_cost, e.usage_type, e.serial_tracking/)
    assert.match(sql, /g.quantity > 0/)
    assert.match(sql, /NULL, NULL, 'unclassified', NULL/)
    assert.match(sql, /NOT EXISTS/)
    assert.doesNotMatch(sql, /FOR UPDATE|INSERT|UPDATE |DELETE|CREATE|ALTER/)
  }
  assert.match(calls[1].sql, /supplier.id = si.supplier_id/)
  assert.doesNotMatch(calls[1].sql, /a.purchase_cost|a.supplier_id/)
})

test('余额核对覆盖负批次、采购来源丢失、SN数差异和孤立流水，不让正负批次抵消后伪装正常', async () => {
  const repository = new AccessoryInventoryRepository(), calls = []
  const result = await repository.batchConflict({ accessoryId: 31, scope: { allStores: false, storeIds: [2] } }, {
    async query(sql, params) { calls.push({ sql, params }); return [[{ accessory_id: 31 }]] }
  })
  assert.equal(result, true)
  assert.deepEqual(calls[0].params, [31, 31, 2, 31, 31, 2, 31, 31, 2])
  for (const sql of [calls[0].sql]) {
    assert.match(sql, /l.quantity <> st.quantity/)
    assert.match(sql, /l.minimum_quantity < 0/)
    assert.match(sql, /g.stock_in_id IS NOT NULL AND si.id IS NULL/)
    assert.match(sql, /l.serial_quantity <> COALESCE\(sn.quantity, 0\)/)
    assert.match(sql, /st.accessory_id IS NULL/)
    assert.doesNotMatch(sql, /FOR UPDATE|INSERT|UPDATE |DELETE/)
  }
})

const response = () => ({ status(code) { this.code = code; return this }, json(body) { this.body = body; return this } })
test('批次HTTP复用严格公共字段权限，采购/SN/品牌/时间/人员脱敏且不返回原采购内部ID', async () => {
  let permissionOptions
  const controller = new AccessoryController({ service: { async getInventoryBatches() { return { data: [row()] } } },
    masking: { async getUserFieldPermissions(_user, _module, options) { permissionOptions = options; return { hiddenFields: ['price_info.purchase_cost', 'basic_info.supplier_name', 'basic_info.batch_no', 'basic_info.serial_tracking', 'basic_info.usage_type', 'basic_info.brand_name', 'basic_info.specifications', 'time_info.inventory_time', 'operator_info.operator_name'] } }, filterSensitiveFields: rows => rows } })
  const res = response()
  await controller.listInventoryBatches({ user: actor, params: { id: '31' }, query: {} }, res)
  assert.deepEqual(permissionOptions, { strict: true })
  const item = res.body.data.data[0]
  for (const field of ['purchase_cost', 'supplier_name', 'batch_no', 'serial_tracking', 'usage_type', 'brand_name', 'product_model', 'inventory_time', 'inventory_operator_name']) assert.equal(item[field], null, field)
  assert.equal(Object.hasOwn(item, 'stock_in_id'), false)
  assert.equal(item.quantity, 4)
})

test('隐藏门店/数量或权限查询故障时，批次HTTP在读取业务数据前拒绝', async () => {
  for (const field of ['stock_info.distribution', 'stock_info.total_quantity', 'failure']) {
    const controller = new AccessoryController({ service: { async getInventoryBatches() { assert.fail('不应读取业务数据') } },
      masking: { async getUserFieldPermissions() { if (field === 'failure') throw Object.assign(new Error('权限不可用'), { statusCode: 503 }); return { hiddenFields: [field] } } } })
    const res = response()
    await controller.listInventoryBatches({ user: actor, params: { id: '31' }, query: {} }, res)
    assert.equal(res.code, field === 'failure' ? 503 : 403)
    assert.equal(res.body.success, false)
  }
})
