'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const Controller = require('../src/controllers/role-field-permissions.controller')
const Service = require('../src/services/role-field-permissions.service')
const Repository = require('../src/repositories/role-field-permissions.repository')

const routeSource = fs.readFileSync(path.join(__dirname, '../src/routes/permission-management.js'), 'utf8')
const response = () => ({
  statusCode: 200,
  status(code) { this.statusCode = code; return this },
  json(body) { this.body = body; return this }
})

test('role field permissions route preserves admin authorization and delegates to controller', () => {
  assert.match(routeSource, /router\.get\('\/field-permissions\/:role_id', requirePermission\('permissions:admin'\), roleFieldPermissionsController\.getByRole\.bind\(roleFieldPermissionsController\)\)/)
  assert.match(routeSource, /router\.post\('\/field-permissions\/:role_id', requirePermission\('permissions:admin'\), roleFieldPermissionsController\.save\.bind\(roleFieldPermissionsController\)\)/)
  assert.match(routeSource, /router\.put\('\/field-permissions\/:role_id', requirePermission\('permissions:admin'\), roleFieldPermissionsController\.update\.bind\(roleFieldPermissionsController\)\)/)
  assert.match(routeSource, /router\.post\('\/field-permissions\/:role_id\/batch', requirePermission\('permissions:admin'\), roleFieldPermissionsController\.saveBatch\.bind\(roleFieldPermissionsController\)\)/)
})

test('role field permission save controller validates input and clears cache only after success', async () => {
  let cacheClears = 0
  const controller = new Controller({
    service: { async saveForRole() { return { role_id: 5, module_key: 'sales', action: 'created' } } },
    logger: { debug() {}, error() {} },
    clearPermissionCache() { cacheClears += 1 }
  })
  const invalid = response()
  await controller.save({ params: { role_id: '5' }, body: { module_key: 'sales', field_config: null } }, invalid)
  assert.equal(invalid.statusCode, 400)
  assert.equal(cacheClears, 0)

  const success = response()
  await controller.save({ params: { role_id: '5' }, body: { module_key: 'sales', field_config: { hidden_fields: ['cost'] } } }, success)
  assert.equal(cacheClears, 1)
  assert.equal(success.body.data.action, 'created')

  controller.service.saveBatchForRole = async () => ({ role_id: 5, total_modules: 1, updated_count: 0, created_count: 1 })
  const batch = response()
  await controller.saveBatch({ params: { role_id: '5' }, body: { module_permissions: { sales: { hidden_fields: ['cost'] } } } }, batch)
  assert.equal(cacheClears, 2)
  assert.equal(batch.body.message, '批量保存字段权限配置成功，更新 0 个，创建 1 个')
})

test('role field permission update controller preserves PUT validation and response contracts', async () => {
  const controller = new Controller({
    service: {
      async saveForRole(_roleId, _moduleKey, _fieldConfig, request) {
        assert.equal(request.user.id, 7)
        return { role_id: 5, module_key: 'sales', action: 'updated' }
      }
    },
    logger: { debug() {}, error() {} }
  })
  const req = { params: { role_id: '5' }, body: { module_key: 'sales', field_config: { hidden_fields: ['cost'] } }, user: { id: 7 } }

  const invalid = response()
  await controller.update({ ...req, body: { module_key: 'sales', field_config: null } }, invalid)
  assert.equal(invalid.statusCode, 400)

  const success = response()
  await controller.update(req, success)
  assert.deepEqual(success.body, {
    success: true,
    message: '字段权限配置更新成功',
    data: { role_id: 5, module_key: 'sales', action: 'updated' }
  })

  controller.service.saveForRole = async () => { throw Object.assign(new Error('角色不存在'), { statusCode: 404 }) }
  const missing = response()
  await controller.update(req, missing)
  assert.equal(missing.statusCode, 404)
  assert.deepEqual(missing.body, { success: false, message: '角色不存在' })
})

