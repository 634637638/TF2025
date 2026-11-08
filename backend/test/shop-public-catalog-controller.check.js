'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ShopPublicCatalogController = require('../src/controllers/shop-public-catalog.controller')

const response = () => ({
  status(code) { this.statusCode = code; return this },
  json(body) { this.body = body; return this }
})

test('public shop catalog routes delegate without adding authentication', () => {
  const source = fs.readFileSync(path.join(__dirname, '../src/routes/shop-public.js'), 'utf8')
  assert.match(source, /router\.get\('\/shop\/config', shopPublicCatalogController\.getConfig\.bind\(shopPublicCatalogController\)\)/)
  assert.match(source, /router\.get\('\/shop\/banners', shopPublicCatalogController\.getBanners\.bind\(shopPublicCatalogController\)\)/)
  assert.match(source, /router\.get\('\/home\/sections', shopPublicCatalogController\.getHomeSections\.bind\(shopPublicCatalogController\)\)/)
  assert.match(source, /router\.get\('\/memories', shopPublicCatalogController\.getMemories\.bind\(shopPublicCatalogController\)\)/)
  assert.match(source, /router\.get\('\/brands', shopPublicCatalogController\.getBrands\.bind\(shopPublicCatalogController\)\)/)
  assert.match(source, /router\.get\('\/models', shopPublicCatalogController\.getModels\.bind\(shopPublicCatalogController\)\)/)
  assert.match(source, /router\.get\('\/colors', shopPublicCatalogController\.getColors\.bind\(shopPublicCatalogController\)\)/)
  assert.match(source, /router\.get\('\/products\/:id', shopPublicCatalogController\.getProductDetail\.bind\(shopPublicCatalogController\)\)/)
  assert.match(source, /router\.get\('\/products\/:id\/images', shopPublicCatalogController\.getProductImages\.bind\(shopPublicCatalogController\)\)/)
  assert.match(source, /router\.get\('\/products', shopPublicCatalogController\.getProducts\.bind\(shopPublicCatalogController\)\)/)
  assert.match(source, /router\.get\('\/products\/aggregate', shopPublicCatalogController\.getAggregatedProducts\.bind\(shopPublicCatalogController\)\)/)
  assert.match(source, /router\.get\('\/products\/stock\/distribution', shopPublicCatalogController\.getProductStockDistribution\.bind\(shopPublicCatalogController\)\)/)
  assert.match(source, /router\.get\('\/products\/search\/:keyword', shopPublicCatalogController\.searchProducts\.bind\(shopPublicCatalogController\)\)/)
  assert.match(source, /router\.get\('\/cart\/:cartId', publicLookupRateLimit, shopPublicCatalogController\.getCart\.bind\(shopPublicCatalogController\)\)/)
  assert.match(source, /router\.post\('\/cart\/add', publicOrderRateLimit, shopPublicCatalogController\.addToCart\.bind\(shopPublicCatalogController\)\)/)
  assert.match(source, /router\.put\('\/cart\/:id', publicOrderRateLimit, shopPublicCatalogController\.updateCartItem\.bind\(shopPublicCatalogController\)\)/)
  assert.match(source, /router\.delete\('\/cart\/:id', publicOrderRateLimit, shopPublicCatalogController\.removeCartItem\.bind\(shopPublicCatalogController\)\)/)
  assert.match(source, /router\.delete\('\/cart\/:cartId\/clear', publicOrderRateLimit, shopPublicCatalogController\.clearCart\.bind\(shopPublicCatalogController\)\)/)
  assert.match(source, /router\.get\('\/orders\/:orderNumber', publicLookupRateLimit, shopPublicCatalogController\.getOrderByNumber\.bind\(shopPublicCatalogController\)\)/)
  assert.match(source, /router\.post\('\/orders\/:orderNumber\/confirm-payment', publicOrderRateLimit, shopPublicCatalogController\.confirmOrderPayment\.bind\(shopPublicCatalogController\)\)/)
  assert.match(source, /router\.put\('\/orders\/:id\/cancel', publicOrderRateLimit, shopPublicCatalogController\.cancelCustomerOrder\.bind\(shopPublicCatalogController\)\)/)
  assert.match(source, /router\.put\('\/orders\/:id\/status', unifiedAuth, requirePermission\('permissions:admin'\), shopPublicCatalogController\.updateOrderStatus\.bind\(shopPublicCatalogController\)\)/)
  assert.match(source, /router\.post\('\/orders\/create', publicOrderRateLimit, shopPublicCatalogController\.createOrder\.bind\(shopPublicCatalogController\)\)/)
  assert.match(source, /router\.get\('\/orders\/phone\/:customer_phone', publicLookupRateLimit, publicOrderPhoneLookupRateLimit, shopPublicCatalogController\.getOrdersByPhone\.bind\(shopPublicCatalogController\)\)/)
  assert.match(source, /router\.get\('\/templates\/:id\/phones', shopPublicCatalogController\.getTemplatePhones\.bind\(shopPublicCatalogController\)\)/)
})

