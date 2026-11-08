import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { collectRouteRegistrations, resolveDelegatedControllerMethodSource } from './lib/route-security-analysis.mjs'

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

test('manual authentication audit follows the route-bound controller method', () => {
  const root = mkdtempSync(join(tmpdir(), 'route-security-'))
  const routesDirectory = join(root, 'routes')
  const controllersDirectory = join(root, 'controllers')
  mkdirSync(routesDirectory)
  mkdirSync(controllersDirectory)
  const routeFile = join(routesDirectory, 'orders.js')
  const routeSource = `
    const router = express.Router()
    const OrdersController = require('../controllers/orders.controller')
    const ordersController = new OrdersController()
    router.get('/orders/:orderNumber', ordersController.getOrder.bind(ordersController))
  `
  writeFileSync(join(controllersDirectory, 'orders.controller.js'), `
    class OrdersController {
      async getOrder(req, res) {
        if (!this.verifyOrderToken(req.query.token)) return res.sendStatus(401)
      }
    }
    module.exports = OrdersController
  `)

  try {
    const route = collectRouteRegistrations(routeFile, routeSource)[0]
    const methodSource = resolveDelegatedControllerMethodSource(routeFile, routeSource, route)
    assert.match(methodSource, /this\.verifyOrderToken/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
