const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { withConnection } = require('../src/core/db/connection')

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

test('颜色全部路由保留原权限并委托 controller', () => {
  const route = fs.readFileSync(path.join(backendRoot, 'src/routes/colors.js'), 'utf8')

  const declarations = [
    "router.get('/', unifiedAuth, requireAnyPermission(['colors:view', 'inventory:view', 'h5-templates:view', 'h5-admin:view']), cacheMiddleware({ ttl: CACHE_TTL.SHORT }), colorController.list.bind(colorController))",
    "router.get('/:id(\\\\d+)', unifiedAuth, requirePermission('colors:view'), colorController.get.bind(colorController))",
    "router.post('/', unifiedAuth, requirePermission('colors:create'), colorController.create.bind(colorController))",
    "router.put('/:id', unifiedAuth, requirePermission('colors:edit'), colorController.update.bind(colorController))",
    "router.delete('/:id', unifiedAuth, requirePermission('colors:delete'), colorController.delete.bind(colorController))",
    "router.get('/stats/overview', unifiedAuth, requirePermission('colors:view'), colorController.stats.bind(colorController))",
    "router.patch('/:id/toggle', unifiedAuth, requirePermission('colors:edit'), colorController.toggle.bind(colorController))",
    "router.put('/batch/reorder', unifiedAuth, requirePermission('colors:edit'), colorController.reorder.bind(colorController))"
  ]
  for (const declaration of declarations) assert.ok(route.includes(declaration), declaration)
})

test('颜色列表保留筛选、安全排序、分页和格式化响应', async () => {
  const ColorController = require('../src/controllers/color.controller')
  const queries = []
  const controller = new ColorController({
    repository: {
      async executePrepared(sql, values) {
        queries.push({ sql, values })
        if (sql.includes('COUNT(*)')) return [[{ total: 12 }], []]
        return [[{
          id: '4',
          name: ' Black ',
          status: 1,
          sort_order: '2',
          created_at: '2026-01-01T00:00:00.000Z',
          updated_at: null
        }], []]
      }
    },
    isDatabaseConnected: () => true
  })
  const response = createResponse()

  await controller.list({
    query: { page: '2', page_size: '50000', name: 'Black', status: '1', sort_by: 'name', sort_order: 'DESC' }
  }, response)

  assert.deepEqual(queries.map(query => query.values), [[1, '%Black%'], [1, '%Black%']])
  assert.match(queries[0].sql, /ORDER BY name DESC, sort_order ASC, id ASC/)
  assert.match(queries[0].sql, /LIMIT 10000 OFFSET 10000/)
  assert.deepEqual(response.body.data.colors[0], {
    id: 4,
    name: 'Black',
    status: 1,
    sort_order: 2,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: null
  })
  assert.equal(response.body.data.pagination.page_size, 10000)
  assert.equal(response.body.data.pagination.total, 12)
})

test('颜色创建验证空值与重名，并按默认值插入后清缓存', async () => {
  const ColorController = require('../src/controllers/color.controller')
  const queries = []
  let cacheClears = 0
  const controller = new ColorController({
    repository: {
      async executePrepared(sql, values) {
        queries.push({ sql, values })
        if (sql.startsWith('SELECT id FROM colors')) return [[], []]
        if (sql.startsWith('INSERT INTO colors')) return [{ insertId: 7 }, []]
        return [[{ id: 7, name: 'Violet', status: 1, sort_order: 0 }], []]
      }
    },
    isDatabaseConnected: () => true,
    invalidateCache: () => { cacheClears += 1 }
  })
  const missing = createResponse()
  await controller.create({ body: {} }, missing)
  assert.equal(missing.statusCode, 400)
  assert.equal(missing.body.message, '颜色名称不能为空')

  const created = createResponse()
  await controller.create({ body: { name: ' Violet ' } }, created)
  assert.equal(created.statusCode, 201)
  assert.deepEqual(queries[1].values, ['Violet', 1, 0])
  assert.equal(created.body.data.name, 'Violet')
  assert.equal(cacheClears, 1)
})

test('颜色更新、删除与状态切换保留校验、字段绑定和缓存失效', async () => {
  const ColorController = require('../src/controllers/color.controller')
  const queries = []
  let cacheClears = 0
  const repository = {
    async executePrepared(sql, values) {
      queries.push({ sql, values })
      if (sql === 'SELECT id FROM colors WHERE id = ?') return [[{ id: 5 }], []]
      if (sql.startsWith('SELECT id FROM colors WHERE name =')) return [[], []]
      if (sql.startsWith('SELECT id, name, status')) {
        if (sql.includes('WHERE id = ?')) {
          return [[{ id: 5, name: 'Blue', status: 1, sort_order: 2 }], []]
        }
      }
      if (sql.startsWith('UPDATE colors SET status')) return [{ affectedRows: 1 }, []]
      if (sql.startsWith('UPDATE colors SET name')) return [{ affectedRows: 1 }, []]
      if (sql.startsWith('DELETE FROM colors')) return [{ affectedRows: 1 }, []]
      return [[{ id: 5, name: 'Blue', status: 0, sort_order: 3 }], []]
    }
  }
  const controller = new ColorController({
    repository,
    isDatabaseConnected: () => true,
    invalidateCache: () => { cacheClears += 1 }
  })

  const updated = createResponse()
  await controller.update({ params: { id: '5' }, body: { name: 'Blue', sort_order: '3' } }, updated)
  assert.deepEqual(queries.find(query => query.sql.startsWith('UPDATE colors SET name')).values, ['Blue', 3, '5'])
  assert.equal(updated.body.message, '颜色更新成功')

  const toggled = createResponse()
  await controller.toggle({ params: { id: '5' } }, toggled)
  assert.equal(queries.find(query => query.sql.startsWith('UPDATE colors SET status')).values[0], 0)
  assert.equal(toggled.body.message, '颜色禁用成功')

  const deleted = createResponse()
  await controller.delete({ params: { id: '5' } }, deleted)
  assert.equal(deleted.body.message, '颜色删除成功')
  assert.equal(cacheClears, 3)
})

