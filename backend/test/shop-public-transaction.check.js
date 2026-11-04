'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const Module = require('node:module')

const backendRoot = path.resolve(__dirname, '..')

function loadShopPublicRouter(database) {
  const routes = []
  const router = Object.fromEntries(['get', 'post', 'put', 'delete'].map(method => [
    method,
    (routePath, ...handlers) => routes.push({ method: method.toUpperCase(), path: routePath, handlers })
  ]))
  const responseApi = Object.fromEntries([
    ['success', 200], ['created', 201], ['badRequest', 400], ['unauthorized', 401],
    ['notFound', 404], ['error', 500], ['serverError', 500]
  ].map(([method, defaultStatus]) => [method, (...args) => {
    const res = args[0]
    const status = method === 'error' && typeof args[2] === 'number' ? args[2] : defaultStatus
    res.statusCode = status
    res.body = { method, args: args.slice(1) }
    return res
  }]))

  class MockShopPublicService {}
  class MockSystemSettingsService {}
  const pass = (_req, _res, next) => next?.()
  const originalLoad = Module._load
  Module._load = function mockedLoad(request, parent, isMain) {
    if (request === 'express') return { Router: () => router }
    if (request === '../utils/response') return responseApi
    if (request === '../services/shop-public.service') return MockShopPublicService
    if (request === '../config/database') return database
    if (request === '../utils/member-number') return { generateMemberNumber: async () => 'TF000001' }
    if (request === '../middleware/unified-auth') return { unifiedAuth: pass, requirePermission: () => pass }
    if (request === '../middleware/rate-limit') {
      return Object.fromEntries([
        'publicAuthRateLimit', 'publicOrderRateLimit', 'publicLookupRateLimit',
        'publicOrderPhoneLookupRateLimit', 'publicMarketingRateLimit'
      ].map(name => [name, pass]))
    }
    if (request === '../utils/order-access') {
      return { createOrderAccessToken: () => 'order-token', verifyOrderAccessToken: token => token === 'valid-order-token' }
    }
    if (request === '../utils/log') return { error: () => {}, warn: () => {}, info: () => {} }
    if (request === '../services/system-settings.service') return MockSystemSettingsService
    if (request === '../utils/security-enhanced') return { isValidIdCard: () => true }
    return originalLoad.call(this, request, parent, isMain)
  }

  const routeFile = require.resolve('../src/routes/shop-public')
  delete require.cache[routeFile]
  try {
    require(routeFile)
  } finally {
    Module._load = originalLoad
    delete require.cache[routeFile]
  }
  return routes
}

function createTransactionalDatabase({ order, failTokenInsert = false } = {}) {
  const state = {
    order: order ? { ...order } : null,
    customers: [],
    tokens: [],
    nextCustomerId: 1
  }
  let queue = Promise.resolve()

  const getConnection = () => {
    let unlock
    let transaction = null
    let released = false
    return {
      async beginTransaction() {
        const previous = queue
        queue = new Promise(resolve => { unlock = resolve })
        await previous
        transaction = { customers: [], tokens: [], order: state.order && { ...state.order } }
      },
      async query(sql, params = []) {
        if (/SELECT id, order_number, customer_phone, status, expires_at FROM H5_orders/.test(sql)) {
          return [transaction?.order?.id === Number(params[0]) ? [{ ...transaction.order }] : [], []]
        }
        if (/UPDATE H5_orders/.test(sql)) {
          if (transaction?.order && transaction.order.id === Number(params[1]) && transaction.order.status === 'pending') {
            transaction.order.status = 'cancelled'
            return [{ affectedRows: 1 }, []]
          }
          return [{ affectedRows: 0 }, []]
        }
        if (/SELECT id FROM customers WHERE phone = \? FOR UPDATE/.test(sql)) {
          const customers = [...state.customers, ...(transaction?.customers || [])]
          return [customers.filter(customer => customer.phone === params[0]).map(({ id }) => ({ id })), []]
        }
        if (/INSERT INTO customers/.test(sql)) {
          const customer = { id: state.nextCustomerId++, name: params[0], phone: params[1], password: params[2], member_number: params[3] }
          transaction.customers.push(customer)
          return [{ insertId: customer.id, affectedRows: 1 }, []]
        }
        if (/INSERT INTO customer_tokens/.test(sql)) {
          if (failTokenInsert) throw new Error('token insert failed')
          transaction.tokens.push({ customer_id: params[0], token: params[1], expires_at: params[2] })
          return [{ affectedRows: 1 }, []]
        }
        if (/SELECT id, name, phone, avatar, member_number FROM customers WHERE id = \?/.test(sql)) {
          const customer = [...state.customers, ...(transaction?.customers || [])].find(item => item.id === Number(params[0]))
          return [customer ? [{ id: customer.id, name: customer.name, phone: customer.phone, avatar: null, member_number: customer.member_number }] : [], []]
        }
        throw new Error(`未覆盖的 SQL: ${sql}`)
      },
      async commit() {
        if (transaction) {
          if (state.order && transaction.order) state.order.status = transaction.order.status
          state.customers.push(...transaction.customers)
          state.tokens.push(...transaction.tokens)
          transaction = null
        }
        unlock?.()
        unlock = null
      },
      async rollback() {
        transaction = null
        unlock?.()
        unlock = null
      },
      release() {
        if (!released) {
          released = true
          unlock?.()
          unlock = null
        }
      }
    }
  }

  return {
    state,
    database: { getDatabase: () => ({ getConnection }) }
  }
}

