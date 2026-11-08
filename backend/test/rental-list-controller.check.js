'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const Controller = require('../src/controllers/rental-list.controller')
const Service = require('../src/services/rental-list.service')
const Repository = require('../src/repositories/rental-list.repository')

const routeSource = fs.readFileSync(path.join(__dirname, '../src/routes/rentals.js'), 'utf8')

test('rental list route keeps view permission and delegates to controller', () => {
  assert.match(routeSource, /router\.get\('\/', requirePermission\('rentals:view'\), rentalListController\.list\.bind\(rentalListController\)\)/)
})

test('rental list controller preserves success, hidden-field denial and server error responses', async () => {
  const response = {
    success(...args) { this.successArgs = args; return this },
    serverError(...args) { this.errorArgs = args; return this }
  }
  const controller = new Controller({
    service: { async list() { return { rows: [{ id: 1 }], pagination: { page: 1 }, summary: { active_count: 2 } } } },
    response,
    logger: { error() {} }
  })
  const res = { status(code) { this.statusCode = code; return this }, json(body) { this.body = body; return this } }

  await controller.list({ query: {}, user: { id: 9 } }, res)
  assert.deepEqual(response.successArgs, [res, [{ id: 1 }], '获取租赁合同成功', 200, {
    pagination: { page: 1 },
    summary: { active_count: 2 }
  }])

  const forbiddenController = new Controller({
    service: { async list() { return { forbidden: '不能使用已隐藏的状态筛选字段' } } },
    logger: { error() {} }
  })
  await forbiddenController.list({ query: {}, user: { id: 9 } }, res)
  assert.equal(res.statusCode, 403)
  assert.equal(res.body.code, 'FIELD_PERMISSION_DENIED')

  const errorController = new Controller({
    service: { async list() { throw new Error('database unavailable') } },
    response,
    logger: { error() {} }
  })
  await errorController.list({ query: {}, user: { id: 9 } }, res)
  assert.equal(response.errorArgs[1], '获取租赁合同失败')
})

test('rental list service enforces hidden filters and preserves pagination, schedule, summary and field masking', async () => {
  const calls = []
  const service = new Service({
    repository: {
      async list(options) {
        calls.push(options)
        return {
          rows: [{
            id: 5,
            billing_mode: 'buyout',
            term_months: 3,
            start_date: '2026-01-31',
            sale_store_id: 2,
            sale_operator_id: 4,
            phone_id: 7,
            paid_rent: 120,
            private_value: 'masked'
          }],
          files: [{ id: 11, rental_id: 5, file_name: 'contract.pdf' }],
          payments: [{ rental_id: 5, period_number: 1 }],
          total: 205,
          summary: { active_count: '8', device_count: '9', receivable_amount: '120.50', deposit_amount: '30' }
        }
      }
    },
    masking: {
      async getUserFieldPermissions(userId, moduleKey) {
        assert.equal(userId, 9)
        assert.equal(moduleKey, 'rentals_rentalsview')
        return { hiddenFields: ['sales_info.sale_store_name', 'stats.device_count', 'private_value'] }
      },
      filterSensitiveFields(rows, permissions) {
        assert.ok(permissions.hiddenFields.includes('private_value'))
        return rows.map(({ private_value, ...row }) => row)
      }
    }
  })

  const result = await service.list({ page: 2, page_size: 1000, keyword: '  13800138000  ', billing_mode: 'buyout' }, 9)
  assert.deepEqual(calls[0], {
    page: 2,
    pageSize: 100,
    keyword: '13800138000',
    searchableColumns: ['c.name', 'c.phone', 'p.imei', 'p.serial_number', 'r.contract_number'],
    status: undefined,
    billingMode: 'buyout'
  })
  assert.equal(result.rows[0].next_due_date, '2026-03-31')
  assert.deepEqual(result.rows[0].contract_files, [{
    id: 11,
    file_url: '/api/rentals/5/files/11/download',
    file_name: 'contract.pdf'
  }])
  assert.equal(result.rows[0].paid_rent, 120)
  assert.equal('phone_id' in result.rows[0], false)
  assert.equal('sale_store_id' in result.rows[0], false)
  assert.equal('private_value' in result.rows[0], false)
  assert.deepEqual(result.pagination, {
    page: 2,
    page_size: 100,
    total: 205,
    total_pages: 3,
    has_next: true,
    has_prev: true
  })
  assert.deepEqual(result.summary, {
    active_count: 8,
    device_count: null,
    receivable_amount: 120.5,
    deposit_amount: 30
  })

  const denied = new Service({
    repository: { async list() { assert.fail('hidden filter must not query') } },
    masking: { async getUserFieldPermissions() { return { hiddenFields: ['status_info.status'] } } }
  })
  assert.equal((await denied.list({ status: 'active' }, 9)).forbidden, '不能使用已隐藏的状态筛选字段')
})

test('rental list repository parameterizes filters and returns rows, attachments, payments, count and summary', async () => {
  const calls = []
  const repository = new Repository({ getDb: () => ({
    async execute(sql, params) {
      calls.push({ sql, params })
      if (sql.includes('ORDER BY r.id DESC')) return [[{ id: 5 }]]
      if (sql.includes('rental_contract_files')) return [[{ id: 11, rental_id: 5 }]]
      if (sql.includes('rental_payments') && sql.includes('period_number IS NOT NULL')) return [[{ rental_id: 5, period_number: 1 }]]
      if (sql.includes('COUNT(*) AS total')) return [[{ total: 1 }]]
      return [[{ active_count: 1 }]]
    }
  }) })

  const result = await repository.list({
    page: 1,
    pageSize: 20,
    keyword: 'abc',
    searchableColumns: ['c.name', 'p.imei'],
    status: 'active',
    billingMode: 'buyout'
  })
  assert.equal(result.rows.length, 1)
  assert.equal(result.files.length, 1)
  assert.equal(result.payments.length, 1)
  assert.equal(result.total, 1)
  assert.deepEqual(calls[0].params, ['%abc%', '%abc%', 'active'])
  assert.match(calls[0].sql, /r\.billing_mode IN \('buyout','monthly'\)/)
  assert.match(calls[0].sql, /r\.status = \?/)
  assert.ok(calls.every(call => !call.sql.includes("r.status = 'active'")))
})
