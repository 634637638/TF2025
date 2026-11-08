'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const RepairCustomerController = require('../src/controllers/repair-customer.controller')
const RepairCustomerService = require('../src/services/repair-customer.service')
const RepairCustomerRepository = require('../src/repositories/repair-customer.repository')

const response = () => ({
  status(code) { this.statusCode = code; return this },
  json(body) { this.body = body; return this }
})

test('repair customer creation route preserves authentication and create permission while delegating to controller', () => {
  const route = fs.readFileSync(path.join(__dirname, '../src/routes/repairs.js'), 'utf8')
  assert.match(route, /router\.post\('\/customers', unifiedAuth, requirePermission\('repairs:create'\), repairCustomerController\.create\.bind\(repairCustomerController\)\)/)
})

test('repair customer service keeps input validation before field permissions and database access', async () => {
  const events = []
  const service = new RepairCustomerService({
    repository: {
      async ensureReady() { events.push('ready') },
      async findByPhone() { events.push('find') },
      async createCustomer() { events.push('create'); return 8 },
      async generateMemberNumber() { events.push('member-number'); return 'TF000008' }
    },
    async getHiddenFields() { events.push('permissions'); return new Set() }
  })

  await assert.rejects(service.createCustomer({ body: { name: '  ', phone: '13800000000' } }), error => (
    error.statusCode === 400 && error.message === '请输入客户姓名'
  ))
  await assert.rejects(service.createCustomer({ body: { name: '张三', phone: '138' } }), error => (
    error.statusCode === 400 && error.message === '请输入有效的11位手机号码'
  ))
  assert.deepEqual(events, [])

  const deniedService = new RepairCustomerService({
    repository: { async ensureReady() { assert.fail('hidden field denial must precede database access') } },
    getHiddenFields: async () => new Set(['customer_info.customer_phone'])
  })
  await assert.rejects(deniedService.createCustomer({ body: { name: '张三', phone: '13800000000' } }), error => (
    error.statusCode === 403 && error.code === 'FIELD_PERMISSION_DENIED'
  ))
})

test('repair customer service checks phone duplicates before generating member number and creating a row', async () => {
  const events = []
  const req = { body: { name: ' 张三 ', phone: '13800000000' }, user: { id: 4 } }
  const service = new RepairCustomerService({
    repository: {
      async ensureReady() { events.push('ready') },
      async findByPhone(phone) { events.push(['find', phone]); return null },
      async createCustomer(customer) { events.push(['create', customer]); return 8 },
      async generateMemberNumber() { events.push('member-number'); return 'TF000008' }
    },
    async getHiddenFields(request) { assert.equal(request, req); events.push('permissions'); return new Set() }
  })

  assert.deepEqual(await service.createCustomer(req), { id: 8, name: '张三', phone: '13800000000' })
  assert.deepEqual(events, [
    'permissions', 'ready', ['find', '13800000000'], 'member-number',
    ['create', { name: '张三', phone: '13800000000', memberNumber: 'TF000008' }]
  ])

  const duplicateService = new RepairCustomerService({
    repository: {
      async ensureReady() {},
      async findByPhone() { return { id: 3 } },
      async generateMemberNumber() { assert.fail('duplicate phone must not generate a member number') },
      async createCustomer() { assert.fail('duplicate phone must not insert') }
    },
    getHiddenFields: async () => new Set()
  })
  await assert.rejects(duplicateService.createCustomer(req), error => (
    error.code === 'BAD_REQUEST' && error.message === '该手机号已存在，请检索并选择已有客户'
  ))

  const raceService = new RepairCustomerService({
    repository: {
      async ensureReady() {}, async findByPhone() { return null },
      async generateMemberNumber() { return 'TF000008' },
      async createCustomer() { throw Object.assign(new Error('duplicate'), { code: 'ER_DUP_ENTRY' }) }
    },
    getHiddenFields: async () => new Set()
  })
  await assert.rejects(raceService.createCustomer(req), error => (
    error.code === 'BAD_REQUEST' && error.message === '该手机号已存在，请检索并选择已有客户'
  ))
})

test('repair customer repository parameterizes duplicate lookup and insert while using schema-checked provider', async () => {
  const calls = []
  let providerCalls = 0
  const repository = new RepairCustomerRepository({
    async getDatabase() {
      providerCalls += 1
      return { async execute(sql, params) {
        calls.push({ sql, params })
        return calls.length === 1 ? [[{ id: 2 }]] : [{ insertId: 8 }]
      } }
    },
    async createMemberNumber() { return 'TF000008' }
  })

  await repository.ensureReady()
  assert.deepEqual(await repository.findByPhone('13800000000'), { id: 2 })
  assert.equal(await repository.generateMemberNumber(), 'TF000008')
  assert.equal(await repository.createCustomer({ name: '张三', phone: '13800000000', memberNumber: 'TF000008' }), 8)
  assert.equal(providerCalls, 3)
  assert.equal(calls.length, 2)
  assert.deepEqual(calls[0], {
    sql: 'SELECT id, name, phone FROM customers WHERE phone = ? LIMIT 1',
    params: ['13800000000']
  })
  assert.match(calls[1].sql, /INSERT INTO customers \(name, phone, customer_type, status, member_number, created_at, updated_at\)/)
  assert.deepEqual(calls[1].params, ['张三', '13800000000', 'TF000008'])
})

test('repair customer controller preserves created, validation, field denial, duplicate and server-error responses', async () => {
  const createdController = new RepairCustomerController({
    service: { async createCustomer() { return { id: 8, name: '张三', phone: '13800000000' } } },
    response: { created(res, data, message) { res.body = { data, message }; return res } }
  })
  const created = response()
  await createdController.create({}, created)
  assert.deepEqual(created.body, {
    data: { id: 8, name: '张三', phone: '13800000000' }, message: '客户创建成功'
  })

  const apiCreated = response()
  const apiResponseController = new RepairCustomerController({
    service: { async createCustomer() { return { id: 8, name: '张三', phone: '13800000000' } } }
  })
  await apiResponseController.create({}, apiCreated)
  assert.equal(apiCreated.statusCode, 201)
  assert.equal(apiCreated.body.message, '客户创建成功')
  assert.deepEqual(apiCreated.body.data, { id: 8, name: '张三', phone: '13800000000' })

  const mappedController = new RepairCustomerController({
    service: { async createCustomer() { throw Object.assign(new Error('手机号无效'), { code: 'BAD_REQUEST' }) } },
    response: { badRequest(res, message) { res.statusCode = 400; res.body = { message }; return res } }
  })
  const invalid = response()
  await mappedController.create({}, invalid)
  assert.equal(invalid.statusCode, 400)
  assert.deepEqual(invalid.body, { message: '手机号无效' })

  const deniedController = new RepairCustomerController({
    service: { async createCustomer() { throw Object.assign(new Error('字段不可用'), { statusCode: 403, code: 'FIELD_PERMISSION_DENIED' }) } },
    logger: { error() {} }
  })
  const denied = response()
  await deniedController.create({}, denied)
  assert.deepEqual(denied.body, { success: false, message: '字段不可用', code: 'FIELD_PERMISSION_DENIED' })

  const failedController = new RepairCustomerController({
    service: { async createCustomer() { throw new Error('database unavailable') } },
    response: { serverError(res, message) { res.statusCode = 500; res.body = { message }; return res } },
    logger: { error() {} }
  })
  const failed = response()
  await failedController.create({}, failed)
  assert.equal(failed.statusCode, 500)
  assert.deepEqual(failed.body, { message: '客户创建失败' })
})
