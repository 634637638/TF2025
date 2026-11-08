'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const Controller = require('../src/controllers/analytics-sales.controller')
const Service = require('../src/services/analytics-sales.service')
const Repository = require('../src/repositories/analytics-sales.repository')

const response = () => ({
  status(code) { this.statusCode = code; return this },
  json(body) { this.body = body; return this }
})

test('sales analytics route preserves authentication and delegates to controller', () => {
  const route = fs.readFileSync(path.join(__dirname, '../src/routes/analytics.js'), 'utf8')
  assert.match(route, /router\.get\('\/sales', unifiedAuth, requireBusinessUser, analyticsSalesController\.getSales\.bind\(analyticsSalesController\)\)/)
})

test('sales analytics controller validates dates and forwards normalized filters', async () => {
  const calls = []
  const controller = new Controller({ service: {
    async getSales(filters) {
      calls.push(filters)
      return { total_orders: { total: 2 } }
    }
  } })
  const result = response()
  await controller.getSales({ query: {
    start_date: '2026-02-01', end_date: '2026-02-28', store_id: '5abc', supplier_id: '9'
  } }, result)
  assert.deepEqual(calls[0], {
    startDate: '2026-02-01', endDate: '2026-02-28', storeId: 5, supplierId: 9
  })
  assert.deepEqual(result.body.data, { total_orders: { total: 2 } })
  const invalid = response()
  await controller.getSales({ query: { start_date: '2026-02-30' } }, invalid)
  assert.equal(invalid.statusCode, 400)
  assert.equal(invalid.body.message, '开始日期格式无效')
})

test('sales analytics service retains grouped totals and snake_case response contract', async () => {
  const service = new Service({
    connected: () => true,
    repository: {
      async getSales() {
        return {
          salesRows: [
            { date: '2026-02-02', totalOrders: '2', totalSales: '120000' },
            { date: '2026-02-01', totalOrders: '1', totalSales: '10000' }
          ],
          storeRows: [{ id: 4, name: '主店', totalOrders: '3', totalSales: '60000', averageOrderValue: '20000' }],
          productRows: [{ id: 8, imei: 'I', model_name: 'M', brand_name: 'B', quantity: '2', revenue: '300', stock_status: null }]
        }
      }
    }
  })
  assert.deepEqual(await service.getSales({}), {
    top_products: [{ id: 8, imei: 'I', model_name: 'M', brand_name: 'B', quantity: 2, revenue: 300, growth: null, stock_status: 'unknown' }],
    sales_by_store: [{ id: 4, name: '主店', total_sales: 60000, total_orders: 3, average_order_value: 20000, performance: 'excellent', growth_rate: 0 }],
    sales_by_period: [
      { period: '2026-02-02', sales: 120000, orders: 2, revenue: 120000, target: 120000, achievement: 100 },
      { period: '2026-02-01', sales: 10000, orders: 1, revenue: 10000, target: 10000, achievement: 100 }
    ],
    total_sales: { total: 130000, change: 0, change_percent: 0, trend: 'stable' },
    total_orders: { total: 3, change: 0, change_percent: 0, trend: 'stable' },
    average_order_value: { total: 130000 / 3, change: 0, change_percent: 0, trend: 'stable' },
    revenue_forecast: []
  })
  await assert.rejects(new Service({ connected: () => false }).getSales({}), { message: '数据库连接失败' })
})

test('sales analytics repository binds canonical date, store and supplier filters', async () => {
  const calls = []
  const repository = new Repository(() => ({
    async execute(query, params) {
      calls.push({ query, params })
      return [[]]
    }
  }))
  await repository.getSales({ startDate: '2026-02-01', endDate: '2026-02-28', storeId: 5, supplierId: 9 })
  assert.equal(calls.length, 3)
  assert.deepEqual(calls.map(call => call.params), [
    ['2026-02-01', '2026-02-28', 5],
    ['2026-02-01', '2026-02-28'],
    ['2026-02-01', '2026-02-28', 5, 9]
  ])
  assert.ok(calls[0].query.includes('so.store_id = ?'))
  assert.ok(calls[1].query.includes('DATE(so.order_date) <= ?'))
  assert.ok(calls[2].query.includes('p.supplier_id = ?'))
})
