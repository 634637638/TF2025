'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const Controller = require('../src/controllers/analytics-customer-retention.controller')
const Service = require('../src/services/analytics-customer-retention.service')
const { AnalyticsCustomerRetentionRepository, COHORT_CONFIG } = require('../src/repositories/analytics-customer-retention.repository')

const response = () => ({
  status(code) { this.statusCode = code; return this },
  json(body) { this.body = body; return this }
})

test('customer retention route keeps authentication and delegates to its controller', () => {
  const route = fs.readFileSync(path.join(__dirname, '../src/routes/analytics.js'), 'utf8')
  assert.match(route, /router\.get\('\/customers\/retention', unifiedAuth, requireBusinessUser, analyticsCustomerRetentionController\.getRetention\.bind\(analyticsCustomerRetentionController\)\)/)
})

test('customer retention controller forwards filters and maps invalid cohorts to 400', async () => {
  const calls = []
  const controller = new Controller({ service: { async getRetention(input) {
    calls.push(input)
    return { cohorts: [], periods: [] }
  } } })
  const result = response()
  await controller.getRetention({ query: { cohort: 'quarterly', store_id: '8' } }, result)
  assert.deepEqual(calls, [{ cohort: 'quarterly', storeId: 8 }])
  assert.deepEqual(result.body.data, { cohorts: [], periods: [] })
  assert.equal(result.body.message, '获取客户留存率成功')

  const invalid = response()
  const invalidController = new Controller({ service: { async getRetention() {
    throw Object.assign(new Error('留存周期无效'), { statusCode: 400 })
  } } })
  await invalidController.getRetention({ query: { cohort: 'daily' } }, invalid)
  assert.equal(invalid.statusCode, 400)
  assert.equal(invalid.body.message, '留存周期无效')
})

test('customer retention service rejects unsupported cohorts and disconnected database', async () => {
  const disconnected = new Service({ connected: () => false, repository: {} })
  await assert.rejects(disconnected.getRetention({ cohort: 'monthly', storeId: null }), {
    statusCode: 500,
    message: '数据库连接失败'
  })

  const service = new Service({ connected: () => true, repository: {} })
  await assert.rejects(service.getRetention({ cohort: 'daily', storeId: null }), {
    statusCode: 400,
    message: '留存周期无效'
  })
})

test('customer retention service groups customers and calculates the six-period matrix', async () => {
  const service = new Service({
    connected: () => true,
    repository: { async getCohorts(input) {
      assert.deepEqual(input, { cohort: 'monthly', storeId: 4 })
      return [
        { id: 1, created_at: '2026-01-10T00:00:00.000Z', period_offset: 0, has_purchase: 1 },
        { id: 1, created_at: '2026-01-10T00:00:00.000Z', period_offset: 1, has_purchase: 1 },
        { id: 2, created_at: '2026-01-20T00:00:00.000Z', period_offset: 0, has_purchase: 1 },
        { id: 2, created_at: '2026-01-20T00:00:00.000Z', period_offset: 1, has_purchase: 0 },
        { id: 3, created_at: '2026-02-01T00:00:00.000Z', period_offset: 0, has_purchase: 1 },
        { id: 3, created_at: '2026-02-01T00:00:00.000Z', period_offset: 1, has_purchase: 1 }
      ]
    } }
  })

  assert.deepEqual(await service.getRetention({ cohort: 'monthly', storeId: 4 }), {
    periods: ['第1月', '第2月', '第3月', '第4月', '第5月', '第6月'],
    cohorts: [
      { cohort: '2026-01', data: [100, 50, 0, 0, 0, 0] },
      { cohort: '2026-02', data: [100, 100, 0, 0, 0, 0] }
    ]
  })
})

test('customer retention repository uses fixed cohort SQL and binds store scope', async () => {
  const expectedPeriodExpressions = {
    monthly: /TIMESTAMPDIFF\(MONTH,/,
    quarterly: /\(YEAR\(s\.sale_time\) - YEAR\(c\.created_at\)\) \* 4 \+ QUARTER\(s\.sale_time\) - QUARTER\(c\.created_at\)/,
    yearly: /YEAR\(s\.sale_time\) - YEAR\(c\.created_at\)/
  }
  for (const [cohort, config] of Object.entries(COHORT_CONFIG)) {
    const calls = []
    const repository = new AnalyticsCustomerRetentionRepository({ database: () => ({ async execute(sql, params) {
      calls.push({ sql, params })
      return [[{ id: 1 }]]
    } }) })
    assert.deepEqual(await repository.getCohorts({ cohort, storeId: 9 }), [{ id: 1 }])
    assert.equal(calls.length, 1)
    assert.match(calls[0].sql, expectedPeriodExpressions[cohort])
    assert.match(calls[0].sql, new RegExp(`INTERVAL ${config.windowMonths} MONTH`))
    assert.match(calls[0].sql, new RegExp(`INTERVAL 6 ${config.unit}`))
    assert.match(calls[0].sql, /AND c\.store_id = \?\s/)
    assert.deepEqual(calls[0].params, [9])
  }

  const unscopedCalls = []
  const unscoped = new AnalyticsCustomerRetentionRepository({ database: () => ({ async execute(sql, params) {
    unscopedCalls.push({ sql, params })
    return [[]]
  } }) })
  await unscoped.getCohorts({ cohort: 'monthly', storeId: null })
  assert.doesNotMatch(unscopedCalls[0].sql, /c\.store_id = \?/)
  assert.deepEqual(unscopedCalls[0].params, [])
})
