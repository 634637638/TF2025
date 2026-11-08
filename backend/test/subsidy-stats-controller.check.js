'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const Controller = require('../src/controllers/subsidy-stats.controller')
const Service = require('../src/services/subsidy-stats.service')
const Repository = require('../src/repositories/subsidy-stats.repository')

const routeSource = fs.readFileSync(path.join(__dirname, '../src/routes/subsidy.js'), 'utf8')

test('subsidy summary route preserves authentication, permission, cache and controller delegation', () => {
  assert.match(routeSource, /router\.get\('\/stats\/summary', unifiedAuth, requirePermission\('subsidy:view'\), cacheMiddleware\(\{ ttl: CACHE_TTL\.SHORT \}\), subsidyStatsController\.getSummary\.bind\(subsidyStatsController\)\)/)
})

test('subsidy summary controller preserves response, timing and error contracts', async () => {
  const info = []
  const errors = []
  const controller = new Controller({
    service: { async getSummary({ userId, query, onFiltersBuilt }) {
      assert.equal(userId, 42)
      assert.equal(query.store_id, '3')
      onFiltersBuilt({ includeStoreStats: true, filterCount: 2, queryParamCount: 1 })
      return {
        data: { total_count: 1, store_stats: [] },
        includeStoreStats: true,
        storeCount: 0,
        statsQueryMs: 1,
        storeStatsQueryMs: 2
      }
    } },
    logger: { info(...args) { info.push(args) }, error(...args) { errors.push(args) } }
  })
  const success = { json(body) { this.body = body; return this } }
  await controller.getSummary({ user: { id: 42 }, query: { store_id: '3' }, method: 'GET', originalUrl: '/subsidy/stats/summary' }, success)
  assert.deepEqual(success.body, {
    success: true,
    message: '获取统计数据成功',
    data: { total_count: 1, store_stats: [] }
  })
  assert.equal(info.length, 3)

  const failure = {
    status(code) { this.statusCode = code; return this },
    json(body) { this.body = body; return this }
  }
  const failingController = new Controller({
    service: { async getSummary() { throw new Error('database unavailable') } },
    logger: { info() {}, error(...args) { errors.push(args) } }
  })
  await failingController.getSummary({ user: { id: 42 }, query: {}, method: 'GET', originalUrl: '/subsidy/stats/summary' }, failure)
  assert.equal(failure.statusCode, 500)
  assert.deepEqual(failure.body, {
    success: false,
    message: '获取统计数据失败',
    error: 'database unavailable'
  })
  assert.equal(errors.length, 1)
})

test('subsidy summary service binds filters, hides fields and omits store query when hidden', async () => {
  let repositoryInput
  const service = new Service({
    masking: { async getUserFieldPermissions(userId, moduleKey) {
      assert.equal(userId, 7)
      assert.equal(moduleKey, 'subsidy_subsidyview')
      return { hiddenFields: ['stats.store_overview', 'stats.approval_progress', 'stats.total_and_handler'] }
    } },
    repository: { async getSummary(input) {
      repositoryInput = input
      return {
        stats: {
          total_count: 2,
          pending_count: 1,
          completed_count: 1,
          approved_count: 0,
          handler_count: 1,
          total_arrived_amount: '0.00',
          total_subsidy_amount: '300.00'
        },
        storeStats: [],
        statsQueryMs: 1,
        storeStatsQueryMs: 0
      }
    } }
  })
  let filterTiming
  const result = await service.getSummary({
    userId: 7,
    query: { status: 'unarrived', store_id: '3', start_date: '2026-01-01', include_store_stats: '1' },
    onFiltersBuilt: details => { filterTiming = details }
  })

  assert.deepEqual(repositoryInput, {
    whereConditions: ['1=1', 'apply_time IS NOT NULL', 'arrival_time IS NULL', 'sale_time >= ?', 'store_id = ?'],
    queryParams: ['2026-01-01', '3'],
    includeStoreStats: false
  })
  assert.deepEqual(filterTiming, { includeStoreStats: false, filterCount: 5, queryParamCount: 2 })
  assert.deepEqual(result.data, {
    total_count: 2,
    total_arrived_amount: 0,
    total_subsidy_amount: 300
  })
})

test('subsidy summary repository runs aggregate reads in parallel with bound parameters', async () => {
  const calls = []
  const repository = new Repository({ getDb: () => ({
    async execute(sql, params) {
      calls.push({ sql, params, at: process.hrtime.bigint() })
      return sql.includes('GROUP BY store_id')
        ? [[{ store_id: 3, store_name: '门店', total_count: '2' }]]
        : [[{ total_count: '2', total_subsidy_amount: '300' }]]
    }
  }) })
  const result = await repository.getSummary({
    whereConditions: ['1=1', 'store_id = ?'],
    queryParams: ['3'],
    includeStoreStats: true
  })
  assert.equal(calls.length, 2)
  assert.ok(calls.every(call => call.params === calls[0].params))
  assert.ok(calls.every(call => call.sql.includes('WHERE 1=1 AND store_id = ?')))
  assert.equal(result.stats.total_count, '2')
  assert.equal(result.storeStats[0].store_id, 3)
})
