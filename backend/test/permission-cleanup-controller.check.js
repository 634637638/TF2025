'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const PermissionCleanupController = require('../src/controllers/permission-cleanup.controller')

const response = () => ({
  status(code) { this.statusCode = code; return this },
  json(body) { this.body = body; return this }
})

test('manual permission cleanup keeps the admin permission and delegates through controller', () => {
  const route = fs.readFileSync(path.join(__dirname, '../src/routes/permission-management.js'), 'utf8')
  assert.match(route, /router\.post\('\/cleanup-permissions', requirePermission\('permissions:admin'\), permissionCleanupController\.manualCleanup\.bind\(permissionCleanupController\)\)/)
})

test('manual permission cleanup handles all, one role and missing input', async () => {
  const calls = []
  const controller = new PermissionCleanupController({
    service: {
      async cleanupAllRolePermissions() { calls.push(['all']); return { cleaned: 4 } },
      async cleanupRolePermissions(roleId) { calls.push(['role', roleId]); return { cleaned: 2 } }
    }
  })
  const all = response()
  const role = response()
  const missing = response()

  await controller.manualCleanup({ body: { cleanupAll: true } }, all)
  await controller.manualCleanup({ body: { roleId: 7 } }, role)
  await controller.manualCleanup({ body: {} }, missing)

  assert.deepEqual(calls, [['all'], ['role', 7]])
  assert.deepEqual(all.body, { success: true, message: '权限清理完成', data: { cleaned: 4 } })
  assert.deepEqual(role.body, { success: true, message: '权限清理完成', data: { cleaned: 2 } })
  assert.equal(missing.statusCode, 400)
  assert.equal(missing.body.message, '请提供角色ID或设置cleanupAll为true')
})

test('manual permission cleanup preserves the 500 error contract', async () => {
  const errors = []
  const controller = new PermissionCleanupController({
    service: { async cleanupRolePermissions() { throw new Error('cleanup failed') } },
    logger: { error(...args) { errors.push(args) } }
  })
  const result = response()

  await controller.manualCleanup({ body: { roleId: 3 } }, result)

  assert.equal(result.statusCode, 500)
  assert.deepEqual(result.body, { success: false, message: '权限清理失败: cleanup failed' })
  assert.equal(errors.length, 1)
})
