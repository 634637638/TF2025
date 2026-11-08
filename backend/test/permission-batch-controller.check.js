'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const PermissionBatchController = require('../src/controllers/permission-batch.controller')
const PermissionBatchService = require('../src/services/permission-batch.service')
const PermissionBatchRepository = require('../src/repositories/permission-batch.repository')

const response = () => ({
  statusCode: 200,
  body: null,
  status(code) { this.statusCode = code; return this },
  json(body) { this.body = body; return this }
})

test('batch permission revoke route keeps admin authorization and delegates to controller', () => {
  const source = fs.readFileSync(path.join(__dirname, '../src/routes/permission-management.js'), 'utf8')
  assert.match(source, /router\.post\('\/assign-batch', requirePermission\('permissions:admin'\), permissionBatchController\.assign\.bind\(permissionBatchController\)\)/)
  assert.match(source, /router\.post\('\/revoke-batch', requirePermission\('permissions:admin'\), permissionBatchController\.revoke\.bind\(permissionBatchController\)\)/)
  assert.match(source, /router\.post\('\/copy', requirePermission\('permissions:admin'\), permissionBatchController\.copy\.bind\(permissionBatchController\)\)/)
})

test('copy permission controller validates roles and preserves empty, success and failure responses', async () => {
  const calls = []
  const controller = new PermissionBatchController({
    service: { async copy(...args) { calls.push(args); return { copiedCount: 2, sourceEmpty: false } } },
    logger: { error() {} }
  })
  const missing = response()
  await controller.copy({ body: { from_role_id: 1 } }, missing)
  assert.equal(missing.statusCode, 400)
  assert.equal(missing.body.message, '源角色ID和目标角色ID不能为空')

  const identical = response()
  await controller.copy({ body: { from_role_id: 1, to_role_id: 1 } }, identical)
  assert.equal(identical.statusCode, 400)
  assert.equal(identical.body.message, '源角色和目标角色不能相同')

  const success = response()
  await controller.copy({ body: { from_role_id: '1', to_role_id: '2' } }, success)
  assert.deepEqual(calls, [['1', '2']])
  assert.deepEqual(success.body, { success: true, message: '成功复制 2 个权限', copied_count: 2 })

  const emptyController = new PermissionBatchController({ service: { async copy() { return { copiedCount: 0, sourceEmpty: true } } } })
  const empty = response()
  await emptyController.copy({ body: { from_role_id: 1, to_role_id: 2 } }, empty)
  assert.deepEqual(empty.body, { success: true, message: '源角色没有任何权限，操作完成', copied_count: 0 })

  const failing = response()
  const failedController = new PermissionBatchController({ service: { async copy() { throw new Error('database unavailable') } }, logger: { error() {} } })
  await failedController.copy({ body: { from_role_id: 1, to_role_id: 2 } }, failing)
  assert.equal(failing.statusCode, 500)
  assert.equal(failing.body.message, '复制角色权限失败: database unavailable')
})

test('batch permission revoke controller preserves validation and response contract', async () => {
  const calls = []
  const controller = new PermissionBatchController({
    service: { async revoke(...args) { calls.push(args) } },
    logger: { error() {} }
  })
  const invalid = response()
  await controller.revoke({ body: { role_id: 2, permissions: [] } }, invalid)
  assert.equal(invalid.statusCode, 400)
  assert.deepEqual(invalid.body, { success: false, message: '角色ID和权限列表不能为空' })

  const success = response()
  const permissions = [{ module_key: 'inventory', permission_type: 'view' }]
  await controller.revoke({ body: { role_id: 2, permissions } }, success)
  assert.deepEqual(calls, [[2, permissions]])
  assert.deepEqual(success.body, { success: true, message: '成功回收 1 个权限' })

  const failed = response()
  const failingController = new PermissionBatchController({
    service: { async revoke() { throw new Error('database unavailable') } },
    logger: { error() {} }
  })
  await failingController.revoke({ body: { role_id: 2, permissions } }, failed)
  assert.equal(failed.statusCode, 500)
  assert.deepEqual(failed.body, { success: false, message: '批量回收权限失败: database unavailable' })
})

test('batch permission revoke service commits once and releases its connection', async () => {
  const calls = []
  const connection = {
    async beginTransaction() { calls.push(['begin']) },
    async commit() { calls.push(['commit']) },
    async rollback() { calls.push(['rollback']) },
    release() { calls.push(['release']) }
  }
  const permissions = [
    { module_key: 'inventory', permission_type: 'view' },
    { module_key: 'sales', permission_type: 'edit' }
  ]
  const service = new PermissionBatchService({
    repository: { async revokePermission(conn, roleId, permission) { calls.push(['revoke', conn === connection, roleId, permission]) } },
    databaseProvider: () => ({ async getConnection() { return connection } })
  })
  await service.revoke(9, permissions)
  assert.deepEqual(calls, [
    ['begin'],
    ['revoke', true, 9, permissions[0]],
    ['revoke', true, 9, permissions[1]],
    ['commit'],
    ['release']
  ])
})

