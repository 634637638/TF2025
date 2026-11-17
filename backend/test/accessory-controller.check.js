'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const AccessoryController = require('../src/controllers/accessory.controller')
const AccessoryService = require('../src/services/accessory.service')
const ApiResponse = require('../src/utils/response')
const capabilities = require('../src/config/module-permission-capabilities.json')
const permissionMapping = require('../src/config/permission-mapping')

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

test('旧客户端提交已停用贴膜开关时明确拒绝，不能忽略后假装保存模板成功', async () => {
  const service = new AccessoryService({ repository: { withConnection() { assert.fail('停用字段不能进入写事务') } } })
  const controller = new AccessoryController({ service, logger: { error() {} } })
  for (const value of [0, 1]) {
    const res = createResponse()
    await controller.create({ body: { name: '测试膜', film_enabled: value, free_film: 1 } }, res)
    assert.equal(res.statusCode, 400)
    assert.equal(res.body.code, 'VALIDATION_ERROR')
    assert.match(res.body.message, /已停用/)
  }
})

test('商品列表隐藏字段不能通过独立颜色或适配型号筛选反推', async () => {
  for (const [key, field] of [['color_id', 'basic_info.color_name'], ['model_name', 'basic_info.model_name']]) {
    const controller = new AccessoryController({
      service: { async getAccessories() { assert.fail('隐藏字段不得查询仓储') } },
      masking: { async getUserFieldPermissions() { return { hiddenFields: [field] } } }
    })
    const res = createResponse()
    await controller.list({ user: { id: 7 }, query: { [key]: key === 'color_id' ? '1' : 'iPhone17' } }, res)
    assert.equal(res.statusCode, 403)
    assert.equal(res.body.code, 'FIELD_PERMISSION_DENIED')
    assert.equal(res.body.field, field)
  }
})

test('综合查询商品候选独立使用商品字段，配件管理候选保留自身配置', async () => {
  const controller = new AccessoryController({
    service: { async getSaleOptions(_actor, _query, searchFields, includePurchaseCost) {
      assert.equal(searchFields.includes('barcode'), includePurchaseCost)
      return { data: [{ name: '充电器', barcode: '000BAR', purchase_cost: 10 }], pagination: { total: 1 } }
    } },
    masking: { async getUserFieldPermissions(_id, moduleKey, options) {
      assert.equal(moduleKey, options.fieldScope === 'goods' ? 'query_queryview' : 'accessories_accessoriesview')
      return { hiddenFields: options.fieldScope === 'goods' ? ['basic_info.barcode', 'price_info.purchase_cost'] : [] }
    }, filterSensitiveFields: rows => rows }, response: createResponseHelper()
  })
  const request = { user: { id: 7 }, query: { store_id: '1', search: '充电器' } }
  let res = createResponse()
  await controller.querySaleOptions(request, res, assert.ifError)
  assert.equal(res.body.success, true)
  assert.equal(res.body.data.data[0].purchase_cost, null)
  assert.equal(res.body.data.data[0].barcode, null)
  res = createResponse()
  await controller.saleOptions(request, res, assert.ifError)
  assert.equal(res.body.data.data[0].purchase_cost, 10)
  assert.equal(res.body.data.data[0].barcode, '000BAR')
})

test('多颜色采购入口逐条检查隐藏字段，不能通过entries绕过数量、成本、颜色或SN权限', async () => {
  const router = require('../src/routes/accessories')
  const handler = router.stack.find(layer => layer.route?.path === '/stock-in').route.stack[2].handle
  const entry = { accessory_id: 5, color_id: 1, total_quantity: 2, purchase_cost: 10, supplier_id: 8, store_id: 1,
    barcode: '00WHITE', serial_numbers: [{ serial_number: '00SN', store_id: 1 }], inventory_time: '2026-11-14 12:30:00' }
  for (const field of ['basic_info.name', 'basic_info.color_name', 'stock_info.total_quantity', 'stock_info.distribution',
    'price_info.purchase_cost', 'basic_info.supplier_name', 'basic_info.usage_type', 'basic_info.barcode', 'basic_info.serial_number', 'time_info.inventory_time']) {
    const res = createResponse()
    await handler({ user: { id: 7 }, fieldPermissions: { hiddenFields: [field] }, body: { entries: [entry] } }, res, () => assert.fail('隐藏字段不能通过'))
    assert.equal(res.statusCode, 403)
    assert.equal(res.body.field, field)
  }
  for (const entries of [null, [], {}, Array(101).fill(entry)]) {
    const res = createResponse()
    await handler({ user: { id: 7 }, fieldPermissions: { hiddenFields: [] }, body: { entries } }, res, () => assert.fail('无效颜色列表不能通过'))
    assert.equal(res.statusCode, 400)
  }
  let passed = false
  const { barcode, serial_numbers, ...plain } = entry
  await handler({ user: { id: 7 }, fieldPermissions: { hiddenFields: ['basic_info.barcode', 'basic_info.serial_number'] }, body: { entries: [plain] } }, createResponse(), error => {
    assert.ifError(error); passed = true
  })
  assert.equal(passed, true)
})

