const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const PhoneProductController = require('../src/controllers/phone-product.controller')

const responseHelper = {
  success(res, data, message) {
    res.body = { success: true, data, message }
    return res
  },
  badRequest(res, message) {
    res.statusCode = 400
    res.body = { success: false, message }
    return res
  },
  error(res, message, statusCode) {
    res.statusCode = statusCode
    res.body = { success: false, message }
    return res
  }
}

const makeResponse = () => ({})

test('H5上架查询保留默认状态及既有响应', async () => {
  const calls = []
  const controller = new PhoneProductController({
    service: { async getPhoneH5Product(id) { calls.push(id); return null } },
    response: responseHelper
  })
  const response = makeResponse()

  await controller.getH5Product({ params: { id: '12' } }, response)

  assert.deepEqual(calls, ['12'])
  assert.deepEqual(response.body, {
    success: true,
    data: { is_published: 1 },
    message: '未找到上架信息，默认上架'
  })
})

test('H5上架更新只接受数值 0 或 1，并调用既有服务契约', async () => {
  const calls = []
  const controller = new PhoneProductController({
    service: { async updatePhoneH5Product(...args) { calls.push(args) } },
    response: responseHelper
  })
  const invalid = makeResponse()
  await controller.updateH5Product({ params: { id: '12' }, body: { is_published: '1' } }, invalid)
  assert.equal(invalid.statusCode, 400)
  assert.equal(calls.length, 0)

  const published = makeResponse()
  await controller.updateH5Product({ params: { id: '12' }, body: { is_published: 1 } }, published)
  assert.deepEqual(calls, [['12', { is_published: 1 }]])
  assert.deepEqual(published.body, { success: true, data: null, message: '已上架' })
})

test('验机信息保存保留字段和默认值', async () => {
  let saveArgs
  const controller = new PhoneProductController({
    service: { async saveProductInspection(...args) { saveArgs = args } },
    response: responseHelper
  })
  const response = makeResponse()
  const body = {
    condition_grade: 'A',
    battery_status: 'good',
    screen_condition: 'replaced',
    system_version: 'iOS',
    model_version: 'CN',
    warranty_date: '2026-12-01',
    is_warranty_expired: true,
    sale_price: 2999
  }

  await controller.saveInspection({ params: { id: '12' }, body }, response)

  assert.deepEqual(saveArgs, ['12', body])
  assert.deepEqual(response.body, { success: true, data: null, message: '验机信息保存成功' })

  await controller.saveInspection({ params: { id: '13' }, body: {} }, makeResponse())
  assert.deepEqual(saveArgs, ['13', {
    condition_grade: null,
    battery_status: '',
    screen_condition: 'original',
    system_version: '',
    model_version: '',
    warranty_date: null,
    is_warranty_expired: false,
    sale_price: null
  }])
})

test('验机信息查询保留空值响应和路由认证权限', async () => {
  const controller = new PhoneProductController({
    service: { async getProductInspection() { return null } },
    response: responseHelper
  })
  const response = makeResponse()

  await controller.getInspection({ params: { id: '12' } }, response)

  assert.deepEqual(response.body, { success: true, data: null, message: '暂无验机信息' })

  const routePath = path.join(__dirname, '../src/routes/phones.js')
  const route = fs.readFileSync(routePath, 'utf8')
  assert.ok(route.includes("router.get('/:id/h5-product',\n  unifiedAuth,\n  requirePermission('inventory:view'),\n  phoneProductController.getH5Product.bind(phoneProductController)\n)"))
  assert.ok(route.includes("router.put('/:id/h5-product',\n  unifiedAuth,\n  requirePermission('inventory:edit'),\n  phoneProductController.updateH5Product.bind(phoneProductController)\n)"))
  assert.ok(route.includes("router.post('/:id/inspection',\n  unifiedAuth,\n  requirePermission('inventory:edit'),\n  phoneProductController.saveInspection.bind(phoneProductController)\n)"))
  assert.ok(route.includes("router.get('/:id/inspection',\n  unifiedAuth,\n  requirePermission('inventory:view'),\n  phoneProductController.getInspection.bind(phoneProductController)\n)"))
})
