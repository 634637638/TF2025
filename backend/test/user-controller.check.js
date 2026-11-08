'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const UserController = require('../src/controllers/user.controller')

const createResponse = () => ({
  status(code) { this.statusCode = code; return this },
  json(body) { this.body = body; return this }
})

test('操作员路由保留认证、候选查看权限和搜索审计并委托 controller', () => {
  const route = fs.readFileSync(path.join(__dirname, '../src/routes/users.js'), 'utf8')
  assert.match(route, /router\.get\('\/operators', unifiedAuth, requireAnyPermission\(\[[\s\S]*?'users:view',[\s\S]*?'return-goods:view'[\s\S]*?\]\), auditUnpaginatedPersonnelSearch\('users-operators'\), userController\.operators\.bind\(userController\)\)/)
})

test('员工路由保留考勤/查询授权、全量检索审计并委托 controller', () => {
  const route = fs.readFileSync(path.join(__dirname, '../src/routes/users.js'), 'utf8')
  assert.match(route, /router\.get\('\/employees', unifiedAuth, requireAnyPermission\(\['attendance:view', 'attendance:view:own', 'attendance:view:all', 'query:view'\]\), auditUnpaginatedPersonnelSearch\('users-employees'\), userController\.employees\.bind\(userController\)\)/)
})

test('用户详情路由保留认证和 users:view 权限并委托 controller', () => {
  const route = fs.readFileSync(path.join(__dirname, '../src/routes/users.js'), 'utf8')
  assert.match(route, /router\.get\('\/:id', unifiedAuth, requirePermission\('users:view'\), userController\.getById\.bind\(userController\)\)/)
})

test('用户档案路由保留认证和 users:view 权限并委托 controller', () => {
  const route = fs.readFileSync(path.join(__dirname, '../src/routes/users.js'), 'utf8')
  assert.match(route, /router\.get\('\/profile', unifiedAuth, requirePermission\('users:view'\), userController\.profile\.bind\(userController\)\)/)
})

test('用户列表路由保留认证和 users:view 权限并委托 controller', () => {
  const route = fs.readFileSync(path.join(__dirname, '../src/routes/users.js'), 'utf8')
  assert.match(route, /router\.get\('\/', unifiedAuth, requirePermission\('users:view'\), userController\.list\.bind\(userController\)\)/)
})

test('用户写入、删除和状态路由保留原权限并委托 controller', () => {
  const route = fs.readFileSync(path.join(__dirname, '../src/routes/users.js'), 'utf8')
  assert.match(route, /router\.post\('\/', unifiedAuth, requirePermission\('users:create'\), userController\.create\.bind\(userController\)\)/)
  assert.match(route, /router\.put\('\/:id', unifiedAuth, requirePermission\('users:edit'\), userController\.update\.bind\(userController\)\)/)
  assert.match(route, /router\.delete\('\/:id', unifiedAuth, requirePermission\('users:delete'\), userController\.remove\.bind\(userController\)\)/)
  assert.match(route, /router\.patch\('\/:id\/toggle', unifiedAuth, requirePermission\('users:edit'\), userController\.toggle\.bind\(userController\)\)/)
})

const createTransactionalController = ({ execute, poolExecute, connected = true, passwordHasher } = {}) => {
  const events = []
  const connection = {
    async beginTransaction() { events.push('begin') },
    async execute(query, values) {
      events.push(['execute', query, values])
      return execute ? execute(query, values) : [[], []]
    },
    async commit() { events.push('commit') },
    async rollback() { events.push('rollback') },
    release() { events.push('release') }
  }
  const pool = {
    async getConnection() { return connection },
    async execute(query, values) {
      events.push(['poolExecute', query, values])
      return poolExecute ? poolExecute(query, values) : [[], []]
    }
  }
  const controller = new UserController({
    getDatabase: () => pool,
    isConnected: () => connected,
    passwordHasher: passwordHasher || (async password => `hashed:${password}`),
    logger: { error() {} }
  })
  return { controller, connection, events }
}

