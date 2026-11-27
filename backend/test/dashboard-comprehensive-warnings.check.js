'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const { DatabaseSync } = require('node:sqlite')
const DashboardService = require('../src/services/dashboard.service')
const DashboardRepository = require('../src/repositories/dashboard.repository')
const DashboardReadRepository = require('../src/repositories/dashboard-read.repository')

test('今日全新和二手的台数与金额使用同一批门店销售记录', async t => {
  const db = new DatabaseSync(':memory:')
  t.after(() => db.close())
  db.exec(`
    CREATE TABLE phones (id INTEGER PRIMARY KEY, status TEXT, is_new INTEGER);
    CREATE TABLE sales (id INTEGER PRIMARY KEY, phone_id INTEGER, store_id INTEGER, status TEXT, sale_type TEXT, sale_time TEXT, sale_price NUMERIC);
    INSERT INTO phones VALUES
      (1, 'sold', 1), (2, 'peer_transfer', 0), (3, 'sold', NULL), (4, 'sold', 1),
      (5, 'supplier_proxy', 1), (6, 'sold', 0), (7, 'sold', 1);
    INSERT INTO sales VALUES
      (1, 1, 2, 'completed', 'retail', '2026-11-26 00:00:00', 90),
      (2, 1, 2, 'completed', 'retail', '2026-11-26 01:00:00', 100),
      (3, 2, 2, 'completed', 'wholesale', '2026-11-26 23:59:59', 50.25),
      (4, 3, 2, 'completed', 'retail', '2026-11-26 12:00:00', 80),
      (5, 4, 2, 'cancelled', 'retail', '2026-11-26 12:00:00', 90),
      (6, 5, 2, 'completed', 'supplier_proxy', '2026-11-26 12:00:00', 0),
      (7, 6, 3, 'completed', 'retail', '2026-11-26 12:00:00', 60),
      (8, 7, 2, 'completed', 'retail', '2026-11-27 00:00:00', 70);
  `)
  const repository = new DashboardReadRepository({ database: () => ({
    async execute(sql, params) { return [db.prepare(sql).all(...params)] }
  }) })
  const start = '2026-11-26 00:00:00', end = '2026-11-27 00:00:00'
  const [[sales]] = await repository.todayPhoneSales({ allStores: false, storeIds: [2] }, start, end)
  assert.deepEqual({ ...sales }, { amount: 230.25, new_amount: 100, used_amount: 50.25, new_count: 1, used_count: 1 })
  const [[empty]] = await repository.todayPhoneSales({ allStores: false, storeIds: [] }, start, end)
  assert.deepEqual({ ...empty }, { amount: 0, new_amount: 0, used_amount: 0, new_count: 0, used_count: 0 })
})

test('个人月度手机零售、划拨与调货独立统计，按有效交易和日期边界计数', async t => {
  const db = new DatabaseSync(':memory:')
  t.after(() => db.close())
  db.exec(`
    CREATE TABLE phones (id INTEGER PRIMARY KEY, sale_operator_id INTEGER, status TEXT, is_new INTEGER);
    CREATE TABLE sales (id INTEGER PRIMARY KEY, phone_id INTEGER, status TEXT, sale_type TEXT, sale_time TEXT);
    CREATE TABLE accessory_sales (operator_id INTEGER, quantity INTEGER, sale_type TEXT, sale_time TEXT, created_at TEXT);
    INSERT INTO phones VALUES
      (1, 7, 'sold', 1), (2, 7, 'sold', 0), (3, 7, 'sold', NULL),
      (4, 7, 'supplier_proxy', 1), (5, 7, 'peer_transfer', 0),
      (6, 8, 'peer_transfer', 1), (7, 7, 'supplier_proxy', 1),
      (8, 7, 'peer_transfer', 0), (9, 7, 'sold', 1),
      (10, 7, 'in_stock', 1), (11, 7, 'peer_transfer', 1);
    INSERT INTO sales VALUES
      (1, 1, 'completed', 'retail', '2026-11-01 00:00:00'),
      (2, 2, 'completed', 'retail', '2026-11-26 23:59:59'),
      (3, 3, 'completed', 'retail', '2026-11-05 12:00:00'),
      (4, 4, 'completed', 'supplier_proxy', '2026-11-05 12:00:00'),
      (5, 5, 'completed', 'wholesale', '2026-11-05 12:00:00'),
      (6, 6, 'completed', 'wholesale', '2026-11-05 12:00:00'),
      (7, 7, 'completed', 'supplier_proxy', '2026-11-05 12:00:00'),
      (8, 7, 'cancelled', 'supplier_proxy', '2026-11-06 12:00:00'),
      (9, 8, 'completed', 'wholesale', '2026-11-27 00:00:00'),
      (10, 9, 'completed', 'retail', '2026-10-31 23:59:59'),
      (11, 10, 'completed', 'retail', '2026-11-05 12:00:00'),
      (12, 11, 'completed', 'retail', '2026-11-05 12:00:00');
    INSERT INTO accessory_sales VALUES
      (7, 3, 'sale', '2026-11-05 12:00:00', NULL), (7, 4, NULL, NULL, '2026-11-07 12:00:00'),
      (7, 5, 'gift', '2026-11-05 12:00:00', NULL), (8, 5, 'sale', '2026-11-05 12:00:00', NULL);
  `)
  const repository = new DashboardReadRepository({ database: () => ({
    async execute(sql, params) { return [db.prepare(sql).all(...params)] }
  }) })
  const [[sales]] = await repository.monthlySales(7, '2026-11-01', '2026-11-27')
  assert.deepEqual({ ...sales }, {
    phone_count: 3, new_count: 1, used_count: 1, allocation_count: 1, transfer_count: 1, goods_quantity: 7
  })
  const [[empty]] = await repository.monthlySales(9, '2026-11-01', '2026-11-27')
  assert.deepEqual({ ...empty }, {
    phone_count: 0, new_count: 0, used_count: 0, allocation_count: 0, transfer_count: 0, goods_quantity: 0
  })
})

