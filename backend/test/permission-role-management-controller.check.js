'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const PermissionRoleManagementController = require('../src/controllers/permission-role-management.controller')
const PermissionRoleManagementService = require('../src/services/permission-role-management.service')
const PermissionRoleManagementRepository = require('../src/repositories/permission-role-management.repository')

const response = () => ({
  statusCode: 200,
  body: null,
  status(code) { this.statusCode = code; return this },
  json(body) { this.body = body; return this }
})

test('role lifecycle routes keep admin permission and delegate to the role controller', () => {
  const route = fs.readFileSync(path.join(__dirname, '../src/routes/permission-management.js'), 'utf8')
  for (const [method, routePath, action] of [
    ['post', '/roles', 'create'],
    ['put', '/roles/:id', 'update'],
    ['delete', '/roles/:id', 'remove'],
    ['put', '/roles/:id/status', 'updateStatus']
  ]) {
    assert.match(route, new RegExp(`router\\.${method}\\('${routePath.replaceAll('/', '\\/')}', requirePermission\\('permissions:admin'\\), permissionRoleManagementController\\.${action}\\.bind\\(permissionRoleManagementController\\)\\)`))
  }
})

test('role controller maps service results and domain errors to the established HTTP contract', async () => {
  const calls = []
  const controller = new PermissionRoleManagementController({
    service: {
      async create(input, req) { calls.push(['create', input, req]); return { id: 9, name: 'staff' } },
      async update(id, input, req) { calls.push(['update', id, input, req]); return { id: 9, name: 'staff' } },
      async remove(id, req) { calls.push(['remove', id, req]) }
    },
    logger: { error() {} }
  })
  const req = { params: { id: '9' }, body: { name: 'staff' } }
  const created = response()
  await controller.create(req, created)
  assert.deepEqual(created.body, { success: true, message: '角色创建成功', data: { id: 9, name: 'staff' } })
  const updated = response()
  await controller.update(req, updated)
  assert.deepEqual(updated.body, { success: true, message: '角色更新成功', data: { id: 9, name: 'staff' } })
  const removed = response()
  await controller.remove(req, removed)
  assert.deepEqual(removed.body, { success: true, message: '角色删除成功' })
  assert.deepEqual(calls.map(call => call[0]), ['create', 'update', 'remove'])

  const invalidController = new PermissionRoleManagementController({
    service: { async create() { throw Object.assign(new Error('角色名称不能为空'), { statusCode: 400 }) } },
    logger: { error() {} }
  })
  const invalid = response()
  await invalidController.create({ body: {} }, invalid)
  assert.equal(invalid.statusCode, 400)
  assert.equal(invalid.body.message, '创建角色失败: 角色名称不能为空')
})

test('role service validates duplicate names/codes and creates a stable fallback code', async () => {
  const auditEntries = []
  let inserted
  const repository = {
    async findByName() { return [] },
    async findByCode() { return [] },
    async create(input) { inserted = input; return { id: 13, ...input, code: input.code || 'role_13' } }
  }
  const service = new PermissionRoleManagementService({
    repository,
    inspectColumn: async (_table, column) => column === 'code',
    audit: { async logRoleOperation(...args) { auditEntries.push(args) } }
  })
  const req = { user: { id: 2 } }
  const role = await service.create({ name: '  staff ', description: '  staff role ', code: '' }, req)
  assert.deepEqual(inserted, { name: 'staff', description: 'staff role', code: null, supportsRoleCode: true })
  assert.equal(role.code, 'role_13')
  assert.equal(auditEntries[0][1], 'create')

  const duplicateName = new PermissionRoleManagementService({
    repository: { async findByName() { return [{ id: 1 }] } },
    inspectColumn: async () => false,
    audit: { async logRoleOperation() {} }
  })
  await assert.rejects(duplicateName.create({ name: 'staff', description: 'role' }, req), { statusCode: 400, message: '角色名称已存在' })
})

