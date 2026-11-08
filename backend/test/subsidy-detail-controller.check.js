'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const Controller = require('../src/controllers/subsidy-detail.controller')
const Service = require('../src/services/subsidy-detail.service')
const Repository = require('../src/repositories/subsidy-detail.repository')

const routeSource = fs.readFileSync(path.join(__dirname, '../src/routes/subsidy.js'), 'utf8')

const makeResponse = () => ({
  status(code) { this.statusCode = code; return this },
  json(body) { this.body = body; return this }
})

test('subsidy detail route preserves authentication, permission, cache and controller order', () => {
  assert.match(routeSource, /router\.get\('\/:id', unifiedAuth, requirePermission\('subsidy:view'\), cacheMiddleware\(\{ ttl: CACHE_TTL\.SHORT \}\), subsidyDetailController\.getById\.bind\(subsidyDetailController\)\)/)
})

test('subsidy detail service formats values, signs photos, builds handler data and masks fields', async () => {
  const masked = []
  const photoCalls = []
  const loggerCalls = []
  const service = new Service({
    repository: { async findById() {
      return {
        sale_price: '10.50', subsidy_amount: '2.25', subsidy_rate: '0.2',
        sale_time_formatted: '2026-11-08', subsidy_photos: '["/uploads/subsidy/a.jpg"]',
        has_different_handler: 1, handler_name: 'A', handler_phone: '123', handler_idcard: 'ID'
      }
    } },
    mapPhotos(photos, userId) { photoCalls.push({ photos, userId }); return ['/signed'] },
    maskingService: { maskDataItem(item, userId, module) {
      masked.push({ item: { ...item }, userId, module })
      return { ...item, customer_phone: 'masked' }
    } },
    logger: { error(...args) { loggerCalls.push(args) } }
  })

  const detail = await service.getById('4', 9)
  assert.equal(detail.sale_price, 10.5)
  assert.equal(detail.subsidy_amount, 2.25)
  assert.equal(detail.subsidy_rate, 0.2)
  assert.equal(detail.sale_time, '2026-11-08')
  assert.equal('sale_time_formatted' in detail, false)
  assert.deepEqual(detail.subsidy_photos, ['/signed'])
  assert.deepEqual(detail.handler_info, { handler_name: 'A', handler_phone: '123', handler_idcard: 'ID' })
  assert.deepEqual(photoCalls, [{ photos: ['/uploads/subsidy/a.jpg'], userId: 9 }])
  assert.equal(masked[0].module, 'subsidy_subsidyview')
  assert.equal(detail.customer_phone, 'masked')
  assert.equal(loggerCalls.length, 0)
})

test('subsidy detail service returns null and tolerates malformed stored photos', async () => {
  let record = null
  const errors = []
  const service = new Service({
    repository: { async findById() { return record } },
    maskingService: { maskDataItem(item) { return item } },
    logger: { error(...args) { errors.push(args) } }
  })
  assert.equal(await service.getById('missing', 9), null)

  record = { subsidy_photos: '{invalid', has_different_handler: 0 }
  const detail = await service.getById('4', 9)
  assert.deepEqual(detail.subsidy_photos, [])
  assert.equal(detail.handler_info, null)
  assert.equal(errors.length, 1)
})

test('subsidy detail controller preserves 404, success and error responses', async () => {
  const controller = new Controller({
    service: { async getById(id, userId) {
      assert.equal(userId, 9)
      if (id === 'missing') return null
      if (id === 'failed') throw new Error('database unavailable')
      return { id }
    } },
    logger: { error() {} }
  })

  const missing = makeResponse()
  await controller.getById({ params: { id: 'missing' }, user: { id: 9 } }, missing)
  assert.equal(missing.statusCode, 404)
  assert.equal(missing.body.message, '国补记录不存在')

  const success = makeResponse()
  await controller.getById({ params: { id: '4' }, user: { id: 9 } }, success)
  assert.deepEqual(success.body, { success: true, message: '获取国补详情成功', data: { id: '4' } })

  const failure = makeResponse()
  await controller.getById({ params: { id: 'failed' }, user: { id: 9 } }, failure)
  assert.equal(failure.statusCode, 500)
  assert.equal(failure.body.error, 'database unavailable')
})

test('subsidy detail repository binds the record ID and returns null for missing rows', async () => {
  const calls = []
  const rows = [[{ id: 4 }], []]
  const repository = new Repository({ getDb: () => ({
    async execute(sql, params) { calls.push({ sql, params }); return [rows.shift()] }
  }) })
  assert.deepEqual(await repository.findById('4'), { id: 4 })
  assert.equal(await repository.findById('missing'), null)
  assert.deepEqual(calls.map(call => call.params), [['4'], ['missing']])
  assert.ok(calls.every(call => /WHERE id = \?/.test(call.sql)))
})
