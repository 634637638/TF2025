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
