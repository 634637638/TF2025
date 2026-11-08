'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const StockInController = require('../src/controllers/stock-in.controller')

const createResponse = () => ({
  status(code) { this.statusCode = code; return this },
  json(body) { this.body = body; return this }
})

test('入库统计路由保留认证和查看权限并委托 controller', () => {
  const route = fs.readFileSync(path.join(__dirname, '../src/routes/stock-in.js'), 'utf8')
  assert.match(route, /router\.get\('\/stats\/overview', unifiedAuth, requirePermission\('stock-in:view'\), stockInController\.overview\.bind\(stockInController\)\)/)
})

test('入库统计按授权门店和日期绑定查询，格式化统计并释放连接', async () => {
  const calls = []
  const events = []
  const connection = {
    async execute(sql, params) {
      calls.push({ sql, params })
      if (sql.includes('total_items')) return [[{
        total_items: '4', total_value: '250.5', today_stock_in: '1', new_items: '2',
        used_items: '2', in_stock_items: '3', sold_items: '1', settled_count: '2',
        unsettled_count: '1', unknown_payment_count: '1'
      }]]
      if (sql.includes('store_name')) return [[{ store_name: '北区', count: '3' }, { store_name: null, count: '1' }]]
      return [[{ brand_name: '品牌A', count: '4' }]]
    },
    release() { events.push('release') }
  }
  const controller = new StockInController({
    database: () => ({ async getConnection() { return connection } }),
    logger: { error() {} }
  })
  const response = createResponse()
  await controller.overview({
    user: { store_ids: [5, 8] },
    query: { store_id: '5', start_date: '2026-11-01', end_date: '2026-11-07' }
  }, response)

  assert.equal(calls.length, 3)
  for (const call of calls) {
    assert.match(call.sql, /p\.store_id IN \(\?\)/)
    assert.match(call.sql, /p\.inventory_time >= \?/)
    assert.match(call.sql, /p\.inventory_time <= \?/)
    assert.deepEqual(call.params, [5, '2026-11-01', '2026-11-07'])
  }
  assert.deepEqual(response.body.data, {
    today_stock_in: 1, total_items: 4, total_value: 250.5, new_items: 2,
    used_items: 2, in_stock_items: 3, sold_items: 1, settled_count: 2,
    unsettled_count: 1, unknown_payment_count: 1, by_store: { 北区: 3 }, by_brand: { 品牌A: 4 }
  })
  assert.deepEqual(events, ['release'])
})

test('入库统计越权门店返回权限错误并释放已取连接', async () => {
  const events = []
  const controller = new StockInController({
    database: () => ({ async getConnection() { return { release() { events.push('release') } } } }),
    logger: { error() {} }
  })
  const response = createResponse()
  await controller.overview({ user: { store_ids: [5] }, query: { store_id: '8' } }, response)
  assert.equal(response.statusCode, 403)
  assert.equal(response.body.message, '无权访问该门店数据')
  assert.deepEqual(events, ['release'])
})

test('入库列表保留分页、筛选、门店范围和规范记录格式', async () => {
  const calls = []
  const events = []
  const record = {
    id: 9, imei: '123456789012345', serial_number: null, purchase_cost: '125.50',
    store_id: 5, store_name: '北区', supplier_id: 3, supplier_name: '供货商',
    inventory_operator_id: 7, operator_name: '操作员', operator_username: 'operator',
    status: 'in_stock', is_new: 1, inventory_time: '2026-11-06', purchase_number: 'RK-1',
    remarks: '', sale_time: null, payment_status: 'paid', payment_time: null,
    brand_name: '品牌A', model_name: '型号B', color_name: '黑色', memory_name: '128G'
  }
  const controller = new StockInController({
    database: () => ({ async getConnection() { return {
      async execute(sql, params) { calls.push({ method: 'execute', sql, params }); return [[{ total: '21' }]] },
      async query(sql, params) { calls.push({ method: 'query', sql, params }); return [[record]] },
      release() { events.push('release') }
    } } }),
    logger: { error() {} }
  })
  const response = createResponse()
  await controller.list({
    user: { store_ids: [5] },
    query: {
      page: '2', page_size: '10', search: '品牌A', product_type: 'new',
      brand_id: '4', store_id: '5', supplier_id: '3',
      start_date: '2026-11-01', end_date: '2026-11-07'
    }
  }, response)

  const expectedParams = [5, 4, 3, ...Array(12).fill('%品牌A%'), '2026-11-01', '2026-11-07']
  assert.deepEqual(calls.map(call => call.method), ['execute', 'query'])
  assert.deepEqual(calls[0].params, expectedParams)
  assert.deepEqual(calls[1].params, [...expectedParams, 10, 10])
  assert.match(calls[1].sql, /ORDER BY p\.inventory_time DESC, p\.id DESC\s+LIMIT \? OFFSET \?$/)
  assert.deepEqual(response.body.data.pagination, {
    page: 2, page_size: 10, total: 21, total_pages: 3, has_next: true, has_prev: true
  })
  assert.deepEqual(response.body.data.records[0], {
    ...record, phone_id: 9, purchase_cost: 125.5, condition: 'new', product_type: 'phone',
    product_name: '品牌A 型号B', quantity: 1, operation_type: 'in', reason: '采购入库',
    is_settled: 1, reference_type: 'purchase', reference_id: 'RK-1'
  })
  assert.deepEqual(events, ['release'])
})

