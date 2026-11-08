'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const Controller = require('../src/controllers/analytics-profit.controller')
const Service = require('../src/services/analytics-profit.service')
const Repository = require('../src/repositories/analytics-profit.repository')

const response = () => ({
  status(code) { this.statusCode = code; return this },
  json(body) { this.body = body; return this }
})

test('profit route preserves inherited authorization and delegates to controller', () => {
  const route = fs.readFileSync(path.join(__dirname, '../src/routes/analytics.js'), 'utf8')
  assert.match(route, /router\.get\('\/profit', unifiedAuth, requireBusinessUser, analyticsProfitController\.getProfit\.bind\(analyticsProfitController\)\)/)
})

test('profit controller forwards filters and preserves success and error responses', async () => {
  const calls = []
  const controller = new Controller({
    service: { async getProfit(filters) { calls.push(filters); return { summary: {}, costBreakdown: [] } } },
    response: {
      success(res, data) { res.body = { success: true, data }; return res },
      serverError(res, message, error) { res.statusCode = 500; res.body = { message, error }; return res }
    }
  })
  const result = response()
  await controller.getProfit({ query: { start_date: '2026-06-01', end_date: '2026-06-30', store_id: '7' } }, result)
  assert.deepEqual(calls[0], { startDate: '2026-06-01', endDate: '2026-06-30', storeId: '7' })
  assert.deepEqual(result.body, { success: true, data: { summary: {}, costBreakdown: [] } })

  let failureArgs
  const unavailable = new Controller({
    service: { async getProfit() { throw new Error('数据库连接失败') } },
    response: { serverError(...args) { failureArgs = args; args[0].statusCode = 500; return args[0] } }
  })
  const failed = response()
  await unavailable.getProfit({ query: {} }, failed)
  assert.equal(failed.statusCode, 500)
  assert.deepEqual(failureArgs.slice(1), ['数据库连接失败'])
})

test('profit service defaults to current month and calculates retail plus wholesale comparisons', async () => {
  const calls = []
  const service = new Service({
    connected: () => true,
    now: () => new Date(2026, 5, 15),
    logger: { debug() {} },
    repository: {
      async getPeriodData(filters) {
        calls.push(filters)
        return {
          currentRetail: { totalSales: '10', totalRevenue: '1200', totalCost: '600' },
          currentWholesale: { totalSales: '2', totalRevenue: '400', totalCost: '200' },
          previousRetail: { totalSales: '5', totalRevenue: '500', totalCost: '300' },
          previousWholesale: { totalSales: '0', totalRevenue: '0', totalCost: '0' }
        }
      }
    }
  })

  const result = await service.getProfit({ storeId: '7' })
  assert.deepEqual(calls[0], {
    currentStartDate: '2026-06-01', currentEndDate: '2026-06-30',
    previousStartDate: '2026-05-01', previousEndDate: '2026-05-31', storeId: '7'
  })
  assert.deepEqual(result, {
    summary: {
      totalRevenue: 1600, totalCost: 800, grossProfit: 800, marginRate: 50,
      netMarginRate: 50, netProfit: 800, totalSalesCount: 12, roi: 100,
      perCapitaOutput: 133,
      lastMonth: { totalRevenue: 500, netProfit: 200, netMarginRate: 40 },
      revenueTrend: 'up', revenueChange: 220,
      netProfitTrend: 'up', netProfitChange: 300,
      netMarginRateTrend: 'up', netMarginRateChange: 10
    },
    costBreakdown: []
  })
  await assert.rejects(new Service({ connected: () => false }).getProfit({}), { message: '数据库连接失败' })
})

test('profit repository binds all period and store values and returns rows from fixed query shapes', async () => {
  const calls = []
  const repository = new Repository(() => ({
    async execute(query, params) {
      calls.push({ query, params })
      return [[{ totalSales: 1, totalRevenue: 100, totalCost: 40 }]]
    }
  }))
  const result = await repository.getPeriodData({
    currentStartDate: '2026-06-01', currentEndDate: '2026-06-30',
    previousStartDate: '2026-05-01', previousEndDate: '2026-05-31', storeId: '7'
  })
  assert.equal(calls.length, 4)
  assert.deepEqual(calls.map(call => call.params), [
    ['2026-06-01', '2026-06-30', 7], ['2026-06-01', '2026-06-30', 7],
    ['2026-05-01', '2026-05-31', 7], ['2026-05-01', '2026-05-31', 7]
  ])
  assert.match(calls[0].query, /p\.status = 'sold'/)
  assert.match(calls[1].query, /p\.status = 'peer_transfer'/)
  assert.equal(result.currentRetail.totalRevenue, 100)

  const recent = await repository.getMostRecentRetailMonth({ beforeDate: '2026-06-01', storeId: '7' })
  assert.equal(calls[4].params.at(-1), 7)
  assert.match(calls[4].query, /GROUP BY DATE_FORMAT\(p\.sale_time/)
  assert.equal(recent.totalCost, 40)
})
