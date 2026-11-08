'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const Controller = require('../src/controllers/user-roles.controller')
const Service = require('../src/services/user-roles.service')
const Repository = require('../src/repositories/user-roles.repository')

const response = () => ({
  status(code) { this.statusCode = code; return this },
  json(body) { this.body = body; return this }
})

test('user roles route keeps admin permission and delegates to controller', () => {
  const route = fs.readFileSync(path.join(__dirname, '../src/routes/permission-management.js'), 'utf8')
  assert.match(route, /router\.get\('\/users\/:id\/roles', requirePermission\('permissions:admin'\), userRolesController\.getUserRoles\.bind\(userRolesController\)\)/)
  assert.match(route, /router\.get\('\/roles', requirePermission\('permissions:admin'\), userRolesController\.listRoles\.bind\(userRolesController\)\)/)
  assert.doesNotMatch(route, /router\.get\('\/roles',[^\n]*async\s*\(/)
})

test('user roles controller preserves missing-user, success and error responses', async () => {
  const controller = new Controller({ service: { async getUserRoles(id) {
    if (id === 'missing') return null
    if (id === 'error') throw new Error('lookup failed')
    return [{ id: 2, name: '管理员', description: '系统管理' }]
  } }, logger: { error() {} } })
  const missing = response()
  const success = response()
  const failure = response()
  await controller.getUserRoles({ params: { id: 'missing' } }, missing)
  await controller.getUserRoles({ params: { id: '7' } }, success)
  await controller.getUserRoles({ params: { id: 'error' } }, failure)

  assert.equal(missing.statusCode, 404)
  assert.deepEqual(missing.body, { success: false, message: '用户不存在' })
  assert.deepEqual(success.body, {
    success: true,
    message: '获取用户角色成功',
    data: [{ id: 2, name: '管理员', description: '系统管理' }]
  })
  assert.equal(failure.statusCode, 500)
  assert.equal(failure.body.message, '获取用户角色失败: lookup failed')
})

test('user roles service translates repository existence into a missing-user result', async () => {
  const service = new Service({ repository: { async getUserRoles(id) {
    assert.equal(id, '8')
    return { exists: false, roles: [] }
  } } })
  assert.equal(await service.getUserRoles('8'), null)
})

test('user roles repository checks the user then returns ordered role fields', async () => {
  const calls = []
  const repository = new Repository({ database: () => ({ async execute(sql, params) {
    calls.push({ sql, params })
    return calls.length === 1 ? [[{ id: 7 }]] : [[{ id: 2, name: '管理员', description: '系统管理' }]]
  } }) })
  assert.deepEqual(await repository.getUserRoles('7'), {
    exists: true,
    roles: [{ id: 2, name: '管理员', description: '系统管理' }]
  })
  assert.deepEqual(calls.map(call => call.params), [['7'], ['7']])
  assert.match(calls[0].sql, /SELECT id FROM users WHERE id = \?/)
  assert.match(calls[1].sql, /SELECT r\.id, r\.name, r\.description[\s\S]*ORDER BY r\.id/)
})

test('role list controller bounds pagination and preserves the response contract', async () => {
  const calls = []
  const controller = new Controller({ service: { async listRoles(input) {
    calls.push(input)
    return { roles: [{ id: 3, name: '管理员' }], total: 501 }
  } }, logger: { error() {} } })
  const res = response()

  await controller.listRoles({ query: { search: '  admin  ', page: '2', page_size: '900' } }, res)

  assert.deepEqual(calls, [{ search: 'admin', page: 2, pageSize: 500 }])
  assert.deepEqual(res.body, {
    success: true,
    message: '获取角色列表成功',
    data: {
      roles: [{ id: 3, name: '管理员' }],
      total: 501,
      page: 2,
      page_size: 500,
      total_pages: 2,
      has_next: false,
      has_prev: true
    }
  })
})

test('role list controller keeps defaults and the established error response', async () => {
  const calls = []
  const controller = new Controller({ service: { async listRoles(input) {
    calls.push(input)
    throw new Error('lookup failed')
  } }, logger: { error() {} } })
  const res = response()

  await controller.listRoles({ query: {} }, res)

  assert.deepEqual(calls, [{ search: '', page: 1, pageSize: 50 }])
  assert.equal(res.statusCode, 500)
  assert.deepEqual(res.body, {
    success: false,
    message: '获取角色列表失败: lookup failed',
    data: { roles: [], total: 0, page: 1, page_size: 10, total_pages: 0, has_next: false, has_prev: false }
  })
})

test('role list service detects optional schema fields before delegating to repository', async () => {
  const calls = []
  const service = new Service({
    repository: { async listRoles(input) { calls.push(input); return { roles: [], total: 0 } } },
    inspectColumn: async (table, column) => column === 'code'
  })

  const result = await service.listRoles({ search: 'admin', page: 1, pageSize: 50 })

  assert.deepEqual(result, { roles: [], total: 0 })
  assert.deepEqual(calls, [{
    search: 'admin',
    page: 1,
    pageSize: 50,
    supportsRoleCode: true,
    supportsRoleIsActive: false
  }])
})

test('role list repository binds search and pagination and supports older role schemas', async () => {
  const calls = []
  const repository = new Repository({ database: () => ({
    async execute(sql, params) {
      calls.push({ sql, params })
      return [[{ total: 2 }]]
    },
    async query(sql, params) {
      calls.push({ sql, params })
      return [[{ id: 1, name: '管理员' }]]
    }
  }) })

  const result = await repository.listRoles({
    search: 'admin', page: 2, pageSize: 50,
    supportsRoleCode: false, supportsRoleIsActive: false
  })

  assert.deepEqual(result, { roles: [{ id: 1, name: '管理员' }], total: 2 })
  assert.deepEqual(calls[0].params, ['%admin%', '%admin%'])
  assert.deepEqual(calls[1].params, ['%admin%', '%admin%', 50, 50])
  assert.match(calls[0].sql, /WHERE \(r\.name LIKE \? OR r\.description LIKE \?\)/)
  assert.match(calls[1].sql, /NULL as code/)
  assert.match(calls[1].sql, /1 as is_active/)
  assert.match(calls[1].sql, /LIMIT \? OFFSET \?/)
})
