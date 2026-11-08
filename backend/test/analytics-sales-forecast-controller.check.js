'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const AnalyticsSalesForecastController = require('../src/controllers/analytics-sales-forecast.controller')
const AnalyticsSalesForecastService = require('../src/services/analytics-sales-forecast.service')
const AnalyticsSalesForecastRepository = require('../src/repositories/analytics-sales-forecast.repository')

test('sales forecast route retains authentication and delegates to controller', () => {
  const fs = require('node:fs')
  const route = fs.readFileSync(require.resolve('../src/routes/analytics'), 'utf8')
  assert.match(route, /router\.get\('\/sales-forecast', unifiedAuth, requireBusinessUser, analyticsSalesForecastController\.getForecast\.bind\(analyticsSalesForecastController\)\)/)
})

test('sales forecast service preserves empty-result and prediction response contracts', async () => {
  const emptyService = new AnalyticsSalesForecastService({
    connected: () => true,
    logger: { debug() {} },
    repository: { async getTopProducts() { return [] } }
  })
  assert.deepEqual(await emptyService.getForecast({}), {
    combinations: [], summary: { total_combinations: 0, avg_confidence: 0 }
  })

  const service = new AnalyticsSalesForecastService({
    connected: () => true,
    logger: { debug() {} },
    repository: {
      async getTopProducts() {
        return [{ brand_name: '品牌', model_name: '型号', color_name: '黑色', memory: '256G', total_sales: 7, weighted_score: 3.5 }]
      },
      async getCombinationSales() {
        return [{
          brand_name: '品牌', model_name: '型号', color_name: '黑色', memory: '256G',
          sales_count: '7', total_revenue: '7000', total_profit: '1400', sale_time: new Date().toISOString().slice(0, 10)
        }]
      }
    }
  })
  const response = await service.getForecast({ period: 'week', page_size: '5' }, new Date())
  assert.equal(response.period, 'week')
  assert.equal(response.historicalDays, 90)
  assert.equal(response.forecastDays, 7)
  assert.equal(response.combinations.length, 1)
  assert.equal(response.combinations[0].display_name, '品牌 型号 黑色 256G')
  assert.equal(response.combinations[0].actual_sales, 7)
  assert.equal(response.combinations[0].actual_revenue, 7000)
  assert.equal(response.combinations[0].time_series.dates.length, 37)
})

test('sales forecast reports offline database with the established response and handles errors', async () => {
  const calls = []
  const controller = new AnalyticsSalesForecastController({
    service: { async getForecast() { throw Object.assign(new Error('数据库连接失败'), { code: 'DATABASE_UNAVAILABLE' }) } },
    response: {
      serverError(...args) { calls.push(args); return 'error-response' },
      success(...args) { calls.push(args); return 'success-response' }
    },
    logger: { error() {} }
  })
  assert.equal(await controller.getForecast({ query: {} }, {}), 'error-response')
  assert.deepEqual(calls, [[{}, '数据库连接失败']])
})

test('sales forecast repository binds the weighted windows, store scope and selected combinations', async () => {
  const calls = []
  const repository = new AnalyticsSalesForecastRepository({
    database: () => ({
      async query(sql, params) {
        calls.push({ method: 'query', sql, params })
        return [[{ brand_name: '品牌', model_name: '型号', color_name: '黑色', memory: '256G' }]]
      },
      async execute(sql, params) {
        calls.push({ method: 'execute', sql, params })
        return [[]]
      }
    })
  })
  const dates = { day30Ago: '2026-03-01', day60Ago: '2026-01-30', day90Ago: '2025-12-31' }
  const topProducts = await repository.getTopProducts({ dates, storeId: '7' })
  await repository.getCombinationSales({ dates, today: '2026-03-31', storeId: '7', products: topProducts })

  assert.equal(calls.length, 2)
  assert.equal(calls[0].method, 'query')
  assert.deepEqual(calls[0].params, [
    '2026-03-01', '2026-01-30', '2026-03-01', '2025-12-31', '2026-01-30',
    '2026-03-01', '2026-01-30', '2026-03-01', '2025-12-31', '2026-01-30',
    '2025-12-31', 7
  ])
  assert.match(calls[0].sql, /LIMIT 10/)
  assert.equal(calls[1].method, 'execute')
  assert.deepEqual(calls[1].params, ['2025-12-31', '2026-03-31', '品牌', '型号', '黑色', '256G', 7])
  assert.match(calls[1].sql, /DATE\(p\.sale_time\) <= \?/)
})
