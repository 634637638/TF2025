'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const Controller = require('../src/controllers/analytics-customer-overview.controller')
const Service = require('../src/services/analytics-customer-overview.service')
const Repository = require('../src/repositories/analytics-customer-overview.repository')

function responseRecorder() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this },
    json(body) { this.body = body; return this }
  }
}

test('customer overview route preserves auth middleware and delegates to controller', () => {
  const route = require('../src/routes/analytics')
  const layer = route.stack.find(item => item.route?.path === '/customers')
  assert.ok(layer)
  assert.equal(layer.route.stack.length, 3)
  assert.equal(layer.route.stack.at(-1).name, 'bound getOverview')
})

test('customer overview controller validates canonical filters and maps service result', async () => {
  const calls = []
  const controller = new Controller({
    service: { async getOverview(filters) { calls.push(filters); return { total_customers: 3 } } },
    response: {
      badRequest: (res, message) => { res.status(400).json({ message }); return res },
      success: (res, data, message) => { res.json({ data, message }); return res },
      serverError: (res, message) => { res.status(500).json({ message }); return res }
    },
    logger: { debug() {}, error() {} }
  })
  const invalid = responseRecorder()
  await controller.getOverview({ query: { start_date: '2026-02-30' } }, invalid)
  assert.equal(invalid.statusCode, 400)

  const result = responseRecorder()
  await controller.getOverview({ query: { start_date: '2026-01-01', end_date: '2026-01-31', store_id: '4' } }, result)
  assert.deepEqual(calls, [{ startDate: '2026-01-01', endDate: '2026-01-31', storeId: 4 }])
  assert.deepEqual(result.body, { data: { total_customers: 3 }, message: '获取客户分析成功' })
})

test('customer overview service computes growth, segments and Beijing insight dates', async () => {
  const service = new Service({
    repository: { async getOverview() {
      return {
        totalCustomers: '1200', newCustomers: '30', activeCustomers: '80', highValueCount: 7,
        lastMonthNew: '20', lastYearActive: '40',
        segments: [{ segment: '高价值客户', count: 2, avgOrderValue: '60000', totalRevenue: '120000' }]
      }
    } },
    connected: () => true,
    getNow: () => '2026-11-08 12:00:00'
  })
  const result = await service.getOverview({ storeId: 4 })
  assert.equal(result.total_customers, 1200)
  assert.equal(result.new_customers_growth, 50)
  assert.equal(result.active_customers_growth, 100)
  assert.deepEqual(result.customer_segments, [{ segment: '高价值客户', count: 2, avg_order_value: 60000, total_revenue: 120000 }])
  assert.equal(result.insights[0].date, '2026-11-08 12:00:00')
  await assert.rejects(new Service({ connected: () => false }).getOverview({}), /数据库连接失败/)
})

test('customer overview repository binds date and store filters across aggregate queries', async () => {
  const calls = []
  const rows = [
    [[{ totalCustomers: 5 }]], [[{ newCustomers: 2 }]], [[{ activeCustomers: 1 }]],
    [[{ id: 1 }]], [[{ segment: '新客户', count: 1 }]], [[{ lastMonthNew: 1 }]], [[{ lastYearActive: 1 }]]
  ]
  const repository = new Repository({ getDb: () => ({ execute: async (sql, params) => { calls.push({ sql, params }); return rows[calls.length - 1] } }) })
  const result = await repository.getOverview({ startDate: '2026-01-01', endDate: '2026-01-31', storeId: 9 })
  assert.equal(calls.length, 7)
  assert.deepEqual(calls[0].params, [9, '2026-01-01', '2026-01-31'])
  assert.deepEqual(calls[2].params, ['2026-01-01', '2026-01-31', 9])
  assert.deepEqual(calls[4].params, [9, '2026-01-01', '2026-01-31'])
  assert.ok(calls.every(({ sql }) => !/store_id\s*=\s*\$\{|DATE\([^)]*\)\s*>=\s*['"]\d{4}/.test(sql)))
  assert.equal(result.highValueCount, 1)
})
