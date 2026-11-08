'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const Controller = require('../src/controllers/role-permissions.controller')
const Service = require('../src/services/role-permissions.service')
const Repository = require('../src/repositories/role-permissions.repository')

const routeSource = fs.readFileSync(path.join(__dirname, '../src/routes/permission-management.js'), 'utf8')
const response = () => ({
  statusCode: 200,
  status(code) { this.statusCode = code; return this },
  json(body) { this.body = body; return this }
})

test('role permissions route keeps admin authorization and delegates to controller', () => {
  assert.match(routeSource, /router\.get\('\/roles\/:id\/permissions', requirePermission\('permissions:admin'\), rolePermissionsController\.getByRole\.bind\(rolePermissionsController\)\)/)
  assert.match(routeSource, /router\.put\('\/roles\/:id\/permissions', requirePermission\('permissions:admin'\), rolePermissionsController\.updateActionPermissions\.bind\(rolePermissionsController\)\)/)
  assert.match(routeSource, /router\.put\('\/roles\/:id\/permissions\/select-all', requirePermission\('permissions:admin'\), rolePermissionsController\.selectAllActionPermissions\.bind\(rolePermissionsController\)\)/)
  assert.match(routeSource, /router\.put\('\/roles\/:id\/permissions\/clear-all', requirePermission\('permissions:admin'\), rolePermissionsController\.clearAllActionPermissions\.bind\(rolePermissionsController\)\)/)
})

test('role permissions controller preserves not-found, success and error responses', async () => {
  const controller = new Controller({
    service: { async getByRole(id) {
      if (id === 'missing') return null
      if (id === 'failure') throw new Error('query failed')
      return { modules: [{ module_key: 'inventory' }], message: '获取角色权限成功', meta: { total_modules: 1 } }
    } },
    logger: { error() {} }
  })

  const missing = response()
  await controller.getByRole({ params: { id: 'missing' } }, missing)
  assert.deepEqual(missing.body, { success: false, message: '角色不存在' })
  assert.equal(missing.statusCode, 404)

  const success = response()
  await controller.getByRole({ params: { id: '4' } }, success)
  assert.deepEqual(success.body, {
    success: true,
    message: '获取角色权限成功',
    data: [{ module_key: 'inventory' }],
    meta: { total_modules: 1 }
  })

  const failure = response()
  await controller.getByRole({ params: { id: 'failure' } }, failure)
  assert.equal(failure.statusCode, 500)
  assert.deepEqual(failure.body, { success: false, message: '获取角色权限失败: query failed' })
})

test('role permissions service marks assigned actions and preserves database source metadata', async () => {
  const calls = []
  const service = new Service({
    databaseProvider: () => ({}),
    columnExists: async (...args) => { calls.push(['column', ...args]); return true },
    repository: {
      async findRole(...args) { calls.push(['role', ...args]); return { id: 4, name: '主管' } },
      async listModules(...args) {
        calls.push(['modules', ...args])
        return [{ module_key: 'inventory', module_name: '库存', module_description: '管理库存', module_category: 'business' }]
      },
      async listRolePermissions(...args) {
        calls.push(['permissions', ...args])
        return [{ module_key: 'inventory', permission_type: 'view' }]
      }
    },
    mergeModules: rows => rows,
    permissionTypesForModule: () => ['view', 'edit'],
    normalizeModuleKey: value => value,
    normalizeType: value => value,
    logger: { debug() {}, warn() {} }
  })

  const result = await service.getByRole('4')
  assert.deepEqual(result.modules, [{
    module_key: 'inventory',
    name: '库存',
    description: '管理库存',
    category: 'business',
    permissions: [
      { type: 'view', permission_type: 'view', assigned: true },
      { type: 'edit', permission_type: 'edit', assigned: false }
    ]
  }])
  assert.equal(result.meta.from_database, true)
  assert.equal(result.meta.db_module_count, 1)
  assert.match(result.message, /1 个数据库中的模块/)
  assert.deepEqual(calls.map(([kind]) => kind), ['column', 'role', 'modules', 'permissions'])
})