test('public shop catalog controller preserves success payloads and messages', async () => {
  const service = {
    async getPublicConfig() { return { enabled: true } },
    async getActiveBanners() { return [{ id: 1 }] },
    async getMemories() { return [{ id: 2, size: '256GB' }] }
  }
  const controller = new ShopPublicCatalogController({ service })
  const cases = [
    ['getConfig', { enabled: true }, '获取配置成功'],
    ['getBanners', [{ id: 1 }], '获取轮播图成功'],
    ['getMemories', [{ id: 2, size: '256GB' }], '获取内存列表成功']
  ]

  for (const [method, data, message] of cases) {
    const res = response()
    await controller[method]({}, res)
    assert.equal(res.body.success, true)
    assert.deepEqual(res.body.data, data)
    assert.equal(res.body.message, message)
  }
})

test('public home sections controller preserves success response and delegates to its service', async () => {
  const sections = [{ id: 3, section_key: 'featured', products: [] }]
  let calls = 0
  const controller = new ShopPublicCatalogController({
    service: {},
    homeSections: { async getActiveSections() { calls += 1; return sections } }
  })
  const res = response()

  await controller.getHomeSections({}, res)

  assert.equal(calls, 1)
  assert.equal(res.statusCode, 200)
  assert.equal(res.body.success, true)
  assert.equal(res.body.message, '获取推荐区域成功')
  assert.deepEqual(res.body.data, sections)
  assert.ok(Number.isFinite(Date.parse(res.body.timestamp)))
})

test('public home sections controller preserves missing-table fallback and server errors', async () => {
  const warnings = []
  const errors = []
  const controller = new ShopPublicCatalogController({
    service: {},
    homeSections: {
      async getActiveSections() { throw Object.assign(new Error('missing recommendation table'), { code: 'ER_NO_SUCH_TABLE' }) }
    },
    logger: {
      error(...args) { errors.push(args) },
      warn(message) { warnings.push(message) }
    }
  })
  const fallback = response()
  await controller.getHomeSections({}, fallback)
  assert.equal(fallback.statusCode, 200)
  assert.equal(fallback.body.message, '推荐区域未初始化')
  assert.deepEqual(fallback.body.data, [])
  assert.ok(Number.isFinite(Date.parse(fallback.body.timestamp)))
  assert.equal(warnings.length, 1)

  controller.homeSections.getActiveSections = async () => { throw new Error('查询失败') }
  const failed = response()
  await controller.getHomeSections({}, failed)
  assert.equal(failed.statusCode, 500)
  assert.equal(failed.body.message, '服务器内部错误，请稍后重试')
  assert.equal(errors.length, 2)
})

test('public shop catalog controller preserves endpoint-specific safe error messages', async () => {
  const errors = []
  const controller = new ShopPublicCatalogController({
    service: {
      async getPublicConfig() { throw new Error('config unavailable') },
      async getActiveBanners() { throw new Error('banner unavailable') },
      async getMemories() { throw new Error('memory unavailable') }
    },
    logger: { error(...args) { errors.push(args) } }
  })
  const cases = [
    ['getConfig', '服务器内部错误，请稍后重试'],
    ['getBanners', '服务器内部错误，请稍后重试'],
    ['getMemories', '服务器内部错误，请稍后重试']
  ]

  for (const [method, message] of cases) {
    const res = response()
    await controller[method]({}, res)
    assert.equal(res.statusCode, 500)
    assert.equal(res.body.message, message)
  }
  assert.equal(errors.length, 3)
})

