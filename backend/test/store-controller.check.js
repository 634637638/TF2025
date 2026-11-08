const StoreRepository = require('../src/repositories/store.repository')
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { withConnection } = require('../src/core/db/connection')
const StoreController = require('../src/controllers/store.controller')

const backendRoot = path.resolve(__dirname, '..')
const createResponse = () => ({
  status(code) {
    this.statusCode = code
    return this
  },
  json(body) {
    this.body = body
    return this
  }
})

test('门店路由保留各自权限、中间件和 controller 委托', () => {
  const route = fs.readFileSync(path.join(backendRoot, 'src/routes/stores.js'), 'utf8')
  const expected = [
    "router.get('/', unifiedAuth, requireAnyPermission(['stores:view', 'inventory:view', 'sales:view', 'query:view']), cacheMiddleware({ ttl: CACHE_TTL.MEDIUM }), storeController.list.bind(storeController))",
    "router.get('/export', unifiedAuth, requirePermission('stores:export'), storeController.export.bind(storeController))",
    "router.post('/', unifiedAuth, requirePermission('stores:create'), storeController.create.bind(storeController))",
    "router.put('/:id(\\\\d+)', unifiedAuth, requirePermission('stores:edit'), storeController.update.bind(storeController))",
    "router.delete('/:id', unifiedAuth, requirePermission('stores:delete'), storeController.remove.bind(storeController))",
    "router.get('/managers', unifiedAuth, requirePermission('stores:view'), storeController.managers.bind(storeController))",
    "router.get('/stats', unifiedAuth, requirePermission('stores:view'), storeController.stats.bind(storeController))",
    "router.put('/batch/reorder', unifiedAuth, requirePermission('stores:edit'), storeController.reorder.bind(storeController))",
    "router.get('/:id', unifiedAuth, requirePermission('stores:view'), storeController.get.bind(storeController))"
  ]
  for (const declaration of expected) assert.ok(route.includes(declaration), declaration)
})

test('门店全量选项保留 strict scope 隔离和空范围结果', async () => {
  const calls = []
  const controller = new StoreController({
    databaseConnected: () => true,
    superAdminCheck: () => false,
    repository: Object.assign(new StoreRepository(), {
      async executePrepared(sql, params) {
        calls.push({ sql, params })
        return [[{ id: '5', name: '总店', sort_order: '2' }]]
      }
    })
  })
  const response = createResponse()
  await controller.list({
    query: { all: 'true', strict_scope: 'true', name: '总' },
    user: { store_ids: ['5', 0, 'invalid', 8] }
  }, response)
  assert.match(calls[0].sql, /s\.id IN \(\?,\?\)/)
  assert.deepEqual(calls[0].params, [5, 8, '%总%'])
  assert.deepEqual(response.body.data, [{ id: 5, name: '总店', sort_order: 2 }])

  const noScope = createResponse()
  await controller.list({ query: { all: true, strict_scope: true }, user: { store_ids: [] } }, noScope)
  assert.deepEqual(noScope.body.data, [])
  assert.equal(calls.length, 1)
})

