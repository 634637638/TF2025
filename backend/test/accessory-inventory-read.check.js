'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const { DatabaseSync } = require('node:sqlite')
const Repository = require('../src/repositories/accessory.repository')
const Service = require('../src/services/accessory.service')
const Controller = require('../src/controllers/accessory.controller')

const actor = { id: 7, store_ids: [1] }
const scope = { allStores: false, storeIds: [1] }
const fixture = t => {
  const db = new DatabaseSync(':memory:')
  t.after(() => db.close())
  db.function('IF', (condition, left, right) => condition ? left : right)
  db.function('LEAST', (left, right) => left === null || right === null ? null : Math.min(left, right))
  db.function('CONCAT', { varargs: true }, (...values) => values.some(value => value === null) ? null : values.join(''))
  db.function('CONCAT_WS', { varargs: true }, (separator, ...values) => values.filter(value => value !== null).join(separator))
  db.exec(`CREATE TABLE accessories (id INTEGER PRIMARY KEY, template_id INTEGER, brand_id INTEGER,
    name TEXT, barcode TEXT, category TEXT, category_id INTEGER, status INTEGER, sale_price NUMERIC, min_stock INTEGER);
    CREATE TABLE accessory_categories (id INTEGER PRIMARY KEY, name TEXT);
    CREATE TABLE brands (id INTEGER PRIMARY KEY, name TEXT);
    CREATE TABLE stores (id INTEGER PRIMARY KEY, name TEXT);
    CREATE TABLE accessory_stock (id INTEGER PRIMARY KEY, accessory_id INTEGER, store_id INTEGER,
    quantity INTEGER, total_in INTEGER, total_out INTEGER, min_stock INTEGER, max_stock INTEGER, created_at TEXT, updated_at TEXT);
    INSERT INTO accessory_categories VALUES (1, '充电头');
    INSERT INTO brands VALUES (10, '品牌甲'), (11, '品牌乙'), (12, '品牌丙');
    INSERT INTO stores VALUES (1, '一店'), (2, '二店'), (3, '三店');
    INSERT INTO accessories VALUES
      (1,NULL,NULL,'共享模板','T1','旧类型',1,1,20,3),
      (2,1,10,'过期副本甲','V2','过期类型',1,1,999,99),
      (3,1,11,'过期副本乙','V3','过期类型',1,1,999,99),
      (4,NULL,NULL,'无库存模板','T4','旧类型',1,1,500,3),
      (5,NULL,NULL,'停用模板','T5','旧类型',1,0,20,3),
      (6,5,10,'停用模板的品牌商品','V6','旧类型',1,1,20,3),
      (7,NULL,NULL,'旧文本商品','T7','旧文本',NULL,1,5,1),
      (8,1,12,'仅其他店商品','V8','旧类型',1,1,999,99);
    INSERT INTO accessory_stock VALUES
      (1,2,1,2,4,2,99,NULL,NULL,NULL), (2,2,2,30,30,0,99,NULL,NULL,NULL),
      (3,3,1,1,2,1,99,NULL,NULL,NULL), (4,3,3,80,80,0,99,NULL,NULL,NULL),
      (5,6,1,100,100,0,99,NULL,NULL,NULL), (6,7,1,0,1,1,1,NULL,NULL,NULL),
      (7,8,3,9,9,0,99,NULL,NULL,NULL);
    ALTER TABLE accessories ADD COLUMN model_id INTEGER;
    CREATE TABLE models (id INTEGER PRIMARY KEY, brand_id INTEGER, name TEXT);
    CREATE TABLE colors (id INTEGER PRIMARY KEY, name TEXT);
    CREATE TABLE suppliers (id INTEGER PRIMARY KEY, name TEXT);
    CREATE TABLE accessory_units (id INTEGER PRIMARY KEY, name TEXT);
    CREATE TABLE accessory_compatible_models (accessory_id INTEGER, model_id INTEGER);`)
  for (const column of ['color_id INTEGER', 'unit_id INTEGER', 'unit TEXT', 'description TEXT', 'image_url TEXT',
    'serial_tracking INTEGER', 'product_model TEXT', 'supplier_id INTEGER', 'purchase_cost NUMERIC', 'remarks TEXT', 'created_at TEXT', 'updated_at TEXT']) {
    db.exec(`ALTER TABLE accessories ADD COLUMN ${column}`)
  }
  const calls = []
  // 仅适配MySQL字符排序及GROUP_CONCAT分隔符语法；JOIN、筛选、聚合和分页执行真实SQL。
  const rows = (sql, params = []) => db.prepare(sql
    .replace(/CONVERT\(([\s\S]*?) USING utf8mb4\) COLLATE utf8mb4_unicode_ci/g, '$1 COLLATE NOCASE')
    .replace(/ SEPARATOR ', '/g, '')).all(...params).map(row => ({ ...row }))
  const connection = {
    async execute(sql) { calls.push(['configure', sql]) },
    async beginTransaction() { calls.push(['begin']); db.exec('BEGIN') },
    async rollback() { calls.push(['rollback']); db.exec('ROLLBACK') },
    destroy() { calls.push(['destroy']) },
    async query(sql, params) { calls.push(['query', sql, params]); return [rows(sql, params)] }
  }
  const repository = new Repository()
  repository.executeQuery = async (sql, params) => { calls.push(['pool-query', sql, params]); return rows(sql, params) }
  repository.withConnection = async operation => { calls.push(['acquire']); try { return await operation(connection) } finally { calls.push(['release']) } }
  const service = new Service({ repository })
  return { db, repository, service, calls, connection, rows }
}

