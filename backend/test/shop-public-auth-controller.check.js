'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ShopPublicAuthController = require('../src/controllers/shop-public-auth.controller')
const ShopPublicService = require('../src/services/shop-public.service')
const { hashCustomerToken } = require('../src/utils/customer-token')

const response = () => ({
  status(code) { this.statusCode = code; return this },
  json(body) { this.body = body; return this }
})

test('customer logout keeps its rate limit and delegates to the auth controller', () => {
  const route = fs.readFileSync(path.join(__dirname, '../src/routes/shop-public.js'), 'utf8')
  assert.match(route, /router\.post\('\/auth\/register', publicAuthRateLimit, shopPublicAuthController\.register\.bind\(shopPublicAuthController\)\)/)
  assert.match(route, /router\.post\('\/auth\/login', publicAuthRateLimit, shopPublicAuthController\.login\.bind\(shopPublicAuthController\)\)/)
  assert.match(route, /router\.post\('\/auth\/logout', publicAuthRateLimit, shopPublicAuthController\.logout\.bind\(shopPublicAuthController\)\)/)
  assert.match(route, /router\.get\('\/auth\/orders', shopPublicAuthController\.getOrders\.bind\(shopPublicAuthController\)\)/)
  assert.match(route, /router\.get\('\/auth\/sales', shopPublicAuthController\.getSales\.bind\(shopPublicAuthController\)\)/)
  assert.match(route, /router\.get\('\/auth\/me', shopPublicAuthController\.getMe\.bind\(shopPublicAuthController\)\)/)
  assert.match(route, /router\.get\('\/auth\/profile', shopPublicAuthController\.getProfile\.bind\(shopPublicAuthController\)\)/)
  assert.match(route, /router\.put\('\/auth\/profile', publicAuthRateLimit, shopPublicAuthController\.updateProfile\.bind\(shopPublicAuthController\)\)/)
})

test('customer logout hashes bearer tokens before service revocation and preserves the response', async () => {
  const calls = []
  const controller = new ShopPublicAuthController({
    service: { async logoutCustomer(tokenHash) { calls.push(tokenHash) } }
  })
  const res = response()

  await controller.logout({ headers: { authorization: 'Bearer customer-token' } }, res)

  assert.deepEqual(calls, [hashCustomerToken('customer-token')])
  assert.equal(res.statusCode, 200)
  assert.equal(res.body.success, true)
  assert.equal(res.body.message, '登出成功')
  assert.equal(Object.hasOwn(res.body, 'data'), false)
  assert.ok(Number.isFinite(Date.parse(res.body.timestamp)))
})

test('customer logout without a bearer token skips database work and still succeeds', async () => {
  let calls = 0
  const controller = new ShopPublicAuthController({
    service: { async logoutCustomer() { calls += 1 } }
  })
  const res = response()

  await controller.logout({ headers: {} }, res)

  assert.equal(calls, 0)
  assert.equal(res.body.success, true)
  assert.equal(res.body.message, '登出成功')
})

test('customer logout service binds the token hash to the token revocation query', async () => {
  const calls = []
  const service = new ShopPublicService({
    database: { getDatabase: () => ({ query: async (...args) => calls.push(args) }) }
  })

  await service.logoutCustomer('token-hash')

  assert.deepEqual(calls, [[
    'DELETE FROM customer_tokens WHERE token_hash = ?',
    ['token-hash']
  ]])
})

test('customer logout maps service failures to the established error response', async () => {
  const errors = []
  const controller = new ShopPublicAuthController({
    service: { async logoutCustomer() { throw new Error('database unavailable') } },
    logger: { error(...args) { errors.push(args) } }
  })
  const res = response()

  await controller.logout({ headers: { authorization: 'Bearer customer-token' } }, res)

  assert.equal(res.statusCode, 500)
  assert.equal(res.body.message, '服务器内部错误，请稍后重试')
  assert.equal(errors.length, 1)
})

test('customer registration validates fields and maps duplicate and successful service outcomes', async () => {
  const calls = []
  const user = { id: 7, name: '测试客户', phone: '13800000000', member_number: 'TF000007' }
  const controller = new ShopPublicAuthController({
    service: {
      async registerCustomer(input) {
        calls.push(input)
        return { conflict: false, token: 'customer-token', user }
      }
    }
  })
  const invalid = response()
  await controller.register({ body: { name: 'A', phone: '13800000000', password: 'test-password' } }, invalid)
  assert.equal(invalid.statusCode, 400)
  assert.equal(invalid.body.message, '请填写完整信息')
  assert.equal(calls.length, 0)

  const success = response()
  await controller.register({ body: { name: ' 测试客户 ', phone: '13800000000', password: 'test-password' } }, success)
  assert.deepEqual(calls, [{ name: '测试客户', phone: '13800000000', password: 'test-password' }])
  assert.equal(success.statusCode, 200)
  assert.equal(success.body.message, '注册成功')
  assert.deepEqual(success.body.data, { token: 'customer-token', user })

  controller.service.registerCustomer = async () => ({ conflict: true })
  const duplicate = response()
  await controller.register({ body: { name: '测试客户', phone: '13800000000', password: 'test-password' } }, duplicate)
  assert.equal(duplicate.statusCode, 409)
  assert.equal(duplicate.body.message, '该手机号已注册')
})

