'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const Controller = require('../src/controllers/permission-menu-update.controller')
const Service = require('../src/services/permission-menu-update.service')
const Repository = require('../src/repositories/permission-menu-update.repository')

const response = () => ({
  status(code) { this.statusCode = code; return this },
  json(body) { this.body = body; return this }
})

test('role menu update route preserves administrator authorization and delegates to controller', () => {
  const route = fs.readFileSync(path.join(__dirname, '../src/routes/permission-management.js'), 'utf8')
  assert.match(route, /router\.put\('\/menu\/:role_id', requirePermission\('permissions:admin'\), permissionMenuUpdateController\.update\.bind\(permissionMenuUpdateController\)\)/)
})

test('role menu update controller preserves invalid, success and error responses', async () => {
  const controller = new Controller({ service: { async update(roleId, permissions, req) {
    assert.deepEqual([roleId, permissions, req.user.id], ['7', [{ module_key: 'sales' }], 2])
    return { receivedCount: 1 }
  } }, logger: { error() {} } })
  const invalid = response()
  await controller.update({ params: { role_id: '7' }, body: { menu_permissions: null }, user: { id: 2 } }, invalid)
  assert.equal(invalid.statusCode, 400)
  assert.deepEqual(invalid.body, { success: false, message: '菜单权限格式错误' })

  const success = response()
  await controller.update({ params: { role_id: '7' }, body: { menu_permissions: [{ module_key: 'sales' }] }, user: { id: 2 } }, success)
  assert.deepEqual(success.body, {
    success: true,
    message: '更新菜单权限成功',
    data: { role_id: 7, received_count: 1 }
  })

  controller.service.update = async () => { throw new Error('role missing') }
  const failure = response()
  await controller.update({ params: { role_id: '7' }, body: { menu_permissions: [] }, user: { id: 2 } }, failure)
  assert.equal(failure.statusCode, 500)
  assert.deepEqual(failure.body, { success: false, message: '更新菜单权限失败: role missing' })
})

test('role menu update service normalizes permissions, uses schema branches, audits and commits before logging', async () => {
  const events = []
  const service = new Service({
    databaseProvider: async () => ({ id: 'db' }),
    columnExists: async (_table, column) => ['module_id', 'created_at'].includes(column),
    tableExists: async () => true,
    visibilityReader: async () => ({ sales: true }),
    auditService: { async build(_connection, previous, next, type) {
      events.push(['audit', previous, next, type])
      return { added_count: 1, removed_count: 1 }
    } },
    permissionLogs: { async logPermissionModification(_request, roleId, name) { events.push(['log', roleId, name]) } },
    repository: {
      async withConnection(database, operation) {
        assert.equal(database.id, 'db')
        const connection = { async query(sql) { events.push(sql) } }
        return operation(connection)
      },
      async findRole() { return { id: 7, name: '店员' } },
      async listModuleIds(_connection, active) { events.push(['modules', active]); return [{ id: 3, key: 'sales' }] },
      async replaceRoleMenuPermissions(_connection, roleId, permissions, ids, schema) {
        events.push(['permissions', roleId, permissions, ids.get('sales'), schema])
      },
      async replaceMenuVisibility(_connection, roleId, permissions, schema) {
        events.push(['visibility', roleId, permissions, schema])
      }
    }
  })

  const request = { user: { id: 2 } }
  const result = await service.update('7', [null, { module_key: 'sales', menu_visible: true }], request)
  assert.deepEqual(result, { receivedCount: 1 })
  assert.deepEqual(events[0], 'START TRANSACTION')
  assert.equal(events[1][0], 'modules')
  assert.equal(events[1][1], false)
  assert.equal(events[2][0], 'permissions')
  assert.deepEqual(events[2][2], [{ module_key: 'sales', menu_visible: 1 }])
  assert.equal(events[2][3], 3)
  assert.equal(events[4][0], 'audit')
  assert.equal(events[5], 'COMMIT')
  assert.deepEqual(events[6], ['log', '7', '店员'])
})

test('role menu update service rolls back when repository operations fail', async () => {
  const events = []
  const service = new Service({
    databaseProvider: async () => ({}),
    repository: {
      async withConnection(_database, operation) {
        return operation({ async query(sql) { events.push(sql) } })
      },
      async findRole() { throw new Error('database unavailable') }
    }
  })
  await assert.rejects(service.update('7', [], {}), /database unavailable/)
  assert.deepEqual(events, ['START TRANSACTION', 'ROLLBACK'])
})

test('role menu repository binds row identifiers and writes schema-specific permission columns', async () => {
  const calls = []
  const connection = {
    async execute(sql, params) {
      calls.push({ sql, params })
      return sql.startsWith('SELECT') ? [[{ id: 7, name: '店员' }]] : [{ affectedRows: 1 }]
    }
  }
  const repository = new Repository()
  assert.deepEqual(await repository.findRole(connection, '7'), { id: 7, name: '店员' })
  await repository.listModuleIds(connection, true)
  await repository.replaceRoleMenuPermissions(connection, 7, [{ module_key: 'sales', menu_visible: 1 }], new Map([['sales', 3]]), {
    rolePermissionModuleId: true,
    rolePermissionMenuVisible: true,
    rolePermissionCreatedAt: true
  })
  await repository.replaceMenuVisibility(connection, 7, [{ module_key: 'sales', menu_visible: 1 }], {
    visibilityCreatedAt: true,
    visibilityUpdatedAt: false
  })
  assert.deepEqual(calls[0].params, ['7'])
  assert.match(calls[1].sql, /WHERE is_active = 1/)
  assert.deepEqual(calls[3].params, [7, 'sales', 3, 'menu_view', 1])
  assert.match(calls[3].sql, /module_id, permission_type, menu_visible, created_at/)
  assert.deepEqual(calls[5].params, [7, 'sales', 1])
  assert.match(calls[5].sql, /visible, created_at/)
})
