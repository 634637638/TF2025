'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const AnalyticsEmployeeRolesController = require('../src/controllers/analytics-employee-roles.controller')
const AnalyticsEmployeeRolesService = require('../src/services/analytics-employee-roles.service')
const AnalyticsEmployeeRolesRepository = require('../src/repositories/analytics-employee-roles.repository')

const response = () => ({
  status(code) { this.statusCode = code; return this },
  json(body) { this.body = body; return this }
})

test('employee role distribution route preserves authentication and business-user middleware', () => {
  const route = fs.readFileSync(path.join(__dirname, '../src/routes/analytics.js'), 'utf8')
  assert.match(route, /router\.get\('\/employees\/roles', unifiedAuth, requireBusinessUser, analyticsEmployeeRolesController\.getEmployeeRoles\.bind\(analyticsEmployeeRolesController\)\)/)
})

test('employee role distribution controller parses store_id and keeps the response contract', async () => {
  const controller = new AnalyticsEmployeeRolesController({
    service: {
      async getEmployeeRoles(storeId) {
        assert.equal(storeId, 12)
        return [{ name: '店长', value: 2 }]
      }
    }
  })
  const result = response()
  await controller.getEmployeeRoles({ query: { store_id: '12xyz' } }, result)

  assert.equal(result.statusCode, 200)
  assert.deepEqual(result.body.data, [{ name: '店长', value: 2 }])
  assert.equal(result.body.message, '获取员工角色分布成功')
})

test('employee role distribution service checks connectivity and normalizes database counts', async () => {
  const disconnected = new AnalyticsEmployeeRolesService({ connected: () => false, repository: {} })
  await assert.rejects(disconnected.getEmployeeRoles(null), { statusCode: 500, message: '数据库连接失败' })

  const service = new AnalyticsEmployeeRolesService({
    connected: () => true,
    repository: { async getEmployeeRoles(storeId) {
      assert.equal(storeId, null)
      return [{ role_name: '店长', count: '2' }]
    } }
  })
  assert.deepEqual(await service.getEmployeeRoles(null), [{ name: '店长', value: '2' }])
})

test('employee role distribution repository binds optional store filters', async () => {
  const calls = []
  const repository = new AnalyticsEmployeeRolesRepository(() => ({
    async execute(...args) {
      calls.push(args)
      return [[{ role_name: '店长', count: 2 }]]
    }
  }))

  await repository.getEmployeeRoles(8)
  await repository.getEmployeeRoles(null)

  assert.match(calls[0][0], /AND u\.store_id = \?\s+GROUP BY/)
  assert.deepEqual(calls[0][1], [8])
  assert.doesNotMatch(calls[1][0], /AND u\.store_id = \?/)
  assert.deepEqual(calls[1][1], [])
})