test('role permissions service scans modules when the database has none and uses fallback on scan failure', async () => {
  const warnings = []
  const createService = moduleScannerFactory => new Service({
    databaseProvider: () => ({}),
    columnExists: async () => false,
    repository: {
      async findRole() { return { id: 4, name: '主管' } },
      async listModules() { return [] },
      async listRolePermissions() { return [] }
    },
    moduleScannerFactory,
    mergeModules: rows => rows.map(row => ({ ...row, module_key: row.module_key || row.key })),
    permissionTypesForModule: () => ['view'],
    normalizeModuleKey: value => value,
    normalizeType: value => value,
    logger: { debug() {}, warn(...args) { warnings.push(args) } }
  })

  const scanned = await createService(() => ({ async scanViewsDirectory() {
    return [{ key: 'custom', name: '自定义模块' }]
  } })).getByRole('4')
  assert.equal(scanned.modules[0].module_key, 'custom')
  assert.equal(scanned.meta.from_database, false)
  assert.match(scanned.message, /建议先在模块管理中同步模块/)

  const fallback = await createService(() => ({ async scanViewsDirectory() { throw new Error('scan unavailable') } })).getByRole('4')
  assert.ok(fallback.modules.some(module => module.module_key === 'dashboard'))
  assert.ok(fallback.modules.some(module => module.module_key === 'sales'))
  assert.equal(warnings.length, 1)
})

test('role permissions repository binds role IDs and preserves the legacy active-module branch', async () => {
  const calls = []
  const repository = new Repository()
  const database = { async execute(sql, params) {
    calls.push({ sql, params })
    return [[{ id: 4, name: '主管' }]]
  } }

  await repository.findRole(database, '4')
  await repository.listModules(database, true)
  assert.match(calls[1].sql, /WHERE m\.is_active = 1/)
  assert.match(calls[1].sql, /ORDER BY m\.category, m\.`key`/)
  await repository.listModules(database, false)
  assert.doesNotMatch(calls[2].sql, /WHERE m\.is_active = 1/)
  await repository.listRolePermissions(database, '4')
  assert.deepEqual(calls[3].params, ['4'])
})

test('role permission update controller preserves missing-role, success and failure responses', async () => {
  const calls = []
  const controller = new Controller({
    service: { async updateActionPermissions(...args) {
      calls.push(args)
      if (args[0] === 'missing') return null
      if (args[0] === 'failure') throw new Error('write failed')
      return { role: { id: 5 } }
    } },
    logger: { error() {} }
  })
  const success = response()
  const req = { params: { id: '5' }, body: { permissions: [{ module_key: 'sales', permission_type: 'edit' }] } }
  await controller.updateActionPermissions(req, success)
  assert.deepEqual(calls[0], ['5', req.body.permissions, req])
  assert.deepEqual(success.body, { success: true, message: '角色权限更新成功' })

  const missing = response()
  await controller.updateActionPermissions({ ...req, params: { id: 'missing' } }, missing)
  assert.equal(missing.statusCode, 404)
  assert.deepEqual(missing.body, { success: false, message: '角色不存在' })

  const failure = response()
  await controller.updateActionPermissions({ ...req, params: { id: 'failure' } }, failure)
  assert.equal(failure.statusCode, 500)
  assert.deepEqual(failure.body, { success: false, message: '更新角色权限失败: write failed' })
})

