'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { withConnection } = require('../src/core/db/connection')

const response = () => ({
  status(code) {
    this.statusCode = code
    return this
  },
  json(body) {
    this.body = body
    return this
  }
})

test('module scan routes preserve admin permission and delegate to controller', () => {
  const route = fs.readFileSync(path.join(__dirname, '../src/routes/module-management.js'), 'utf8')
  assert.match(route, /router\.use\(unifiedAuth\)/)
  assert.match(route, /router\.get\('\/', requireAnyPermission\(\['permissions:admin', 'menus:create', 'menus:edit'\]\), moduleManagementController\.list\.bind\(moduleManagementController\)\)/)
  assert.match(route, /router\.post\('\/sync-all', requirePermission\('permissions:admin'\), moduleManagementController\.syncAll\.bind\(moduleManagementController\)\)/)
  assert.match(route, /router\.get\('\/registered', requirePermission\('permissions:admin'\), moduleManagementController\.registered\.bind\(moduleManagementController\)\)/)
  assert.match(route, /router\.get\('\/:module_key\/name-status', requirePermission\('permissions:admin'\), moduleManagementController\.nameStatus\.bind\(moduleManagementController\)\)/)
  assert.match(route, /router\.get\('\/:module_key', requirePermission\('permissions:admin'\), moduleManagementController\.detail\.bind\(moduleManagementController\)\)/)
  assert.match(route, /router\.get\('\/scan', requirePermission\('permissions:admin'\), moduleManagementController\.scan\.bind\(moduleManagementController\)\)/)
  assert.match(route, /router\.get\('\/unregistered', requirePermission\('permissions:admin'\), moduleManagementController\.unregistered\.bind\(moduleManagementController\)\)/)
  assert.match(route, /router\.post\('\/register', requirePermission\('permissions:admin'\), moduleManagementController\.register\.bind\(moduleManagementController\)\)/)
  assert.match(route, /router\.post\('\/register-batch', requirePermission\('permissions:admin'\), moduleManagementController\.registerBatch\.bind\(moduleManagementController\)\)/)
  assert.match(route, /router\.post\('\/manual-create', requirePermission\('permissions:admin'\), moduleManagementController\.manualCreate\.bind\(moduleManagementController\)\)/)
  assert.match(route, /router\.delete\('\/:module_key', requirePermission\('permissions:admin'\), moduleManagementController\.delete\.bind\(moduleManagementController\)\)/)
  assert.match(route, /router\.put\('\/:module_key\/name', requirePermission\('permissions:admin'\), moduleManagementController\.rename\.bind\(moduleManagementController\)\)/)
  assert.match(route, /router\.put\('\/:module_key\/restore-name', requirePermission\('permissions:admin'\), moduleManagementController\.restoreName\.bind\(moduleManagementController\)\)/)
  assert.match(route, /router\.put\('\/:id\/status', requirePermission\('permissions:admin'\), moduleManagementController\.setStatusById\.bind\(moduleManagementController\)\)/)
  assert.match(route, /router\.put\('\/:module_key', requirePermission\('permissions:admin'\), moduleManagementController\.update\.bind\(moduleManagementController\)\)/)
  assert.match(route, /router\.patch\('\/:module_key\/toggle', requirePermission\('permissions:admin'\), moduleManagementController\.toggle\.bind\(moduleManagementController\)\)/)
  assert.match(route, /router\.get\('\/stats\/overview', requirePermission\('permissions:admin'\), moduleManagementController\.overviewStats\.bind\(moduleManagementController\)\)/)
  assert.match(route, /router\.post\('\/fix-menu-links', requirePermission\('permissions:admin'\), moduleManagementController\.fixMenuLinks\.bind\(moduleManagementController\)\)/)
})