test('用户创建 controller 在一个事务中创建账号和角色并只返回公开字段', async () => {
  let insertValues
  let roleValues
  let hashArgs
  const { controller, events } = createTransactionalController({
    execute: async (query, values) => {
      if (query.includes('SELECT id FROM users WHERE username')) return [[], []]
      if (query.includes('SELECT id FROM roles WHERE id IN')) return [[{ id: 3 }, { id: 8 }], []]
      if (query.includes('INSERT INTO users')) {
        insertValues = values
        return [{ insertId: 42, affectedRows: 1 }, []]
      }
      if (query.includes('INSERT INTO user_roles')) roleValues = values
      return [{ affectedRows: 1 }, []]
    },
    poolExecute: async () => [[{
      id: 42, username: 'new-user', status: 1, role: '销售员, 店长', role_ids: '3,8'
    }], []],
    passwordHasher: async (...args) => {
      hashArgs = args
      return 'hashed-password'
    }
  })
  const response = createResponse()

  await controller.create({
    body: {
      username: 'new-user', password: 'plain-password', role_ids: ['3', 8, '3'],
      status: 'active', name: '', store_id: 0, salary_template_id: 5
    }
  }, response)

  assert.equal(response.statusCode, 201)
  assert.equal(response.body.message, '用户创建成功')
  assert.deepEqual(response.body.data.role_ids, [3, 8])
  assert.equal('password' in response.body.data, false)
  assert.deepEqual(hashArgs, ['plain-password', 10])
  assert.deepEqual(insertValues, ['new-user', 'hashed-password', 'new-user', null, null, 1, null, 5])
  assert.deepEqual(roleValues, [42, 3, 42, 8])
  assert.deepEqual(events.filter(event => typeof event === 'string'), ['begin', 'commit', 'release'])
})

test('用户创建校验和写入异常都会回滚并释放连接', async () => {
  const invalidRole = createTransactionalController({
    execute: async query => {
      if (query.includes('SELECT id FROM users WHERE username')) return [[], []]
      return [[], []]
    }
  })
  const invalidResponse = createResponse()
  await invalidRole.controller.create({ body: { username: 'user', password: 'pass', role_ids: [999] } }, invalidResponse)
  assert.equal(invalidResponse.statusCode, 400)
  assert.equal(invalidResponse.body.message, '部分角色不存在')
  assert.deepEqual(invalidRole.events.filter(event => typeof event === 'string'), ['begin', 'rollback', 'release'])

  const failing = createTransactionalController({
    execute: async query => {
      if (query.includes('SELECT id FROM users WHERE username')) return [[], []]
      if (query.includes('INSERT INTO users')) throw new Error('insert failed')
      return [[], []]
    }
  })
  const failureResponse = createResponse()
  await failing.controller.create({ body: { username: 'user', password: 'pass' } }, failureResponse)
  assert.equal(failureResponse.statusCode, 500)
  assert.equal(failureResponse.body.message, '服务器内部错误，请稍后重试')
  assert.deepEqual(failing.events.filter(event => typeof event === 'string'), ['begin', 'rollback', 'release'])
})

test('用户更新 controller 同事务更新字段、密码和角色，空密码不覆盖旧密码', async () => {
  let updateValues
  let roleValues
  let hashArgs
  const { controller, events } = createTransactionalController({
    execute: async (query, values) => {
      if (query === 'SELECT id FROM users WHERE id = ?') return [[{ id: 12 }], []]
      if (query.includes('SELECT id FROM users WHERE username = ?')) return [[], []]
      if (query.includes('SELECT id FROM roles WHERE id IN')) return [[{ id: 4 }], []]
      if (query.startsWith('UPDATE users SET')) updateValues = values
      if (query.includes('INSERT INTO user_roles')) roleValues = values
      return [{ affectedRows: 1 }, []]
    },
    poolExecute: async () => [[{ id: 12, username: 'updated', role_ids: '4' }], []],
    passwordHasher: async (...args) => {
      hashArgs = args
      return 'new-hash'
    }
  })
  const response = createResponse()

  await controller.update({
    params: { id: '12' },
    body: { username: 'updated', status: 'inactive', password: 'new-password', role_ids: [4] }
  }, response)

  assert.equal(response.statusCode, 200)
  assert.equal(response.body.message, '用户更新成功')
  assert.deepEqual(hashArgs, ['new-password', 10])
  assert.deepEqual(updateValues, ['updated', 0, 'new-hash', 12])
  assert.deepEqual(roleValues, [12, 4])
  assert.deepEqual(events.filter(event => typeof event === 'string'), ['begin', 'commit', 'release'])
})

