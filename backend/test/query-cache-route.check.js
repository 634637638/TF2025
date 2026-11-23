const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = path.resolve(__dirname, '..')

test('查询缓存清理由 controller 执行并清除综合查询缓存', () => {
  const { cacheMiddleware } = require('../src/middleware/cache')
  const QueryController = require('../src/controllers/query.controller')
  const controller = new QueryController()
  let nextCalled = false
  const cachedResponse = {
    set() {},
    json() {}
  }
  const cacheRequest = {
    user: { id: 731 },
    method: 'GET',
    originalUrl: '/api/query/comprehensive?page=1',
    query: { page: '1' }
  }

  cacheMiddleware({ ttl: 10000 })(cacheRequest, cachedResponse, () => {
    cachedResponse.json({ success: true, data: [] })
  })

  const result = {
    statusCode: 200,
    status(code) {
      this.statusCode = code
      return this
    },
    json(body) {
      this.body = body
      return this
    }
  }
  controller.clearQueryCache({}, result)

  assert.deepEqual(result.body, { success: true, message: '查询缓存已清除' })

  cacheMiddleware({ ttl: 10000 })(cacheRequest, cachedResponse, () => {
    nextCalled = true
  })
  assert.equal(nextCalled, true)
})

test('查询缓存专用路由先于动态 ID 删除路由并通过 controller', () => {
  const routeSource = fs.readFileSync(path.join(root, 'src/routes/query.js'), 'utf8')
  const cacheRouteIndex = routeSource.indexOf("router.delete('/cache'")
  const dynamicDeleteIndex = routeSource.indexOf("router.delete('/:id'")

  assert.ok(cacheRouteIndex >= 0)
  assert.ok(dynamicDeleteIndex > cacheRouteIndex)
  assert.match(routeSource, /router\.delete\('\/cache',\s*requirePermission\('query:view', 'business'\),\s*queryController\.clearQueryCache\.bind\(queryController\)\)/)
})

test('登录响应每次重新执行范围和字段检查，解绑或撤权后不复用旧响应', () => {
  const { cacheMiddleware, clearCache, getCacheStats } = require('../src/middleware/cache')
  clearCache()
  const middleware = cacheMiddleware({ ttl: 10000 })
  let visits = 0
  const user = { id: 7, store_ids: [1, 2] }
  const read = () => {
    const res = { headers: {}, set(key, value) { this.headers[key] = value }, json(data) { this.body = data } }
    middleware({ user, method: 'GET', originalUrl: '/api/query/comprehensive', query: {} }, res, () => {
      visits++; res.json({ success: true, data: [...user.store_ids] })
    })
    assert.match(res.headers['Cache-Control'], /no-store/)
    return res.body.data
  }
  assert.deepEqual(read(), [1, 2])
  user.store_ids = [1]
  assert.deepEqual(read(), [1])
  assert.equal(visits, 2)
  assert.equal(getCacheStats().total, 0)
})

test('客户商品历史清除条件式缓存头并禁止保存响应', () => {
  const routeSource = fs.readFileSync(path.join(root, 'src/routes/query.js'), 'utf8')
  const { noStore } = require('../src/middleware/cache')
  const req = { headers: { 'if-none-match': '"previous-etag"', 'if-modified-since': 'Sun, 22 Nov 2026 00:00:00 GMT' } }
  const headers = {}
  const res = { set(name, value) { headers[name] = value } }
  let nextCalls = 0

  noStore(req, res, () => { nextCalls += 1 })

  assert.equal(req.headers['if-none-match'], undefined)
  assert.equal(req.headers['if-modified-since'], undefined)
  assert.equal(headers['Cache-Control'], 'private, no-store')
  assert.equal(headers.Pragma, 'no-cache')
  assert.equal(headers.Expires, '0')
  assert.equal(nextCalls, 1)
  assert.match(routeSource, /router\.get\('\/customers\/:customerId\/goods',\s*noStore,/)
})

test('匿名公开响应仍可缓存，带凭据的请求不读取公开缓存', () => {
  const { cacheMiddleware, clearCache } = require('../src/middleware/cache')
  clearCache()
  const middleware = cacheMiddleware({ ttl: 10000 })
  const req = { method: 'GET', originalUrl: '/public-cache-test', query: {} }
  const res = () => ({ set() {}, json(data) { this.body = data } })
  middleware(req, res(), () => {})
  const first = res()
  middleware(req, first, () => first.json({ success: true, data: [1] }))
  const second = res()
  middleware(req, second, () => assert.fail('匿名公开响应应命中'))
  assert.deepEqual(second.body.data, [1])
  for (const headers of [{ authorization: 'isolated' }, { cookie: 'isolated' }]) {
    let checked = false
    middleware({ ...req, headers }, res(), () => { checked = true })
    assert.equal(checked, true)
  }
  clearCache()
})