test('类型库存按授权店真实数量及当前模板零售价统计，多品牌不重复模板，停用及空模板不混入', async t => {
  const { repository, db } = fixture(t)
  const result = await repository.getCategoryStats(scope)
  assert.deepEqual(result, [{ category: '充电头', count: 3, total_value: 60 }, { category: '旧文本', count: 0, total_value: 0 }])
  assert.deepEqual(await repository.getCategoryStats({ allStores: false, storeIds: [] }), [])
  const all = await repository.getCategoryStats({ allStores: true, storeIds: [] })
  assert.deepEqual(all[0], { category: '充电头', count: 122, total_value: 2440 })
  db.exec('UPDATE accessories SET sale_price=25 WHERE id=1')
  assert.deepEqual((await repository.getCategoryStats(scope))[0], { category: '充电头', count: 3, total_value: 75 })
  db.exec('UPDATE accessory_stock SET quantity=0 WHERE id=1; UPDATE accessory_stock SET quantity=1 WHERE id=3')
  assert.deepEqual((await repository.getCategoryStats(scope))[0], { category: '充电头', count: 1, total_value: 25 })
})

test('低库存只累计授权店，继承模板名称/阈值和类型主档，支持显式0且无门店为空', async t => {
  const { repository } = fixture(t)
  const result = await repository.getLowStockAccessories(null, scope)
  assert.deepEqual(result.map(row => [row.id, row.total_quantity, row.min_stock_threshold, row.name, row.category]), [
    [7, 0, 1, '旧文本商品', '旧文本'], [3, 1, 3, '共享模板', '充电头'], [2, 2, 3, '共享模板', '充电头']
  ])
  assert.deepEqual((await repository.getLowStockAccessories(0, scope)).map(row => row.id), [7])
  assert.deepEqual(await repository.getLowStockAccessories(null, { storeIds: [] }), [])
  assert.deepEqual((await repository.getLowStockAccessories(null, { allStores: true })).map(row => row.id), [7])
})

test('统计兼容MySQL整数SUM文本并保持资金原精度，损坏数量不静默四舍五入', async () => {
  let count = '3'
  const service = new Service({ repository: { async getCategoryStats() { return [{ category: '膜', count, total_value: '60.00' }] } } })
  assert.deepEqual((await service.getCategoryStats({}, actor)).data, [{ category: '膜', count: 3, total_value: '60.00' }])
  for (const value of [null, '', '3.5', -1, true, '9007199254740992']) {
    count = value
    assert.equal((await service.getCategoryStats({}, actor)).statusCode, 409)
  }
})