test('public shop catalog controller preserves include_empty and brand_id query conversion', async () => {
  const calls = []
  const controller = new ShopPublicCatalogController({
    service: {
      async getBrands(includeEmpty) { calls.push(['brands', includeEmpty]); return [] },
      async getModels(brandId, includeEmpty) { calls.push(['models', brandId, includeEmpty]); return [] },
      async getColors(includeEmpty) { calls.push(['colors', includeEmpty]); return [] }
    }
  })

  for (const method of ['getBrands', 'getModels', 'getColors']) {
    await controller[method]({ query: { include_empty: 'true', brand_id: '42' } }, response())
  }
  assert.deepEqual(calls, [
    ['brands', true],
    ['models', 42, true],
    ['colors', true]
  ])
})

test('public shop product controllers preserve detail, image and template list contracts', async () => {
  const calls = []
  const controller = new ShopPublicCatalogController({
    service: {
      async getProductDetail(id) { calls.push(['detail', id]); return { id: Number(id) } },
      async getProductImages(id) { calls.push(['images', id]); return [{ id: 5 }] },
      async getTemplatePhones(id) { calls.push(['template', id]); return { phones: [{ id: 8 }] } }
    }
  })
  const detail = response()
  const images = response()
  const template = response()
  await controller.getProductDetail({ params: { id: '12' } }, detail)
  await controller.getProductImages({ params: { id: '12' } }, images)
  await controller.getTemplatePhones({ params: { id: '7' } }, template)
  assert.deepEqual(calls, [['detail', '12'], ['images', '12'], ['template', '7']])
  assert.deepEqual(detail.body.data, { id: 12 })
  assert.equal(detail.body.message, '获取商品详情成功')
  assert.deepEqual(images.body.data, [{ id: 5 }])
  assert.equal(images.body.message, '获取商品图片成功')
  assert.deepEqual(template.body.data, [{ id: 8 }])
  assert.equal(template.body.message, '获取商品列表成功')
})

test('public shop product controllers preserve not-found responses', async () => {
  const controller = new ShopPublicCatalogController({
    service: {
      async getProductDetail() { return null },
      async getTemplatePhones() { return null }
    }
  })
  const detail = response()
  const template = response()
  await controller.getProductDetail({ params: { id: '404' } }, detail)
  await controller.getTemplatePhones({ params: { id: '404' } }, template)
  assert.equal(detail.statusCode, 404)
  assert.equal(detail.body.message, '商品不存在')
  assert.equal(template.statusCode, 404)
  assert.equal(template.body.message, '模板不存在')
})

test('public product list controllers preserve filters, pagination and response contract', async () => {
  const calls = []
  const result = {
    data: [{ id: 1 }], page: 2, page_size: 10, total: 11, total_pages: 2,
    has_next: false, has_prev: true
  }
  const controller = new ShopPublicCatalogController({
    service: {
      async getProducts(filters) { calls.push(['products', filters]); return result },
      async getAggregatedProducts(filters) { calls.push(['aggregate', filters]); return result },
      async searchProducts(keyword, pagination) { calls.push(['search', keyword, pagination]); return result }
    }
  })
  const products = response()
  const aggregate = response()
  const search = response()
  await controller.getProducts({ query: {
    page: '2', page_size: '10', brand_id: '3', model_id: '4', color_id: '5', memory_id: '6',
    is_new: '1', search: 'phone', sort: 'price', order: 'ASC'
  } }, products)
  await controller.getAggregatedProducts({ query: {
    page: '2', page_size: '10', brand_id: '3', model_id: '4', color_id: '5', is_new: 'true', search: 'phone'
  } }, aggregate)
  await controller.searchProducts({ params: { keyword: 'iphone' }, query: { page: '2', page_size: '10' } }, search)

  assert.deepEqual(calls, [
    ['products', {
      page: 2, page_size: 10, brand_id: 3, model_id: 4, color_id: 5, memory_id: 6,
      is_new: true, search: 'phone', sort: 'price', order: 'ASC'
    }],
    ['aggregate', {
      page: 2, page_size: 10, brand_id: 3, model_id: 4, color_id: 5, is_new: true, search: 'phone'
    }],
    ['search', 'iphone', { page: 2, page_size: 10 }]
  ])
  for (const [res, message] of [[products, '获取商品列表成功'], [aggregate, '获取聚合商品列表成功'], [search, '搜索成功']]) {
    assert.equal(res.statusCode, 200)
    assert.equal(res.body.message, message)
    assert.deepEqual(res.body.data, result.data)
    assert.deepEqual(res.body.pagination, {
      page: 2, page_size: 10, total: 11, total_pages: 2, has_next: false, has_prev: true
    })
    assert.ok(Number.isFinite(Date.parse(res.body.timestamp)))
  }
})