test('batch permission revoke service rolls back failed writes and releases its connection', async () => {
  const calls = []
  const connection = {
    async beginTransaction() { calls.push('begin') },
    async commit() { calls.push('commit') },
    async rollback() { calls.push('rollback') },
    release() { calls.push('release') }
  }
  const service = new PermissionBatchService({
    repository: { async revokePermission() { throw new Error('write failed') } },
    databaseProvider: () => ({ async getConnection() { return connection } })
  })
  await assert.rejects(service.revoke(9, [{ module_key: 'inventory', permission_type: 'view' }]), /write failed/)
  assert.deepEqual(calls, ['begin', 'rollback', 'release'])
})

test('batch permission revoke service rolls back and releases when transaction start fails', async () => {
  const calls = []
  const connection = {
    async beginTransaction() { calls.push('begin'); throw new Error('begin failed') },
    async rollback() { calls.push('rollback') },
    release() { calls.push('release') }
  }
  const service = new PermissionBatchService({
    repository: { async revokePermission() { assert.fail('repository must not run') } },
    databaseProvider: () => ({ async getConnection() { return connection } })
  })
  await assert.rejects(service.revoke(9, [{ module_key: 'inventory', permission_type: 'view' }]), /begin failed/)
  assert.deepEqual(calls, ['begin', 'rollback', 'release'])
})

test('batch permission repository binds role, module, and permission values', async () => {
  let captured
  const repository = new PermissionBatchRepository()
  await repository.revokePermission({ async execute(sql, params) { captured = [sql, params] } }, 7, {
    module_key: 'phones',
    permission_type: 'edit'
  })
  assert.match(captured[0], /DELETE FROM role_permissions/)
  assert.match(captured[0], /WHERE role_id = \? AND module_key = \? AND permission_type = \?/)
  assert.deepEqual(captured[1], [7, 'phones', 'edit'])
})

test('batch permission assignment controller preserves validation, response and errors', async () => {
  const calls = []
  const controller = new PermissionBatchController({
    service: { async assign(...args) { calls.push(args) } },
    logger: { error() {} }
  })
  const invalid = response()
  await controller.assign({ body: { role_id: 2, permissions: [] } }, invalid)
  assert.equal(invalid.statusCode, 400)
  assert.deepEqual(invalid.body, { success: false, message: '角色ID和权限列表不能为空' })

  const success = response()
  const permissions = [{ module_key: 'inventory', permission_type: 'view' }]
  await controller.assign({ body: { role_id: 2, permissions } }, success)
  assert.deepEqual(calls, [[2, permissions]])
  assert.deepEqual(success.body, { success: true, message: '成功为角色分配 1 个权限' })

  const failed = response()
  const failingController = new PermissionBatchController({
    service: { async assign() { throw new Error('database unavailable') } },
    logger: { error() {} }
  })
  await failingController.assign({ body: { role_id: 2, permissions } }, failed)
  assert.equal(failed.statusCode, 500)
  assert.deepEqual(failed.body, { success: false, message: '批量分配权限失败: database unavailable' })
})

test('batch permission assignment service normalizes values and replaces permissions in one transaction', async () => {
  const calls = []
  const connection = {
    async beginTransaction() { calls.push('begin') },
    async commit() { calls.push('commit') },
    async rollback() { calls.push('rollback') },
    release() { calls.push('release') }
  }
  const service = new PermissionBatchService({
    repository: {
      async deleteRolePermissions(conn, roleId) { calls.push(['delete', conn === connection, roleId]) },
      async insertRolePermissions(conn, values, supportsCreatedAt) { calls.push(['insert', conn === connection, values, supportsCreatedAt]) }
    },
    columnExists: async (...args) => { calls.push(['column', ...args.slice(0, 2)]); return true },
    databaseProvider: () => ({ async getConnection() { calls.push('acquire'); return connection } })
  })

  await service.assign(9, [
    { module_key: 'inventory', permission_type: '查看' },
    { module_key: 'sales', permission_type: 'edit' }
  ])
  assert.equal(calls[0], 'acquire')
  assert.equal(calls[1], 'begin')
  assert.deepEqual(calls[2], ['column', 'role_permissions', 'created_at'])
  assert.deepEqual(calls[3], ['delete', true, 9])
  assert.deepEqual(calls[4], ['insert', true, [
    [9, 'inventory_inventoryview', 'view'],
    [9, 'sales', 'edit']
  ], true])
  assert.deepEqual(calls.slice(5), ['commit', 'release'])
})