test('role field permissions controller keeps validation, missing-role and error response contracts', async () => {
  const controller = new Controller({
    service: { async getByRole(roleId) { return roleId === 'missing' ? null : { role_id: 3, field_permissions: {}, total_modules: 0 } } },
    logger: { error() {} }
  })
  const invalid = response()
  await controller.getByRole({ params: {}, query: {} }, invalid)
  assert.equal(invalid.statusCode, 400)
  assert.equal(invalid.body.message, '角色ID不能为空')

  const missing = response()
  await controller.getByRole({ params: { role_id: 'missing' }, query: {} }, missing)
  assert.equal(missing.statusCode, 404)
  assert.deepEqual(missing.body, { success: false, message: '角色不存在' })

  const errors = []
  controller.service.getByRole = async () => { throw new Error('query failed') }
  controller.logger = { error(...args) { errors.push(args) } }
  const failed = response()
  await controller.getByRole({ params: { role_id: '9' }, query: {} }, failed)
  assert.equal(failed.statusCode, 500)
  assert.deepEqual(failed.body, {
    success: false,
    message: '获取角色字段权限失败: query failed',
    data: { role_id: '9', field_permissions: {} }
  })
  assert.equal(errors.length, 1)
})

test('role field permissions service handles legacy role schema and empty module defaults', async () => {
  const calls = []
  const now = new Date('2026-11-08T00:00:00.000Z')
  const service = new Service({
    databaseProvider: () => ({}),
    columnExists: async (...args) => { calls.push(['column', ...args]); return false },
    repository: {
      async findRole(...args) { calls.push(['role', ...args]); return { id: 5, name: '主管' } },
      async listFieldPermissions(...args) { calls.push(['fields', ...args]); return [] }
    },
    logger: { debug() {}, warn() {} },
    now: () => now
  })
  assert.deepEqual(await service.getByRole('05', 'inventory'), {
    role_id: 5,
    role_name: '主管',
    field_permissions: {
      inventory: {
        module_key: 'inventory',
        module_name: 'inventory',
        field_config: { hidden_fields: [] },
        created_at: now,
        updated_at: now
      }
    },
    total_modules: 1
  })
  assert.deepEqual(calls.map(([kind]) => kind), ['column', 'role', 'fields'])
  assert.deepEqual(calls[1].slice(1), [{}, '05', false])
  assert.deepEqual(calls[2].slice(1), [{}, '05', 'inventory'])
})

test('role field permissions service normalizes stored JSON and falls back for malformed config', async () => {
  const warnings = []
  const service = new Service({
    databaseProvider: () => ({}),
    columnExists: async () => true,
    repository: {
      async findRole() { return { id: 5, name: '主管' } },
      async listFieldPermissions() {
        return [
          { module_key: 'inventory', field_config: '{"hidden_fields":["cost"]}', created_at: 'created', updated_at: 'updated' },
          { module_key: 'inventory', field_config: '{}', created_at: 'duplicate', updated_at: 'duplicate' },
          { module_key: 'sales', field_config: '{invalid', created_at: 'created', updated_at: 'updated' }
        ]
      }
    },
    logger: { debug() {}, warn(...args) { warnings.push(args) } }
  })

  const result = await service.getByRole('5')
  assert.deepEqual(result.field_permissions.inventory.field_config, { hidden_fields: ['cost'] })
  assert.equal(result.field_permissions.inventory.created_at, 'created')
  assert.deepEqual(result.field_permissions.sales.field_config, { hidden_fields: [] })
  assert.equal(result.total_modules, 2)
  assert.equal(warnings.length, 1)
})

