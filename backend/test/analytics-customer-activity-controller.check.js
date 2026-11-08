'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const Controller = require('../src/controllers/analytics-customer-activity.controller')
const Service = require('../src/services/analytics-customer-activity.service')
const Repository = require('../src/repositories/analytics-customer-activity.repository')

const response = () => ({
  status(code) { this.statusCode = code; return this },
  json(body) { this.body = body; return this }
})

test('customer activity route keeps authentication and delegates to controller', () => {
  const route = fs.readFileSync(path.join(__dirname, '../src/routes/analytics.js'), 'utf8')
  assert.match(route, /router\.get\('\/customers\/activity', unifiedAuth, requireBusinessUser, analyticsCustomerActivityController\.getActivity\.bind\(analyticsCustomerActivityController\)\)/)
})

test('customer activity controller preserves store filter, response contract and database error', async () => {
  const calls = []
  const controller = new Controller({ service: { async getActivity(input) {
    calls.push(input)
    return { active_rate: 50, distribution: [], weekly_activity: [] }
  } } })
  const result = response()
  await controller.getActivity({ query: { store_id: '8abc' } }, result)
  assert.deepEqual(calls, [{ storeId: 8 }])
  assert.deepEqual(result.body.data, { active_rate: 50, distribution: [], weekly_activity: [] })
  assert.equal(result.body.message, '获取客户活跃度成功')

  const unavailable = response()
  const failedController = new Controller({ service: { async getActivity() {
    throw Object.assign(new Error('数据库连接失败'), { statusCode: 500 })
  } } })
  await failedController.getActivity({ query: {} }, unavailable)
  assert.equal(unavailable.statusCode, 500)
  assert.equal(unavailable.body.message, '服务器内部错误，请稍后重试')
})

test('customer activity service returns all levels, a rounded rate and seven weekday rows', async () => {
  const service = new Service({
    connected: () => true,
    repository: { async getActivity(storeId) {
      assert.equal(storeId, null)
      return {
        distribution: [
          { activity_level: '活跃', count: 3 },
          { activity_level: '不活跃', count: 2 }
        ],
        rate: { total_customers: 6, active_customers: 3 },
        weeklyActivity: [
          { date: '2026-11-01', active_users: '4' },
          { date: '2026-11-02', active_users: null }
        ]
      }
    } }
  })
  assert.deepEqual(await service.getActivity({ storeId: null }), {
    active_rate: 50,
    distribution: [
      { name: '非常活跃', value: 0 },
      { name: '活跃', value: 3 },
      { name: '一般', value: 0 },
      { name: '不活跃', value: 2 }
    ],
    weekly_activity: [
      { date: '2026-11-01', day: '周日', active_users: 4 },
      { date: '2026-11-02', day: '周一', active_users: 0 }
    ]
  })
})

test('customer activity service rejects disconnected database and handles empty aggregates', async () => {
  const disconnected = new Service({ connected: () => false, repository: {} })
  await assert.rejects(disconnected.getActivity({ storeId: 3 }), { statusCode: 500, message: '数据库连接失败' })
  const empty = new Service({ connected: () => true, repository: { async getActivity() {
    return { distribution: [], rate: null, weeklyActivity: [] }
  } } })
  assert.deepEqual(await empty.getActivity({ storeId: 3 }), {
    active_rate: 0,
    distribution: [
      { name: '非常活跃', value: 0 },
      { name: '活跃', value: 0 },
      { name: '一般', value: 0 },
      { name: '不活跃', value: 0 }
    ],
    weekly_activity: []
  })
})

test('customer activity repository executes the three scoped reads in order', async () => {
  const calls = []
  const repository = new Repository({ database: () => ({ async execute(query, params) {
    calls.push({ query, params })
    if (calls.length === 1) return [[{ activity_level: '活跃', count: 2 }]]
    if (calls.length === 2) return [[{ total_customers: 4, active_customers: 2 }]]
    return [[{ date: '2026-11-01', active_users: 1 }]]
  } }) })
  const result = await repository.getActivity(9)
  assert.deepEqual(result, {
    distribution: [{ activity_level: '活跃', count: 2 }],
    rate: { total_customers: 4, active_customers: 2 },
    weeklyActivity: [{ date: '2026-11-01', active_users: 1 }]
  })
  assert.deepEqual(calls.map(call => call.params), [[9], [9], [9]])
  assert.match(calls[0].query, /AND c\.store_id = \?/)
  assert.match(calls[1].query, /AND c\.store_id = \?/)
  assert.match(calls[2].query, /AND s\.store_id = \?/)
})
