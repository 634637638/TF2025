'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const Controller = require('../src/controllers/role-permission-visibility.controller')
const Service = require('../src/services/role-permission-visibility.service')
const Repository = require('../src/repositories/role-permission-visibility.repository')

const response = () => ({
  status(code) { this.statusCode = code; return this },
  json(body) { this.body = body; return this }
})

test('role permission visibility route keeps admin permission and delegates to controller', () => {
  const route = fs.readFileSync(path.join(__dirname, '../src/routes/permission-management.js'), 'utf8')
  assert.match(route, /router\.get\('\/visibility\/:role_id', requirePermission\('permissions:admin'\), rolePermissionVisibilityController\.getVisibility\.bind\(rolePermissionVisibilityController\)\)/)
  assert.match(route, /router\.put\('\/toggle-visibility', requirePermission\('permissions:admin'\), rolePermissionVisibilityController\.toggleVisibility\.bind\(rolePermissionVisibilityController\)\)/)
})

test('toggle visibility controller validates input and preserves supported and unsupported responses', async () => {
  const controller = new Controller({ service: { async toggleVisibility(input) {
    assert.deepEqual(input, { roleId: '5', moduleKey: 'sales', permissionType: 'menu_view', visible: true })
    return { supported: true }
  } }, logger: { error() {} } })

  const invalid = response()
  await controller.toggleVisibility({ body: { role_id: 5, visible: true } }, invalid)
  assert.equal(invalid.statusCode, 400)

  const success = response()
  await controller.toggleVisibility({ body: { role_id: '5', module_key: 'sales', permission_type: 'menu_view', visible: true } }, success)
  assert.deepEqual(success.body.data, { role_id: '5', module_key: 'sales', permission_type: 'menu_view', visible: true })

  const unsupportedController = new Controller({ service: { async toggleVisibility() { return { supported: false } } }, logger: { error() {} } })
  const unsupported = response()
  await unsupportedController.toggleVisibility({ body: { role_id: '5', module_key: 'sales', permission_type: 'menu_view', visible: false } }, unsupported)
  assert.equal(unsupported.statusCode, 400)
  assert.equal(unsupported.body.message, '当前数据库结构不支持权限可见性配置')
})

test('role permission visibility controller preserves schema fallback and response mapping', async () => {
  const controller = new Controller({ service: { async getVisibility(roleId) {
    assert.equal(roleId, '5')
    return null
  } }, logger: { error() {} } })
  const unsupported = response()
  await controller.getVisibility({ params: { role_id: '5' } }, unsupported)
  assert.deepEqual(unsupported.body, {
    success: true,
    message: '当前数据库结构不支持权限可见性配置',
    data: { roleId: '5', permissions: [] }
  })

  const supportedController = new Controller({ service: { async getVisibility() {
    return [
      { module_key: 'sales', permission_type: 'menu_view', menu_visible: 1 },
      { module_key: 'inventory', permission_type: 'view', menu_visible: 0 }
    ]
  } } })
  const supported = response()
  await supportedController.getVisibility({ params: { role_id: '6' } }, supported)
  assert.deepEqual(supported.body.data, {
    role_id: '6',
    permissions: [
      { module_key: 'sales', permission_type: 'menu_view', visible: true },
      { module_key: 'inventory', permission_type: 'view', visible: false }
    ]
  })
})

test('role permission visibility service checks schema support before reading', async () => {
  let reads = 0
  const unsupported = new Service({ repository: { async getVisibility() { reads += 1; return [] } }, supportsVisibility: async () => false })
  assert.equal(await unsupported.getVisibility('3'), null)
  assert.equal(reads, 0)

  const supported = new Service({ repository: { async getVisibility(roleId) {
    reads += 1
    assert.equal(roleId, '4')
    return [{ module_key: 'sales' }]
  } }, supportsVisibility: async () => true })
  assert.deepEqual(await supported.getVisibility('4'), [{ module_key: 'sales' }])
  assert.equal(reads, 1)
})

test('role permission visibility service keeps writes transactional and releases connection', async () => {
  const calls = []
  const connection = {
    async beginTransaction() { calls.push('begin') },
    async commit() { calls.push('commit') },
    async rollback() { calls.push('rollback') },
    release() { calls.push('release') }
  }
  const service = new Service({
    repository: {
      async findPermission() { calls.push('find'); return false },
      async insertPermission(_connection, options) { calls.push(['insert', options.supportsCreatedAt, options.visible]) },
      async updatePermissionVisibility() { calls.push('update') }
    },
    databaseProvider: async () => ({ async getConnection() { return connection } }),
    columnExists: async (_table, column) => column === 'menu_visible'
  })
  assert.deepEqual(await service.toggleVisibility({ roleId: '5', moduleKey: 'sales', permissionType: 'menu_view', visible: true }), { supported: true })
  assert.deepEqual(calls, ['begin', 'find', ['insert', false, true], 'commit', 'release'])

  calls.length = 0
  const failingService = new Service({
    repository: { async findPermission() { throw new Error('write failed') } },
    databaseProvider: async () => ({ async getConnection() { return connection } }),
    columnExists: async () => true
  })
  await assert.rejects(failingService.toggleVisibility({ roleId: 5, moduleKey: 'sales', permissionType: 'menu_view', visible: false }), /write failed/)
  assert.deepEqual(calls, ['begin', 'rollback', 'release'])
})

test('role permission visibility repository binds the role and keeps deterministic ordering', async () => {
  const calls = []
  const repository = new Repository({ database: () => ({ async execute(sql, params) {
    calls.push({ sql, params })
    return [[{ module_key: 'sales', permission_type: 'menu_view', menu_visible: 1 }]]
  } }) })
  assert.deepEqual(await repository.getVisibility('9'), [{ module_key: 'sales', permission_type: 'menu_view', menu_visible: 1 }])
  assert.deepEqual(calls[0].params, ['9'])
  assert.match(calls[0].sql, /menu_visible IS NOT NULL[\s\S]*ORDER BY module_key, permission_type/)
})

test('role permission visibility repository parameterizes existence, insert and update', async () => {
  const calls = []
  const repository = new Repository()
  const connection = { async execute(sql, params) {
    calls.push({ sql, params })
    return [[{ id: 1 }]]
  } }
  assert.equal(await repository.findPermission(connection, { roleId: 5, moduleKey: 'sales', permissionType: 'menu_view' }), true)
  await repository.insertPermission(connection, { roleId: 5, moduleKey: 'sales', permissionType: 'menu_view', visible: false, supportsCreatedAt: true })
  await repository.updatePermissionVisibility(connection, { roleId: 5, moduleKey: 'sales', permissionType: 'menu_view', visible: true })
  assert.deepEqual(calls.map(call => call.params), [
    [5, 'sales', 'menu_view'],
    [5, 'sales', 'menu_view', 0],
    [1, 5, 'sales', 'menu_view']
  ])
})
