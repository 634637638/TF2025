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
    fields: { getPermissions: async () => ({}), maskPayload: value => value },
    clearCache() { cleared += 1 }
  })
  const created = createResponse()
  await controller.create({ user: { id: 7 }, body: {} }, created)
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
    async query(sql, params) {
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
  repository.getConnection = () => ({
    async query(sql, params) {
      calls.push({ sql, params })
      if (sql.includes('COUNT(*)')) return [[{ total: 12 }]]
      return [[{ id: 4, name: '测试品牌' }]]
    },
    async execute() { assert.fail('品牌查询应走参数化 query 兼容路径') }
  })

  await repository.listManagement({ name: '品牌', status: '1', pageSize: 10, offset: 20, returnAll: false })

  assert.match(calls[0].sql, /WHERE \(name LIKE \? OR LOWER\(name\) LIKE LOWER\(\?\)\) AND status = \? ORDER BY sort_order ASC, name ASC, id ASC LIMIT \? OFFSET \?/)
  assert.deepEqual(calls[0].params, ['%品牌%', '%品牌%', 1, 10, 20])
  assert.deepEqual(calls[1].params, ['%品牌%', '%品牌%', 1])
})

test('品牌业务范围迁移预览只读，执行要求备份且保持幂等，异构字段拒绝覆盖', async () => {
  const { migrate } = require('../scripts/migrate-brand-business-scope')
  let column
  const writes = []
  const db = { async query(sql) {
    if (sql.includes('information_schema')) return [[{ COLUMN_NAME: 'id' }, ...(column ? [column] : [])]]
    writes.push(sql)
    column = { COLUMN_NAME: 'business_scope', COLUMN_TYPE: "enum('phone','accessory','both')", IS_NULLABLE: 'NO', COLUMN_DEFAULT: 'both' }
    return [[]]
  } }
  assert.equal((await migrate(db)).status, 'dry_run')
  await assert.rejects(migrate(db, { apply: true }), /backup-confirmed/)
  assert.equal(writes.length, 0)
  assert.equal((await migrate(db, { apply: true, backupConfirmed: true })).status, 'migrated_and_verified')
  assert.match(writes[0], /ALTER TABLE brands ADD COLUMN business_scope/)
  assert.equal((await migrate(db, { apply: true, backupConfirmed: true })).status, 'already_ready')
  assert.equal(writes.length, 1)
  column.COLUMN_DEFAULT = 'phone'
  await assert.rejects(migrate(db, { apply: true, backupConfirmed: true }), /拒绝覆盖/)
})

test('品牌业务列表默认手机范围，管理显式全部，新增/编辑校验范围且旧客户端编辑不重置范围', async () => {
  const BrandManagementService = require('../src/services/brand-management.service')
  const calls = []
  const repository = {
    async listManagement(options) { calls.push(options); return { brands: [{ id: 1, name: '配件品牌', business_scope: 'accessory' }], total: 1 } },
    async createManagementBrand(data) { calls.push(data); return { type: 'created', id: 1 } },
    async updateManagementBrand(data) { calls.push(data); return { type: 'updated' } }
  }
  const service = new BrandManagementService({ repository, connected: () => true })
  await service.list()
  assert.equal(calls.at(-1).businessScope, 'phone')
  const all = await service.list({ business_scope: 'all', all: 'true' })
  assert.equal(calls.at(-1).businessScope, 'all')
  assert.equal(all.data[0].business_scope, 'accessory')
  assert.equal((await service.create({ name: '配件品牌', business_scope: 'accessory' })).data.business_scope, 'accessory')
  await service.update(1, { name: '配件品牌' })
  assert.equal(calls.at(-1).businessScope, undefined)
  await service.update(1, { name: '配件品牌', business_scope: 'both' })
  assert.equal(calls.at(-1).businessScope, 'both')
  for (const business_scope of ['', null, 'invalid', true]) {
    await assert.rejects(service.create({ name: '品牌', business_scope }), { statusCode: 400 })
    await assert.rejects(service.list({ business_scope }), { statusCode: 400 })
  }
  assert.equal((await service.create({ name: '品牌', business_scope: 'all' })).type, 'invalid-scope')
})