test('module update controller preserves response, not-found and audit behavior', async () => {
  const ModuleManagementController = require('../src/controllers/module-management.controller')
  const req = {
    params: { module_key: 'sales' },
    body: { name: '销售', description: '销售模块', category: 'business', icon: 'chart', sort_order: 2 }
  }
  let audit
  const controller = new ModuleManagementController({
    service: { async updateModule(key, data) {
      assert.equal(key, 'sales')
      assert.deepEqual(data, { name: '销售', description: '销售模块', category: 'business', icon: 'chart', sort_order: 2 })
      return { existingModule: { id: 3, name: '旧名' }, affectedRows: 1 }
    } },
    async logPermissionOperation(...args) { audit = args }
  })
  const success = response()
  await controller.update(req, success)
  assert.deepEqual(success.body, { success: true, message: '模块更新成功' })
  assert.equal(audit[2], 'module')
  assert.equal(audit[3], 3)
  assert.equal(audit[5], '编辑模块：销售')

  const missing = response()
  await new ModuleManagementController({
    service: { async updateModule() { return { existingModule: null, affectedRows: 0 } } }
  }).update(req, missing)
  assert.equal(missing.statusCode, 404)
  assert.deepEqual(missing.body, { success: false, message: '模块不存在或未更新' })
})

test('module toggle controller preserves status audit and missing-module behavior', async () => {
  const ModuleManagementController = require('../src/controllers/module-management.controller')
  const req = { params: { module_key: 'sales' }, body: { is_active: 1 } }
  let audit
  const controller = new ModuleManagementController({
    service: { async toggleModule(key, isActive) {
      assert.equal(key, 'sales')
      assert.equal(isActive, 1)
      return { module: { id: 4, key, name: '销售', is_active: 0 }, affectedRows: 1 }
    } },
    async logPermissionOperation(...args) { audit = args }
  })
  const success = response()
  await controller.toggle(req, success)
  assert.deepEqual(success.body, { success: true, message: '模块启用成功' })
  assert.equal(audit[1], 'enable')
  assert.equal(audit[6].previous_is_active, 0)
  assert.equal(audit[6].is_active, 1)

  const missing = response()
  await new ModuleManagementController({
    service: { async toggleModule() { return null } }
  }).toggle(req, missing)
  assert.equal(missing.statusCode, 404)
  assert.deepEqual(missing.body, { success: false, message: '模块不存在' })
})

test('module overview statistics are assembled by the service and keep the API payload', async () => {
  const ModuleManagementController = require('../src/controllers/module-management.controller')
  const data = {
    total_modules: 3, total_permissions: 5, total_roles: 2,
    active_users: 7, category_stats: [{ category: 'business', count: 3 }], recent_syncs: []
  }
  const success = response()
  await new ModuleManagementController({
    service: { async getOverviewStats() { return data } }
  }).overviewStats({}, success)
  assert.deepEqual(success.body, { success: true, message: '获取统计信息成功', data })

  const failure = response()
  await new ModuleManagementController({
    service: { async getOverviewStats() { throw new Error('query failed') } }
  }).overviewStats({}, failure)
  assert.equal(failure.statusCode, 500)
  assert.deepEqual(failure.body, { success: false, message: '获取统计信息失败: query failed' })
})

test('module management service delegates database operations to its repository', async () => {
  const ModuleManagementService = require('../src/services/module-management.service')
  const calls = []
  const service = new ModuleManagementService({
    repository: {
      async getModuleByKey(key) { calls.push(['get', key]); return { id: 1, key } },
      async updateModule(key, data) { calls.push(['update', key, data]); return 1 },
      async getModuleStatusByKey(key) { calls.push(['status', key]); return { id: 1, key, is_active: 0 } },
      async setModuleStatusByKey(key, active) { calls.push(['set-status', key, active]); return 1 },
      async getOverviewStats() { calls.push(['stats']); return { total_modules: 1 } }
    }
  })
  const updateData = { name: '销售' }
  assert.deepEqual(await service.updateModule('sales', updateData), {
    existingModule: { id: 1, key: 'sales' }, affectedRows: 1
  })
  assert.deepEqual(await service.toggleModule('sales', 1), {
    module: { id: 1, key: 'sales', is_active: 0 }, affectedRows: 1
  })
  assert.deepEqual(await service.getOverviewStats(), { total_modules: 1 })
  assert.deepEqual(calls, [
    ['get', 'sales'], ['update', 'sales', updateData],
    ['status', 'sales'], ['set-status', 'sales', 1], ['stats']
  ])
})

test('module deletion controller delegates transaction and retains audit response', async () => {
  const ModuleManagementController = require('../src/controllers/module-management.controller')
  const req = { params: { module_key: 'sales' } }
  const calls = []
  const controller = new ModuleManagementController({
    service: { async deleteModule(key) { calls.push(['delete', key]) } },
    async logPermissionOperation(...args) { calls.push(['audit', ...args.slice(1)]) }
  })
  const res = response()
  await controller.delete(req, res)
  assert.deepEqual(calls, [
    ['delete', 'sales'],
    ['audit', 'delete', 'module', null, 'sales', '删除模块：sales', { audit_type: 'module_delete', module_key: 'sales' }]
  ])
  assert.deepEqual(res.body, { success: true, message: '模块删除成功' })
})