test('role service keeps code immutable, validates role types, and prevents deleting assigned roles', async () => {
  const auditEntries = []
  const baseRole = { id: 4, name: 'staff', description: 'role', role_type: 'employee', code: 'staff' }
  const repository = {
    async findById() { return baseRole },
    async findByName() { return [] },
    async update(input) { auditEntries.push(['update', input]) },
    async remove() { return { role: baseRole, usersCount: 1 } }
  }
  const service = new PermissionRoleManagementService({
    repository,
    inspectColumn: async (_table, column) => column === 'code' || column === 'role_type',
    audit: { async logRoleOperation(...args) { auditEntries.push(args) } }
  })
  await assert.rejects(service.update('4', { name: 'staff', description: 'role', code: 'changed' }, {}), {
    statusCode: 400,
    message: '角色编码创建后不可修改'
  })
  await assert.rejects(service.update('4', { name: 'staff', description: 'role', role_type: 'unknown' }, {}), {
    statusCode: 400,
    message: '无效的角色类型'
  })
  await assert.rejects(service.remove('4', {}), {
    statusCode: 400,
    message: '无法删除该角色，仍有用户使用该角色'
  })
  assert.equal(auditEntries.length, 0)
})

test('role status disables users refresh tokens, protects system roles, and audits only changes', async () => {
  const calls = []
  const auditEntries = []
  const warnings = []
  let role = { id: 2, name: 'manager', is_active: 1 }
  const repository = {
    async findStatusById() { return role },
    async updateStatus(id, status) { calls.push(['status', id, status]) },
    async listUserIdsByRole() { return [12, 13] },
    async deleteRefreshTokens(ids) { calls.push(['tokens', ids]); const error = new Error('missing'); error.code = 'ER_NO_SUCH_TABLE'; throw error }
  }
  const service = new PermissionRoleManagementService({
    repository,
    inspectColumn: async () => true,
    audit: { async logRoleOperation(...args) { auditEntries.push(args) } },
    logger: { warn(message) { warnings.push(message) } }
  })
  const result = await service.updateStatus('2', { is_active: '0' }, {})
  assert.deepEqual(result, { action: '停用', affected_users: 2 })
  assert.deepEqual(calls, [['status', '2', '0'], ['tokens', [12, 13]]])
  assert.equal(warnings.length, 1)
  assert.equal(auditEntries[0][4].audit_type, 'role_status')
  assert.equal(auditEntries[0][4].affected_users, 2)

  role = { id: 2, name: 'manager', is_active: 0 }
  await service.updateStatus('2', { is_active: '0' }, {})
  assert.equal(auditEntries.length, 1)

  role = { id: 1, name: 'root', is_active: 1 }
  await assert.rejects(service.updateStatus('1', { is_active: '0' }, {}), {
    statusCode: 403,
    message: '系统角色不能停用'
  })
  await assert.rejects(service.updateStatus('2', { is_active: 0 }, {}), {
    statusCode: 400,
    message: '状态值必须是0或1'
  })
})

test('role repository binds lifecycle updates and refresh-token cleanup parameters', async () => {
  const calls = []
  const database = {
    async execute(sql, params = []) {
      calls.push([sql.replace(/\s+/g, ' ').trim(), params])
      if (sql.includes('SELECT id FROM roles WHERE name')) return [[{ id: 1 }]]
      if (sql.includes('SELECT DISTINCT u.id')) return [[{ id: 12 }, { id: 13 }]]
      if (sql.includes('SELECT id, name, is_active')) return [[{ id: 2, name: 'manager', is_active: 1 }]]
      if (sql.includes('SELECT name FROM roles')) return [[{ name: 'manager' }]]
      if (sql.includes('COUNT(*) as count')) return [[{ count: 0 }]]
      return [{ insertId: 17, affectedRows: 1 }]
    }
  }
  const repository = new PermissionRoleManagementRepository({ database: () => database })
  assert.deepEqual(await repository.findByName('manager', 2), [{ id: 1 }])
  await repository.updateStatus(2, '0')
  assert.deepEqual(await repository.listUserIdsByRole(2), [12, 13])
  await repository.deleteRefreshTokens([12, 13])
  assert.deepEqual(calls[0][1], ['manager', 2])
  assert.deepEqual(calls[1][1], ['0', 2])
  assert.deepEqual(calls[2][1], [2])
  assert.match(calls[3][0], /user_id IN \(\?,\?\)/)
  assert.deepEqual(calls[3][1], [12, 13])
})
