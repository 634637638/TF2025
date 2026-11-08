'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const SalesAvailablePhonesService = require('../src/services/sales-available-phones.service')
const SalesAvailablePhonesRepository = require('../src/repositories/sales-available-phones.repository')
const SalesAvailablePhonesController = require('../src/controllers/sales-available-phones.controller')

const createRepositoryStub = overrides => ({
  async findReferenceId() { return null },
  async findBrandsByName() { return [] },
  async findModelsByName() { return [] },
  async findPreorderDelivery() { return null },
  async getAvailablePhones() { return { phones: [], total: 0, values: {} } },
  async getAvailablePhonesForExport() { return [] },
  async getStats() {
    return {
      totalValue: { total_value: 0 },
      todaySold: { today_sold: 0 },
      profitMargin: { count: 0, total_profit_margin: 0 }
    }
  },
  ...overrides
})

test('available phone filters preserve status prefix, reference lookup, and parameter order', async () => {
  const calls = []
  const repository = createRepositoryStub({
    async findReferenceId(resource, value) {
      calls.push([resource, value])
      return resource === 'brand' ? null : 42
    },
    async findBrandsByName() { return [{ id: 7, name: '品牌' }] },
    async findModelsByName(value, exact) {
      calls.push(['model', value, exact])
      return [{ id: 8, name: '型号' }, { id: 9, name: '型号' }]
    },
  })
  const service = new SalesAvailablePhonesService({ repository })
  const filters = await service.buildFilters({
    search: '123',
    store_id: '3',
    brand: ' 品牌 ',
    model: ' 型号 ',
    color: '蓝',
    memory: '128G',
    sale_status: 'reserved',
    salesman_id: '11',
    price_range: '100-200'
  }, { preorderDeliveryPhoneId: 55 })

  assert.equal(filters.whereConditions[0], "COALESCE(p.status, '') NOT IN (?, ?, ?)")
  assert.deepEqual(filters.queryParams.slice(0, 3), ['sold', 'peer_transfer', 'supplier_proxy'])
  assert.deepEqual(filters.queryParams.slice(3), [55, '%123%', '%123%', '%123%', '123', '%123%', '%123%', 123, '3', 7, 8, 9, 42, 42, '11', 100, 200])
  assert.ok(filters.whereConditions.some(condition => condition.includes("p.status IN ('in_stock', 'reserved')")))
  assert.ok(filters.whereConditions.some(condition => condition.includes('p.model_id IN (?,?)')))
  assert.ok(filters.whereConditions.some(condition => condition.includes("p.status = 'reserved'")))
  assert.deepEqual(calls, [['brand', ' 品牌 '], ['model', '型号', false], ['color', '蓝'], ['memory', '128G']])
})

test('available phone service validates preorder delivery and normalizes list results', async () => {
  const calls = []
  const repository = createRepositoryStub({
    async findPreorderDelivery(id) {
      calls.push(['preorder', id])
      return { status: 'arrived', matched_phone_id: 81 }
    },
    async getAvailablePhones(options) {
      calls.push(['list', options])
      return {
        phones: [{ sale_price: '250', purchase_cost: '180', is_new: 1 }],
        total: 1,
        values: { total_value: '180' }
      }
    }
  })
  const service = new SalesAvailablePhonesService({ repository })
  const result = await service.getAvailablePhones({ store_id: '4' }, { page: 2, pageSize: 25, preorderId: 17 })

  assert.deepEqual(calls[0], ['preorder', 17])
  assert.deepEqual(calls[1][1].queryParams.slice(-2), [81, '4'])
  assert.equal(calls[1][1].page, 2)
  assert.equal(calls[1][1].pageSize, 25)
  assert.deepEqual(result, {
    phones: [{ sale_price: 250, purchase_cost: 180, is_new: true }],
    total: 1,
    values: { total_value: '180' }
  })

  for (const [preorder, statusCode] of [
    [null, 404],
    [{ status: 'pending', matched_phone_id: 81 }, 400],
    [{ status: 'arrived', matched_phone_id: null }, 400]
  ]) {
    const invalidService = new SalesAvailablePhonesService({
      repository: createRepositoryStub({ async findPreorderDelivery() { return preorder } })
    })
    await assert.rejects(
      invalidService.getAvailablePhones({}, { page: 1, pageSize: 20, preorderId: 17 }),
      error => error.statusCode === statusCode
    )
  }
})