test('module name controllers preserve validation, restore guards, payloads and audits', async () => {
  const ModuleManagementController = require('../src/controllers/module-management.controller')
  const req = { params: { module_key: 'sales' }, body: { name: ' 新名称 ' } }
  let audit
  const controller = new ModuleManagementController({
    service: {
      async setModuleName(key, name, custom) {
        assert.deepEqual([key, name, custom], ['sales', ' 新名称 ', true])
        return { module: { id: 2, name: '旧名称', is_custom_name: 0, original_name: '销售' }, name: '新名称', isCustom: true }
      }
    },
    async logPermissionOperation(...args) { audit = args }
  })
  const renamed = response()
  await controller.rename(req, renamed)
  assert.deepEqual(renamed.body, {
    success: true, message: '模块名称修改成功',
    data: { module_key: 'sales', old_name: '旧名称', new_name: '新名称', is_custom_name: true, original_name: '销售' }
  })
  assert.equal(audit[5], '修改模块名称：旧名称 -> 新名称')

  const invalid = response()
  await new ModuleManagementController({
    service: { async setModuleName() { return { error: 'invalid_name' } } }
  }).rename(req, invalid)
  assert.equal(invalid.statusCode, 400)

  const restoreController = new ModuleManagementController({
    service: { async restoreModuleName() { return { module: { id: 2, name: '新名称', original_name: '销售' } } } },
    async logPermissionOperation(...args) { audit = args }
  })
  const restored = response()
  await restoreController.restoreName(req, restored)
  assert.deepEqual(restored.body, {
    success: true, message: '模块名称已恢复为原始名称',
    data: { module_key: 'sales', old_name: '新名称', new_name: '销售', is_custom_name: false }
  })
  assert.equal(audit[5], '恢复模块名称：新名称 -> 销售')

  const noOriginalName = response()
  await new ModuleManagementController({
    service: { async restoreModuleName() { return { error: 'original_name_missing' } } }
  }).restoreName(req, noOriginalName)
  assert.equal(noOriginalName.statusCode, 400)
})

test('module status by ID keeps input and protected-module validation with audit fields', async () => {
  const ModuleManagementController = require('../src/controllers/module-management.controller')
  const req = { params: { id: '12' }, body: { is_active: 1 } }
  let audit
  const controller = new ModuleManagementController({
    service: { async setModuleStatusById(id, isActive) {
      assert.deepEqual([id, isActive], ['12', 1])
      return { module: { id: 12, key: 'sales', name: '销售', is_active: 0 } }
    } },
    async logPermissionOperation(...args) { audit = args }
  })
  const success = response()
  await controller.setStatusById(req, success)
  assert.deepEqual(success.body, {
    success: true, message: '模块已启用', data: { id: '12', is_active: 1 }
  })
  assert.equal(audit[1], 'enable')
  assert.equal(audit[6].previous_is_active, 0)

  const protectedResult = response()
  await new ModuleManagementController({
    service: { async setModuleStatusById() { return { error: 'protected_module' } } }
  }).setStatusById({ params: { id: '3' }, body: { is_active: 0 } }, protectedResult)
  assert.equal(protectedResult.statusCode, 400)
  assert.equal(protectedResult.body.message, '权限管理核心模块不能禁用，否则会导致管理入口无法访问')
})