test('用户更新拒绝空更新和无效状态，并在数据库失败时回滚', async () => {
  const noOp = createTransactionalController({
    execute: async query => query.includes('SELECT id FROM users WHERE id = ?') ? [[{ id: 12 }], []] : [[], []]
  })
  const noOpResponse = createResponse()
  await noOp.controller.update({ params: { id: '12' }, body: {} }, noOpResponse)
  assert.equal(noOpResponse.statusCode, 400)
  assert.equal(noOpResponse.body.message, '没有提供要更新的字段')
  assert.deepEqual(noOp.events.filter(event => typeof event === 'string'), ['begin', 'rollback', 'release'])

  const invalid = createTransactionalController({
    execute: async query => query.includes('SELECT id FROM users WHERE id = ?') ? [[{ id: 12 }], []] : [[], []]
  })
  const invalidResponse = createResponse()
  await invalid.controller.update({ params: { id: '12' }, body: { status: 9 } }, invalidResponse)
  assert.equal(invalidResponse.statusCode, 400)
  assert.equal(invalidResponse.body.message, '用户状态必须为 0、1、active 或 inactive')
  assert.deepEqual(invalid.events.filter(event => typeof event === 'string'), ['begin', 'rollback', 'release'])

  const failing = createTransactionalController({
    execute: async query => {
      if (query.includes('SELECT id FROM users WHERE id = ?')) return [[{ id: 12 }], []]
      if (query.startsWith('UPDATE users SET')) throw new Error('update failed')
      return [[], []]
    }
  })
  const failureResponse = createResponse()
  await failing.controller.update({ params: { id: '12' }, body: { name: 'Changed' } }, failureResponse)
  assert.equal(failureResponse.statusCode, 500)
  assert.deepEqual(failing.events.filter(event => typeof event === 'string'), ['begin', 'rollback', 'release'])
})

test('用户删除和状态切换保持不存在、成功及状态反转响应', async () => {
  let currentUser = { id: 12, username: 'user12', status: 1, role_ids: [] }
  const { controller, events } = createTransactionalController({
    poolExecute: async query => {
      if (query.includes('SELECT u.id')) return [currentUser ? [{ ...currentUser }] : [], []]
      if (query.startsWith('UPDATE users SET status')) {
        currentUser = { ...currentUser, status: 0 }
        return [{ affectedRows: 1 }, []]
      }
      return [{ affectedRows: 1 }, []]
    }
  })

  const removed = createResponse()
  await controller.remove({ params: { id: '12' } }, removed)
  assert.equal(removed.statusCode, 200)
  assert.equal(removed.body.message, '用户删除成功')
  assert.equal(events.some(event => Array.isArray(event) && event[0] === 'poolExecute' && event[1].startsWith('DELETE FROM users')), true)

  const toggled = createResponse()
  await controller.toggle({ params: { id: '12' } }, toggled)
  assert.equal(toggled.statusCode, 200)
  assert.equal(toggled.body.message, '用户禁用成功')
  assert.equal(toggled.body.data.status, 0)

  currentUser = null
  const missing = createResponse()
  await controller.remove({ params: { id: '12' } }, missing)
  assert.equal(missing.statusCode, 404)
  assert.equal(missing.body.message, '用户不存在')
})