test('available phone stats repository keeps three query scopes and today parameter bindings', async () => {
  const calls = []
  const repository = new SalesAvailablePhonesRepository({
    getDb: () => ({
      async execute(sql, params) {
        calls.push({ sql, params })
        if (calls.length === 1) return [[{ total_value: '725.5' }]]
        if (calls.length === 2) return [[{ today_sold: '3' }]]
        return [[{ count: '2', total_profit_margin: '50' }]]
      }
    })
  })
  const todayStart = new Date(2026, 10, 7)
  const whereConditions = ['COALESCE(p.status, \'\') NOT IN (?, ?, ?)', 'p.store_id = ?', 'p.brand_id = ?']
  const queryParams = ['sold', 'peer_transfer', 'supplier_proxy', 3, 7]
  const stats = await repository.getStats({
    whereConditions,
    queryParams,
    todayQueryParams: [3, 7],
    todayStart
  })

  assert.equal(calls.length, 3)
  assert.deepEqual(calls[0].params, queryParams)
  assert.deepEqual(calls[1].params, [3, 7, todayStart])
  assert.match(calls[0].sql, /SUM\(p\.purchase_cost\)/)
  assert.match(calls[1].sql, /p\.status = 'sold'/)
  assert.match(calls[1].sql, /p\.sale_time >= \?/)
  assert.doesNotMatch(calls[1].sql, /NOT IN/)
  assert.match(calls[2].sql, /p\.sale_price > 0 AND p\.purchase_cost > 0/)
  assert.deepEqual(stats, {
    totalValue: { total_value: '725.5' },
    todaySold: { today_sold: '3' },
    profitMargin: { count: '2', total_profit_margin: '50' }
  })
})

test('available phone list repository binds filters and keeps pagination bounded by the controller', async () => {
  const calls = []
  const repository = new SalesAvailablePhonesRepository({
    getDb: () => ({
      async execute(sql, params) {
        calls.push({ sql, params })
        if (calls.length === 1) return [[{ id: 3 }]]
        if (calls.length === 2) return [[{ total: '1' }]]
        return [[{ total_value: '50', new_value: '50', used_value: '0' }]]
      }
    })
  })
  const result = await repository.getAvailablePhones({
    whereConditions: ["p.store_id = ?", "p.imei LIKE ?"],
    queryParams: [7, '%123%'],
    page: 2,
    pageSize: 25
  })

  assert.equal(calls.length, 3)
  assert.match(calls[0].sql, /LIMIT 25 OFFSET 25/)
  assert.match(calls[0].sql, /ORDER BY p\.inventory_time DESC/)
  assert.match(calls[1].sql, /WHERE p\.store_id = \? AND p\.imei LIKE \?/)
  assert.deepEqual(calls.map(call => call.params), [[7, '%123%'], [7, '%123%'], [7, '%123%']])
  assert.deepEqual(result, {
    phones: [{ id: 3 }],
    total: 1,
    values: { total_value: '50', new_value: '50', used_value: '0' }
  })
})

test('available phone stats service normalizes results and uses Beijing midnight', async () => {
  const today = new Date('2026-11-07T06:30:00.000Z')
  let received
  const service = new SalesAvailablePhonesService({
    now: () => new Date(today),
    repository: createRepositoryStub({
      async findReferenceId() { return null },
      async getStats(options) {
        received = options
        return {
          totalValue: { total_value: '1200.25' },
          todaySold: { today_sold: '4' },
          profitMargin: { count: '2', total_profit_margin: '30' }
        }
      }
    })
  })
  const result = await service.getStats({ store_id: '5' })
  assert.deepEqual(result, { total_value: 1200.25, today_sold: 4, avg_profit_margin: 15 })
  assert.equal(received.todayStart, '2026-11-07 00:00:00')
  assert.deepEqual(received.todayQueryParams, ['5'])
})

