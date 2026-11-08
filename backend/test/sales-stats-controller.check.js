'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const SalesStatsController = require('../src/controllers/sales-stats.controller')
const SalesStatsService = require('../src/services/sales-stats.service')
const SalesStatsRepository = require('../src/repositories/sales-stats.repository')

const createResponse = () => ({
  json(body) { this.body = body; return this },
  status(code) { this.statusCode = code; return this }
})

test('sales stats route preserves authentication and sales view permission', () => {
  const route = fs.readFileSync(path.join(__dirname, '../src/routes/sales.js'), 'utf8')
  assert.match(route, /router\.get\('\/stats', unifiedAuth, requirePermission\('sales:view'\), salesStatsController\.getStats\.bind\(salesStatsController\)\)/)
})

test('sales stats service runs both repository reads in order and normalizes revenue', async () => {
  const calls = []
  const service = new SalesStatsService({
    repository: {
      async getPhoneCounts() { calls.push('phones'); return { total_phones: 8, sold_phones: 3 } },
      async getCurrentMonthSales() { calls.push('month'); return { sold_this_month: 2, total_revenue: '125.50' } }
    }
  })
  assert.deepEqual(await service.getStats(), {
    total_phones: 8,
    sold_phones: 3,
    sold_this_month: 2,
    total_revenue: 125.5
  })
  assert.deepEqual(calls, ['phones', 'month'])
})

test('sales stats repository keeps inventory and current-month query contracts', async () => {
  const calls = []
  const repository = new SalesStatsRepository({
    getDb: () => ({
      async execute(sql, params) {
        calls.push({ sql, params })
        return [[calls.length === 1
          ? { total_phones: 8, available_phones: 3, sold_phones: 4, reserved_phones: 1 }
          : { sold_this_month: 2, total_revenue: '125.50' }]]
      }
    })
  })
  assert.deepEqual(await repository.getPhoneCounts(), {
    total_phones: 8,
    available_phones: 3,
    sold_phones: 4,
    reserved_phones: 1
  })
  assert.deepEqual(await repository.getCurrentMonthSales(), { sold_this_month: 2, total_revenue: '125.50' })
  assert.equal(calls.length, 2)
  assert.match(calls[0].sql, /COUNT\(CASE WHEN status = 'reserved' OR \(status = 'in_stock' AND COALESCE\(is_preordered, 0\) = 1\)/)
  assert.match(calls[1].sql, /YEAR\(sale_time\) = YEAR\(CURRENT_DATE\)/)
  assert.match(calls[1].sql, /MONTH\(sale_time\) = MONTH\(CURRENT_DATE\)/)
  assert.deepEqual(calls.map(call => call.params), [undefined, undefined])
})

test('sales stats controller returns the established success payload', async () => {
  const data = { total_phones: 8, sold_this_month: 2, total_revenue: 125.5 }
  const controller = new SalesStatsController({ service: { async getStats() { return data } } })
  const res = createResponse()
  await controller.getStats({}, res)
  assert.deepEqual(res.body, { success: true, message: '获取销售统计成功', data })
})

test('sales stats controller keeps the established error response and logging', async () => {
  const logged = []
  const controller = new SalesStatsController({
    service: { async getStats() { throw new Error('stats query failed') } },
    logger: { error(...args) { logged.push(args) } }
  })
  const res = createResponse()
  await controller.getStats({}, res)
  assert.equal(res.statusCode, 500)
  assert.deepEqual(res.body, { success: false, message: '获取销售统计失败', error: 'stats query failed' })
  assert.equal(logged.length, 1)
})
