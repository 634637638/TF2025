'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const AnalyticsCustomerDetailController = require('../src/controllers/analytics-customer-detail.controller')
const AnalyticsCustomerDetailService = require('../src/services/analytics-customer-detail.service')
const AnalyticsCustomerDetailRepository = require('../src/repositories/analytics-customer-detail.repository')
const AnalyticsCustomerSegmentsController = require('../src/controllers/analytics-customer-segments.controller')
const AnalyticsCustomerSegmentsService = require('../src/services/analytics-customer-segments.service')
const AnalyticsCustomerSegmentsRepository = require('../src/repositories/analytics-customer-segments.repository')

const response = () => ({
  status(code) { this.statusCode = code; return this },
  json(body) { this.body = body; return this }
})

test('customer detail and segments routes delegate with authentication and business-user middleware', () => {
  const route = fs.readFileSync(path.join(__dirname, '../src/routes/analytics.js'), 'utf8')
  assert.match(route, /router\.get\('\/customers\/:id\/detail', unifiedAuth, requireBusinessUser, analyticsCustomerDetailController\.getDetail\.bind\(analyticsCustomerDetailController\)\)/)
  assert.match(route, /router\.get\('\/customers\/segments', unifiedAuth, requireBusinessUser, analyticsCustomerSegmentsController\.getSegments\.bind\(analyticsCustomerSegmentsController\)\)/)
})

test('customer detail controller validates id and preserves response fields', async () => {
  const calls = []
  const controller = new AnalyticsCustomerDetailController({
    service: { async getDetail(input) { calls.push(input); return { trends: [], preferences: [] } } }
  })
  const invalid = response()
  await controller.getDetail({ params: { id: 'bad' }, query: {} }, invalid)
  assert.equal(invalid.statusCode, 400)

  const success = response()
  await controller.getDetail({ params: { id: '12' }, query: { store_id: '4abc' } }, success)
  assert.deepEqual(calls, [{ customerId: 12, storeId: 4 }])
  assert.deepEqual(success.body.data, { trends: [], preferences: [] })
  assert.equal(success.body.message, '获取客户详情成功')
})

test('customer detail service checks connectivity and normalizes rows', async () => {
  const disconnected = new AnalyticsCustomerDetailService({ connected: () => false, repository: {} })
  await assert.rejects(disconnected.getDetail({ customerId: 1, storeId: null }), { statusCode: 500, message: '数据库连接失败' })

  const service = new AnalyticsCustomerDetailService({
    connected: () => true,
    repository: {
      async getTrend(customerId, storeId) {
        assert.deepEqual([customerId, storeId], [12, 4])
        return [{ period: '2026-11', amount: '8.5' }, { period: '2026-10', amount: null }]
      },
      async getPreferences(customerId, storeId) {
        assert.deepEqual([customerId, storeId], [12, 4])
        return [{ name: null, value: '2' }]
      }
    }
  })
  assert.deepEqual(await service.getDetail({ customerId: 12, storeId: 4 }), {
    trends: [{ period: '2026-10', amount: 0 }, { period: '2026-11', amount: 8.5 }],
    preferences: [{ name: '其他', value: 2 }]
  })
})

test('customer detail repository binds the optional store filter', async () => {
  const calls = []
  const repository = new AnalyticsCustomerDetailRepository({
    database: () => ({
      async execute(query, params) {
        calls.push({ query, params })
        return [[{ period: '2026-11', amount: 1 }]]
      }
    })
  })
  await repository.getTrend(12, 4)
  await repository.getPreferences(12, null)
  assert.deepEqual(calls[0].params, [12, 4])
  assert.match(calls[0].query, /AND store_id = \?/)
  assert.deepEqual(calls[1].params, [12])
  assert.doesNotMatch(calls[1].query, /AND s\.store_id = \?/)
})

test('customer segments controller and service preserve canonical response shape', async () => {
  const controller = new AnalyticsCustomerSegmentsController({
    service: { async getSegments(input) { assert.deepEqual(input, { storeId: 7 }); return [{ segment: '高价值客户', count: 2, avg_order_value: 4, total_revenue: 8 }] } }
  })
  const result = response()
  await controller.getSegments({ query: { store_id: '7' } }, result)
  assert.deepEqual(result.body.data, [{ segment: '高价值客户', count: 2, avg_order_value: 4, total_revenue: 8 }])
  assert.equal(result.body.message, '获取客户细分成功')

  const service = new AnalyticsCustomerSegmentsService({
    connected: () => true,
    repository: { async getSegments(storeId) { assert.equal(storeId, null); return [{ segment: '新客户', count: '3', avgOrderValue: null, totalRevenue: '12.5' }] } }
  })
  assert.deepEqual(await service.getSegments({ storeId: null }), [{ segment: '新客户', count: 3, avg_order_value: 0, total_revenue: 12.5 }])
})

test('customer segments repository binds optional store scope', async () => {
  let call
  const repository = new AnalyticsCustomerSegmentsRepository({ database: () => ({
    async execute(query, params) { call = { query, params }; return [[{ segment: '新客户' }]] }
  }) })
  await repository.getSegments(5)
  assert.match(call.query, /AND c\.store_id = \?/)
  assert.deepEqual(call.params, [5])
})
