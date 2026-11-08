'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const AnalyticsCustomerGrowthController = require('../src/controllers/analytics-customer-growth.controller')
const AnalyticsCustomerGrowthService = require('../src/services/analytics-customer-growth.service')
const AnalyticsCustomerGrowthRepository = require('../src/repositories/analytics-customer-growth.repository').AnalyticsCustomerGrowthRepository

const response = () => ({
  status(code) { this.statusCode = code; return this },
  json(body) { this.body = body; return this }
})

test('customer growth route delegates with auth and business middleware', () => {
  const route = fs.readFileSync(path.join(__dirname, '../src/routes/analytics.js'), 'utf8')
  assert.match(route, /router\.get\('\/customers\/growth', unifiedAuth, requireBusinessUser, analyticsCustomerGrowthController\.getGrowth\.bind\(analyticsCustomerGrowthController\)\)/)
})

test('customer growth controller preserves period, store filter, response and errors', async () => {
  const calls = []
  const controller = new AnalyticsCustomerGrowthController({
    service: { async getGrowth(input) { calls.push(input); return { labels: ['2026-11-01'], values: [3] } } }
  })
  const result = response()
  await controller.getGrowth({ query: { period: '7d', store_id: '4abc' } }, result)
  assert.deepEqual(calls, [{ period: '7d', storeId: 4 }])
  assert.deepEqual(result.body.data, { labels: ['2026-11-01'], values: [3] })
  assert.equal(result.body.message, '获取客户增长数据成功')
})

test('customer growth service normalizes periods and rows', async () => {
  const service = new AnalyticsCustomerGrowthService({
    connected: () => true,
    repository: { async getGrowth(input) {
      assert.deepEqual(input, { days: 90, storeId: 2 })
      return [{ date: '2026-11-01', new_customers: '3' }, { date: '2026-11-02', new_customers: null }]
    } }
  })
  assert.deepEqual(await service.getGrowth({ period: '90d', storeId: 2 }), {
    labels: ['2026-11-01', '2026-11-02'], values: [3, 0]
  })
})

test('customer growth service rejects unavailable database', async () => {
  const service = new AnalyticsCustomerGrowthService({ connected: () => false, repository: {} })
  await assert.rejects(service.getGrowth({ period: '30d', storeId: null }), { statusCode: 500, message: '数据库连接失败' })
})

test('customer growth repository binds optional store filter', async () => {
  const calls = []
  const repository = new AnalyticsCustomerGrowthRepository(() => ({ async execute(...args) { calls.push(args); return [[{ date: '2026-11-01', new_customers: 2 }]] } }))
  await repository.getGrowth({ days: 7, storeId: 5 })
  await repository.getGrowth({ days: 30, storeId: null })
  assert.match(calls[0][0], /INTERVAL 7 DAY/)
  assert.match(calls[0][0], /AND c\.store_id = \?/)
  assert.deepEqual(calls[0][1], [5])
  assert.doesNotMatch(calls[1][0], /AND c\.store_id = \?/)
  assert.deepEqual(calls[1][1], [])
})
