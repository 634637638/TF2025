'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const Controller = require('../src/controllers/subsidy-filter-options.controller')
const Service = require('../src/services/subsidy-filter-options.service')
const Repository = require('../src/repositories/subsidy-filter-options.repository')

const routeSource = fs.readFileSync(path.join(__dirname, '../src/routes/subsidy.js'), 'utf8')

test('subsidy filter options route keeps auth, permission, cache and controller delegation', () => {
  assert.match(routeSource, /router\.get\('\/filter-options', unifiedAuth, requirePermission\('subsidy:view'\), cacheMiddleware\(\{ ttl: CACHE_TTL\.LONG \}\), subsidyFilterOptionsController\.getFilterOptions\.bind\(subsidyFilterOptionsController\)\)/)
})

test('subsidy filter options controller preserves success and error response contracts', async () => {
  const errors = []
  const controller = new Controller({
    service: { async getFilterOptions(userId) {
      if (userId === 9) throw new Error('database unavailable')
      return { brands: ['A'] }
    } },
    logger: { error(...args) { errors.push(args) } }
  })
  const success = { json(body) { this.body = body; return this } }
  await controller.getFilterOptions({ user: { id: 8 } }, success)
  assert.deepEqual(success.body, {
    success: true,
    message: '获取筛选选项成功',
    data: { brands: ['A'] }
  })

  const failure = {
    status(code) { this.statusCode = code; return this },
    json(body) { this.body = body; return this }
  }
  await controller.getFilterOptions({ user: { id: 9 } }, failure)
  assert.equal(failure.statusCode, 500)
  assert.deepEqual(failure.body, {
    success: false,
    message: '获取筛选选项失败',
    error: 'database unavailable'
  })
  assert.equal(errors.length, 1)
})

test('subsidy filter options service omits fields hidden by the user field policy', async () => {
  const service = new Service({
    masking: { async getUserFieldPermissions(userId, moduleKey) {
      assert.equal(userId, 42)
      assert.equal(moduleKey, 'subsidy_subsidyview')
      return { hiddenFields: ['device_info.model', 'store_info.store_name'] }
    } },
    repository: { async getFilterOptions() {
      return {
        brands: [{ phone_brand: 'A' }],
        models: [{ phone_model: 'M' }],
        colors: [{ phone_color: 'C' }],
        memories: [{ phone_memory: '256G' }],
        stores: [{ store_id: 3, store_name: '门店' }]
      }
    } }
  })

  assert.deepEqual(await service.getFilterOptions(42), {
    brands: ['A'],
    colors: ['C'],
    memories: ['256G']
  })
})

test('subsidy filter options repository performs all ordered distinct reads', async () => {
  const queries = []
  const repository = new Repository({ getDb: () => ({
    async execute(sql) {
      queries.push(sql)
      return [[]]
    }
  }) })
  assert.deepEqual(await repository.getFilterOptions(), {
    brands: [], models: [], colors: [], memories: [], stores: []
  })
  assert.equal(queries.length, 5)
  for (const column of ['phone_brand', 'phone_model', 'phone_color', 'phone_memory', 'store_id, store_name']) {
    assert.ok(queries.some(sql => sql.includes(`SELECT DISTINCT ${column}`)))
  }
  assert.ok(queries.every(sql => /ORDER BY/.test(sql)))
})
