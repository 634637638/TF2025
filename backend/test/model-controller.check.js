const ModelRepository = require('../src/repositories/model.repository')
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { withConnection } = require('../src/core/db/connection')
const ModelController = require('../src/controllers/model.controller')

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

test('型号全部路由保留权限、缓存和 controller 委托', () => {
  const route = fs.readFileSync(path.join(backendRoot, 'src/routes/models.js'), 'utf8')
  const expected = [
    "router.get('/', unifiedAuth, requireAnyPermission(['models:view', 'brands:view', 'inventory:view', 'query:view', 'h5-templates:view', 'h5-admin:view']), cacheMiddleware({ ttl: CACHE_TTL.SHORT }), modelController.list.bind(modelController))",
    "router.get('/brand/:brandId', unifiedAuth, requirePermission('models:view'), cacheMiddleware({ ttl: CACHE_TTL.SHORT }), modelController.listByBrand.bind(modelController))",
    "router.get('/stats/overview', unifiedAuth, requirePermission('models:view'), modelController.stats.bind(modelController))",
    "router.get('/:id', unifiedAuth, requirePermission('models:view'), modelController.get.bind(modelController))",
    "router.post('/', unifiedAuth, requirePermission('models:create'), modelController.create.bind(modelController))",
    "router.put('/:id', unifiedAuth, requirePermission('models:edit'), modelController.update.bind(modelController))",
    "router.delete('/:id', unifiedAuth, requirePermission('models:delete'), modelController.remove.bind(modelController))",
    "router.patch('/:id/toggle', unifiedAuth, requirePermission('models:edit'), modelController.toggle.bind(modelController))",
    "router.put('/batch/reorder', unifiedAuth, requirePermission('models:edit'), modelController.reorder.bind(modelController))"
  ]
  for (const declaration of expected) assert.ok(route.includes(declaration), declaration)
})

test('型号列表保留品牌名解析、筛选绑定、白名单排序和分页', async () => {
  const calls = []
  const controller = new ModelController({
    databaseConnected: () => true,
    repository: Object.assign(new ModelRepository(), {
      async executePrepared(sql, params) {
        calls.push({ sql, params })
        if (sql.startsWith('SELECT id FROM brands')) return [[{ id: 6 }]]
        if (sql.includes('COUNT(*)')) return [[{ total: 31 }]]
        return [[{ id: '4', brand_id: '6', brand_name: ' Apple ', name: ' iPhone ', status: 1, sort_order: 2 }]]
      }
    })
  })
  const response = createResponse()
  await controller.list({
    query: { page: '2', page_size: '10', brand_id: 'Apple', name: 'Phone', status: '1', sort_by: 'bogus', sort_order: 'DESC' }
  }, response)

  assert.deepEqual(calls[0].params, ['Apple'])
  assert.match(calls[1].sql, /ORDER BY m\.sort_order DESC, m\.name ASC, m\.id ASC LIMIT 10 OFFSET 10/)
  assert.deepEqual(calls[1].params, [6, 1, '%Phone%'])
  assert.deepEqual(response.body.data.models[0], {
    id: 4,
    brand_id: 6,
    brand_name: 'Apple',
    name: 'iPhone',
    status: 1,
    sort_order: 2,
    created_at: null,
    updated_at: null
  })
  assert.equal(response.body.data.pagination.page_size, 10)

  let optionRequest
  const optionController = new ModelController({
    databaseConnected: () => true,
    modelsByBrand: async options => {
      optionRequest = options
      return [{ id: '8', brand_id: '6', name: 'Model', status: 1, sort_order: 0 }]
    }
  })
  const options = createResponse()
  await optionController.list({ query: { brand_id: '6', name: 'Model', all: 'true', active_only: 'true', include_id: '8' } }, options)
  assert.deepEqual(optionRequest, { brand_id: '6', name: 'Model', include_id: '8', activeOnly: true })
  assert.equal(options.body.data[0].id, 8)
})

test('型号品牌列表和统计保留规范字段及筛选', async () => {
  const calls = []
  const controller = new ModelController({
    databaseConnected: () => true,
    repository: Object.assign(new ModelRepository(), {
      async executePrepared(sql, params) {
        calls.push({ sql, params })
        if (sql.includes('COUNT(*)')) return [[{ total: 2 }]]
        return [[
          { id: 1, brand_id: 6, brand_name: 'Apple', name: 'iPhone 1', status: 1 },
          { id: 2, brand_id: 6, brand_name: 'Apple', name: 'iPhone 2', status: 0 }
        ]]
      }
    })
  })
  const brandList = createResponse()
  await controller.listByBrand({ params: { brandId: '6' }, query: { page: '1', page_size: '5', status: '1', name: 'Phone', sort_by: 'name', sort_order: 'desc' } }, brandList)
  assert.deepEqual(calls[0].params, [6, 1, '%Phone%'])
  assert.match(calls[0].sql, /ORDER BY m\.name DESC, m\.sort_order ASC, m\.name ASC, m\.id ASC/)
  assert.equal(brandList.body.data.pagination.page_size, 5)

  const stats = createResponse()
  await controller.stats({ query: { brand_id: '6', name: ' iPhone ', status: '1' } }, stats)
  assert.deepEqual(calls[2].params, [6, '%iPhone%', 1])
  assert.deepEqual(stats.body.data, {
    total: 2,
    active: 1,
    inactive: 1,
    related_brands: 1,
    by_brand: { Apple: 2 },
    newest_model: 'iPhone 1'
  })
})

