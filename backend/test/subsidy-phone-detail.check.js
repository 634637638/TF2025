'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const Controller = require('../src/controllers/subsidy-phone-detail.controller')
const Service = require('../src/services/subsidy-phone-detail.service')
const Repository = require('../src/repositories/subsidy-phone-detail.repository')

const routeSource = fs.readFileSync(path.join(__dirname, '../src/routes/subsidy.js'), 'utf8')
const makeResponse = () => ({
  status(code) { this.statusCode = code; return this },
  json(body) { this.body = body; return this }
})

test('phone detail route retains auth, permission, cache and delegates to controller', () => {
  assert.match(routeSource, /router\.get\('\/phone-detail\/:phoneId', unifiedAuth, requirePermission\('subsidy:view'\), cacheMiddleware\(\{ ttl: CACHE_TTL\.SHORT \}\), subsidyPhoneDetailController\.getByPhoneId\.bind\(subsidyPhoneDetailController\)\)/)
})

test('phone detail controller validates IDs and preserves not-found and response contracts', async () => {
  const controller = new Controller({ service: { async getByPhoneId(id) {
    if (id === '404') return null
    if (id === '405') return { requires_sale: true }
    return { phone_id: 4 }
  } }, logger: { error() {} } })
  const invalid = makeResponse()
  await controller.getByPhoneId({ params: { phoneId: 'abc' } }, invalid)
  assert.equal(invalid.statusCode, 400)
  assert.equal(invalid.body.message, '设备ID无效')

  const missing = makeResponse()
  await controller.getByPhoneId({ params: { phoneId: '404' } }, missing)
  assert.equal(missing.statusCode, 404)

  const unsold = makeResponse()
  await controller.getByPhoneId({ params: { phoneId: '405' } }, unsold)
  assert.equal(unsold.body.message, '设备未销售，无法申请国补')

  const success = makeResponse()
  await controller.getByPhoneId({ params: { phoneId: '4' } }, success)
  assert.deepEqual(success.body, { success: true, message: '获取详情成功', data: { phone_id: 4 } })
})

test('phone detail service preserves sale absence and subsidy eligibility calculations', async () => {
  let sale = null
  let subsidy = null
  const service = new Service({ repository: {
    async findSoldPhoneById() { return { phone_id: 4, sale_price: '6000', brand: 'B' } },
    async findSaleByPhoneId() { return sale },
    async findSubsidyByPhoneId() { return subsidy }
  } })
  assert.equal((await service.getByPhoneId('4')).requires_sale, true)

  sale = { sale_id: 9, customer_name: null }
  const eligible = await service.getByPhoneId('4')
  assert.equal(eligible.subsidy_amount, 500)
  assert.equal(eligible.eligible, true)
  assert.equal(eligible.customer_name, '')
  assert.equal(eligible.existing_subsidy, null)

  subsidy = { id: 2, apply_status: 'pending', subsidy_amount: 500 }
  const overLimit = await service.getByPhoneId('4')
  assert.deepEqual(overLimit.existing_subsidy, subsidy)
  assert.match(overLimit.eligible_reason, /已达上限/)
})

test('phone detail repository binds phone IDs for each query', async () => {
  const calls = []
  const database = { async execute(sql, params) {
    calls.push({ sql, params })
    return [[{ phone_id: 4 }]]
  } }
  const repository = new Repository({ getDb: () => database })
  await repository.findSoldPhoneById('4')
  await repository.findSaleByPhoneId('4')
  await repository.findSubsidyByPhoneId('4')
  assert.deepEqual(calls.map(call => call.params), [['4'], ['4'], ['4']])
  assert.ok(calls.every(call => /\?/.test(call.sql)))
})
