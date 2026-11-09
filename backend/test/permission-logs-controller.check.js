const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

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

test('权限日志四个 API 均保留认证、管理员权限并委托 controller', () => {
  const route = fs.readFileSync(path.join(backendRoot, 'src/routes/permission-logs.js'), 'utf8')

  for (const [method, routePath, handler] of [
    ['get', '/logs', 'list'],
    ['get', '/stats', 'stats'],
    ['post', '/log', 'create'],
    ['delete', '/logs/:id', 'delete']
  ]) {
    assert.match(
      route,
      new RegExp(`router\\.${method}\\('${routePath.replaceAll('/', '\\/')}', unifiedAuth, requirePermission\\('permissions:admin'\\), permissionLogsController\\.${handler}\\.bind\\(permissionLogsController\\)\\)`)
    )
  }
})

test('权限日志列表保持筛选、分页边界及响应字段', async () => {
  const PermissionLogsController = require('../src/controllers/permission-logs.controller')
  let listOptions
  const controller = new PermissionLogsController({
    async listLogs(options) {
      listOptions = options
      return { logs: [{ id: 9 }], total: 25 }
    }
  })
  const response = createResponse()

  await controller.list({
    query: {
      page: '3',
      page_size: '500',
      action: 'edit',
      username: 'lin',
      start_date: '2026-01-01',
      end_date: '2026-01-31'
    }
  }, response)

  assert.deepEqual(listOptions, {
    action: 'edit',
    username: 'lin',
    startDate: '2026-01-01',
    endDate: '2026-01-31',
    pageSize: 100,
    offset: 200
  })
  assert.deepEqual(response.body, {
    success: true,
    data: {
      logs: [{ id: 9 }],
      pagination: {
        page: 3,
        page_size: 100,
        total: 25,
        total_pages: 1,
        has_next: false,
        has_prev: true
      }
    }
  })
})

test('全量清空路由保留统一认证并要求真实删除权限', () => {
  const route = fs.readFileSync(path.join(backendRoot, 'src/routes/permission-logs.js'), 'utf8')
  assert.match(route, /router\.delete\('\/logs', unifiedAuth, requirePermission\('permissions:delete'\), permissionLogsController\.clear\.bind\(permissionLogsController\)\)/)
})

test('清空权限日志拒绝未认证、只读和其他模块删除权限', async () => {
  const { requirePermission } = require('../src/middleware/unified-auth')
  for (const [user, status] of [
    [undefined, 401],
    [{ id: 1, permissions: ['permissions_permissionsview:view'] }, 403],
    [{ id: 1, permissions: ['inventory_inventoryview:delete'] }, 403]
  ]) {
    const response = createResponse()
    let reachedHandler = false
    await requirePermission('permissions:delete')({ user }, response, () => { reachedHandler = true })
    assert.equal(response.statusCode, status)
    assert.equal(reachedHandler, false)
  }
})

test('删除能力可清空全部权限日志，返回数量并在运维日志记录操作人', async () => {
  const { requirePermission } = require('../src/middleware/unified-auth')
  const PermissionLogsController = require('../src/controllers/permission-logs.controller')
  const PermissionLogsService = require('../src/services/permission-logs.service')
  const PermissionLogsRepository = require('../src/repositories/permission-logs.repository')
  for (const count of [12, 0]) {
    const queries = []
    const operations = []
    const repository = new PermissionLogsRepository(() => ({
      async query(sql, params) { queries.push([sql, params]); return [{ affectedRows: count }] }
    }))
    const service = new PermissionLogsService({ repository, logger: { info: (...args) => operations.push(args) } })
    const controller = new PermissionLogsController(service)
    // 筛选或请求体不能把“全部清空”偷偷变成局部删除。
    const request = { user: { id: 7, permissions: ['permissions_permissionsview:delete'] }, query: { username: 'x' }, body: { id: 4 } }
    const response = createResponse()
    let authorized = false
    await requirePermission('permissions:delete')(request, response, () => { authorized = true })
    assert.equal(authorized, true)
    await controller.clear(request, response)
    assert.deepEqual(queries, [['DELETE FROM permission_operation_logs', undefined]])
    assert.deepEqual(response.body, { success: true, message: '权限日志已清空', data: { deleted_count: count } })
    assert.deepEqual(operations, [['权限操作日志已清空', { actor_id: 7, deleted_count: count }]])
  }
})

test('清空失败不返回成功、不记录成功审计、不暴露 SQL 详情', async (t) => {
  const PermissionLogsController = require('../src/controllers/permission-logs.controller')
  const PermissionLogsService = require('../src/services/permission-logs.service')
  const log = require('../src/utils/log')
  t.mock.method(log, 'error', () => {})
  let audited = false
  const controller = new PermissionLogsController(new PermissionLogsService({
    repository: { async clearLogs() { throw new Error('private database details') } },
    logger: { info() { audited = true } }
  }))
  const response = createResponse()
  await controller.clear({ user: { id: 7 } }, response)
  assert.equal(response.statusCode, 500)
  assert.deepEqual(response.body, { success: false, message: '清空权限日志失败，请稍后重试' })
  assert.equal(audited, false)
})