test('module management service preserves protected-module and delete transaction rules', async () => {
  const ModuleManagementService = require('../src/services/module-management.service')
  const calls = []
  const connection = {
    async beginTransaction() { calls.push('begin') },
    async commit() { calls.push('commit') },
    async rollback() { calls.push('rollback') },
    release() { calls.push('release') }
  }
  const service = new ModuleManagementService({
    repository: {
      async getModuleById() { return { id: 1, key: 'permissions_permissionsview' } },
      async setModuleStatusById(...args) { calls.push(['status', ...args]) },
      withConnection(operation) { return withConnection({ getConnection: async () => connection }, operation) },
      async deleteModulePermissions(...args) { calls.push(['permissions', ...args.slice(1)]) },
      async softDeleteModule(...args) { calls.push(['soft-delete', ...args.slice(1)]) }
    }
  })
  assert.deepEqual(await service.setModuleStatusById('1', 0), {
    error: 'protected_module', module: { id: 1, key: 'permissions_permissionsview' }
  })
  assert.deepEqual(await service.setModuleStatusById('1', '0'), { error: 'invalid_status' })
  await service.deleteModule('sales')
  assert.deepEqual(calls, [
    'begin', ['permissions', 'sales'], ['soft-delete', 'sales'], 'commit', 'release'
  ])

  const failedCalls = []
  const failingService = new ModuleManagementService({
    repository: {
      withConnection(operation) {
        return withConnection({ getConnection: async () => ({
          async beginTransaction() { failedCalls.push('begin') },
          async commit() { failedCalls.push('commit') },
          async rollback() { failedCalls.push('rollback') },
          release() { failedCalls.push('release') }
        }) }, operation)
      },
      async deleteModulePermissions() { throw new Error('delete failed') },
      async softDeleteModule() { failedCalls.push('soft-delete') }
    }
  })
  await assert.rejects(failingService.deleteModule('sales'), /delete failed/)
  assert.deepEqual(failedCalls, ['begin', 'rollback', 'release'])
})

test('module registration controllers retain validation, missing results and operation audits', async () => {
  const ModuleManagementController = require('../src/controllers/module-management.controller')
  const req = { body: { module_key: 'sales', module_keys: ['sales', 'inventory'] } }
  let audit
  const controller = new ModuleManagementController({
    service: {
      async registerModule(key) {
        assert.equal(key, 'sales')
        return { targetModule: { key, name: '销售' }, result: { success: true, module_id: 5 } }
      },
      async registerModules(keys) {
        assert.deepEqual(keys, ['sales', 'inventory'])
        return {
          targetModules: [{ key: 'sales', name: '销售' }, { key: 'inventory' }],
          result: [{ success: true }, { success: true }]
        }
      }
    },
    async logPermissionOperation(...args) { audit = args }
  })
  const registered = response()
  await controller.register(req, registered)
  assert.deepEqual(registered.body, { success: true, module_id: 5 })
  assert.deepEqual(audit.slice(1), [
    'create', 'module', 5, '销售', '注册模块：销售',
    { audit_type: 'module_register', module_key: 'sales', module_name: '销售' }
  ])

  const batch = response()
  await controller.registerBatch(req, batch)
  assert.deepEqual(batch.body, {
    success: true, message: '批量注册完成', data: [{ success: true }, { success: true }]
  })
  assert.equal(audit[2], 'module_batch')
  assert.deepEqual(audit[6].modules, [
    { module_key: 'sales', module_name: '销售' },
    { module_key: 'inventory', module_name: 'inventory' }
  ])

  const empty = response()
  await controller.registerBatch({ body: { module_keys: [] } }, empty)
  assert.equal(empty.statusCode, 400)
  const missing = response()
  await new ModuleManagementController({
    service: { async registerModule() { return { error: 'module_missing' } } }
  }).register({ body: { module_key: 'missing' } }, missing)
  assert.equal(missing.statusCode, 404)
})

test('manual module creation keeps transaction result, defaults, audit and repair behavior', async () => {
  const ModuleManagementController = require('../src/controllers/module-management.controller')
  const module = {
    key: 'custom_module', name: '自定义', description: '自定义管理模块',
    category: 'custom', icon: 'fas fa-cube', isActive: 1
  }
  const calls = []
  const controller = new ModuleManagementController({
    moduleScanner: { async autoFixAllMenuLinks() { calls.push('repair') } },
    service: { async createManualModule(body) { calls.push(['create', body]); return { module, moduleId: 9 } } },
    async logPermissionOperation(...args) { calls.push(['audit', ...args.slice(1)]) }
  })
  const req = { body: { key: module.key, name: module.name, category: module.category } }
  const success = response()
  await controller.manualCreate(req, success)
  assert.deepEqual(success.body, {
    success: true,
    message: '模块 "自定义" 创建成功',
    data: { id: 9, key: module.key, name: module.name, category: module.category, is_active: 1 }
  })
  assert.equal(calls[0][0], 'create')
  assert.equal(calls[1][0], 'audit')
  assert.equal(calls[2], 'repair')

  const invalid = response()
  await new ModuleManagementController({
    service: { async createManualModule() { return { error: 'invalid_key' } } }
  }).manualCreate({ body: { key: 'Bad-Key' } }, invalid)
  assert.equal(invalid.statusCode, 400)
  assert.equal(invalid.body.message, '模块标识只能包含小写字母、数字和下划线')
})