test('操作员 controller 保留搜索范围参数、字段格式和分页响应', async () => {
  let searchOptions
  let adminUser
  const controller = new UserController({
    searchOperators: async options => {
      searchOptions = options
      return {
        records: [{
          id: 8,
          name: '',
          username: 'operator8',
          phone: '13800000000',
          salary_template_id: 12,
          role_name: '销售员',
          role_codes: 'sales, cashier'
        }],
        usePagination: true,
        pagination: { page: 2, page_size: 10, total: 11, total_pages: 2, has_next: false, has_prev: true }
      }
    },
    isSuperAdmin: user => { adminUser = user; return true },
    logger: { error() {} }
  })
  const user = { id: 5, roles: ['admin'] }
  const req = {
    user,
    query: {
      keyword: 'operator', page: '2', page_size: '10', store_id: '3',
      status: '1', strict_scope: 'true'
    }
  }
  const res = createResponse()

  await controller.operators(req, res)

  assert.equal(adminUser, user)
  assert.deepEqual(searchOptions, {
    user,
    superAdmin: true,
    keyword: 'operator',
    page: '2',
    page_size: '10',
    store_id: '3',
    status: '1',
    strict_scope: 'true',
    includeDetails: true
  })
  assert.equal(res.statusCode, 200)
  assert.deepEqual(res.body.data, [{
    id: 8,
    name: 'operator8',
    username: 'operator8',
    phone: '13800000000',
    salary_template_id: 12,
    role: '销售员',
    role_codes: ['sales', 'cashier']
  }])
  assert.deepEqual(res.body.pagination, {
    page: 2, page_size: 10, total: 11, total_pages: 2, has_next: false, has_prev: true
  })
})

test('操作员搜索异常返回统一 500 响应', async () => {
  let loggedError
  const controller = new UserController({
    searchOperators: async () => { throw new Error('search failed') },
    logger: { error: (...args) => { loggedError = args } }
  })
  const res = createResponse()

  await controller.operators({ user: { id: 4 }, query: {} }, res)

  assert.equal(res.statusCode, 500)
  assert.equal(res.body.success, false)
  assert.equal(res.body.message, '服务器内部错误，请稍后重试')
  assert.equal(loggedError[0], '获取操作员列表失败:')
})

test('用户详情 controller 保留存在、缺失和 repository 异常响应', async () => {
  let result = { id: 12, username: 'user12' }
  let loggedError
  const controller = new UserController({
    userRepository: { async findUserDetailsById(id) { assert.equal(id, '12'); return result } },
    logger: { error: (...args) => { loggedError = args } }
  })

  const success = createResponse()
  await controller.getById({ params: { id: '12' } }, success)
  assert.equal(success.statusCode, 200)
  assert.deepEqual(success.body.data, result)
  assert.equal(success.body.message, '获取用户详情成功')

  result = null
  const missing = createResponse()
  await controller.getById({ params: { id: '12' } }, missing)
  assert.equal(missing.statusCode, 404)
  assert.equal(missing.body.message, '用户不存在')

  const failingController = new UserController({
    userRepository: { async findUserDetailsById() { throw new Error('repository failed') } },
    logger: { error: (...args) => { loggedError = args } }
  })
  const failure = createResponse()
  await failingController.getById({ params: { id: '12' } }, failure)
  assert.equal(failure.statusCode, 500)
  assert.equal(failure.body.message, '服务器内部错误，请稍后重试')
  assert.equal(loggedError[0], '获取用户详情失败:')
})

