'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const AuthController = require('../src/controllers/auth.controller')

const makeResponse = () => ({})
const makeHttpResponse = () => ({
  headers: {},
  setHeader(name, value) { this.headers[name.toLowerCase()] = value },
  getHeader(name) { return this.headers[name.toLowerCase()] },
  status(code) { this.statusCode = code; return this },
  json(body) { this.body = body; return this }
})
const response = {
  success(res, data, message) {
    res.body = { success: true, data, ...(message ? { message } : {}) }
    return res
  },
  error(res, message, status) {
    res.statusCode = status
    res.body = { success: false, message }
    return res
  }
}

test('current-user controller keeps connectivity, not-found and profile response behavior', async () => {
  const calls = []
  const user = {
    id: 7,
    username: 'staff',
    name: '员工',
    phone: '123',
    email: 'staff@example.test',
    status: 1,
    last_login: '2026-11-07T02:00:00.000Z'
  }
  const database = {
    async execute(sql, params) {
      calls.push([sql, params])
      return [[user]]
    }
  }
  const controller = new AuthController({
    database: () => database,
    connected: () => true,
    buildUserPayload: async (connection, currentUser) => {
      assert.equal(connection, database)
      assert.equal(currentUser, user)
      return { userPayload: { id: currentUser.id, roles: ['staff'] } }
    },
    response,
    logger: { error() {} }
  })
  const success = makeResponse()
  await controller.getCurrentUser({ user: { id: 7 } }, success)
  assert.deepEqual(calls, [[
    'SELECT id, username, name, phone, email, status, last_login FROM users WHERE id = ?',
    [7]
  ]])
  assert.deepEqual(success.body, {
    success: true,
    data: { id: 7, roles: ['staff'], last_login: '2026-11-07T02:00:00.000Z' }
  })

  const disconnected = new AuthController({
    connected: () => false, response, logger: { error() {} }
  })
  const unavailable = makeResponse()
  await disconnected.getCurrentUser({ user: { id: 7 } }, unavailable)
  assert.equal(unavailable.statusCode, 503)

  const missing = new AuthController({
    database: () => ({ async execute() { return [[]] } }),
    connected: () => true,
    buildUserPayload: async () => assert.fail('用户不存在时不应构建权限资料'),
    response,
    logger: { error() {} }
  })
  const notFound = makeResponse()
  await missing.getCurrentUser({ user: { id: 99 } }, notFound)
  assert.equal(notFound.statusCode, 404)
  assert.equal(notFound.body.message, '用户不存在')
})

test('current-user route requires unified authentication and delegates to controller', () => {
  const route = fs.readFileSync(path.join(__dirname, '../src/routes/auth.js'), 'utf8')
  assert.match(route, /router\.get\('\/user', unifiedAuth, authController\.getCurrentUser\.bind\(authController\)\)/)
})

test('refresh rotates the cookie token only after validating the active user and building permissions', async () => {
  const calls = []
  const database = {
    async execute(sql, params) {
      calls.push(['query', sql, params])
      return [[{ id: 8, username: 'staff', status: 1 }]]
    }
  }
  const controller = new AuthController({
    database: () => database,
    connected: () => true,
    readCookie: () => 'cookie-refresh',
    verifyRefreshToken: async token => {
      calls.push(['verify', token])
      return { sub: 8 }
    },
    buildUserPayload: async (connection, user) => {
      calls.push(['profile', connection === database, user.id])
      return {
        userPayload: { id: user.id },
        accessProfile: { roles: ['staff'] },
        tokenPayload: { id: user.id, roles: ['staff'] }
      }
    },
    revokeRefreshToken: async token => calls.push(['revoke', token]),
    issueTokenPair: payload => {
      calls.push(['issue', payload])
      return { accessToken: 'new-access', refreshToken: 'new-refresh' }
    },
    writeRefreshCookie: (_res, token) => calls.push(['cookie', token]),
    response,
    logger: { error() {} }
  })
  const res = makeResponse()
  await controller.refresh({ body: { refreshToken: 'body-refresh' } }, res)

  assert.deepEqual(calls.map(call => call[0]), ['verify', 'query', 'profile', 'revoke', 'issue', 'cookie'])
  assert.equal(calls[0][1], 'cookie-refresh')
  assert.equal(calls[3][1], 'cookie-refresh')
  assert.deepEqual(res.body, {
    success: true,
    data: {
      token: 'new-access',
      user: { id: 8 },
      accessProfile: { roles: ['staff'] }
    },
    message: '令牌刷新成功'
  })
  assert.deepEqual(calls[5], ['cookie', 'new-refresh'])
})

