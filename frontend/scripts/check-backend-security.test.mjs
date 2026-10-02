import test from 'node:test'
import assert from 'node:assert/strict'
import { collectRouteRegistrations } from './lib/route-security-analysis.mjs'

test('route analysis checks each endpoint rather than any auth marker in its file', () => {
  const source = `
    const router = express.Router()
    router.get('/private', unifiedAuth, handler)
    router.get('/public', handler)
  `
  const routes = collectRouteRegistrations('fixture.js', source)

  assert.equal(routes.length, 2)
  assert.equal(routes[0].middlewareAuthenticated, true)
  assert.equal(routes[1].middlewareAuthenticated, false)
})

test('route analysis recognizes router-wide auth and chained route declarations', () => {
  const source = `
    const router = express.Router()
    router.use(unifiedAuth)
    router.route('/chained').post(handler)
  `
  const routes = collectRouteRegistrations('fixture.js', source)

  assert.equal(routes.length, 1)
  assert.equal(routes[0].path, '/chained')
  assert.equal(routes[0].globallyAuthenticated, true)
})

test('route analysis reports paths that cannot be statically reviewed', () => {
  const source = `
    const router = express.Router()
    router.get(routePath, handler)
  `
  const routes = collectRouteRegistrations('fixture.js', source)

  assert.equal(routes[0].path, null)
})