test('customer history endpoints require a valid bearer session and preserve pagination', async () => {
  const calls = []
  const result = {
    data: [{ id: 1 }], page: 2, page_size: 50, total: 101,
    total_pages: 3, has_next: true, has_prev: true
  }
  const controller = new ShopPublicAuthController({
    service: {
      async getCustomerSession(tokenHash) {
        calls.push(['session', tokenHash])
        return { customer_id: 7, phone: '13800000000' }
      },
      async getOrdersByPhone(phone, pagination) { calls.push(['orders', phone, pagination]); return result },
      async getSalesByCustomerId(customerId, pagination) { calls.push(['sales', customerId, pagination]); return result }
    }
  })
  const orders = response()
  const sales = response()

  await controller.getOrders({ headers: { authorization: 'Bearer customer-token' }, query: { page: '2', page_size: '99' } }, orders)
  await controller.getSales({ headers: { authorization: 'Bearer customer-token' }, query: { page: '2', page_size: '99' } }, sales)

  assert.deepEqual(calls, [
    ['session', hashCustomerToken('customer-token')],
    ['orders', '13800000000', { page: 2, page_size: 50 }],
    ['session', hashCustomerToken('customer-token')],
    ['sales', 7, { page: 2, page_size: 50 }]
  ])
  for (const [res, message] of [[orders, '获取订单成功'], [sales, '获取销售记录成功']]) {
    assert.equal(res.statusCode, 200)
    assert.equal(res.body.success, true)
    assert.equal(res.body.message, message)
    assert.deepEqual(res.body.data, result.data)
    assert.deepEqual(res.body.pagination, {
      page: 2, page_size: 50, total: 101, total_pages: 3, has_next: true, has_prev: true
    })
    assert.ok(Number.isFinite(Date.parse(res.body.timestamp)))
  }
})

test('customer history endpoints reject missing and expired customer sessions before reading records', async () => {
  const calls = []
  const controller = new ShopPublicAuthController({
    service: {
      async getCustomerSession(tokenHash) { calls.push(tokenHash); return null },
      async getOrdersByPhone() { assert.fail('orders must not be queried') },
      async getSalesByCustomerId() { assert.fail('sales must not be queried') }
    }
  })
  const missing = response()
  const expired = response()

  await controller.getOrders({ headers: {}, query: {} }, missing)
  await controller.getSales({ headers: { authorization: 'Bearer stale-token' }, query: {} }, expired)

  assert.equal(missing.statusCode, 401)
  assert.equal(missing.body.message, '请先登录')
  assert.equal(expired.statusCode, 401)
  assert.equal(expired.body.message, 'Token无效或已过期')
  assert.deepEqual(calls, [hashCustomerToken('stale-token')])
})

test('customer session service looks up only an unexpired token hash', async () => {
  const calls = []
  const customer = { customer_id: 7, phone: '13800000000' }
  const service = new ShopPublicService({
    database: { getDatabase: () => ({
      query: async (...args) => {
        calls.push(args)
        return [[customer], []]
      }
    }) }
  })

  const result = await service.getCustomerSession('token-hash')

  assert.deepEqual(result, customer)
  assert.equal(calls.length, 1)
  assert.match(calls[0][0], /WHERE ct\.token_hash = \? AND ct\.expires_at > NOW\(\)/)
  assert.deepEqual(calls[0][1], ['token-hash'])
})

test('customer identity endpoints return only their established summary and profile fields', async () => {
  const calls = []
  const summary = { id: 7, name: '客户', phone: '13800000000', avatar: null, member_number: 'TF000007' }
  const profile = {
    id: 7, name: '客户', phone: '13800000000', gender: 'unknown',
    id_card: null, apple_id: null, address: null
  }
  const controller = new ShopPublicAuthController({
    service: {
      async getCustomerSession(tokenHash) {
        calls.push(['session', tokenHash])
        return { customer_id: 7 }
      },
      async getCustomerSummary(customerId) { calls.push(['summary', customerId]); return summary },
      async getCustomerProfile(customerId) { calls.push(['profile', customerId]); return profile }
    }
  })
  const me = response()
  const fullProfile = response()

  await controller.getMe({ headers: { authorization: 'Bearer customer-token' } }, me)
  await controller.getProfile({ headers: { authorization: 'Bearer customer-token' } }, fullProfile)

  assert.deepEqual(calls, [
    ['session', hashCustomerToken('customer-token')], ['summary', 7],
    ['session', hashCustomerToken('customer-token')], ['profile', 7]
  ])
  assert.equal(me.body.message, '获取用户信息成功')
  assert.deepEqual(me.body.data, summary)
  assert.equal(fullProfile.body.message, '获取用户资料成功')
  assert.deepEqual(fullProfile.body.data, profile)
})

