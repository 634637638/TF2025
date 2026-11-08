'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const Controller = require('../src/controllers/analytics-high-value-customers.controller')
const Service = require('../src/services/analytics-high-value-customers.service')
const Repository = require('../src/repositories/analytics-high-value-customers.repository')

const response = () => ({
  status(code) { this.statusCode = code; return this },
  json(body) { this.body = body; return this }
})

test('high-value customer route preserves auth and delegates to its controller', () => {
  const route = fs.readFileSync(path.join(__dirname, '../src/routes/analytics.js'), 'utf8')
  assert.match(route, /router\.get\('\/customers\/high-value', unifiedAuth, requireBusinessUser, analyticsHighValueCustomersController\.list\.bind\(analyticsHighValueCustomersController\)\)/)
})

test('high-value customer controller preserves query inputs, response and validation errors', async () => {
  const calls = []
  const controller = new Controller({ service: { async list(input) {
    calls.push(input)
    return { customers: [{ id: 4 }], pagination: { page: 2, page_size: 10, total: 11, total_pages: 2, has_next: false, has_prev: true } }
  } } })
  const result = response()
  await controller.list({ query: {
    page: '2', page_size: '10', search_term: ' 客户 ', start_date: '2026-10-01', end_date: '2026-10-31', store_id: '7'
  } }, result)
  assert.deepEqual(calls, [{
    page: 2, pageSize: 10, search: ' 客户 ', startDate: '2026-10-01', endDate: '2026-10-31', requestedStoreId: '7', storeId: 7
  }])
  assert.deepEqual(result.body.data, [{ id: 4 }])
  assert.deepEqual(result.body.pagination, { page: 2, page_size: 10, total: 11, total_pages: 2, has_next: false, has_prev: true })
  assert.equal(result.body.message, '获取成功')

  const invalid = response()
  const invalidController = new Controller({ service: { async list() { throw Object.assign(new Error('开始日期格式无效'), { statusCode: 400 }) } } })
  await invalidController.list({ query: {} }, invalid)
  assert.equal(invalid.statusCode, 400)
  assert.equal(invalid.body.message, '开始日期格式无效')
})

test('high-value customer service validates filters, connectivity and computes pagination safely', async () => {
  const disconnected = new Service({ connected: () => false, repository: {} })
  await assert.rejects(disconnected.list({ page: 1, pageSize: 20, storeId: null }), { statusCode: 500, message: '数据库连接失败' })

  const service = new Service({
    connected: () => true,
    repository: { async list(input) {
      assert.deepEqual(input, {
        pageSize: 10, offset: 10, search: '王', startDate: '2026-10-01', endDate: '2026-10-31', storeId: 7
      })
      return { customers: [{ id: 1 }], total: '11' }
    } }
  })
  assert.deepEqual(await service.list({
    page: 2, pageSize: 10, search: ' 王 ', startDate: '2026-10-01', endDate: '2026-10-31', requestedStoreId: '7', storeId: 7
  }), {
    customers: [{ id: 1 }],
    pagination: { page: 2, page_size: 10, total: '11', total_pages: 2, has_next: false, has_prev: true }
  })

  for (const input of [
    { page: 0, pageSize: 10, storeId: null },
    { page: 1, pageSize: 101, storeId: null },
    { page: 1, pageSize: 10, requestedStoreId: 'bad', storeId: null },
    { page: 1, pageSize: 10, startDate: '2026-02-30', storeId: null },
    { page: 1, pageSize: 10, startDate: '2026-11-01', endDate: '2026-10-01', storeId: null }
  ]) {
    await assert.rejects(service.list(input), error => error.statusCode === 400)
  }
})

test('high-value customer repository uses bound search and filter parameters for both queries', async () => {
  const calls = []
  const repository = new Repository({ database: () => ({ async query(sql, params) {
    calls.push({ sql, params })
    return calls.length === 1 ? [[{ id: 4 }]] : [[{ total: '1' }]]
  } }) })
  const result = await repository.list({
    pageSize: 20, offset: 0, search: '王', startDate: '2026-10-01', endDate: '2026-10-31', storeId: 3
  })
  assert.deepEqual(result, { customers: [{ id: 4 }], total: '1' })
  assert.deepEqual(calls.map(call => call.params), [
    ['2026-10-01', '2026-10-31', 3, '%王%', '%王%'],
    ['2026-10-01', '2026-10-31', 3, '%王%', '%王%']
  ])
  assert.match(calls[0].sql, /LIMIT 20 OFFSET 0/)
  assert.match(calls[0].sql, /LEFT JOIN sales s ON c\.id = s\.customer_id AND DATE\(s\.sale_time\) >= \? AND DATE\(s\.sale_time\) <= \? AND s\.store_id = \?\s+WHERE c\.status = 1\s+AND \(c\.name LIKE \? OR c\.phone LIKE \?\)/)
  assert.match(calls[1].sql, /HAVING COALESCE\(SUM\(s\.sale_price\), 0\) > 0/)
})
