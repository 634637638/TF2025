'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const PermissionMenuController = require('../src/controllers/permission-menu.controller')
const PermissionMenuService = require('../src/services/permission-menu.service')
const PermissionMenuRepository = require('../src/repositories/permission-menu.repository')

const response = () => ({
  statusCode: 200,
  body: null,
  status(code) { this.statusCode = code; return this },
  json(body) { this.body = body; return this }
})

test('role menu route preserves admin authorization and delegates to its controller', () => {
  const source = fs.readFileSync(path.join(__dirname, '../src/routes/permission-management.js'), 'utf8')
  assert.match(source, /router\.get\('\/menu\/:role_id', requirePermission\('permissions:admin'\), permissionMenuController\.getByRole\.bind\(permissionMenuController\)\)/)
})

test('role menu controller preserves the response fields and error contract', async () => {
  const controller = new PermissionMenuController({
    service: { async getByRole(roleId) { assert.equal(roleId, '4'); return [{ module_key: 'inventory', menu_visible: 1 }] } },
    logger: { error() {} }
  })
  const success = response()
  await controller.getByRole({ params: { role_id: '4' } }, success)
  assert.deepEqual(success.body, {
    success: true,
    message: '获取角色菜单权限成功',
    data: { role_id: '4', menu_permissions: [{ module_key: 'inventory', menu_visible: 1 }] }
  })

  const failed = new PermissionMenuController({ service: { async getByRole() { throw new Error('query failed') } }, logger: { error() {} } })
  const failure = response()
  await failed.getByRole({ params: { role_id: '4' } }, failure)
  assert.equal(failure.statusCode, 500)
  assert.deepEqual(failure.body, { success: false, message: '获取角色菜单权限失败: query failed', data: [] })
})

test('role menu service checks legacy schema and reuses shared visibility resolution', async () => {
  const calls = []
  const database = { execute() {} }
  const service = new PermissionMenuService({
    databaseProvider: async () => database,
    columnExists: async (...args) => { calls.push(['column', ...args]); return true },
    repository: { async listModules(...args) {
      calls.push(['modules', ...args])
      return [{ module_key: 'inventory', module_name: '库存', category: '业务', icon: 'box', module_description: null }]
    } },
    visibilityReader: async (...args) => { calls.push(['visibility', ...args]); return { inventory: true } }
  })
  assert.deepEqual(await service.getByRole('4'), [{
    module_key: 'inventory', module_name: '库存', menu_visible: 1,
    category: '业务', icon: 'box', description: ''
  }])
  assert.deepEqual(calls.map(([kind]) => kind), ['column', 'modules', 'visibility'])
  assert.equal(calls[0][3], database)
  assert.equal(calls[1][1], database)
  assert.equal(calls[1][2], true)
  assert.deepEqual(calls[2].slice(1), ['4', database])
})

test('role menu repository keeps the active module schema branch and display ordering', async () => {
  const calls = []
  const repository = new PermissionMenuRepository()
  const database = { async execute(sql, params) { calls.push([sql, params]); return [[{ module_key: 'inventory' }]] } }
  assert.deepEqual(await repository.listModules(database, true), [{ module_key: 'inventory' }])
  assert.match(calls[0][0], /WHERE m\.is_active = 1/)
  assert.match(calls[0][0], /ORDER BY m\.category, m\.sort_order, m\.name/)
  assert.equal(calls[0][1], undefined)
  await repository.listModules(database, false)
  assert.doesNotMatch(calls[1][0], /WHERE m\.is_active = 1/)
})