test('型号创建和更新保持必填及重复校验，变更后清理缓存', async () => {
  const calls = []
  let cacheClears = 0
  const controller = new ModelController({
    databaseConnected: () => true,
    invalidateCache: () => { cacheClears += 1 },
    repository: Object.assign(new ModelRepository(), {
      async executePrepared(sql, params) {
        calls.push({ sql, params })
        if (sql.includes('AND id !=')) return [[{ id: 9 }]]
        if (sql.startsWith('SELECT id FROM models WHERE name')) return [[]]
        if (sql.startsWith('INSERT INTO models')) return [{ insertId: 7 }]
        if (sql.includes('SELECT m.id, m.brand_id, m.name')) return [[{ id: 7, brand_id: 6, brand_name: 'Apple', name: 'iPhone', status: 1, sort_order: 0 }]]
        return [[]]
      }
    })
  })
  const missing = createResponse()
  await controller.create({ body: {} }, missing)
  assert.equal(missing.statusCode, 400)

  const created = createResponse()
  await controller.create({ body: { brand_id: '6', name: 'iPhone' } }, created)
  assert.equal(created.statusCode, 201)
  assert.deepEqual(calls[1].params, [6, 'iPhone', 1, 0])
  assert.equal(cacheClears, 1)

  const duplicate = createResponse()
  await controller.update({ params: { id: '7' }, body: { name: 'iPhone' } }, duplicate)
  assert.equal(duplicate.statusCode, 400)
  assert.equal(cacheClears, 1)
})

test('型号详情、删除和状态切换维持原响应语义', async () => {
  const calls = []
  let cacheClears = 0
  let deleted = false
  let status = 1
  const controller = new ModelController({
    databaseConnected: () => true,
    invalidateCache: () => { cacheClears += 1 },
    repository: Object.assign(new ModelRepository(), {
      async executePrepared(sql, params) {
        calls.push({ sql, params })
        if (sql.startsWith('DELETE FROM models')) {
          deleted = true
          return [[]]
        }
        if (sql.startsWith('UPDATE models SET status')) {
          status = params[0]
          return [[]]
        }
        if (deleted) return [[]]
        if (sql.includes('LEFT JOIN brands')) {
          return [[{ id: 3, brand_id: 6, brand_name: 'Apple', name: 'iPhone', status, sort_order: 0 }]]
        }
        return [[{ id: 3, brand_id: 6, name: 'iPhone', status, sort_order: 0 }]]
      }
    })
  })
  const detail = createResponse()
  await controller.get({ params: { id: '3' } }, detail)
  assert.equal(detail.body.data.name, 'iPhone')

  const toggled = createResponse()
  await controller.toggle({ params: { id: '3' } }, toggled)
  assert.equal(toggled.body.message, '型号禁用成功')
  assert.equal(toggled.body.data.status, 0)

  const removed = createResponse()
  await controller.remove({ params: { id: '3' } }, removed)
  assert.equal(removed.body.message, '型号删除成功')
  assert.equal(cacheClears, 2)

  const missing = createResponse()
  await controller.get({ params: { id: '3' } }, missing)
  assert.equal(missing.statusCode, 404)
})

test('型号排序事务提交或回滚后均释放连接', async () => {
  const events = []
  const connection = {
    async beginTransaction() { events.push('begin') },
    async execute(sql, params) { events.push(['execute', sql, params]) },
    async commit() { events.push('commit') },
    async rollback() { events.push('rollback') },
    release() { events.push('release') }
  }
  const controller = new ModelController({
    databaseConnected: () => true,
    invalidateCache: () => events.push('invalidate'),
    repository: Object.assign(new ModelRepository(), { withConnection(operation) { return withConnection({ getConnection: async () => connection }, operation) } })
  })
  const success = createResponse()
  await controller.reorder({ body: { items: [{ id: 2, sort_order: 4 }, { id: 3 }] } }, success)
  assert.deepEqual(events.map(event => Array.isArray(event) ? event[2] : event), ['begin', [4, 2], 'commit', 'release', 'invalidate'])
  assert.equal(success.body.message, '排序更新成功')

  events.length = 0
  connection.execute = async () => { throw new Error('write failed') }
  const failure = createResponse()
  await controller.reorder({ body: { items: [{ id: 2, sort_order: 4 }] } }, failure)
  assert.deepEqual(events, ['begin', 'rollback', 'release'])
  assert.equal(failure.statusCode, 500)
})
