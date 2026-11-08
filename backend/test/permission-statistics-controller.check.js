'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const Controller = require('../src/controllers/permission-statistics.controller')
const Service = require('../src/services/permission-statistics.service')
const Repository = require('../src/repositories/permission-statistics.repository')

const response = () => ({
  status(code) { this.statusCode = code; return this },
  json(body) { this.body = body; return this }
})

test('permission statistics routes preserve admin authorization and delegate to controller', () => {
  const route = fs.readFileSync(path.join(__dirname, '../src/routes/permission-management.js'), 'utf8')
  assert.match(route, /router\.get\('\/stats', requirePermission\('permissions:admin'\), permissionStatisticsController\.getStats\.bind\(permissionStatisticsController\)\)/)
  assert.match(route, /router\.get\('\/overview', requirePermission\('permissions:admin'\), permissionStatisticsController\.getOverview\.bind\(permissionStatisticsController\)\)/)
})

test('permission statistics controller keeps success and failure response contracts', async () => {
  const controller = new Controller({ service: {
    async getStats() { return { module_stats: [{ total: 2 }], role_stats: [{ total: 3 }], type_stats: [{ total: 4 }] } },
    async getOverview() { return { total_roles: 3, total_users: 5 } }
  }, logger: { error() {} } })
  const stats = response()
  const overview = response()
  await controller.getStats({}, stats)
  await controller.getOverview({}, overview)
  assert.deepEqual(stats.body.data.module_stats, [{ total: 2 }])
  assert.deepEqual(overview.body, { success: true, message: '获取权限统计成功', data: { total_roles: 3, total_users: 5 } })

  const failedController = new Controller({ service: { async getStats() { throw new Error('stats unavailable') } }, logger: { error() {} } })
  const failure = response()
  await failedController.getStats({}, failure)
  assert.equal(failure.statusCode, 500)
  assert.equal(failure.body.message, '获取权限统计失败: stats unavailable')
})

test('permission statistics service preserves schema-dependent aggregates and overview calculations', async () => {
  const checks = []
  const service = new Service({
    columnExists: async (table, column) => { checks.push(`${table}.${column}`); return column !== 'hierarchy_level' },
    repository: {
      async getStats(input) {
        assert.deepEqual(input, { supportsRoleIsActive: true, supportsModuleIsActive: true })
        return { moduleStats: [{ total: 2 }], roleStats: [{ total: 3 }], typeStats: [{ total: 4 }] }
      },
      async getOverview(input) {
        assert.deepEqual(input, {
          supportsRoleIsActive: true,
          supportsRoleHierarchyLevel: false,
          supportsUserStatus: true,
          supportsModuleIsActive: true
        })
        return {
          roleStats: [{ total_roles: 3, system_roles: 0, business_roles: 3 }],
          userStats: [{ total_users: 5, active_users: 4, users_with_roles: 3 }],
          moduleStats: [{ total_modules: 8, unregistered_modules: 2 }],
          permissionStats: [{ total_permissions: 9 }]
        }
      }
    }
  })
  assert.deepEqual(await service.getStats(), {
    module_stats: [{ total: 2 }], role_stats: [{ total: 3 }], type_stats: [{ total: 4 }]
  })
  assert.deepEqual(await service.getOverview(), {
    total_roles: 3,
    total_users: 5,
    active_users: 4,
    users_with_roles: 3,
    system_roles: 0,
    business_roles: 3,
    total_modules: 8,
    registered_modules: 6,
    unregistered_modules: 2,
    total_permissions: 9
  })
  assert.deepEqual(checks, ['roles.is_active', 'modules.is_active', 'roles.is_active', 'roles.hierarchy_level', 'users.status', 'modules.is_active'])
})

test('permission statistics repository uses schema flags only for fixed SQL branches', async () => {
  const calls = []
  const repository = new Repository({ database: () => ({ async execute(sql) {
    calls.push(sql)
    return [[{}]]
  } }) })
  await repository.getStats({ supportsRoleIsActive: true, supportsModuleIsActive: false })
  await repository.getOverview({
    supportsRoleIsActive: true,
    supportsRoleHierarchyLevel: false,
    supportsUserStatus: false,
    supportsModuleIsActive: false
  })
  assert.equal(calls.length, 7)
  assert.match(calls[0], /FROM modules\s*$/)
  assert.match(calls[1], /FROM roles WHERE is_active = 1/)
  assert.match(calls[3], /COUNT\(CASE WHEN 0 >= 70 THEN 1 END\)/)
  assert.match(calls[4], /COUNT\(CASE WHEN 1 = 1 THEN 1 END\)/)
  assert.match(calls[5], /COUNT\(CASE WHEN 0 = 1 THEN 1 END\)/)
})
