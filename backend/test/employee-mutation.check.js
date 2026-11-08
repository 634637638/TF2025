'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

function response() {
  return {
    status(code) {
      this.statusCode = code
      return this
    },
    json(body) {
      this.body = body
      return this
    }
  }
}

function serviceError(message, code, statusCode) {
  const error = new Error(message)
  error.code = code
  error.statusCode = statusCode
  return error
}

test('employee mutation routes preserve auth and each operation permission', () => {
  const route = fs.readFileSync(path.join(__dirname, '../src/routes/employees.js'), 'utf8')
  assert.match(route, /router\.post\('\/', unifiedAuth, requirePermission\('employee:create'\), employeeMutationController\.create\.bind\(employeeMutationController\)\)/)
  assert.match(route, /router\.put\('\/:id', unifiedAuth, requirePermission\('employee:edit'\), employeeMutationController\.update\.bind\(employeeMutationController\)\)/)
  assert.match(route, /router\.delete\('\/:id', unifiedAuth, requirePermission\('employee:delete'\), employeeMutationController\.delete\.bind\(employeeMutationController\)\)/)
  assert.match(route, /router\.patch\('\/:id\/status', unifiedAuth, requirePermission\('employee:edit'\), employeeMutationController\.updateStatus\.bind\(employeeMutationController\)\)/)
})

test('employee mutation service validates create data, hashes password and assigns normalized roles', async () => {
  const EmployeeMutationService = require('../src/services/employee-mutation.service')
  const calls = []
  const employee = { id: 12, username: 'lin', name: 'Lin' }
  const service = new EmployeeMutationService({
    hashPassword: async (password, rounds) => {
      calls.push(['hash', password, rounds])
      return 'hashed-password'
    },
    repository: {
      async getValidRoles(ids) { calls.push(['roles', ids]); return ids.map(id => ({ id })) },
      async findByUsername(username) { calls.push(['username', username]); return null },
      async findByPhone(phone) { calls.push(['phone', phone]); return null },
      async insertEmployee(data) { calls.push(['insert', data]); return employee.id },
      async findCreatedEmployee(username) { calls.push(['read', username]); return employee },
      async assignRole(userId, roleId) { calls.push(['assign', userId, roleId]) }
    }
  })

  const result = await service.createEmployee({
    username: 'lin', name: 'Lin', password: 'secret', phone: '13800138000',
    email: 'lin@example.com', salary_template_id: '3', hire_date: '2026-01-01', role_ids: ['2', 2, 4]
  })
  assert.deepEqual(result, employee)
  assert.deepEqual(calls, [
    ['roles', [2, 4]],
    ['username', 'lin'],
    ['phone', '13800138000'],
    ['hash', 'secret', 12],
    ['insert', {
      username: 'lin', name: 'Lin', password: 'hashed-password', phone: '13800138000',
      email: 'lin@example.com', salaryTemplateId: '3', hireDate: '2026-01-01'
    }],
    ['read', 'lin'],
    ['assign', 12, 2],
    ['assign', 12, 4]
  ])
})

test('employee mutation service keeps validation and duplicate errors as client errors', async () => {
  const EmployeeMutationService = require('../src/services/employee-mutation.service')
  const service = new EmployeeMutationService({ repository: {} })
  await assert.rejects(service.createEmployee({}), error => error.code === 'VALIDATION' && error.message.includes('缺少必需字段'))
  await assert.rejects(service.createEmployee({ username: 'u', name: 'n', password: 'p', role_ids: [] }), error => error.code === 'VALIDATION' && error.message.includes('有效角色'))

  const duplicateService = new EmployeeMutationService({ repository: {
    async getValidRoles(ids) { return ids.map(id => ({ id })) },
    async findByUsername() { return { id: 1 } }
  } })
  await assert.rejects(duplicateService.createEmployee({ username: 'u', name: 'n', password: 'p', role_ids: [1] }), error => error.message === '用户名已存在')
})