test('available phone stats route keeps auth and permission, controller preserves responses', async () => {
  const fs = require('node:fs')
  const path = require('node:path')
  const route = fs.readFileSync(path.join(__dirname, '../src/routes/sales.js'), 'utf8')
  assert.match(route, /router\.get\('\/phones\/available\/stats', unifiedAuth, requirePermission\('sales:view'\), salesAvailablePhonesController\.getStats\.bind\(salesAvailablePhonesController\)\)/)

  const controller = new SalesAvailablePhonesController({ service: {
    async getStats() { return { total_value: 25, today_sold: 1, avg_profit_margin: 10 } },
    async getAvailablePhones() { return { phones: [], total: 0, values: {} } },
    async getAvailablePhonesForExport() { return [] }
  } })
  const response = { json(body) { this.body = body; return this } }
  await controller.getStats({ query: { store_id: 4 } }, response)
  assert.deepEqual(response.body, {
    success: true,
    message: '获取统计数据成功',
    data: { total_value: 25, today_sold: 1, avg_profit_margin: 10 }
  })
})

test('available phone list validates page bounds and returns canonical pagination and stats', async () => {
  const calls = []
  const controller = new SalesAvailablePhonesController({
    service: {
      async getStats() { return {} },
      async getAvailablePhones(...args) {
        calls.push(args)
        return { phones: [{ id: 1 }], total: 21, values: { total_value: '500' } }
      },
      async getAvailablePhonesForExport() { return [] }
    }
  })
  const invalid = {
    status(code) { this.statusCode = code; return this },
    json(body) { this.body = body; return this }
  }
  await controller.getAvailablePhones({ query: { page: '1', page_size: '501' } }, invalid)
  assert.equal(invalid.statusCode, 400)
  assert.equal(calls.length, 0)

  const response = { json(body) { this.body = body; return this } }
  await controller.getAvailablePhones({ query: { page: '2', page_size: '20' } }, response)
  assert.deepEqual(calls, [[{ page: '2', page_size: '20' }, { page: 2, pageSize: 20, preorderId: null }]])
  assert.deepEqual(response.body.pagination, {
    page: 2,
    page_size: 20,
    total: 21,
    total_pages: 2,
    has_next: false,
    has_prev: true
  })
  assert.deepEqual(response.body.stats, { total_value: 500, new_value: 0, used_value: 0 })
})

test('available phone export streams an XLSX response with a Beijing date and total header', async () => {
  const controller = new SalesAvailablePhonesController({
    now: () => new Date('2026-11-07T00:30:00.000Z'),
    service: {
      async getStats() { return {} },
      async getAvailablePhones() { return { phones: [], total: 0, values: {} } },
      async getAvailablePhonesForExport() {
        return [{ imei: '123', brand: '品牌', is_new: true, status: 'in_stock' }]
      }
    }
  })
  const headers = {}
  const response = {
    setHeader(name, value) { headers[name] = value },
    send(buffer) { this.body = buffer; return this }
  }
  await controller.exportAvailablePhones({ query: {} }, response)
  assert.match(headers['Content-Type'], /application\/vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet/)
  assert.match(decodeURIComponent(headers['Content-Disposition']), /销售管理_2026-11-07\.xlsx/)
  assert.equal(headers['X-Export-Total'], '1')
  assert.ok(Buffer.isBuffer(response.body))
})

test('available phone stats controller retains the established failure response and logging', async () => {
  const logged = []
  const controller = new SalesAvailablePhonesController({
    service: {
      async getStats() { throw new Error('stats query failed') },
      async getAvailablePhones() { return { phones: [], total: 0, values: {} } },
      async getAvailablePhonesForExport() { return [] }
    },
    logger: { error(...args) { logged.push(args) } }
  })
  const response = {
    status(code) { this.statusCode = code; return this },
    json(body) { this.body = body; return this }
  }
  await controller.getStats({ query: {} }, response)
  assert.equal(response.statusCode, 500)
  assert.deepEqual(response.body, {
    success: false,
    message: '获取统计数据失败',
    error: 'stats query failed'
  })
  assert.equal(logged.length, 1)
})