test('控制器保留整组防重请求，批次回执递归脱敏，使用当前已核验权限', async () => {
  const entries = [{ accessory_id: 5, total_quantity: 2, purchase_cost: 10 }]
  const controller = new AccessoryController({ service: { async stockIn(data, actor) {
    assert.deepEqual(data, { entries, request_key: 'e'.repeat(32), operator_id: 7, operator_name: '入库员' })
    assert.equal(actor.id, 7)
    return { success: true, data: { batches: [{ stock_in_id: 1, quantity: 2, total_amount: 20, accessory_id: 5, replayed: false }], replayed: false } }
  } }, masking: { async getUserFieldPermissions() { assert.fail('不能在入库成功后重新读取权限') }, filterSensitiveFields(items) { return items } }, response: createResponseHelper() })
  const res = createResponse()
  await controller.stockIn({ user: { id: 7, name: '入库员' }, fieldPermissions: { hiddenFields: ['price_info.total_amount'] }, body: {
    request_key: 'e'.repeat(32), entries, operator_id: 999, total_quantity: 888
  } }, res)
  assert.equal(res.body.success, true)
  assert.equal(res.body.data.batches[0].total_amount, null)
  assert.equal(res.body.data.batches[0].quantity, 2)
})

for (const [action, method] of [
  ['list', 'getAccessories'], ['getById', 'getAccessoryDetail'], ['getByBarcode', 'getAccessoryByBarcode'],
  ['entryOptions', 'getEntryOptions'], ['productCatalog', 'getProductCatalog'], ['getSettings', 'getSettings'],
  ['listInventoryBatches', 'getInventoryBatches'], ['saleOptions', 'getSaleOptions'], ['listTransfers', 'getTransfers'],
  ['listStockInRecords', 'getStockInRecords'], ['getStock', 'getInventoryLocations'], ['listStock', 'getStockList'],
  ['listStockWarnings', 'getLowStockWarnings'], ['listSerials', 'getSerials'], ['serialTrace', 'getSerialTrace'],
  ['getCategoryStats', 'getCategoryStats'], ['stockCorrectionOptions', 'options'], ['stockCorrectionContext', 'context']
]) {
  test(`商品 ${action} 连接故障通过公共错误边界返回503，不泄露内部错误`, async () => {
    const errorHandler = require('../src/middleware/error-handler')
    for (const code of ['ETIMEDOUT', 'ECONNRESET', 'PROTOCOL_CONNECTION_LOST']) {
      const failure = Object.assign(new Error('synthetic database connection failure'), { code })
      const dependency = { async [method]() { throw failure } }
      const controller = new AccessoryController({
        service: dependency, correctionService: dependency,
        masking: { getUserFieldPermissions: async () => ({ hiddenFields: [] }) }
      })
      const req = { user: { id: 5 }, query: {}, params: { id: '1', barcode: 'sample', serialNumber: 'TEST-SN' },
        method: 'GET', originalUrl: '/api/accessories', requestId: 'synthetic-accessory-read' }
      const res = createResponse()
      let forwarded = 0
      await controller[action](req, res, error => {
        forwarded++
        assert.equal(error, failure)
        return errorHandler(error, req, res, () => {})
      })
      assert.equal(forwarded, 1)
      assert.equal(res.statusCode, 503)
      assert.equal(res.body.code, 'DB_CONNECTION_ERROR')
      assert.equal(res.body.request_id, req.requestId)
      assert.equal(res.body.message, '服务器内部错误，请稍后重试')
      assert.equal(res.body.error, undefined)
      assert.equal(res.body.stack, undefined)
    }
  })
}

for (const [method, args] of [
  ['getAccessories', [{}]], ['getAccessoryDetail', [1]], ['getAccessoryByBarcode', ['TEST-BARCODE']],
  ['getStockList', [{}]], ['getStockInRecords', [{}]], ['getCategoryStats', [{}]], ['getLowStockWarnings', [{}]]
]) {
  test(`商品服务 ${method} 保留原数据库连接异常，允许公共读取恢复`, async () => {
    for (const code of ['ETIMEDOUT', 'ECONNRESET', 'PROTOCOL_CONNECTION_LOST']) {
      const failure = Object.assign(new Error('synthetic database connection failure'), { code })
      const reject = async () => { throw failure }
      const service = new AccessoryService({ repository: {
        withConnection: reject, getStockInRecords: reject, getCategoryStats: reject, getLowStockAccessories: reject
      } })
      await assert.rejects(service[method](...args, { id: 5, store_id: 2, store_ids: [2] }), error => error === failure)
    }
  })
}