test('入库详情使用门店范围并保留缺失记录响应和连接清理', async () => {
  const events = []
  let receivedParams
  const controller = new StockInController({
    database: () => ({ async getConnection() { return {
      async execute(sql, params) { receivedParams = params; return [[]] },
      release() { events.push('release') }
    } } }),
    logger: { error() {} }
  })
  const response = createResponse()
  await controller.detail({ params: { id: '12' }, query: { store_id: '5' }, user: { store_ids: [5] } }, response)
  assert.deepEqual(receivedParams, ['12', 5])
  assert.equal(response.statusCode, 404)
  assert.equal(response.body.message, '入库记录不存在')
  assert.deepEqual(events, ['release'])
})

const validProduct = () => ({
  brand_id: 1,
  model_id: 2,
  color_id: 3,
  memory_id: 4,
  imei: '123456789012345',
  serial_number: '',
  purchase_cost: 120,
  sale_price: null
})

const createRequest = (overrides = {}) => ({
  user: { id: 7, store_ids: [5] },
  body: {
    supplier_id: 3,
    store_id: 5,
    inventory_time: '2026-11-07 10:00:00',
    operator_name: '操作员',
    condition: '全新',
    products: [validProduct()],
    ...overrides
  }
})

const createConnection = ({ events, duplicatePhone = false } = {}) => ({
  async execute(sql) {
    if (sql.includes('SELECT name, username FROM users')) return [[{ name: '操作员', username: 'operator' }]]
    if (sql.includes('INSERT INTO phones')) return [{ insertId: 41 }]
    if (sql.includes('SELECT id, imei, status FROM phones')) {
      return [duplicatePhone ? [{ id: 10, imei: '123456789012345', status: 'in_stock' }] : []]
    }
    if (sql.includes('FROM preorders')) return [[]]
    return [[]]
  },
  async query(sql) {
    if (sql.includes('FROM brands')) return [[{ id: 1, value: '品牌' }]]
    if (sql.includes('FROM models')) return [[{ id: 2, value: '型号' }]]
    if (sql.includes('FROM colors')) return [[{ id: 3, value: '黑色' }]]
    if (sql.includes('FROM memories')) return [[{ id: 4, value: '128G' }]]
    return [[]]
  },
  async beginTransaction() { events.push('begin') },
  async commit() { events.push('commit') },
  async rollback() { events.push('rollback') },
  release() { events.push('release') }
})

test('入库创建由 controller 委托 service 事务并返回规范结果', async () => {
  const events = []
  const connection = createConnection({ events })
  const controller = new StockInController({
    database: () => ({ async getConnection() { return connection } }),
    logger: { error() {} },
    validateImei: imei => ({ valid: true, normalizedImei: imei, normalizedSerialNumber: '' }),
    async prepareInvoiceNumbers() { events.push('prepare') },
    async generatePurchaseNumber() { return 'RK-20261107-001' }
  })
  const response = createResponse()

  await controller.create(createRequest(), response)

  assert.equal(response.statusCode, 200)
  assert.equal(response.body.data.purchase_number, 'RK-20261107-001')
  assert.equal(response.body.data.total_count, 1)
  assert.equal(response.body.data.total_amount, 120)
  assert.equal(response.body.data.products[0].id, 41)
  assert.deepEqual(events, ['prepare', 'begin', 'commit', 'release'])
})

