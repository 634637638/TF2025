'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const Controller = require('../src/controllers/user-field-permissions.controller')
const Service = require('../src/services/user-field-permissions.service')
const Repository = require('../src/repositories/user-field-permissions.repository')

const routeSource = fs.readFileSync(path.join(__dirname, '../src/routes/permission-management.js'), 'utf8')
const response = () => ({
  statusCode: 200,
  status(code) { this.statusCode = code; return this },
  json(body) { this.body = body; return this }
})

test('user field permissions route inherits authentication and delegates to controller', () => {
  assert.match(routeSource, /router\.use\(unifiedAuth\)/)
  assert.match(routeSource, /router\.get\('\/user-field-permissions', userFieldPermissionsController\.getCurrent\.bind\(userFieldPermissionsController\)\)/)
})

test('user field permissions controller preserves identity validation, response and error shape', async () => {
  const calls = []
  const controller = new Controller({
    service: { async getForUser(...args) { calls.push(args); return { user_id: 8, roles: [], field_permissions: {} } } },
    logger: { debug() {}, error() {} }
  })
  const missing = response()
  await controller.getCurrent({ user: null, query: {} }, missing)
  assert.equal(missing.statusCode, 401)

  const success = response()
  await controller.getCurrent({ user: { userId: 8 }, query: { module_key: 'inventory' } }, success)
  assert.deepEqual(calls, [[8, 'inventory']])
  assert.deepEqual(success.body, {
    success: true,
    message: '获取用户字段权限成功',
    data: { user_id: 8, roles: [], field_permissions: {} }
  })

  controller.service.getForUser = async () => { throw new Error('database unavailable') }
  const failed = response()
  await controller.getCurrent({ user: { id: 9 }, query: {} }, failed)
  assert.equal(failed.statusCode, 500)
  assert.deepEqual(failed.body, {
    success: false,
    message: '获取用户字段权限失败: database unavailable',
    data: { user_id: 9, roles: [], field_permissions: {} }
  })
})

test('user field permissions service merges role fields and preserves the legacy schema branch', async () => {
  const calls = []
  const service = new Service({
    databaseProvider: () => ({}),
    columnExists: async (...args) => { calls.push(['column', ...args]); return false },
    repository: {
      async listUserRoles(...args) {
        calls.push(['roles', ...args])
        return [{ role_id: 2, role_name: '销售' }, { role_id: 3, role_name: '主管' }]
      },
      async listRoleFieldPermissions(...args) {
        calls.push(['fields', ...args])
        return [
          { role_id: 2, module_key: 'sales', field_config: '{"hidden_fields":["cost"],"editable_fields":["remark"]}' },
          { role_id: 3, module_key: 'sales', field_config: { hidden_fields: ['cost', 'phone'], editable_fields: ['remark', 'status'] } }
        ]
      }
    },
    logger: { debug() {}, warn() {} }
  })

  const result = await service.getForUser(7, 'sales')
  assert.deepEqual(result.roles, [{ role_id: 2, role_name: '销售' }, { role_id: 3, role_name: '主管' }])
  assert.deepEqual(result.field_permissions.sales, {
    module_key: 'sales',
    hidden_fields: ['cost', 'phone'],
    editable_fields: ['remark', 'status'],
    role_sources: [{ role_id: 2, role_name: '销售' }, { role_id: 3, role_name: '主管' }]
  })
  assert.equal(result.total_modules, 1)
  assert.deepEqual(calls[0], ['column', 'roles', 'is_active', {}])
  assert.deepEqual(calls[1], ['roles', {}, 7, false])
  assert.deepEqual(calls[2], ['fields', {}, [2, 3], 'sales'])
})

test('user field permissions service omits malformed stored JSON and retains the no-role response', async () => {
  const warnings = []
  const service = new Service({
    databaseProvider: () => ({}),
    columnExists: async () => true,
    repository: {
      async listUserRoles() { return [{ role_id: 4, role_name: '员工' }] },
      async listRoleFieldPermissions() {
        return [{ role_id: 4, module_key: 'inventory', field_config: '{bad json' }]
      }
    },
    logger: { debug() {}, warn(...args) { warnings.push(args) } }
  })
  assert.deepEqual(await service.getForUser(4), {
    user_id: 4,
    roles: [{ role_id: 4, role_name: '员工' }],
    field_permissions: {},
    total_modules: 0
  })
  assert.equal(warnings.length, 1)

  service.repository.listUserRoles = async () => []
  assert.deepEqual(await service.getForUser(5), { user_id: 5, roles: [], field_permissions: {} })
})

test('user field permissions repository binds identity, role IDs and optional module key', async () => {
  const calls = []
  const repository = new Repository()
  const database = { async execute(sql, params) { calls.push({ sql, params }); return [[{ role_id: 2, role_name: '销售' }]] } }
  await repository.listUserRoles(database, 8, true)
  assert.match(calls[0].sql, /ur\.user_id = \? AND r\.is_active = 1/)
  assert.deepEqual(calls[0].params, [8])
  await repository.listUserRoles(database, 8, false)
  assert.doesNotMatch(calls[1].sql, /r\.is_active/)
  await repository.listRoleFieldPermissions(database, [2, 3], 'sales')
  assert.deepEqual(calls[2].params, [2, 3, 'sales'])
  assert.match(calls[2].sql, /role_id IN \(\?,\?\).*AND module_key = \?/s)
  await repository.listRoleFieldPermissions(database, [2])
  assert.deepEqual(calls[3].params, [2])
  await repository.listRoleFieldPermissions(database, [])
  assert.equal(calls.length, 4)
})
