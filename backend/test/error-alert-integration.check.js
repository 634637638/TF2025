'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const { once } = require('node:events')
const express = require('express')
const requestContext = require('../src/middleware/request-context')
const { createErrorAlertMiddleware } = require('../src/middleware/error-alerts')
const { ErrorAlertService } = require('../src/services/error-alert.service')
const { readErrorAlertConfig } = require('../src/config/error-alerts')
const { checkErrorAlerts } = require('../scripts/check-error-alerts')
const FrontendErrorLogService = require('../src/services/frontend-error-log.service')
const FrontendErrorLogController = require('../src/controllers/frontend-error-log.controller')

const baseConfig = () => readErrorAlertConfig({
  NODE_ENV: 'production', ERROR_ALERT_ENABLED: 'true',
  ERROR_ALERT_SMTP_HOST: 'smtp.example.invalid', ERROR_ALERT_SMTP_USER: 'alerts@example.invalid',
  ERROR_ALERT_SMTP_PASSWORD: 'synthetic-mail-password', ERROR_ALERT_FROM: 'alerts@example.invalid',
  ERROR_ALERT_TO: 'maintainer@example.invalid'
})

test('真实 HTTP 调用链在响应结束后统计 5xx，保留页面业务错误且不发送响应内容', async t => {
  const messages = []
  const alerts = new ErrorAlertService({
    config: { ...baseConfig(), threshold: 2, minSpanMs: 0 },
    mailer: { async send(message) { messages.push(message) }, close() {} }
  })
  const app = express()
  app.use(requestContext)
  app.use(createErrorAlertMiddleware(alerts))
  app.post('/failure/:id', (_req, res) => res.status(500).json({ message: 'synthetic-private-response' }))
  app.get('/denied', (_req, res) => res.status(403).json({ message: '权限不足' }))
  const server = app.listen(0, '127.0.0.1')
  t.after(async () => { alerts.close(); await new Promise(resolve => server.close(resolve)) })
  await once(server, 'listening')
  const base = `http://127.0.0.1:${server.address().port}`
  for (let index = 0; index < 2; index++) {
    const denied = await fetch(`${base}/denied`)
    assert.equal(denied.status, 403)
    assert.deepEqual(await denied.json(), { message: '权限不足' })
  }
  assert.equal(messages.length, 0)
  for (let index = 0; index < 2; index++) {
    const failed = await fetch(`${base}/failure/123?token=synthetic-private-query`, { method: 'POST' })
    assert.equal(failed.status, 500)
    assert.deepEqual(await failed.json(), { message: 'synthetic-private-response' })
    assert.ok(failed.headers.get('X-Request-ID'))
  }
  assert.equal(messages.length, 1)
  assert.match(messages[0].text, /POST \/failure\/:id/)
  assert.equal(messages[0].text.includes('synthetic-private'), false)
})

test('告警收集自身失败不改变已经发送的 HTTP 响应', () => {
  let finish
  let nextCalls = 0
  createErrorAlertMiddleware({ enabled: true, recordHttpFailure() { throw new Error('synthetic internal failure') } })(
    { method: 'POST' }, { once(_event, listener) { finish = listener }, statusCode: 500 }, () => { nextCalls++ }
  )
  assert.equal(nextCalls, 1)
  assert.doesNotThrow(() => finish())
})

test('不同模块同名路由在自行响应和统一错误处理后分别聚合，不保存实际路径', async t => {
  const messages = []
  const alerts = new ErrorAlertService({
    config: { ...baseConfig(), threshold: 2, minSpanMs: 0 },
    mailer: { async send(message) { messages.push(message) }, close() {} }
  })
  const app = express()
  app.use(createErrorAlertMiddleware(alerts))
  for (const module of ['module-a', 'module-b']) {
    const router = express.Router()
    router.get('/:id', (req, res, next) => req.query.forward === 'true' ? next(new Error('synthetic failure')) : res.sendStatus(500))
    app.use(`/${module}`, router)
  }
  app.use((_error, _req, res, _next) => res.sendStatus(500))
  const server = app.listen(0, '127.0.0.1')
  t.after(async () => { alerts.close(); await new Promise(resolve => server.close(resolve)) })
  await once(server, 'listening')
  const base = `http://127.0.0.1:${server.address().port}`
  for (const [module, forward] of [['module-a', false], ['module-b', true], ['module-a', true]]) {
    const response = await fetch(`${base}/${module}/123?forward=${forward}`)
    await response.text()
  }
  assert.equal(messages.length, 1)
  assert.equal(alerts.groups.size, 2)
  assert.equal(JSON.stringify(messages).includes('module-a'), false)
  assert.equal(JSON.stringify([...alerts.groups.values()]).includes('module-a'), false)
})

test('前端日志成功落库后才收集告警，使用后端请求编号，收集异常不影响 accepted', async () => {
  const calls = []
  const service = new FrontendErrorLogService({
    repository: { async insertBatch() { calls.push('persisted') } },
    alerts: { recordFrontendReport(_report, userId, requestId) { calls.push({ userId, requestId }); throw new Error('synthetic alert failure') } }
  })
  const controller = new FrontendErrorLogController({ service })
  const response = { json(value) { this.body = value; return this } }
  await controller.report({
    user: { id: 12 }, requestId: 'server-request-123',
    body: { error: { message: 'synthetic error' }, requestId: 'forged-body-request' }
  }, response)
  assert.deepEqual(calls, ['persisted', { userId: 12, requestId: 'server-request-123' }])
  assert.equal(response.body.success, true)
  assert.equal(response.body.data.accepted, 1)
})

test('落库失败时不产生告警，仍向调用方传播原持久化错误', async () => {
  let alerts = 0
  const service = new FrontendErrorLogService({
    repository: { async insertBatch() { throw new Error('synthetic persistence failure') } },
    alerts: { recordFrontendReport() { alerts++ } }
  })
  await assert.rejects(service.submitReport({ error: { message: 'synthetic error' } }, 12), /synthetic persistence failure/)
  assert.equal(alerts, 0)
})

test('部署自检默认不建立邮件连接，仅显式验收选项发送且始终关闭连接', async () => {
  let connections = 0
  let sends = 0
  let closes = 0
  const createMailer = () => {
    connections++
    return { async send() { sends++ }, close() { closes++ } }
  }
  const config = baseConfig()
  const result = await checkErrorAlerts({ config, createMailer })
  assert.equal(result.sent, false)
  assert.equal(connections, 0)
  assert.equal('smtp' in result, false)
  assert.equal('recipients' in result, false)
  assert.equal(JSON.stringify(result).includes('synthetic-mail-password'), false)
  assert.equal((await checkErrorAlerts({ config, createMailer, sendTest: true })).sent, true)
  assert.equal(sends, 1)
  assert.equal(closes, 1)
  await assert.rejects(checkErrorAlerts({ config: { ...config, enabled: false }, createMailer, sendTest: true }), /未启用/)
  assert.equal(connections, 1)
})
