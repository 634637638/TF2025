'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const Controller = require('../src/controllers/rental-update.controller')
const Service = require('../src/services/rental-update.service')
const Repository = require('../src/repositories/rental-update.repository')

const routeSource = fs.readFileSync(path.join(__dirname, '../src/routes/rentals.js'), 'utf8')

test('rental update route retains edit and hidden-field guards while delegating to controller', () => {
  assert.match(routeSource, /router\.put\('\/:id', requirePermission\('rentals:edit'\), rejectHiddenRentalWriteFields, rentalUpdateController\.update\.bind\(rentalUpdateController\)\)/)
})

test('rental update controller preserves success, missing, validation and server-error responses', async () => {
  const success = { status(code) { this.statusCode = code; return this }, json(body) { this.body = body; return this } }
  const controller = new Controller({ service: { async update(input) { assert.equal(input.id, '8'); assert.equal(input.isAdministrator, true); return { id: 8 } } } })
  await controller.update({ params: { id: '8' }, body: {}, user: { role_codes: ['admin'] } }, success)
  assert.equal(success.statusCode, 200)
  assert.equal(success.body.success, true)
  assert.deepEqual(success.body.data, { id: 8 })
  assert.equal(success.body.message, '租赁合同保存成功')

  const response = () => ({ status(code) { this.statusCode = code; return this }, json(body) { this.body = body; return this } })
  const missing = response()
  await new Controller({ service: { async update() { throw Object.assign(new Error('missing'), { code: 'RENTAL_NOT_FOUND' }) } } })
    .update({ params: { id: '9' }, body: {}, user: {} }, missing)
  assert.equal(missing.statusCode, 404)
  assert.equal(missing.body.message, '租赁合同不存在')

  const invalid = response()
  await new Controller({ service: { async update() { throw Object.assign(new Error('invalid'), { statusCode: 400 }) } } })
    .update({ params: { id: '9' }, body: {}, user: {} }, invalid)
  assert.equal(invalid.statusCode, 400)

  const failure = response()
  await new Controller({ service: { async update() { throw new Error('database failure') } }, logger: { error() {} } })
    .update({ params: { id: '9' }, body: {}, user: {} }, failure)
  assert.equal(failure.statusCode, 500)
})

const setupService = ({ current, paidCount = 0 } = {}) => {
  const events = []
  const connection = {
    async beginTransaction() { events.push('begin') },
    async commit() { events.push('commit') },
    async rollback() { events.push('rollback') }
  }
  const repository = {
    async withConnection(operation) { events.push('acquire'); try { return await operation(connection) } finally { events.push('release') } },
    async findForUpdate(_connection, id) { events.push(['lock', id]); return current },
    async countPaidPeriods() { events.push('paid-count'); return paidCount },
    async updateRental(_connection, id, assignments, values) { events.push(['rental-update', id, assignments, values]) },
    async updateSale(_connection, id, assignments, values) { events.push(['sale-update', id, assignments, values]) },
    async updateSoldPhonePrice(_connection, id, price) { events.push(['phone-sale-price', id, price]) },
    async updatePhonePurchaseCost(_connection, id, cost) { events.push(['phone-cost', id, cost]) }
  }
  const service = new Service({
    repository,
    ensureSchema: async () => events.push('schema'),
    reconcilePoints: async () => events.push('points')
  })
  return { service, events }
}

test('rental update service synchronizes buyout contract, sale and phone in one transaction', async () => {
  const { service, events } = setupService({
    current: {
      status: 'active', billing_mode: 'buyout', sale_id: 30, phone_id: 4, customer_id: 5,
      term_months: 3, sale_price: 3000, down_payment: 500, monthly_rent: 100,
      purchase_cost: 1000, is_new: 1
    },
    paidCount: 1
  })
  const result = await service.update({
    id: '8', isAdministrator: false,
    body: { sale_price: 3600, down_payment: 600, term_months: 4, monthly_rent: 120, purchase_cost: 1100, sale_payment_channel: '  card  ' }
  })
  assert.deepEqual(result, { id: 8 })
  assert.ok(events.indexOf('begin') < events.findIndex(event => Array.isArray(event) && event[0] === 'lock'))
  assert.ok(events.includes('points'))
  assert.ok(events.find(event => Array.isArray(event) && event[0] === 'sale-update')[2].includes('payment_channel=?'))
  assert.ok(events.some(event => Array.isArray(event) && event[0] === 'phone-sale-price' && event[2] === 3600))
  assert.ok(events.some(event => Array.isArray(event) && event[0] === 'phone-cost' && event[2] === 1100))
  assert.equal(events.at(-2), 'commit')
  assert.equal(events.at(-1), 'release')
})

test('rental update service rolls back missing, closed, invalid and overpaid-period contracts', async () => {
  const cases = [
    { current: null, expectedCode: 'RENTAL_NOT_FOUND', body: {} },
    { current: { status: 'completed', billing_mode: 'daily' }, expectedStatus: 400, body: {} },
    { current: { status: 'active', billing_mode: 'daily', unit_price: 10, deposit: 0 }, expectedStatus: 400, body: { deposit: -1 } },
    { current: { status: 'active', billing_mode: 'buyout', term_months: 2 }, paidCount: 3, expectedStatus: 400, body: { term_months: 2 } }
  ]
  for (const item of cases) {
    const { service, events } = setupService(item)
    await assert.rejects(service.update({ id: '8', body: item.body, isAdministrator: false }), error => (
      item.expectedCode ? error.code === item.expectedCode : error.statusCode === item.expectedStatus
    ))
    assert.ok(events.includes('rollback'))
    assert.equal(events.at(-1), 'release')
    assert.ok(!events.includes('commit'))
  }
})

test('rental update repository uses the shared connection helper and bound record IDs', async () => {
  const calls = []
  let released = false
  const repository = new Repository({ database: async () => ({
    async getConnection() {
      return {
        async execute(sql, params) {
          calls.push({ sql, params })
          return sql.startsWith('SELECT status') ? [[{ status: 'active' }]] : [[{ count: '2' }]]
        },
        release() { released = true }
      }
    }
  }) })
  const row = await repository.withConnection(connection => repository.findForUpdate(connection, 8))
  assert.equal(row.status, 'active')
  await repository.withConnection(connection => repository.countPaidPeriods(connection, 8))
  assert.equal(released, true)
  assert.deepEqual(calls.map(call => call.params), [[8], [8]])
  assert.match(calls[0].sql, /FOR UPDATE/)
  assert.match(calls[1].sql, /period_number IS NOT NULL/)
})
