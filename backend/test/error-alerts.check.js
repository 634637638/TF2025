'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const { ErrorAlertService } = require('../src/services/error-alert.service')
const { readErrorAlertConfig } = require('../src/config/error-alerts')

const environment = overrides => ({
  NODE_ENV: 'production', ERROR_ALERT_ENABLED: 'true',
  ERROR_ALERT_SMTP_HOST: 'smtp.example.invalid', ERROR_ALERT_SMTP_PORT: '465',
  ERROR_ALERT_SMTP_USER: 'alerts@example.invalid', ERROR_ALERT_SMTP_PASSWORD: 'synthetic-mail-password',
  ERROR_ALERT_FROM: 'alerts@example.invalid', ERROR_ALERT_TO: 'maintainer@example.invalid',
  ...overrides
})
const settle = async () => { for (let index = 0; index < 30; index++) await Promise.resolve() }
const fixture = (t, overrides = {}, send) => {
  let time = Date.parse('2026-11-13T00:00:00Z')
  let timerId = 0
  const timers = new Map()
  const messages = []
  const warnings = []
  const config = { ...readErrorAlertConfig(environment()), ...overrides }
  const service = new ErrorAlertService({
    config, now: () => time,
    mailer: { send: async message => { messages.push(message); return send?.(message) }, close() {} },
    logger: { warn: (...args) => warnings.push(args) },
    setTimer: (callback, delay) => { const id = ++timerId; timers.set(id, { callback, at: time + delay }); return id },
    clearTimer: id => timers.delete(id)
  })
  const advance = async milliseconds => {
    const end = time + milliseconds
    for (let index = 0; index < 100; index++) {
      const due = [...timers].filter(([, value]) => value.at <= end).sort((a, b) => a[1].at - b[1].at)[0]
      if (!due) break
      timers.delete(due[0])
      time = due[1].at
      await due[1].callback()
      await settle()
      if (index === 99) assert.fail('告警定时器出现循环')
    }
    time = end
    await settle()
  }
  t.after(() => { service.close(); assert.equal(timers.size, 0) })
  return { service, messages, warnings, advance, config }
}
const httpFailure = (service, extra = {}) => service.recordHttpFailure({
  status: 500, method: 'POST', route: '/items/:id', requestId: 'request-test-123', ...extra
})
const frontendReport = (extra = {}) => ({
  environment: JSON.stringify({ mode: 'production' }), sessionId: 'synthetic-session',
  errors: [{ errorKey: 'synthetic-error', errorType: 'vue', level: 'critical', count: 1, message: 'synthetic rendering failure', ...extra }]
})

test('邮件告警默认关闭，非生产即使显式开启也不启用', () => {
  assert.equal(readErrorAlertConfig({}).enabled, false)
  assert.equal(readErrorAlertConfig(environment({ NODE_ENV: 'development' })).enabled, false)
  assert.equal(readErrorAlertConfig(environment()).enabled, true)
})

test('SMTP 配置只接受加密端口、有效邮箱和完整正整数，错误不回显配置值', () => {
  for (const overrides of [
    { ERROR_ALERT_SMTP_HOST: 'https://smtp.example.invalid/' },
    { ERROR_ALERT_SMTP_PORT: '25' }, { ERROR_ALERT_SMTP_PASSWORD: '' },
    { ERROR_ALERT_FROM: 'a@example.invalid\r\nBcc: b@example.invalid' },
    { ERROR_ALERT_TO: 'bad-address' }, { ERROR_ALERT_TO: Array(6).fill('a@example.invalid').join(',') },
    { ERROR_ALERT_THRESHOLD: '10abc' }, { ERROR_ALERT_THRESHOLD: 'Infinity' }, { ERROR_ALERT_THRESHOLD: '1e3' }
  ]) {
    const config = readErrorAlertConfig(environment(overrides))
    assert.equal(config.enabled, false)
    assert.ok(config.errors.length)
    assert.equal(JSON.stringify(config.errors).includes('synthetic-mail-password'), false)
  }
  const config = readErrorAlertConfig(environment({ ERROR_ALERT_SMTP_PORT: '587' }))
  assert.equal(config.smtp.secure, false)
  assert.equal(config.smtp.requireTLS, true)
  assert.equal(config.smtp.tls.rejectUnauthorized, true)
})

test('关闭状态不创建队列、不发送邮件', async t => {
  const { service, messages } = fixture(t, { enabled: false })
  service.recordSystemFailure('uncaught_exception')
  httpFailure(service)
  service.recordFrontendReport(frontendReport(), 12, 'request-test-123')
  await settle()
  assert.equal(messages.length, 0)
  assert.equal(service.groups.size, 0)
})

test('服务端严重事件立即告警，同组五分钟内只发一次，未知事件不发', async t => {
  const { service, messages, advance } = fixture(t)
  service.recordSystemFailure('unrecognized-client-value')
  service.recordSystemFailure('uncaught_exception')
  await settle()
  assert.equal(messages.length, 1)
  assert.match(messages[0].text, /2026-11-13 08:00:00/)
  service.recordSystemFailure('uncaught_exception')
  await settle()
  assert.equal(messages.length, 1)
  await advance(300_001)
  service.recordSystemFailure('uncaught_exception')
  await settle()
  assert.equal(messages.length, 2)
})

