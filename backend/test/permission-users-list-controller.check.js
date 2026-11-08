'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const Controller = require('../src/controllers/permission-users-list.controller')
const Service = require('../src/services/permission-users-list.service')
const Repository = require('../src/repositories/permission-users-list.repository')

const response = () => ({
  status(code) { this.statusCode = code; return this },
  json(body) { this.body = body; return this }
})

test('users with roles route retains admin permission and delegates to controller', () => {
  const route = fs.readFileSync(path.join(__dirname, '../src/routes/permission-management.js'), 'utf8')
  assert.match(route, /router\.get\('\/users-with-roles', requirePermission\('permissions:admin'\), permissionUsersListController\.list\.bind\(permissionUsersListController\)\)/)
})

test('users with roles controller preserves pagination response and legacy error fallback', async () => {
  const controller = new Controller({
    service: { async list(query) {
      assert.deepEqual(query, { page: '2' })
      return { users: [{ id: 4, role_ids: '2,3' }], total: 21, page: 2, page_size: 10, total_pages: 3, has_next: true, has_prev: true }
    } },
    logger: { error() {} }
  })
  const success = response()
  await controller.list({ query: { page: '2' } }, success)
  assert.deepEqual(success.body, {
    success: true,
    message: '获取用户角色列表成功',
    data: { users: [{ id: 4, role_ids: '2,3' }], total: 21, page: 2, page_size: 10, total_pages: 3, has_next: true, has_prev: true }
  })

  const failed = new Controller({ service: { async list() { throw new Error('query failed') } }, logger: { error() {} } })
  const failure = response()
  await failed.list({ query: {} }, failure)
  assert.equal(failure.statusCode, 500)
  assert.deepEqual(failure.body, {
    success: false,
    message: '获取用户角色列表失败: query failed',
    data: { users: [], total: 0, page: 1, page_size: 10, total_pages: 0, has_next: false, has_prev: false }
  })
})

test('users with roles service normalizes filters and bounds pagination before schema checks', async () => {
  const calls = []
  const service = new Service({
    columnExists: async (table, column) => { calls.push(`schema:${table}.${column}`); return column === 'status' },
    repository: { async list(input) {
      calls.push(input)
      return { users: [], total: 501 }
    } }
  })
  const result = await service.list({
    search: `  ${'a'.repeat(120)}  `,
    role_id: '5junk',
    store_id: '8',
    has_store: 'false',
    page: '3',
    page_size: '9000',
    include_stores: 'true'
  })

  assert.deepEqual(calls.slice(0, 2), ['schema:users.status', 'schema:users.last_login'])
  assert.deepEqual(calls[2], {
    search: 'a'.repeat(100), roleId: 5, storeId: 8, hasStore: 'false',
    page: 3, pageSize: 500, includeStores: true,
    supportsUserStatus: true, supportsUserLastLogin: false
  })
  assert.deepEqual(result, { users: [], total: 501, page: 3, page_size: 500, total_pages: 2, has_next: false, has_prev: true })
})

test('users with roles service keeps defaults and ignores invalid optional filters', async () => {
  let input
  const service = new Service({
    columnExists: async () => false,
    repository: { async list(value) { input = value; return { users: [], total: 0 } } }
  })
  await service.list({ role_id: '-1', store_id: '0', has_store: 'yes', page: '-2', page_size: '0', include_stores: true })
  assert.deepEqual(input, {
    search: '', roleId: null, storeId: null, hasStore: null,
    page: 1, pageSize: 50, includeStores: true,
    supportsUserStatus: false, supportsUserLastLogin: false
  })
})

test('users with roles repository binds search, role, store and pagination and groups optional store rows', async () => {
  const calls = []
  const database = {
    async execute(sql, params) {
      calls.push({ method: 'execute', sql, params })
      if (sql.includes('COUNT(*)')) return [[{ total: 21 }]]
      return [[
        { user_id: 7, id: 3, store_id: 2, is_primary: 1, store_name: '中心店' },
        { user_id: 7, id: 4, store_id: 5, is_primary: 0, store_name: '分店' }
      ]]
    },
    async query(sql, params) {
      calls.push({ method: 'query', sql, params })
      return [[{ id: 7, username: 'seller', role_ids: '2,3' }]]
    }
  }
  const repository = new Repository({ database: () => database })
  const result = await repository.list({
    search: 'seller', roleId: 3, storeId: 2, hasStore: 'true', page: 2, pageSize: 10,
    includeStores: true, supportsUserStatus: false, supportsUserLastLogin: true
  })

  assert.equal(result.total, 21)
  assert.deepEqual(result.users[0].stores.map(store => store.store_name), ['中心店', '分店'])
  assert.match(calls[0].sql, /u\.username LIKE \?.*EXISTS \(SELECT 1 FROM user_roles/)
  assert.match(calls[0].sql, /EXISTS \(SELECT 1 FROM user_stores filter_us WHERE filter_us\.user_id = u\.id AND filter_us\.store_id = \?\)/)
  assert.match(calls[0].sql, /EXISTS \(SELECT 1 FROM user_stores filter_us WHERE filter_us\.user_id = u\.id\)/)
  assert.deepEqual(calls[0].params, ['%seller%', '%seller%', '%seller%', 3, 2])
  assert.match(calls[1].sql, /1 as status/)
  assert.match(calls[1].sql, /u\.last_login/)
  assert.match(calls[1].sql, /GROUP_CONCAT\(r\.id SEPARATOR ','\) as role_ids/)
  assert.deepEqual(calls[1].params, ['%seller%', '%seller%', '%seller%', 3, 2, 10, 10])
  assert.match(calls[2].sql, /WHERE us\.user_id IN \(\?\)/)
  assert.deepEqual(calls[2].params, [7])
})

test('users with roles repository skips store query unless requested and users are present', async () => {
  const calls = []
  const repository = new Repository({ database: () => ({
    async execute(sql, params) { calls.push({ method: 'execute', sql, params }); return [[{ total: 0 }]] },
    async query(sql, params) { calls.push({ method: 'query', sql, params }); return [[]] }
  }) })
  await repository.list({
    search: '', roleId: null, storeId: null, hasStore: null, page: 1, pageSize: 50,
    includeStores: true, supportsUserStatus: true, supportsUserLastLogin: true
  })
  assert.equal(calls.length, 2)
})