test('库存列表COUNT与分页同连接同范围，门店查询不能带入其他店数量，0库存可核对', async t => {
  const { service, calls } = fixture(t)
  const result = await service.getStockList({ page: '2', page_size: '2', low_stock_only: 'true' }, actor)
  assert.equal(result.success, true)
  // 此入口也保留停用商品的真实库存，便于核对；模板阈值仍控制筛选。
  assert.equal(result.data.pagination.total, 3)
  assert.deepEqual(result.data.data.map(row => [row.store_id, row.accessory_id, row.quantity, row.category]), [[1, 7, 0, '旧文本']])
  assert.deepEqual(calls.filter(call => call[0] !== 'query').map(call => call[0]), ['acquire', 'configure', 'begin', 'rollback', 'release'])
  assert.equal(calls.filter(call => call[0] === 'query').length, 2)
  assert.equal(calls.some(call => call[0] === 'pool-query'), false)
  const noStores = await service.getStockList({}, { id: 8 })
  assert.deepEqual(noStores.data.data, [])
  assert.equal(noStores.data.pagination.total, 0)
})

test('详情库存SQL按门店范围返回并数字求和，不把其他店库存或字符串拼接计入总数', async t => {
  const { repository, connection } = fixture(t)
  assert.deepEqual((await repository.getAccessoryStock(2, connection, scope)).stores.map(row => [row.store_id, row.quantity]), [[1, 2]])
  assert.equal((await repository.getAccessoryStock(2, connection, { allStores: true })).total_stock, 32)
  assert.equal((await repository.getAccessoryStock(2, connection, { storeIds: [] })).total_stock, 0)
  repository.queryRows = async () => [{ quantity: '2' }, { quantity: '3' }]
  assert.equal((await repository.getAccessoryStock(2, connection, scope)).total_stock, 5)
})

test('主列表在COUNT与行查询限制真实库存商品和汇总JOIN，模板仍共享且参数顺序匹配', async t => {
  const { repository, rows } = fixture(t), calls = [], connection = {}
  repository.queryRows = async (sql, params, executor) => {
    assert.equal(executor, connection); calls.push({ sql, params })
    assert.equal((sql.match(/\?/g) || []).length, params.length)
    return sql.includes('COUNT(DISTINCT a.id)') ? rows(sql, params) : []
  }
  const inventory = await repository.getAccessories({ mode: 'inventory', store_scope: scope, page_size: 10 }, connection)
  assert.equal(inventory.pagination.total, 3)
  assert.match(calls[0].sql, /current_stock\.store_id IN \(\?\)/)
  assert.match(calls[1].sql, /LEFT JOIN accessory_stock ast ON a.id = ast.accessory_id AND ast.store_id IN \(\?\)/)
  assert.deepEqual(calls[0].params, [1, 1])
  assert.deepEqual(calls[1].params, [1, 1, 1, 10, 0])
  calls.length = 0
  const templates = await repository.getAccessories({ mode: 'templates', store_scope: { storeIds: [] } }, connection)
  assert.equal(templates.pagination.total, 3)
  assert.match(calls[0].sql, /WHERE a.template_id IS NULL/)
  assert.match(calls[1].sql, /LEFT JOIN accessory_stock ast ON a.id = ast.accessory_id AND 1 = 0/)
  calls.length = 0
  const shared = await repository.getAccessories({ store_scope: scope }, connection)
  assert.equal(shared.pagination.total, 5)
  assert.match(calls[0].sql, /a.template_id IS NULL OR EXISTS/)
  assert.match(calls[0].sql, /current_stock.store_id IN/)
})

