'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const Controller = require('../src/controllers/rental-create.controller')
const Service = require('../src/services/rental-create.service')
const Repository = require('../src/repositories/rental-create.repository')

const routeSource = fs.readFileSync(path.join(__dirname, '../src/routes/rentals.js'), 'utf8')

test('rental create route preserves authorization and hidden-field guard while delegating', () => {
  assert.match(routeSource, /router\.post\('\/', requirePermission\('rentals:create'\), rejectHiddenRentalWriteFields, rentalCreateController\.create\.bind\(rentalCreateController\)\)/)
})

test('rental create controller preserves status, message, masked result and error response', async () => {
  const response = () => ({ status(code) { this.statusCode = code; return this }, json(body) { this.body = body; return this } })
  const success = response()
  const controller = new Controller({
    service: { async create(input) { assert.equal(input.operatorId, 8); return { id: 12, contract_number: 'ZL202611080012', billing_mode: 'daily' } } },
    maskRentalItem: async (item, req) => ({ ...item, masked_for: req.user.id })
  })
  await controller.create({ body: {}, user: { id: 8 } }, success)
  assert.equal(success.statusCode, 201)
  assert.equal(success.body.message, '按天租赁合同已创建')
  assert.deepEqual(success.body.data, { id: 12, contract_number: 'ZL202611080012', masked_for: 8 })

  const invalid = response()
  await new Controller({ service: { async create() { throw Object.assign(new Error('invalid'), { statusCode: 400 }) } }, logger: { error() {} } })
    .create({ body: {}, user: { id: 8 } }, invalid)
  assert.equal(invalid.statusCode, 400)

  const failure = response()
  await new Controller({ service: { async create() { throw new Error('database failure') } }, logger: { error() {} } })
    .create({ body: {}, user: { id: 8 } }, failure)
  assert.equal(failure.statusCode, 500)
})

const setup = ({ phone = { id: 4, status: 'in_stock', purchase_cost: 700, store_id: 3, is_new: 1 }, failAt } = {}) => {
  const events = []
  const connection = {
    async beginTransaction() { events.push('begin') },
    async commit() { events.push('commit') },
    async rollback() { events.push('rollback') }
  }
  const repository = {
    async withConnection(operation) { events.push('acquire'); try { return await operation(connection) } finally { events.push('release') } },
    async findActiveCustomerForUpdate(_connection, id) { events.push(['customer-lock', id]); return { id, id_card: 'valid' } },
    async findPhoneForUpdate(_connection, id) { events.push(['phone-lock', id]); return phone },
    async updatePhonePurchaseCost(_connection, id, cost) { events.push(['purchase-cost', id, cost]) },
    async createRental(_connection, values) { events.push(['rental', values]); return 12 },
    async setContractNumber(_connection, id, value) { events.push(['contract-number', id, value]) },
    async createSale(_connection, values) { events.push(['sale', values]); return 30 },
    async linkSale(_connection, saleId, rentalId) { events.push(['link-sale', saleId, rentalId]) },
    async markPhoneSold(_connection, values) { events.push(['sold', values]); if (failAt === 'sold') throw new Error('write failed') },
    async createDownPayment(_connection, values) { events.push(['down-payment', values]) },
    async findRentalSaleId() { return 30 },
    async createPaymentRecord(_connection, values) { events.push(['payment-record', values]) },
    async markPhoneRented(_connection, id) { events.push(['rented', id]) }
  }
  const service = new Service({
    repository,
    ensureSchema: async () => events.push('schema'),
    isValidIdCard: value => value === 'valid',
    prepareInvoiceTransaction: async () => events.push('prepare-invoice'),
    generateInvoice: async () => '202611080001XS',
    reconcilePoints: async input => events.push(['points', input])
  })
  return { service, events }
}

