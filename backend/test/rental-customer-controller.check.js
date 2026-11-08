'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const RentalCustomerController = require('../src/controllers/rental-customer.controller')
const RentalCustomerRepository = require('../src/repositories/rental-customer.repository')
const RentalCustomerService = require('../src/services/rental-customer.service')

const routeSource = fs.readFileSync(path.join(__dirname, '../src/routes/rentals.js'), 'utf8')
const makeResponse = () => ({
  status(code) { this.statusCode = code; return this },
  json(body) { this.body = body; return this }
})
const repositoryStub = overrides => ({
  async getActiveStores() { return [] },
  async findByPhone() { return null },
  async updateExistingIdentity() {},
  async create() { return 1 },
  async findPhoneOwner() { return null },
  async updateActiveCustomer() { return true },
  ...overrides
})

test('rental customer routes preserve authorization, field guards, and personnel audit middleware', () => {
  assert.match(routeSource, /router\.get\('\/customers', requireAnyPermission\(\['rentals:view', 'rentals:create'\]\), rentalCustomerController\.search\.bind/)
  assert.match(routeSource, /router\.get\('\/sales-options', requireAnyPermission\(\['rentals:view', 'rentals:create'\]\), auditUnpaginatedPersonnelSearch\('rentals-sales-options'\), rentalCustomerController\.getSalesOptions\.bind/)
  assert.match(routeSource, /router\.post\('\/customers', requirePermission\('rentals:create'\), rejectHiddenCustomerWriteFields, rentalCustomerController\.create\.bind/)
  assert.match(routeSource, /router\.put\('\/customers\/:id', requirePermission\('rentals:create'\), rejectHiddenCustomerWriteFields, rentalCustomerController\.update\.bind/)
})

test('rental customer service short-circuits short search and masks hidden fields', async () => {
  const searches = []
  const service = new RentalCustomerService({
    repository: repositoryStub(),
    masking: { async getUserFieldPermissions() { return { hiddenFields: ['customer_info.customer_name', 'customer_info.customer_id_card'] } } },
    customerSearch: async options => { searches.push(options); return { records: [{ id: 4, name: '姓名', phone: '13800000000', id_card: 'ID' }] } },
    operatorSearch: async () => ({ records: [] }),
    validateIdCard: () => true
  })

  assert.deepEqual(await service.search({ keyword: ' a ' }, 9), { rows: [] })
  assert.deepEqual(searches, [])
  const result = await service.search({ keyword: '姓名', page: '2', page_size: '5' }, 9)
  assert.deepEqual(searches, [{
    keyword: '姓名', page: '2', page_size: '5',
    fields: ['id', 'name', 'phone', 'id_card'], search_fields: ['phone']
  }])
  assert.deepEqual(result.rows, [{ id: 4, name: null, phone: '13800000000', id_card: null }])
})

test('rental sales options honor hidden operator/store fields and preserve search scope', async () => {
  const calls = []
  const service = new RentalCustomerService({
    repository: repositoryStub({ async getActiveStores() { calls.push('stores'); return [{ id: 2, name: '门店' }] } }),
    masking: { async getUserFieldPermissions() { return { hiddenFields: ['sales_info.sale_store_name'] } } },
    customerSearch: async () => ({ records: [] }),
    operatorSearch: async options => { calls.push(options); return { records: [{ id: '7', username: 'user7', name: '' }], pagination: { page: 1 } } },
    validateIdCard: () => true
  })
  const result = await service.getSalesOptions({ user: { id: 3, store_ids: [2] }, query: { keyword: '李', page: '1', page_size: '10' } })
  assert.deepEqual(calls, [{
    user: { id: 3, store_ids: [2] }, keyword: '李', page: '1', page_size: '10', status: '1'
  }])
  assert.deepEqual(result, {
    operators: [{ id: 7, username: 'user7', name: 'user7' }], stores: [], pagination: { page: 1 }
  })
})

test('rental customer service reuses existing customers and creates normalized new customers', async () => {
  const calls = []
  let existing = { id: 8, name: '旧名', phone: '13800000000' }
  const repository = {
    async findByPhone(phone) { calls.push(['find', phone]); return existing },
    async updateExistingIdentity(input) { calls.push(['update-identity', input]) },
    async create(input) { calls.push(['create', input]); return 10 },
    async findPhoneOwner() { return null },
    async updateActiveCustomer() { return true },
    async getActiveStores() { return [] }
  }
  const service = new RentalCustomerService({
    repository,
    masking: { async getUserFieldPermissions() { return { hiddenFields: [] } } },
    customerSearch: async () => ({ records: [] }),
    operatorSearch: async () => ({ records: [] }),
    validateIdCard: () => true
  })
  const body = { name: ' 新客户 ', phone: '13800000000', id_card: ' abcd ' }
  const reused = await service.create(body)
  assert.deepEqual(reused, { existing: true, customer: { id: 8, name: '新客户', phone: '13800000000', id_card: 'ABCD' } })
  assert.deepEqual(calls[1], ['update-identity', { id: 8, name: '新客户', phone: '13800000000', idCard: 'ABCD' }])

  existing = null
  const created = await service.create(body)
  assert.deepEqual(created, { existing: false, customer: { id: 10, name: '新客户', phone: '13800000000', id_card: 'ABCD' } })
  assert.deepEqual(calls.at(-1), ['create', { name: '新客户', phone: '13800000000', idCard: 'ABCD' }])
})

test('rental customer update rejects another phone owner and reports missing active customers', async () => {
  let owner = { id: 11 }
  let updated = true
  const service = new RentalCustomerService({
    repository: repositoryStub({ async findPhoneOwner() { return owner }, async updateActiveCustomer() { return updated } }),
    masking: { async getUserFieldPermissions() { return { hiddenFields: [] } } },
    customerSearch: async () => ({ records: [] }),
    operatorSearch: async () => ({ records: [] }),
    validateIdCard: () => true
  })
  await assert.rejects(service.update('5', { name: '客户', phone: '13800000000', id_card: 'ID' }), /该手机号已属于其他客户/)
  owner = null
  updated = false
  assert.equal(await service.update('5', { name: '客户', phone: '13800000000', id_card: 'ID' }), null)
})

test('rental customer controller preserves create, missing, forbidden and server-error responses', async () => {
  const errors = []
  const controller = new RentalCustomerController({
    service: {
      async search() { return { forbidden: true } },
      async getSalesOptions() { throw new Error('private') },
      async create() { return { existing: false, customer: { id: 4 } } },
      async update() { return null }
    },
    logger: { error(...args) { errors.push(args) } }
  })
  const forbidden = makeResponse()
  await controller.search({ query: {}, user: { id: 1 } }, forbidden)
  assert.equal(forbidden.statusCode, 403)
  assert.equal(forbidden.body.code, 'FIELD_PERMISSION_DENIED')

  const created = makeResponse()
  await controller.create({ body: {} }, created)
  assert.equal(created.statusCode, 201)
  assert.equal(created.body.data.id, 4)

  const missing = makeResponse()
  await controller.update({ params: { id: '1' }, body: {} }, missing)
  assert.equal(missing.statusCode, 404)

  const failed = makeResponse()
  await controller.getSalesOptions({ query: {}, user: { id: 1 } }, failed)
  assert.equal(failed.statusCode, 500)
  assert.equal(failed.body.message, '服务器内部错误，请稍后重试')
  assert.equal(errors.length, 1)
})

test('rental customer repository binds customer writes and returns active stores', async () => {
  const calls = []
  const database = {
    async execute(sql, params = []) {
      calls.push({ sql, params })
      if (sql.startsWith('SELECT id, name FROM stores')) return [[{ id: 2, name: '门店' }]]
      if (sql.startsWith('SELECT id, name, phone')) return [[{ id: 8, name: '客户', phone: '13800000000' }]]
      if (sql.startsWith('SELECT id FROM customers')) return [[{ id: 9 }]]
      if (sql.startsWith('INSERT INTO customers')) return [{ insertId: 10 }]
      if (sql.startsWith('UPDATE customers')) return [{ affectedRows: 1 }]
      return [[]]
    }
  }
  const repository = new RentalCustomerRepository({ getDb: () => database })
  assert.deepEqual(await repository.getActiveStores(), [{ id: 2, name: '门店' }])
  assert.deepEqual(await repository.findByPhone('13800000000'), { id: 8, name: '客户', phone: '13800000000' })
  assert.deepEqual(await repository.findPhoneOwner('13800000000', 8), { id: 9 })
  assert.equal(await repository.create({ name: '客户', phone: '13800000000', idCard: 'ID' }), 10)
  assert.equal(await repository.updateActiveCustomer({ id: 8, name: '客户', phone: '13800000000', idCard: 'ID' }), true)
  assert.ok(calls.every(({ sql }) => !/\bSELECT \*/i.test(sql)))
  assert.deepEqual(calls.find(({ sql }) => sql.startsWith('INSERT')).params, ['客户', '13800000000', 'ID'])
})
