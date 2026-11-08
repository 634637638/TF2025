'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const AuthInitializationService = require('../src/services/auth-initialization.service')

const createConnection = ({ existingAdmin = false, failOnUserInsert = false } = {}) => {
  const calls = []
  return {
    calls,
    async beginTransaction() { calls.push(['begin']) },
    async commit() { calls.push(['commit']) },
    async rollback() { calls.push(['rollback']) },
    release() { calls.push(['release']) },
    async execute(sql, params) {
      calls.push(['execute', sql, params])
      if (sql.includes('SELECT id FROM users')) return [existingAdmin ? [{ id: 1 }] : []]
      if (sql.includes('SELECT id FROM roles')) return [[{ id: 3 }]]
      if (sql.includes('SELECT 1 FROM user_roles')) return [[]]
      if (sql.startsWith('INSERT INTO `users`') && failOnUserInsert) throw new Error('insert failed')
      if (sql.startsWith('INSERT INTO `users`')) return [{ insertId: 12 }]
      return [{}]
    }
  }
}

test('admin initialization creates user and role binding in one transaction and releases connection', async () => {
  const connection = createConnection()
  let hashArgs
  const service = new AuthInitializationService({
    database: () => ({ async getConnection() { return connection } }),
    inspectColumn: async (table, column) => (
      (table === 'users' && ['role', 'role_id'].includes(column))
      || (table === 'roles' && column === 'code')
    ),
    hashPassword: async (...args) => {
      hashArgs = args
      return 'hashed-password'
    },
    passwordValidator: () => ({ valid: true, errors: [] }),
    getConfiguredPassword: () => 'Configured-Pass-123!'
  })

  const result = await service.initializeAdmin()
  assert.deepEqual(result, {
    id: 12,
    password: 'Configured-Pass-123!',
    passwordSource: 'env',
    roleId: 3
  })
  assert.deepEqual(hashArgs, ['Configured-Pass-123!', 12])
  assert.ok(connection.calls.some(([kind, sql]) => kind === 'execute' && sql.startsWith('INSERT INTO `users`')))
  assert.ok(connection.calls.some(([kind, sql]) => kind === 'execute' && sql.startsWith('INSERT INTO `user_roles`')))
  assert.deepEqual(connection.calls.slice(-2), [['commit'], ['release']])
  assert.equal(connection.calls.filter(([kind]) => kind === 'begin').length, 1)
})

test('admin initialization rolls back an existing admin and always releases the connection', async () => {
  const connection = createConnection({ existingAdmin: true })
  const service = new AuthInitializationService({
    database: () => ({ async getConnection() { return connection } })
  })
  assert.deepEqual(await service.initializeAdmin(), { exists: true })
  assert.deepEqual(connection.calls.slice(-2), [['rollback'], ['release']])
  assert.equal(connection.calls.some(([, sql]) => typeof sql === 'string' && sql.startsWith('INSERT INTO')), false)
})

test('admin initialization rolls back failed writes and releases the connection', async () => {
  const connection = createConnection({ failOnUserInsert: true })
  const service = new AuthInitializationService({
    database: () => ({ async getConnection() { return connection } }),
    inspectColumn: async () => false,
    hashPassword: async () => 'hashed',
    passwordValidator: () => ({ valid: true, errors: [] }),
    getConfiguredPassword: () => 'Configured-Pass-123!'
  })
  await assert.rejects(service.initializeAdmin(), /insert failed/)
  assert.deepEqual(connection.calls.slice(-2), [['rollback'], ['release']])
})

test('admin initialization rejects a weak configured password before inserting a user', async () => {
  const connection = createConnection()
  const service = new AuthInitializationService({
    database: () => ({ async getConnection() { return connection } }),
    inspectColumn: async () => false,
    passwordValidator: () => ({ valid: false, errors: ['too short'] }),
    getConfiguredPassword: () => 'weak'
  })
  await assert.rejects(service.initializeAdmin(), /INIT_ADMIN_PASSWORD 不符合安全要求/)
  assert.equal(connection.calls.some(([, sql]) => typeof sql === 'string' && sql.startsWith('INSERT INTO `users`')), false)
  assert.deepEqual(connection.calls.slice(-2), [['rollback'], ['release']])
})