async function invoke(routes, method, routePath, req) {
  const route = routes.find(item => item.method === method && item.path === routePath)
  assert.ok(route, `未找到路由 ${method} ${routePath}`)
  const res = { statusCode: 0, body: null }
  await route.handlers.at(-1)(req, res)
  return res
}

test('并发取消同一待支付订单只允许一次状态转换', async () => {
  const fixture = createTransactionalDatabase({
    order: { id: 7, order_number: 'H5-7', customer_phone: '13800000000', status: 'pending', expires_at: null }
  })
  const routes = loadShopPublicRouter(fixture.database)
  const request = () => invoke(routes, 'PUT', '/orders/:id/cancel', {
    params: { id: '7' },
    body: { access_token: 'valid-order-token' }
  })

  const results = await Promise.all([request(), request()])
  assert.deepEqual(results.map(result => result.statusCode).sort(), [200, 400])
  assert.equal(fixture.state.order.status, 'cancelled')
})

test('注册写入 Token 失败时回滚客户记录并释放事务', async () => {
  const fixture = createTransactionalDatabase({ failTokenInsert: true })
  const routes = loadShopPublicRouter(fixture.database)
  const result = await invoke(routes, 'POST', '/auth/register', {
    body: { name: '测试客户', phone: '13800000000', password: 'test-password' }
  })

  assert.equal(result.statusCode, 500)
  assert.deepEqual(fixture.state.customers, [])
  assert.deepEqual(fixture.state.tokens, [])
})

