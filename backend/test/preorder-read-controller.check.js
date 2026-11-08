'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const response = () => ({
  status(code) {
    this.statusCode = code
    return this
  },
  json(body) {
    this.body = body
    return this
  }
})

test('preorder stats and options preserve route permissions and delegate to controller', () => {
  const route = fs.readFileSync(path.join(__dirname, '../src/routes/preorders.js'), 'utf8')
  assert.match(route, /router\.get\('\/', unifiedAuth, requirePermission\('preorders:view'\), preorderReadController\.list\.bind\(preorderReadController\)\)/)
  assert.match(route, /router\.get\('\/stats', unifiedAuth, requirePermission\('preorders:view'\), preorderReadController\.stats\.bind\(preorderReadController\)\)/)
  assert.match(route, /router\.get\('\/options', unifiedAuth, requireAnyPermission\(\['preorders:view', 'preorders:create'\]\), preorderReadController\.options\.bind\(preorderReadController\)\)/)
  assert.match(route, /router\.get\('\/:id', unifiedAuth, requirePermission\('preorders:view'\), preorderReadController\.getById\.bind\(preorderReadController\)\)/)
  assert.match(route, /router\.get\('\/matchable', unifiedAuth, requirePermission\('preorders:match'\), preorderReadController\.matchable\.bind\(preorderReadController\)\)/)
  assert.match(route, /router\.get\('\/:id\/matchable-phones', unifiedAuth, requirePermission\('preorders:match'\), preorderReadController\.matchablePhones\.bind\(preorderReadController\)\)/)
})

test('preorder read service normalizes stats and returns canonical shared option data', async () => {
  const PreorderReadService = require('../src/services/preorder-read.service')
  const optionsCalled = []
  const service = new PreorderReadService({
    repository: {
      async getStats() { return { pending_count: '3', matched_count: null, delivered_count: '2', cancelled_count: 'bad' } },
      async getStores() { return [{ id: 4, name: '一店', sort_order: 1 }] }
    },
    async listReferenceOptions(resource) {
      optionsCalled.push(resource)
      return [{ id: resource }]
    }
  })
  assert.deepEqual(await service.getStats(), { pending_count: 3, matched_count: 0, delivered_count: 2, cancelled_count: 0 })
  assert.deepEqual(await service.getOptions(), {
    stores: [{ id: 4, name: '一店', sort_order: 1 }],
    brands: [{ id: 'brands' }],
    models: [{ id: 'models' }],
    colors: [{ id: 'colors' }],
    memories: [{ id: 'memories' }]
  })
  assert.deepEqual(optionsCalled, ['brands', 'models', 'colors', 'memories'])
})

test('preorder list service validates filters and preserves default and bounded pagination', async () => {
  const PreorderReadService = require('../src/services/preorder-read.service')
  const calls = []
  const service = new PreorderReadService({
    repository: {
      async list(query) {
        calls.push(query)
        return { records: [{ id: 8 }], total: '51' }
      }
    }
  })

  const result = await service.list({
    page: '2', page_size: '150', status: 'pending', customer_id: '7', store_id: '3',
    search: '  张三  ', start_date: '2026-11-01', end_date: '2026-11-07'
  })
  assert.deepEqual(calls[0], {
    filters: {
      status: 'pending', customer_id: '7', store_id: 3, brand_id: null, model_id: null,
      color_id: null, memory_id: null, search: '张三', start_date: '2026-11-01', end_date: '2026-11-07'
    },
    page: 2,
    pageSize: 100
  })
  assert.deepEqual(result.pagination, {
    page: 2, page_size: 100, total: 51, total_pages: 1, has_next: false, has_prev: true
  })
  assert.deepEqual(await service.list({ start_date: '2026-02-30' }), { error: '日期格式必须为 YYYY-MM-DD' })
  assert.deepEqual(await service.list({ start_date: '2026-11-08', end_date: '2026-11-07' }), { error: '开始日期不能晚于结束日期' })
  assert.deepEqual(await service.list({ status: 'unknown' }), { error: '预定状态无效' })
  assert.deepEqual(await service.list({ brand_id: '0' }), { error: 'brand_id 编号无效' })
  const defaults = await service.list({})
  assert.deepEqual(calls.at(-1), {
    filters: {
      status: null, customer_id: null, store_id: null, brand_id: null, model_id: null,
      color_id: null, memory_id: null, search: null, start_date: null, end_date: null
    },
    page: 1,
    pageSize: 20
  })
  assert.equal(defaults.pagination.page_size, 20)
})