test('role field permissions repository binds IDs and optional module key with active-schema filtering', async () => {
  const calls = []
  const repository = new Repository()
  const database = { async execute(sql, params) { calls.push({ sql, params }); return [[{ id: 5, name: '主管' }]] } }
  assert.deepEqual(await repository.findRole(database, '5', true), { id: 5, name: '主管' })
  assert.match(calls[0].sql, /WHERE id = \? AND is_active = 1/)
  assert.deepEqual(calls[0].params, ['5'])
  await repository.findRole(database, '5', false)
  assert.doesNotMatch(calls[1].sql, /is_active/)

  await repository.listFieldPermissions(database, '5', 'inventory')
  assert.deepEqual(calls[2].params, ['5', 'inventory'])
  assert.match(calls[2].sql, /AND rfp\.module_key = \?/)
  await repository.listFieldPermissions(database, '5')
  assert.deepEqual(calls[3].params, ['5'])
  assert.match(calls[3].sql, /ORDER BY rfp\.module_key/)
})

test('role field permission writes keep one transaction and release the connection', async () => {
  const events = []
  const connection = {
    async beginTransaction() { events.push('begin') },
    async commit() { events.push('commit') },
    async rollback() { events.push('rollback') },
    release() { events.push('release') }
  }
  const service = new Service({
    databaseProvider: () => ({ async getConnection() { return connection } }),
    columnExists: async table => table === 'roles',
    repository: {
      async findRoleForWrite() { events.push('role'); return { id: 5 } },
      async findModuleForWrite(_connection, key) { events.push(`module:${key}`); return { key } },
      async findExistingFieldPermission(_connection, _roleId, key) { return key === 'sales' ? { id: 8 } : null },
      async updateFieldPermission(_connection, _roleId, key) { events.push(`update:${key}`) },
      async insertFieldPermission(_connection, _roleId, key) { events.push(`insert:${key}`) }
    },
    logger: { debug() {}, warn() {} }
  })

  const result = await service.saveBatchForRole('5', {
    sales: { hidden_fields: ['cost'] },
    inventory: { editable_fields: ['remarks'] }
  })
  assert.deepEqual(result, { role_id: 5, total_modules: 2, updated_count: 1, created_count: 1 })
  assert.deepEqual(events, ['begin', 'role', 'module:sales', 'update:sales', 'module:inventory', 'insert:inventory', 'commit', 'release'])
})

test('role field permission single save commits and returns the created or updated action', async () => {
  const events = []
  const connection = {
    async beginTransaction() { events.push('begin') },
    async commit() { events.push('commit') },
    async rollback() { events.push('rollback') },
    release() { events.push('release') }
  }
  const service = new Service({
    databaseProvider: () => ({ async getConnection() { return connection } }),
    columnExists: async () => false,
    repository: {
      async findRoleForWrite() { events.push('role'); return { id: 5 } },
      async findModuleForWrite() { events.push('module'); return { key: 'sales' } },
      async findExistingFieldPermission() { events.push('existing'); return null },
      async insertFieldPermission(_connection, roleId, moduleKey, config) { events.push(['insert', roleId, moduleKey, config]) }
    },
    logger: { debug() {}, warn() {} }
  })
  const result = await service.saveForRole('05', 'sales', { hidden_fields: ['cost'] })
  assert.deepEqual(result, {
    role_id: 5,
    module_key: 'sales',
    field_config: { hidden_fields: ['cost'] },
    action: 'created'
  })
  assert.deepEqual(events, [
    'begin', 'role', 'module', 'existing',
    ['insert', '05', 'sales', '{"hidden_fields":["cost"]}'],
    'commit', 'release'
  ])
})