test('refresh maps missing, unavailable, disabled and invalid-token cases to established responses', async () => {
  const missing = new AuthController({ response, logger: { error() {} } })
  const missingResponse = makeResponse()
  await missing.refresh({ headers: {}, body: {} }, missingResponse)
  assert.equal(missingResponse.statusCode, 401)
  assert.equal(missingResponse.body.message, '刷新令牌不能为空')

  const unavailable = new AuthController({
    readCookie: () => 'refresh', connected: () => false,
    response, logger: { error() {} }
  })
  const unavailableResponse = makeResponse()
  await unavailable.refresh({ headers: {}, body: {} }, unavailableResponse)
  assert.equal(unavailableResponse.statusCode, 503)

  const failureController = error => new AuthController({
    database: () => ({}),
    connected: () => true,
    readCookie: () => '',
    verifyRefreshToken: async () => { throw error },
    response,
    logger: { error() {} }
  })
  const expired = makeResponse()
  await failureController(new Error('令牌已过期')).refresh({ headers: {}, body: { refreshToken: 't' } }, expired)
  assert.equal(expired.statusCode, 401)
  assert.equal(expired.body.message, '刷新令牌已过期，请重新登录')

  const invalid = makeResponse()
  await failureController(new Error('Token已被吊销')).refresh({ headers: {}, body: { refreshToken: 't' } }, invalid)
  assert.equal(invalid.statusCode, 401)
  assert.equal(invalid.body.message, '无效的刷新令牌')

  const disabledUser = new AuthController({
    connected: () => true,
    database: () => ({ async execute() { return [[]] } }),
    readCookie: () => 'refresh',
    verifyRefreshToken: async () => ({ sub: 9 }),
    response,
    logger: { error() {} }
  })
  const disabled = makeResponse()
  await disabledUser.refresh({ headers: {}, body: {} }, disabled)
  assert.equal(disabled.statusCode, 401)
  assert.equal(disabled.body.message, '用户不存在或已被禁用')
})

test('refresh route remains unauthenticated by access token and delegates to controller', () => {
  const route = fs.readFileSync(path.join(__dirname, '../src/routes/auth.js'), 'utf8')
  assert.match(route, /router\.post\('\/refresh', authController\.getRefreshHandler\(verifyToken\)\)/)
})

test('admin initialization controller keeps both development gates and response contract', async () => {
  const previousNodeEnv = process.env.NODE_ENV
  const previousEnabled = process.env.ENABLE_DEV_INIT_ADMIN
  const calls = []
  const controller = new AuthController({
    initializationService: {
      async initializeAdmin() {
        calls.push('initialize')
        return { id: 12, password: 'one-time-password', passwordSource: 'generated', roleId: 3 }
      }
    },
    response,
    logger: { error() {} }
  })
  try {
    const production = makeResponse()
    await controller.initializeAdmin({}, production, 'production', 'true')
    assert.equal(production.statusCode, 403)

    const disabled = makeResponse()
    await controller.initializeAdmin({}, disabled, 'development', 'false')
    assert.equal(disabled.statusCode, 403)
    assert.deepEqual(calls, [])

    const success = makeResponse()
    await controller.initializeAdmin({}, success, 'development', 'true')
    assert.deepEqual(calls, ['initialize'])
    assert.deepEqual(success.body, {
      success: true,
      data: {
        id: 12,
        username: 'admin',
        password: 'one-time-password',
        password_source: 'generated',
        role_id: 3,
        message: '请保存此密码并在登录后立即修改'
      },
      message: '管理员用户初始化成功'
    })
  } finally {
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV
    else process.env.NODE_ENV = previousNodeEnv
    if (previousEnabled === undefined) delete process.env.ENABLE_DEV_INIT_ADMIN
    else process.env.ENABLE_DEV_INIT_ADMIN = previousEnabled
  }
})