test('module management service scans registration targets and creates manual modules transactionally', async () => {
  const ModuleManagementService = require('../src/services/module-management.service')
  const calls = []
  const connection = {
    async beginTransaction() { calls.push('begin') },
    async commit() { calls.push('commit') },
    async rollback() { calls.push('rollback') },
    release() { calls.push('release') }
  }
  const scanner = {
    async scanViewsDirectory() { return [{ key: 'sales', name: '销售' }, { key: 'inventory' }] },
    async registerModule(module) { calls.push(['register', module.key]); return { success: true } },
    async registerModules(modules) { calls.push(['register-batch', modules.length]); return modules.length }
  }
  let inserted
  const service = new ModuleManagementService({
    moduleScanner: scanner,
    repository: {
      withConnection(operation) { return withConnection({ getConnection: async () => connection }, operation) },
      async getModuleByKey(key, executor) { calls.push(['exists', key, executor === connection]); return null },
      async createManualModule(executor, module) {
        inserted = module
        assert.equal(executor, connection)
        return [{ insertId: 9 }]
      }
    }
  })
  assert.equal((await service.registerModule('sales')).targetModule.name, '销售')
  assert.equal((await service.registerModule('missing')).error, 'module_missing')
  assert.equal((await service.registerModules(['sales', 'inventory'])).result, 2)
  const created = await service.createManualModule({ key: 'manual', name: '手动', category: 'custom' })
  assert.deepEqual(created, {
    module: {
      key: 'manual', name: '手动', description: '手动管理模块',
      category: 'custom', icon: 'fas fa-cube', isActive: 1
    },
    moduleId: 9
  })
  assert.deepEqual(inserted, created.module)
  assert.deepEqual(calls.slice(-4), [
    'begin', ['exists', 'manual', true], 'commit', 'release'
  ])
})

test('module detail controller preserves nested payload, missing-module and failure behavior', async () => {
  const ModuleManagementController = require('../src/controllers/module-management.controller')
  const data = { module: { id: 1 }, permissions: [{ permission_type: 'view' }], role_permissions: [{ role_id: 2 }] }
  const success = response()
  await new ModuleManagementController({
    moduleScanner: { async getModuleDetails(key) { assert.equal(key, 'sales'); return data } }
  }).detail({ params: { module_key: 'sales' } }, success)
  assert.deepEqual(success.body, { success: true, message: '获取模块详情成功', data })

  const missing = response()
  await new ModuleManagementController({
    moduleScanner: { async getModuleDetails() { return null } }
  }).detail({ params: { module_key: 'missing' } }, missing)
  assert.equal(missing.statusCode, 404)
  assert.deepEqual(missing.body, { success: false, message: '模块不存在' })

  const failure = response()
  await new ModuleManagementController({
    moduleScanner: { async getModuleDetails() { throw new Error('query failed') } }
  }).detail({ params: { module_key: 'sales' } }, failure)
  assert.equal(failure.statusCode, 500)
  assert.deepEqual(failure.body, { success: false, message: '获取模块详情失败: query failed' })
})

test('module name status controller preserves success, not-found and error responses', async () => {
  const ModuleManagementController = require('../src/controllers/module-management.controller')
  const status = { module_key: 'sales', current_name: '销售', can_restore: true }
  const success = response()
  await new ModuleManagementController({
    moduleScanner: { async getModuleNameStatus(key) { assert.equal(key, 'sales'); return status } }
  }).nameStatus({ params: { module_key: 'sales' } }, success)
  assert.deepEqual(success.body, { success: true, message: '获取模块名称状态成功', data: status })

  const missing = response()
  await new ModuleManagementController({
    moduleScanner: { async getModuleNameStatus() { return null } }
  }).nameStatus({ params: { module_key: 'missing' } }, missing)
  assert.equal(missing.statusCode, 404)
  assert.deepEqual(missing.body, { success: false, message: '模块不存在' })

  const failure = response()
  await new ModuleManagementController({
    moduleScanner: { async getModuleNameStatus() { throw new Error('query failed') } }
  }).nameStatus({ params: { module_key: 'sales' } }, failure)
  assert.equal(failure.statusCode, 500)
  assert.deepEqual(failure.body, { success: false, message: '获取模块名称状态失败: query failed' })
})

