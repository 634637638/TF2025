const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = path.resolve(__dirname, '..')

test('权限诊断 repository 使用绑定参数并保留用户、角色及权限查询', async () => {
  const DebugPermissionsRepository = require('../src/repositories/debug-permissions.repository')
  const calls = []
  const responses = [
    [{ id: 7, username: 'tester', name: '测试员', status: 1 }],
    [{ role_id: 2, role_name: '运营', status: 'active' }],
    [{ module_key: 'users', permission_type: 'edit' }],
    [{ module_key: 'users', permission_type: 'edit' }]
  ]
  const database = {
    async execute(sql, params) {
      calls.push({ sql, params })
      return [responses.shift(), []]
    }
  }

  const result = await new DebugPermissionsRepository(database).getUserPermissionDetails(7)

  assert.equal(result.user.id, 7)
  assert.equal(result.roles.length, 1)
  assert.equal(result.allRolePermissions.length, 1)
  assert.equal(result.activePermissions.length, 1)
  assert.equal(calls.length, 4)
  assert.ok(calls.every(call => call.params.length === 1 && call.params[0] === 7))
})

test('角色权限查询在角色不存在时不继续查权限', async () => {
  const DebugPermissionsRepository = require('../src/repositories/debug-permissions.repository')
  const calls = []
  const database = {
    async execute(sql, params) {
      calls.push({ sql, params })
      return [[], []]
    }
  }

  const result = await new DebugPermissionsRepository(database).getRolePermissionDetails('9')

  assert.deepEqual(result, { role: null, permissions: [] })
  assert.equal(calls.length, 1)
  assert.deepEqual(calls[0].params, ['9'])
})

test('权限诊断 controller 保持用户权限汇总及角色不存在的 404 契约', async () => {
  const DebugPermissionsController = require('../src/controllers/debug-permissions.controller')
  const DebugPermissionsService = require('../src/services/debug-permissions.service')
  const service = new DebugPermissionsService({
    repository: {
      async getUserPermissionDetails() {
        return {
          user: { id: 7 },
          roles: [{ status: 'active' }, { status: 'disabled' }],
          allRolePermissions: [{ module_key: 'users' }, { module_key: 'sales' }],
          activePermissions: [
            { module_key: 'users:manage', permission_type: 'edit' },
            { module_key: 'users:view', permission_type: 'view' }
          ]
        }
      },
      async getRolePermissionDetails(roleId) {
        if (roleId === '9') return { role: null, permissions: [] }
        return {
          role: { id: 2, name: '运营' },
          permissions: [
            { module_key: 'users:manage', permission_type: 'edit' },
            { module_key: 'sales', permission_type: 'view' }
          ]
        }
      }
    }
  })
  const controller = new DebugPermissionsController({ service })
  const response = {
    status(code) {
      this.statusCode = code
      return this
    },
    json(body) {
      this.body = body
      return this
    }
  }

  await controller.getCurrentUser({ user: { id: 7 } }, response)
  assert.deepEqual(response.body.data.permissions_summary, {
    total_roles: 2,
    active_roles: 1,
    total_permissions: 2,
    active_permissions: 2,
    has_users_edit: true
  })
  assert.equal(response.body.data.users_edit_permissions.length, 1)

  await controller.getRolePermissions({ params: { roleId: '9' } }, response)
  assert.equal(response.statusCode, 404)
  assert.deepEqual(response.body, { success: false, message: '角色不存在' })

  await controller.getRolePermissions({ params: { roleId: '2' } }, response)
  assert.deepEqual(response.body.data.summary, {
    total_permissions: 2,
    users_permissions_count: 1
  })
  assert.equal(response.body.data.role.id, 2)
})

test('权限诊断两条 route 均保留认证、permissions:admin 授权并委托 controller', () => {
  const routeSource = fs.readFileSync(path.join(root, 'src/routes/debug-permissions.js'), 'utf8')

  assert.match(routeSource, /router\.get\('\/current-user',\s*unifiedAuth,\s*requirePermission\('permissions:admin'\),\s*debugPermissionsController\.getCurrentUser\.bind\(debugPermissionsController\)\)/)
  assert.match(routeSource, /router\.get\('\/role\/:roleId',\s*unifiedAuth,\s*requirePermission\('permissions:admin'\),\s*debugPermissionsController\.getRolePermissions\.bind\(debugPermissionsController\)\)/)
})