test('普通 4xx 和单次 5xx 不告警，达到阈值且持续三十秒后才发送', async t => {
  const { service, messages, advance } = fixture(t)
  for (const status of [200, 400, 401, 403, 404, 409, 422, 429]) httpFailure(service, { status })
  for (let index = 0; index < 10; index++) httpFailure(service)
  await settle()
  assert.equal(messages.length, 0)
  await advance(30_000)
  httpFailure(service)
  await settle()
  assert.equal(messages.length, 1)
  assert.match(messages[0].text, /本窗口已观察次数：11/)
  assert.match(messages[0].text, /POST \/items\/:id/)
  assert.match(messages[0].text, /request-test-123/)
})

test('跨五分钟窗口的稀疏失败不会相加到阈值', async t => {
  const { service, messages, advance } = fixture(t)
  for (let index = 0; index < 9; index++) httpFailure(service)
  await advance(300_000)
  httpFailure(service)
  await settle()
  assert.equal(messages.length, 0)
})

test('全局发送尝试每五分钟最多五次，不因更换错误组绕过', async t => {
  const { service, messages, advance } = fixture(t, { threshold: 2, minSpanMs: 0 })
  for (let index = 0; index < 8; index++) {
    httpFailure(service, { route: `/module-${index}` })
    httpFailure(service, { route: `/module-${index}` })
  }
  await settle()
  assert.equal(messages.length, 5)
  await advance(300_001)
  assert.equal(messages.length, 8)
})

test('SMTP 失败只有限重试三次，不记录 SMTP 异常中的密码', async t => {
  const { service, messages, warnings, advance } = fixture(t, {}, () => { throw new Error('synthetic-private-smtp-error') })
  service.recordSystemFailure('startup_failed')
  await settle()
  assert.equal(messages.length, 1)
  await advance(60_000)
  assert.equal(messages.length, 3)
  assert.equal(service.pending.length, 0)
  assert.equal(JSON.stringify(warnings).includes('synthetic-private-smtp-error'), false)
})

test('浏览器伪造 critical 和巨大累计 count 不能立即告警，重放不增加次数', async t => {
  const { service, messages, advance } = fixture(t)
  for (let index = 0; index < 20; index++) service.recordFrontendReport(frontendReport({ count: 1_000_000 }), 12, 'request-test-123')
  await advance(30_000)
  assert.equal(messages.length, 0)
  assert.equal([...service.groups.values()][0].count, 1)
})

test('前端普通业务、权限、开发和 API 重复转报均不会触发邮件', async t => {
  const { service, messages, advance } = fixture(t, { threshold: 2, minSpanMs: 0 })
  for (let index = 0; index < 20; index++) {
    for (const errorType of ['permission', 'validation', 'business', 'performance']) {
      service.recordFrontendReport(frontendReport({ errorType, count: index + 1 }), 12, 'request-test-123')
    }
    service.recordFrontendReport(frontendReport({ context: JSON.stringify({ status: 403 }), count: index + 1 }), 12, 'request-test-123')
    service.recordFrontendReport(frontendReport({ tags: '["api"]', count: index + 1 }), 12, 'request-test-123')
    service.recordFrontendReport({ ...frontendReport(), environment: '{"mode":"development"}' }, 12, 'request-test-123')
  }
  await advance(30_000)
  assert.equal(messages.length, 0)
  assert.equal(service.groups.size, 0)
})

test('前端真实递增上报按服务端收到的事件聚合，邮件不含原始内容或会话信息', async t => {
  const { service, messages, advance } = fixture(t)
  const report = count => frontendReport({
    count, message: 'synthetic-private-error-content', stack: 'synthetic-private-stack',
    context: '{"password":"synthetic-private-password"}'
  })
  for (let index = 1; index <= 9; index++) service.recordFrontendReport(report(index), 12, 'request-test-123')
  await advance(30_000)
  service.recordFrontendReport(report(10), 12, 'request-test-123')
  await settle()
  assert.equal(messages.length, 1)
  for (const secret of ['synthetic-private', 'synthetic-session', 'password', 'stack']) {
    assert.equal(JSON.stringify(messages).includes(secret), false)
  }
})

test('异常 URL/动态路由值和非法请求编号不会出现在邮件中', async t => {
  const { service, messages } = fixture(t, { threshold: 2, minSpanMs: 0 })
  for (let index = 0; index < 2; index++) httpFailure(service, {
    route: '/items?token=synthetic-private-value', requestId: 'invalid\r\nrequest'
  })
  await settle()
  assert.equal(messages.length, 1)
  assert.match(messages[0].text, /\/unmatched/)
  assert.equal(messages[0].text.includes('synthetic-private-value'), false)
})

test('聚合、重放和待发送队列有容量限制，关闭后不再发送', async t => {
  let release
  const gate = new Promise(resolve => { release = resolve })
  const { service, messages } = fixture(t, { maxGroups: 3, maxPending: 1, threshold: 2, minSpanMs: 0, maxDedup: 2 }, () => gate)
  for (let index = 0; index < 20; index++) {
    httpFailure(service, { route: `/module-${index}` })
    httpFailure(service, { route: `/module-${index}` })
    service.recordFrontendReport(frontendReport({ errorKey: `event-${index}` }), 12, 'request-test-123')
  }
  assert.ok(service.groups.size <= 3)
  assert.ok(service.pending.length <= 1)
  assert.ok(service.dedup.size <= 2)
  service.close()
  release()
  await settle()
  assert.equal(messages.length, 1)
  service.recordSystemFailure('uncaught_exception')
  assert.equal(messages.length, 1)
})
