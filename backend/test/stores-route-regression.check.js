const assert = require('node:assert/strict')
const test = require('node:test')
const Module = require('node:module')
const StoreRepository = require('../src/repositories/store.repository')

const loadStoresRouter = () => {
  const routes = []
  const repository = {
    async executePrepared(sql) {
      if (sql.includes('SELECT id FROM stores WHERE name = ? AND id != ?')) {
        return [[], []]
      }
      if (sql.includes('SELECT id FROM stores WHERE name = ?')) {
        return [[], []]
      }
      if (sql.includes('INSERT INTO stores')) {
        return [{ insertId: 11, affectedRows: 1 }, []]
      }
      if (sql.includes('UPDATE stores SET')) {
        return [{ affectedRows: 1 }, []]
      }
      if (sql.includes('DELETE FROM stores')) {
        return [{ affectedRows: 1 }, []]
      }
      if (sql.includes('SELECT name FROM stores')) {
        return [[{ name: '原门店' }], []]
      }
      if (sql.includes('FROM stores s') && sql.includes('WHERE s.id = ?')) {
        return [[{
          id: 11,
          name: '测试门店',
          location: '测试地址',
          phone: '13800000000',
          manager_id: null,
          manager_name: '',
          status: 1,
          sort_order: 0,
          created_at: null,
          updated_at: null
        }], []]
      }
      throw new Error(`未覆盖的门店测试 SQL: ${sql}`)
    },
    async withConnection() {
      throw new Error('本测试不应进入批量排序事务')
    }
  }

  const router = {
    get(path, ...handlers) {
      routes.push({ method: 'GET', path, handlers })
    },
    post(path, ...handlers) {
      routes.push({ method: 'POST', path, handlers })
    },
    put(path, ...handlers) {
      routes.push({ method: 'PUT', path, handlers })
    },
    delete(path, ...handlers) {
      routes.push({ method: 'DELETE', path, handlers })
    }
  }

  const responseApi = {
    success(res, data, message) {
      res.statusCode = res.statusCode || 200
      res.body = { success: true, data, message }
      return res
    },
    created(res, message, data) {
      res.statusCode = 201
      res.body = { success: true, data, message }
      return res
    },
    error(res, message, statusCode) {
      res.statusCode = statusCode
      res.body = { success: false, message }
      return res
    },
    notFound(res, message) {
      res.statusCode = 404
      res.body = { success: false, message }
      return res
    }
  }

  const originalLoad = Module._load
  Module._load = function mockedLoad(request, parent, isMain) {
    if (request === 'express') {
      return { Router: () => router }
    }
    if (request === '../utils/response') {
      return responseApi
    }
    if (request === '../middleware/unified-auth') {
      const pass = (_req, _res, next) => next?.()
      return {
        unifiedAuth: pass,
        requirePermission: () => pass,
        requireAnyPermission: () => pass,
        isSuperAdmin: () => false
      }
    }
    if (request === '../config/database') {
      return { isConnected: () => true }
    }
    if (request === '../repositories/store.repository') {
      return class MockStoreRepository {
        constructor() {
          return Object.assign(new StoreRepository(), repository)
        }
      }
    }
    if (request === '../middleware/cache') {
      return { cacheMiddleware: () => (_req, _res, next) => next?.(), clearCache: () => {} }
    }
    if (request === 'xlsx') {
      return { utils: {}, write: () => Buffer.alloc(0) }
    }
    if (request === '../utils/log') {
      return { error: () => {} }
    }
    return originalLoad.call(this, request, parent, isMain)
  }

  const routePath = require.resolve('../src/routes/stores')
  delete require.cache[routePath]
  try {
    require(routePath)
  } finally {
    Module._load = originalLoad
    delete require.cache[routePath]
  }

  return routes
}

const invokeRoute = async (routes, method, path, req) => {
  const route = routes.find(item => item.method === method && item.path === path)
  assert.ok(route, `未找到路由 ${method} ${path}`)
  const res = { statusCode: 0, body: null }
  await route.handlers.at(-1)(req, res)
  return res
}

test('门店增删改查统一走 StoreRepository，不再引用未定义 pool', async () => {
  const routes = loadStoresRouter()

  const created = await invokeRoute(routes, 'POST', '/', {
    body: { name: '测试门店', address: '测试地址', phone: '13800000000' }
  })
  assert.equal(created.statusCode, 201)

  const updated = await invokeRoute(routes, 'PUT', '/:id(\\d+)', {
    params: { id: '11' },
    body: { name: '测试门店', address: '测试地址', phone: '13800000000', status: 1, sort_order: 0 }
  })
  assert.equal(updated.statusCode, 200)

  const detail = await invokeRoute(routes, 'GET', '/:id', { params: { id: '11' } })
  assert.equal(detail.statusCode, 200)
  assert.equal(detail.body.data.id, 11)

  const deleted = await invokeRoute(routes, 'DELETE', '/:id', { params: { id: '11' } })
  assert.equal(deleted.statusCode, 200)
})
