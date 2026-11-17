'use strict'

const scopedActor = { id: 8, store_id: 1, store_ids: [1, 2, 3, 4, 5, 6, 7, 8, 9] }

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const Controller = require('../src/controllers/rental-update.controller')
const Service = require('../src/services/rental-update.service')
const Repository = require('../src/repositories/rental-update.repository')
const { requirePermission } = require('../src/middleware/unified-auth')

const routeSource = fs.readFileSync(path.join(__dirname, '../src/routes/rentals.js'), 'utf8')

test('rental update route retains edit and hidden-field guards while delegating to controller', () => {
  assert.match(routeSource, /router\.put\('\/:id', requirePermission\('rentals:edit'\), rejectHiddenRentalWriteFields, rentalUpdateController\.update\.bind\(rentalUpdateController\)\)/)
})

test('rental update controller preserves success, missing, validation and server-error responses', async () => {
  const success = { status(code) { this.statusCode = code; return this }, json(body) { this.body = body; return this } }
  const controller = new Controller({ service: { async update(input) { assert.equal(input.id, '8'); assert.deepEqual(input.actor, { role_codes: ['admin'] }); return { id: 8 } } } })
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

const setupService = ({ current, paidCount = 0, permissions = ['rentals:edit'] } = {}) => {
  const events = []
  const connection = {
    async beginTransaction() { events.push('begin') },
    async commit() { events.push('commit') },
    async rollback() { events.push('rollback') }
  }
  const repository = {
    async withConnection(operation) { events.push('acquire'); try { return await operation(connection) } finally { events.push('release') } },
    async findForUpdate(_connection, id) { events.push(['lock', id]); return current && { store_id: 1, source_store_id: 1, ...current } },
    async countPaidPeriods() { events.push('paid-count'); return paidCount },
    async updateRental(_connection, id, assignments, values) { events.push(['rental-update', id, assignments, values]) },
    async updateSale(_connection, id, assignments, values) { events.push(['sale-update', id, assignments, values]) },
    async updateSoldPhonePrice(_connection, id, price) { events.push(['phone-sale-price', id, price]) },
    async updatePhonePurchaseCost(_connection, id, cost) { events.push(['phone-cost', id, cost]) }
  }
  const service = new Service({
    repository,
    permissionCheck: async (actor, permission) => {
      let allowed = false
      await requirePermission(permission)({ user: { ...actor, permissions: permissions.map(value => value.replace('rentals:', 'rentals_rentalsview:')) } },
        { status() { return this }, json() { return this } }, () => { allowed = true })
      return allowed
    },
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
    id: '8', actor: { store_ids: [1, 3, 5], id: 7 },
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
    { current: { status: 'completed', billing_mode: 'daily' }, expectedStatus: 403, body: {} },
    { current: { status: 'active', billing_mode: 'daily', unit_price: 10, deposit: 0 }, expectedStatus: 400, body: { deposit: -1 }, beforeConnection: true },
    { current: { status: 'active', billing_mode: 'buyout', term_months: 2 }, paidCount: 3, expectedStatus: 400, body: { term_months: 2 } }
  ]
  for (const item of cases) {
    const { service, events } = setupService(item)
    await assert.rejects(service.update({ id: '8', body: item.body, actor: { store_ids: [1, 3, 5], id: 7 } }), error => (
      item.expectedCode ? error.code === item.expectedCode : error.statusCode === item.expectedStatus
    ))
    if (item.beforeConnection) assert.deepEqual(events, [])
    else {
      assert.ok(events.includes('rollback'))
      assert.equal(events.at(-1), 'release')
    }
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
          return sql.startsWith('SELECT r.*') ? [[{ status: 'active' }]] : [[{ count: '2' }]]
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

test('历史合同更正按明确动作授权，不按管理员角色编码放行', async () => {
  const current = { status: 'returned', billing_mode: 'daily', unit_price: 10, deposit: 0 }
  const denied = setupService({ current })
  await assert.rejects(denied.service.update({ id: 8, body: { remarks: '更正' }, actor: { store_ids: [1, 3, 5], role_codes: ['admin'] } }), { statusCode: 403 })
  assert.ok(!denied.events.includes('commit'))
  const allowed = setupService({ current, permissions: ['rentals:edit', 'rentals:edit-history'] })
  await allowed.service.update({ id: 8, body: { remarks: '更正' }, actor: { store_ids: [1, 3, 5], role_codes: ['salesperson'] } })
  assert.ok(allowed.events.includes('commit'))
  const historyOnly = setupService({ current, permissions: ['rentals:edit-history'] })
  await assert.rejects(historyOnly.service.update({ id: 8, body: {}, actor: { store_ids: [1, 3, 5], id: 7 } }), { statusCode: 403 })
  assert.deepEqual(historyOnly.events, [])
})
