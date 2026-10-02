const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const compatibilityRoute = require('../src/middleware/compatibility-route')

test('compatibility route middleware exposes audit headers without deprecation', () => {
  const headers = {}
  let nextCalled = false
  compatibilityRoute({
    compatibilityId: 'example-compatibility',
    replacement: '/api/example/canonical',
    reason: 'contract test'
  })({
    method: 'GET',
    originalUrl: '/api/example/legacy',
    user: { id: 7 }
  }, {
    setHeader(name, value) {
      headers[name] = value
    }
  }, () => {
    nextCalled = true
  })

  assert.equal(headers['X-Compatibility-Endpoint'], 'true')
  assert.equal(headers['X-Compatibility-Id'], 'example-compatibility')
  assert.equal(headers['X-Compatibility-Replacement'], '/api/example/canonical')
  assert.equal(headers['X-Reference-Route'], 'compatibility')
  assert.equal(headers.Deprecation, undefined)
  assert.equal(nextCalled, true)
})

test('仍在使用的兼容入口全部接入统一审计中间件', () => {
  const root = path.resolve(__dirname, '..', '..')
  const routeFiles = [
    'backend/src/routes/shop.js',
    'backend/src/routes/query.js',
    'backend/src/routes/brands.js',
    'backend/src/routes/index.js'
  ]

  for (const file of routeFiles) {
    const source = fs.readFileSync(path.join(root, file), 'utf8')
    assert.match(source, /compatibility-route/)
    assert.match(source, /compatibilityRoute\(/)
  }
})