test('role permissions service replaces normalized action permissions, audits changes and clears role user caches', async () => {
  const calls = []
  const service = new Service({
    databaseProvider: () => ({}),
    repository: {
      async findRole(_database, roleId) { calls.push(['role', roleId]); return { id: roleId, name: '主管' } },
      async listActionPermissions(_database, roleId) {
        calls.push(['previous', roleId])
        return [{ module_key: 'sales', permission_type: 'view' }]
      },
      async deleteActionPermissions(_database, roleId) { calls.push(['delete', roleId]) },
      async replaceActionPermissions(_database, roleId, permissions) { calls.push(['replace', roleId, permissions]) },
      async listUsersWithRole(_database, roleId) {
        calls.push(['users', roleId])
        return [{ user_id: 8 }, { user_id: 9 }]
      }
    },
    auditService: {
      normalizePermissions(rows) {
        calls.push(['normalize', rows])
        return [
          { module_key: 'inventory', permission_type: 'edit' },
          { module_key: 'sales', permission_type: 'view' }
        ]
      },
      async build(_database, previous, next) {
        calls.push(['audit', previous, next])
        return { added_count: 1, removed_count: 0 }
      }
    },
    permissionCacheService: { async deleteUserPermissions(userId) { calls.push(['cache', userId]) } },
    permissionLogs: { async logPermissionModification(...args) { calls.push(['log', ...args]) } },
    logger: { debug() {}, warn() {} }
  })
  const request = { user: { id: 7 } }
  const input = [
    { module_key: 'inventory', permission_type: 'edit' },
    { module_key: 'inventory', permission_type: 'edit' },
    { module_key: '', permission_type: 'invalid' }
  ]

  const result = await service.updateActionPermissions('5', input, request)

  assert.equal(result.role.name, '主管')
  assert.deepEqual(calls.map(([name]) => name), [
    'role', 'previous', 'normalize', 'delete', 'replace', 'audit', 'log', 'users', 'cache', 'cache'
  ])
  assert.deepEqual(calls[2], ['normalize', input])
  assert.deepEqual(calls[4], ['replace', '5', [
    { module_key: 'inventory', permission_type: 'edit' },
    { module_key: 'sales', permission_type: 'view' }
  ]])
  assert.equal(calls[5][2].length, 2)
  assert.deepEqual(calls[6].slice(0, 4), ['log', request, '5', '主管'])
  assert.deepEqual(calls.slice(-2), [['cache', 8], ['cache', 9]])
})

test('role permissions service skips audit logging when normalized permissions are unchanged', async () => {
  let logged = false
  const service = new Service({
    databaseProvider: () => ({}),
    repository: {
      async findRole() { return { id: 5, name: '主管' } },
      async listActionPermissions() { return [{ module_key: 'sales', permission_type: 'view' }] },
      async deleteActionPermissions() {},
      async replaceActionPermissions() {},
      async listUsersWithRole() { return [] }
    },
    auditService: {
      normalizePermissions: () => [{ module_key: 'sales', permission_type: 'view' }],
      async build() { return { added_count: 0, removed_count: 0 } }
    },
    permissionCacheService: { async deleteUserPermissions() {} },
    permissionLogs: { async logPermissionModification() { logged = true } },
    logger: { debug() {}, warn() {} }
  })

  await service.updateActionPermissions('5', [], {})

  assert.equal(logged, false)
})

test('select-all service uses active database modules, includes ensured modules and audits/cache-invalidates changes', async () => {
  const calls = []
  const service = new Service({
    databaseProvider: () => ({}),
    columnExists: async (...args) => { calls.push(['column', ...args]); return true },
    repository: {
      async findRole(_database, roleId) { calls.push(['role', roleId]); return { id: roleId, name: '主管' } },
      async listActionPermissions(_database, roleId) { calls.push(['previous', roleId]); return [] },
      async listPermissionModuleKeys(_database, supportsActive) {
        calls.push(['modules', supportsActive])
        return ['sales', 'inventory']
      },
      async deleteActionPermissions(_database, roleId) { calls.push(['delete', roleId]) },
      async replaceActionPermissions(_database, roleId, permissions) { calls.push(['replace', roleId, permissions]) },
      async listUsersWithRole(_database, roleId) { calls.push(['users', roleId]); return [{ user_id: 8 }] }
    },
    auditService: {
      async build(_database, previous, next) {
        calls.push(['audit', previous, next])
        return { added_count: next.length, removed_count: 0 }
      }
    },
    permissionTypesForModule: key => key === 'sales' ? ['view', 'edit'] : ['view'],
    normalizeModuleKey: key => key,
    normalizeType: value => value,
    permissionCacheService: { async deleteUserPermissions(userId) { calls.push(['cache', userId]) } },
    permissionLogs: { async logPermissionModification(...args) { calls.push(['log', ...args]) } },
    logger: { debug() {}, warn() {} }
  })
  const request = { user: { id: 7 } }

  const result = await service.selectAllActionPermissions('5', request)

  assert.equal(result.role.name, '主管')
  assert.ok(result.modulesCount >= 2)
  assert.ok(result.permissionsCount >= 3)
  assert.deepEqual(calls.slice(0, 6).map(([name]) => name), ['column', 'role', 'previous', 'modules', 'delete', 'replace'])
  assert.deepEqual(calls[5].slice(0, 2), ['replace', '5'])
  assert.deepEqual(calls[5][2].slice(0, 3), [
    { module_key: 'sales', permission_type: 'view' },
    { module_key: 'sales', permission_type: 'edit' },
    { module_key: 'inventory', permission_type: 'view' }
  ])
  assert.ok(calls.some(call => call[0] === 'log' && call[5].batch_action === 'select_all'))
  assert.deepEqual(calls.at(-1), ['cache', 8])
})

