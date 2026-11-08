const test = require('node:test')
const assert = require('node:assert/strict')

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

test('品牌路由保留认证、权限、输入验证和缓存中间件并委托 controller', () => {
  const fs = require('node:fs')
  const path = require('node:path')
  const route = fs.readFileSync(path.join(__dirname, '../src/routes/brands.js'), 'utf8')
  assert.match(route, /requirePermission\('brands:create'\), validateBody\(/)
  assert.match(route, /requireAnyPermission\(\['brands:view', 'inventory:view', 'h5-templates:view', 'h5-admin:view'\]\), validateQuery\(/)
  assert.match(route, /cacheMiddleware\(\{ ttl: CACHE_TTL\.SHORT \}\), brandController\.list\.bind/)
  for (const [method, routePath, handler] of [
    ['get', '/stats/overview', 'getStats'],
    ['post', '/', 'create'],
    ['put', '/:id', 'update'],
    ['put', '/batch/reorder', 'reorder'],
    ['delete', '/:id', 'remove'],
    ['get', '/suggest', 'suggest']
  ]) {
    assert.match(route, new RegExp(`router\\.${method}\\('${routePath.replaceAll('/', '\\/')}'`))
    assert.match(route, new RegExp(`brandController\\.${handler}\\.bind\\(brandController\\)`))
  }
  assert.doesNotMatch(route, /async\s*\(/)
})

test('品牌排序事务失败时回滚并释放连接', async () => {
  const BrandRepository = require('../src/repositories/brand.repository')
  const calls = []
  const connection = {
    async beginTransaction() { calls.push('begin') },
    async execute() {
      calls.push('execute')
      throw new Error('write failed')
    },
    async commit() { calls.push('commit') },
    async rollback() { calls.push('rollback') },
    release() { calls.push('release') }
  }
  const repository = new BrandRepository()
  repository.getConnection = () => ({ getConnection: async () => connection })
  await assert.rejects(repository.reorderManagementBrands([{ id: 2, sort_order: 1 }]), /write failed/)
  assert.deepEqual(calls, ['begin', 'execute', 'rollback', 'release'])
})

test('品牌分页响应保留规范 page_size 和分页字段', async () => {
  const BrandManagementService = require('../src/services/brand-management.service')
  const service = new BrandManagementService({ connected: () => true, repository: {
    async listManagement({ pageSize, offset }) {
      assert.equal(pageSize, 10)
      assert.equal(offset, 10)
      return { total: 21, suggestions: [], brands: [{ id: 4, name: '测试品牌', status: 1, sort_order: 2, created_at: null, updated_at: null }] }
    }
  } })
  const result = await service.list({ page: '2', page_size: '10' })
  assert.deepEqual(result.data.pagination, {
    page: 2,
    page_size: 10,
    total: 21,
    total_pages: 3,
    has_next: true,
    has_prev: true
  })
  assert.equal(result.data.data[0].name, '测试品牌')
})

test('品牌管理 controller delegates HTTP results and retains cache invalidation', async () => {
  const BrandController = require('../src/controllers/brand.controller')
  let cleared = 0
  const controller = new BrandController({
    service: {
      async create() { return { type: 'created', data: { id: 4 } } },
      async update() { return { type: 'missing' } },
      async reorder() { return { type: 'invalid-items' } },
      async remove() { return { type: 'has-models' } }
    },
    clearCache() { cleared += 1 }
  })
  const created = createResponse()
  await controller.create({ body: {} }, created)
  assert.equal(created.body.message, '品牌创建成功')
  assert.equal(cleared, 1)

  const missing = createResponse()
  await controller.update({ params: { id: '9' }, body: {} }, missing)
  assert.equal(missing.statusCode, 404)

  const invalidOrder = createResponse()
  await controller.reorder({ body: { items: [] } }, invalidOrder)
  assert.equal(invalidOrder.statusCode, 400)

  const linked = createResponse()
  await controller.remove({ params: { id: '9' } }, linked)
  assert.equal(linked.statusCode, 400)
  assert.equal(cleared, 1)
})

test('品牌 repository parameterizes management queries and keeps one connection for reorder transaction', async () => {
  const BrandRepository = require('../src/repositories/brand.repository')
  const statements = []
  const connection = {
    async beginTransaction() { statements.push(['begin']) },
    async execute(sql, params) { statements.push([sql, params]); return [{ affectedRows: 1 }] },
    async commit() { statements.push(['commit']) },
    async rollback() { statements.push(['rollback']) },
    release() { statements.push(['release']) }
  }
  const database = {
    async execute(sql, params) {
      statements.push([sql, params])
      if (sql.includes('SELECT id FROM brands')) return [[{ id: 1 }], []]
      return [{ insertId: 4, affectedRows: 1 }, []]
    },
    async getConnection() { return connection }
  }
  const repository = new BrandRepository()
  repository.getConnection = () => database
  const created = await repository.createManagementBrand({ name: '品牌', status: 1, sortOrder: 2 })
  assert.deepEqual(created, { type: 'duplicate' })
  await repository.reorderManagementBrands([{ id: 2, sort_order: 1 }])
  assert.deepEqual(statements.slice(-4).map(statement => statement[0]), ['begin', 'UPDATE brands SET sort_order = ? WHERE id = ?', 'commit', 'release'])
  assert.deepEqual(statements.at(-3)[1], [1, 2])
})

test('品牌 repository binds search, status, LIMIT and OFFSET values in query order', async () => {
  const BrandRepository = require('../src/repositories/brand.repository')
  const repository = new BrandRepository()
  const calls = []
  repository.executePrepared = async (sql, params) => {
    calls.push({ sql, params })
    if (sql.includes('COUNT(*)')) return [[{ total: 12 }]]
    return [[{ id: 4, name: '测试品牌' }]]
  }

  await repository.listManagement({ name: '品牌', status: '1', pageSize: 10, offset: 20, returnAll: false })

  assert.match(calls[0].sql, /WHERE \(name LIKE \? OR LOWER\(name\) LIKE LOWER\(\?\)\) AND status = \? ORDER BY sort_order ASC, name ASC, id ASC LIMIT \? OFFSET \?/)
  assert.deepEqual(calls[0].params, ['%品牌%', '%品牌%', 1, 10, 20])
  assert.deepEqual(calls[1].params, ['%品牌%', '%品牌%', 1])
})