test('品牌范围贯穿列表/计数/建议，查询参数化，未提交范围的编辑不覆盖原值', async () => {
  const BrandRepository = require('../src/repositories/brand.repository')
  const repository = new BrandRepository()
  const calls = []
  repository.executePrepared = async (sql, params) => {
    calls.push({ sql, params })
    if (sql.includes('COUNT(*)')) return [[{ total: 0 }]]
    if (sql.startsWith('UPDATE')) return [{ affectedRows: 1 }]
    return [[]]
  }
  await repository.listManagement({ name: "品牌'", businessScope: 'accessory', returnAll: true, suggest: 'true' })
  assert.equal(calls.length, 3)
  for (const { sql, params } of calls) {
    assert.match(sql, /business_scope IN \(\?, 'both'\)/)
    assert.equal(params.at(-1), 'accessory')
    assert.equal(sql.includes("品牌'"), false)
  }
  await repository.updateManagementBrand({ id: 1, name: '品牌', status: 1, sortOrder: 0 })
  assert.doesNotMatch(calls.at(-1).sql, /business_scope =/)
  await repository.updateManagementBrand({ id: 1, name: '品牌', status: 1, sortOrder: 0, businessScope: 'phone' })
  assert.deepEqual(calls.at(-1).params, ['品牌', 1, 0, 'phone', 1])
})

test('品牌业务范围沿用公共字段权限，隐藏时脱敏且拒绝写入', async () => {
  const BrandController = require('../src/controllers/brand.controller')
  const FieldAccessService = require('../src/services/field-access.service')
  const fields = new FieldAccessService({
    moduleKey: 'brands_brandsview', responseKeys: { 'brand.business_scope': ['business_scope'] },
    masking: {
      getUserFieldPermissions: async () => ({ hiddenFields: ['brand.business_scope'] }),
      filterSensitiveFields: rows => rows
    }
  })
  const controller = new BrandController({ fields, service: { list: async () => ({ data: [{ id: 1, business_scope: 'accessory' }] }) } })
  const response = createResponse()
  await controller.list({ user: { id: 7 }, query: {} }, response)
  assert.equal(response.body.data[0].business_scope, null)
  const denied = createResponse()
  await controller.rejectHiddenWrites({ business_scope: 'brand.business_scope' })({ user: { id: 7 }, body: { business_scope: 'phone' } }, denied, () => assert.fail('隐藏范围不得写入'))
  assert.equal(denied.statusCode, 403)
})

test('手机新增品牌引用和选项排除配件品牌，原交易读取不依赖新范围', async () => {
  const PhoneOptionRepository = require('../src/repositories/phone-option.repository')
  const InventoryRepository = require('../src/repositories/inventory.repository')
  const StockInRepository = require('../src/repositories/stock-in.repository')
  const calls = []
  const db = {
    async execute(sql, params) { calls.push({ sql, params }); return [[]] },
    async query(sql, params) { calls.push({ sql, params }); return [[]] }
  }
  await new PhoneOptionRepository(db).getOptionRows()
  for (const { sql } of calls.filter(({ sql }) => sql.includes('FROM brands') || sql.includes('JOIN brands b ON m.brand_id'))) {
    assert.match(sql, /business_scope IN \('phone', 'both'\)/)
  }
  await new StockInRepository().loadReferenceMap(db, 'brands', 'name', [1, 2])
  assert.match(calls.at(-1).sql, /business_scope IN \('phone', 'both'\)/)
  assert.deepEqual(calls.at(-1).params, [1, 2])
  assert.equal(await new InventoryRepository().validateQuickSaleReferences(db, { brandId: 2, modelId: 1, colorId: 1, memoryId: 1 }), false)
  const brandValidation = calls.findLast(({ sql }) => sql.includes('SELECT id FROM brands WHERE id'))
  assert.match(brandValidation.sql, /business_scope IN \('phone', 'both'\)/)
})
