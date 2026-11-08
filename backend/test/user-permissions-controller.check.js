'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const UserPermissionsController = require('../src/controllers/user-permissions.controller')

const response = () => ({
  status(code) { this.statusCode = code; return this },
  json(body) { this.body = body; return this }
})

test('user permissions route inherits authentication and delegates to controller', () => {
  const route = fs.readFileSync(path.join(__dirname, '../src/routes/permission-management.js'), 'utf8')
  assert.match(route, /router\.use\(unifiedAuth\)/)
  assert.match(route, /router\.get\('\/user-permissions', userPermissionsController\.getUserPermissions\.bind\(userPermissionsController\)\)/)
})

test('user permissions controller preserves missing identity and supports both identity fields', async () => {
  const lookups = []
  const controller = new UserPermissionsController({
    getAccessProfile: async userId => {
      lookups.push(userId)
      return { permissions: ['analytics:view'] }
    },
    logger: { error() {} }
  })
  const missing = response()
  const withId = response()
  const withUserId = response()
  await controller.getUserPermissions({ user: null }, missing)
  await controller.getUserPermissions({ user: { id: 7 } }, withId)
  await controller.getUserPermissions({ user: { userId: 8 } }, withUserId)

  assert.equal(missing.statusCode, 401)
  assert.deepEqual(missing.body, { success: false, message: '用户未认证，请使用真实登录' })
  assert.deepEqual(lookups, [7, 8])
  assert.deepEqual(withId.body, {
    success: true,
    message: '获取用户权限成功',
    data: { permissions: ['analytics:view'] }
  })
  assert.deepEqual(withUserId.body.data, { permissions: ['analytics:view'] })
})

test('user permissions controller preserves the established error response', async () => {
  const errors = []
  const controller = new UserPermissionsController({
    getAccessProfile: async () => { throw new Error('profile unavailable') },
    logger: { error(...args) { errors.push(args) } }
  })
  const result = response()
  await controller.getUserPermissions({ user: { id: 3 } }, result)

  assert.equal(result.statusCode, 500)
  assert.deepEqual(result.body, {
    success: false,
    message: '获取用户权限失败: profile unavailable',
    data: {}
  })
  assert.equal(errors.length, 1)
})
