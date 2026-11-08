'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const AnalyticsRealtimeController = require('../src/controllers/analytics-realtime.controller')
const AnalyticsRealtimeService = require('../src/services/analytics-realtime.service')
const AnalyticsRealtimeRepository = require('../src/repositories/analytics-realtime.repository')

const response = () => ({
  status(code) { this.statusCode = code; return this },
  json(body) { this.body = body; return this }
})

test('realtime route delegates with authentication and business-user middleware', () => {
  const route = fs.readFileSync(path.join(__dirname, '../src/routes/analytics.js'), 'utf8')
  assert.match(route, /router\.get\('\/realtime', unifiedAuth, requireBusinessUser, analyticsRealtimeController\.getRealtime\.bind\(analyticsRealtimeController\)\)/)
})

test('realtime controller parses store scope and preserves response contract', async () => {
  const calls = []
  const controller = new AnalyticsRealtimeController({
    service: { async getRealtime(storeId) { calls.push(storeId); return { today_orders: 2, system_load: {}, alerts: [] } } }
  })
  const result = response()
  await controller.getRealtime({ query: { store_id: '9abc' } }, result)
  assert.deepEqual(calls, [9])
  assert.deepEqual(result.body.data, { today_orders: 2, system_load: {}, alerts: [] })
})

test('realtime service combines snapshots and bounded system metrics', async () => {
  const service = new AnalyticsRealtimeService({
    connected: () => true,
    repository: {
      async getSnapshots(storeId) {
        assert.equal(storeId, 3)
        return { sales: { total_sales: '120.50', order_count: '4' }, pending: { pending_count: '2' } }
      }
    },
    system: { cpus: () => [{}, {}], loadavg: () => [0.5], totalmem: () => 1000, freemem: () => 250 }
  })
  const result = await service.getRealtime(3)
  assert.equal(result.current_sales, 120.5)
  assert.equal(result.today_orders, 4)
  assert.equal(result.pending_orders, 2)
  assert.equal(result.system_load.cpu_percent, 25)
  assert.equal(result.system_load.memory_percent, 75)
  assert.equal(result.active_users, null)
  assert.deepEqual(result.alerts, [])
})

test('realtime service rejects unavailable database', async () => {
  const service = new AnalyticsRealtimeService({ connected: () => false, repository: {} })
  await assert.rejects(service.getRealtime(null), { statusCode: 500, message: '数据库连接失败' })
})

test('realtime repository binds optional store filters for both snapshots', async () => {
  const calls = []
  const repository = new AnalyticsRealtimeRepository(() => ({
    async execute(...args) {
      calls.push(args)
      return [[{}]]
    }
  }))
  await repository.getSnapshots(4)
  await repository.getSnapshots(null)
  assert.match(calls[0][0], /AND store_id = \?/)
  assert.deepEqual(calls[0][1], [4])
  assert.match(calls[1][0], /AND store_id = \?/)
  assert.deepEqual(calls[1][1], [4])
  assert.doesNotMatch(calls[2][0], /AND store_id = \?/)
  assert.deepEqual(calls[2][1], [])
  assert.doesNotMatch(calls[3][0], /AND store_id = \?/)
  assert.deepEqual(calls[3][1], [])
})
