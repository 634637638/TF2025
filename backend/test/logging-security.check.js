'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const backendRoot = path.resolve(__dirname, '..')

test('公共脱敏工具清除凭据、身份证和 URL 查询秘密', () => {
  const { redactUrl, redactValue, summarizeSqlParams } = require('../src/utils/sensitive-data')
  const redacted = redactValue({
    password: 'secret',
    id_card: '110101199001011234',
    nested: { authorization: 'Bearer abc.def', paymentSecret: 'raw' },
    url: '/x?access_token=raw-token&safe=ok'
  })

  assert.equal(redacted.password, '[REDACTED]')
  assert.equal(redacted.id_card, '[REDACTED]')
  assert.equal(redacted.nested.authorization, '[REDACTED]')
  assert.equal(redacted.nested.paymentSecret, '[REDACTED]')
  assert.match(redacted.url, /access_token=\[REDACTED\]/)
  assert.equal(redactUrl('/x?password=raw&safe=ok'), '/x?password=%5BREDACTED%5D&safe=ok')
  assert.deepEqual(summarizeSqlParams(['secret', 1, null]), {
    count: 3,
    types: ['string', 'number', 'null']
  })
})

test('请求上下文生成或透传合法 request ID', () => {
  const requestContext = require('../src/middleware/request-context')
  const makeResponse = () => ({ headers: {}, setHeader(name, value) { this.headers[name] = value } })

  const generatedReq = { get: () => '' }
  const generatedRes = makeResponse()
  requestContext(generatedReq, generatedRes, () => {})
  assert.match(generatedReq.requestId, /^[0-9a-f-]{36}$/)
  assert.equal(generatedRes.headers['X-Request-ID'], generatedReq.requestId)

  const forwardedReq = { get: () => 'client-request-123' }
  const forwardedRes = makeResponse()
  requestContext(forwardedReq, forwardedRes, () => {})
  assert.equal(forwardedReq.requestId, 'client-request-123')
})

test('全局错误响应不回传堆栈或请求数据并包含 request ID', () => {
  const errorHandler = require('../src/middleware/error-handler')
  const req = {
    requestId: 'request-test-123',
    method: 'POST',
    originalUrl: '/api/example?token=raw',
    url: '/api/example?token=raw',
    body: { password: 'secret' },
    params: { id: '1' },
    query: { token: 'raw' }
  }
  const res = {
    statusCode: 0,
    body: null,
    status(code) { this.statusCode = code; return this },
    json(body) { this.body = body; return this }
  }

  errorHandler(Object.assign(new Error('database path /private/data'), { status: 500 }), req, res, () => {})

  assert.equal(res.statusCode, 500)
  assert.equal(res.body.message, '服务器内部错误，请稍后重试')
  assert.equal(res.body.request_id, 'request-test-123')
  assert.equal('stack' in res.body, false)
  assert.equal('details' in res.body, false)
  assert.equal('body' in res.body, false)
})

test('请求日志和基础仓储复用公共脱敏且不记录原始 SQL 参数', () => {
  const app = fs.readFileSync(path.join(backendRoot, 'src/app.js'), 'utf8')
  const repository = fs.readFileSync(path.join(backendRoot, 'src/repositories/base.repository.js'), 'utf8')
  const log = fs.readFileSync(path.join(backendRoot, 'src/utils/log.js'), 'utf8')

  assert.match(app, /app\.use\(requestContext\)/)
  assert.match(app, /requestId: req\.requestId/)
  assert.match(app, /redactUrl\(req\.originalUrl\)/)
  assert.match(repository, /summarizeSqlParams\(params\)/)
  assert.doesNotMatch(repository, /params:\s*params/)
  assert.match(log, /redactValue\(arg\)/)
  assert.match(log, /redactString\(arg\)/)
})
