'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const express = require('express')
const { request } = require('node:http')
const schema = require('../src/contracts/performance-report.schema.json')
const PerformanceReportService = require('../src/services/performance-report.service')
const router = require('../src/routes/performance')
const { performanceReportRateLimit } = require('../src/middleware/rate-limit')
const empty = () => Object.fromEntries(Object.keys(schema.properties).map(key => [key, 0]))

test('性能接收仅接受白名单完整数值，拒绝身份/URL/未知字段、负数和非有限数', () => {
  const service = new PerformanceReportService()
  assert.deepEqual(service.accept(empty()), { accepted: true })
  for (const value of [null, [], {}, { ...empty(), url: '/customers?phone=private' }, { ...empty(), userId: 1 },
    { ...empty(), inp: NaN }, { ...empty(), fcp: Infinity }, { ...empty(), cls: -1 }, { ...empty(), apiCount: 1.5 }, { ...empty(), inp: '1' }]) {
    assert.throws(() => service.accept(value), { statusCode: 400 })
  }
  assert.equal(service.samples, 1)
})

test('分钟及容量边界只输出固定大小聚合，不保存原始报告', () => {
  let now = 1000
  const logs = []
  const service = new PerformanceReportService({ clock: () => now, logger: { info: (...args) => logs.push(args) } })
  service.accept({ ...empty(), fcp: 100, apiCount: 1, apiTotal: 30, apiMax: 30 })
  service.accept({ ...empty(), fcp: 300 })
  now += 60000
  service.accept(empty())
  assert.equal(logs.length, 1)
  assert.equal(logs[0][1].samples, 2)
  assert.deepEqual(logs[0][1].metrics.fcp, { count: 2, average: 200, max: 300 })
  assert.equal(service.samples, 1)
  for (let i = 0; i < 10000; i++) service.accept(empty())
  assert.equal(logs.length, 2)
  assert.equal(Object.keys(service.metrics).length, Object.keys(schema.properties).length)
})

test('性能真实HTTP入口先鉴权再限流，额度隔离、窗口恢复、错误不回显请求', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: Date.UTC(2026, 10, 13) })
  const layer = router.stack.find(item => item.route?.path === '/report').route.stack[0]
  t.mock.method(layer, 'handle', (req, res, next) => {
    const id = Number(req.headers['x-test-user'])
    if (!id) return res.status(401).json({ success: false })
    req.user = { id }; next()
  })
  const app = express()
  app.use('/api/performance', router)
  const server = await new Promise(resolve => { const host = app.listen(0, '127.0.0.1', () => resolve(host)) })
  t.after(async () => {
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
    for (const id of [1, 2]) await performanceReportRateLimit.resetKey(`${id}:127.0.0.1`)
  })
  const send = (id, body = empty()) => new Promise((resolve, reject) => {
    const req = request({ host: '127.0.0.1', port: server.address().port, path: '/api/performance/report', method: 'POST', agent: false,
      headers: { 'content-type': 'application/json', 'x-test-user': String(id) } }, res => {
      let text = ''; res.on('data', chunk => { text += chunk }); res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(text), headers: res.headers }))
    }); req.on('error', reject); req.end(JSON.stringify(body))
  })
  assert.equal((await send(0)).status, 401)
  assert.equal((await send(1, { ...empty(), token: 'private-placeholder' })).status, 400)
  for (let i = 0; i < 9; i++) assert.equal((await send(1)).status, 200)
  const rejected = await send(1)
  assert.equal(rejected.status, 429)
  assert.equal(rejected.body.code, 'PERFORMANCE_REPORT_RATE_LIMIT_EXCEEDED')
  assert.equal((await send(2)).status, 200)
  assert.equal(JSON.stringify(rejected.body).includes('private-placeholder'), false)
  t.mock.timers.tick(300001)
  assert.equal((await send(1)).status, 200)
})
