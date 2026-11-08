'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const Controller = require('../src/controllers/module-permission-check.controller')

const response = () => ({
  status(code) { this.statusCode = code; return this },
  json(body) { this.body = body; return this }
})

test('module permission check route inherits auth and delegates to controller', () => {
  const route = fs.readFileSync(path.join(__dirname, '../src/routes/permission-management.js'), 'utf8')
  assert.match(route, /router\.use\(unifiedAuth\)/)
  assert.match(route, /router\.get\('\/check-module-permission', modulePermissionCheckController\.check\.bind\(modulePermissionCheckController\)\)/)
})

test('module permission check validates query fields before requiring identity', async () => {
  const controller = new Controller({ checkPermission: async () => { throw new Error('must not call') }, logger: { error() {}, debug() {} } })
  const missingFields = response()
  await controller.check({ query: { module_key: 'sales' }, user: null }, missingFields)
  assert.equal(missingFields.statusCode, 400)
  assert.deepEqual(missingFields.body, { success: false, message: '模块key和权限类型不能为空' })

  const missingIdentity = response()
  await controller.check({ query: { module_key: 'sales', permission_type: 'view' }, user: null }, missingIdentity)
  assert.equal(missingIdentity.statusCode, 401)
  assert.deepEqual(missingIdentity.body, { success: false, message: '用户未认证，请使用真实登录' })
})

test('module permission check delegates to shared access service and preserves response fields', async () => {
  const calls = []
  const logs = []
  const controller = new Controller({
    checkPermission: async (...args) => { calls.push(args); return true },
    logger: { debug(...args) { logs.push(args) }, error() {} }
  })
  const result = response()
  await controller.check({
    query: { module_key: 'sales_salesview', permission_type: 'view' },
    user: { userId: 17 }
  }, result)

  assert.deepEqual(calls, [[17, 'sales_salesview', 'view']])
  assert.deepEqual(result.body, {
    success: true,
    message: '权限检查完成',
    data: {
      has_permission: true,
      user_id: 17,
      module_key: 'sales_salesview',
      permission_type: 'view'
    }
  })
  assert.equal(logs.length, 1)
})

test('module permission check maps access service errors to the established response', async () => {
  const logged = []
  const controller = new Controller({
    checkPermission: async () => { throw new Error('permission lookup failed') },
    logger: { debug() {}, error(...args) { logged.push(args) } }
  })
  const result = response()
  await controller.check({ query: { module_key: 'sales', permission_type: 'view' }, user: { id: 4 } }, result)
  assert.equal(result.statusCode, 500)
  assert.deepEqual(result.body, {
    success: false,
    message: '检查模块权限失败: permission lookup failed',
    data: { has_permission: false }
  })
  assert.equal(logged.length, 1)
})