test('用户档案 controller 保留用户名校验、启用状态和显式响应字段', async () => {
  let requestedUsername
  let result = {
    id: 22, username: 'profile-user', name: '档案用户', status: 1,
    role: '销售员', role_ids: [3], email: 'profile@example.test', phone: '13800000000',
    store_id: 5, salary_template_id: 9, created_at: '2026-11-01', updated_at: '2026-11-02',
    secret_column: 'must not leak'
  }
  let loggedError
  const controller = new UserController({
    userRepository: {
      async findUserDetailsByUsername(username) {
        requestedUsername = username
        return result
      }
    },
    logger: { error: (...args) => { loggedError = args } }
  })

  const invalid = createResponse()
  await controller.profile({ query: {} }, invalid)
  assert.equal(invalid.statusCode, 400)
  assert.equal(requestedUsername, undefined)

  const success = createResponse()
  await controller.profile({ query: { username: 'profile-user' } }, success)
  assert.equal(requestedUsername, 'profile-user')
  assert.deepEqual(success.body.data, {
    id: 22, username: 'profile-user', name: '档案用户', role: '销售员', status: 1,
    email: 'profile@example.test', phone: '13800000000', store_id: 5,
    salary_template_id: 9, role_ids: [3], created_at: '2026-11-01', updated_at: '2026-11-02'
  })
  assert.equal('secret_column' in success.body.data, false)

  result = { id: 22, status: 0 }
  const disabled = createResponse()
  await controller.profile({ query: { username: 'profile-user' } }, disabled)
  assert.equal(disabled.statusCode, 404)
  assert.equal(disabled.body.message, '用户不存在或已禁用')

  const failingController = new UserController({
    userRepository: { async findUserDetailsByUsername() { throw new Error('repository failed') } },
    logger: { error: (...args) => { loggedError = args } }
  })
  const failure = createResponse()
  await failingController.profile({ query: { username: 'profile-user' } }, failure)
  assert.equal(failure.statusCode, 500)
  assert.equal(loggedError[0], '获取用户档案失败:')
})

test('用户 repository 按规范字段读取档案并规范化角色 ID', async () => {
  const UserRepository = require('../src/repositories/user.repository')
  const repository = new UserRepository()
  let query
  let values
  repository.executeQuery = async (sql, params) => {
    query = sql
    values = params
    return [{ id: 22, username: 'profile-user', role: '销售员', role_ids: '3,8' }]
  }

  const user = await repository.findUserDetailsByUsername('profile-user')

  assert.deepEqual(values, ['profile-user'])
  assert.match(query, /GROUP_CONCAT\(DISTINCT r\.name ORDER BY r\.id SEPARATOR ', '\) AS role/)
  assert.match(query, /GROUP_CONCAT\(DISTINCT r\.id ORDER BY r\.id SEPARATOR ','\) AS role_ids/)
  assert.deepEqual(user.role_ids, [3, 8])
})

test('用户列表 controller 保留分页上限、仓储筛选和规范响应字段', async () => {
  let repositoryArgs
  const controller = new UserController({
    userRepository: {
      async getUsers(filters, pagination) {
        repositoryArgs = { filters, pagination }
        return {
          data: [{ id: 4, username: 'user4', name: '', role: '销售员', status: 1, store_id: 0 }],
          pagination: { total: 21, total_pages: 1, has_next: false, has_prev: true }
        }
      }
    },
    logger: { error() {} }
  })
  const res = createResponse()

  await controller.list({ query: { page: '2', page_size: '50000', role: 'sales', status: '1' } }, res)

  assert.deepEqual(repositoryArgs, {
    filters: { role: 'sales', status: '1' },
    pagination: { page: 2, page_size: 1000, offset: 1000 }
  })
  assert.equal(res.statusCode, 200)
  assert.deepEqual(res.body.data, {
    users: [{ id: 4, name: 'user4', username: 'user4', role: '销售员', status: 1, store_id: null }],
    pagination: { page: 2, page_size: 1000, total: 21, total_pages: 1, has_next: false, has_prev: true }
  })
})

test('用户列表 repository 异常返回统一 500 响应', async () => {
  let loggedError
  const controller = new UserController({
    userRepository: { async getUsers() { throw new Error('repository failed') } },
    logger: { error: (...args) => { loggedError = args } }
  })
  const res = createResponse()

  await controller.list({ query: {} }, res)

  assert.equal(res.statusCode, 500)
  assert.equal(res.body.message, '服务器内部错误，请稍后重试')
  assert.equal(loggedError[0], '获取用户列表失败:')
})

