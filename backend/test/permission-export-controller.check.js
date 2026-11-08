'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const Controller = require('../src/controllers/permission-export.controller')
const Service = require('../src/services/permission-export.service')
const Repository = require('../src/repositories/permission-export.repository')

const response = () => ({
  headers: {},
  setHeader(name, value) { this.headers[name] = value },
  status(code) { this.statusCode = code; return this },
  json(body) { this.body = body; return this },
  send(body) { this.body = body; return this }
})

test('permission export route preserves administrator authorization and delegates to controller', () => {
  const route = fs.readFileSync(path.join(__dirname, '../src/routes/permission-management.js'), 'utf8')
  assert.match(route, /router\.get\('\/export', requirePermission\('permissions:admin'\), permissionExportController\.export\.bind\(permissionExportController\)\)/)
})

test('permission export controller preserves JSON, CSV headers and error response', async () => {
  const controller = new Controller({
    service: { async export(format) { return { format, body: format === 'csv' ? '角色,模块,权限类型' : { version: '1.0' } } } },
    logger: { error() {} },
    clock: () => 123
  })
  const json = response()
  await controller.export({ query: {} }, json)
  assert.equal(json.headers['Content-Type'], 'application/json')
  assert.equal(json.headers['Content-Disposition'], 'attachment; filename="permissions_export_123.json"')
  assert.deepEqual(json.body, { version: '1.0' })

  const csv = response()
  await controller.export({ query: { format: 'csv' } }, csv)
  assert.equal(csv.headers['Content-Type'], 'text/csv')
  assert.equal(csv.headers['Content-Disposition'], 'attachment; filename="permissions_export_123.csv"')
  assert.equal(csv.body, '角色,模块,权限类型')

  const failed = response()
  const failing = new Controller({ service: { async export() { throw new Error('database unavailable') } }, logger: { error() {} } })
  await failing.export({ query: {} }, failed)
  assert.equal(failed.statusCode, 500)
  assert.equal(failed.body.message, '导出权限配置失败: database unavailable')
})

test('permission export service groups permissions and creates the established CSV representation', async () => {
  const repositoryCalls = []
  const rows = [
    { role_name: '管理员', module_key: 'sales', module_name: '销售', permission_type: 'view' },
    { role_name: '管理员', module_key: 'sales', module_name: '销售', permission_type: 'edit' },
    { role_name: '员工', module_key: 'inventory', module_name: '库存', permission_type: 'view' }
  ]
  const service = new Service({
    repository: { async getPermissions(support) { repositoryCalls.push(support); return rows } },
    columnExists: async (_table, column) => column === 'is_active',
    clock: () => new Date('2026-11-08T00:00:00.000Z')
  })
  const json = await service.export()
  assert.deepEqual(repositoryCalls, [{ supportsRoleIsActive: true, supportsModuleIsActive: true }])
  assert.deepEqual(json.body, {
    export_time: '2026-11-08T00:00:00.000Z',
    version: '1.0',
    roles: {
      管理员: { modules: { sales: { module_name: '销售', permissions: ['view', 'edit'] } } },
      员工: { modules: { inventory: { module_name: '库存', permissions: ['view'] } } }
    }
  })
  const csv = await service.export('csv')
  assert.equal(csv.body, '角色,模块,权限类型\n管理员,销售,view\n管理员,销售,edit\n员工,库存,view')
})

test('permission export repository applies schema-dependent filters and stable ordering', async () => {
  const calls = []
  const repository = new Repository({ database: () => ({ async execute(sql, params) {
    calls.push({ sql, params })
    return [[{ role_name: '管理员' }]]
  } }) })
  await repository.getPermissions({ supportsRoleIsActive: true, supportsModuleIsActive: false })
  await repository.getPermissions({ supportsRoleIsActive: false, supportsModuleIsActive: false })
  assert.deepEqual(calls.map(call => call.params), [undefined, undefined])
  assert.match(calls[0].sql, /WHERE r\.is_active = 1/)
  assert.doesNotMatch(calls[1].sql, /WHERE/)
  assert.match(calls[0].sql, /ORDER BY r\.name, m\.category, m\.sort_order, rp\.permission_type/)
})
