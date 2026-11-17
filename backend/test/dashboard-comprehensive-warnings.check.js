'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const DashboardService = require('../src/services/dashboard.service')
const DashboardRepository = require('../src/repositories/dashboard.repository')
const DashboardReadRepository = require('../src/repositories/dashboard-read.repository')

test('仪表盘读统计与动态均绑定业务门店，维修 UNION 两段范围一致，空绑定拒绝全部店铺', async () => {
  const calls = []
  const repository = new DashboardReadRepository({ database: () => ({ async execute(sql, params) {
    calls.push({ sql, params }); return [[]]
  } }) })
  const scope = { allStores: false, storeIds: [2, 3] }
  for (const method of ['countStockPhones', 'todayRetailAmount', 'todayAccessoryAmount', 'todayWholesaleAmount', 'todayAccessoryCount', 'recentAccessorySales']) {
    await repository[method](scope)
  }
  for (const method of ['phoneSaleActivities', 'accessorySaleActivities', 'inventoryActivities', 'repairActivities']) {
    await repository[method](8, scope)
  }
  for (const call of calls) {
    assert.match(call.sql, /store_id IN \(\?, \?\)/)
    assert.equal((call.sql.match(/\?/g) || []).length, call.params.length)
  }
  assert.doesNotMatch(calls.at(-1).sql, /r\.store_id/)
  assert.match(calls.at(-1).sql, /LEFT JOIN phones p ON p\.id = r\.phone_id/)
  assert.match(calls.at(-1).sql, /p\.store_id IN/)
  assert.deepEqual(calls.at(-1).params, [2, 3, 2, 3])
  assert.match(calls[1].sql, /s\.store_id IN/)
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
