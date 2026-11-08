'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const Controller = require('../src/controllers/analytics-store-profit.controller')
const Service = require('../src/services/analytics-store-profit.service')
const Repository = require('../src/repositories/analytics-store-profit.repository')

const response = () => ({
  status(code) { this.statusCode = code; return this },
  json(body) { this.body = body; return this }
})

test('store profit route retains authentication and delegates to controller', () => {
  const route = fs.readFileSync(path.join(__dirname, '../src/routes/analytics.js'), 'utf8')
  assert.match(route, /router\.get\('\/store-profit', unifiedAuth, requireBusinessUser, analyticsStoreProfitController\.getStoreProfit\.bind\(analyticsStoreProfitController\)\)/)
})

test('store profit controller parses canonical filters and preserves response errors', async () => {
  const calls = []
  const controller = new Controller({ service: {
    async getStoreProfit(query) {
      calls.push(query)
      if (query.storeId === 13) throw new Error('数据库连接失败')
      return [{ id: 3, profit: 40 }]
    }
  } })
  const result = response()
  await controller.getStoreProfit({ query: {
    start_date: '2026-06-01', end_date: '2026-06-30', store_id: '7abc', supplier_id: '9'
  } }, result)
  assert.deepEqual(calls[0], {
    startDate: '2026-06-01', endDate: '2026-06-30', storeId: 7, supplierId: 9
  })
  assert.deepEqual(result.body.data, [{ id: 3, profit: 40 }])
  const failed = response()
  await controller.getStoreProfit({ query: { store_id: '13' } }, failed)
  assert.equal(failed.statusCode, 500)
})

test('store profit service applies current month defaults and shapes sorted store totals', async () => {
  const calls = []
  const service = new Service({
    connected: () => true,
    now: () => new Date(2026, 1, 14),
    repository: {
      async getStoreProfit(query) {
        calls.push(query)
        return [
          { store_id: 1, store_name: '低利润', sales_count: '2', total_revenue: '100.2', total_cost: '80.2' },
          { store_id: 2, store_name: null, sales_count: '3', total_revenue: '300', total_cost: '150' },
          { store_id: 3, sales_count: '0', total_revenue: '0', total_cost: '0' }
        ]
      }
    }
  })
  assert.deepEqual(await service.getStoreProfit({ startDate: '2026-02-02', storeId: 4, supplierId: 8 }), [
    { id: 2, name: '未知门店', revenue: 300, cost: 150, count: 3, profit: 150 },
    { id: 1, name: '低利润', revenue: 100, cost: 80, count: 2, profit: 20 }
  ])
  assert.deepEqual(calls[0], {
    startDate: '2026-02-01', endDate: '2026-02-28', storeId: 4, supplierId: 8
  })
  await assert.rejects(new Service({ connected: () => false }).getStoreProfit({}), { message: '数据库连接失败' })
})

test('store profit repository binds repeated date, store and supplier filters for retail and transfer reads', async () => {
  let call
  const repository = new Repository(() => ({
    async execute(query, params) {
      call = { query, params }
      return [[]]
    }
  }))
  await repository.getStoreProfit({ startDate: '2026-01-01', endDate: '2026-01-31', storeId: 7, supplierId: 9 })
  assert.deepEqual(call.params, [
    '2026-01-01', '2026-01-31', 7, 9,
    '2026-01-01', '2026-01-31', 7, 9
  ])
  assert.equal((call.query.match(/p\.supplier_id = \?/g) || []).length, 2)
  assert.equal((call.query.match(/COALESCE\(latest_sale\.store_id, p\.store_id\) = \?/g) || []).length, 2)
  await repository.getStoreProfit({ startDate: '2026-01-01', endDate: '2026-01-31', storeId: null, supplierId: null })
  assert.deepEqual(call.params, ['2026-01-01', '2026-01-31', '2026-01-01', '2026-01-31'])
})
