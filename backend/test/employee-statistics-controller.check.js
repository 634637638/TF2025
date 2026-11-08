'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

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

test('employee overview route preserves authentication and employee:view permission', () => {
  const route = fs.readFileSync(path.join(__dirname, '../src/routes/employees.js'), 'utf8')
  assert.match(route, /router\.get\('\/stats\/overview', unifiedAuth, requirePermission\('employee:view'\), employeeStatisticsController\.overview\.bind\(employeeStatisticsController\)\)/)
})

test('employee statistics controller preserves success and server-error response behavior', async () => {
  const EmployeeStatisticsController = require('../src/controllers/employee-statistics.controller')
  const data = { total: 4, active: 3, inactive: 1, recent_logins: 2, by_role: { 销售: 3 } }
  const success = response()
  await new EmployeeStatisticsController({ service: { async getOverviewStats(query) {
    assert.deepEqual(query, { status: '0', search: '李' })
    return data
  } } }).overview({ query: { status: '0', search: '李' } }, success)
  assert.equal(success.body.success, true)
  assert.deepEqual(success.body.data, data)

  const failure = response()
  await new EmployeeStatisticsController({
    service: { async getOverviewStats() { throw new Error('database unavailable') } },
    logger: { error() {} }
  }).overview({ query: {} }, failure)
  assert.equal(failure.statusCode, 500)
  assert.equal(failure.body.success, false)
})

test('employee statistics service preserves status normalization and role aggregation', async () => {
  const EmployeeStatisticsService = require('../src/services/employee-statistics.service')
  const calls = []
  const service = new EmployeeStatisticsService({
    repository: { async getOverviewStats(filters) {
      calls.push(filters)
      return {
        stats: { total: 4, active: 3, inactive: 1 },
        recentLoginStats: { recent_logins: 2 },
        roleStats: [{ role_name: '销售', count: 3 }, { role_name: '店长', count: 1 }]
      }
    } }
  })
  assert.deepEqual(await service.getOverviewStats({ status: '0', search: ' 李 ' }), {
    total: 4,
    active: 3,
    inactive: 1,
    recent_logins: 2,
    by_role: { 销售: 3, 店长: 1 }
  })
  await service.getOverviewStats({ status: 'invalid', search: '  ' })
  assert.deepEqual(calls, [
    { status: 0, search: '李' },
    { status: 1, search: '' }
  ])
})

test('employee statistics repository binds status and search filters to the aggregate query', async () => {
  const EmployeeStatisticsRepository = require('../src/repositories/employee-statistics.repository')
  const queries = []
  const results = [
    [[{ total: 1, active: 0, inactive: 1 }]],
    [[{ role_name: '销售', count: 1 }]],
    [[{ recent_logins: 0 }]]
  ]
  const repository = new EmployeeStatisticsRepository({
    database: () => ({ async execute(query, params) {
      queries.push({ query, params })
      return results.shift()
    } })
  })
  const stats = await repository.getOverviewStats({ status: 0, search: '李' })
  assert.deepEqual(stats.stats, { total: 1, active: 0, inactive: 1 })
  assert.deepEqual(stats.roleStats, [{ role_name: '销售', count: 1 }])
  assert.deepEqual(queries[0].params, [0, '%李%', '%李%', '%李%', '%李%'])
  assert.match(queries[0].query, /u\.status = \?/)
  assert.match(queries[0].query, /CONVERT\(u\.email USING utf8mb4\)/)
  assert.match(queries[1].query, /LEFT JOIN user_roles ur ON r\.id = ur\.role_id/)
  assert.match(queries[2].query, /INTERVAL 7 DAY/)
})
