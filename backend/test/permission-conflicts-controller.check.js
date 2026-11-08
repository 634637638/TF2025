'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const Controller = require('../src/controllers/permission-conflicts.controller')
const Service = require('../src/services/permission-conflicts.service')
const Repository = require('../src/repositories/permission-conflicts.repository')

const response = () => ({
  status(code) { this.statusCode = code; return this },
  json(body) { this.body = body; return this }
})

test('permission conflict route preserves admin authorization and delegates to controller', () => {
  const source = fs.readFileSync(path.join(__dirname, '../src/routes/permission-management.js'), 'utf8')
  assert.match(source, /router\.get\('\/conflicts\/check', requirePermission\('permissions:admin'\), permissionConflictsController\.check\.bind\(permissionConflictsController\)\)/)
  assert.match(source, /router\.post\('\/conflicts\/cleanup', requirePermission\('permissions:admin'\), permissionConflictsController\.cleanup\.bind\(permissionConflictsController\)\)/)
})

test('permission conflict service checks schema support and reports duplicate and orphan conflicts', async () => {
  const calls = []
  const db = { name: 'pool' }
  const duplicates = [{ role_id: 3, module_key: 'sales', permission_type: 'view', count: 2 }]
  const service = new Service({
    database: () => db,
    columnExists: async (...args) => { calls.push(['column', ...args]); return true },
    repository: {
      async getConflicts(input) {
        calls.push(['repository', input])
        return { duplicates, orphaned: [{ module_key: 'removed' }] }
      }
    }
  })

  assert.deepEqual(await service.check(), {
    duplicates,
    orphaned_modules: ['removed'],
    has_conflicts: true
  })
  assert.deepEqual(calls, [
    ['column', 'modules', 'is_active', db],
    ['repository', { supportsModuleIsActive: true }]
  ])
})

test('permission conflict repository uses the optional active-module column only when supported', async () => {
  const sql = []
  const repository = new Repository({
    database: () => ({ async execute(statement) {
      sql.push(statement)
      return [[{ module_key: 'removed' }], []]
    } })
  })

  assert.deepEqual(await repository.getConflicts({ supportsModuleIsActive: true }), {
    duplicates: [{ module_key: 'removed' }],
    orphaned: [{ module_key: 'removed' }]
  })
  assert.match(sql[0], /GROUP BY role_id, module_key, permission_type\s+HAVING count > 1/)
  assert.ok(sql[1].includes('WHERE m.`key` IS NULL OR m.is_active = 0'))
  await repository.getConflicts({ supportsModuleIsActive: false })
  assert.ok(sql[3].includes('WHERE m.`key` IS NULL'))
  assert.equal(sql[3].includes('m.is_active = 0'), false)
})

test('permission conflict controller preserves success and error response contracts', async () => {
  const success = response()
  await new Controller({ service: { async check() {
    return { duplicates: [], orphaned_modules: [], has_conflicts: false }
  } }, logger: { error() {} } }).check({}, success)
  assert.deepEqual(success.body, {
    success: true,
    message: '权限冲突检测完成',
    data: { duplicates: [], orphaned_modules: [], has_conflicts: false }
  })

  const failure = response()
  await new Controller({
    service: { async check() { throw new Error('database unavailable') } },
    logger: { error() {} }
  }).check({}, failure)
  assert.equal(failure.statusCode, 500)
  assert.deepEqual(failure.body, {
    success: false,
    message: '权限冲突检测失败: database unavailable'
  })
})

test('permission conflict cleanup controller preserves success and error response contracts', async () => {
  const success = response()
  await new Controller({ service: { async cleanup() {
    return { cleaned_duplicates: 2, cleaned_orphaned: 3 }
  } }, logger: { error() {} } }).cleanup({}, success)
  assert.deepEqual(success.body, {
    success: true,
    message: '权限冲突清理完成',
    data: { cleaned_duplicates: 2, cleaned_orphaned: 3 }
  })

  const failure = response()
  await new Controller({
    service: { async cleanup() { throw new Error('database unavailable') } },
    logger: { error() {} }
  }).cleanup({}, failure)
  assert.equal(failure.statusCode, 500)
  assert.deepEqual(failure.body, {
    success: false,
    message: '清理权限冲突失败: database unavailable'
  })
})

test('permission conflict cleanup service commits one transaction and releases the connection', async () => {
  const events = []
  const connection = {
    async beginTransaction() { events.push('begin') },
    async commit() { events.push('commit') },
    async rollback() { events.push('rollback') },
    release() { events.push('release') }
  }
  const service = new Service({
    database: () => ({ async getConnection() { events.push('acquire'); return connection } }),
    columnExists: async (table, column, db) => {
      events.push(['column', table, column, db])
      return true
    },
    repository: {
      async getDuplicatesForCleanup(db) {
        assert.equal(db, connection)
        events.push('duplicates')
        return [{ role_id: 2, module_key: 'sales', permission_type: 'view', count: 3, keep_id: 7 }]
      },
      async deleteDuplicatePermissions(db, duplicate) {
        assert.equal(db, connection)
        events.push(['delete-duplicate', duplicate.keep_id])
      },
      async deleteOrphanedPermissions(db, supportsModuleIsActive) {
        assert.equal(db, connection)
        events.push(['delete-orphaned', supportsModuleIsActive])
        return 4
      }
    }
  })

  assert.deepEqual(await service.cleanup(), { cleaned_duplicates: 2, cleaned_orphaned: 4 })
  assert.deepEqual(events.map(event => Array.isArray(event) ? event.slice(0, 3) : event), [
    'acquire', ['column', 'modules', 'is_active'], 'begin', 'duplicates',
    ['delete-duplicate', 7], ['delete-orphaned', true], 'commit', 'release'
  ])
})

test('permission conflict cleanup service rolls back and releases on repository failure', async () => {
  const events = []
  const connection = {
    async beginTransaction() { events.push('begin') },
    async commit() { events.push('commit') },
    async rollback() { events.push('rollback') },
    release() { events.push('release') }
  }
  const service = new Service({
    database: () => ({ async getConnection() { return connection } }),
    columnExists: async () => false,
    repository: { async getDuplicatesForCleanup() { throw new Error('read failed') } }
  })

  await assert.rejects(service.cleanup(), /read failed/)
  assert.deepEqual(events, ['begin', 'rollback', 'release'])
})

test('permission conflict cleanup repository binds duplicate deletion values and reports orphan count', async () => {
  const calls = []
  const repository = new Repository({ database: () => ({}) })
  const connection = { async execute(statement, params = []) {
    calls.push({ statement, params })
    if (statement.includes('HAVING count > 1')) {
      return [[{ role_id: 1, module_key: 'sales', permission_type: 'view', count: 2, keep_id: 4 }]]
    }
    return [{ affectedRows: 5 }]
  } }

  const duplicates = await repository.getDuplicatesForCleanup(connection)
  assert.match(calls[0].statement, /MIN\(id\) as keep_id/)
  assert.deepEqual(duplicates, [{ role_id: 1, module_key: 'sales', permission_type: 'view', count: 2, keep_id: 4 }])
  assert.equal(await repository.deleteDuplicatePermissions(connection, {
    role_id: 1, module_key: 'sales', permission_type: 'view', keep_id: 4
  }), 5)
  assert.deepEqual(calls[1].params, [1, 'sales', 'view', 4])
  assert.equal(await repository.deleteOrphanedPermissions(connection, false), 5)
  assert.ok(calls[2].statement.includes('WHERE m.`key` IS NULL'))
  assert.equal(calls[2].statement.includes('m.is_active = 0'), false)
})