test('daily rental creation validates, locks customer and phone, commits and marks the phone rented', async () => {
  const { service, events } = setup()
  const result = await service.create({
    operatorId: 8,
    body: { customer_id: 2, phone_id: 4, billing_mode: 'daily', unit_price: 30, sale_price: 500, start_date: '2026-11-08', deposit: 100 }
  })
  assert.deepEqual(result, { id: 12, contract_number: 'ZL202611080012', billing_mode: 'daily' })
  assert.ok(events.indexOf('prepare-invoice') < events.indexOf('begin'))
  assert.ok(events.indexOf('begin') < events.findIndex(event => Array.isArray(event) && event[0] === 'customer-lock'))
  assert.ok(events.some(event => Array.isArray(event) && event[0] === 'rented' && event[1] === 4))
  assert.ok(!events.some(event => Array.isArray(event) && event[0] === 'sale'))
  assert.equal(events.at(-2), 'commit')
  assert.equal(events.at(-1), 'release')
})

test('buyout rental creation writes sale, points, down payment and sale payment atomically', async () => {
  const { service, events } = setup()
  const result = await service.create({
    operatorId: 8,
    body: {
      customer_id: 2, phone_id: 4, billing_mode: 'buyout', term_months: 4, sale_price: 1200,
      down_payment: 200, monthly_rent: 50, sale_operator_id: 9, sale_store_id: 5,
      sale_payment_method: 'cash', sale_payment_channel: 'cashier', start_date: '2026-11-08',
      deposit: 99, purchase_cost: 750
    }
  })
  assert.deepEqual(result, { id: 12, contract_number: 'MD202611080012', billing_mode: 'buyout' })
  assert.ok(events.some(event => Array.isArray(event) && event[0] === 'purchase-cost' && event[2] === 750))
  assert.ok(events.some(event => Array.isArray(event) && event[0] === 'points' && event[1].saleId === 30))
  assert.ok(events.some(event => Array.isArray(event) && event[0] === 'down-payment' && event[1].amount === 200))
  assert.ok(events.some(event => Array.isArray(event) && event[0] === 'payment-record' && event[1].paymentMethod === 'cash'))
  assert.ok(events.some(event => Array.isArray(event) && event[0] === 'sold'))
  const rental = events.find(event => Array.isArray(event) && event[0] === 'rental')[1]
  assert.equal(rental.monitoringLock, 1)
  assert.equal(rental.deposit, 0)
  assert.equal(events.at(-2), 'commit')
  assert.equal(events.at(-1), 'release')
})

test('rental creation rejects invalid inputs before acquiring a connection', async () => {
  const { service, events } = setup()
  await assert.rejects(service.create({ operatorId: 8, body: { customer_id: 1, phone_id: 2, billing_mode: 'buyout' } }), { statusCode: 400 })
  assert.ok(!events.includes('acquire'))
})

test('rental creation rolls back failed buyout synchronization and releases the connection', async () => {
  const { service, events } = setup({ failAt: 'sold' })
  await assert.rejects(service.create({
    operatorId: 8,
    body: { customer_id: 2, phone_id: 4, billing_mode: 'buyout', term_months: 1, sale_price: 1000, down_payment: 100, monthly_rent: 20, sale_operator_id: 9, sale_store_id: 5, sale_payment_method: 'cash', start_date: '2026-11-08' }
  }), /write failed/)
  assert.ok(events.includes('rollback'))
  assert.equal(events.at(-1), 'release')
  assert.ok(!events.includes('commit'))
})

test('rental create repository binds customer and phone lock identifiers', async () => {
  const calls = []
  let released = false
  const repository = new Repository({ database: async () => ({
    async getConnection() {
      return {
        async execute(sql, params) {
          calls.push({ sql, params })
          return [[{ id: params[0], id_card: 'valid', status: 'in_stock', purchase_cost: 10, store_id: 2, is_new: 1 }]]
        },
        release() { released = true }
      }
    }
  }) })
  await repository.withConnection(async connection => {
    await repository.findActiveCustomerForUpdate(connection, 7)
    await repository.findPhoneForUpdate(connection, 9)
  })
  assert.deepEqual(calls.map(call => call.params), [[7], [9]])
  assert.match(calls[0].sql, /status=1 FOR UPDATE/)
  assert.match(calls[1].sql, /FOR UPDATE/)
  assert.equal(released, true)
})
