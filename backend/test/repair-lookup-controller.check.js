'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const RepairLookupController = require('../src/controllers/repair-lookup.controller')
const RepairLookupService = require('../src/services/repair-lookup.service')
const RepairLookupRepository = require('../src/repositories/repair-lookup.repository')

const response = () => ({
  status(code) { this.statusCode = code; return this },
  json(body) { this.body = body; return this }
})

test('repair lookup routes retain authentication, permissions and personnel search audit', () => {
  const route = fs.readFileSync(path.join(__dirname, '../src/routes/repairs.js'), 'utf8')
  assert.match(route, /router\.get\('\/options', unifiedAuth, requirePermission\('repairs:view'\), repairLookupController\.options\.bind\(repairLookupController\)\)/)
  assert.match(route, /router\.get\('\/customers\/search', unifiedAuth, requireAnyPermission\(\['repairs:view', 'repairs:create', 'repairs:edit'\]\), repairLookupController\.searchCustomers\.bind\(repairLookupController\)\)/)
  assert.match(route, /router\.get\('\/devices\/search', unifiedAuth, requirePermission\('repairs:view'\), repairLookupController\.searchDevices\.bind\(repairLookupController\)\)/)
})

test('repair lookup options retain hidden-field filtering and technician name fallback', async () => {
  const service = new RepairLookupService({
    repository: { async getOptions() {
      return {
        brands: [{ id: 1 }], models: [{ id: 2 }], colors: [{ id: 3 }], memories: [{ id: 4 }],
        technicians: [{ id: 5, name: '', username: 'tech' }]
      }
    } },
    getHiddenFields: async () => new Set(['device_info.brand_name', 'device_info.memory_size']),
    searchCustomers: async () => ({ records: [] })
  })

  assert.deepEqual(await service.getOptions({ user: { id: 1 } }), {
    brands: [], models: [{ id: 2 }], colors: [{ id: 3 }], memories: [], technicians: [{ id: 5, name: 'tech' }]
  })
})

test('repair customer lookup keeps short-query response, authorized searchable fields and masking', async () => {
  const calls = []
  const service = new RepairLookupService({
    repository: {},
    getHiddenFields: async () => new Set(['customer_info.customer_name']),
    searchCustomers: async options => {
      calls.push(options)
      return { records: [{ id: 7, name: 'Hidden', phone: '13800000000' }] }
    }
  })

  assert.deepEqual(await service.searchCustomersForRepair({ query: { keyword: ' a ' } }), {
    data: [], message: '请输入至少2位姓名或手机号'
  })
  assert.deepEqual(await service.searchCustomersForRepair({ query: { keyword: '138', page: '2', page_size: '5' } }), {
    data: [{ id: 7, name: null, phone: '13800000000' }], message: '客户检索成功'
  })
  assert.deepEqual(calls[0], {
    keyword: '138', page: '2', page_size: '5', fields: ['id', 'name', 'phone'], search_fields: ['phone']
  })

  const denied = new RepairLookupService({
    repository: {}, getHiddenFields: async () => new Set(['customer_info.customer_name', 'customer_info.customer_phone']),
    searchCustomers: async () => assert.fail('search must not run without visible search fields')
  })
  await assert.rejects(denied.searchCustomersForRepair({ query: { keyword: 'Lin' } }), error => (
    error.statusCode === 403 && error.code === 'FIELD_PERMISSION_DENIED'
  ))
})

test('repair device lookup retains query length rule, database masking and exact-match inputs', async () => {
  const calls = []
  const row = {
    phone_id: 10, imei: '123', serial_number: 'SN', brand_id: 1, brand_name: 'Brand',
    model_id: 2, model_name: 'Model', color_id: 3, color_name: 'Color', memory_id: 4, memory_size: '128G',
    customer_id: 8, customer_name: 'Customer', customer_phone: '13800000000'
  }
  const service = new RepairLookupService({
    repository: { async searchDevices(keyword) { calls.push(keyword); return [row] } },
    getHiddenFields: async () => new Set(['device_info.imei', 'customer_info.customer_phone']),
    searchCustomers: async () => ({ records: [] })
  })

  assert.deepEqual(await service.searchDevicesForRepair({ query: { q: 'x' } }), {
    data: [], message: '请输入至少 2 位设备编号'
  })
  const result = await service.searchDevicesForRepair({ query: { q: 'SN1' } })
  assert.deepEqual(calls, ['SN1'])
  assert.deepEqual(result, {
    data: [{ ...row, imei: null, customer_phone: null }], message: '设备检索成功'
  })
})

test('repair lookup controller maps permission denial and repository failures to established responses', async () => {
  const controller = new RepairLookupController({
    service: {
      async searchCustomersForRepair() { throw Object.assign(new Error('没有可用的客户检索字段'), { statusCode: 403, code: 'FIELD_PERMISSION_DENIED' }) },
      async options() { throw new Error('database unavailable') }
    },
    logger: { error() {} }
  })
  const denied = response()
  await controller.searchCustomers({ query: {} }, denied)
  assert.equal(denied.statusCode, 403)
  assert.deepEqual(denied.body, { success: false, message: '没有可用的客户检索字段', code: 'FIELD_PERMISSION_DENIED' })

  const failedController = new RepairLookupController({
    service: { async getOptions() { throw new Error('database unavailable') } },
    logger: { error() {} }
  })
  const failed = response()
  await failedController.options({}, failed)
  assert.equal(failed.statusCode, 500)
  assert.equal(failed.body.message, '服务器内部错误，请稍后重试')
})

test('repair lookup repository uses the schema-checked database provider and binds device search values', async () => {
  const calls = []
  let providerCalls = 0
  const repository = new RepairLookupRepository({
    async getDatabase() {
      providerCalls += 1
      return { async execute(sql, params) {
        calls.push({ sql, params })
        return [[]]
      } }
    }
  })
  await repository.getOptions()
  await repository.searchDevices("x%' OR 1=1 --")
  assert.equal(providerCalls, 2)
  assert.equal(calls.length, 6)
  assert.deepEqual(calls[5].params, ["%x%' OR 1=1 --%", "%x%' OR 1=1 --%", "x%' OR 1=1 --", "x%' OR 1=1 --"])
  assert.match(calls[5].sql, /WHERE p\.imei LIKE \? OR p\.serial_number LIKE \?/)
  assert.match(calls[5].sql, /LIMIT 20/)
})