test('preorder read repository preserves status aggregation, store filtering, and connection release', async () => {
  const PreorderReadRepository = require('../src/repositories/preorder-read.repository')
  const calls = []
  let releaseCount = 0
  const repository = new PreorderReadRepository({
    database: () => ({
      async getConnection() {
        return {
          async execute(sql) {
            calls.push(sql)
            return [[{ pending_count: '1', matched_count: '2', delivered_count: '3', cancelled_count: '4' }]]
          },
          async query(sql) {
            calls.push(sql)
            return [[{ id: 2, name: '一店' }]]
          },
          release() { releaseCount += 1 }
        }
      }
    })
  })
  await repository.getStats()
  await repository.getStores()
  assert.match(calls[0], /status = 'pending'[\s\S]*status = 'arrived'[\s\S]*status = 'completed'[\s\S]*status = 'cancelled'/)
  assert.match(calls[1], /FROM stores WHERE status = 1 ORDER BY sort_order ASC, name ASC, id ASC/)
  assert.equal(releaseCount, 2)
})

test('preorder list controller masks rows and preserves validation and response contracts', async () => {
  const PreorderReadController = require('../src/controllers/preorder-read.controller')
  const req = { query: { page: '1' }, user: { id: 8 } }
  const controller = new PreorderReadController({
    service: { async list(query) { assert.equal(query, req.query); return { records: [{ id: 1 }], pagination: { page: 1 } } } },
    async maskList(records, request) {
      assert.equal(request, req)
      return records.map(record => ({ id: record.id, hidden: true }))
    }
  })
  const result = response()
  await controller.list(req, result)
  assert.deepEqual(result.body.data, { records: [{ id: 1, hidden: true }], pagination: { page: 1 } })

  const invalidController = new PreorderReadController({ service: { async list() { return { error: '预定状态无效' } } } })
  const invalid = response()
  await invalidController.list(req, invalid)
  assert.equal(invalid.statusCode, 400)
  assert.equal(invalid.body.message, '预定状态无效')
})

test('preorder list repository binds matching filters and pagination in count and record queries', async () => {
  const PreorderReadRepository = require('../src/repositories/preorder-read.repository')
  const calls = []
  let released = false
  const repository = new PreorderReadRepository({
    database: () => ({
      async getConnection() {
        return {
          async execute(sql, params) {
            calls.push({ sql, params })
            return sql.includes('COUNT(*)') ? [[{ total: '4' }]] : [[{ id: 8 }]]
          },
          release() { released = true }
        }
      }
    })
  })
  const filters = {
    status: null, customer_id: '9', store_id: 3, brand_id: null, model_id: 2,
    color_id: null, memory_id: null, search: '张三', start_date: '2026-11-01', end_date: '2026-11-07'
  }

  const result = await repository.list({ filters, page: 2, pageSize: 20 })
  assert.deepEqual(result, { records: [{ id: 8 }], total: '4' })
  assert.match(calls[0].sql, /p\.status IN \('pending', 'arrived', 'cancelled'\)/)
  assert.match(calls[0].sql, /p\.store_id = \?/)
  assert.match(calls[1].sql, /LEFT JOIN users creator/)
  assert.match(calls[1].sql, /ORDER BY p\.status = 'pending' DESC, p\.created_at DESC/)
  assert.match(calls[1].sql, /LIMIT \? OFFSET \?\s*$/)
  assert.deepEqual(calls[0].params, ['9', 3, 2, '%张三%', '%张三%', '%张三%', '%张三%', '%张三%', '%张三%', '2026-11-01', '2026-11-07'])
  assert.deepEqual(calls[1].params, [...calls[0].params, '20', '20'])
  assert.equal(released, true)
})

