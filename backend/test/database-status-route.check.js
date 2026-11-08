const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = path.resolve(__dirname, '..')

test('数据库状态 repository 查询连接、表总数及字段权限表状态', async () => {
  const DatabaseStatusRepository = require('../src/repositories/database-status.repository')
  const queries = []
  const database = {
    async execute(sql) {
      queries.push(sql)
      if (sql === 'SHOW TABLES') {
        return [[{ Tables_in_test: 'users' }, { Tables_in_test: 'roles' }], []]
      }
      if (sql.includes('field_scan_logs')) {
        throw new Error('table unavailable')
      }
      if (sql.startsWith('SELECT COUNT(*)')) {
        return [[{ count: 3 }], []]
      }
      return [[{ connected: 1 }], []]
    }
  }

  const repository = new DatabaseStatusRepository(database)
  const result = await repository.getStatus()

  assert.equal(result.connected, true)
  assert.equal(result.totalTables, 2)
  assert.deepEqual(result.fieldTables.field_definitions, { exists: true, count: 3 })
  assert.deepEqual(result.fieldTables.field_scan_logs, {
    exists: false,
    count: 0,
    error: 'table unavailable'
  })
  assert.equal(queries.length, 7)
  assert.ok(queries.every(sql => !sql.includes(';')))
})

test('数据库状态 controller 保持原成功与连接失败响应', async () => {
  const DatabaseStatusController = require('../src/controllers/database-status.controller')
  assert.doesNotThrow(() => new DatabaseStatusController())
  const expected = { connected: true, totalTables: 2, fieldTables: {} }
  const controller = new DatabaseStatusController({ getStatus: async () => expected })
  const successResponse = {
    json(body) {
      this.body = body
      return this
    }
  }

  await controller.getStatus({}, successResponse)
  assert.deepEqual(successResponse.body, { success: true, data: expected })

  const failingController = new DatabaseStatusController({
    async getStatus() {
      throw new Error('connection refused')
    }
  })
  const failureResponse = {
    status(code) {
      this.statusCode = code
      return this
    },
    json(body) {
      this.body = body
      return this
    }
  }

  await failingController.getStatus({}, failureResponse)
  assert.equal(failureResponse.statusCode, 500)
  assert.deepEqual(failureResponse.body, {
    success: false,
    message: '数据库连接失败',
    error: 'connection refused'
  })
})

test('数据库状态 service 将状态查询委托给 repository', async () => {
  const DatabaseStatusService = require('../src/services/database-status.service')
  const expected = { connected: true, totalTables: 2, fieldTables: {} }
  const calls = []
  const service = new DatabaseStatusService({
    async getStatus() {
      calls.push('getStatus')
      return expected
    }
  })

  assert.equal(await service.getStatus(), expected)
  assert.deepEqual(calls, ['getStatus'])
})

test('数据库状态 route 保留认证、系统查看权限并委托 controller', () => {
  const routeSource = fs.readFileSync(path.join(root, 'src/routes/dbStatus.js'), 'utf8')

  assert.match(routeSource, /router\.get\('\/status',\s*unifiedAuth,\s*requirePermission\('system:view'\),\s*databaseStatusController\.getStatus\.bind\(databaseStatusController\)\)/)
})