test('主列表实际SQL区分模板与品牌库存，跨店/零库存/翻页和模板调价不串量', async t => {
  const { service, db } = fixture(t)
  const input = { mode: 'inventory', page_size: '2' }
  const first = (await service.getAccessories(input, actor)).data
  assert.equal(first.pagination.total, 3)
  assert.equal(first.pagination.has_next, true)
  assert.deepEqual(first.data.map(row => [row.id, row.name, row.brand_name, row.total_stock, row.sale_price]), [
    [7, '旧文本商品', null, 0, 5], [3, '共享模板', '品牌乙', 1, 20]
  ])
  const last = (await service.getAccessories({ ...input, page: '2' }, actor)).data
  assert.deepEqual(last.data.map(row => [row.id, row.total_stock, row.total_in, row.total_out]), [[2, 2, 4, 2]])
  assert.equal(last.pagination.has_next, false)
  const multiStoreActor = { ...actor, store_ids: [1, 2, 3] }
  const all = (await service.getAccessories({ mode: 'inventory' }, multiStoreActor)).data
  assert.deepEqual(all.data.map(row => [row.id, row.total_stock]), [[8, 9], [7, 0], [3, 81], [2, 32]])
  assert.deepEqual((await service.getAccessories({ mode: 'inventory', store_id: '2' }, multiStoreActor)).data.data.map(row => [row.id, row.total_stock]), [[2, 30]])
  assert.equal((await service.getAccessories({ mode: 'inventory' }, { id: 9 })).data.pagination.total, 0)
  const templates = (await service.getAccessories({ mode: 'templates' }, { id: 9 })).data
  assert.deepEqual(templates.data.map(row => [row.id, row.total_stock]), [[7, 0], [4, 0], [1, 0]])
  db.exec("UPDATE accessories SET sale_price=25, name='更新模板名称' WHERE id=1")
  const brands = (await service.getAccessories({ mode: 'inventory', search: '更新模板' }, actor)).data
  assert.equal(brands.pagination.total, 2)
  assert.deepEqual(brands.data.map(row => [row.id, row.name, row.brand_name, row.sale_price, row.total_stock]), [
    [3, '更新模板名称', '品牌乙', 25, 1], [2, '更新模板名称', '品牌甲', 25, 2]
  ])
})

test('实际商品列表与嵌套响应隐藏任一进价/售价时同步隐藏利润，不修改原业务记录', async () => {
  for (const field of ['price_info.purchase_cost', 'price_info.sale_price', 'price_info.profit']) {
    const original = { id: 2, purchase_cost: 8, sale_price: 20, profit: 12 }
    const controller = new Controller({ service: {
      async getAccessories() { return { success: true, data: { data: [original] } } },
      async getAccessoryDetail() { return { success: true, data: { ...original, nested: { ...original } } } }
    }, masking: { async getUserFieldPermissions() { return { hiddenFields: [field] } }, filterSensitiveFields: rows => rows } })
    const res = response()
    await controller.list({ user: actor, query: {} }, res)
    assert.equal(res.body.data.data[0].profit, null)
    assert.equal(res.body.data.data[0].purchase_cost, field === 'price_info.purchase_cost' ? null : 8)
    assert.equal(res.body.data.data[0].sale_price, field === 'price_info.sale_price' ? null : 20)
    const detail = response()
    await controller.getById({ user: actor, params: { id: 2 } }, detail)
    assert.equal(detail.body.data.profit, null)
    assert.equal(detail.body.data.nested.profit, null)
    assert.deepEqual(original, { id: 2, purchase_cost: 8, sale_price: 20, profit: 12 })
  }
})

test('划拨后列表剩余取当前门店实物数量，不用未变的采购/销售累计数倒算，隐藏当前库存同时遮蔽剩余', async t => {
  const { service, db } = fixture(t)
  db.exec('UPDATE accessory_stock SET quantity=0 WHERE id=1; UPDATE accessory_stock SET quantity=32 WHERE id=2')
  const controller = new Controller({ service, masking: {
    async getUserFieldPermissions() { return { hiddenFields: [] } }, filterSensitiveFields: rows => rows
  } })
  const req = { user: actor, query: { mode: 'inventory' } }, res = response()
  await controller.list(req, res)
  const moved = res.body.data.data.find(row => row.id === 2)
  assert.equal(moved.total_stock, 0)
  assert.equal(moved.remaining_stock, 0)
  assert.equal(moved.total_in, 4)
  assert.equal(moved.total_out, 2)
  const other = response()
  await controller.list({ user: { ...actor, store_ids: [1, 2] }, query: { ...req.query, store_id: '2' } }, other)
  const received = other.body.data.data.find(row => row.id === 2)
  assert.equal(received.remaining_stock, 32)
  controller.masking.getUserFieldPermissions = async () => ({ hiddenFields: ['stock_info.total_stock'] })
  const hidden = response()
  await controller.list(req, hidden)
  assert.equal(hidden.body.data.data.find(row => row.id === 2).total_stock, null)
  assert.equal(hidden.body.data.data.find(row => row.id === 2).remaining_stock, null)
})

