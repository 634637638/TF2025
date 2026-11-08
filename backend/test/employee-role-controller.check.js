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

test('employee role routes preserve their distinct permissions and delegate to controller', () => {
  const route = fs.readFileSync(path.join(__dirname, '../src/routes/employees.js'), 'utf8')
  assert.match(route, /router\.get\('\/system-roles', unifiedAuth, requirePermission\('permissions:admin'\), employeeRoleController\.systemRoles\.bind\(employeeRoleController\)\)/)
  assert.match(route, /router\.get\('\/roles', unifiedAuth, requirePermission\('employee:view'\), employeeRoleController\.list\.bind\(employeeRoleController\)\)/)
  assert.match(route, /router\.post\('\/roles', unifiedAuth, requirePermission\('employee:create'\), employeeRoleController\.create\.bind\(employeeRoleController\)\)/)
  assert.match(route, /router\.put\('\/roles\/:id', unifiedAuth, requirePermission\('employee:edit'\), employeeRoleController\.update\.bind\(employeeRoleController\)\)/)
  assert.match(route, /router\.delete\('\/roles\/:id', unifiedAuth, requirePermission\('employee:delete'\), employeeRoleController\.delete\.bind\(employeeRoleController\)\)/)
  assert.match(route, /router\.post\('\/:id\/roles', unifiedAuth, requirePermission\('employee:edit'\), employeeRoleController\.assign\.bind\(employeeRoleController\)\)/)
  assert.match(route, /router\.delete\('\/:employeeId\/roles\/:roleId', unifiedAuth, requirePermission\('employee:edit'\), employeeRoleController\.remove\.bind\(employeeRoleController\)\)/)
})

test('employee role repository retains active-role contract and user counts', async () => {
  const EmployeeRoleRepository = require('../src/repositories/employee-role.repository')
  const calls = []
  const repository = new EmployeeRoleRepository({
    database: () => ({
      async execute(sql, params) {
        calls.push({ sql, params })
        return [[{ id: 5, name: '销售', user_count: 2 }]]
      }
    })
  })

  const activeRoles = await repository.getActiveSystemRoles()
  const rolesWithUsers = await repository.getRolesWithUserCount()
  assert.deepEqual(activeRoles, [{ id: 5, name: '销售', user_count: 2 }])
  assert.deepEqual(rolesWithUsers, [{ id: 5, name: '销售', user_count: 2 }])
  assert.match(calls[0].sql, /COALESCE\(code, CONCAT\('role_', id\)\) AS role_code/)
  assert.match(calls[0].sql, /WHERE is_active = 1[\s\S]*hierarchy_level/)
  assert.match(calls[1].sql, /LEFT JOIN user_roles ur ON r\.id = ur\.role_id/)
  assert.match(calls[1].sql, /COUNT\(ur\.user_id\) as user_count/)
})

test('employee role controller preserves success response shapes and server errors', async () => {
  const EmployeeRoleController = require('../src/controllers/employee-role.controller')
  const roles = [{ id: 5, name: '销售' }]
  const controller = new EmployeeRoleController({ repository: {
    async getActiveSystemRoles() { return roles },
    async getRolesWithUserCount() { return roles }
  } })

  const systemResponse = response()
  await controller.systemRoles({}, systemResponse)
  assert.equal(systemResponse.body.success, true)
  assert.equal(systemResponse.body.message, '获取系统角色列表成功')
  assert.deepEqual(systemResponse.body.data, { roles })

  const rolesResponse = response()
  await controller.list({}, rolesResponse)
  assert.equal(rolesResponse.body.success, true)
  assert.deepEqual(rolesResponse.body.data, { roles })

  const failedController = new EmployeeRoleController({ repository: {
    async getActiveSystemRoles() { throw new Error('database unavailable') },
    async getRolesWithUserCount() { throw new Error('database unavailable') }
  } })
  const failedResponse = response()
  await failedController.list({}, failedResponse)
  assert.equal(failedResponse.statusCode, 500)
  assert.equal(failedResponse.body.success, false)
})