test('registered modules controller includes inactive modules and preserves failure payload', async () => {
  const ModuleManagementController = require('../src/controllers/module-management.controller')
  const modules = [{ id: 1, key: 'sales', is_active: 1 }, { id: 2, key: 'old', is_active: 0 }]
  const success = response()
  await new ModuleManagementController({
    moduleScanner: { async getRegisteredModules() { return modules } }
  }).registered({}, success)
  assert.deepEqual(success.body, {
    success: true,
    message: '获取已注册模块成功',
    data: { total: 2, modules }
  })

  const failure = response()
  await new ModuleManagementController({
    moduleScanner: { async getRegisteredModules() { throw new Error('query failed') } }
  }).registered({}, failure)
  assert.equal(failure.statusCode, 500)
  assert.deepEqual(failure.body, {
    success: false,
    message: '获取已注册模块失败: query failed',
    data: []
  })
})

test('module list controller preserves response fields and failure status', async () => {
  const ModuleManagementController = require('../src/controllers/module-management.controller')
  const success = response()
  await new ModuleManagementController({
    moduleScanner: { async getActiveModules() { return [{ id: 1, key: 'sales', is_active: 1 }] } }
  }).list({}, success)
  assert.deepEqual(success.body, {
    success: true,
    message: '获取模块列表成功',
    data: [{ id: 1, key: 'sales', is_active: 1 }]
  })

  const failure = response()
  await new ModuleManagementController({
    moduleScanner: { async getActiveModules() { throw new Error('database unavailable') } }
  }).list({}, failure)
  assert.equal(failure.statusCode, 500)
  assert.deepEqual(failure.body, { success: false, message: '获取模块列表失败', data: [] })
})

test('module sync controller preserves permission audit details and response behavior', async () => {
  const ModuleManagementController = require('../src/controllers/module-management.controller')
  const req = { user: { id: 7 } }
  let audit
  const result = { total: 2, success: 1, errors: 1, deleted: 0, results: [{ module_key: 'sales', success: true }] }
  const controller = new ModuleManagementController({
    moduleScanner: { async syncAllModules() { return result } },
    async logPermissionOperation(...args) { audit = args }
  })
  const success = response()
  await controller.syncAll(req, success)
  assert.deepEqual(success.body, { success: true, message: '同步所有模块完成', data: result })
  assert.equal(audit[0], req)
  assert.deepEqual(audit.slice(1), [
    'sync', 'module_batch', null, '同步全部模块', '同步模块：成功 1 个，失败 1 个，清理 0 个',
    {
      audit_type: 'module_sync', total: 2, success_count: 1, error_count: 1, deleted_count: 0,
      modules: [{ module_key: 'sales', action: 'registered_or_updated', success: true, message: '' }]
    }
  ])

  const failure = response()
  await new ModuleManagementController({
    moduleScanner: { async syncAllModules() { throw new Error('sync failed') } }
  }).syncAll(req, failure)
  assert.equal(failure.statusCode, 500)
  assert.deepEqual(failure.body, { success: false, message: '同步所有模块失败: sync failed' })
})

