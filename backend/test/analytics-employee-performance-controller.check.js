'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const Controller = require('../src/controllers/analytics-employee-performance.controller')
const Service = require('../src/services/analytics-employee-performance.service')
const Repository = require('../src/repositories/analytics-employee-performance.repository')

const response = () => ({
  status(code) { this.statusCode = code; return this },
  json(body) { this.body = body; return this }
})

test('employee performance route keeps inherited salary permission and delegates to controller', () => {
  const route = fs.readFileSync(path.join(__dirname, '../src/routes/analytics.js'), 'utf8')
  assert.match(route, /router\.use\(\['\/employee-performance', '\/employees'\], requirePermission\('salary:view'\)\)/)
  assert.match(route, /router\.get\('\/employee-performance', unifiedAuth, requireBusinessUser, analyticsEmployeePerformanceController\.getPerformance\.bind\(analyticsEmployeePerformanceController\)\)/)
})

test('employee performance controller parses store scope and preserves its response/error mapping', async () => {
  const calls = []
  const controller = new Controller({ service: {
    async getPerformance(filters) {
      calls.push(filters)
      if (filters.storeId === 13) throw new Error('数据库连接失败')
      return [{ id: 3, name: '员工', totalCount: 4 }]
    }
  } })
  const result = response()
  await controller.getPerformance({ query: { start_date: '2026-11-01', end_date: '2026-11-30', store_id: '7abc' } }, result)
  assert.deepEqual(calls[0], { startDate: '2026-11-01', endDate: '2026-11-30', storeId: 7 })
  assert.deepEqual(result.body.data, [{ id: 3, name: '员工', totalCount: 4 }])
  const failed = response()
  await controller.getPerformance({ query: { store_id: '13' } }, failed)
  assert.equal(failed.statusCode, 500)
  assert.equal(failed.body.message, '服务器内部错误，请稍后重试')
})

test('employee performance service defaults partial date ranges to current month and combines retail and wholesale totals', async () => {
  const service = new Service({
    connected: () => true,
    now: () => new Date(2026, 1, 14),
    repository: {
      async getPerformance(filters) {
        assert.deepEqual(filters, { startDate: '2026-02-01', endDate: '2026-02-28', storeId: 5 })
        return {
          retailRows: [
            { user_id: 1, user_name: 'a', real_name: '甲', store_name: '一店', new_sales_count: '2', new_sales_amount: '200.4', new_profit: '40.2', used_sales_count: '1', used_sales_amount: '100', used_profit: '20' },
            { user_id: 2, user_name: 'b', real_name: null, store_name: null, new_sales_count: '0', new_sales_amount: '0', new_profit: '0', used_sales_count: '0', used_sales_amount: '0', used_profit: '0' }
          ],
          wholesaleRows: [
            { user_id: 1, new_wholesale_count: '1', new_wholesale_amount: '150.2', new_wholesale_profit: '30.1', used_wholesale_count: '1', used_wholesale_amount: '80.5', used_wholesale_profit: '10.2' },
            { user_id: 2, new_wholesale_count: '0', new_wholesale_amount: '0', new_wholesale_profit: '0', used_wholesale_count: '1', used_wholesale_amount: '50', used_wholesale_profit: '5' }
          ]
        }
      }
    }
  })
  assert.deepEqual(await service.getPerformance({ startDate: '2026-02-01', storeId: 5 }), [
    { id: 1, name: '甲', store: '一店', newCount: 3, newAmount: 351, newProfit: 70, usedCount: 2, usedAmount: 181, usedProfit: 30, totalCount: 5, totalAmount: 531, totalProfit: 101 },
    { id: 2, name: 'b', store: '未分配', newCount: 0, newAmount: 0, newProfit: 0, usedCount: 1, usedAmount: 50, usedProfit: 5, totalCount: 1, totalAmount: 50, totalProfit: 5 }
  ])
  await assert.rejects(new Service({ connected: () => false }).getPerformance({}), { message: '数据库连接失败' })
})

test('employee performance repository binds date and effective store filters to both queries', async () => {
  const calls = []
  const repository = new Repository(() => ({
    async execute(query, params) {
      calls.push({ query, params })
      return [[]]
    }
  }))
  await repository.getPerformance({ startDate: '2026-02-01', endDate: '2026-02-28', storeId: 5 })
  assert.equal(calls.length, 2)
  assert.deepEqual(calls.map(call => call.params), [
    ['2026-02-01', '2026-02-28', 5], ['2026-02-01', '2026-02-28', 5]
  ])
  assert.ok(calls[0].query.includes("p.status = 'sold'"))
  assert.ok(calls[1].query.includes("p.status = 'peer_transfer'"))
  assert.ok(calls.every(call => call.query.includes('COALESCE(latest_sale.store_id, p.store_id) = ?')))
})
