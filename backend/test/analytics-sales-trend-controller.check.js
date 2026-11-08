'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const AnalyticsSalesTrendController = require('../src/controllers/analytics-sales-trend.controller')
const AnalyticsSalesTrendService = require('../src/services/analytics-sales-trend.service')
const AnalyticsSalesTrendRepository = require('../src/repositories/analytics-sales-trend.repository')

const response = () => ({
  status(code) { this.statusCode = code; return this },
  json(body) { this.body = body; return this }
})

test('sales trend route preserves unified authentication, business permission and controller delegation', () => {
  const source = fs.readFileSync(path.join(__dirname, '../src/routes/analytics.js'), 'utf8')
  assert.match(source, /router\.get\('\/sales\/trends', unifiedAuth, requireBusinessUser, analyticsSalesTrendController\.getSalesTrends\.bind\(analyticsSalesTrendController\)\)/)
})

test('sales trend controller maps query parameters and preserves response contract', async () => {
  const success = response()
  const expected = [{ period: '2026-11', new: 2, used: 3 }]
  const controller = new AnalyticsSalesTrendController({
    service: {
      async getSalesTrends(query) {
        assert.deepEqual(query, { period: 'weekly', storeId: 12, startDate: '2026-11-01', endDate: '2026-11-07' })
        return expected
      }
    }
  })
  await controller.getSalesTrends({ query: { period: 'weekly', store_id: '12', start_date: '2026-11-01', end_date: '2026-11-07' } }, success)
  assert.deepEqual(success.body.data, expected)
  assert.equal(success.body.message, '获取销量趋势成功')

  const invalid = response()
  await new AnalyticsSalesTrendController({
    service: { async getSalesTrends() { const error = new Error('销售趋势周期无效'); error.statusCode = 400; throw error } }
  }).getSalesTrends({ query: {} }, invalid)
  assert.equal(invalid.statusCode, 400)
})

test('sales trend service validates periods before checking the database and normalizes aggregates', async () => {
  const unavailable = new AnalyticsSalesTrendService({ connected: () => false, repository: {} })
  await assert.rejects(unavailable.getSalesTrends({ period: 'unknown' }), { statusCode: 400 })
  await assert.rejects(unavailable.getSalesTrends({ period: 'daily' }), { statusCode: 500 })

  const service = new AnalyticsSalesTrendService({
    connected: () => true,
    repository: {
      async getSalesTrends(query) {
        assert.deepEqual(query, { period: 'monthly', storeId: null, startDate: undefined, endDate: undefined })
        return [{ period: '2026-11', new_count: '2', used_count: null }]
      }
    }
  })
  assert.deepEqual(await service.getSalesTrends({}), [{ period: '2026-11', new: 2, used: 0 }])
})

test('sales trend repository uses fixed period expressions and binds store and date filters', async () => {
  let query
  let params
  const repository = new AnalyticsSalesTrendRepository(() => ({
    async execute(sql, values) {
      query = sql
      params = values
      return [[{ period: '2026-11', new_count: 1, used_count: 2 }]]
    }
  }))
  const rows = await repository.getSalesTrends({
    period: 'quarterly', storeId: 5, startDate: '2026-01-01', endDate: '2026-12-31'
  })
  assert.equal(rows[0].period, '2026-11')
  assert.match(query, /CONCAT\(YEAR\(s\.sale_time\), '-Q', QUARTER\(s\.sale_time\)\)/)
  assert.match(query, /s\.store_id = \?/)
  assert.deepEqual(params, [5, '2026-01-01', '2026-12-31'])
})
