'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const { DatabaseSync } = require('node:sqlite')
const Repository = require('../src/repositories/accessory.repository')
const ColorRepository = require('../src/repositories/accessory-template-color.repository')
const Service = require('../src/services/accessory.service')
const Controller = require('../src/controllers/accessory.controller')

const actor = { id: 7, store_ids: [1] }
const scope = { allStores: false, storeIds: [1] }
const fixture = t => {
  const db = new DatabaseSync(':memory:')
  t.after(() => db.close())
  db.function('JSON_LENGTH', value => value === null ? null : JSON.parse(value).length)
  db.function('JSON_TYPE', value => value === null ? null : Array.isArray(JSON.parse(value)) ? 'ARRAY' : 'OBJECT')
  db.function('IF', (condition, left, right) => condition ? left : right)
  db.function('JSON_CONTAINS', (document, candidate) => JSON.parse(document).some(row =>
    Object.entries(JSON.parse(candidate)).every(([key, value]) => row[key] === value)) ? 1 : 0)
  db.function('LEAST', (left, right) => left === null || right === null ? null : Math.min(left, right))
  db.function('CONCAT', { varargs: true }, (...values) => values.some(value => value === null) ? null : values.join(''))
  db.function('CONCAT_WS', { varargs: true }, (separator, ...values) => values.filter(value => value !== null).join(separator))
  db.function('JOIN_JSON', (values, separator) => JSON.parse(values).filter(value => value !== null).join(separator) || null)
  db.exec(`CREATE TABLE accessories (id INTEGER PRIMARY KEY, template_id INTEGER, brand_id INTEGER,
    name TEXT, barcode TEXT, category TEXT, category_id INTEGER, status INTEGER, sale_price NUMERIC, min_stock INTEGER);
    CREATE TABLE accessory_stock_in (id INTEGER PRIMARY KEY, accessory_id INTEGER, store_id INTEGER,
      purchase_cost NUMERIC, status TEXT, inventory_time TEXT, distribution TEXT);
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
    .replace(/GROUP_CONCAT\(DISTINCT model_brand\.name ORDER BY model_brand\.name SEPARATOR ' \/ '\)/g,
      "JOIN_JSON(JSON_GROUP_ARRAY(DISTINCT model_brand.name ORDER BY model_brand.name), ' / ')")
    .replace(/ SEPARATOR ', '/g, '')).all(...params).map(row => ({ ...row }))
  const connection = {
    async execute(sql) { calls.push(['configure', sql]) },
    async beginTransaction() { calls.push(['begin']); db.exec('BEGIN') },
    async rollback() { calls.push(['rollback']); db.exec('ROLLBACK') },
    destroy() { calls.push(['destroy']) },
    async query(sql, params) { calls.push(['query', sql, params]); return [rows(sql, params)] }
  }
  const repository = new Repository({ columnExists: async () => false, templateColors: new ColorRepository({ tableExists: async () => false }) })
  repository.executeQuery = async (sql, params) => { calls.push(['pool-query', sql, params]); return rows(sql, params) }
  repository.withConnection = async operation => { calls.push(['acquire']); try { return await operation(connection) } finally { calls.push(['release']) } }
  const service = new Service({ repository })
  return { db, repository, service, calls, connection, rows }
}

test('进价从0更正后列表、详情及条码读取有效新批次，按采购时间和ID排序且隔离门店与品牌', async t => {
  const { db, repository, service, connection } = fixture(t)
  db.exec(`UPDATE accessories SET purchase_cost=0 WHERE id IN (2,3);
    INSERT INTO accessory_stock_in VALUES
      (10,2,1,0,'completed','2026-11-13 10:00:00',NULL),
      (11,3,1,99,'completed','2026-11-15 10:00:00',NULL);`)
  const read = async () => {
    const list = await service.getAccessories({ mode: 'inventory' }, actor)
    const detail = await service.getAccessoryDetail(2, actor)
    const barcode = await service.getAccessoryByBarcode('V2', actor)
    assert.equal(list.success, true); assert.equal(detail.success, true); assert.equal(barcode.success, true)
    return [list.data.data.find(row => row.id === 2).purchase_cost, detail.data.purchase_cost, barcode.data.purchase_cost]
  }
  assert.deepEqual(await read(), [0,0,0])
  db.exec(`UPDATE accessory_stock_in SET status='cancelled' WHERE id=10;
    INSERT INTO accessory_stock_in VALUES
      (12,2,1,12.5,'completed','2026-11-13 10:00:00',NULL),
      (13,2,2,88,'completed','2026-11-16 10:00:00',NULL),
      (14,2,1,66,'cancelled','2026-11-16 11:00:00',NULL),
      (15,2,1,77,'completed','2026-11-12 10:00:00',NULL),
      (16,2,1,55,'completed','2026-11-16 12:00:00','[{"store_id":1},{"store_id":2}]');`)
  assert.deepEqual(await read(), [12.5,12.5,12.5])
  // 重复独立读取不会恢复旧主档0；主档和作废原单保留原值。
  assert.deepEqual(await read(), [12.5,12.5,12.5])
  assert.equal((await repository.getAccessoryById(2, connection)).purchase_cost, 0)
  assert.equal(db.prepare('SELECT purchase_cost FROM accessory_stock_in WHERE id=10').get().purchase_cost, 0)
  db.exec("INSERT INTO accessory_stock_in VALUES (17,2,1,0,'completed','2026-11-13 10:00:00',NULL);")
  assert.deepEqual(await read(), [0,0,0])
  assert.equal((await service.getAccessoryDetail(2, { id:7, store_ids:[1,2] })).data.purchase_cost, 55)
})

test('模板适配品牌按真实型号去重排序，品牌库存继承模板，多型号文本及通用语义保留', async t => {
  const { db, repository, connection } = fixture(t)
  db.exec(`INSERT INTO brands VALUES (20,'Apple'),(21,'Huawei');
    INSERT INTO models VALUES (100,20,'iPhone 17'),(101,20,'iPhone 16'),(102,21,'Mate 80');
    INSERT INTO accessory_compatible_models VALUES (1,100),(1,101),(1,102);
    UPDATE accessories SET model_id=100 WHERE id=1;`)
  const result = await repository.getAccessories({ mode: 'templates', store_scope: scope }, connection)
  const product = result.data.find(row => row.id === 1)
  assert.equal(product.compatible_brand_names, 'Apple / Huawei')
  assert.match(product.compatible_model_names, /Apple iPhone 16/)
  assert.match(product.compatible_model_names, /Huawei Mate 80/)
  assert.equal(result.data.find(row => row.id === 4).compatible_brand_names, null)
  assert.equal((await repository.getAccessoryById(2, connection)).compatible_brand_names, 'Apple / Huawei')
  assert.equal((await repository.getAccessoryByBarcode('V2', connection)).compatible_brand_names, 'Apple / Huawei')
})

test('商品名称支持片段及多关键词跨字段匹配，统一型号空格大小写规则且不混合不同商品', async t => {
  const { db, repository, connection } = fixture(t)
  db.exec(`INSERT INTO colors VALUES (1,'白色'),(2,'黑色');
    INSERT INTO models VALUES (20,10,'iPhone 17');
    INSERT INTO accessory_compatible_models VALUES (1,20);
    UPDATE accessories SET name='原装充电头', product_model='USB-C 20W', color_id=1 WHERE id=1;
    UPDATE accessories SET name='原装充电头', product_model='USB-C 35W', color_id=2 WHERE id=4;`)
  const search = keyword => repository.getAccessories({ mode: 'templates', search: keyword,
    search_fields: ['name', 'category', 'product_model', 'color_name', 'model_name'], store_scope: scope }, connection)
  for (const keyword of ['充电 20w 白色', '头　20W', 'usb-c20w', 'iPhone17', 'IPHONE-17']) {
    const result = await search(keyword)
    assert.equal(Number(result.pagination.total), 1, keyword)
    assert.deepEqual(result.data.map(row => row.id), [1], keyword)
  }
  assert.equal(Number((await search('充电头 usb-c')).pagination.total), 2)
  assert.equal(Number((await search('20w 黑色')).pagination.total), 0)
  assert.equal(Number((await search("充电头 ' OR 1=1")).pagination.total), 0)
  const hidden = await repository.getAccessories({ mode: 'templates', search: '白色', search_fields: ['name'], store_scope: scope }, connection)
  assert.equal(Number(hidden.pagination.total), 0)
})

test('商品库存和模板组合筛选类型、品牌、适配型号及颜色，模板品牌仅关联授权店商品', async t => {
  const { db, repository, connection } = fixture(t)
  db.exec(`INSERT INTO colors VALUES (1,'白色'),(2,'黑色');
    INSERT INTO models VALUES (20,10,'iPhone 17'),(21,11,'Galaxy S25');
    INSERT INTO accessory_compatible_models VALUES (1,20),(4,21);
    UPDATE accessories SET color_id=1 WHERE id=1;
    UPDATE accessories SET color_id=2 WHERE id=4;`)
  const filters = { search: '共享', search_fields: ['name'], category: '充电头', brand_id: 10, model_name: 'iphone-17', color_id: 1, store_scope: scope }
  for (const [mode, expected] of [['inventory', 2], ['templates', 1]]) {
    const result = await repository.getAccessories({ ...filters, mode }, connection)
    assert.equal(result.pagination.total, 1)
    assert.deepEqual(result.data.map(row => row.id), [expected])
    for (const mismatch of [{ color_id: 2 }, { model_name: 'Galaxy' }, { category: '数据线' }]) {
      assert.equal((await repository.getAccessories({ ...filters, ...mismatch, mode }, connection)).pagination.total, 0)
    }
  }
  assert.equal((await repository.getAccessories({ ...filters, mode: 'templates', brand_id: 12 }, connection)).pagination.total, 0)
  assert.equal((await repository.getAccessories({ ...filters, mode: 'templates', brand_id: 12, store_scope: { allStores: true } }, connection)).pagination.total, 1)
})

test('适配型号检索支持旧单型号、多型号、通用及字面通配符，保持既有型号ID筛选兼容', async t => {
  const { db, repository, connection } = fixture(t)
  db.exec(`INSERT INTO models VALUES (20,10,'iPhone 17'),(21,11,'Phone%_Pro');
    UPDATE accessories SET model_id=20 WHERE id=1;
    INSERT INTO accessory_compatible_models VALUES (4,21);`)
  for (const [filter, id] of [[{ model_name: 'IPHONE-17' }, 1], [{ model_name: '品牌甲 iPhone17' }, 1],
    [{ model_name: 'Phone%_' }, 4], [{ model_id: 20 }, 1]]) {
    const result = await repository.getAccessories({ ...filter, mode: 'templates', store_scope: scope }, connection)
    assert.deepEqual(result.data.map(row => row.id), [id])
  }
  const universal = await repository.getAccessories({ mode: 'templates', model_name: '通用', store_scope: scope }, connection)
  assert.deepEqual(universal.data.map(row => row.id), [7])
  const injection = await repository.getAccessories({ mode: 'templates', model_name: "' OR 1=1", store_scope: scope }, connection)
  assert.equal(injection.pagination.total, 0)
})

test('库存与模板均可按启用、停用或全部状态筛选，品牌子商品继承模板状态', async t => {
  const { repository, connection } = fixture(t)
  for (const [mode, active, disabled] of [['inventory', 2, 6], ['templates', 1, 5]]) {
    const query = { mode, brand_id: 10, store_scope: scope }
    assert.deepEqual((await repository.getAccessories({ ...query, status: 1 }, connection)).data.map(row => row.id), [active])
    assert.deepEqual((await repository.getAccessories({ ...query, status: 0 }, connection)).data.map(row => row.id), [disabled])
    const all = await repository.getAccessories({ ...query, status: null }, connection)
    assert.deepEqual(all.data.map(row => row.id).sort((left, right) => left - right), [active, disabled])
    assert.equal(all.pagination.total, 2)
  }
})

test('多颜色模板只显示一个入口，颜色条码命中同一模板而库存保留实际颜色身份', async t => {
  const { db, repository, connection } = fixture(t)
  db.exec(`CREATE TABLE accessory_template_colors (template_id INTEGER, accessory_id INTEGER PRIMARY KEY, color_id INTEGER);
    INSERT INTO colors VALUES (3, '白色'), (4, '黑色');
    INSERT INTO accessories (id, template_id, name, barcode, category, status, sale_price, color_id)
      VALUES (20, NULL, '多色充电器', NULL, '充电头', 1, 39, NULL),
      (21, NULL, '多色充电器', 'COLOR-W', '充电头', 1, 39, 3),
      (22, NULL, '多色充电器', 'COLOR-B', '充电头', 1, 39, 4),
      (23, 21, '旧颜色副本', NULL, '旧类型', 1, 999, 4);
    INSERT INTO accessory_template_colors VALUES (20, 21, 3), (20, 22, 4);
    INSERT INTO accessory_stock VALUES (20,23,1,5,5,0,0,NULL,NULL,NULL);`)
  repository.templateColors = new ColorRepository({ tableExists: async () => true })
  for (const search of ['多色', 'COLOR-B', '黑色']) {
    const result = await repository.getAccessories({ mode: 'templates', search, search_fields: ['name', 'barcode', 'color_name'] }, connection)
    assert.equal(result.pagination.total, 1)
    assert.equal(result.data[0].id, 20)
    assert.deepEqual(result.data[0].color_variants.map(row => [row.accessory_id, row.color_name, row.barcode]), [[21, '白色', 'COLOR-W'], [22, '黑色', 'COLOR-B']])
  }
  const inventory = await repository.getAccessories({ mode: 'inventory', search: '多色', search_fields: ['name'], store_scope: scope }, connection)
  assert.equal(inventory.data[0].id, 23); assert.equal(inventory.data[0].color_name, '白色')
  assert.equal(inventory.data[0].barcode, 'COLOR-W'); assert.equal(inventory.data[0].total_stock, 5)
  const detail = await repository.getAccessoryById(23, connection)
  assert.equal(detail.color_template_id, 20); assert.equal(detail.template_id, 21)
  db.exec('UPDATE accessories SET brand_id=10 WHERE id=23')
  const filteredTemplate = await repository.getAccessories({ mode: 'templates', brand_id: 10, color_id: 3, store_scope: scope }, connection)
  assert.deepEqual(filteredTemplate.data.map(row => row.id), [20])
  const filteredStock = await repository.getAccessories({ mode: 'inventory', brand_id: 10, color_id: 3, store_scope: scope }, connection)
  assert.deepEqual(filteredStock.data.map(row => row.id), [23])
  assert.equal((await repository.getAccessories({ mode: 'inventory', brand_id: 10, color_id: 4, store_scope: scope }, connection)).pagination.total, 0)
  const hidden = await repository.getAccessories({ mode: 'templates', search: 'COLOR-B', search_fields: ['name'] }, connection)
  assert.equal(hidden.pagination.total, 0)
})

test('超过500个同名模板仍可遍历全部匹配，跨页总数与条件一致且不会丢失后面的商品', async t => {
  const { db, repository, connection } = fixture(t)
  const insert = db.prepare('INSERT INTO accessories (id,name,category_id,status,product_model) VALUES (?, ?, 1, 1, ?)')
  for (let index = 1; index <= 521; index++) insert.run(1000 + index, '同名原装充电头', `USB-C 20W-${index}`)
  const ids = new Set()
  for (let page = 1; page <= Math.ceil(521 / 20); page++) {
    const result = await repository.getAccessories({ mode: 'templates', search: '同名 充电头', search_fields: ['name', 'product_model'],
      category: '充电头', model_name: '通用', page, page_size: 20, store_scope: scope }, connection)
    assert.equal(Number(result.pagination.total), 521)
    for (const row of result.data) {
      assert.equal(ids.has(row.id), false)
      ids.add(row.id)
    }
  }
  assert.equal(ids.size, 521)
  assert.equal(ids.has(1001), true)
  assert.equal(ids.has(1521), true)
})

test('型号或条码中的下划线、百分号与转义符按字面匹配，不把通配符当成任意内容', async t => {
  const { db, repository, connection } = fixture(t)
  db.exec(`UPDATE accessories SET product_model='USB_A100%', barcode='CODE!_100%' WHERE id=1;
    UPDATE accessories SET product_model='USBXA1000', barcode='CODEXA1000' WHERE id=4;`)
  for (const [keyword, field] of [['USB_A', 'product_model'], ['100%', 'product_model'], ['CODE!_', 'barcode']]) {
    const result = await repository.getAccessories({ mode: 'templates', search: keyword, search_fields: [field], store_scope: scope }, connection)
    assert.deepEqual(result.data.map(row => row.id), [1])
    assert.equal(Number(result.pagination.total), 1)
  }
})

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
  assert.deepEqual(calls[1].params, [1, 1, 1, 1, 1, 10, 0])
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
  for (const query of [{ brand_id: [1] }, { supplier_id: true }, { model_id: '1bad' }, { color_id: [1] }, { color_id: '1 OR 1=1' },
    { model_name: {} }, { model_name: true }, { model_name: 'a'.repeat(201) }, { mode: [] }, { status: ['1'] }, { search: {} }, { category: ['膜'] }]) {
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
      async lockFilmConfiguration() { return false },
      async assertUniqueFreeFilms() {},
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
      mode: 'inventory', store_id: '1', threshold: '0', low_stock_only: 'false', store_scope: { allStores: true },
      color_id: '3', model_name: 'iPhone17'
    } }, res)
    assert.equal(res.body.success, true)
    assert.equal(calls.at(-1)[1][1], actor)
  }
  assert.equal(calls[0][1][0].store_id, '1')
  assert.equal(calls[0][1][0].store_scope, undefined)
  assert.equal(calls[0][1][0].color_id, '3')
  assert.equal(calls[0][1][0].model_name, 'iPhone17')
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


test('型号、备注和启用状态读取模板权威资料，旧品牌副本不阻止模板重新启用', async t => {
  const { repository, db, connection } = fixture(t)
  db.exec("UPDATE accessories SET product_model='PD-NEW', remarks='模板备注' WHERE id=1; UPDATE accessories SET product_model='OLD', remarks='旧备注', status=0 WHERE id=2")
  const read = () => repository.getAccessoryById(2, connection)
  const current = await read()
  assert.equal(current.product_model, 'PD-NEW'); assert.equal(current.remarks, '模板备注'); assert.equal(current.status, 1)
  db.exec('UPDATE accessories SET status=0 WHERE id=1')
  assert.equal((await read()).status, 0)
  db.exec('UPDATE accessories SET status=1, product_model=NULL, remarks=NULL WHERE id=1')
  const cleared = await read()
  assert.equal(cleared.status, 1); assert.equal(cleared.product_model, null); assert.equal(cleared.remarks, null)
})
