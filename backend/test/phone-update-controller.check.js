'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const PhoneUpdateController = require('../src/controllers/phone-update.controller')

const createResponse = () => ({
  status(code) {
    this.statusCode = code
    return this
  },
  json(body) {
    this.body = body
    return this
  }
})

const responseHelper = {
  success: (res, data, message) => { res.body = { success: true, data, message }; return res },
  badRequest: (res, message) => { res.status(400).json({ success: false, message }); return res },
  notFound: (res, message) => { res.status(404).json({ success: false, message }); return res },
  serverError: (res, message) => { res.status(500).json({ success: false, message }); return res }
}

test('phone update controller preserves success and business error response mapping', async () => {
  const controller = new PhoneUpdateController({
    service: { async update() { return { id: 9 } } },
    response: responseHelper
  })
  const success = createResponse()
  await controller.update({ params: { id: '9' } }, success)
  assert.deepEqual(success.body, { success: true, data: { id: 9 }, message: '手机更新成功' })

  controller.service.update = async () => { throw Object.assign(new Error('手机不存在'), { status: 404 }) }
  const missing = createResponse()
  await controller.update({}, missing)
  assert.equal(missing.statusCode, 404)
  assert.equal(missing.body.message, '手机不存在')

  controller.service.update = async () => { throw Object.assign(new Error('缺少权限'), { status: 403, code: 'INSUFFICIENT_PERMISSIONS' }) }
  const forbidden = createResponse()
  await controller.update({}, forbidden)
  assert.equal(forbidden.statusCode, 403)
  assert.equal(forbidden.body.code, 'INSUFFICIENT_PERMISSIONS')
})

test('phone update controller maps validation and database errors separately', async () => {
  const controller = new PhoneUpdateController({
    service: { async update() { throw new Error('缺少IMEI号') } },
    response: responseHelper,
    logger: { error() {} }
  })
  const invalid = createResponse()
  await controller.update({}, invalid)
  assert.equal(invalid.statusCode, 400)
  assert.equal(invalid.body.message, '缺少IMEI号')

  controller.service.update = async () => { throw Object.assign(new Error('database unavailable'), { code: 'ECONNRESET' }) }
  const failed = createResponse()
  await controller.update({}, failed)
  assert.equal(failed.statusCode, 500)
})

test('库存编辑使用库存字段与动作，不能借综合查询授权改写只读字段；无效模块在读取前拒绝', async () => {
  const PhoneUpdateService = require('../src/services/phone-update.service')
  const PhoneMutationAccess = require('../src/services/phone-mutation-access.service')
  const FieldAccess = require('../src/services/field-access.service')
  let reads = 0
  const afterAuthorization = new Error('已通过鉴权，停在写入前')
  const phone = { id: 11, status: 'in_stock', brand_id: 1, model_id: 2, color_id: 3, memory_id: 4,
    store_id: 5, imei: 'TESTSERIAL', serial_number: 'TESTSERIAL', is_new: 1, purchase_cost: 10 }
  const fieldSource = moduleKey => new FieldAccess({ moduleKey, masking: {
    async getUserFieldPermissions() { return { hiddenFields: [], readonlyFields: moduleKey === 'inventory_inventoryview' ? ['price_info.purchase_cost'] : [] } }
  } })
  const access = new PhoneMutationAccess({ permissionCheck: async (user, permission) => user.permissions.includes(permission), fields: fieldSource })
  const service = new PhoneUpdateService({ access, repository: {
    withConnection: run => run({}), async getPhoneForUpdate() { reads++; return phone },
    async findDuplicateImei() { throw afterAuthorization }
  } })
  const user = { id: 7, store_ids: [5], permissions: ['query:edit', 'inventory:edit'] }
  for (const value of [0, null, 20]) {
    await assert.rejects(service.update({ params: { id: '11' }, query: { field_module: 'inventory_inventoryview' },
      body: { purchase_cost: value }, user }), { statusCode: 403, code: 'FIELD_PERMISSION_DENIED' })
  }
  await assert.rejects(service.update({ params: { id: '11' }, query: { field_module: 'inventory_inventoryview' },
    body: { remarks: '允许编辑' }, user }), error => error === afterAuthorization)
  await assert.rejects(service.update({ params: { id: '11' }, query: { field_module: 'inventory_inventoryview' },
    body: { remarks: '不能用字段授权代替动作' }, user: { ...user, permissions: ['query:edit'] } }), { statusCode: 403 })
  const previous = reads
  await assert.rejects(service.update({ params: { id: '11' }, query: { field_module: 'unknown' }, body: {}, user }), { status: 400 })
  assert.equal(reads, previous)
})