test('仪表盘读统计与动态均绑定业务门店，维修 UNION 两段范围一致，空绑定拒绝全部店铺', async () => {
  const calls = []
  const repository = new DashboardReadRepository({ database: () => ({ async execute(sql, params) {
    calls.push({ sql, params }); return [[]]
  } }) })
  const scope = { allStores: false, storeIds: [2, 3] }
  for (const method of ['countStockPhones', 'todayPhoneSales', 'todayAccessorySales', 'recentAccessorySales']) {
    await repository[method](scope, '2026-11-26 00:00:00', '2026-11-27 00:00:00')
  }
  for (const method of ['phoneSaleActivities', 'accessorySaleActivities', 'inventoryActivities', 'subsidyActivities', 'preorderActivities', 'repairActivities']) {
    await repository[method](10, scope, '2026-11-26 00:00:00', '2026-11-27 00:00:00')
  }
  for (const call of calls) {
    assert.match(call.sql, /store_id IN \(\?, \?\)/)
    assert.equal((call.sql.match(/\?/g) || []).length, call.params.length)
  }
  assert.doesNotMatch(calls.at(-1).sql, /r\.store_id/)
  assert.match(calls.at(-1).sql, /LEFT JOIN phones p ON p\.id = r\.phone_id/)
  assert.match(calls.at(-1).sql, /p\.store_id IN/)
  assert.deepEqual(calls.at(-1).params, [2, 3, 2, 3, 10])
  assert.match(calls[1].sql, /s\.store_id IN/)
  assert.match(calls[0].sql, /status = 'in_stock' AND supplier_id IS NOT NULL/)
  assert.match(calls[1].sql, /s\.sale_type = 'wholesale' OR \(\s*s\.sale_type = 'retail' AND p\.status = 'sold'/)
  assert.match(calls[1].sql, /latest_sale\.status IS NULL OR latest_sale\.status IN \('pending', 'completed'\)/)
  const subsidyQuery = calls.find(({ sql }) => sql.includes('FROM national_subsidies'))
  assert.match(subsidyQuery.sql, /COALESCE\(ns\.apply_time, ns\.sale_time\) AS occurred_at/)
  assert.doesNotMatch(subsidyQuery.sql, /ns\.created_at/)
  assert.match(subsidyQuery.sql, /ns\.customer_name/)
  assert.match(subsidyQuery.sql, /ns\.phone_color AS color_name/)
  assert.match(subsidyQuery.sql, /ns\.phone_memory AS memory_size/)
  const preorderQuery = calls.find(({ sql }) => sql.includes('FROM preorders pr'))
  assert.match(preorderQuery.sql, /c\.name AS customer_name/)
  assert.match(preorderQuery.sql, /co\.name AS color_name/)
  assert.match(preorderQuery.sql, /mem\.size AS memory_size/)
  assert.match(preorderQuery.sql, /LEFT JOIN memories mem ON mem\.id = pr\.memory_id/)
  calls.length = 0
  await repository.recentAccessorySales({ allStores: false, storeIds: [] })
  assert.match(calls[0].sql, /1 = 0/)
})

test('两层库存预警聚合参数完整对应 SQL，空门店不产生全店零库存预警', async t => {
  const before = process.env.NODE_ENV
  process.env.NODE_ENV = 'production'
  t.after(() => { if (before === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = before })
  const repository = new DashboardRepository()
  const calls = []
  repository.executeQuery = async (sql, params) => {
    calls.push({ sql, params })
    assert.equal((sql.match(/\?/g) || []).length, params.length)
    return []
  }
  const filters = { scope: { allStores: false, storeIds: [2, 3] }, storeId: 2, supplierId: 7 }
  await repository.getPhoneStockWarnings(3, 20, filters)
  await repository.getModelStockWarnings(3, 20, filters)
  assert.deepEqual(calls.map(call => call.params), [
    [2, 3, 2, 7, 2, 3, 2, 7, 20], [2, 3, 2, 7, 2, 3, 2, 7, 20]
  ])
  calls.length = 0
  assert.deepEqual(await repository.getPhoneStockWarnings(3, 20, { scope: { allStores: false, storeIds: [] } }), [])
  assert.equal(calls.length, 0)
})

const baseWarnings = () => ({
  phones: { warnings: [{ model_name: '测试机' }], count: 1, threshold: 3 },
  accessories: { warnings: [], count: 0 },
  sales: {},
  purchases: {},
  models: { warnings: [{ model_name: '测试机型' }], count: 1 },
  summary: { total_warnings: 2, has_warnings: true }
})

const fixture = ({ permitted = true, hiddenFields = [], rows = [] } = {}) => {
  const calls = []
  const service = new DashboardService({
    dashboardRepository: { async getComprehensiveWarnings() { return baseWarnings() } },
    accessoryService: { async getLowStockWarnings(params, actor) {
      calls.push({ params, actor })
      return { success: true, data: { warnings: rows } }
    } },
    accessoryFields: { async getPermissions(userId) {
      calls.push({ userId })
      return { hiddenFields }
    } },
    permissionCheck: async (_actor, permission) => permission === 'accessories:view' && permitted
  })
  return { service, calls }
}

test('综合预警在无配件模块权限时保留手机预警且不读取配件库存', async () => {
  const { service, calls } = fixture({ permitted: false })
  const result = await service.getComprehensiveWarnings({}, { id: 7 })

  assert.equal(result.success, true)
  assert.equal(result.data.phones.count, 1)
  assert.deepEqual(result.data.accessories, { warnings: [], count: 0 })
  assert.equal(result.data.summary.total_warnings, 2)
  assert.equal(calls.length, 0)
})

test('综合预警隐藏配件名称、库存或阈值字段时省略配件数据', async () => {
  for (const hiddenField of ['basic_info.name', 'stock_info.min_stock', 'stock_info.total_quantity']) {
    const { service, calls } = fixture({ permitted: true, hiddenFields: [hiddenField] })
    const result = await service.getComprehensiveWarnings({}, { id: 7 })

    assert.deepEqual(result.data.accessories, { warnings: [], count: 0 })
    assert.equal(calls.length, 1)
    assert.deepEqual(calls[0], { userId: 7 })
  }
})

test('综合预警复用配件服务的门店范围和模板阈值结果', async () => {
  const actor = { id: 7, store_id: 2, store_ids: [2] }
  const { service, calls } = fixture({ rows: [
    { name: '无库存商品', total_quantity: '0', min_stock_threshold: '5' },
    { name: '阈值商品', total_quantity: '5', min_stock_threshold: '5' }
  ] })
  const result = await service.getComprehensiveWarnings({ page_size: 2 }, actor)

  assert.deepEqual(calls[1], { params: {}, actor })
  assert.deepEqual(result.data.accessories, {
    warnings: [
      { name: '无库存商品', stock: 0, min_stock: 5, status: '已缺货' },
      { name: '阈值商品', stock: 5, min_stock: 5, status: '库存不足' }
    ],
    count: 2
  })
  assert.equal(result.data.summary.total_warnings, 4)
  assert.equal(result.data.summary.has_warnings, true)
})