test('customer identity endpoints preserve unauthorized and not-found responses', async () => {
  const controller = new ShopPublicAuthController({
    service: {
      async getCustomerSession() { return { customer_id: 7 } },
      async getCustomerSummary() { return null },
      async getCustomerProfile() { return null }
    }
  })
  const unauthorized = response()
  const missingSummary = response()
  const missingProfile = response()

  await controller.getMe({ headers: {} }, unauthorized)
  await controller.getMe({ headers: { authorization: 'Bearer customer-token' } }, missingSummary)
  await controller.getProfile({ headers: { authorization: 'Bearer customer-token' } }, missingProfile)

  assert.equal(unauthorized.statusCode, 401)
  assert.equal(unauthorized.body.message, '请先登录')
  assert.equal(missingSummary.statusCode, 404)
  assert.equal(missingSummary.body.message, '用户不存在')
  assert.equal(missingProfile.statusCode, 404)
  assert.equal(missingProfile.body.message, '用户不存在')
})

test('customer summary and profile services use explicit parameterized field lists', async () => {
  const calls = []
  const service = new ShopPublicService({
    database: { getDatabase: () => ({
      query: async (...args) => {
        calls.push(args)
        return [[{ id: 7 }], []]
      }
    }) }
  })

  await service.getCustomerSummary(7)
  await service.getCustomerProfile(7)

  assert.deepEqual(calls, [
    ['SELECT id, name, phone, avatar, member_number FROM customers WHERE id = ?', [7]],
    ['SELECT id, name, phone, gender, id_card, apple_id, address FROM customers WHERE id = ?', [7]]
  ])
})

test('profile update validates and normalizes fields before service delegation', async () => {
  const calls = []
  const updatedProfile = { id: 7, name: '新名字', gender: null, id_card: null, apple_id: '13800000000', address: null }
  const controller = new ShopPublicAuthController({
    service: {
      async getCustomerSession(tokenHash) {
        calls.push(['session', tokenHash])
        return { customer_id: 7 }
      },
      async updateCustomerProfile(customerId, profile) {
        calls.push(['update', customerId, profile])
        return updatedProfile
      }
    }
  })
  const res = response()

  await controller.updateProfile({
    headers: { authorization: 'Bearer customer-token' },
    body: { name: ' 新名字 ', gender: '', idCard: '', appleId: '13800000000', address: '' }
  }, res)

  assert.deepEqual(calls, [
    ['session', hashCustomerToken('customer-token')],
    ['update', 7, { name: '新名字', gender: null, idCard: null, appleId: '13800000000', address: null }]
  ])
  assert.equal(res.body.success, true)
  assert.equal(res.body.message, '更新资料成功')
  assert.deepEqual(res.body.data, updatedProfile)
})

test('profile update rejects invalid and empty updates without writing', async () => {
  const controller = new ShopPublicAuthController({
    service: {
      async getCustomerSession() { return { customer_id: 7 } },
      async updateCustomerProfile() { assert.fail('invalid profile data must not be written') }
    }
  })
  const cases = [
    [{}, '没有要更新的字段'],
    [{ name: 'A' }, '姓名长度应为2至50个字符'],
    [{ gender: 'other' }, '性别参数不正确'],
    [{ idCard: 'invalid' }, '身份证号格式不正确'],
    [{ appleId: 'not-an-apple-id' }, 'Apple ID格式不正确'],
    [{ address: 'x'.repeat(501) }, '收货地址不能超过500个字符']
  ]

  for (const [body, message] of cases) {
    const res = response()
    await controller.updateProfile({ headers: { authorization: 'Bearer customer-token' }, body }, res)
    assert.equal(res.statusCode, 400)
    assert.equal(res.body.message, message)
  }
})

test('profile update service maps only approved columns and binds user values', async () => {
  const calls = []
  const profile = { id: 7, name: '新名字', address: '地址' }
  const service = new ShopPublicService({
    database: { getDatabase: () => ({
      query: async (...args) => {
        calls.push(args)
        return calls.length === 1 ? [{ affectedRows: 1 }, []] : [[profile], []]
      }
    }) }
  })

  const result = await service.updateCustomerProfile(7, {
    name: '新名字', address: '地址', unknown: 'ignored'
  })

  assert.deepEqual(result, profile)
  assert.deepEqual(calls, [
    ['UPDATE customers SET name = ?, address = ? WHERE id = ?', ['新名字', '地址', 7]],
    ['SELECT id, name, phone, gender, id_card, apple_id, address FROM customers WHERE id = ?', [7]]
  ])
})