test('employee update retains allowed fields, role replacement and password hash signal', async () => {
  const EmployeeMutationService = require('../src/services/employee-mutation.service')
  const calls = []
  const service = new EmployeeMutationService({
    hashPassword: async password => `hash:${password}`,
    repository: {
      async getValidRoles(ids) { calls.push(['roles', ids]); return ids.map(id => ({ id })) },
      async findId(id) { calls.push(['exists', id]); return { id } },
      async findByPhone(...args) { calls.push(['phone', ...args]); return null },
      async findByUsername(...args) { calls.push(['username', ...args]); return null },
      async updateEmployee(...args) { calls.push(['update', ...args]) },
      async replaceRoles(...args) { calls.push(['replaceRoles', ...args]) },
      async findUpdatedEmployee(id) { calls.push(['read', id]); return { id: Number(id), username: 'new' } }
    }
  })
  const result = await service.updateEmployee('7', { username: 'new', password: 'secret', role_ids: [3, '4'], ignored: 'x' })
  assert.deepEqual(result, { employee: { id: 7, username: 'new' }, passwordUpdated: true })
  assert.deepEqual(calls, [
    ['roles', [3, 4]], ['exists', '7'], ['username', 'new', '7'],
    ['update', ['username', 'password'], ['new', 'hash:secret'], '7'],
    ['replaceRoles', '7', [3, 4]], ['read', '7']
  ])
})

test('employee delete and status protect the current account and preserve result semantics', async () => {
  const EmployeeMutationService = require('../src/services/employee-mutation.service')
  const calls = []
  const service = new EmployeeMutationService({ repository: {
    async findId(id) { calls.push(['exists', id]); return { id } },
    async deleteEmployee(id) { calls.push(['delete', id]) },
    async updateStatus(id, status) { calls.push(['status', id, status]) }
  } })

  await assert.rejects(service.deleteEmployee('5', 5), error => error.message === '不能删除自己的账户')
  await assert.rejects(service.updateEmployeeStatus('5', 0, 5), error => error.message === '不能禁用自己的账户')
  assert.deepEqual(await service.deleteEmployee('6', 5), { id: 6 })
  assert.deepEqual(await service.updateEmployeeStatus('6', 1, 5), { id: 6, status: 1, statusText: '启用' })
  await assert.rejects(service.updateEmployeeStatus('6', undefined, 5), error => error.message === '缺少status参数')
  assert.deepEqual(calls.slice(-4), [['exists', '6'], ['delete', '6'], ['exists', '6'], ['status', '6', 1]])
})

test('employee mutation controller preserves API responses and blacklists own password-change token', async () => {
  const EmployeeMutationController = require('../src/controllers/employee-mutation.controller')
  const blacklistCalls = []
  const controller = new EmployeeMutationController({
    service: {
      async updateEmployee() { return { employee: { id: 7 }, passwordUpdated: true } },
      async updateEmployeeStatus() { return { id: 7, status: 0, statusText: '禁用' } },
      async deleteEmployee() { return { id: 8 } },
      async createEmployee() { return { id: 9 } }
    },
    blacklistToken: (...args) => blacklistCalls.push(args)
  })
  const ownPassword = response()
  await controller.update({ params: { id: '7' }, body: {}, user: { id: 7 }, headers: { authorization: 'Bearer opaque' } }, ownPassword)
  assert.deepEqual(ownPassword.body, {
    success: true,
    message: '员工更新成功，密码已修改，请重新登录',
    data: { id: 7 },
    require_relogin: true,
    code: 'PASSWORD_CHANGED'
  })
  assert.deepEqual(blacklistCalls, [['opaque', 'password_changed']])

  const status = response()
  await controller.updateStatus({ params: { id: '7' }, body: { status: 0 }, user: { id: 2 } }, status)
  assert.equal(status.body.message, '员工禁用成功')
  assert.deepEqual(status.body.data, { id: 7, status: 0 })

  const failureController = new EmployeeMutationController({
    service: { async deleteEmployee() { throw serviceError('员工不存在', 'NOT_FOUND', 404) } }
  })
  const missing = response()
  await failureController.delete({ params: { id: '99' }, user: { id: 2 } }, missing)
  assert.equal(missing.statusCode, 404)
  assert.equal(missing.body.message, '员工不存在')
})

test('employee mutation repository parameterizes employee values and composes the service-provided update fields', async () => {
  const EmployeeMutationRepository = require('../src/repositories/employee-mutation.repository')
  const calls = []
  const repository = new EmployeeMutationRepository({
    database: () => ({ async execute(query, params) {
      calls.push({ query, params })
      if (query.includes('INSERT INTO users')) return [{ insertId: 10 }]
      if (query.includes('SELECT id FROM users')) return [[{ id: 10 }]]
      return [[], []]
    } })
  })
  await repository.findByUsername("x' OR 1=1 --")
  await repository.updateEmployee(['name', 'password'], ['Lin', 'hash'], '10')
  assert.deepEqual(calls[0].params, ["x' OR 1=1 --"])
  assert.match(calls[1].query, /SET name = \?, password = \? WHERE id = \?/)
  assert.deepEqual(calls[1].params, ['Lin', 'hash', '10'])
})
