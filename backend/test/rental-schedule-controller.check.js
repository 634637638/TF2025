'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const Controller = require('../src/controllers/rental-schedule.controller')
const Service = require('../src/services/rental-schedule.service')
const Repository = require('../src/repositories/rental-schedule.repository')
const { addMonthsClamped, getInstallmentAmount, isBuyoutMode } = require('../src/utils/rental-calculations')

const routeSource = fs.readFileSync(path.join(__dirname, '../src/routes/rentals.js'), 'utf8')
const response = () => ({
  status(code) { this.statusCode = code; return this },
  json(body) { this.body = body; return this }
})

test('payment schedule route retains edit permission and delegates to controller', () => {
  assert.match(routeSource, /router\.get\('\/:id\/payment-schedule', requirePermission\('rentals:edit'\), rentalScheduleController\.getPaymentSchedule\.bind\(rentalScheduleController\)\)/)
  assert.match(routeSource, /router\.post\('\/:id\/payments', requirePermission\('rentals:edit'\), rejectHiddenWrites\(\{ remarks: 'other_info\.remarks' \}\), rentalScheduleController\.recordPayment\.bind\(rentalScheduleController\)\)/)
})

test('rental calculations clamp month ends and adjust the final principal installment', () => {
  assert.equal(addMonthsClamped('2026-01-31', 1), '2026-02-28')
  assert.equal(addMonthsClamped('2026-01-31', 2), '2026-03-31')
  assert.equal(getInstallmentAmount(1000, 50, 3, 1), 383.33)
  assert.equal(getInstallmentAmount(1000, 50, 3, 3), 383.34)
  assert.equal(isBuyoutMode('monthly'), true)
  assert.equal(isBuyoutMode('daily'), false)
})

test('rental schedule service builds paid and unpaid buyout rows and masks fields', async () => {
  const calls = []
  const service = new Service({
    ensureSchema: async () => calls.push('schema'),
    repository: {
      async getRental(id) {
        calls.push(['rental', id])
        return { billing_mode: 'buyout', term_months: 2, principal_amount: '1000', monthly_rent: '50', start_date: '2026-01-31' }
      },
      async getPayments(id) {
        calls.push(['payments', id])
        return [{ period_number: 1, paid_at: '2026-03-01 10:00:00', operator_name: '员工' }]
      }
    },
    masking: {
      async getUserFieldPermissions(id, moduleKey) {
        calls.push(['permissions', id, moduleKey])
        return { hiddenFields: ['price_info.paid_rent', 'operator_info.operator_name'] }
      }
    }
  })
  const schedule = await service.getPaymentSchedule(7, 9)
  assert.deepEqual(calls, ['schema', ['rental', 7], ['payments', 7], ['permissions', 9, 'rentals_rentalsview']])
  assert.deepEqual(schedule, [
    { period_number: 1, due_date: '2026-02-28', principal_amount: 500, monthly_rent: 50, amount: 550, paid: null, paid_at: null, operator_name: null },
    { period_number: 2, due_date: '2026-03-31', principal_amount: 500, monthly_rent: 50, amount: 550, paid: null, paid_at: null, operator_name: null }
  ])
})

test('rental schedule service preserves not-found and daily-rental behavior', async () => {
  let paymentReads = 0
  const service = new Service({
    ensureSchema: async () => {},
    repository: {
      async getRental(id) { return id === 0 ? null : { billing_mode: 'daily' } },
      async getPayments() { paymentReads += 1; return [] }
    },
    masking: { async getUserFieldPermissions() { throw new Error('must not load permissions for daily rentals') } }
  })
  assert.equal(await service.getPaymentSchedule(0, 1), null)
  assert.deepEqual(await service.getPaymentSchedule(1, 1), [])
  assert.equal(paymentReads, 1)
})

test('rental schedule controller preserves not-found, success, and server-error responses', async () => {
  const controller = new Controller({
    service: { async getPaymentSchedule(id) {
      if (id === 404) return null
      if (id === 500) throw new Error('database unavailable')
      return [{ period_number: 1 }]
    } }
  })
  const missing = response()
  await controller.getPaymentSchedule({ params: { id: '404' }, user: { id: 1 } }, missing)
  assert.equal(missing.statusCode, 404)
  assert.equal(missing.body.message, '租赁合同不存在')

  const success = response()
  await controller.getPaymentSchedule({ params: { id: '5' }, user: { id: 1 } }, success)
  assert.deepEqual(success.body.data, { schedule: [{ period_number: 1 }] })

  const failed = response()
  await controller.getPaymentSchedule({ params: { id: '500' }, user: { id: 1 } }, failed)
  assert.equal(failed.statusCode, 500)
  assert.equal(failed.body.message, '服务器内部错误，请稍后重试')
})

test('rental schedule repository binds rental ID in both reads', async () => {
  const calls = []
  const repository = new Repository({
    getDb: () => ({
      async execute(sql, params) {
        calls.push({ sql, params })
        return [[{ id: 1 }]]
      }
    })
  })
  assert.deepEqual(await repository.getRental(12), { id: 1 })
  assert.deepEqual(await repository.getPayments(12), [{ id: 1 }])
  assert.deepEqual(calls.map(call => call.params), [[12], [12]])
  assert.match(calls[0].sql, /DATE_FORMAT\(start_date,'%Y-%m-%d'\)/)
  assert.match(calls[1].sql, /ORDER BY COALESCE\(rp\.period_number,255\),rp\.id/)
})

