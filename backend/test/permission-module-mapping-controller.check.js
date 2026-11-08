'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const Controller = require('../src/controllers/permission-module-mapping.controller')
const Service = require('../src/services/permission-module-mapping.service')
const Repository = require('../src/repositories/permission-module-mapping.repository')
const { mergeManagedModules } = require('../src/utils/managed-permission-modules')

const response = () => ({
  status(code) { this.statusCode = code; return this },
  json(body) { this.body = body; return this }
})

test('module mappings route retains admin authorization and delegates to controller', () => {
  const route = fs.readFileSync(path.join(__dirname, '../src/routes/permission-management.js'), 'utf8')
  assert.match(route, /router\.get\('\/module-mappings', requirePermission\('permissions:admin'\), permissionModuleMappingController\.list\.bind\(permissionModuleMappingController\)\)/)
})

test('module mappings controller preserves success and error responses', async () => {
  const controller = new Controller({ service: { async list() { return [{ key: 'inventory' }] } }, logger: { error() {} } })
  const success = response()
  await controller.list({}, success)
  assert.deepEqual(success.body, { success: true, message: '获取模块映射列表成功', data: [{ key: 'inventory' }] })

  const failed = new Controller({ service: { async list() { throw new Error('query failed') } }, logger: { error() {} } })
  const failure = response()
  await failed.list({}, failure)
  assert.equal(failure.statusCode, 500)
  assert.deepEqual(failure.body, { success: false, message: '获取模块映射列表失败: query failed', data: [] })
})

test('module mappings service filters by optional schema and returns ensured module metadata', async () => {
  const calls = []
  const warnings = []
  const service = new Service({
    columnExists: async (table, column) => { calls.push(`${table}.${column}`); return true },
    repository: { async list(flags) {
      assert.deepEqual(flags, { supportsModuleIsActive: true })
      return [{ module_key: 'inventory', key: 'inventory', name: '库存', category: 'business', icon: 'warehouse', field_count: 9 }]
    } },
    logger: { warn(message) { warnings.push(message) } }
  })

  const modules = await service.list()
  assert.deepEqual(calls, ['modules.is_active'])
  assert.equal(modules.find(module => module.key === 'inventory').field_count, 9)
  assert.ok(modules.some(module => module.key === 'standards_standardsauditview'))
  assert.deepEqual(warnings, [])
})

test('module mappings service falls back to defaults and preserves the empty-registry warning', async () => {
  const warnings = []
  const service = new Service({
    columnExists: async () => false,
    repository: { async list() { return [] } },
    logger: { warn(message) { warnings.push(message) } }
  })
  const modules = await service.list()
  assert.equal(modules.find(module => module.key === 'dashboard').name, '仪表盘')
  assert.ok(modules.some(module => module.key === 'guide_guidemanagementview'))
  assert.deepEqual(warnings, ['数据库中没有已注册的模块，使用默认模块列表'])
})

test('managed module merge normalizes keys, fills metadata and sorts by category then name', () => {
  const modules = mergeManagedModules([
    { key: 'inventory', name: '库存Z', category: 'business' },
    { key: 'dashboard', name: '仪表盘', category: 'system' },
    { key: '', name: '忽略' }
  ], 'key')
  assert.equal(modules.length, 23)
  assert.equal(modules.find(module => module.name === '库存Z').module_key, 'inventory_inventoryview')
  assert.ok(modules.every(module => module.key && module.module_key))
  for (let index = 1; index < modules.length; index += 1) {
    const previous = modules[index - 1]
    const current = modules[index]
    const previousCategory = previous.module_category || previous.category || ''
    const currentCategory = current.module_category || current.category || ''
    const previousName = previous.module_name || previous.name || previous.module_key || previous.key || ''
    const currentName = current.module_name || current.name || current.module_key || current.key || ''
    assert.ok(previousCategory.localeCompare(currentCategory, 'zh-CN') < 0
      || previousCategory === currentCategory && previousName.localeCompare(currentName, 'zh-CN') <= 0)
  }
})

test('module mappings repository uses a fixed schema branch and ordered query', async () => {
  const calls = []
  const repository = new Repository({ database: () => ({ async execute(sql, params) {
    calls.push({ sql, params })
    return [[{ key: 'inventory' }]]
  } }) })
  await repository.list({ supportsModuleIsActive: true })
  await repository.list({ supportsModuleIsActive: false })
  assert.match(calls[0].sql, /WHERE m\.is_active = 1/)
  assert.match(calls[0].sql, /ORDER BY m\.category, m\.sort_order, m\.name/)
  assert.doesNotMatch(calls[1].sql, /WHERE m\.is_active = 1/)
  assert.deepEqual(calls.map(call => call.params), [undefined, undefined])
})
