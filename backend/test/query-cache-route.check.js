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
