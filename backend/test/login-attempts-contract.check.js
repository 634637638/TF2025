const test = require('node:test')
const assert = require('node:assert/strict')

const {
  loginFailureHandler,
  getLoginAttemptsStats,
  clearLoginAttempts,
  getClientIdentifier
} = require('../src/middleware/login-attempts')

function responseDouble(statusCode) {
  const headers = new Map()
  return {
    statusCode,
    setHeader(name, value) {
      headers.set(name.toLowerCase(), value)
    },
    removeHeader(name) {
      headers.delete(name.toLowerCase())
    },
    getHeader(name) {
      return headers.get(name.toLowerCase())
    },
    json(body) {
      this.body = body
      return this
    }
  }
}

function requestDouble(username) {
  return {
    path: '/api/auth/login',
    originalUrl: '/api/auth/login',
    method: 'POST',
    ip: '127.0.0.1',
    body: { username, password: 'bad-password' }
  }
}

function invoke(statusCode, username, body) {
  const req = requestDouble(username)
  const res = responseDouble(statusCode)
  loginFailureHandler(req, res, () => {})
  res.json(body)
  return { req, res }
}

test('401 凭证失败计数并设置剩余次数，重复包装只计数一次', () => {
  const username = `contract-401-${Date.now()}`
  const identifier = getClientIdentifier(requestDouble(username))
  clearLoginAttempts(identifier)

  const first = invoke(401, username, { success: false, message: '用户名或密码错误' })
  assert.equal(first.res.getHeader('x-login-attempts-remaining'), 4)
  assert.equal(getLoginAttemptsStats().totalAttempts, 1)

  first.res.json({ success: false, message: '用户名或密码错误' })
  assert.equal(getLoginAttemptsStats().totalAttempts, 1)
  clearLoginAttempts(identifier)
})

test('503 服务不可用不计入登录失败且移除剩余次数响应头', () => {
  const username = `contract-503-${Date.now()}`
  const identifier = getClientIdentifier(requestDouble(username))
  clearLoginAttempts(identifier)

  const before = getLoginAttemptsStats().totalAttempts
  const result = invoke(503, username, { success: false, message: '服务暂时不可用' })

  assert.equal(result.res.getHeader('x-login-attempts-remaining'), undefined)
  assert.equal(getLoginAttemptsStats().totalAttempts, before)
  clearLoginAttempts(identifier)
})