test('所有公开读取携带认证身份及门店范围，非法/越店/无身份输入在仓储和连接前拒绝', async () => {
  const service = new Service({ repository: new Proxy({}, { get: () => () => { assert.fail('无效输入不应访问仓储') } }) })
  const queryActions = ['getAccessories', 'getStockList', 'getCategoryStats', 'getLowStockWarnings']
  for (const action of queryActions) {
    assert.equal((await service[action]({}, null)).statusCode, 401)
    assert.equal((await service[action]({ store_id: 2 }, actor)).statusCode, 403)
    for (const store_id of ['', false, [1], {}, '1junk', 0]) assert.equal((await service[action]({ store_id }, actor)).statusCode, 400)
    for (const query of [null, [], 'invalid']) assert.equal((await service[action](query, actor)).statusCode, 400)
  }
  for (const action of ['getAccessories', 'getStockList']) for (const query of [{ page: true }, { page: ['1'] }, { page: 1000001 }, { page_size: 101 }, { page_size: '2bad' }]) {
    assert.equal((await service[action](query, actor)).statusCode, 400)
  }
  for (const threshold of ['', false, [], {}, -1, 0.5, 10000, '1 OR 1=1']) assert.equal((await service.getLowStockWarnings({ threshold }, actor)).statusCode, 400)
  for (const query of [{ brand_id: [1] }, { supplier_id: true }, { model_id: '1bad' }, { mode: [] }, { status: ['1'] }, { search: {} }, { category: ['膜'] }]) {
    assert.equal((await service.getAccessories(query, actor)).statusCode, 400)
  }
  assert.equal((await service.getStockList({ low_stock_only: 'no' }, actor)).statusCode, 400)
  assert.equal((await service.getAccessoryDetail([1], actor)).statusCode, 400)
  assert.equal((await service.getAccessoryDetail(1, null)).statusCode, 401)
  assert.equal((await service.getAccessoryByBarcode({}, actor)).statusCode, 400)
  assert.equal((await service.getAccessoryByBarcode('T1', null)).statusCode, 401)
})

test('详情、条码及分页读取共用只读快照，异常配置/启动/回滚连接销毁且始终释放', async () => {
  for (const fault of ['', 'configure', 'begin', 'read', 'rollback']) {
    const calls = [], connection = {
      async execute(sql) { calls.push('configure'); assert.equal(sql, 'SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY'); if (fault === 'configure') throw Error(fault) },
      async beginTransaction() { calls.push('begin'); if (fault === 'begin') throw Error(fault) },
      async rollback() { calls.push('rollback'); if (fault === 'rollback') throw Error(fault) },
      destroy() { calls.push('destroy') }
    }
    const repository = {
      async withConnection(operation) { try { return await operation(connection) } finally { calls.push('release') } },
      async getAccessoryById(_id, executor) { assert.equal(executor, connection); if (fault === 'read') throw Object.assign(Error('业务失败'), { statusCode: 409 }); return { id: 2 } },
      async getAccessoryByBarcode(_barcode, executor) { return this.getAccessoryById(2, executor) },
      async getAccessoryStock(_id, executor, actualScope) { assert.equal(executor, connection); assert.deepEqual(actualScope.storeIds, [1]); return { total_stock: 2, stores: [] } }
    }
    const service = new Service({ repository })
    const result = await service.getAccessoryDetail(2, actor)
    assert.equal(result.success, !fault)
    assert.equal(calls.at(-1), 'release')
    assert.equal(calls.includes('destroy'), ['configure', 'begin', 'rollback'].includes(fault))
    assert.equal(calls.includes('rollback'), !['configure', 'begin'].includes(fault))
    if (!fault) {
      assert.equal((await service.getAccessoryByBarcode('T1', actor)).data.stock.total_stock, 2)
      repository.getAccessories = async (input, executor) => { assert.equal(executor, connection); assert.deepEqual(input.store_scope.storeIds, [1]); return { data: [] } }
      assert.equal((await service.getAccessories({}, actor)).success, true)
    }
  }
})