test('batch permission assignment service rolls back and releases on failure', async () => {
  const calls = []
  const connection = {
    async beginTransaction() { calls.push('begin') },
    async commit() { calls.push('commit') },
    async rollback() { calls.push('rollback') },
    release() { calls.push('release') }
  }
  const service = new PermissionBatchService({
    repository: {
      async deleteRolePermissions() { calls.push('delete'); throw new Error('write failed') },
      async insertRolePermissions() { assert.fail('insert must not run') }
    },
    columnExists: async () => false,
    databaseProvider: () => ({ async getConnection() { return connection } })
  })

  await assert.rejects(service.assign(9, [{ module_key: 'sales', permission_type: 'edit' }]), /write failed/)
  assert.deepEqual(calls, ['begin', 'delete', 'rollback', 'release'])
})

test('copy permission service replaces target permissions transactionally and releases connection', async () => {
  const calls = []
  const connection = {
    async beginTransaction() { calls.push('begin') },
    async commit() { calls.push('commit') },
    async rollback() { calls.push('rollback') },
    release() { calls.push('release') }
  }
  const service = new PermissionBatchService({
    repository: {
      async listRolePermissions(conn, roleId) { calls.push(['list', conn === connection, roleId]); return [{ module_key: 'sales', permission_type: 'view' }] },
      async deleteRolePermissions(conn, roleId) { calls.push(['delete', conn === connection, roleId]) },
      async copyRolePermissions(conn, roleId, permissions, supportsCreatedAt) { calls.push(['copy', conn === connection, roleId, permissions, supportsCreatedAt]) }
    },
    columnExists: async (...args) => { calls.push(['column', ...args.slice(0, 2)]); return true },
    databaseProvider: () => ({ async getConnection() { return connection } })
  })
  assert.deepEqual(await service.copy('1', '2'), { copiedCount: 1, sourceEmpty: false })
  assert.deepEqual(calls, [
    'begin',
    ['list', true, '1'],
    ['delete', true, '2'],
    ['column', 'role_permissions', 'created_at'],
    ['copy', true, '2', [{ module_key: 'sales', permission_type: 'view' }], true],
    'commit',
    'release'
  ])
})

test('copy permission service rolls back on empty source and write failure', async () => {
  const calls = []
  const connection = {
    async beginTransaction() { calls.push('begin') },
    async commit() { calls.push('commit') },
    async rollback() { calls.push('rollback') },
    release() { calls.push('release') }
  }
  const emptyService = new PermissionBatchService({
    repository: { async listRolePermissions() { return [] } },
    databaseProvider: () => ({ async getConnection() { return connection } })
  })
  assert.deepEqual(await emptyService.copy(1, 2), { copiedCount: 0, sourceEmpty: true })
  assert.deepEqual(calls, ['begin', 'rollback', 'release'])

  calls.length = 0
  const failingService = new PermissionBatchService({
    repository: { async listRolePermissions() { return [{ module_key: 'sales', permission_type: 'view' }] }, async deleteRolePermissions() { throw new Error('write failed') } },
    databaseProvider: () => ({ async getConnection() { return connection } })
  })
  await assert.rejects(failingService.copy(1, 2), /write failed/)
  assert.deepEqual(calls, ['begin', 'rollback', 'release'])
})

test('batch permission repository binds deletion and bulk insert values for both schemas', async () => {
  const calls = []
  const repository = new PermissionBatchRepository()
  const connection = { async execute(statement, params) { calls.push([statement, params]) } }
  await repository.deleteRolePermissions(connection, 7)
  await repository.insertRolePermissions(connection, [[7, 'sales', 'edit'], [7, 'inventory', 'view']], false)
  await repository.insertRolePermissions(connection, [[7, 'sales', 'edit']], true)

  assert.deepEqual(calls[0][1], [7])
  assert.match(calls[0][0], /DELETE FROM role_permissions WHERE role_id = \?$/)
  assert.match(calls[1][0], /INSERT INTO role_permissions \(role_id, module_key, permission_type\)\s+VALUES \(\?, \?, \?\), \(\?, \?, \?\)/)
  assert.deepEqual(calls[1][1], [7, 'sales', 'edit', 7, 'inventory', 'view'])
  assert.match(calls[2][0], /permission_type, created_at\)\s+VALUES \(\?, \?, \?, NOW\(\)\)/)
  assert.deepEqual(calls[2][1], [7, 'sales', 'edit'])
})

test('batch permission repository binds role IDs for copy reads and inserts', async () => {
  const calls = []
  const repository = new PermissionBatchRepository()
  const connection = { async execute(sql, params) {
    calls.push({ sql, params })
    return [[{ module_key: 'sales', permission_type: 'view' }]]
  } }
  assert.deepEqual(await repository.listRolePermissions(connection, 3), [{ module_key: 'sales', permission_type: 'view' }])
  await repository.copyRolePermissions(connection, 4, [{ module_key: 'sales', permission_type: 'view' }], false)
  assert.deepEqual(calls.map(call => call.params), [[3], [4, 'sales', 'view']])
  assert.match(calls[1].sql, /INSERT INTO role_permissions/)
})
