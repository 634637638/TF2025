'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const Controller = require('../src/controllers/analytics-sales-by-condition.controller')
const Service = require('../src/services/analytics-sales-by-condition.service')
const Repository = require('../src/repositories/analytics-sales-by-condition.repository')

const response = () => ({
  status(code) { this.statusCode = code; return this },
  json(body) { this.body = body; return this }
})

test('sales by condition route retains authentication and delegates to controller', () => {
  const route = fs.readFileSync(path.join(__dirname, '../src/routes/analytics.js'), 'utf8')
  assert.match(route, /router\.get\('\/sales-by-condition', unifiedAuth, requireBusinessUser, analyticsSalesByConditionController\.getSalesByCondition\.bind\(analyticsSalesByConditionController\)\)/)
})

test('sales by condition controller parses filters and maps connection errors', async () => {
  const calls = []
  const controller = new Controller({ service: {
    async getSalesByCondition(filters) {
      calls.push(filters)
      if (filters.storeId === 13) throw new Error('数据库连接失败')
      return { new: { sales_count: 2 }, used: { sales_count: 1 } }
    }
  } })
  const result = response()
  await controller.getSalesByCondition({ query: {
    start_date: '2026-11-01', end_date: '2026-11-07', store_id: '7abc', supplier_id: '9'
  } }, result)
  assert.deepEqual(calls[0], {
    startDate: '2026-11-01', endDate: '2026-11-07', storeId: 7, supplierId: 9
  })
  assert.deepEqual(result.body.data, { new: { sales_count: 2 }, used: { sales_count: 1 } })
  const failed = response()
  await controller.getSalesByCondition({ query: { store_id: '13' } }, failed)
  assert.equal(failed.statusCode, 500)
  assert.equal(failed.body.message, '服务器内部错误，请稍后重试')
})

test('sales by condition service returns retail summaries and tolerates failed wholesale summaries', async () => {
  const logged = []
  const service = new Service({
    connected: () => true,
    logger: { error(...args) { logged.push(args) } },
    repository: {
      async getRetailTotals(filters) {
        assert.deepEqual(filters, { startDate: '2026-11-01', endDate: '2026-11-30', storeId: 5, supplierId: 9 })
        return [
          { salesCount: '2', salesAmount: '300', profit: '60' },
          { salesCount: '1', salesAmount: '100', profit: '30' }
        ]
      },
      async getWholesaleTotals() { throw new Error('wholesale query unavailable') }
    }
  })
  assert.deepEqual(await service.getSalesByCondition({
    startDate: '2026-11-01', endDate: '2026-11-30', storeId: 5, supplierId: 9
  }), {
    new: { sales_count: 2, sales_amount: 300, profit: 60, margin_rate: 20, avg_price: 150 },
    used: { sales_count: 1, sales_amount: 100, profit: 30, margin_rate: 30, avg_price: 100 }
  })
  assert.equal(logged.length, 1)
  await assert.rejects(new Service({ connected: () => false }).getSalesByCondition({}), { message: '数据库连接失败' })
})

test('sales by condition repository binds filters for retail and wholesale totals', async () => {
  const calls = []
  const repository = new Repository(() => ({
    async execute(query, params) {
      calls.push({ query, params })
      return [[]]
    }
  }))
  const filters = { startDate: '2026-11-01', endDate: '2026-11-30', storeId: 5, supplierId: 9 }
  await repository.getRetailTotals(filters)
  await repository.getWholesaleTotals(filters)
  assert.equal(calls.length, 4)
  assert.ok(calls.every(call => call.params.join('|') === '2026-11-01|2026-11-30|5|9'))
  assert.ok(calls.slice(0, 2).every(call => call.query.includes('p.status = "sold"')))
  assert.ok(calls.slice(2).every(call => call.query.includes("p.status = 'peer_transfer'")))
  assert.ok(calls.every(call => call.query.includes('p.supplier_id = ?')))
  assert.ok(calls.every(call => call.query.includes('COALESCE(latest_sale.store_id, p.store_id) = ?')))
})