test('select-all service uses scanner fallback and preserves its established failure message', async () => {
  const createService = ({ scanner, databaseModules = [] }) => new Service({
    databaseProvider: () => ({}),
    columnExists: async () => false,
    repository: {
      async findRole() { return { id: 5, name: '主管' } },
      async listActionPermissions() { return [] },
      async listPermissionModuleKeys() { return databaseModules },
      async deleteActionPermissions() {},
      async replaceActionPermissions() {},
      async listUsersWithRole() { return [] }
    },
    moduleScannerFactory: () => scanner,
    permissionTypesForModule: () => ['view'],
    normalizeModuleKey: value => value,
    normalizeType: value => value,
    auditService: { async build(_database, _previous, next) { return { added_count: next.length, removed_count: 0 } } },
    permissionCacheService: { async deleteUserPermissions() {} },
    permissionLogs: { async logPermissionModification() {} },
    logger: { debug() {}, warn() {} }
  })

  const calls = []
  const scanned = await createService({ scanner: { async scanViewsDirectory() { return [{ key: 'custom' }] } } })
    .selectAllActionPermissions('5', {})
  assert.ok(scanned.modulesCount > 1)

  const failing = createService({ scanner: { async scanViewsDirectory() { throw new Error('scan unavailable') } } })
  await assert.rejects(failing.selectAllActionPermissions('5', {}), error => {
    calls.push(error)
    return error.code === 'PERMISSION_MODULE_SCAN_FAILED'
      && error.message === '无法获取模块列表，请先在模块管理中同步模块到数据库'
  })
  assert.equal(calls.length, 1)
})

test('select-all controller preserves not-found, scan failure, success and generic error responses', async () => {
  const controller = new Controller({
    service: { async selectAllActionPermissions(id) {
      if (id === 'missing') return null
      if (id === 'scan') throw Object.assign(new Error('无法获取模块列表，请先在模块管理中同步模块到数据库'), { code: 'PERMISSION_MODULE_SCAN_FAILED' })
      if (id === 'failure') throw new Error('query failed')
      return { modulesCount: 4, permissionsCount: 12 }
    } },
    logger: { error() {} }
  })
  const missing = response()
  await controller.selectAllActionPermissions({ params: { id: 'missing' } }, missing)
  assert.equal(missing.statusCode, 404)

  const scanFailure = response()
  await controller.selectAllActionPermissions({ params: { id: 'scan' } }, scanFailure)
  assert.equal(scanFailure.statusCode, 500)
  assert.deepEqual(scanFailure.body, { success: false, message: '无法获取模块列表，请先在模块管理中同步模块到数据库' })

  const success = response()
  await controller.selectAllActionPermissions({ params: { id: '5' } }, success)
  assert.deepEqual(success.body, {
    success: true,
    message: '已为角色分配所有 12 个权限',
    data: { modulesCount: 4, permissionsCount: 12 }
  })

  const failure = response()
  await controller.selectAllActionPermissions({ params: { id: 'failure' } }, failure)
  assert.deepEqual(failure.body, { success: false, message: '分配所有权限失败: query failed' })
})

