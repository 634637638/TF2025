'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const SalesCustomerSearchController = require('../src/controllers/sales-customer-search.controller')

const createResponse = () => ({
  json(body) { this.body = body; return this },
  status(code) { this.statusCode = code; return this }
})

test('sales customer search route preserves authentication and view permission', () => {
  const route = fs.readFileSync(path.join(__dirname, '../src/routes/sales.js'), 'utf8')
  assert.match(route, /router\.get\('\/customers', unifiedAuth, requirePermission\('sales:view'\), salesCustomerSearchController\.search\.bind\(salesCustomerSearchController\)\)/)
})

test('sales customer search returns the existing empty response for terms shorter than two characters', async () => {
  let searches = 0
  const controller = new SalesCustomerSearchController({ searchCustomers: async () => { searches += 1 } })
  const res = createResponse()
  await controller.search({ query: { search: 'A' } }, res)
  assert.equal(searches, 0)
  assert.deepEqual(res.body, { success: true, message: '获取客户列表成功', data: [] })
})

test('sales customer search preserves numeric phone lookup, selected fields, pagination and response shape', async () => {
  let received
  const records = [{ id: 9, phone: '13800000000' }]
  const pagination = { page: 2, page_size: 5, total: 6, total_pages: 2, has_next: false, has_prev: true }
  const controller = new SalesCustomerSearchController({
    async searchCustomers(options) { received = options; return { records, pagination } }
  })
  const res = createResponse()
  await controller.search({ query: { search: '13800000000', page: '2', page_size: '5' } }, res)
  assert.deepEqual(received, {
    keyword: '13800000000',
    page: '2',
    page_size: '5',
    fields: ['id', 'name', 'phone', 'apple_id', 'member_number', 'vip_level', 'created_at'],
    search_fields: ['phone'],
    order_by: 'created_at'
  })
  assert.deepEqual(res.body, { success: true, message: '搜索客户成功', data: records, pagination })
})

test('sales customer search uses name matching and keeps the established error response', async () => {
  const options = []
  const logged = []
  const controller = new SalesCustomerSearchController({
    async searchCustomers(query) { options.push(query); throw new Error('query failed') },
    logger: { error(...args) { logged.push(args) } }
  })
  const res = createResponse()
  await controller.search({ query: { search: 'Alice' } }, res)
  assert.deepEqual(options[0].search_fields, ['name'])
  assert.equal(res.statusCode, 500)
  assert.deepEqual(res.body, { success: false, message: '搜索客户失败', error: 'query failed' })
  assert.equal(logged.length, 1)
})
