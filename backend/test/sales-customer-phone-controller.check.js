'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const SalesCustomerPhoneController = require('../src/controllers/sales-customer-phone.controller')
const SalesCustomerPhoneService = require('../src/services/sales-customer-phone.service')
const SalesCustomerPhoneRepository = require('../src/repositories/sales-customer-phone.repository')

const createResponse = () => ({
  json(body) { this.body = body; return this },
  status(code) { this.statusCode = code; return this }
})

test('sales customer phone route preserves authentication and view permission', () => {
  const route = fs.readFileSync(path.join(__dirname, '../src/routes/sales.js'), 'utf8')
  assert.match(route, /router\.get\('\/customer\/phone\/:phone', unifiedAuth, requirePermission\('sales:view'\), salesCustomerPhoneController\.find\.bind\(salesCustomerPhoneController\)\)/)
})

test('sales customer phone service rejects invalid phone formats without repository access', async () => {
  let lookups = 0
  const service = new SalesCustomerPhoneService({ repository: { async findLatestByPhone() { lookups += 1 } } })
  assert.deepEqual(await service.find('123'), { valid: false, customer: null })
  assert.equal(lookups, 0)
})

test('sales customer phone service returns the latest matching repository row', async () => {
  const customer = { id: 2, name: 'A', phone: '13800000000' }
  const received = []
  const service = new SalesCustomerPhoneService({ repository: { async findLatestByPhone(phone) { received.push(phone); return customer } } })
  assert.deepEqual(await service.find(customer.phone), { valid: true, customer })
  assert.deepEqual(received, [customer.phone])
})

test('sales customer phone controller preserves invalid, found and missing response contracts', async () => {
  const customer = { id: 2, name: 'A', phone: '13800000000', apple_id: 'a@example.com', created_at: '2026-01-02' }
  const controller = new SalesCustomerPhoneController({
    service: { async find(phone) { return phone === 'bad' ? { valid: false } : { valid: true, customer: phone.endsWith('0') ? customer : null } } }
  })

  const invalid = createResponse()
  await controller.find({ params: { phone: 'bad' } }, invalid)
  assert.deepEqual(invalid.body, { success: false, message: '手机号格式不正确', data: null })

  const found = createResponse()
  await controller.find({ params: { phone: customer.phone } }, found)
  assert.deepEqual(found.body, { success: true, message: '找到客户', data: customer })

  const missing = createResponse()
  await controller.find({ params: { phone: '13800000001' } }, missing)
  assert.deepEqual(missing.body, { success: true, message: '未找到客户', data: null })
})

test('sales customer phone controller preserves the established server error response', async () => {
  const logged = []
  const controller = new SalesCustomerPhoneController({
    service: { async find() { throw new Error('lookup failed') } },
    logger: { error(...args) { logged.push(args) } }
  })
  const res = createResponse()
  await controller.find({ params: { phone: '13800000000' } }, res)
  assert.equal(res.statusCode, 500)
  assert.deepEqual(res.body, { success: false, message: '查找客户失败', error: 'lookup failed' })
  assert.equal(logged.length, 1)
})

test('sales customer phone repository keeps the exact field list, ordering and parameter binding', async () => {
  const calls = []
  const repository = new SalesCustomerPhoneRepository({
    getDb: () => ({
      async execute(sql, params) {
        calls.push({ sql, params })
        return [[{ id: 3, name: 'A', phone: '13800000000', apple_id: null, created_at: null }]]
      }
    })
  })
  await repository.findLatestByPhone('13800000000')
  assert.deepEqual(calls, [{
    sql: 'SELECT id, name, phone, apple_id, created_at FROM customers WHERE phone = ? ORDER BY id DESC LIMIT 1',
    params: ['13800000000']
  }])
})