test('颜色统计与详情保留筛选条件和不存在响应', async () => {
  const ColorController = require('../src/controllers/color.controller')
  const queries = []
  const controller = new ColorController({
    repository: {
      async executePrepared(sql, values) {
        queries.push({ sql, values })
        if (sql.includes('related_phones')) return [[{ related_phones: '6' }], []]
        if (sql.includes('COUNT(*) AS total')) return [[{ total: '8', active: '5', inactive: '3' }], []]
        return [[], []]
      }
    },
    isDatabaseConnected: () => true
  })
  const stats = createResponse()
  await controller.stats({ query: { name: 'Blue', status: '1' } }, stats)
  assert.deepEqual(stats.body.data, { total: 8, active: 5, inactive: 3, related_phones: 6 })
  assert.deepEqual(queries[0].values, ['%Blue%', 1])

  const missing = createResponse()
  await controller.get({ params: { id: '999' } }, missing)
  assert.equal(missing.statusCode, 404)
  assert.equal(missing.body.message, '颜色不存在')
})

test('颜色批量排序事务成功时仅更新有效项并提交、失效缓存、释放连接', async () => {
  const ColorController = require('../src/controllers/color.controller')
  const events = []
  const connection = {
    async beginTransaction() { events.push('begin') },
    async execute(sql, values) { events.push(['execute', sql, values]) },
    async commit() { events.push('commit') },
    async rollback() { events.push('rollback') },
    release() { events.push('release') }
  }
  const controller = new ColorController({
    repository: { withConnection(operation) { return withConnection({ getConnection: async () => connection }, operation) } },
    isDatabaseConnected: () => true,
    invalidateCache: () => events.push('invalidate')
  })
  const response = createResponse()

  await controller.reorder({
    body: { items: [{ id: 2, sort_order: 1 }, { id: 3 }, { sort_order: 4 }] }
  }, response)

  assert.deepEqual(events, [
    'begin',
    ['execute', 'UPDATE colors SET sort_order = ? WHERE id = ?', [1, 2]],
    'commit',
    'release',
    'invalidate'
  ])
  assert.equal(response.body.success, true)
  assert.equal(response.body.message, '排序更新成功')
  assert.equal(typeof response.body.timestamp, 'string')
  assert.equal(Object.hasOwn(response.body, 'data'), false)
})

test('颜色批量排序失败时回滚并释放连接，未连接或空数据不获取连接', async () => {
  const ColorController = require('../src/controllers/color.controller')
  const events = []
  const connection = {
    async beginTransaction() { events.push('begin') },
    async execute() { throw new Error('write failed') },
    async commit() { events.push('commit') },
    async rollback() { events.push('rollback') },
    release() { events.push('release') }
  }
  const controller = new ColorController({
    repository: { withConnection(operation) { return withConnection({ getConnection: async () => { events.push('acquire'); return connection } }, operation) } },
    isDatabaseConnected: () => true,
    invalidateCache: () => events.push('invalidate')
  })
  const failureResponse = createResponse()

  await controller.reorder({ body: { items: [{ id: 2, sort_order: 1 }] } }, failureResponse)
  assert.equal(failureResponse.statusCode, 500)
  assert.equal(failureResponse.body.success, false)
  assert.equal(failureResponse.body.message, '服务器内部错误，请稍后重试')
  assert.equal(typeof failureResponse.body.timestamp, 'string')
  assert.deepEqual(events, ['acquire', 'begin', 'rollback', 'release'])

  const unavailable = new ColorController({
    repository: { async withConnection() { throw new Error('must not connect') } },
    isDatabaseConnected: () => false
  })
  const unavailableResponse = createResponse()
  await unavailable.reorder({ body: { items: [] } }, unavailableResponse)
  assert.equal(unavailableResponse.statusCode, 500)
  assert.equal(unavailableResponse.body.message, '服务器内部错误，请稍后重试')

  const invalidResponse = createResponse()
  await controller.reorder({ body: { items: [] } }, invalidResponse)
  assert.equal(invalidResponse.statusCode, 400)
  assert.equal(invalidResponse.body.message, '请提供有效的排序数据')
  assert.equal(typeof invalidResponse.body.timestamp, 'string')
})
