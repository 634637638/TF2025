'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const express = require('express')
const { request } = require('node:http')
const { ipKeyGenerator } = require('express-rate-limit')
const { frontendErrorLogRateLimit } = require('../src/middleware/rate-limit')
const FrontendErrorLogService = require('../src/services/frontend-error-log.service')
const router = require('../src/routes/frontend-error-logs')

// 测真实路由、Controller 和生产限流器；仅替换认证结果与持久化，绝不连接业务库。
const createHost = async t => {
  let accepted = 0
  t.mock.method(FrontendErrorLogService.prototype, 'submitReport', async () => {
    accepted++
    return { accepted: 1 }
  })
  const authLayer = router.stack.find(layer => layer.route?.path === '/errors').route.stack[0]
  t.mock.method(authLayer, 'handle', (req, res, next) => {
    const id = Number(req.headers['x-test-user'])
    if (!Number.isSafeInteger(id) || id <= 0) return res.status(401).json({ success: false })
    req.user = { id }
    next()
  })
  const app = express()
  app.set('trust proxy', 'loopback')
  app.use(express.json())
  app.use('/api/logs', router)
  const server = await new Promise(resolve => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance))
  })
  const keys = new Set()
  t.after(async () => {
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
    await Promise.all([...keys].map(key => frontendErrorLogRateLimit.resetKey(key)))
  })
  return {
    accepted: () => accepted,
    send: (user = 1001, ip = '192.0.2.10') => {
      keys.add(`${user}:${ipKeyGenerator(ip)}`)
      return new Promise((resolve, reject) => {
        const req = request({ host: '127.0.0.1', port: server.address().port, path: '/api/logs/errors',
          method: 'POST', agent: false, headers: { 'content-type': 'application/json', 'x-test-user': String(user), 'x-forwarded-for': ip } }, res => {
          let body = ''
          res.setEncoding('utf8')
          res.on('data', chunk => { body += chunk })
          res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: JSON.parse(body) }))
        })
        req.on('error', reject)
        req.end(JSON.stringify({ userId: 9999, errors: [{ message: '内存限流验收', timestamp: 1000 }] }))
      })
    }
  }
}

test('错误上报前60次成功，第61次返回受控429与重试时间且不持久化', async t => {
  const host = await createHost(t)
  for (let index = 0; index < 60; index++) assert.equal((await host.send()).status, 200)
  const limited = await host.send()
  assert.equal(limited.status, 429)
  assert.deepEqual(limited.body, { success: false, message: '错误日志上报过于频繁，请稍后再试', code: 'FRONTEND_ERROR_LOG_RATE_LIMIT_EXCEEDED' })
  assert.equal(Number(limited.headers['ratelimit-limit']), 60)
  assert.equal(Number(limited.headers['ratelimit-remaining']), 0)
  assert.ok(Number(limited.headers['retry-after']) > 0 && Number(limited.headers['retry-after']) <= 300)
  assert.equal(limited.headers['x-ratelimit-limit'], undefined)
  assert.equal(host.accepted(), 60)
})

test('同IP不同用户及同用户不同IP分别计数，客户端不能借请求体冒充用户', async t => {
  const host = await createHost(t)
  for (let index = 0; index < 60; index++) await host.send()
  assert.equal((await host.send()).status, 429)
  assert.equal((await host.send(1002)).status, 200)
  assert.equal((await host.send(1001, '192.0.2.11')).status, 200)
  assert.equal(host.accepted(), 62)
})

test('未登录请求先返回401，不占用已登录用户的专用额度', async t => {
  const host = await createHost(t)
  for (let index = 0; index < 61; index++) {
    const response = await host.send(0)
    assert.equal(response.status, 401)
    assert.equal(response.headers['ratelimit-limit'], undefined)
  }
  assert.equal((await host.send()).status, 200)
  assert.equal(host.accepted(), 1)
})

test('五分钟窗口结束后自动恢复额度，不实际等待或写库', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: Date.UTC(2026, 10, 13) })
  const host = await createHost(t)
  for (let index = 0; index < 60; index++) await host.send()
  assert.equal((await host.send()).status, 429)
  t.mock.timers.tick(5 * 60 * 1000 + 1)
  const response = await host.send()
  assert.equal(response.status, 200)
  assert.equal(Number(response.headers['ratelimit-remaining']), 59)
  assert.equal(host.accepted(), 61)
})

test('IPv6同网段不能轮换地址绕过额度，不同网段独立', async t => {
  const host = await createHost(t)
  for (let index = 0; index < 60; index++) await host.send(1001, '2001:db8:1::1')
  assert.equal((await host.send(1001, '2001:db8:1::2')).status, 429)
  assert.equal((await host.send(1001, '2001:db8:2::1')).status, 200)
})

test('并发61个请求仍只允许60个进入持久化服务', async t => {
  const host = await createHost(t)
  const responses = await Promise.all(Array.from({ length: 61 }, () => host.send()))
  assert.equal(responses.filter(response => response.status === 200).length, 60)
  assert.equal(responses.filter(response => response.status === 429).length, 1)
  assert.equal(host.accepted(), 60)
})
