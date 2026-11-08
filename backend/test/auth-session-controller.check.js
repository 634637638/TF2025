'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const AuthSessionController = require('../src/controllers/auth-session.controller')

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

const createResponseHelper = () => ({
  success(res, data, message) {
    res.body = { success: true, data, message }
    return res
  },
  error(res, message, status) {
    res.statusCode = status
    res.body = { success: false, message }
    return res
  }
})

test('单设备退出吊销访问和刷新令牌并清理 refresh cookie', async () => {
  const blacklistCalls = []
  const cleared = []
  const controller = new AuthSessionController({
    blacklistToken: async (...args) => blacklistCalls.push(args),
    readCookie: (req, name) => (name === 'refreshToken' ? req.refreshToken : null),
    clearCookie: res => cleared.push(res),
    response: createResponseHelper()
  })
  const response = createResponse()

  await controller.logout({ headers: { authorization: 'Bearer access-token' }, refreshToken: 'refresh-token' }, response)

  assert.deepEqual(blacklistCalls, [
    ['access-token', 'logout'],
    ['refresh-token', 'logout']
  ])
  assert.deepEqual(cleared, [response])
  assert.deepEqual(response.body, { success: true, data: null, message: '退出成功' })
})

test('全部设备退出写入带用户 ID 的 logout_all 截止标记后清理 cookie', async () => {
  let query
  let values
  const cleared = []
  const controller = new AuthSessionController({
    database: () => ({
      async execute(sql, params) {
        query = sql
        values = params
      }
    }),
    randomBytes: size => {
      assert.equal(size, 16)
      return Buffer.alloc(size, 1)
    },
    clearCookie: res => cleared.push(res),
    response: createResponseHelper()
  })
  const response = createResponse()

  await controller.logoutAll({ user: { id: 42 } }, response)

  assert.match(query, /INSERT INTO jwt_blacklist/)
  assert.match(query, /'access', 'logout_all'/)
  assert.match(query, /INTERVAL 31 DAY/)
  assert.match(values[0], /^jti_logout_all_[0-9a-f]{32}$/)
  assert.equal(values[1], 42)
  assert.deepEqual(cleared, [response])
  assert.deepEqual(response.body, { success: true, data: null, message: '已退出所有设备' })
})

test('退出接口保留认证并委托 session controller', () => {
  const routePath = path.join(__dirname, '../src/routes/auth.js')
  const route = fs.readFileSync(routePath, 'utf8')

  assert.match(route, /router\.post\('\/logout', unifiedAuth, authSessionController\.logout\.bind\(authSessionController\)\)/)
  assert.match(route, /router\.post\('\/logout-all', unifiedAuth, authSessionController\.logoutAll\.bind\(authSessionController\)\)/)
})
