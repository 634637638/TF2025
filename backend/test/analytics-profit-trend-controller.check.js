'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const Controller = require('../src/controllers/analytics-profit-trend.controller')
const Service = require('../src/services/analytics-profit-trend.service')
const Repository = require('../src/repositories/analytics-profit-trend.repository')
const { buildLatestSaleJoin, buildStoreFilterClause } = require('../src/utils/analytics-query')

const response = () => ({
  status(code) { this.statusCode = code; return this },
  json(body) { this.body = body; return this }
})

test('profit trend route preserves auth and delegates to its controller', () => {
  const route = fs.readFileSync(path.join(__dirname, '../src/routes/analytics.js'), 'utf8')
  assert.match(route, /router\.get\('\/profit-trend', unifiedAuth, requireBusinessUser, analyticsProfitTrendController\.getProfitTrend\.bind\(analyticsProfitTrendController\)\)/)
})

test('profit trend controller forwards canonical filters and preserves errors', async () => {
  const calls = []
  const controller = new Controller({ service: {
    async getProfitTrend(query) {
      calls.push(query)
      if (query.granularity === 'offline') throw new Error('数据库连接失败')
      return { granularity: 'month', rangeStart: '2026-01-01', rangeEnd: '2026-12-31', series: [] }
    }
  } })
  const result = response()
  await controller.getProfitTrend({ query: { granularity: 'year', end_date: '2026-12-15', store_id: '9abc' } }, result)
  assert.deepEqual(calls[0], { granularity: 'year', endDate: '2026-12-15', storeId: 9 })
  assert.deepEqual(result.body.data, { granularity: 'month', rangeStart: '2026-01-01', rangeEnd: '2026-12-31', series: [] })
  const failed = response()
  await controller.getProfitTrend({ query: { granularity: 'offline' } }, failed)
  assert.equal(failed.statusCode, 500)
})

test('profit trend service preserves period windows and zero-fills missing buckets', async () => {
  const calls = []
  const service = new Service({
    connected: () => true,
    now: () => new Date(2026, 5, 15),
    repository: {
      async getProfitTrend(query) {
        calls.push(query)
        return [{ period_key: '2026-06', totalSales: '2', totalRevenue: '100.6', totalCost: '40.2' }]
      }
    }
  })
  const monthly = await service.getProfitTrend({ endDate: '2026-06-15', storeId: 4 })
  assert.equal(monthly.granularity, 'month')
  assert.equal(monthly.series.length, 12)
  assert.deepEqual(calls[0], { granularity: 'month', rangeStart: '2025-07-01', rangeEnd: '2026-06-30', storeId: 4 })
  assert.deepEqual(monthly.series.at(-1), {
    key: '2026-06', label: '2026年6月', startDate: '2026-06-01', endDate: '2026-06-30',
    totalSales: 2, totalRevenue: 101, totalCost: 40, totalProfit: 61
  })
  assert.deepEqual(monthly.series[0], {
    key: '2025-07', label: '2025年7月', startDate: '2025-07-01', endDate: '2025-07-31',
    totalSales: 0, totalRevenue: 0, totalCost: 0, totalProfit: 0
  })

  const quarterly = await service.getProfitTrend({ granularity: 'quarter', endDate: '2026-10-02' })
  assert.equal(quarterly.series.length, 8)
  assert.equal(quarterly.series.at(-1).key, '2026-Q4')
  const yearly = await service.getProfitTrend({ granularity: 'year', endDate: '2026-12-31' })
  assert.equal(yearly.series.length, 6)
  assert.equal(yearly.series.at(-1).key, '2026')
  const fallback = await service.getProfitTrend({ granularity: 'invalid', endDate: 'invalid-date' })
  assert.equal(fallback.granularity, 'month')
  await assert.rejects(new Service({ connected: () => false }).getProfitTrend({}), { message: '数据库连接失败' })
})

test('profit trend repository binds date range and both store filters using shared sales helpers', async () => {
  let call
  const repository = new Repository(() => ({
    async execute(query, params) {
      call = { query, params }
      return [[{ period_key: '2026-01' }]]
    }
  }))
  await repository.getProfitTrend({ granularity: 'quarter', rangeStart: '2025-01-01', rangeEnd: '2026-12-31', storeId: 7 })
  assert.deepEqual(call.params, ['2025-01-01', '2026-12-31', 7, '2025-01-01', '2026-12-31', 7])
  assert.equal((call.query.match(/COALESCE\(latest_sale\.store_id, p\.store_id\) = \?/g) || []).length, 2)
  assert.match(call.query, /CONCAT\(YEAR\(p\.sale_time\), '-Q', QUARTER\(p\.sale_time\)\)/)
  assert.equal(buildLatestSaleJoin({}).includes('MAX(id)'), true)
  assert.deepEqual(buildStoreFilterClause('7'), {
    storeId: 7, clause: 'AND COALESCE(latest_sale.store_id, p.store_id) = ?', params: [7]
  })
})