test('门店分页列表和统计保持规范字段、参数绑定及状态校验', async () => {
  const calls = []
  const controller = new StoreController({
    databaseConnected: () => true,
    repository: Object.assign(new StoreRepository(), {
      async executePrepared(sql, params) {
        calls.push({ sql, params })
        if (sql.startsWith('SELECT COUNT(*)')) return [[{ total: 21 }]]
        if (sql.includes('SUM(s.status = 1)')) return [[{
          total: 4, active: 3, inactive: 1, with_manager: 2, with_phone: 4, recent: 1
        }]]
        return [[{ id: '4', name: '北区', location: '地址', phone: '123', manager_id: 2, manager_name: '店长', status: 1, sort_order: 3 }]]
      }
    })
  })
  const page = createResponse()
  await controller.list({ query: { page: '2', page_size: '10', name: '北', status: '1' } }, page)
  assert.deepEqual(calls[0].params, ['%北%', 1])
  assert.match(calls[0].sql, /ORDER BY s\.sort_order ASC, s\.id DESC LIMIT 10 OFFSET 10/)
  assert.deepEqual(page.body.data.data[0], {
    id: 4, name: '北区', address: '地址', phone: '123', manager: '店长', manager_id: 2,
    status: 1, sort_order: 3, created_at: null, updated_at: null
  })
  assert.deepEqual(page.body.data.pagination, {
    page: 2, page_size: 10, total: 21, total_pages: 3, has_next: true, has_prev: true
  })

  const invalid = createResponse()
  await controller.list({ query: { status: 'active' } }, invalid)
  assert.equal(invalid.statusCode, 400)

  const stats = createResponse()
  await controller.stats({ query: { name: ' 北区 ', status: '0' } }, stats)
  assert.deepEqual(calls[2].params, ['%北区%', 0])
  assert.deepEqual(stats.body.data, {
    total: 4, active: 3, inactive: 1, with_manager: 2, with_phone: 4, recent: 1
  })
})

test('门店负责人必须为有效在职用户，负责人电话优先于表单电话', async () => {
  let queryParams
  const controller = new StoreController({
    databaseConnected: () => true,
    repository: Object.assign(new StoreRepository(), {
      async executePrepared(sql, params) {
        if (sql.includes('SELECT id, phone FROM users')) {
          queryParams = params
          return [[{ id: 9, phone: ' 13900000000 ' }]]
        }
        if (sql.startsWith('SELECT id FROM stores WHERE name')) return [[]]
        if (sql.includes('WHERE s.id = ?')) return [[{ id: 7, name: '新店', phone: '13900000000', manager_id: 9 }]]
        if (sql.startsWith('INSERT INTO stores')) return [{ insertId: 7 }]
        assert.fail(`unexpected SQL: ${sql}`)
      }
    }),
    invalidateCache() {}
  })
  const invalidManager = createResponse()
  await controller.create({ body: { name: '新店', manager_id: 'x' } }, invalidManager)
  assert.equal(invalidManager.statusCode, 400)

  const created = createResponse()
  await controller.create({ body: { name: '新店', phone: '13800000000', manager_id: '9' } }, created)
  assert.equal(created.statusCode, 201)
  assert.deepEqual(queryParams, [9])
  assert.deepEqual(created.body.data, {
    id: 7, name: '新店', address: '', phone: '13900000000', manager: '', manager_id: 9,
    status: 0, sort_order: 0, created_at: null, updated_at: null
  })
})

test('门店批量排序提交或回滚后都释放事务连接', async () => {
  const events = []
  const connection = {
    async beginTransaction() { events.push('begin') },
    async execute(sql, params) { events.push(['execute', sql, params]) },
    async commit() { events.push('commit') },
    async rollback() { events.push('rollback') },
    release() { events.push('release') }
  }
  const controller = new StoreController({
    databaseConnected: () => true,
    repository: Object.assign(new StoreRepository(), { withConnection(operation) { return withConnection({ getConnection: async () => connection }, operation) } }),
    invalidateCache: () => events.push('invalidate')
  })
  const success = createResponse()
  await controller.reorder({ body: { items: [{ id: 4, sort_order: 2 }, { id: 5 }] } }, success)
  assert.deepEqual(events.map(event => Array.isArray(event) ? event[2] : event), ['begin', [2, 4], 'commit', 'release', 'invalidate'])
  assert.equal(success.body.message, '排序更新成功')

  events.length = 0
  connection.execute = async () => { throw new Error('write failed') }
  const failure = createResponse()
  await controller.reorder({ body: { items: [{ id: 4, sort_order: 2 }] } }, failure)
  assert.deepEqual(events, ['begin', 'rollback', 'release'])
  assert.equal(failure.statusCode, 500)
})
