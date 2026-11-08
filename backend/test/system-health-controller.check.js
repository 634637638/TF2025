'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const createResponse = () => ({
  status(code) {
    this.statusCode = code
    return this
  },
  json(body) {
    this.body = body
    return this
  }
})

test('system health routes preserve authentication and system:view permission while delegating', () => {
  const route = fs.readFileSync(path.join(__dirname, '../src/routes/system.js'), 'utf8')
  assert.match(route, /router\.get\('\/stats', unifiedAuth, requirePermission\('system:view'\), systemHealthController\.getStats\.bind\(systemHealthController\)\)/)
  assert.match(route, /router\.get\('\/status', unifiedAuth, requirePermission\('system:view'\), systemHealthController\.getStatus\.bind\(systemHealthController\)\)/)
})

test('system stats reports disconnected database and retains partial-query defaults', async () => {
  const SystemHealthController = require('../src/controllers/system-health.controller')
  const unavailableResponse = createResponse()
  const disconnected = new SystemHealthController({ service: { async getStats() { return { unavailable: true } } } })
  await disconnected.getStats({}, unavailableResponse)
  assert.equal(unavailableResponse.statusCode, 503)
  assert.equal(unavailableResponse.body.success, false)
  assert.equal(unavailableResponse.body.message, '服务器内部错误，请稍后重试')

  const response = createResponse()
  const controller = new SystemHealthController({ service: {
    async getStats() {
      return { unavailable: false, stats: { employeeCount: 4, roleCount: 2, storeCount: 0, logCount: 0 } }
    }
  } })
  await controller.getStats({}, response)
  assert.deepEqual(response.body.data, { employeeCount: 4, roleCount: 2, storeCount: 0, logCount: 0 })
})

test('system health service preserves stat query behavior and tolerates missing log table', async () => {
  const SystemHealthService = require('../src/services/system-health.service')
  const calls = []
  const service = new SystemHealthService({
    connected: () => true,
    repository: {
      async getEmployeeCount() { calls.push('employees'); return 8 },
      async getRoleCount() { calls.push('roles'); return 3 },
      async getStoreCount() { calls.push('stores'); return 2 },
      async getLogCount() { calls.push('logs'); throw new Error('table missing') }
    }
  })
  const result = await service.getStats()
  assert.deepEqual(calls, ['employees', 'roles', 'stores', 'logs'])
  assert.deepEqual(result, {
    unavailable: false,
    stats: { employeeCount: 8, roleCount: 3, storeCount: 2, logCount: 0 }
  })
})

test('system status retains database, pool, disk, memory and server response fields', async () => {
  const SystemHealthController = require('../src/controllers/system-health.controller')
  const response = createResponse()
  const status = {
    database: { status: 'online', message: '正常', details: { poolStatus: 'healthy' } },
    api: { status: 'online', message: '正常', version: '1.0.0', uptime: 12 },
    disk: { status: 'online', message: '50.0%', details: { total: '2.00 GB', used: '1.00 GB', available: '1.00 GB' } },
    memory: { status: 'warning', message: '80.0%', details: { total: '2.00 GB', used: '1.60 GB', available: '0.40 GB', processRss: '20.00 MB', processHeapUsed: '10.00 MB' } },
    server: { status: 'online', message: '正常运行', nodeVersion: 'v22', platform: 'linux' },
    timestamp: '2026-11-07T00:00:00.000Z'
  }
  const controller = new SystemHealthController({ service: { async getStatus() { return status } } })
  await controller.getStatus({}, response)
  assert.deepEqual(response.body.data, status)
})

test('system health service marks a failed pool check and unavailable disk without failing the status response', async () => {
  const SystemHealthService = require('../src/services/system-health.service')
  const service = new SystemHealthService({
    connected: () => false,
    repository: { async checkPool() { throw new Error('pool unavailable') } },
    fileSystem: { async statfs() { throw new Error('statfs unavailable') } },
    operatingSystem: { totalmem: () => 100, freemem: () => 20 },
    runtime: {
      memoryUsage: () => ({ rss: 10, heapUsed: 5 }),
      uptime: () => 3,
      version: 'v22',
      platform: 'linux'
    }
  })
  const result = await service.getStatus()
  assert.deepEqual(result.database, { status: 'offline', message: '连接失败', details: { poolStatus: 'error' } })
  assert.deepEqual(result.disk, { status: 'unknown', message: '未知', details: { total: '未知', used: '未知', available: '未知' } })
  assert.equal(result.memory.message, '80.0%')
  assert.equal(result.api.uptime, 3)
})