test('clear-all controller preserves not-found, success and error responses', async () => {
  const calls = []
  const controller = new Controller({
    service: { async clearAllActionPermissions(...args) {
      calls.push(args)
      if (args[0] === 'missing') return null
      if (args[0] === 'failure') throw new Error('delete failed')
      return { deletedCount: 2 }
    } },
    logger: { error() {} }
  })
  const req = { params: { id: '5' }, user: { id: 7 }, ip: '127.0.0.1' }

  const missing = response()
  await controller.clearAllActionPermissions({ ...req, params: { id: 'missing' } }, missing)
  assert.equal(missing.statusCode, 404)
  assert.deepEqual(missing.body, { success: false, message: '角色不存在' })

  const success = response()
  await controller.clearAllActionPermissions(req, success)
  assert.deepEqual(calls[1], ['5', req])
  assert.deepEqual(success.body, {
    success: true,
    message: '已清除角色的所有功能权限（保留菜单权限）',
    deletedCount: 2
  })

  const failed = response()
  await controller.clearAllActionPermissions({ ...req, params: { id: 'failure' } }, failed)
  assert.equal(failed.statusCode, 500)
  assert.deepEqual(failed.body, { success: false, message: '清除权限失败: delete failed' })
})

test('clear-all service preserves menu permissions, audits changes and invalidates every role user cache', async () => {
  const calls = []
  const service = new Service({
    databaseProvider: () => ({}),
    repository: {
      async findRole(_database, roleId) { calls.push(['role', roleId]); return { id: roleId, name: '主管' } },
      async listActionPermissions(_database, roleId) { calls.push(['previous', roleId]); return [{ module_key: 'sales', permission_type: 'edit' }] },
      async deleteActionPermissions(_database, roleId) { calls.push(['delete', roleId]); return 1 },
      async listUsersWithRole(_database, roleId) { calls.push(['users', roleId]); return [{ user_id: 8 }, { user_id: 9 }] }
    },
    auditService: { async build(_database, previous, next) {
      calls.push(['audit', previous, next])
      return { removed_count: previous.length }
    } },
    permissionCacheService: { async deleteUserPermissions(userId) { calls.push(['cache', userId]) } },
    permissionLogs: { async logPermissionModification(...args) { calls.push(['log', ...args]) } },
    logger: { debug() {}, warn() {} }
  })
  const request = { user: { id: 7 } }

  const result = await service.clearAllActionPermissions('5', request)

  assert.equal(result.deletedCount, 1)
  assert.equal(result.role.name, '主管')
  assert.deepEqual(calls.map(([name]) => name), ['role', 'previous', 'delete', 'audit', 'log', 'users', 'cache', 'cache'])
  assert.deepEqual(calls[2], ['delete', '5'])
  assert.deepEqual(calls[3][2], [])
  assert.equal(calls[4][5].batch_action, 'clear_all')
  assert.deepEqual(calls.slice(-2), [['cache', 8], ['cache', 9]])
})

test('clear-all service does not write an audit event when no action permission changed', async () => {
  let logged = false
  const service = new Service({
    databaseProvider: () => ({}),
    repository: {
      async findRole() { return { id: 5, name: '主管' } },
      async listActionPermissions() { return [] },
      async deleteActionPermissions() { return 0 },
      async listUsersWithRole() { return [] }
    },
    auditService: { async build() { return { removed_count: 0 } } },
    permissionCacheService: { async deleteUserPermissions() {} },
    permissionLogs: { async logPermissionModification() { logged = true } },
    logger: { debug() {}, warn() {} }
  })

  await service.clearAllActionPermissions('5', {})
  assert.equal(logged, false)
})

test('permission change audit service normalizes rows and uses repository module names with metadata fallback', async () => {
  const AuditService = require('../src/services/permission-change-audit.service')
  const audit = new AuditService({ repository: {
    async getModuleNames(_database, keys) {
      assert.deepEqual(keys, ['memories', 'sales'])
      return [{ key: 'sales', name: '销售' }]
    }
  } })

  const details = await audit.build({}, [
    { module_key: 'sales', permission_type: 'edit' },
    { module_key: 'memories', permission_type: 'view' },
    { module_key: 'sales', permission_type: 'edit' },
    { module_key: '', permission_type: 'edit' }
  ], [], 'role_action_permissions')

  assert.equal(details.removed_count, 2)
  assert.equal(details.removed_permissions.find(item => item.module_key === 'sales').module_name, '销售')
  assert.ok(details.module_changes.some(change => change.removed_permissions.includes('edit')))
})
