'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const Controller = require('../src/controllers/subsidy-update.controller')
const Service = require('../src/services/subsidy-update.service')

const routeSource = fs.readFileSync(path.join(__dirname, '../src/routes/subsidy.js'), 'utf8')

test('subsidy update route preserves authorization order and delegates to controller', () => {
  assert.match(routeSource, /router\.put\(\s*'\/:id',\s*unifiedAuth,\s*requirePermission\('subsidy:edit'\),\s*requireSubsidyApprovalWhenChangingApplyTime,\s*requireSubsidyArrivalWhenChangingArrivalTime,\s*rejectHiddenSubsidyWriteFields,\s*subsidyUpdateController\.update\.bind\(subsidyUpdateController\)\s*\)/)
  assert.doesNotMatch(routeSource, /syncSubsidyPhotoDirectory|UPDATE national_subsidies/)
})

test('subsidy update service returns 404 and rejects invalid price before updating the subsidy record', async () => {
  const updates = []
  const service = new Service({
    repository: {
      async findExisting(id) { return id === 'missing' ? null : { customer_id: 8, subsidy_photos: '[]' } },
      async updateCustomerIdCard(...args) { updates.push(['idcard', ...args]) },
      async updateSubsidy(...args) { updates.push(['subsidy', ...args]) }
    },
    logger: { warn() {} }
  })

  assert.deepEqual(await service.update('missing', {}), {
    status: 404,
    body: { success: false, message: '国补记录不存在' }
  })
  assert.deepEqual(await service.update('9', { customer_idcard: ' 123 ', sale_price: '' }), {
    status: 400,
    body: { success: false, message: '销售价格不能为空' }
  })
  assert.deepEqual(updates, [['idcard', 8, '123']])
})

test('subsidy update service persists canonical fields, mirrors sale date and invalidates cache', async () => {
  const events = []
  const service = new Service({
    repository: {
      async findExisting() { return { customer_id: 8, subsidy_photos: '[]' } },
      async updateCustomer(...args) { events.push(['customer', ...args]) },
      async getStoreName(id) { return id === 3 ? '直营店' : null },
      async updateSubsidy(id, fields, values) { events.push(['subsidy', id, fields, values]) },
      async getPhotoDirectoryNamingInput() { return null },
      async getPhoneId() { return 12 },
      async updatePhoneSaleTime(...args) { events.push(['phone-sale-time', ...args]) }
    },
    invalidateCache(route) { events.push(['cache', route]) },
    logger: { warn() {} }
  })

  assert.deepEqual(await service.update('9', {
    customer_name: '李四',
    customer_phone: '13800000000',
    sale_time: '2026-11-07',
    sale_price: '1200',
    store_id: 3,
    apply_time: '2026-11-01T12:00:00',
    has_different_handler: false
  }), { status: 200, body: { success: true, message: '更新成功' } })

  const [, , fields, values] = events.find(event => event[0] === 'subsidy')
  assert.ok(fields.includes('sale_price = ?'))
  assert.ok(fields.includes('apply_time = ?'))
  assert.ok(fields.includes('store_id = ?'))
  assert.ok(fields.includes('handler_name = NULL'))
  assert.ok(!fields.includes('updated_at = NOW()'))
  assert.ok(values.includes('1200.00'))
  assert.ok(values.includes('2026-11-01 00:00:00'))
  assert.deepEqual(events.find(event => event[0] === 'phone-sale-time'), ['phone-sale-time', 12, '2026-11-07 00:00:00'])
  assert.deepEqual(events.at(-1), ['cache', '/subsidy'])
})

test('subsidy update controller maps service results and keeps the existing error response', async () => {
  const response = () => ({
    status(code) { this.statusCode = code; return this },
    json(body) { this.body = body; return this }
  })
  const controller = new Controller({
    service: { async update(id, body) { assert.deepEqual([id, body], ['4', { sale_price: 1 }]); return { status: 400, body: { success: false, message: 'invalid' } } } },
    logger: { error() {} }
  })
  const invalid = response()
  await controller.update({ params: { id: '4' }, body: { sale_price: 1 } }, invalid)
  assert.equal(invalid.statusCode, 400)
  assert.deepEqual(invalid.body, { success: false, message: 'invalid' })

  controller.service.update = async () => { throw new Error('database unavailable') }
  const failed = response()
  await controller.update({ params: { id: '4' }, body: {} }, failed)
  assert.equal(failed.statusCode, 500)
  assert.deepEqual(failed.body, { success: false, message: '更新失败', error: 'database unavailable' })
})
