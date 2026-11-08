'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const SalesInventoryReportController = require('../src/controllers/sales-inventory-report.controller')
const SalesInventoryReportRepository = require('../src/repositories/sales-inventory-report.repository')
const SalesInventoryReportService = require('../src/services/sales-inventory-report.service')

const read = relativePath => fs.readFileSync(path.join(__dirname, relativePath), 'utf8')

const createRepositoryStub = overrides => ({
  async findReferenceId() { return null },
  async findModelIds() { return [] },
  async findExactId() { return null },
  async getSummary() { return [] },
  async getDetail() { return [] },
  ...overrides
})

test('sales inventory report routes preserve authentication and permission while delegating to controller', () => {
  const route = read('../src/routes/sales.js')
  assert.match(route, /router\.get\('\/inventory-summary', unifiedAuth, requirePermission\('sales:view'\), salesInventoryReportController\.getSummary\.bind\(salesInventoryReportController\)\)/)
  assert.match(route, /router\.get\('\/inventory-detail', unifiedAuth, requirePermission\('sales:view'\), salesInventoryReportController\.getDetail\.bind\(salesInventoryReportController\)\)/)
})

test('sales inventory summary validates dates and positive IDs before calling service', async () => {
  let calls = 0
  const controller = new SalesInventoryReportController({
    service: {
      async getSummary() { calls += 1; return [{ quantity: 2 }] },
      async getDetail() { return { rows: [] } }
    },
    logger: { error() {} }
  })
  const badRequest = () => ({
    status(code) { this.statusCode = code; return this },
    json(body) { this.body = body; return this }
  })
  for (const query of [
    { start_date: '2026/11/07' },
    { end_date: '2026-11-08', start_date: '2026-11-09' },
    { store_id: '0' },
    { supplier_id: '2x' }
  ]) {
    const response = badRequest()
    await controller.getSummary({ query }, response)
    assert.equal(response.statusCode, 400)
  }
  assert.equal(calls, 0)

  const success = { json(body) { this.body = body; return this } }
  await controller.getSummary({ query: { start_date: '2026-11-01', end_date: '2026-11-07' } }, success)
  assert.deepEqual(success.body, { success: true, message: '获取库存统计成功', data: [{ quantity: 2 }] })
  assert.equal(calls, 1)
})

test('sales inventory detail validates pagination and preserves required/missing brand responses', async () => {
  let calls = 0
  const controller = new SalesInventoryReportController({
    service: {
      async getSummary() { return [] },
      async getDetail(query, pageSize) { calls += 1; return { rows: [{ id: pageSize, brand: query.brand }] } }
    },
    logger: { error() {} }
  })
  const response = () => ({
    status(code) { this.statusCode = code; return this },
    json(body) { this.body = body; return this }
  })

  const oversized = response()
  await controller.getDetail({ query: { brand: '品牌', page_size: '501' } }, oversized)
  assert.equal(oversized.statusCode, 400)

  const noBrand = response()
  await controller.getDetail({ query: {} }, noBrand)
  assert.equal(noBrand.statusCode, 400)
  assert.equal(calls, 0)

  const result = response()
  await controller.getDetail({ query: { brand: '品牌' } }, result)
  assert.deepEqual(result.body, {
    success: true,
    data: [{ id: 500, brand: '品牌' }],
    message: '获取库存明细成功'
  })
  assert.equal(calls, 1)
})

test('sales inventory report service builds bound filters and resolves exact detail IDs within brand', async () => {
  const calls = []
  const repository = createRepositoryStub({
    async findReferenceId(resource, value) { calls.push(['reference', resource, value]); return 20 },
    async findModelIds(value) { calls.push(['models', value]); return [31, 32] },
    async findExactId(resource, value, brandId) {
      calls.push(['exact', resource, value, brandId])
      return resource === 'brand' ? 10 : resource === 'model' ? 11 : null
    },
    async getSummary(query) { calls.push(['summary', query]); return [] },
    async getDetail(query) { calls.push(['detail', query]); return [] }
  })
  const service = new SalesInventoryReportService({ repository })

  await service.getSummary({
    store_id: '4', supplier_id: '8', is_new: '1',
    start_date: '2026-11-01', end_date: '2026-11-07',
    brand: ' Apple ', model: 'iPhone', color: '黑色', memory: '256G'
  })
  const summary = calls.find(([name]) => name === 'summary')[1]
  assert.ok(summary.whereConditions.includes('DATE(p.inventory_time) BETWEEN ? AND ?'))
  assert.ok(summary.whereConditions.includes('p.model_id IN (?,?)'))
  assert.deepEqual(summary.queryParams, [
    'sold', 'peer_transfer', 'supplier_proxy', 4, 8, 1,
    '2026-11-01', '2026-11-07', 20, 20, 20, 31, 32
  ])

  calls.length = 0
  await service.getDetail({ brand: 'Apple', model: 'Model A', color: 'Black', memory: '128G' }, 25)
  const exactCalls = calls.filter(([name]) => name === 'exact')
  assert.deepEqual(exactCalls, [
    ['exact', 'brand', 'Apple', undefined],
    ['exact', 'model', 'Model A', 10],
    ['exact', 'color', 'Black', 10],
    ['exact', 'memory', '128G', 10]
  ])
  const detail = calls.find(([name]) => name === 'detail')[1]
  assert.ok(detail.whereConditions.includes('p.color_id IS NULL'))
  assert.ok(detail.whereConditions.includes('p.memory_id IS NULL'))
  assert.equal(detail.pageSize, 25)
})

test('sales inventory report repository binds reference filters and detail page size', async () => {
  const calls = []
  const database = {
    async execute(sql, params) { calls.push({ method: 'execute', sql, params }); return [[{ id: 2 }]] },
    async query(sql, params) { calls.push({ method: 'query', sql, params }); return [[{ id: 3 }]] }
  }
  const repository = new SalesInventoryReportRepository({ getDb: () => database })
  assert.equal(await repository.findExactId('model', 'Model A', 9), 2)
  const rows = await repository.getDetail({ whereConditions: ['p.brand_id = ?'], queryParams: [9], pageSize: 50 })

  assert.deepEqual(rows, [{ id: 3 }])
  assert.equal(calls[0].method, 'execute')
  assert.deepEqual(calls[0].params, ['Model A', 9])
  assert.equal(calls[1].method, 'query')
  assert.match(calls[1].sql, /p\.inventory_time AS inventory_time/)
  assert.match(calls[1].sql, /ORDER BY inventory_days DESC[\s\S]*LIMIT \?/)
  assert.deepEqual(calls[1].params, [9, 50])
})
