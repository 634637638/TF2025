'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const AccessoryController = require('../src/controllers/accessory.controller')

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

const createResponseHelper = () => ({
  success(res, data, message) {
    res.body = { success: true, data, message }
    return res
  },
  error(res, message, status) {
    res.statusCode = status
    res.body = { success: false, message }
    return res
  }
})

test('配件列表拒绝隐藏筛选字段，并只将可见名称字段交给搜索', async () => {
  let serviceParams
  const controller = new AccessoryController({
    service: {
      async getAccessories(params) {
        serviceParams = params
        return { success: true, data: { total: 1, data: [{ name: '壳', barcode: 'B1', purchase_cost: 8, sale_price: 12, stock: [{ quantity: 3 }] }] } }
      }
    },
    masking: {
      async getUserFieldPermissions() {
        return { hiddenFields: ['basic_info.category', 'basic_info.barcode', 'price_info.purchase_cost'] }
      },
      filterSensitiveFields(items) {
        return items
      }
    },
    response: createResponseHelper()
  })

  const denied = createResponse()
  await controller.list({ user: { id: 5 }, query: { category: '手机壳' } }, denied)
  assert.equal(denied.statusCode, 403)
  assert.equal(denied.body.code, 'FIELD_PERMISSION_DENIED')
  assert.equal(serviceParams, undefined)

  const response = createResponse()
  await controller.list({ user: { id: 5 }, query: { search: '壳', page_size: '20' } }, response)
  assert.deepEqual(serviceParams.search_fields, ['name'])
  assert.equal(serviceParams.page_size, '20')
  assert.equal(response.body.data.data[0].barcode, null)
  assert.equal(response.body.data.data[0].purchase_cost, null)
  assert.equal(response.body.data.data[0].total_stock, 3)
  assert.equal(response.body.data.data[0].profit, 4)
  assert.equal('stock' in response.body.data.data[0], false)
})

test('配件入库和销售只转发规范字段并从已认证用户填充操作员', async () => {
  const calls = []
  const controller = new AccessoryController({
    service: {
      async stockIn(data) {
        calls.push(['stockIn', data])
        return { success: true, data: { id: 21 }, message: '入库成功' }
      },
      async sell(data) {
        calls.push(['sell', data])
        return { success: true, data: { id: 22 }, message: '销售成功' }
      }
    },
    masking: {
      async getUserFieldPermissions() {
        return { hiddenFields: [] }
      },
      filterSensitiveFields(items) {
        return items
      }
    },
    response: createResponseHelper()
  })
  const req = {
    user: { id: 7, name: '员工' },
    body: {
      name: '手机壳', purchase_cost: 8, sale_price: 12, total_quantity: 4,
      distribution: [{ store_id: 2, quantity: 4 }], customer_name: '顾客',
      quantity: 1, unit_price: 12, ignored_field: 'must-not-pass'
    }
  }

  await controller.stockIn(req, createResponse())
  await controller.sell(req, createResponse())

  assert.deepEqual(calls[0][1], {
    barcode: undefined,
    accessory_id: undefined,
    name: '手机壳',
    category: undefined,
    brand_id: undefined,
    model_id: undefined,
    color_id: undefined,
    supplier_id: undefined,
    purchase_cost: 8,
    sale_price: 12,
    unit: undefined,
    specifications: undefined,
    status: undefined,
    min_stock: undefined,
    total_quantity: 4,
    distribution: [{ store_id: 2, quantity: 4 }],
    store_id: undefined,
    remarks: undefined,
    description: undefined,
    image_url: undefined,
    operator_id: 7,
    operator_name: '员工'
  })
  assert.deepEqual(calls[1][1], {
    accessory_id: undefined,
    store_id: undefined,
    customer_id: undefined,
    customer_name: '顾客',
    customer_phone: undefined,
    quantity: 1,
    unit_price: 12,
    remarks: undefined,
    operator_id: 7,
    operator_name: '员工'
  })
  assert.equal(JSON.stringify(calls).includes('ignored_field'), false)
})

test('配件图片签名校验失败时删除上传文件并返回 400', async () => {
  let removedFiles
  const controller = new AccessoryController({
    validateFileSignature: async () => false,
    removeFiles: async files => {
      removedFiles = files
    },
    response: createResponseHelper()
  })
  const file = { filename: 'accessory-image.png' }
  const response = createResponse()

  await controller.upload({ file }, response)

  assert.deepEqual(removedFiles, [file])
  assert.equal(response.statusCode, 400)
  assert.deepEqual(response.body, { success: false, message: '文件内容与图片格式不匹配' })
})
