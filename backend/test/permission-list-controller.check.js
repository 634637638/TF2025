'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const Controller = require('../src/controllers/permission-list.controller')
const Service = require('../src/services/permission-list.service')
const Repository = require('../src/repositories/permission-list.repository')

const response = () => ({
  status(code) { this.statusCode = code; return this },
  json(body) { this.body = body; return this }
})

test('permission list route preserves admin authorization and delegates to controller', () => {
  const route = fs.readFileSync(path.join(__dirname, '../src/routes/permission-management.js'), 'utf8')
  assert.match(route, /router\.get\('\/all', requirePermission\('permissions:admin'\), permissionListController\.list\.bind\(permissionListController\)\)/)
})

test('permission list controller preserves success and database error contracts', async () => {
  const controller = new Controller({
    service: { async list() { return [{ permission_type: 'view' }] } },
    logger: { error() {} }
  })
  const success = response()
  await controller.list({}, success)
  assert.deepEqual(success.body, {
    success: true,
    message: '获取权限列表成功',
    data: { total: 1, permissions: [{ permission_type: 'view' }] }
  })

  const failed = new Controller({ service: { async list() { throw new Error('query failed') } }, logger: { error() {} } })
  const failure = response()
  await failed.list({}, failure)
  assert.equal(failure.statusCode, 500)
  assert.deepEqual(failure.body, {
    success: false,
    message: '获取权限列表失败: query failed',
    data: []
  })
})

test('permission list service detects optional schema fields before querying', async () => {
  const checks = []
  const service = new Service({
    columnExists: async (table, column) => { checks.push(`${table}.${column}`); return column === 'created_at' },
    repository: { async list(input) {
      assert.deepEqual(input, { supportsModuleIsActive: false, supportsRolePermissionCreatedAt: true })
      return []
    } }
  })

  assert.deepEqual(await service.list(), [])
  assert.deepEqual(checks, ['modules.is_active', 'role_permissions.created_at'])
})

test('permission list repository keeps schema branches fixed and orders the selected rows', async () => {
  const calls = []
  const repository = new Repository({ database: () => ({ async execute(sql, params) {
    calls.push({ sql, params })
    return [[{ permission_type: 'view', module_key: 'inventory' }]]
  } }) })

  const rows = await repository.list({ supportsModuleIsActive: true, supportsRolePermissionCreatedAt: false })
  assert.deepEqual(rows, [{ permission_type: 'view', module_key: 'inventory' }])
  assert.equal(calls[0].params, undefined)
  assert.match(calls[0].sql, /NULL as created_at/)
  assert.match(calls[0].sql, /WHERE m\.is_active = 1/)
  assert.match(calls[0].sql, /ORDER BY m\.category, m\.sort_order, rp\.module_key, rp\.permission_type/)

  await repository.list({ supportsModuleIsActive: false, supportsRolePermissionCreatedAt: true })
  assert.match(calls[1].sql, /rp\.created_at,/)
  assert.doesNotMatch(calls[1].sql, /WHERE m\.is_active = 1/)
})