test('员工 controller 按管理员权限返回门店内分页结果', async () => {
  const queries = []
  const controller = new UserController({
    getAttendanceAccessScope: async userId => {
      assert.equal(userId, 7)
      return { isAdmin: true }
    },
    hasUserPermission: async () => false,
    isSuperAdmin: () => false,
    getDatabase: () => ({
      async execute(query, values) {
        queries.push({ query, values })
        return query.includes('COUNT(*)')
          ? [[{ total: 3 }], []]
          : [[{ id: 9, name: '', username: 'ann9', status: 1, has_salary_template: 1 }], []]
      }
    }),
    logger: { error() {} }
  })
  const response = createResponse()

  await controller.employees({
    user: { id: 7, store_ids: [3] },
    query: { keyword: ' ann ', page: '2', page_size: '1', store_id: '3', strict_scope: 'true' }
  }, response)

  assert.equal(response.statusCode, 200)
  assert.equal(response.body.message, '获取员工列表成功')
  assert.deepEqual(response.body.data.employees, [{
    id: 9, name: 'ann9', username: 'ann9', status: 1, has_salary_template: true
  }])
  assert.deepEqual(response.body.data.pagination, {
    page: 2, page_size: 1, total: 3, total_pages: 3, has_next: true, has_prev: true
  })
  assert.equal(response.body.data.is_admin, true)
  assert.deepEqual(queries[0].values, ['1', '%ann%', '%ann%', '%ann%', 3, 3])
  assert.match(queries[1].query, /LIMIT 1 OFFSET 1/)
  assert.match(queries[1].query, /user_stores scope_us/)
})

test('员工 controller 普通用户只读本人，拒绝未绑定门店并校验门店参数', async () => {
  const queries = []
  const controller = new UserController({
    getAttendanceAccessScope: async () => ({ isAdmin: false }),
    hasUserPermission: async () => false,
    isSuperAdmin: () => false,
    getDatabase: () => ({
      async execute(query, values) {
        queries.push({ query, values })
        return [[{ id: 7, username: 'user7', name: null, status: 1, has_salary_template: 0 }], []]
      }
    }),
    logger: { error() {} }
  })
  const ownResponse = createResponse()
  await controller.employees({ user: { id: 7, store_ids: [] }, query: {} }, ownResponse)
  assert.equal(ownResponse.statusCode, 200)
  assert.equal(ownResponse.body.data.is_admin, false)
  assert.deepEqual(ownResponse.body.data.employees, [{
    id: 7, name: 'user7', username: 'user7', status: 1, has_salary_template: false
  }])
  assert.deepEqual(queries[0].values, [7, '1'])
  assert.match(queries[0].query, /WHERE u\.id = \? AND u\.status = \?/)
  assert.equal(ownResponse.body.data.pagination, undefined)

  const forbidden = createResponse()
  await controller.employees({
    user: { id: 7, store_ids: [3] },
    query: { store_id: '9', strict_scope: 'true' }
  }, forbidden)
  assert.equal(forbidden.statusCode, 403)
  assert.equal(forbidden.body.message, '无权访问该门店员工')
  assert.equal(queries.length, 1)

  const invalidStore = createResponse()
  await controller.employees({ user: { id: 7 }, query: { store_id: 'bad' } }, invalidStore)
  assert.equal(invalidStore.statusCode, 400)
  assert.equal(invalidStore.body.message, 'store_id 参数无效')
  assert.equal(queries.length, 1)
})

test('用户写入提交释放后才读取公开信息，详情失败不会回滚已提交事务', async () => {
  for (const operation of ['create', 'update']) {
    const fixture = createTransactionalController({
      execute: async query => {
        if (query === 'SELECT id FROM users WHERE id = ?') return [[{ id: 12 }], []]
        if (query.includes('SELECT id FROM users WHERE username')) return [[], []]
        return [{ insertId: 12, affectedRows: 1 }, []]
      },
      poolExecute: async () => {
        assert.equal(events.at(-1), 'release')
        throw new Error('public user read failed')
      }
    })
    const events = fixture.events
    const response = createResponse()
    await fixture.controller[operation]({ params: { id: '12' }, body: { username: 'new-user', password: 'test-password', name: '用户' } }, response)
    assert.equal(response.statusCode, 500)
    assert.deepEqual(events.filter(event => typeof event === 'string'), ['begin', 'commit', 'release'])
  }
})