test('module scanner registers missing capability modules once and queries the active list', async () => {
  const { MODULE_PERMISSION_TYPES } = require('../src/config/module-permission-actions')
  const ModuleScanner = require('../src/services/module-scanner.service')
  const missingKey = Object.keys(MODULE_PERMISSION_TYPES)[0]
  const existingKeys = Object.keys(MODULE_PERMISSION_TYPES).filter(key => key !== missingKey)
  const calls = []
  const scanner = new ModuleScanner({
    repository: {
      async getModuleKeys() {
        calls.push('keys')
        return existingKeys.map(key => ({ key }))
      },
      async getActiveModules() {
        calls.push('active')
        return [{ id: 1, key: missingKey, is_active: 1 }]
      },
      async getRegisteredModules() {
        calls.push('registered')
        return [{ id: 1, key: missingKey, is_active: 1 }, { id: 2, key: 'disabled', is_active: 0 }]
      }
    }
  })
  scanner.scanViewsDirectory = async () => [{ key: missingKey, name: '能力模块' }]
  const registered = []
  scanner.registerModule = async moduleInfo => {
    registered.push(moduleInfo)
    return { success: true }
  }

  const [first, second] = await Promise.all([
    scanner.ensureConfiguredModulesRegistered(),
    scanner.ensureConfiguredModulesRegistered()
  ])
  assert.equal(first, undefined)
  assert.equal(second, undefined)
  assert.equal(registered.length, 1)
  assert.equal(registered[0].key, missingKey)

  assert.deepEqual(await scanner.getActiveModules(), [{ id: 1, key: missingKey, is_active: 1 }])
  assert.deepEqual(calls, ['keys', 'keys', 'active'])

  const registeredScanner = new ModuleScanner({
    repository: {
      async getModuleKeys() { return Object.keys(MODULE_PERMISSION_TYPES).map(key => ({ key })) },
      async getRegisteredModules() { return [{ id: 2, key: 'disabled', is_active: 0 }] }
    }
  })
  assert.deepEqual(await registeredScanner.getRegisteredModules(), [{ id: 2, key: 'disabled', is_active: 0 }])
})