test('preorder read controller preserves field masking, response data, and server errors', async () => {
  const PreorderReadController = require('../src/controllers/preorder-read.controller')
  const stats = { pending_count: 5, matched_count: 1, delivered_count: 2, cancelled_count: 0 }
  let maskContext
  const controller = new PreorderReadController({
    service: {
      async getById(id) { assert.equal(id, '18'); return { id: 18, status: 'pending' } },
      async getStats() { return stats },
      async getOptions() { return { stores: [], brands: [], models: [], colors: [], memories: [] } }
    },
    async maskList(rows, req) {
      maskContext = req
      return rows.map(row => ({ id: row.id }))
    },
    async maskStats(value, req) {
      maskContext = req
      return { pending_count: value.pending_count }
    }
  })
  const req = { user: { id: 18 } }
  const statsResponse = response()
  await controller.stats(req, statsResponse)
  assert.equal(maskContext, req)
  assert.deepEqual(statsResponse.body.data, { pending_count: 5 })
  const detailResponse = response()
  const detailRequest = { ...req, params: { id: '18' } }
  await controller.getById(detailRequest, detailResponse)
  assert.equal(maskContext, detailRequest)
  assert.deepEqual(detailResponse.body.data, { id: 18 })
  const optionsResponse = response()
  await controller.options(req, optionsResponse)
  assert.deepEqual(optionsResponse.body.data, { stores: [], brands: [], models: [], colors: [], memories: [] })

  const failedController = new PreorderReadController({ service: {
    async getStats() { throw new Error('database unavailable') },
    async getOptions() { throw new Error('database unavailable') }
  } })
  const failedResponse = response()
  await failedController.options(req, failedResponse)
  assert.equal(failedResponse.statusCode, 500)
  assert.equal(failedResponse.body.success, false)

  const missingController = new PreorderReadController({ service: { async getById() { return null } } })
  const missingResponse = response()
  await missingController.getById({ params: { id: '404' } }, missingResponse)
  assert.equal(missingResponse.statusCode, 404)
})

test('preorder detail repository selects the approved response fields and releases connection', async () => {
  const PreorderReadRepository = require('../src/repositories/preorder-read.repository')
  const { PREORDER_RESPONSE_FIELDS } = require('../src/config/preorder-response.constants')
  let query
  let released = false
  const expected = { id: 18, status: 'pending', customer_name: '客户' }
  const repository = new PreorderReadRepository({
    database: () => ({
      async getConnection() {
        return {
          async execute(sql, params) {
            query = { sql, params }
            return [[expected]]
          },
          release() { released = true }
        }
      }
    })
  })

  assert.equal(await repository.getById('18'), expected)
  assert.match(query.sql, /LEFT JOIN customers c/)
  assert.match(query.sql, /status_text/)
  assert.match(query.sql, /remaining_amount/)
  for (const field of PREORDER_RESPONSE_FIELDS) assert.match(query.sql, new RegExp(`p\\.${field}`))
  assert.deepEqual(query.params, ['18'])
  assert.equal(released, true)
})

test('matchable preorder search validates required IDs before querying and preserves result masking', async () => {
  const PreorderReadController = require('../src/controllers/preorder-read.controller')
  const calls = []
  const rows = [{ id: 8, status: 'pending' }]
  const req = { query: { brand_id: '1', model_id: '2', color_id: '3', memory_id: '4', store_id: '5' } }
  const controller = new PreorderReadController({
    service: {
      async getMatchablePreorders(filters) {
        calls.push(filters)
        return rows
      }
    },
    async maskList(value, request) {
      assert.equal(request, req)
      return value.map(row => ({ id: row.id }))
    }
  })
  const result = response()
  await controller.matchable(req, result)
  assert.deepEqual(calls, [{ brand_id: '1', model_id: '2', color_id: '3', memory_id: '4', store_id: '5' }])
  assert.deepEqual(result.body.data, [{ id: 8 }])

  const invalidResponse = response()
  await controller.matchable({ query: { brand_id: '1', model_id: '2', color_id: '3' } }, invalidResponse)
  assert.equal(invalidResponse.statusCode, 400)
  assert.equal(calls.length, 1)
})