test('employee role repository creates, updates and deletes with parameterized SQL', async () => {
  const EmployeeRoleRepository = require('../src/repositories/employee-role.repository')
  const calls = []
  const repository = new EmployeeRoleRepository({
    database: () => ({
      async execute(sql, params = []) {
        calls.push({ sql, params })
        if (sql.startsWith('SELECT id FROM roles WHERE name = ?')) return [[], []]
        if (sql.startsWith('SELECT id FROM roles WHERE id = ?')) return [[{ id: params[0] }], []]
        if (sql.startsWith('SELECT COUNT(*) as count')) return [[{ count: 0 }], []]
        if (sql.startsWith('INSERT INTO roles')) return [{ insertId: 7 }, []]
        if (sql.startsWith('SELECT id, name, description')) return [[{ id: 7, name: '销售', description: '门店销售' }], []]
        return [{ affectedRows: 1 }, []]
      }
    })
  })

  assert.deepEqual(await repository.createRole({ name: '销售', description: '门店销售' }), {
    role: { id: 7, name: '销售', description: '门店销售' }
  })
  assert.deepEqual(await repository.updateRole({ id: '7', name: ' 销售 ', description: '门店销售' }), {
    role: { id: 7, name: '销售', description: '门店销售' }
  })
  assert.deepEqual(await repository.deleteRole('7'), { deletedId: 7 })
  assert.ok(calls.every(call => !/WHERE name = ['"]/.test(call.sql)))
  assert.ok(calls.some(call => call.sql.startsWith('UPDATE roles SET name = ?, description = ? WHERE id = ?')))
})

test('employee role controller keeps validation, conflicts, not-found, in-use and success responses', async () => {
  const EmployeeRoleController = require('../src/controllers/employee-role.controller')
  const controller = new EmployeeRoleController({ repository: {
    async createRole(input) { return input.name === '重复' ? { duplicate: true } : { role: { id: 7, ...input } } },
    async updateRole(input) {
      if (input.id === '404') return { notFound: true }
      if (input.name === '重复') return { duplicate: true }
      return { role: { id: Number(input.id), name: input.name || '销售', description: input.description } }
    },
    async deleteRole(id) {
      if (id === '404') return { notFound: true }
      if (id === 'in-use') return { inUse: true }
      return { deletedId: Number(id) }
    }
  } })

  const invalid = response()
  await controller.create({ body: { name: '  ' } }, invalid)
  assert.equal(invalid.statusCode, 400)
  assert.equal(invalid.body.message, '角色名称不能为空')

  const duplicate = response()
  await controller.create({ body: { name: '重复' } }, duplicate)
  assert.equal(duplicate.statusCode, 400)
  assert.equal(duplicate.body.message, '角色名称已存在')

  const created = response()
  await controller.create({ body: { name: '销售', description: '门店销售' } }, created)
  assert.equal(created.statusCode, 201)
  assert.equal(created.body.message, '角色创建成功')

  const missing = response()
  await controller.update({ params: { id: '404' }, body: {} }, missing)
  assert.equal(missing.statusCode, 404)

  const updated = response()
  await controller.update({ params: { id: '7' }, body: { name: '销售' } }, updated)
  assert.equal(updated.statusCode, 200)
  assert.equal(updated.body.message, '角色更新成功')

  const inUse = response()
  await controller.delete({ params: { id: 'in-use' } }, inUse)
  assert.equal(inUse.statusCode, 400)
  assert.equal(inUse.body.message, '此角色仍有用户使用，无法删除')

  const deleted = response()
  await controller.delete({ params: { id: '7' } }, deleted)
  assert.deepEqual(deleted.body.data, { id: 7 })
  assert.equal(deleted.body.message, '角色删除成功')
})

test('employee role repository replaces assignments atomically, accepts empty roles and rolls back failed writes', async () => {
  const EmployeeRoleRepository = require('../src/repositories/employee-role.repository')
  const createRepository = ({ employee = true, roles = [2, 3], failInsert = false } = {}) => {
    const calls = []
    let released = false
    const connection = {
      async beginTransaction() { calls.push('begin') },
      async commit() { calls.push('commit') },
      async rollback() { calls.push('rollback') },
      release() { released = true },
      async execute(sql, params = []) {
        calls.push({ sql, params })
        if (sql.startsWith('SELECT id FROM users')) return [employee ? [{ id: 7 }] : [], []]
        if (sql.startsWith('SELECT id FROM roles')) return [roles.map(id => ({ id })), []]
        if (sql.startsWith('INSERT INTO user_roles')) {
          if (failInsert) throw new Error('write failed')
          return [{ affectedRows: params.length / 2 }, []]
        }
        if (sql.includes('as role_names')) return [[{ id: 7, username: 'seller', name: '员工', role_names: '销售', role_ids: '2,3' }], []]
        return [{ affectedRows: 1 }, []]
      }
    }
    return {
      repository: new EmployeeRoleRepository({ database: () => ({ getConnection: async () => connection }) }),
      calls,
      isReleased: () => released
    }
  }

  const success = createRepository()
  const result = await success.repository.assignRoles(7, [2, 3])
  assert.equal(result.employee.role_ids, '2,3')
  assert.deepEqual(success.calls.filter(call => typeof call === 'string'), ['begin', 'commit'])
  assert.equal(success.isReleased(), true)
  const insert = success.calls.find(call => typeof call === 'object' && call.sql.startsWith('INSERT INTO user_roles'))
  assert.deepEqual(insert.params, [7, 2, 7, 3])

  const clear = createRepository({ roles: [] })
  assert.equal((await clear.repository.assignRoles(7, [])).employee.id, 7)
  assert.equal(clear.calls.some(call => typeof call === 'object' && call.sql.startsWith('SELECT id FROM roles')), false)
  assert.equal(clear.calls.some(call => typeof call === 'object' && call.sql.startsWith('INSERT INTO user_roles')), false)
  assert.ok(clear.calls.includes('commit'))

  const missingEmployee = createRepository({ employee: false })
  assert.deepEqual(await missingEmployee.repository.assignRoles(7, []), { notFound: true })
  assert.ok(missingEmployee.calls.includes('rollback'))
  assert.equal(missingEmployee.isReleased(), true)

  const invalidRoles = createRepository({ roles: [2] })
  assert.deepEqual(await invalidRoles.repository.assignRoles(7, [2, 3]), { invalidRoles: true })
  assert.ok(invalidRoles.calls.includes('rollback'))
  assert.equal(invalidRoles.calls.some(call => typeof call === 'object' && call.sql.startsWith('DELETE FROM user_roles')), false)

  const failedWrite = createRepository({ failInsert: true })
  await assert.rejects(failedWrite.repository.assignRoles(7, [2, 3]), /write failed/)
  assert.ok(failedWrite.calls.includes('rollback'))
  assert.equal(failedWrite.isReleased(), true)
})

test('employee role assignment and removal controllers preserve input and result responses', async () => {
  const EmployeeRoleController = require('../src/controllers/employee-role.controller')
  const calls = []
  const controller = new EmployeeRoleController({ repository: {
    async assignRoles(employeeId, roleIds) {
      calls.push(['assign', employeeId, roleIds])
      return roleIds.length ? { employee: { id: employeeId, role_ids: roleIds.join(',') } } : { employee: { id: employeeId, role_ids: null } }
    },
    async removeRole(...args) { calls.push(['remove', ...args]); return args[1] === 'missing' ? { notAssigned: true } : { removed: true } }
  } })

  const invalidId = response()
  await controller.assign({ params: { id: '0' }, body: { role_ids: [2] } }, invalidId)
  assert.equal(invalidId.statusCode, 400)
  const invalidRoles = response()
  await controller.assign({ params: { id: '7' }, body: { role_ids: [0] } }, invalidRoles)
  assert.equal(invalidRoles.statusCode, 400)

  const assigned = response()
  await controller.assign({ params: { id: '7' }, body: { role_ids: [2, '2', 3] } }, assigned)
  assert.deepEqual(calls[0], ['assign', 7, [2, 3]])
  assert.deepEqual(assigned.body.data.role_ids, [2, 3])
  const cleared = response()
  await controller.assign({ params: { id: '7' }, body: { role_ids: [] } }, cleared)
  assert.deepEqual(cleared.body.data.role_ids, [])

  const notAssigned = response()
  await controller.remove({ params: { employeeId: '7', roleId: 'missing' } }, notAssigned)
  assert.equal(notAssigned.statusCode, 400)
  const removed = response()
  await controller.remove({ params: { employeeId: '7', roleId: '2' } }, removed)
  assert.equal(removed.body.message, '角色移除成功')
})

test('employee role removal repository checks employee and assignment before deleting', async () => {
  const EmployeeRoleRepository = require('../src/repositories/employee-role.repository')
  const calls = []
  const repository = new EmployeeRoleRepository({
    database: () => ({
      async execute(sql, params = []) {
        calls.push({ sql, params })
        if (sql.startsWith('SELECT id FROM users')) return [[{ id: 7 }], []]
        if (sql.startsWith('SELECT user_id, role_id')) return [[{ user_id: 7, role_id: 2 }], []]
        return [{ affectedRows: 1 }, []]
      }
    })
  })

  assert.deepEqual(await repository.removeRole('7', '2'), { removed: true })
  assert.deepEqual(calls.map(call => call.params), [['7'], ['7', '2'], ['7', '2']])
  assert.equal(calls[2].sql, 'DELETE FROM user_roles WHERE user_id = ? AND role_id = ?')
})