test('rental payment controller preserves success and business error responses', async () => {
  const response = () => ({
    created(...args) { this.createdArgs = args; return this },
    error(...args) { this.errorArgs = args; return this }
  })
  const controller = new Controller({
    service: {
      async recordPayment(id, body, userId) {
        assert.equal(id, 8)
        assert.deepEqual(body, { amount: 120 })
        assert.equal(userId, 4)
        return { message: '租金还款已登记', inserted: [{ id: 3 }] }
      }
    },
    response: response(),
    logger: { error() {} }
  })
  const success = response()
  controller.response = success
  await controller.recordPayment({ params: { id: '8' }, body: { amount: 120 }, user: { id: 4 } }, success)
  assert.deepEqual(success.createdArgs, [success, '租金还款已登记', [{ id: 3 }]])

  const failed = response()
  controller.response = failed
  controller.service = { async recordPayment() { throw new Error('请输入正确的收款金额') } }
  await controller.recordPayment({ params: { id: '8' }, body: {}, user: { id: 4 } }, failed)
  assert.deepEqual(failed.errorArgs, [failed, '请输入正确的收款金额', 400])
})

test('rental payment service commits buyout installments atomically and releases the connection', async () => {
  const calls = []
  const connection = {
    async beginTransaction() { calls.push('begin') },
    async commit() { calls.push('commit') },
    async rollback() { calls.push('rollback') },
    release() { calls.push('release') }
  }
  const service = new Service({
    ensureSchema: async () => calls.push('schema'),
    databaseProvider: { async getConnection() { return connection } },
    repository: {
      async getPaymentRental(conn, id) {
        assert.equal(conn, connection)
        assert.equal(id, 7)
        return { billing_mode: 'buyout', term_months: 2, principal_amount: 1000, monthly_rent: 50, status: 'active', sale_id: 12, customer_id: 9, contract_number: 'MD20260007', sale_payment_method: 'cash' }
      },
      async findPaidPeriods(conn, id, periods) { assert.equal(conn, connection); assert.equal(id, 7); assert.deepEqual(periods, [1, 2]); return [] },
      async insertInstallment() { return { insertId: 31 } },
      async insertPaymentRecord() {},
      async countPaidPeriods() { return 2 },
      async markBoughtOut() {}
    }
  })
  const result = await service.recordPayment(7, { period_numbers: [2, 1, 1], remarks: '  收款  ' }, 4)
  assert.deepEqual(result, { message: '月供已登记', inserted: [{ id: 31 }, { id: 31 }] })
  assert.deepEqual(calls, ['schema', 'begin', 'commit', 'release'])
})

test('rental payment service rolls back invalid daily payment and releases the connection', async () => {
  const calls = []
  const connection = {
    async beginTransaction() { calls.push('begin') },
    async commit() { calls.push('commit') },
    async rollback() { calls.push('rollback') },
    release() { calls.push('release') }
  }
  const service = new Service({
    ensureSchema: async () => {},
    databaseProvider: { async getConnection() { return connection } },
    repository: { async getPaymentRental() { return { billing_mode: 'daily', status: 'active' } } }
  })
  await assert.rejects(() => service.recordPayment(7, { amount: 0 }, 4), /请输入正确的收款金额/)
  assert.deepEqual(calls, ['begin', 'rollback', 'release'])
})

test('rental payment repository binds IDs and keeps payment writes on the transaction connection', async () => {
  const calls = []
  const repository = new Repository({ getDb: () => ({ execute: async () => [[], []] }) })
  const connection = { async execute(sql, params) { calls.push({ sql, params }); return sql.includes('COUNT') ? [[{ count: 2 }]] : [[{ insertId: 4 }]] } }
  const rental = await repository.getPaymentRental(connection, '007')
  assert.deepEqual(rental, { insertId: 4 })
  await repository.findPaidPeriods(connection, 7, [1, 2])
  await repository.insertInstallment(connection, { rentalId: 7, amount: 550, periodNumber: 1, operatorId: 4, remarks: null })
  await repository.insertPaymentRecord(connection, { saleId: 12, customerId: 9, paymentMethod: 'cash', paymentChannel: null, amount: 550, remarks: 'memo' })
  assert.equal(await repository.countPaidPeriods(connection, 7), 2)
  await repository.markBoughtOut(connection, 7)
  await repository.insertDailyPayment(connection, { rentalId: 7, amount: 20, operatorId: 4, remarks: null })
  assert.deepEqual(calls.map(call => call.params), [['007'], [7, 1, 2], [7, 550, 1, 4, null], [12, 9, 'cash', null, 550, 'memo'], [7], [7], [7, 20, 4, null]])
  assert.ok(calls.every(call => !call.sql.includes('FOR UPDATE') || call.params.length > 0))
})
