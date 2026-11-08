'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const Controller = require('../src/controllers/user-role-assignment.controller')
const Service = require('../src/services/user-role-assignment.service')
const Repository = require('../src/repositories/user-role-assignment.repository')

const routeSource = fs.readFileSync(path.join(__dirname, '../src/routes/permission-management.js'), 'utf8')

test('user role assignment route keeps admin permission and delegates to its controller', () => {
  assert.match(routeSource, /router\.put\('\/users\/:id\/roles', requirePermission\('permissions:admin'\), userRoleAssignmentController\.assign\.bind\(userRoleAssignmentController\)\)/)
})

test('user role assignment controller preserves validation and HTTP response contracts', async () => {
  const errors = []
  const assigned = []
  const controller = new Controller({
    service: { async assign(input) {
      assigned.push(input)
      if (input.userId === 404) return { status: 'not_found' }
      if (input.userId === 422) return { status: 'invalid_roles' }
      if (input.userId === 500) throw new Error('database failure')
      return { status: 'updated' }
    } },
    logger: { error(...args) { errors.push(args) } }
  })
  const response = () => ({
    status(code) { this.statusCode = code; return this },
    json(body) { this.body = body; return this }
  })

  const invalidUser = response()
  await controller.assign({ params: { id: '0' }, body: { role_ids: [] } }, invalidUser)
  assert.equal(invalidUser.statusCode, 400)
  assert.deepEqual(invalidUser.body, { success: false, message: '用户ID无效' })
  assert.equal(assigned.length, 0)

  for (const [id, roleIds, statusCode, message] of [
    ['1', null, 400, '角色ID列表必须是数组'],
    ['1', [1, 'bad'], 400, '角色ID列表包含无效值']
  ]) {
    const invalid = response()
    await controller.assign({ params: { id }, body: { role_ids: roleIds } }, invalid)
    assert.equal(invalid.statusCode, statusCode)
    assert.equal(invalid.body.message, message)
  }

  for (const [id, statusCode, message] of [
    ['404', 404, '用户不存在'],
    ['422', 400, '部分角色ID无效']
  ]) {
    const result = response()
    await controller.assign({ params: { id }, body: { role_ids: [] } }, result)
    assert.equal(result.statusCode, statusCode)
    assert.equal(result.body.message, message)
  }

  const success = response()
  const request = { params: { id: '8' }, body: { role_ids: [2, '2', 4] } }
  await controller.assign(request, success)
  assert.deepEqual(success.body, { success: true, message: '用户角色分配成功' })
  assert.equal(assigned.at(-1).requestContext, request)

  const failure = response()
  await controller.assign({ params: { id: '500' }, body: { role_ids: [] } }, failure)
  assert.equal(failure.statusCode, 500)
  assert.deepEqual(failure.body, { success: false, message: '分配用户角色失败' })
  assert.equal(errors.length, 1)
})

test('user role assignment service replaces roles transactionally and audits after releasing the connection', async () => {
  const calls = []
  const connection = {
    async beginTransaction() { calls.push('begin') },
    async commit() { calls.push('commit') },
    async rollback() { calls.push('rollback') },
    release() { calls.push('release') }
  }
  const service = new Service({
    databaseProvider: () => ({ async getConnection() { return connection } }),
    repository: {
      async findUser(conn, userId) { assert.equal(conn, connection); assert.equal(userId, 8); calls.push('user'); return { id: 8, username: 'staff' } },
      async listPreviousRoles() { calls.push('previous'); return [{ id: 1, name: '旧角色' }] },
      async listExistingRoleIds(conn, roleIds) { calls.push(`validate:${roleIds.join(',')}`); return roleIds },
      async removeUserRoles() { calls.push('delete') },
      async assignUserRoles(conn, userId, roleIds) { calls.push(`insert:${userId}:${roleIds.join(',')}`) }
    },
    permissionLogs: { async logUserRoleOperation(...args) { calls.push('audit'); assert.equal(args[1], 8); assert.deepEqual(args[3], [2, 4]); assert.deepEqual(args[4].previous_role_names, ['旧角色']) } },
    logger: { error() {} }
  })

  const requestContext = { user: { id: 1 } }
  assert.deepEqual(await service.assign({ userId: 8, roleIds: [2, '2', 4], requestContext }), { status: 'updated' })
  assert.deepEqual(calls, ['begin', 'user', 'previous', 'validate:2,4', 'delete', 'insert:8:2,4', 'commit', 'release', 'audit'])
})

test('user role assignment service rolls back missing users and invalid roles and releases the connection', async () => {
  for (const [user, requestedRoleIds, validRoleIds, expected, expectedCalls] of [
    [null, [], [], 'not_found', ['begin', 'user', 'rollback', 'release']],
    [{ id: 8 }, [], [], 'updated', ['begin', 'user', 'previous', 'delete', 'insert', 'commit', 'release', 'audit']],
    [{ id: 8 }, [2], [], 'invalid_roles', ['begin', 'user', 'previous', 'rollback', 'release']]
  ]) {
    const calls = []
    const connection = {
      async beginTransaction() { calls.push('begin') },
      async commit() { calls.push('commit') },
      async rollback() { calls.push('rollback') },
      release() { calls.push('release') }
    }
    const service = new Service({
      databaseProvider: () => ({ async getConnection() { return connection } }),
      repository: {
        async findUser() { calls.push('user'); return user },
        async listPreviousRoles() { calls.push('previous'); return [] },
        async listExistingRoleIds() { return validRoleIds },
        async removeUserRoles() { calls.push('delete') },
        async assignUserRoles() { calls.push('insert') }
      },
      permissionLogs: { async logUserRoleOperation() { calls.push('audit') } },
      logger: { error() {} }
    })
    assert.deepEqual(await service.assign({ userId: 8, roleIds: requestedRoleIds, requestContext: {} }), { status: expected })
    assert.deepEqual(calls, expectedCalls)
  }
})

test('user role assignment repository binds IDs and builds only placeholder lists dynamically', async () => {
  const calls = []
  const repository = new Repository()
  const connection = { async execute(sql, params) {
    calls.push({ sql, params })
    return sql.startsWith('SELECT id, username') ? [[{ id: 8, username: 'staff' }]]
      : sql.startsWith('SELECT id FROM roles') ? [[{ id: 2 }, { id: 4 }]]
        : sql.startsWith('SELECT r.id') ? [[{ id: 1, name: '旧角色' }]] : [[]]
  } }

  assert.deepEqual(await repository.findUser(connection, 8), { id: 8, username: 'staff' })
  assert.deepEqual(await repository.listPreviousRoles(connection, 8), [{ id: 1, name: '旧角色' }])
  assert.deepEqual(await repository.listExistingRoleIds(connection, [2, 4]), [2, 4])
  await repository.removeUserRoles(connection, 8)
  await repository.assignUserRoles(connection, 8, [2, 4])
  assert.deepEqual(calls[0].params, [8])
  assert.deepEqual(calls[2].params, [2, 4])
  assert.match(calls[2].sql, /id IN \(\?,\?\)/)
  assert.deepEqual(calls.at(-1).params, [8, 2, 8, 4])
  assert.match(calls.at(-1).sql, /VALUES \(\?, \?\),\(\?, \?\)/)
})