test('public stock distribution validates required filters and preserves its response', async () => {
  const calls = []
  const controller = new ShopPublicCatalogController({
    service: {
      async getProductStockDistribution(...args) { calls.push(args); return [{ store_id: 9, quantity: 2 }] }
    }
  })
  const missing = response()
  await controller.getProductStockDistribution({ query: { brand_id: '1' } }, missing)
  assert.equal(missing.statusCode, 400)
  assert.equal(missing.body.message, '缺少必要参数')

  const result = response()
  await controller.getProductStockDistribution({ query: {
    brand_id: '1', model_id: '2', color_id: '3', memory_id: '4', is_new: 'true'
  } }, result)
  assert.deepEqual(calls, [[1, 2, 3, 4, true]])
  assert.deepEqual(result.body.data, [{ store_id: 9, quantity: 2 }])
  assert.equal(result.body.message, '获取库存分布成功')
})

test('public cart controllers validate cart identity and delegate to the existing service', async () => {
  const cartId = `cart_${'a'.repeat(32)}`
  const calls = []
  const controller = new ShopPublicCatalogController({
    service: Object.fromEntries([
      ['getCart', async id => { calls.push(['get', id]); return { count: 0 } }],
      ['addToCart', async (...args) => calls.push(['add', ...args])],
      ['updateCartItem', async (...args) => calls.push(['update', ...args])],
      ['removeFromCart', async (...args) => calls.push(['remove', ...args])],
      ['clearCart', async id => calls.push(['clear', id])]
    ])
  })
  const invalid = response()
  await controller.getCart({ params: { cartId: 'bad' } }, invalid)
  assert.equal(invalid.statusCode, 400)

  const cart = response()
  const added = response()
  const updated = response()
  const removed = response()
  const cleared = response()
  await controller.getCart({ params: { cartId: ` ${cartId} ` } }, cart)
  await controller.addToCart({ body: { cartId, phoneId: '7' } }, added)
  await controller.updateCartItem({ params: { id: '8' }, body: { cartId, quantity: '1' } }, updated)
  await controller.removeCartItem({ params: { id: '9' }, query: { cartId } }, removed)
  await controller.clearCart({ params: { cartId } }, cleared)

  assert.deepEqual(calls, [
    ['get', cartId],
    ['add', cartId, 7, 1],
    ['update', cartId, 8, 1],
    ['remove', cartId, 9],
    ['clear', cartId]
  ])
  assert.deepEqual(cart.body.data, { count: 0 })
  assert.deepEqual([added.body.message, updated.body.message, removed.body.message, cleared.body.message], [
    '添加到购物车成功', '更新购物车成功', '删除成功', '清空购物车成功'
  ])
})

test('public cart controllers reject invalid item identifiers and preserve error mapping', async () => {
  const errors = []
  const controller = new ShopPublicCatalogController({
    service: { async getCart() { throw new Error('cart unavailable') } },
    logger: { error(...args) { errors.push(args) } }
  })
  const invalidItem = response()
  await controller.removeCartItem({ params: { id: '0' }, query: { cartId: `cart_${'a'.repeat(32)}` } }, invalidItem)
  assert.equal(invalidItem.statusCode, 400)
  const failed = response()
  await controller.getCart({ params: { cartId: `cart_${'a'.repeat(32)}` } }, failed)
  assert.equal(failed.statusCode, 500)
  assert.equal(failed.body.message, '服务器内部错误，请稍后重试')
  assert.equal(errors.length, 1)
})