test('入库超时不重放写请求，也不作为可自动恢复的读取返回', async () => {
  let writes = 0
  const controller = new AccessoryController({ service: {
    async stockIn() { writes++; throw Object.assign(new Error('synthetic timeout'), { code: 'ETIMEDOUT' }) }
  } })
  const res = createResponse()
  await controller.stockIn({ user: { id: 5 }, body: {} }, res, () => assert.fail('写请求不能转为读取重试'))
  assert.equal(writes, 1)
  assert.equal(res.statusCode, 500)
})

for (const [action, method] of [
  ['list', 'getAccessories'], ['getById', 'getAccessoryDetail'], ['getByBarcode', 'getAccessoryByBarcode'],
  ['create', 'createAccessory'], ['update', 'updateAccessory'], ['remove', 'deleteAccessory'],
  ['stockIn', 'stockIn'], ['listStockInRecords', 'getStockInRecords'], ['listStock', 'getStockList'],
  ['listStockWarnings', 'getLowStockWarnings'], ['getCategoryStats', 'getCategoryStats']
]) {
  test(`配件 ${action} 的数据库故障返回 500 且不泄露内部错误`, async () => {
    const failure = new AccessoryService({ repository: {} }).error('模拟内部数据库故障', 'DATABASE_ERROR')
    assert.equal(failure.statusCode, 500)
    const controller = new AccessoryController({
      service: { [method]: async () => failure },
      masking: { getUserFieldPermissions: async () => ({ hiddenFields: [] }) },
      response: ApiResponse
    })
    const response = createResponse()
    await controller[action]({ user: { id: 5 }, query: {}, params: { id: '1', barcode: 'sample' }, body: {} }, response)
    assert.equal(response.statusCode, 500)
    assert.equal(response.body.success, false)
    assert.equal(response.body.message, '服务器内部错误，请稍后重试')
    assert.equal(JSON.stringify(response.body).includes('模拟内部数据库故障'), false)
  })
}

for (const action of ['getById', 'getByBarcode']) {
  test(`配件 ${action} 真正不存在时继续返回 404`, async () => {
    const method = action === 'getById' ? 'getAccessoryDetail' : 'getAccessoryByBarcode'
    const controller = new AccessoryController({
      service: { [method]: async () => ({ success: false, code: 'NOT_FOUND', message: '配件不存在' }) },
      response: ApiResponse
    })
    const response = createResponse()
    await controller[action]({ params: { id: '1', barcode: 'sample' } }, response)
    assert.equal(response.statusCode, 404)
    assert.equal(response.body.message, '配件不存在')
  })
}