test('matchable preorder repository binds spec and store filters and releases connection', async () => {
  const PreorderReadRepository = require('../src/repositories/preorder-read.repository')
  const calls = []
  let released = false
  const repository = new PreorderReadRepository({
    database: () => ({
      async getConnection() {
        return {
          async execute(sql, params) {
            calls.push({ sql, params })
            return [[{ id: 8 }]]
          },
          release() { released = true }
        }
      }
    })
  })
  await repository.getMatchablePreorders({ brand_id: '1', model_id: '2', color_id: '3', memory_id: '4', store_id: '5' })
  assert.match(calls[0].sql, /p\.status = 'pending'/)
  assert.match(calls[0].sql, /p\.store_id IS NULL OR p\.store_id = \?/)
  assert.match(calls[0].sql, /ORDER BY p\.created_at ASC[\s\S]*LIMIT 10/)
  assert.deepEqual(calls[0].params, ['1', '2', '3', '4', '5'])
  assert.equal(released, true)
})

test('matchable phone lookup enforces preorder status before querying inventory and releases its connection', async () => {
  const PreorderReadService = require('../src/services/preorder-read.service')
  const queries = []
  let releaseCount = 0
  const makeConnection = preorder => ({
    async execute(sql, params) {
      queries.push({ sql, params })
      if (sql.includes('FROM preorders')) return [[preorder].filter(Boolean)]
      return [[{ id: 22, is_current: 1 }]]
    },
    release() { releaseCount += 1 }
  })
  const preorder = {
    id: 9,
    status: 'arrived',
    matched_phone_id: 22,
    brand_id: 1,
    model_id: 2,
    color_id: 3,
    memory_id: 4,
    is_new: 0
  }
  let currentPreorder = preorder
  const service = new PreorderReadService({ repository: {
    async withConnection(callback) {
      const connection = makeConnection(currentPreorder)
      try {
        return await callback(connection)
      } finally {
        connection.release()
      }
    },
    async getPreorderForMatching(_connection, id) {
      queries.push({ id })
      return currentPreorder
    },
    async getCandidatePhones(connection, record) {
      const [phones] = await connection.execute('SELECT candidate phones', [record.id])
      return phones
    }
  } })

  const result = await service.getMatchablePhones('9')
  assert.deepEqual(result, { phones: [{ id: 22, is_current: 1 }] })
  assert.equal(queries[0].id, '9')
  assert.equal(queries[1].params[0], 9)
  assert.equal(releaseCount, 1)

  currentPreorder = { ...preorder, status: 'completed' }
  const invalid = await service.getMatchablePhones('9')
  assert.deepEqual(invalid, { error: 'invalid_status' })
  assert.equal(releaseCount, 2)
})

test('matchable phone controller preserves not-found, invalid-status, and masked success responses', async () => {
  const PreorderReadController = require('../src/controllers/preorder-read.controller')
  const outputs = []
  const controller = new PreorderReadController({
    service: { async getMatchablePhones(id) { return outputs.shift() || { id } } },
    async maskList(phones) { return phones.map(phone => ({ id: phone.id })) }
  })

  const missing = response()
  outputs.push({ error: 'not_found' })
  await controller.matchablePhones({ params: { id: '404' } }, missing)
  assert.equal(missing.statusCode, 404)

  const invalid = response()
  outputs.push({ error: 'invalid_status' })
  await controller.matchablePhones({ params: { id: '9' } }, invalid)
  assert.equal(invalid.statusCode, 400)

  const success = response()
  outputs.push({ phones: [{ id: 22, imei: 'hidden-by-mask' }] })
  await controller.matchablePhones({ params: { id: '9' } }, success)
  assert.deepEqual(success.body.data, [{ id: 22 }])
})