test('public order detail requires the order access token and preserves lookup responses', async () => {
  const order = { id: 5, order_number: 'H5-5', customer_phone: '13800000000' }
  const verifiedTokens = []
  const controller = new ShopPublicCatalogController({
    service: { async getOrderByNumber(number) { assert.equal(number, 'H5-5'); return order } },
    verifyOrderToken(token, foundOrder) {
      verifiedTokens.push([token, foundOrder])
      return token === 'valid-token'
    }
  })
  const forbidden = response()
  await controller.getOrderByNumber({
    params: { orderNumber: 'H5-5' }, headers: {}, query: { access_token: 'invalid-token' }
  }, forbidden)
  assert.equal(forbidden.statusCode, 401)
  assert.equal(forbidden.body.message, '订单访问凭证无效或已过期')

  const authorized = response()
  await controller.getOrderByNumber({
    params: { orderNumber: 'H5-5' }, headers: { 'x-order-access-token': 'valid-token' }, query: {}
  }, authorized)
  assert.deepEqual(verifiedTokens.map(([token]) => token), ['invalid-token', 'valid-token'])
  assert.deepEqual(authorized.body.data, { ...order, access_token: 'valid-token' })
  assert.equal(authorized.body.message, '获取订单成功')
})

test('public payment confirmation validates the order token before calling the transactional service', async () => {
  const order = { id: 5, order_number: 'H5-5', customer_phone: '13800000000' }
  const calls = []
  const controller = new ShopPublicCatalogController({
    service: {
      async getOrderByNumber(number) { calls.push(['lookup', number]); return order },
      async confirmUserPayment(number) { calls.push(['confirm', number]); return { ...order, status: 'paid' } }
    },
    verifyOrderToken: token => token === 'valid-token'
  })
  const denied = response()
  await controller.confirmOrderPayment({ params: { orderNumber: 'H5-5' }, body: { access_token: 'bad' } }, denied)
  assert.equal(denied.statusCode, 401)
  assert.deepEqual(calls, [['lookup', 'H5-5']])

  const confirmed = response()
  await controller.confirmOrderPayment({ params: { orderNumber: 'H5-5' }, body: { access_token: 'valid-token' } }, confirmed)
  assert.deepEqual(calls, [['lookup', 'H5-5'], ['lookup', 'H5-5'], ['confirm', 'H5-5']])
  assert.equal(confirmed.body.data.status, 'paid')
  assert.equal(confirmed.body.message, '支付确认成功，订单状态已更新')
})

test('public cancellation delegates token validation and maps service outcomes', async () => {
  const calls = []
  const controller = new ShopPublicCatalogController({
    service: {
      async cancelCustomerOrder(input, verifyToken) {
        calls.push([input, verifyToken('valid-token', { id: 3 })])
        return input.id === '3' ? { status: 'cancelled', orderNumber: 'H5-3' } : { status: 'expired' }
      }
    },
    verifyOrderToken: token => token === 'valid-token'
  })
  const cancelled = response()
  await controller.cancelCustomerOrder({
    params: { id: '3' }, body: { access_token: 'valid-token', reason: '改地址' }
  }, cancelled)
  assert.deepEqual(calls, [[{ id: '3', accessToken: 'valid-token', reason: '改地址' }, true]])
  assert.deepEqual(cancelled.body.data, { id: '3', orderNumber: 'H5-3' })
  assert.equal(cancelled.body.message, '订单已取消')

  const expired = response()
  await controller.cancelCustomerOrder({ params: { id: '4' }, body: {} }, expired)
  assert.equal(expired.statusCode, 400)
  assert.equal(expired.body.message, '订单已过期，系统将自动取消')
})