test('商品资料路由使用独立的查看、新增和编辑权限', () => {
  const routes = readFileSync(require.resolve('../src/routes/accessories'), 'utf8')
  assert.deepEqual(capabilities.modules.accessories_accessorycatalogview, ['view', 'create', 'edit'])
  assert.deepEqual(permissionMapping['accessories-catalog:view'], ['accessories_accessorycatalogview:view'])
  assert.deepEqual(permissionMapping['accessories-catalog:create'], ['accessories_accessorycatalogview:create'])
  assert.deepEqual(permissionMapping['accessories-catalog:edit'], ['accessories_accessorycatalogview:edit'])
  assert.match(routes, /router\.get\('\/catalog', unifiedAuth, requirePermission\('accessories-catalog:view'\)/)
  assert.match(routes, /router\.post\('\/catalog\/:kind', unifiedAuth, requirePermission\('accessories-catalog:create'\)/)
  assert.match(routes, /router\.put\('\/catalog\/:kind\/:id', unifiedAuth, requirePermission\('accessories-catalog:edit'\)/)
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
  assert.deepEqual(serviceParams.search_fields, ['name', 'brand_name', 'model_name', 'product_model', 'color_name'])
  assert.equal(serviceParams.page_size, '20')
  assert.equal(response.body.data.data[0].barcode, null)
  assert.equal(response.body.data.data[0].purchase_cost, null)
  assert.equal(response.body.data.data[0].total_stock, 3)
  assert.equal(response.body.data.data[0].profit, null)
  assert.equal('stock' in response.body.data.data[0], false)
})

test('模板查询支持全部/启用/停用，状态隐藏不能借全部状态筛选绕过', async () => {
  const calls = []
  let hiddenFields = []
  const controller = new AccessoryController({
    service: { async getAccessories(params) { calls.push(params); return { success: true, data: { data: [] } } } },
    masking: { async getUserFieldPermissions() { return { hiddenFields } }, filterSensitiveFields: items => items },
    response: createResponseHelper()
  })
  for (const [input, expected] of [[undefined, 1], ['all', null], ['0', '0'], ['1', '1']]) {
    await controller.list({ user: { id: 5 }, query: input === undefined ? {} : { status: input } }, createResponse())
    assert.equal(calls.at(-1).status, expected)
  }
  const before = calls.length
  const invalid = createResponse()
  await controller.list({ user: { id: 5 }, query: { status: 'invalid' } }, invalid)
  assert.equal(invalid.statusCode, 400)
  hiddenFields = ['status_info.status']
  const denied = createResponse()
  await controller.list({ user: { id: 5 }, query: { status: 'all' } }, denied)
  assert.equal(denied.statusCode, 403)
  assert.equal(calls.length, before)
})

test('模板新增关联字段随分类/单位/适配机型权限一起脱敏，检索不使用隐藏字段', async () => {
  let searchFields
  const controller = new AccessoryController({
    service: { async getAccessories(params) {
      searchFields = params.search_fields
      return { success: true, data: { data: [{ id: 1, category_id: 11, unit_id: 1, model_ids: [20], compatible_model_names: '机型', compatible_brand_names: '苹果 / 华为' }] } }
    } },
    masking: { async getUserFieldPermissions() { return { hiddenFields: ['basic_info.category', 'basic_info.unit', 'basic_info.model_name'] } }, filterSensitiveFields: items => items },
    response: createResponseHelper()
  })
  const result = createResponse()
  await controller.list({ user: { id: 5 }, query: { search: '机型' } }, result)
  for (const key of ['category_id', 'unit_id', 'model_ids', 'compatible_model_names', 'compatible_brand_names']) assert.equal(result.body.data.data[0][key], null)
  assert.equal(searchFields.includes('category'), false)
  assert.equal(searchFields.includes('model_name'), false)
})

test('配件入库只转发规范字段并从已认证用户填充操作员', async () => {
  const calls = []
  const controller = new AccessoryController({
    service: {
      async stockIn(data) {
        calls.push(['stockIn', data])
        return { success: true, data: { id: 21 }, message: '入库成功' }
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
      request_key: 'a'.repeat(32), name: '手机壳', purchase_cost: 8, sale_price: 12, total_quantity: 4, usage_type: 'gift',
      distribution: [{ store_id: 2, quantity: 4 }], customer_name: '顾客',
      quantity: 1, unit_price: 12, ignored_field: 'must-not-pass'
    }
  }

  await controller.stockIn(req, createResponse())

  assert.deepEqual(calls[0][1], {
    request_key: 'a'.repeat(32),
    barcode: undefined,
    accessory_id: undefined,
    name: '手机壳',
    category: undefined,
    category_id: undefined,
    product_model: undefined,
    usage_type: 'gift',
    serial_tracking: undefined,
    serial_numbers: undefined,
    brand_id: undefined,
    model_id: undefined,
    model_ids: undefined,
    color_id: undefined,
    supplier_id: undefined,
    purchase_cost: 8,
    sale_price: 12,
    unit: undefined,
    unit_id: undefined,
    status: undefined,
    min_stock: undefined,
    free_film: undefined,
    total_quantity: 4,
    distribution: [{ store_id: 2, quantity: 4 }],
    store_id: undefined,
    remarks: undefined,
    description: undefined,
    image_url: undefined,
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


test('商品模式仅接受模板或库存；模板关联ID随商品名称字段脱敏且不可由请求伪造', async () => {
  const calls = []
  const controller = new AccessoryController({
    service: {
      async getAccessories(params) { calls.push(params); return { success: true, data: { data: [{ id: 56, template_id: 55, name: '商品' }] } } },
      async stockIn(data) { assert.equal(data.template_id, undefined); return { success: true, data: {} } }
    },
    masking: { getUserFieldPermissions: async () => ({ hiddenFields: ['basic_info.name'] }), filterSensitiveFields: items => items },
    response: createResponseHelper()
  })
  const invalid = createResponse()
  await controller.list({ user: { id: 5 }, query: { mode: 'unexpected' } }, invalid)
  assert.equal(invalid.statusCode, 400)
  for (const mode of ['templates', 'inventory']) {
    const result = createResponse()
    await controller.list({ user: { id: 5 }, query: { mode } }, result)
    assert.equal(calls.at(-1).mode, mode)
    assert.equal(result.body.data.data[0].template_id, null)
  }
  await controller.stockIn({ user: { id: 5 }, body: { template_id: 999, accessory_id: 55, brand_id: 3 } }, createResponse())
})
