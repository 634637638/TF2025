'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const Controller = require('../src/controllers/analytics-product-ranking.controller')
const Service = require('../src/services/analytics-product-ranking.service')
const Repository = require('../src/repositories/analytics-product-ranking.repository')

const response = () => ({
  status(code) { this.statusCode = code; return this },
  json(body) { this.body = body; return this }
})

test('brand and model ranking routes retain authentication and delegate to controllers', () => {
  const route = fs.readFileSync(path.join(__dirname, '../src/routes/analytics.js'), 'utf8')
  assert.match(route, /router\.get\('\/ranking\/brands', unifiedAuth, requireBusinessUser, analyticsProductRankingController\.getBrandRanking\.bind\(analyticsProductRankingController\)\)/)
  assert.match(route, /router\.get\('\/ranking\/models', unifiedAuth, requireBusinessUser, analyticsProductRankingController\.getModelRanking\.bind\(analyticsProductRankingController\)\)/)
})

test('ranking controller normalizes optional filters and preserves database errors', async () => {
  const calls = []
  const controller = new Controller({ service: {
    async getRanking(type, filters) {
      calls.push({ type, filters })
      if (filters.storeId === 13) throw new Error('数据库连接失败')
      return [{ name: '结果' }]
    }
  } })
  const result = response()
  await controller.getModelRanking({ query: {
    start_date: '2026-06-01', end_date: '2026-06-30', store_id: '7abc', supplier_id: 'bad', page_size: '20', sort_by: 'profit'
  } }, result)
  assert.deepEqual(calls[0], {
    type: 'model',
    filters: { startDate: '2026-06-01', endDate: '2026-06-30', storeId: 7, supplierId: null, pageSize: '20', sortBy: 'profit' }
  })
  assert.deepEqual(result.body.data, [{ name: '结果' }])
  const failed = response()
  await controller.getBrandRanking({ query: { store_id: '13' } }, failed)
  assert.equal(failed.statusCode, 500)
  assert.equal(failed.body.message, '服务器内部错误，请稍后重试')
})

test('ranking service merges retail and wholesale rows, sorts, pages, and calculates percentages', async () => {
  const service = new Service({
    connected: () => true,
    repository: {
      async getRanking(type) {
        assert.equal(type, 'model')
        return {
          retailRows: [
            { id: 1, name: 'X', brand_name: 'Brand', count: '2', amount: '200', cost: '120' },
            { id: 2, name: 'Y', brand_name: 'Brand', count: '1', amount: '100', cost: '80' }
          ],
          wholesaleRows: [
            { id: 1, name: 'X', brand_name: 'Brand', count: '1', amount: '150', cost: '90' },
            { id: 3, name: 'Z', brand_name: 'Brand', count: '1', amount: '80', cost: '50' }
          ]
        }
      }
    }
  })
  assert.deepEqual(await service.getRanking('model', { pageSize: '2', sortBy: 'profit' }), [
    { name: 'Brand X', count: 3, amount: 350, cost: 210, profit: 140, percent: 100 },
    { name: 'Brand Z', count: 1, amount: 80, cost: 50, profit: 30, percent: 21 }
  ])
  await assert.rejects(new Service({ connected: () => false }).getRanking('brand', {}), { message: '数据库连接失败' })
})

test('ranking repository binds date, store, and supplier values for retail and wholesale queries', async () => {
  const calls = []
  const repository = new Repository(() => ({
    async execute(query, params) {
      calls.push({ query, params })
      return [[]]
    }
  }))
  await repository.getRanking('brand', {
    startDate: '2026-01-01', endDate: '2026-01-31', storeId: 7, supplierId: 9
  })
  assert.equal(calls.length, 2)
  assert.deepEqual(calls.map(call => call.params), [
    ['2026-01-01', '2026-01-31', 7, 9],
    ['2026-01-01', '2026-01-31', 7, 9]
  ])
  assert.ok(calls.every(call => call.query.includes('p.supplier_id = ?')))
  assert.ok(calls.every(call => call.query.includes('COALESCE(latest_sale.store_id, p.store_id) = ?')))
  await assert.rejects(repository.getRanking('unsupported', {}), TypeError)
})