test('admin order status controller validates allowed transitions and preserves response mapping', async () => {
  const calls = []
  const controller = new ShopPublicCatalogController({
    service: {
      async updateOrderStatus(id, status) {
        calls.push([id, status])
        return status === 'paid' ? { id: Number(id), status } : null
      }
    }
  })
  const missing = response()
  const invalid = response()
  const notFound = response()
  const updated = response()
  await controller.updateOrderStatus({ params: { id: '2' }, body: {} }, missing)
  await controller.updateOrderStatus({ params: { id: '2' }, body: { status: 'unknown' } }, invalid)
  await controller.updateOrderStatus({ params: { id: '2' }, body: { status: 'shipped' } }, notFound)
  await controller.updateOrderStatus({ params: { id: '2' }, body: { status: 'paid' } }, updated)

  assert.equal(missing.statusCode, 400)
  assert.equal(missing.body.message, '缺少状态参数')
  assert.equal(invalid.statusCode, 400)
  assert.equal(invalid.body.message, '无效的状态值')
  assert.equal(notFound.statusCode, 404)
  assert.deepEqual(calls, [['2', 'shipped'], ['2', 'paid']])
  assert.deepEqual(updated.body.data, { id: 2, status: 'paid' })
  assert.equal(updated.body.message, '修改订单状态成功')
})

test('public order creation validates customer/cart/items and preserves token response contract', async () => {
  const cartId = `cart_${'b'.repeat(32)}`
  const calls = []
  const responseApi = {
    badRequest(res, message) { res.status(400).json({ success: false, message }); return res },
    created(res, message, data) { res.status(201).json({ success: true, message, data }); return res },
    error(res, message, status) { res.status(status).json({ success: false, message }); return res }
  }
  const controller = new ShopPublicCatalogController({
    response: responseApi,
    service: {
      async createOrder(input) {
        calls.push(input)
        return { orderId: 9, orderNumber: 'H5-9', totalAmount: 120 }
      }
    },
    createOrderToken(order) {
      calls.push(order)
      return 'access-token'
    }
  })
  const invalidItems = response()
  await controller.createOrder({ body: {
    customerName: '李四', customerPhone: '13800000000', items: [{ phoneId: 3, quantity: 2 }]
  } }, invalidItems)
  assert.equal(invalidItems.statusCode, 400)
  assert.equal(invalidItems.body.message, '商品或购买数量不正确')

  const created = response()
  await controller.createOrder({ body: {
    customerName: ' 李四 ', customerPhone: '138-0000-0000', customerAddress: ' 地址 ', remarks: ' 备注 ',
    cartId: ` ${cartId} `, items: [{ phoneId: '3', quantity: '1' }], paymentMethod: 'pickup'
  } }, created)
  assert.deepEqual(calls, [
    {
      customerName: '李四', customerPhone: '13800000000', customerAddress: '地址', remarks: '备注',
      cartId, items: [{ phoneId: 3, quantity: 1 }], paymentMethod: 'pickup'
    },
    { id: 9, orderNumber: 'H5-9', customerPhone: '13800000000' }
  ])
  assert.equal(created.statusCode, 201)
  assert.equal(created.body.message, '下单成功')
  assert.deepEqual(created.body.data, {
    orderId: 9, orderNumber: 'H5-9', totalAmount: 120, accessToken: 'access-token'
  })
})

test('public phone order lookup validates identity and returns canonical pagination', async () => {
  const calls = []
  const result = {
    data: [{ order_number: 'H5-1' }], page: 2, page_size: 5, total: 6, total_pages: 2,
    has_next: false, has_prev: true
  }
  const controller = new ShopPublicCatalogController({
    service: { async getOrdersByPhone(phone, options) { calls.push([phone, options]); return result } }
  })
  const invalid = response()
  await controller.getOrdersByPhone({
    params: { customer_phone: '123' }, query: { customer_name: 'A' }
  }, invalid)
  assert.equal(invalid.statusCode, 400)

  const valid = response()
  await controller.getOrdersByPhone({
    params: { customer_phone: '138-0000-0000' },
    query: { page: '2', page_size: '5', customer_name: ' 李四 ' }
  }, valid)
  assert.deepEqual(calls, [['13800000000', { page: 2, page_size: 5, customer_name: '李四' }]])
  assert.equal(valid.body.message, '获取订单列表成功')
  assert.deepEqual(valid.body.pagination, {
    page: 2, page_size: 5, total: 6, total_pages: 2, has_next: false, has_prev: true
  })
})