test('价格支付确认与后台取消均锁定订单并带状态条件更新', () => {
  const source = fs.readFileSync(path.join(backendRoot, 'src/services/shop-public.service.js'), 'utf8')
  const payStart = source.indexOf('async confirmUserPayment(orderNumber)')
  const cancelStart = source.indexOf('async cancelH5Order(orderId, _adminId, reason)')
  const payHandler = source.slice(payStart, cancelStart)
  const cancelEnd = source.indexOf('async getH5OrderStatistics', cancelStart)
  const cancelHandler = source.slice(cancelStart, cancelEnd)

  assert.match(payHandler, /status = "pending" FOR UPDATE/)
  assert.match(payHandler, /WHERE id = \? AND status = "pending"/)
  assert.match(payHandler, /affectedRows !== 1/)
  assert.match(cancelHandler, /WHERE id = \? FOR UPDATE/)
  assert.match(cancelHandler, /WHERE id = \? AND status = \?'/)
  assert.match(cancelHandler, /affectedRows !== 1/)
})

test('客户手机号唯一约束迁移覆盖全体客户并可回滚到 H5 约束', () => {
  const source = fs.readFileSync(path.join(backendRoot, 'scripts/migrate-customer-phone-uniqueness.js'), 'utf8')

  assert.match(source, /GENERATED_COLUMN = 'normalized_phone'/)
  assert.match(source, /UNIQUE_INDEX = 'uk_customers_normalized_phone'/)
  assert.match(source, /GENERATED ALWAYS AS \(NULLIF\(TRIM\(phone\), ''\)\) STORED/)
  assert.match(source, /GROUP BY TRIM\(phone\)[\s\S]*HAVING COUNT\(\*\) > 1/)
  assert.match(source, /process\.argv\.includes\('--apply'\)/)
  assert.match(source, /process\.argv\.includes\('--rollback'\)/)
  assert.match(source, /DROP INDEX \$\{UNIQUE_INDEX\}/)
  assert.match(source, /DROP COLUMN \$\{GENERATED_COLUMN\}/)
  assert.match(source, /LEGACY_UNIQUE_INDEX/)
  assert.match(source, /LEGACY_GENERATED_COLUMN/)
})

test('H5 登录后的订单和销售历史使用最大 50 条的统一分页契约', () => {
  const route = fs.readFileSync(path.join(backendRoot, 'src/routes/shop-public.js'), 'utf8')
  const service = fs.readFileSync(path.join(backendRoot, 'src/services/shop-public.service.js'), 'utf8')
  const authApi = fs.readFileSync(path.join(backendRoot, '../frontend/src/api/auth.ts'), 'utf8')
  const orderQuery = fs.readFileSync(path.join(backendRoot, '../frontend/src/views/H5-mobile/page/OrderQuery.vue'), 'utf8')
  const myCenter = fs.readFileSync(path.join(backendRoot, '../frontend/src/views/H5-mobile/page/MyCenter.vue'), 'utf8')
  const ordersStart = route.indexOf("router.get('/auth/orders'")
  const salesStart = route.indexOf("router.get('/auth/sales'")
  const profileStart = route.indexOf("router.get('/auth/profile'")
  const ordersHandler = route.slice(ordersStart, salesStart)
  const salesHandler = route.slice(salesStart, profileStart)
  const orderServiceStart = service.indexOf('async getOrdersByPhone')
  const salesServiceStart = service.indexOf('async getSalesByCustomerId')
  const statusServiceStart = service.indexOf('async updateOrderStatus', salesServiceStart)
  const orderMethod = service.slice(orderServiceStart, salesServiceStart)
  const salesMethod = service.slice(salesServiceStart, statusServiceStart)

  assert.match(route, /Math\.min\(50, Math\.max\(1,/)
  assert.match(ordersHandler, /normalizeAuthenticatedHistoryPagination\(req\.query\)/)
  assert.match(ordersHandler, /sendPublicPaginated\(res, result, '获取订单成功'\)/)
  assert.match(salesHandler, /normalizeAuthenticatedHistoryPagination\(req\.query\)/)
  assert.match(salesHandler, /sendPublicPaginated\(res, result, '获取销售记录成功'\)/)
  assert.match(orderMethod, /LIMIT \? OFFSET \?/)
  assert.match(orderMethod, /customer_name = \?/)
  assert.match(salesMethod, /SELECT COUNT\(\*\) as total FROM sales WHERE customer_id = \?/)
  assert.match(salesMethod, /LIMIT \? OFFSET \?/)
  assert.doesNotMatch(ordersHandler, /SELECT \* FROM H5_orders/)
  assert.match(authApi, /extractPaginatedData/)
  assert.match(authApi, /getUserOrders\(params\?: \{ page\?: number; page_size\?: number \}\)/)
  assert.match(authApi, /getUserSales\(params\?: \{ page\?: number; page_size\?: number \}\)/)
  assert.match(orderQuery, /getUserOrders\(\{ page: current_page\.value, page_size \}\)/)
  assert.match(myCenter, /loadMorePurchaseRecords/)
  assert.match(myCenter, /purchaseRecords\.value\.push\(\.\.\.result\.data\)/)
})

test('H5 订单历史复合索引迁移支持预览、执行和回滚', () => {
  const source = fs.readFileSync(path.join(backendRoot, 'scripts/migrate-h5-order-history-index.js'), 'utf8')

  assert.match(source, /INDEX_NAME = 'idx_h5_orders_phone_created'/)
  assert.match(source, /customer_phone, created_at DESC, id DESC/)
  assert.match(source, /process\.argv\.includes\('--apply'\)/)
  assert.match(source, /process\.argv\.includes\('--rollback'\)/)
  assert.match(source, /ALTER TABLE H5_orders DROP INDEX \$\{INDEX_NAME\}/)
  assert.match(source, /COLLATION/)
})

test('缓存和高负载限流使用模块级单例定时器及限流器', () => {
  const cache = fs.readFileSync(path.join(backendRoot, 'src/middleware/cache.js'), 'utf8')
  const rateLimit = fs.readFileSync(path.join(backendRoot, 'src/middleware/rate-limit.js'), 'utf8')
  const cacheFactoryStart = cache.indexOf('function cacheMiddleware')
  const cacheFactoryEnd = cache.indexOf('// 清除特定缓存', cacheFactoryStart)
  const cacheFactory = cache.slice(cacheFactoryStart, cacheFactoryEnd)
  const adaptiveStart = rateLimit.indexOf('const adaptiveRateLimit')
  const adaptiveEnd = rateLimit.indexOf('// 限流日志记录', adaptiveStart)
  const adaptiveHandler = rateLimit.slice(adaptiveStart, adaptiveEnd)

  assert.match(cache, /const cleanupTimer = setInterval\(cleanupExpiredCache, 60000\)/)
  assert.match(cache, /cleanupTimer\.unref\?\.\(\)/)
  assert.doesNotMatch(cacheFactory, /setInterval/)
  assert.match(rateLimit, /const storeCleanupTimer = setInterval\(store\.cleanup, 5 \* 60 \* 1000\)/)
  assert.match(rateLimit, /storeCleanupTimer\.unref\?\.\(\)/)
  assert.match(rateLimit, /const highLoadRateLimit = rateLimit\(\{/)
  assert.match(adaptiveHandler, /return highLoadRateLimit\(req, res, next\)/)
  assert.doesNotMatch(adaptiveHandler, /rateLimit\(\{/)
})