test('module management repository uses stable active and complete module queries', async () => {
  const ModuleManagementRepository = require('../src/repositories/module-management.repository')
  const queries = []
  const repository = new ModuleManagementRepository({
    database: () => ({
      async execute(query) {
        queries.push(query)
        return [[{ id: 1, key: 'sales', is_active: 1 }]]
      }
    })
  })
  await repository.getModuleKeys()
  await repository.getActiveModules()
  await repository.getRegisteredModules()
  assert.match(queries[0], /SELECT `key` FROM modules/)
  assert.match(queries[1], /WHERE is_active = 1[\s\S]*ORDER BY name ASC/)
  assert.match(queries[2], /ORDER BY m\.is_active DESC, m\.category, m\.sort_order, m\.\`key\`/)
  assert.match(queries[2], /name_status/)
})

test('module management repository binds update keys and assembles overview counts', async () => {
  const ModuleManagementRepository = require('../src/repositories/module-management.repository')
  const calls = []
  const responses = [
    [[{ id: 4, key: 'sales', name: '销售' }]],
    [{ affectedRows: 1 }],
    [[{ id: 4, key: 'sales', name: '销售', is_active: 0 }]],
    [{ affectedRows: 1 }],
    [[{ total: 3 }]],
    [[{ total: 5 }]],
    [[{ total: 2 }]],
    [[{ total: 7 }]],
    [[{ category: 'business', count: 3 }]]
  ]
  const repository = new ModuleManagementRepository({
    database: () => ({
      async execute(query, params) {
        calls.push({ query, params })
        return responses.shift()
      }
    })
  })

  assert.deepEqual(await repository.getModuleByKey('sales'), { id: 4, key: 'sales', name: '销售' })
  assert.equal(await repository.updateModule('sales', {
    name: '销售', description: '销售模块', category: 'business', icon: 'chart', sort_order: 2
  }), 1)
  assert.deepEqual(await repository.getModuleStatusByKey('sales'), {
    id: 4, key: 'sales', name: '销售', is_active: 0
  })
  assert.equal(await repository.setModuleStatusByKey('sales', 1), 1)
  assert.deepEqual(await repository.getOverviewStats(), {
    total_modules: 3,
    total_permissions: 5,
    total_roles: 2,
    active_users: 7,
    category_stats: [{ category: 'business', count: 3 }],
    recent_syncs: []
  })
  assert.deepEqual(calls.slice(0, 4).map(call => call.params), [
    ['sales'], ['销售', '销售模块', 'business', 'chart', 2, 'sales'], ['sales'], [1, 'sales']
  ])
  assert.match(calls[4].query, /COUNT\(\*\) as total FROM modules/)
  assert.match(calls[5].query, /COUNT\(DISTINCT CONCAT\(module_key, permission_type\)\)/)
  assert.match(calls[8].query, /GROUP BY category/)
})

test('module name status service maps exact name protection fields and repository binds the module key', async () => {
  const ModuleScanner = require('../src/services/module-scanner.service')
  const ModuleManagementRepository = require('../src/repositories/module-management.repository')
  let params
  const repository = new ModuleManagementRepository({
    database: () => ({
      async execute(query, values) {
        assert.match(query, /is_custom_name, original_name/)
        params = values
        return [[{
          key: 'sales', name: '销售自定义', is_active: '1', is_custom_name: 1,
          original_name: '销售', created_at: 'created', updated_at: 'updated'
        }]]
      }
    })
  })
  const scanner = new ModuleScanner({ repository })
  const result = await scanner.getModuleNameStatus('sales')
  assert.deepEqual(params, ['sales'])
  assert.deepEqual(result, {
    module_key: 'sales', current_name: '销售自定义', is_active: true, is_custom_name: true,
    original_name: '销售', can_restore: true, status: '🔒 自定义名称', created_at: 'created', updated_at: 'updated'
  })
})

test('module detail service and repository bind the key for its active record and permission data', async () => {
  const ModuleScanner = require('../src/services/module-scanner.service')
  const ModuleManagementRepository = require('../src/repositories/module-management.repository')
  const calls = []
  const repository = new ModuleManagementRepository({
    database: () => ({
      async execute(query, params) {
        calls.push({ query, params })
        if (query.includes('SELECT * FROM modules')) return [[{ id: 1, key: 'sales', is_active: 1 }]]
        if (query.includes('SELECT DISTINCT permission_type')) return [[{ permission_type: 'view', description: '查看' }]]
        return [[{ role_id: 2, role_name: '管理员', permission_type: 'view' }]]
      }
    })
  })
  const details = await new ModuleScanner({ repository }).getModuleDetails('sales')
  assert.deepEqual(details, {
    module: { id: 1, key: 'sales', is_active: 1 },
    permissions: [{ permission_type: 'view', description: '查看' }],
    role_permissions: [{ role_id: 2, role_name: '管理员', permission_type: 'view' }]
  })
  assert.deepEqual(calls.map(call => call.params), [['sales'], ['sales'], ['sales']])
  assert.match(calls[0].query, /is_active = 1/)
  assert.match(calls[2].query, /ORDER BY r\.name/)
})

test('menu link repair controller delegates to the scanner and preserves success and failure responses', async () => {
  const ModuleManagementController = require('../src/controllers/module-management.controller')
  const scanner = { async autoFixAllMenuLinks() { return { updatedCount: 3, addedPermissionCount: 0 } } }
  const controller = new ModuleManagementController({ moduleScanner: scanner })
  const success = response()

  await controller.fixMenuLinks({}, success)

  assert.deepEqual(success.body, {
    success: true,
    message: '菜单关联修复完成，更新了 3 个菜单关联',
    data: { updatedCount: 3, addedPermissionCount: 0 }
  })

  const failure = response()
  await new ModuleManagementController({
    moduleScanner: { async autoFixAllMenuLinks() { throw new Error('repair failed') } }
  }).fixMenuLinks({}, failure)
  assert.equal(failure.statusCode, 500)
  assert.deepEqual(failure.body, { success: false, message: '修复失败: repair failed' })
})

test('module scan controller keeps the total and module list response', async () => {
  const ModuleManagementController = require('../src/controllers/module-management.controller')
  const controller = new ModuleManagementController({
    moduleScanner: { async scanViewsDirectory() { return [{ key: 'sales', name: '销售' }, { key: 'inventory', name: '库存' }] } }
  })
  const res = response()
  await controller.scan({}, res)
  assert.deepEqual(res.body, {
    success: true,
    message: '扫描成功',
    data: { total: 2, modules: [{ key: 'sales', name: '销售' }, { key: 'inventory', name: '库存' }] }
  })
})

test('unregistered module controller normalizes missing data and preserves scanner errors', async () => {
  const ModuleManagementController = require('../src/controllers/module-management.controller')
  const emptyController = new ModuleManagementController({ moduleScanner: { async getUnregisteredModules() { return {} } } })
  const emptyResponse = response()
  await emptyController.unregistered({}, emptyResponse)
  assert.deepEqual(emptyResponse.body, {
    success: true,
    message: '获取未注册模块成功',
    data: { total: 0, modules: [] }
  })

  const failedController = new ModuleManagementController({
    moduleScanner: { async getUnregisteredModules() { throw new Error('scan failed') } }
  })
  const failedResponse = response()
  await failedController.unregistered({}, failedResponse)
  assert.equal(failedResponse.statusCode, 500)
  assert.deepEqual(failedResponse.body, {
    success: false,
    message: '获取未注册模块失败: scan failed',
    data: []
  })
})
