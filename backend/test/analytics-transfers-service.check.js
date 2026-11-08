'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const AnalyticsTransfersService = require('../src/services/analytics-transfers.service')
const AnalyticsTransfersRepository = require('../src/repositories/analytics-transfers.repository')

test('transfer analytics validates dates and preserves response shape and date range', async () => {
  const repositoryCalls = []
  const service = new AnalyticsTransfersService({
    connected: () => true,
    logger: { debug() {} },
    repository: {
      async getAnalytics(filters) {
        repositoryCalls.push(filters)
        return {
          wholesale: [{ count: '2', amount: '30.5', profit: '8.5' }],
          allocation: [{ count: '3', amount: '12' }],
          trends: [{ date: '2026-04-02', wholesale_count: '1', allocation_count: '2' }],
          wholesaleRanks: [], allocationRanks: [], stores: [], records: []
        }
      }
    }
  })

  const result = await service.getAnalytics({ start_date: '2026-04-01', end_date: '2026-04-30', store_id: '7' })
  assert.deepEqual(repositoryCalls, [{ startDate: '2026-04-01', endDate: '2026-04-30', storeId: 7 }])
  assert.deepEqual(result.transfer, {
    transfer_count: 5, inbound_count: 3, outbound_count: 2, pending_count: 0, transfer_growth: 0
  })
  assert.deepEqual(result.month_range, { start: '2026-04-01', end: '2026-04-30' })
  assert.deepEqual(result.trends, [{ date: '2026-04-02', wholesale: 1, allocation: 2 }])
})

test('transfer analytics rejects malformed dates before querying and reports database unavailability', async () => {
  let queries = 0
  const repository = { async getAnalytics() { queries += 1; return {} } }
  const service = new AnalyticsTransfersService({ repository, connected: () => true, logger: { debug() {} } })
  await assert.rejects(service.getAnalytics({ start_date: '2026-02-30' }), { code: 'INVALID_DATE', statusCode: 400 })
  assert.equal(queries, 0)

  const offlineService = new AnalyticsTransfersService({ repository, connected: () => false, logger: { debug() {} } })
  await assert.rejects(offlineService.getAnalytics({}), { code: 'DATABASE_UNAVAILABLE', statusCode: 503 })
  assert.equal(queries, 0)
})

test('transfer repository binds date and store values for all seven parallel queries', async () => {
  const calls = []
  const repository = new AnalyticsTransfersRepository({
    database: () => ({
      async execute(query, params) {
        calls.push({ query, params })
        return [[]]
      }
    })
  })
  await repository.getAnalytics({ startDate: '2026-04-01', endDate: '2026-04-30', storeId: 7 })
  assert.equal(calls.length, 7)
  assert.deepEqual(calls.map(call => call.params), [
    ['2026-04-01', '2026-04-30', 7],
    ['2026-04-01', '2026-04-30', 7],
    ['2026-04-01', '2026-04-30', 7, '2026-04-01', '2026-04-30', 7],
    ['2026-04-01', '2026-04-30', 7],
    ['2026-04-01', '2026-04-30', 7],
    ['2026-04-01', '2026-04-30', '2026-04-01', '2026-04-30', 7],
    ['2026-04-01', '2026-04-30', '2026-04-01', '2026-04-30', 7]
  ])
  assert.ok(calls.every(call => !/DATE\(p\.(?:wholesale_date|inventory_time)\).*\$\{/.test(call.query)))
})