const response = () => ({ status(code) { this.statusCode = code; return this }, json(body) { this.body = body; return this } })
const controllerFixture = (hidden = []) => {
  const calls = [], stats = [{ category: '充电头', count: 3, total_value: 60 }]
  const controller = new Controller({ masking: { async getUserFieldPermissions() { return { hiddenFields: hidden } }, filterSensitiveFields: rows => rows },
    service: {
      async getCategoryStats(query, user) { calls.push([query, user]); return { success: true, data: stats } },
      async getLowStockWarnings(query, user) { calls.push([query, user]); return { success: true, data: {} } },
      async getStockList(query, user) { calls.push([query, user]); return { success: true, data: {} } }
    } })
  return { controller, calls, stats }
}

test('类型分组权限在读取前拒绝，隐藏数量同时遮蔽数量和派生价值，隐藏零售价仅遮蔽价值', async () => {
  for (const field of ['basic_info.category', 'stock_info.total_stock', 'stock_info.total_quantity', 'price_info.sale_price']) {
    const { controller, calls, stats } = controllerFixture([field]), res = response()
    await controller.getCategoryStats({ user: actor, query: { store_id: '1' } }, res)
    if (field === 'basic_info.category') { assert.equal(res.statusCode, 403); assert.deepEqual(calls, []) }
    else {
      assert.equal(res.body.data[0].total_value, null)
      assert.equal(res.body.data[0].count, field === 'price_info.sale_price' ? 3 : null)
      assert.deepEqual(calls[0], [{ store_id: '1' }, actor])
      assert.equal(stats[0].count, 3)
    }
  }
})

test('六个HTTP读取入口传递认证用户和原始筛选，不接受客户端自称的门店范围', async () => {
  const calls = [], service = {}
  const pairs = [['list', 'getAccessories', { data: [] }], ['getById', 'getAccessoryDetail', {}],
    ['getByBarcode', 'getAccessoryByBarcode', {}], ['listStock', 'getStockList', {}],
    ['listStockWarnings', 'getLowStockWarnings', {}], ['getCategoryStats', 'getCategoryStats', []]]
  for (const [, method, data] of pairs) service[method] = async (...args) => { calls.push([method, args]); return { success: true, data } }
  const controller = new Controller({ service, masking: { async getUserFieldPermissions() { return { hiddenFields: [] } }, filterSensitiveFields: rows => rows } })
  for (const [action] of pairs) {
    const res = response()
    await controller[action]({ user: actor, params: { id: '2', barcode: 'T1' }, query: {
      mode: 'inventory', store_id: '1', threshold: '0', low_stock_only: 'false', store_scope: { allStores: true }
    } }, res)
    assert.equal(res.body.success, true)
    assert.equal(calls.at(-1)[1][1], actor)
  }
  assert.equal(calls[0][1][0].store_id, '1')
  assert.equal(calls[0][1][0].store_scope, undefined)
  assert.equal(calls[1][1][0], '2'); assert.equal(calls[2][1][0], 'T1')
  assert.equal(calls[3][1][0].low_stock_only, 'false')
  assert.deepEqual(calls[4][1][0], { store_id: '1', threshold: '0' })
})

test('隐藏预警必要字段不可通过结果成员或固定阈值反推，权限读取失败不查询统计', async () => {
  for (const field of ['stock_info.min_stock', 'stock_info.total_quantity', 'stock_info.stock_status']) {
    const { controller, calls } = controllerFixture([field])
    for (const action of ['listStockWarnings', 'listStock']) {
      const res = response()
      await controller[action]({ user: actor, query: { low_stock_only: 'true' } }, res)
      assert.equal(res.statusCode, 403); assert.deepEqual(calls, [])
    }
  }
  const { controller, calls } = controllerFixture()
  controller.masking.getUserFieldPermissions = async () => { throw Error('权限读取失败') }
  for (const action of ['getCategoryStats', 'listStockWarnings', 'listStock']) {
    const res = response(); await controller[action]({ user: actor, query: {} }, res)
    assert.equal(res.statusCode, 500); assert.deepEqual(calls, [])
  }
})
