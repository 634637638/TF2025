'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ShopManagementController = require('../src/controllers/shop-management.controller')
const ShopService = require('../src/services/shop.service')

const makeResponse = () => ({
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
  success(res, data, message) {
    res.body = { success: true, data, message }
    return res
  },
  created(res, message, data) {
    res.statusCode = 201
    res.body = { success: true, data, message }
    return res
  },
  error(res, message, status) {
    res.statusCode = status
    res.body = { success: false, message }
    return res
  },
  serverError(res, message, error) {
    res.statusCode = 500
    res.body = { success: false, message, error }
    return res
  }
}

test('商城配置和轮播图 controller 保留服务参数及响应契约', async () => {
  const calls = []
  const controller = new ShopManagementController({
    service: {
      async getAllConfigs() { calls.push(['getAllConfigs']); return { general: [] } },
      async getConfigsByCategory(category) { calls.push(['getConfigsByCategory', category]); return [] },
      async updateConfig(key, value) { calls.push(['updateConfig', key, value]) },
      async batchUpdateConfigs(configs) { calls.push(['batchUpdateConfigs', configs]) },
      async getAllBanners() { calls.push(['getAllBanners']); return [{ id: 1 }] },
      async createBanner(data) { calls.push(['createBanner', data]); return { id: 2 } },
      async updateBanner(id, data) { calls.push(['updateBanner', id, data]) },
      async deleteBanner(id) { calls.push(['deleteBanner', id]) },
      async reorderBanners(orders) { calls.push(['reorderBanners', orders]) }
    },
    response: responseHelper
  })

  const responses = Array.from({ length: 9 }, makeResponse)
  const configValue = { value: '商店名称' }
  const configs = [{ key: 'shop_name', value: '商店名称' }]
  const banner = { title: '活动', image_url: '/shop/a.png' }
  const orders = [{ id: 1, sort_order: 0 }]

  await controller.getAllConfigs({}, responses[0])
  await controller.getConfigsByCategory({ params: { category: 'general' } }, responses[1])
  await controller.updateConfig({ params: { key: 'shop_name' }, body: configValue }, responses[2])
  await controller.batchUpdateConfigs({ body: { configs } }, responses[3])
  await controller.getAllBanners({}, responses[4])
  await controller.createBanner({ body: banner }, responses[5])
  await controller.updateBanner({ params: { id: '3' }, body: banner }, responses[6])
  await controller.deleteBanner({ params: { id: '3' } }, responses[7])
  await controller.reorderBanners({ body: { orders } }, responses[8])

  assert.deepEqual(calls, [
    ['getAllConfigs'],
    ['getConfigsByCategory', 'general'],
    ['updateConfig', 'shop_name', '商店名称'],
    ['batchUpdateConfigs', configs],
    ['getAllBanners'],
    ['createBanner', banner],
    ['updateBanner', '3', banner],
    ['deleteBanner', '3'],
    ['reorderBanners', orders]
  ])
  assert.deepEqual(responses[0].body, { success: true, data: { general: [] }, message: '获取配置成功' })
  assert.deepEqual(responses[2].body, { success: true, data: null, message: '更新配置成功' })
  assert.deepEqual(responses[5].body, { success: true, data: { id: 2 }, message: '创建轮播图成功' })
  assert.equal(responses[5].statusCode, 201)
  assert.deepEqual(responses[8].body, { success: true, data: null, message: '更新排序成功' })
})

test('商城管理路由保留每项权限并委托 controller', () => {
  const routePath = path.join(__dirname, '../src/routes/shop.js')
  const route = fs.readFileSync(routePath, 'utf8')
  const routeContracts = [
    /router\.get\('\/config',\s*unifiedAuth,\s*requireAnyPermission\(H5_CONFIG_VIEW_PERMISSIONS\),\s*shopManagementController\.getAllConfigs\.bind\(shopManagementController\)\)/,
    /router\.get\('\/config\/category\/:category',\s*unifiedAuth,\s*requireAnyPermission\(H5_CONFIG_VIEW_PERMISSIONS\),\s*shopManagementController\.getConfigsByCategory\.bind\(shopManagementController\)\)/,
    /router\.put\('\/config\/:key',\s*unifiedAuth,\s*requireAnyPermission\(H5_CONFIG_EDIT_PERMISSIONS\),\s*shopManagementController\.updateConfig\.bind\(shopManagementController\)\)/,
    /router\.post\('\/config\/batch',\s*unifiedAuth,\s*requireAnyPermission\(H5_CONFIG_EDIT_PERMISSIONS\),\s*shopManagementController\.batchUpdateConfigs\.bind\(shopManagementController\)\)/,
    /router\.get\('\/banners',\s*unifiedAuth,\s*requireAnyPermission\(H5_BANNER_VIEW_PERMISSIONS\),\s*shopManagementController\.getAllBanners\.bind\(shopManagementController\)\)/,
    /router\.post\('\/banners',\s*unifiedAuth,\s*requireAnyPermission\(H5_BANNER_CREATE_PERMISSIONS\),\s*shopManagementController\.createBanner\.bind\(shopManagementController\)\)/,
    /router\.put\('\/banners\/:id',\s*unifiedAuth,\s*requireAnyPermission\(H5_BANNER_EDIT_PERMISSIONS\),\s*shopManagementController\.updateBanner\.bind\(shopManagementController\)\)/,
    /router\.delete\('\/banners\/:id',\s*unifiedAuth,\s*requireAnyPermission\(H5_BANNER_DELETE_PERMISSIONS\),\s*shopManagementController\.deleteBanner\.bind\(shopManagementController\)\)/,
    /router\.put\('\/banners\/reorder',\s*unifiedAuth,\s*requireAnyPermission\(H5_BANNER_EDIT_PERMISSIONS\),\s*shopManagementController\.reorderBanners\.bind\(shopManagementController\)\)/
  ]
  for (const contract of routeContracts) assert.match(route, contract)
})

test('模板管理 controller 保留参数、媒体所有者与原响应契约', async () => {
  const calls = []
  const controller = new ShopManagementController({
    service: {
      async getTemplates() { calls.push(['getTemplates']); return [{ id: 1 }] },
      async reorderTemplates(orders) { calls.push(['reorderTemplates', orders]) },
      async getTemplateById(id) { calls.push(['getTemplateById', id]); return { id } },
      async createTemplate(data) { calls.push(['createTemplate', data]); return { id: 2 } },
      async updateTemplate(id, data) { calls.push(['updateTemplate', id, data]); return { id } },
      async deleteTemplate(id) { calls.push(['deleteTemplate', id]) },
      async deleteTemplateImage(id, imageId) { calls.push(['deleteTemplateImage', id, imageId]) },
      async commitTemplateImageUploads(entries, userId) { calls.push(['commit', entries, userId]); return { saved: 1 } },
      async discardTemplateImageUploads(entries, userId) { calls.push(['discard', entries, userId]); return 2 },
      async setPrimaryTemplateImage(id, imageId) { calls.push(['setPrimary', id, imageId]) },
      async reorderTemplateImages(id, orders) { calls.push(['reorderImages', id, orders]) }
    },
    response: responseHelper,
    logger: { debug() {}, error() {} }
  })
  const responses = Array.from({ length: 11 }, makeResponse)
  const entries = [{ template_id: 1, image_ids: [4] }]
  const body = { template_name: '常规模板' }
  const orders = [{ id: 1, sort_order: 0 }]

  await controller.getTemplates({}, responses[0])
  await controller.reorderTemplates({ body: { orders } }, responses[1])
  await controller.getTemplateById({ params: { id: '1' } }, responses[2])
  await controller.createTemplate({ body }, responses[3])
  await controller.updateTemplate({ params: { id: '1' }, body }, responses[4])
  await controller.deleteTemplate({ params: { id: '1' } }, responses[5])
  await controller.deleteTemplateImage({ params: { id: '1', imageId: '4' } }, responses[6])
  await controller.commitTemplateImageUploads({ body: { entries }, user: { id: 7 } }, responses[7])
  await controller.discardTemplateImageUploads({ body: { entries }, user: { id: 7 } }, responses[8])
  await controller.setPrimaryTemplateImage({ params: { id: '1', imageId: '4' } }, responses[9])
  await controller.reorderTemplateImages({ params: { id: '1' }, body: { orders: [] } }, responses[10])

  assert.deepEqual(calls, [
    ['getTemplates'], ['reorderTemplates', orders], ['getTemplateById', '1'],
    ['createTemplate', body], ['updateTemplate', '1', body], ['deleteTemplate', '1'],
    ['deleteTemplateImage', '1', '4'], ['commit', entries, 7], ['discard', entries, 7],
    ['setPrimary', '1', '4'], ['reorderImages', '1', []]
  ])
  assert.equal(responses[0].body.message, '获取模板列表成功')
  assert.deepEqual(responses[8].body.data, { deleted_count: 2 })

  const invalidOrderResponse = makeResponse()
  await controller.reorderTemplates({ body: { orders: [] } }, invalidOrderResponse)
  const invalidImagesResponse = makeResponse()
  await controller.reorderTemplateImages({ params: { id: '1' }, body: { orders: null } }, invalidImagesResponse)
  assert.equal(invalidOrderResponse.statusCode, 400)
  assert.equal(invalidImagesResponse.statusCode, 400)
})

test('模板路由保留认证授权、上传中间件及 controller 委托顺序', () => {
  const route = fs.readFileSync(path.join(__dirname, '../src/routes/shop.js'), 'utf8')
  const templateRoutes = [
    /router\.get\('\/templates',[\s\S]*?requireAnyPermission\(H5_TEMPLATE_VIEW_PERMISSIONS\),\s*shopManagementController\.getTemplates\.bind/,
    /router\.put\('\/templates\/reorder',[\s\S]*?requireAnyPermission\(H5_TEMPLATE_EDIT_PERMISSIONS\),\s*shopManagementController\.reorderTemplates\.bind/,
    /router\.get\('\/templates\/:id',[\s\S]*?shopManagementController\.getTemplateById\.bind/,
    /router\.post\('\/templates\/:id\/images',[\s\S]*?templateMediaUpload\.single\('image'\)[\s\S]*?handleMulterError,[\s\S]*?shopManagementController\.uploadTemplateImage\.bind/,
    /router\.post\('\/templates\/media\/commit-drafts',[\s\S]*?shopManagementController\.commitTemplateImageUploads\.bind/,
    /router\.post\('\/templates\/media\/discard-drafts',[\s\S]*?shopManagementController\.discardTemplateImageUploads\.bind/
  ]
  for (const contract of templateRoutes) assert.match(route, contract)
  assert.ok(route.indexOf("router.put('/templates/reorder'") < route.indexOf("router.get('/templates/:id'"))
})

test('商城订单 controller 保留分页响应、筛选参数与操作者 ID', async () => {
  const calls = []
  const controller = new ShopManagementController({
    service: {
      async getOrders(query) {
        calls.push(['getOrders', query])
        return {
          data: [{ id: 8 }], page: 2, page_size: 100, total: 101,
          total_pages: 2, has_next: false, has_prev: true
        }
      },
      async getOrderDetail(id) { calls.push(['getOrderDetail', id]); return { id } },
      async updateOrderStatus(id, status, userId) { calls.push(['updateOrderStatus', id, status, userId]) }
    },
    response: responseHelper,
    logger: { error() {} }
  })
  const listResponse = makeResponse()
  const detailResponse = makeResponse()
  const updateResponse = makeResponse()

  await controller.getOrders({
    query: {
      page: '2', page_size: '500', status: 'pending',
      start_date: '2026-11-01', end_date: '2026-11-07', search: '订单号'
    }
  }, listResponse)
  await controller.getOrderDetail({ params: { id: '8' } }, detailResponse)
  await controller.updateOrderStatus({ params: { id: '8' }, body: { status: 'shipped' }, user: { id: 17 } }, updateResponse)

  assert.deepEqual(calls, [
    ['getOrders', {
      page: 2, page_size: 100, status: 'pending', start_date: '2026-11-01',
      end_date: '2026-11-07', search: '订单号'
    }],
    ['getOrderDetail', '8'],
    ['updateOrderStatus', '8', 'shipped', 17]
  ])
  assert.equal(listResponse.statusCode, 200)
  assert.deepEqual({ ...listResponse.body, timestamp: undefined }, {
    success: true,
    message: '获取订单成功',
    data: [{ id: 8 }],
    pagination: { page: 2, page_size: 100, total: 101, total_pages: 2, has_next: false, has_prev: true },
    timestamp: undefined
  })
  assert.match(listResponse.body.timestamp, /^\d{4}-\d\d-\d\dT/)
  assert.equal(detailResponse.body.message, '获取订单详情成功')
  assert.equal(updateResponse.body.message, '更新订单状态成功')

  const defaults = makeResponse()
  await controller.getOrders({ query: {} }, defaults)
  assert.deepEqual(calls.at(-1), ['getOrders', {
    page: 1, page_size: 20, status: undefined, start_date: undefined,
    end_date: undefined, search: undefined
  }])
})

test('商城订单路由保留 view/edit 权限并委托 controller', () => {
  const route = fs.readFileSync(path.join(__dirname, '../src/routes/shop.js'), 'utf8')
  assert.match(route, /router\.get\('\/orders',[\s\S]*?requireAnyPermission\(H5_ORDER_VIEW_PERMISSIONS\),\s*shopManagementController\.getOrders\.bind/)
  assert.match(route, /router\.get\('\/orders\/:id',[\s\S]*?requireAnyPermission\(H5_ORDER_VIEW_PERMISSIONS\),\s*shopManagementController\.getOrderDetail\.bind/)
  assert.match(route, /router\.put\('\/orders\/:id\/status',[\s\S]*?requireAnyPermission\(H5_ORDER_EDIT_PERMISSIONS\),\s*shopManagementController\.updateOrderStatus\.bind/)
})

test('商城迁移和商品图片删除 controller 保持服务委托及响应契约', async () => {
  const calls = []
  const controller = new ShopManagementController({
    service: {
      async migrateConditionGrade() { calls.push(['migrateConditionGrade']) },
      async migrateSalePrice() { calls.push(['migrateSalePrice']) },
      async deletePhoneImages(id) { calls.push(['deletePhoneImages', id]) }
    },
    response: responseHelper,
    logger: { error() {} }
  })
  const responses = Array.from({ length: 3 }, makeResponse)

  await controller.migrateConditionGrade({}, responses[0])
  await controller.migrateSalePrice({}, responses[1])
  await controller.deletePhoneImages({ params: { id: '19' } }, responses[2])

  assert.deepEqual(calls, [
    ['migrateConditionGrade'], ['migrateSalePrice'], ['deletePhoneImages', '19']
  ])
  assert.deepEqual(responses.map(response => response.body.message), [
    '成色字段迁移成功', '销售价格字段迁移成功', '删除图片成功'
  ])
})

test('商城数据库迁移仍要求管理员，商品图片删除保留原权限', () => {
  const route = fs.readFileSync(path.join(__dirname, '../src/routes/shop.js'), 'utf8')
  assert.match(route, /router\.post\('\/migrate\/condition-grade',[\s\S]*?unifiedAuth,\s*requireAdmin,\s*shopManagementController\.migrateConditionGrade\.bind/)
  assert.match(route, /router\.post\('\/migrate\/sale-price',[\s\S]*?unifiedAuth,\s*requireAdmin,\s*shopManagementController\.migrateSalePrice\.bind/)
  assert.match(route, /router\.delete\('\/products\/:id\/images',[\s\S]*?requireAnyPermission\(H5_SOLD_PRODUCTS_DELETE_PERMISSIONS\),\s*shopManagementController\.deletePhoneImages\.bind/)
})

test('商城图片 controller 校验签名、清理失败文件并限制删除目录', async () => {
  const archived = []
  const removed = []
  const deleted = []
  const files = [
    { filename: 'a.png', originalname: 'a.png', size: 10 },
    { filename: 'b.png', originalname: 'b.png', size: 20 }
  ]
  const controller = new ShopManagementController({
    service: {},
    response: responseHelper,
    logger: { debug() {}, error() {}, warn() {} },
    archiveAssetUpload: async ({ file, moduleName }) => {
      archived.push([file.filename, moduleName])
      return `/shop/${file.filename}`
    },
    getRelativeUploadPath: url => url.replace(/^\//, ''),
    getUploadPath: url => `/uploads${url}`,
    fileSystem: { async unlink(filePath) { deleted.push(filePath) } },
    validateFileSignature: async file => file.filename !== 'b.png',
    removeFiles: async currentFiles => { removed.push(currentFiles.map(file => file.filename)) }
  })

  const invalidResponse = makeResponse()
  await controller.uploadShopImages({ files, body: { module: ' banners ' } }, invalidResponse)
  assert.equal(invalidResponse.statusCode, 400)
  assert.deepEqual(removed[0], ['a.png', 'b.png'])
  assert.deepEqual(archived, [])

  controller.validateFileSignature = async () => true
  const successResponse = makeResponse()
  await controller.uploadShopImages({ files: [files[0]], body: { module: ' banners ' } }, successResponse)
  assert.deepEqual(archived, [['a.png', 'banners']])
  assert.deepEqual(successResponse.body.data, {
    files: [{ url: '/shop/a.png', filename: 'a.png', originalname: 'a.png', size: 10 }],
    count: 1
  })

  const invalidPath = makeResponse()
  await controller.deleteShopImage({ body: { image_url: '/uploads/private/file.png' } }, invalidPath)
  assert.equal(invalidPath.statusCode, 400)
  assert.deepEqual(deleted, [])

  const deleteResponse = makeResponse()
  await controller.deleteShopImage({ body: { image_url: '/shop/a.png' } }, deleteResponse)
  assert.equal(deleteResponse.body.message, '删除成功')
  assert.deepEqual(deleted, ['/uploads/shop/a.png'])
})

test('商城图片上传和删除路由保留认证、权限及 Multer 配置', () => {
  const route = fs.readFileSync(path.join(__dirname, '../src/routes/shop.js'), 'utf8')
  assert.match(route, /router\.post\('\/upload\/image',[\s\S]*?unifiedAuth,[\s\S]*?requireAnyPermission\(H5_ASSET_EDIT_PERMISSIONS\),[\s\S]*?upload\.array\('files', 10\)[\s\S]*?handleMulterError,[\s\S]*?shopManagementController\.uploadShopImages\.bind/)
  assert.match(route, /router\.post\('\/delete-image',[\s\S]*?unifiedAuth,[\s\S]*?requireAnyPermission\(H5_ASSET_EDIT_PERMISSIONS\),\s*shopManagementController\.deleteShopImage\.bind/)
})

test('已售商品服务保留查询范围、规范字段、转义及图片计数', async () => {
  let sql = ''
  const rows = [{
    id: 5,
    imei: '<IMEI>',
    brand: 'A&B',
    model: null,
    color: '"blue"',
    memory: "Bob's",
    sale_time: '2026-11-07 10:00:00',
    image_count: '2'
  }]
  const products = await ShopService.prototype.getSoldProducts.call({}, {
    async query(query) {
      sql = query
      return [rows]
    }
  })

  assert.match(sql, /WHERE p\.status = 'sold' AND p\.is_new = 0/)
  assert.match(sql, /INNER JOIN H5_images hi ON p\.id = hi\.phone_id/)
  assert.match(sql, /p\.sale_time AS sale_time/)
  assert.doesNotMatch(sql, /SELECT\s+\*/)
  assert.deepEqual(products, [{
    id: 5,
    imei: '&lt;IMEI&gt;',
    brand: 'A&amp;B',
    model: null,
    color: '&quot;blue&quot;',
    memory: 'Bob&#039;s',
    sale_time: '2026-11-07 10:00:00',
    image_count: 2
  }])
})

test('已售商品 controller 保留成功与安全错误响应', async () => {
  const controller = new ShopManagementController({
    service: { async getSoldProducts() { return [{ id: 1 }] } },
    response: responseHelper,
    logger: { error() {} }
  })
  const success = makeResponse()
  await controller.getSoldProducts({}, success)
  assert.deepEqual(success.body, {
    success: true, data: [{ id: 1 }], message: '获取已售商品列表成功'
  })

  controller.service.getSoldProducts = async () => { throw new Error('db failure') }
  const failure = makeResponse()
  await controller.getSoldProducts({}, failure)
  assert.equal(failure.statusCode, 500)
  assert.equal(failure.body.message, '获取已售商品列表失败')
})
