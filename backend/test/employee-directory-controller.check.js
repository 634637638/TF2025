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

test('employee directory routes retain auth, permission and numeric detail constraint', () => {
  const route = fs.readFileSync(path.join(__dirname, '../src/routes/employees.js'), 'utf8')
  assert.match(route, /router\.get\('\/', unifiedAuth, requirePermission\('employee:view'\), employeeDirectoryController\.list\.bind\(employeeDirectoryController\)\)/)
  assert.match(route, /router\.get\('\/:id\(\\\\d\+\)', unifiedAuth, requirePermission\('employee:view'\), employeeDirectoryController\.detail\.bind\(employeeDirectoryController\)\)/)
})

test('employee directory controller preserves list, detail, missing and error responses', async () => {
  const EmployeeDirectoryController = require('../src/controllers/employee-directory.controller')
  const listData = { employees: [{ id: 1, role_ids: [2] }], pagination: { page: 1, page_size: 10 } }
  const list = response()
  await new EmployeeDirectoryController({ service: { async listEmployees(query) {
    assert.deepEqual(query, { page: '1' })
    return listData
  } } }).list({ query: { page: '1' } }, list)
  assert.deepEqual(list.body.data, listData)

  const detail = response()
  await new EmployeeDirectoryController({ service: { async getEmployeeById(id) {
    assert.equal(id, '7')
    return { id: 7, role_ids: [2] }
  } } }).detail({ params: { id: '7' } }, detail)
  assert.deepEqual(detail.body.data, { id: 7, role_ids: [2] })

  const missing = response()
  await new EmployeeDirectoryController({ service: { async getEmployeeById() { return null } } })
    .detail({ params: { id: 'missing' } }, missing)
  assert.equal(missing.statusCode, 404)
  assert.equal(missing.body.message, '员工不存在')

  const failure = response()
  await new EmployeeDirectoryController({
    service: { async listEmployees() { throw new Error('database unavailable') } },
    logger: { error() {} }
  }).list({ query: {} }, failure)
  assert.equal(failure.statusCode, 500)
})

test('employee directory service keeps bounded pagination and role ID formatting', async () => {
  const EmployeeDirectoryService = require('../src/services/employee-directory.service')
  const calls = []
  const service = new EmployeeDirectoryService({
    repository: {
      async listEmployees(filters) {
        calls.push(filters)
        return {
          employees: [{ id: 1, role_ids: '2,4' }],
          total: 11
        }
      },
      async getEmployeeById(id) { calls.push(id); return { id: Number(id), role_ids: null } }
    }
  })
  const list = await service.listEmployees({ page: '2', page_size: '10000', status: '1', search: 'Lin' })
  assert.deepEqual(list, {
    employees: [{ id: 1, role_ids: [2, 4] }],
    pagination: { page: 2, page_size: 100, total: 11, total_pages: 1, has_next: false, has_prev: true }
  })
  assert.deepEqual(calls[0], { status: '1', search: 'Lin', pageSize: 100, offset: 100 })
  assert.deepEqual(await service.getEmployeeById('9'), { id: 9, role_ids: [] })
  assert.equal(calls[1], '9')
})

test('employee directory repository parameterizes filters and IDs and selects public role fields', async () => {
  const EmployeeDirectoryRepository = require('../src/repositories/employee-directory.repository')
  const calls = []
  const results = [
    [[{ total: 1 }]],
    [[{ id: 1, role_names: '销售', role_ids: '2' }]],
    [[{ id: 7, role_names: '店长', role_ids: '4' }]]
  ]
  const repository = new EmployeeDirectoryRepository({
    database: () => ({ async query(query, params) {
      calls.push({ query, params })
      return results.shift()
    } })
  })
  const list = await repository.listEmployees({ status: '1', search: 'Lin', pageSize: 10, offset: 0 })
  assert.equal(list.total, 1)
  assert.deepEqual(calls[0].params, ['1', '%Lin%', '%Lin%', '%Lin%', '%Lin%'])
  assert.deepEqual(calls[1].params, ['1', '%Lin%', '%Lin%', '%Lin%', '%Lin%', 10, 0])
  assert.match(calls[1].query, /u\.salary_template_id/)
  assert.match(calls[1].query, /GROUP_CONCAT\(r\.id ORDER BY r\.id/)
  assert.deepEqual(await repository.getEmployeeById('7'), { id: 7, role_names: '店长', role_ids: '4' })
  assert.deepEqual(calls[2].params, ['7'])
})