test('admin initialization route delegates to controller without moving its environment guard', () => {
  const route = fs.readFileSync(path.join(__dirname, '../src/routes/auth.js'), 'utf8')
  assert.match(route, /router\.post\('\/init-admin',[\s\S]*?getAdminInitializationHandler\([\s\S]*?process\.env\.NODE_ENV,[\s\S]*?process\.env\.ENABLE_DEV_INIT_ADMIN/)
})

test('login controller authenticates the user, records success, updates last login and returns top-level token data', async () => {
  const calls = []
  const database = {
    async execute(sql, params) {
      calls.push(['database', sql, params])
      if (sql.startsWith('SELECT')) return [[{ id: 4, username: 'staff', password: 'hash', name: '员工', status: 'active' }]]
      return [{}]
    }
  }
  const controller = new AuthController({
    database: () => database,
    connected: () => true,
    comparePassword: async (password, hash) => {
      calls.push(['compare', password, hash])
      return true
    },
    recordLoginSuccess: value => calls.push(['success', value]),
    buildUserPayload: async () => ({
      userPayload: { id: 4, username: 'staff' },
      accessProfile: { roles: [{ roleCode: 'staff' }] },
      tokenPayload: { id: 4, role_codes: ['staff'] }
    }),
    issueTokens: payload => {
      calls.push(['tokens', payload])
      return { accessToken: 'access', refreshToken: 'refresh' }
    },
    writeRefreshCookie: (_res, token) => calls.push(['cookie', token]),
    response,
    logger: { error() {}, warn() {} }
  })
  const res = makeHttpResponse()
  await controller.login({
    body: { username: 'staff', password: 'secret' },
    ip: '192.0.2.1',
    connection: { remoteAddress: '192.0.2.2' }
  }, res)

  assert.deepEqual(calls.map(call => call[0]), ['database', 'compare', 'database', 'success', 'tokens', 'cookie'])
  assert.deepEqual(calls[0], [
    'database',
    'SELECT id, username, password, name, status FROM users WHERE username = ?',
    ['staff']
  ])
  assert.deepEqual(calls[2], ['database', 'UPDATE users SET last_login = NOW() WHERE id = ?', [4]])
  assert.deepEqual(calls[3], ['success', '192.0.2.1:staff'])
  assert.deepEqual(res.body, {
    success: true,
    message: '登录成功',
    token: 'access',
    user: { id: 4, username: 'staff' },
    accessProfile: { roles: [{ roleCode: 'staff' }] }
  })
})

test('login controller retains missing-user, disabled-user and bad-password failure behavior', async () => {
  const makeController = ({ users, passwordMatches = false, failed = { attempts: 1, blocked: false, remainingAttempts: 4 } }) => {
    const calls = []
    const controller = new AuthController({
      database: () => ({
        async execute() { return [users] }
      }),
      connected: () => true,
      comparePassword: async () => passwordMatches,
      recordLoginFailure: identifier => { calls.push(['failed', identifier]); return failed },
      resolveClientIdentifier: () => 'client-id',
      response,
      logger: { error() {}, warn() {} }
    })
    return { controller, calls }
  }

  const missing = makeController({ users: [] })
  const missingRequest = { body: { username: 'nobody', password: 'secret' } }
  const missingResponse = makeHttpResponse()
  await missing.controller.login(missingRequest, missingResponse)
  assert.equal(missingResponse.statusCode, 401)
  assert.equal(missingResponse.body.message, '用户名或密码错误')
  assert.equal(missingResponse.getHeader('X-Login-Attempts-Remaining'), 4)
  assert.equal(missingRequest.loginAttemptHandled, true)

  const disabled = makeController({ users: [{ status: 0 }] })
  const disabledRequest = { body: { username: 'staff', password: 'secret' } }
  const disabledResponse = makeHttpResponse()
  await disabled.controller.login(disabledRequest, disabledResponse)
  assert.equal(disabledResponse.statusCode, 403)
  assert.equal(disabledResponse.body.code, 'ACCOUNT_DISABLED')
  assert.equal(disabledRequest.loginFailureReason, 'account_disabled')
  assert.equal(disabledRequest.loginAttemptHandled, true)
  assert.deepEqual(disabled.calls, [])

  const wrongPassword = makeController({ users: [{ id: 1, status: 1, password: 'hash' }] })
  const wrongPasswordResponse = makeHttpResponse()
  await wrongPassword.controller.login({ body: { username: 'staff', password: 'bad' } }, wrongPasswordResponse)
  assert.equal(wrongPasswordResponse.statusCode, 401)
  assert.equal(wrongPasswordResponse.body.message, '用户名或密码错误')
  assert.deepEqual(wrongPassword.calls, [['failed', 'client-id']])
})

test('login controller retains rate-limit response and unavailable database does not count as credential failure', async () => {
  const blocked = new AuthController({
    connected: () => true,
    database: () => ({ async execute() { return [[]] } }),
    resolveClientIdentifier: () => 'client-id',
    recordLoginFailure: () => ({ attempts: 5, blocked: true, remainingAttempts: 0, lockUntil: Date.now() + 60000 }),
    response,
    logger: { error() {}, warn() {} }
  })
  const blockedResponse = makeHttpResponse()
  await blocked.login({ body: { username: 'staff', password: 'bad' } }, blockedResponse)
  assert.equal(blockedResponse.statusCode, 429)
  assert.equal(blockedResponse.body.code, 'LOGIN_RATE_LIMITED')
  assert.equal(blockedResponse.body.details.lockDuration, 1)
  assert.equal(blockedResponse.getHeader('X-Login-Attempts-Remaining'), 0)

  const unavailable = new AuthController({
    connected: () => false,
    recordLoginFailure: () => assert.fail('不可用状态不得计入登录失败'),
    response,
    logger: { error() {} }
  })
  const unavailableResponse = makeHttpResponse()
  await unavailable.login({ body: { username: 'staff', password: 'secret' } }, unavailableResponse)
  assert.equal(unavailableResponse.statusCode, 503)
  assert.equal(unavailableResponse.body.message, '服务暂时不可用，请稍后再试')
})

test('login route preserves request validation middleware and delegates to controller', () => {
  const route = fs.readFileSync(path.join(__dirname, '../src/routes/auth.js'), 'utf8')
  assert.match(route, /router\.post\('\/login', validateBody\([\s\S]*?username: \{ type: 'string', required: true, minLength: 3, maxLength: 50 \}[\s\S]*?password: \{ type: 'string', required: true, minLength: 4, maxLength: 100 \}[\s\S]*?\}\), authController\.login\.bind\(authController\)\)/)
})