test('入库创建遇到无效 IMEI 或越权门店时不启动写事务', async () => {
  const events = []
  const connection = createConnection({ events })
  const controller = new StockInController({
    database: () => ({ async getConnection() { return connection } }),
    logger: { error() {} },
    validateImei: () => ({ valid: false })
  })
  const invalidImeiResponse = createResponse()
  await controller.create(createRequest(), invalidImeiResponse)
  assert.equal(invalidImeiResponse.statusCode, 400)
  assert.deepEqual(events, ['release'])

  const scopeEvents = []
  const scopeController = new StockInController({
    database: () => ({ async getConnection() { return createConnection({ events: scopeEvents }) } }),
    logger: { error() {} }
  })
  const scopeResponse = createResponse()
  await scopeController.create(createRequest({ store_id: 8 }), scopeResponse)
  assert.equal(scopeResponse.statusCode, 403)
  assert.deepEqual(scopeEvents, ['release'])
})

test('入库创建生成采购单号失败时回滚一次并释放连接', async () => {
  const events = []
  const connection = createConnection({ events })
  const controller = new StockInController({
    database: () => ({ async getConnection() { return connection } }),
    logger: { error() {} },
    validateImei: imei => ({ valid: true, normalizedImei: imei, normalizedSerialNumber: '' }),
    async prepareInvoiceNumbers() { events.push('prepare') },
    async generatePurchaseNumber() { throw new Error('编号生成失败') }
  })
  const response = createResponse()

  await controller.create(createRequest(), response)

  assert.equal(response.statusCode, 500)
  assert.deepEqual(events, ['prepare', 'begin', 'rollback', 'release'])
})

test('入库更新锁定授权门店记录、规范状态字段并提交事务', async () => {
  const events = []
  const calls = []
  const connection = {
    async beginTransaction() { events.push('begin') },
    async execute(sql, params) {
      calls.push({ sql, params })
      if (sql.includes('SELECT id, store_id')) return [[{ id: 41, store_id: 5 }]]
      if (sql.includes('SELECT\n')) return [[{ id: 41, is_new: 0, inventory_time: '2026-11-07' }]]
      return [{ affectedRows: 1 }]
    },
    async commit() { events.push('commit') },
    async rollback() { events.push('rollback') },
    release() { events.push('release') }
  }
  const controller = new StockInController({
    database: () => ({ async getConnection() { return connection } }),
    logger: { error() {} }
  })
  const response = createResponse()

  await controller.update({
    params: { id: '41' },
    user: { store_ids: [5] },
    body: { inventory_time: '2026-11-06', is_new: '二手', remarks: '已核验' }
  }, response)

  assert.equal(response.statusCode, 200)
  assert.equal(response.body.data.is_new, 0)
  assert.match(calls[0].sql, /FOR UPDATE/)
  assert.deepEqual(calls[1].params, ['2026-11-06', 0, '已核验', '41', 5])
  assert.match(calls[1].sql, /WHERE id = \? AND store_id IN \(\?\)/)
  assert.deepEqual(events, ['begin', 'commit', 'release'])
})

test('入库删除拒绝越权门店并且不执行删除', async () => {
  const events = []
  const calls = []
  const connection = {
    async beginTransaction() { events.push('begin') },
    async execute(sql, params) {
      calls.push({ sql, params })
      return [[{ id: 41, store_id: 5 }]]
    },
    async commit() { events.push('commit') },
    async rollback() { events.push('rollback') },
    release() { events.push('release') }
  }
  const controller = new StockInController({
    database: () => ({ async getConnection() { return connection } }),
    logger: { error() {} }
  })
  const response = createResponse()

  await controller.remove({
    params: { id: '41' },
    query: { store_id: '8' },
    user: { store_ids: [5] }
  }, response)

  assert.equal(response.statusCode, 403)
  assert.equal(calls.some(call => call.sql.includes('DELETE FROM phones')), false)
  assert.deepEqual(events, [])
  assert.deepEqual(calls, [])
})

test('入库删除在授权范围内使用条件删除并提交', async () => {
  const events = []
  const calls = []
  const connection = {
    async beginTransaction() { events.push('begin') },
    async execute(sql, params) {
      calls.push({ sql, params })
      if (sql.includes('SELECT id, store_id')) return [[{ id: 41, store_id: 5 }]]
      return [{ affectedRows: 1 }]
    },
    async commit() { events.push('commit') },
    async rollback() { events.push('rollback') },
    release() { events.push('release') }
  }
  const controller = new StockInController({
    database: () => ({ async getConnection() { return connection } }),
    logger: { error() {} }
  })
  const response = createResponse()

  await controller.remove({
    params: { id: '41' },
    query: { store_id: '5' },
    user: { store_ids: [5] }
  }, response)

  assert.deepEqual(response.body.data, { id: 41, deleted: true })
  assert.match(calls[1].sql, /DELETE FROM phones WHERE id = \? AND store_id IN \(\?\)/)
  assert.deepEqual(calls[1].params, ['41', 5])
  assert.deepEqual(events, ['begin', 'commit', 'release'])
})
