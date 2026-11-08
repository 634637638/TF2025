'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const Controller = require('../src/controllers/permission-import.controller')
const Service = require('../src/services/permission-import.service')
const Repository = require('../src/repositories/permission-import.repository')

const response = () => ({
  status(code) { this.statusCode = code; return this },
  json(body) { this.body = body; return this }
})

test('permission import route preserves administrator authorization and controller delegation', () => {
  const route = fs.readFileSync(path.join(__dirname, '../src/routes/permission-management.js'), 'utf8')
  assert.match(route, /router\.post\('\/import', requirePermission\('permissions:admin'\), permissionImportController\.import\.bind\(permissionImportController\)\)/)
})

test('permission import controller keeps invalid, success and error response contracts', async () => {
  const controller = new Controller({ service: { async import(config, overwrite) {
    assert.deepEqual([config, overwrite], [undefined, false])
    return { status: 400 }
  } }, logger: { error() {} } })
  const invalid = response()
  await controller.import({ body: {} }, invalid)
  assert.equal(invalid.statusCode, 400)
  assert.deepEqual(invalid.body, { success: false, message: '权限配置格式错误' })

  controller.service.import = async (_config, overwrite) => ({ status: 200, importedCount: 3, overwrite })
  const success = response()
  await controller.import({ body: { config: {}, overwrite: true } }, success)
  assert.deepEqual(success.body, {
    success: true,
    message: '成功导入 3 个权限',
    data: { importedCount: 3, overwrite: true }
  })

  controller.service.import = async () => { throw new Error('database unavailable') }
  const failure = response()
  await controller.import({ body: {} }, failure)
  assert.equal(failure.statusCode, 500)
  assert.deepEqual(failure.body, { success: false, message: '导入权限配置失败: database unavailable' })
})

test('permission import service preserves schema branches and commits counted imports', async () => {
  const events = []
  const service = new Service({
    columnExists: async () => true,
    logger: { warn(message) { events.push(['warn', message]) } },
    repository: {
      async withConnection(operation) {
        const connection = {
          async beginTransaction() { events.push('begin') },
          async commit() { events.push('commit') },
          async rollback() { events.push('rollback') },
          release() { events.push('release') }
        }
        try { return await operation(connection) } finally { connection.release() }
      },
      async findRoleId(_connection, name, active) { events.push(['role', name, active]); return name === 'missing' ? null : 7 },
      async deleteRolePermissions(_connection, roleId) { events.push(['delete', roleId]) },
      async moduleExists(_connection, key, active) { events.push(['module', key, active]); return key !== 'missing-module' },
      async permissionExists(_connection, _role, _module, permission) { return permission === 'view' },
      async insertPermission(_connection, role, module, permission, createdAt) { events.push(['insert', role, module, permission, createdAt]) }
    }
  })

  const result = await service.import({ roles: {
    manager: { modules: { sales: { permissions: ['view', 'edit'] }, 'missing-module': { permissions: ['view'] } } },
    missing: { modules: {} }
  } }, true)
  assert.deepEqual(result, { status: 200, importedCount: 2, overwrite: true })
  assert.ok(events.some(event => Array.isArray(event) && event[0] === 'delete' && event[1] === 7))
  assert.ok(events.some(event => Array.isArray(event) && event[0] === 'insert' && event[3] === 'edit'))
  assert.ok(events.includes('commit'))
  assert.ok(events.includes('release'))
  assert.ok(events.some(event => Array.isArray(event) && event[0] === 'warn' && event[1].includes('角色 missing')))
})

test('permission import service skips already assigned permissions when overwrite is disabled', async () => {
  const inserted = []
  const service = new Service({
    columnExists: async () => false,
    logger: { warn() {} },
    repository: {
      async withConnection(operation) {
        return operation({ async beginTransaction() {}, async commit() {}, async rollback() {}, release() {} })
      },
      async findRoleId() { return 1 },
      async moduleExists() { return true },
      async permissionExists(_connection, _role, _module, permission) { return permission === 'view' },
      async insertPermission(_connection, _role, _module, permission) { inserted.push(permission) }
    }
  })
  const config = { roles: { manager: { modules: { sales: { permissions: ['view', 'edit'] } } } } }
  const result = await service.import(config)
  assert.deepEqual(result, { status: 200, importedCount: 1, overwrite: false })
  assert.deepEqual(inserted, ['edit'])
})

test('permission import service rolls back and releases when a write fails', async () => {
  const events = []
  const service = new Service({
    columnExists: async () => false,
    repository: {
      async withConnection(operation) {
        const connection = {
          async beginTransaction() { events.push('begin') },
          async commit() { events.push('commit') },
          async rollback() { events.push('rollback') },
          release() { events.push('release') }
        }
        try { return await operation(connection) } finally { connection.release() }
      },
      async findRoleId() { return 7 },
      async moduleExists() { throw new Error('query failed') }
    }
  })
  const config = { roles: { manager: { modules: { sales: { permissions: ['view'] } } } } }
  await assert.rejects(service.import(config), /query failed/)
  assert.deepEqual(events, ['begin', 'rollback', 'release'])
})

test('permission import repository binds values and selects schema-dependent columns', async () => {
  const calls = []
  const connection = { async execute(sql, params) {
    calls.push({ sql, params })
    return sql.startsWith('SELECT') ? [[{ id: 7, key: 'sales' }]] : [{ affectedRows: 1 }]
  } }
  const repository = new Repository()
  assert.equal(await repository.findRoleId(connection, 'manager', true), 7)
  assert.equal(await repository.moduleExists(connection, 'sales', false), true)
  assert.equal(await repository.permissionExists(connection, 7, 'sales', 'view'), true)
  await repository.deleteRolePermissions(connection, 7)
  await repository.insertPermission(connection, 7, 'sales', 'edit', true)
  assert.deepEqual(calls[0].params, ['manager'])
  assert.match(calls[0].sql, /is_active = 1/)
  assert.doesNotMatch(calls[1].sql, /is_active/)
  assert.deepEqual(calls[2].params, [7, 'sales', 'view'])
  assert.deepEqual(calls[3].params, [7])
  assert.match(calls[4].sql, /permission_type, created_at/)
  assert.deepEqual(calls[4].params, [7, 'sales', 'edit'])
})