test('role field permission update audits hidden-field changes inside the existing write flow', async () => {
  const events = []
  const connection = {
    async beginTransaction() { events.push('begin') },
    async commit() { events.push('commit') },
    async rollback() { events.push('rollback') },
    release() { events.push('release') }
  }
  const service = new Service({
    databaseProvider: () => ({ async getConnection() { return connection } }),
    columnExists: async () => true,
    repository: {
      async findRoleForWrite(_connection, _roleId, _active, includeName) {
        events.push(['role', includeName])
        return { id: 5, name: '主管' }
      },
      async findModuleForWrite(_connection, _key, _active, includeName) {
        events.push(['module', includeName])
        return { key: 'sales', name: '销售管理' }
      },
      async findExistingFieldPermission(_connection, _roleId, _key, includeConfig) {
        events.push(['existing', includeConfig])
        return { id: 9, field_config: { hidden_fields: ['cost', 'profit'] } }
      },
      async updateFieldPermission(_connection, _roleId, _key, serialized) { events.push(['update', serialized]) }
    },
    permissionLogs: { async logPermissionOperation(...args) { events.push(['audit', ...args]) } },
    clearPermissionCache() { events.push('cache') },
    logger: { debug() {}, warn() {} }
  })
  const request = { user: { id: 7 } }

  const result = await service.saveForRole('5', 'sales', { hidden_fields: ['profit', 'margin'] }, request)

  assert.equal(result.action, 'updated')
  assert.deepEqual(events.slice(0, 8), [
    'begin', ['role', true], ['module', true], ['existing', true],
    ['update', '{"hidden_fields":["profit","margin"]}'], 'commit',
    'cache',
    ['audit', request, 'permission', 'role', '5', '主管', '修改角色 主管 的字段权限：隐藏 1 项，恢复显示 1 项', {
      audit_type: 'role_field_permissions',
      module_key: 'sales',
      module_name: '销售管理',
      previous_hidden_fields: ['cost', 'profit'],
      hidden_fields: ['profit', 'margin'],
      added_count: 1,
      removed_count: 1,
      affected_modules_count: 1,
      module_changes: [{ module_key: 'sales', module_name: '销售管理', added_permissions: ['margin'], removed_permissions: ['cost'] }]
    }]
  ])
  assert.equal(events.at(-1), 'release')
})

test('role field permission write rolls back and releases on batch validation failure', async () => {
  const events = []
  const connection = {
    async beginTransaction() { events.push('begin') },
    async commit() { events.push('commit') },
    async rollback() { events.push('rollback') },
    release() { events.push('release') }
  }
  const service = new Service({
    databaseProvider: () => ({ async getConnection() { return connection } }),
    columnExists: async () => false,
    repository: {
      async findRoleForWrite() { return { id: 5 } },
      async findModuleForWrite() { return null }
    },
    logger: { debug() {}, warn() {} }
  })
  await assert.rejects(service.saveBatchForRole('5', { missing: { hidden_fields: [] } }), /模块不存在或已停用: missing/)
  assert.deepEqual(events, ['begin', 'rollback', 'release'])
})

test('role field permission repository binds write IDs and serialized configuration', async () => {
  const calls = []
  const repository = new Repository()
  const connection = {
    async execute(sql, params) {
      calls.push({ sql, params })
      if (sql.includes('SELECT id FROM roles')) return [[{ id: 5 }]]
      if (sql.includes('SELECT `key`')) return [[{ key: 'sales' }]]
      if (sql.includes('SELECT id FROM role_field_permissions')) return [[{ id: 8 }]]
      return [{ affectedRows: 1 }]
    }
  }
  await repository.findRoleForWrite(connection, '5', true)
  await repository.findModuleForWrite(connection, 'sales', true)
  await repository.findExistingFieldPermission(connection, '5', 'sales')
  await repository.updateFieldPermission(connection, '5', 'sales', '{"hidden_fields":[]}')
  await repository.insertFieldPermission(connection, '5', 'inventory', '{"hidden_fields":[]}')
  assert.deepEqual(calls.map(call => call.params), [
    ['5'], ['sales'], ['5', 'sales'], ['{"hidden_fields":[]}', '5', 'sales'], ['5', 'inventory', '{"hidden_fields":[]}']
  ])
  assert.match(calls[0].sql, /roles WHERE id = \? AND is_active = 1/)
  assert.match(calls[1].sql, /modules WHERE `key` = \? AND is_active = 1/)
  assert.match(calls[3].sql, /UPDATE role_field_permissions/)
  assert.match(calls[4].sql, /INSERT INTO role_field_permissions/)
})