test('清空权限日志先校验公共 actor，身份无效时不执行删除', async () => {
  const PermissionLogsController = require('../src/controllers/permission-logs.controller')
  const PermissionLogsService = require('../src/services/permission-logs.service')
  let deleted = false
  const service = new PermissionLogsService({ repository: { async clearLogs() { deleted = true } } })
  const controller = new PermissionLogsController(service)
  const response = createResponse()
  await controller.clear({ user: { id: 0 } }, response)
  assert.equal(response.statusCode, 401)
  assert.equal(response.body.code, 'INVALID_ACTOR')
  assert.equal(deleted, false)
})

test('权限日志 service 记录操作者、请求 IP 和结构化详情', async () => {
  const PermissionLogsService = require('../src/services/permission-logs.service')
  const inserted = []
  const service = new PermissionLogsService({
    repository: {
      async insertOperation(entry) { inserted.push(entry) }
    },
    logger: { error() {} }
  })

  await service.logPermissionOperation(
    { user: { id: 7, username: 'admin' }, ip: '192.0.2.1', connection: {} },
    'edit',
    'role',
    3,
    'manager',
    '修改角色: manager',
    { before: ['view'], after: ['view', 'edit'] }
  )

  assert.deepEqual(inserted, [{
    userId: 7,
    username: 'admin',
    action: 'edit',
    targetType: 'role',
    targetId: 3,
    targetName: 'manager',
    description: '修改角色: manager',
    details: '{"before":["view"],"after":["view","edit"]}',
    ipAddress: '192.0.2.1',
    status: 'success'
  }])
})

test('权限日志辅助方法保留角色差异和权限摘要结构', async () => {
  const PermissionLogsService = require('../src/services/permission-logs.service')
  const entries = []
  const service = new PermissionLogsService({
    repository: {
      async getRolesByIds(ids) {
        assert.deepEqual(ids, [2, 4])
        return [{ id: 2, name: '店长' }, { id: 4, name: '财务' }]
      },
      async insertOperation(entry) { entries.push(entry) }
    },
    logger: { error() {} }
  })
  const request = { user: { id: 1, username: 'admin' }, ip: '192.0.2.2', connection: {} }

  await service.logUserRoleOperation(request, 8, 'employee', [2, 4], {
    previous_role_ids: [2, 3],
    previous_role_names: ['店长', '采购']
  })
  await service.logPermissionModification(request, 2, '店长', [
    { module_key: 'sales_salesview', permission_type: 'view' }
  ], {
    audit_type: 'role_menu_permissions',
    added_count: 1,
    removed_count: 1,
    affected_modules_count: 1
  })

  assert.equal(entries.length, 2)
  assert.equal(entries[0].action, 'assign')
  assert.equal(entries[0].targetType, 'user')
  assert.match(entries[0].description, /新增 1 个，移除 1 个/)
  assert.deepEqual(JSON.parse(entries[0].details).added_roles, [{ id: 4, name: '财务' }])
  assert.deepEqual(JSON.parse(entries[0].details).removed_roles, [{ id: 3, name: '采购' }])
  assert.match(entries[1].description, /菜单显示权限：显示 1 项，隐藏 1 项/)
  assert.deepEqual(JSON.parse(entries[1].details).permissions, [{
    module_key: 'sales_salesview',
    permission_type: 'view'
  }])
})

test('权限日志 repository 参数化筛选、分页和删除标识', async () => {
  const PermissionLogsRepository = require('../src/repositories/permission-logs.repository')
  const calls = []
  const repository = new PermissionLogsRepository(() => ({
    async query(sql, values) {
      calls.push({ sql, values })
      if (sql.startsWith('SELECT COUNT(*)')) return [[{ total: 1 }], []]
      if (sql.startsWith('SELECT id, user_id')) return [[{ id: 5 }], []]
      return [[], []]
    }
  }))

  const result = await repository.listLogs({
    whereClause: 'WHERE action = ? AND username LIKE ?',
    params: ['edit', '%admin%'],
    pageSize: 10,
    offset: 20
  })
  await repository.deleteLog('5')

  assert.deepEqual(result, { logs: [{ id: 5 }], total: 1 })
  assert.deepEqual(calls.map(call => call.values), [
    ['edit', '%admin%'],
    ['edit', '%admin%', 10, 20],
    ['5']
  ])
  assert.match(calls[1].sql, /LIMIT \? OFFSET \?/)
  assert.equal(calls[1].sql.includes('admin'), false)
})

test('权限日志辅助导出保留原名称并继续被业务路由引用', () => {
  const route = fs.readFileSync(path.join(backendRoot, 'src/routes/permission-logs.js'), 'utf8')
  const management = fs.readFileSync(path.join(backendRoot, 'src/routes/permission-management.js'), 'utf8')
  const menuUpdateService = fs.readFileSync(path.join(backendRoot, 'src/services/permission-menu-update.service.js'), 'utf8')
  const modules = fs.readFileSync(path.join(backendRoot, 'src/routes/module-management.js'), 'utf8')
  const userStores = fs.readFileSync(path.join(backendRoot, 'src/services/user-store.service.js'), 'utf8')

  for (const helper of [
    'logPermissionOperation',
    'logRoleOperation',
    'logUserRoleOperation',
    'logPermissionModification'
  ]) assert.match(route, new RegExp(`${helper}: \\(\\.\\.\\.args\\)`))
  assert.match(menuUpdateService, /permissionLogs\.logPermissionModification/)
  assert.doesNotMatch(management, /logPermissionModification/)
  assert.match(modules, /logPermissionOperation/)
  assert.match(userStores, /PermissionLogsService/)
  assert.doesNotMatch(userStores, /\.\.\/routes\/permission-logs/)
})
