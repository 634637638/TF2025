'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const Controller = require('../src/controllers/subsidy-list.controller')
const Service = require('../src/services/subsidy-list.service')
const Repository = require('../src/repositories/subsidy-list.repository')

const routeSource = fs.readFileSync(path.join(__dirname, '../src/routes/subsidy.js'), 'utf8')

test('subsidy list route preserves authentication, permission, short cache and controller delegation', () => {
  assert.match(routeSource, /router\.get\('\/', unifiedAuth, requirePermission\('subsidy:view'\), cacheMiddleware\(\{ ttl: CACHE_TTL\.SHORT \}\), subsidyListController\.list\.bind\(subsidyListController\)\)/)
})

test('subsidy list controller preserves response and error contracts with timing logs', async () => {
  const info = []
  const errors = []
  const controller = new Controller({
    service: { async list({ userId, query, onFiltersBuilt }) {
      assert.equal(userId, 42)
      assert.equal(query.page, '2')
      onFiltersBuilt({ page: 2, page_size: 10, filterCount: 1, queryParamCount: 0 })
      return {
        data: [{ id: 8 }],
        listQueryMs: 1,
        countQueryMs: 2,
        pagination: { page: 2, page_size: 10, total: 11, total_pages: 2, has_next: false, has_prev: true }
      }
    } },
    logger: { info(...args) { info.push(args) }, error(...args) { errors.push(args) } }
  })
  const response = { json(body) { this.body = body; return this } }
  await controller.list({ user: { id: 42 }, query: { page: '2' }, method: 'GET', originalUrl: '/subsidy?page=2' }, response)
  assert.deepEqual(response.body, {
    success: true,
    message: '获取国补列表成功',
    data: [{ id: 8 }],
    pagination: { page: 2, page_size: 10, total: 11, total_pages: 2, has_next: false, has_prev: true }
  })
  assert.equal(info.length, 4)

  const failure = { status(code) { this.statusCode = code; return this }, json(body) { this.body = body; return this } }
  await new Controller({ service: { async list() { throw new Error('database unavailable') } }, logger: { info() {}, error(...args) { errors.push(args) } } })
    .list({ user: { id: 42 }, query: {}, method: 'GET', originalUrl: '/subsidy' }, failure)
  assert.equal(failure.statusCode, 500)
  assert.deepEqual(failure.body, { success: false, message: '获取国补列表失败', error: 'database unavailable' })
  assert.equal(errors.length, 1)
})

test('subsidy list service preserves pagination, sorting, formatting, signed photos and field masking', async () => {
  let input
  const service = new Service({
    repository: { async list(options) {
      input = options
      return {
        subsidies: [{
          id: 1,
          sale_price: '100.50',
          subsidy_amount: '20.25',
          subsidy_rate: '0.2',
          subsidy_photos: '["photo"]',
          has_different_handler: 1,
          handler_name: '办理人',
          handler_phone: '13800000000',
          handler_idcard: 'ID'
        }],
        total: '21',
        listQueryMs: 1,
        countQueryMs: 2
      }
    } },
    masking: { async maskDataList(items, userId, moduleKey) {
      assert.equal(userId, 7)
      assert.equal(moduleKey, 'subsidy_subsidyview')
      return items
    } },
    mapPhotos(photos, userId) { assert.deepEqual(photos, ['photo']); assert.equal(userId, 7); return ['/signed'] },
    logger: { info() {}, error() {} }
  })
  const result = await service.list({ userId: 7, query: { page: '2', page_size: '10', sort_by: 'created_at', sort_order: 'asc' } })
  assert.equal(input.sortField, 'created_at')
  assert.equal(input.sortDirection, 'ASC')
  assert.equal(input.pageSize, 10)
  assert.equal(input.offset, 10)
  assert.deepEqual(result.data[0], {
    id: 1,
    sale_price: 100.5,
    subsidy_amount: 20.25,
    subsidy_rate: 0.2,
    subsidy_photos: ['/signed'],
    has_different_handler: true,
    handler_name: '办理人',
    handler_phone: '13800000000',
    handler_idcard: 'ID',
    handler_info: { handler_name: '办理人', handler_phone: '13800000000', handler_idcard: 'ID' }
  })
  assert.deepEqual(result.pagination, { page: 2, page_size: 10, total: 21, total_pages: 3, has_next: true, has_prev: true })
})

test('subsidy list repository binds filters and pagination while keeping sort input controlled upstream', async () => {
  const calls = []
  const repository = new Repository({ getDb: () => ({ async query(sql, params) {
    calls.push({ sql, params })
    return sql.includes('COUNT(*)') ? [[{ total: 3 }]] : [[{ id: 4 }]]
  } }) })
  const result = await repository.list({
    whereConditions: ['1=1', 'store_id = ?'],
    queryParams: [5],
    sortField: 'sale_time',
    sortDirection: 'DESC',
    pageSize: 20,
    offset: 40
  })
  assert.equal(calls.length, 2)
  assert.deepEqual(calls.find(call => call.sql.includes('LIMIT ? OFFSET ?')).params, [5, 20, 40])
  assert.deepEqual(calls.find(call => call.sql.includes('COUNT(*)')).params, [5])
  assert.equal(result.total, 3)
  assert.deepEqual(result.subsidies, [{ id: 4 }])
})
