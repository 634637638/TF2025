'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const PermissionActionsController = require('../src/controllers/permission-actions.controller')

const response = () => ({
  status(code) { this.statusCode = code; return this },
  json(body) { this.body = body; return this }
})

test('permission actions route preserves authentication and admin permission while delegating', () => {
  const route = fs.readFileSync(path.join(__dirname, '../src/routes/permission-management.js'), 'utf8')
  assert.match(route, /router\.use\(unifiedAuth\)/)
  assert.match(route, /router\.get\('\/actions', requirePermission\('permissions:admin'\), permissionActionsController\.list\.bind\(permissionActionsController\)\)/)
})

test('permission actions controller preserves success response', async () => {
  const controller = new PermissionActionsController({
    async listActions() { return ['view', 'edit'] }
  })
  const result = response()
  await controller.list({}, result)

  assert.deepEqual(result.body, {
    success: true,
    message: '获取权限动作成功',
    data: ['view', 'edit']
  })
})

test('permission actions controller preserves empty fallback and error response', async () => {
  const errors = []
  const controller = new PermissionActionsController({
    async listActions() { throw new Error('actions unavailable') },
    logger: { error(...args) { errors.push(args) } }
  })
  const result = response()
  await controller.list({}, result)

  assert.equal(result.statusCode, 500)
  assert.deepEqual(result.body, {
    success: false,
    message: '获取权限动作失败: actions unavailable',
    data: []
  })
  assert.equal(errors.length, 1)
})
