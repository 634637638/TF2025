const test = require('node:test')
const assert = require('node:assert/strict')
const CsrfController = require('../src/controllers/csrf.controller')
const { CsrfTokenService } = require('../src/services/csrf-token.service')

const createResponse = () => ({
  headers: {},
  setHeader(name, value) {
    this.headers[name] = value
  },
  status(code) {
    this.statusCode = code
    return this
  },
  json(body) {
    this.body = body
    return this
  }
})

test('CSRF token service persists before caching and verifies against the same user', async () => {
  const databaseCalls = []
  const service = new CsrfTokenService({
    getDatabaseConnection: () => ({
      async execute(sql, params) {
        databaseCalls.push({ sql, params })
        if (sql.startsWith('INSERT')) throw new Error('database unavailable')
        if (sql.startsWith('SELECT')) {
          return params[0] === 7 && params[1] === 'valid-token'
            ? [[{ token_id: 'persisted-id' }], []]
            : [[], []]
        }
        return [{ affectedRows: 0 }, []]
      }
    })
  })

  await assert.rejects(service.storeCSRFToken(7, 'failed-id', 'failed-token'), /database unavailable/)
  assert.equal(service.csrfTokens.has('failed-id'), false)

  assert.equal(await service.verifyCSRFToken(7, 'valid-token'), true)
  assert.equal(service.csrfTokens.get('persisted-id').userId, 7)
  assert.equal(await service.verifyCSRFToken(8, 'valid-token'), false)
  assert.equal(databaseCalls[0].params[1], 7)
  assert.deepEqual(databaseCalls[1].params, [7, 'valid-token'])
})

test('CSRF token cleanup deletes expired map entries by token id', async () => {
  const service = new CsrfTokenService()
  service.csrfTokens.set('expired-token-id', { userId: 7, token: 'expired-token', createdAt: 1, expiresAt: 1 })

  await service.cleanupExpiredTokens(7)

  assert.equal(service.csrfTokens.has('expired-token-id'), false)
})

test('CSRF controller 保持匿名 token headers、成功响应与缺失 token 的 400', async () => {
  const controller = new CsrfController({
    CSRF_CONFIG: { TOKEN_EXPIRY: 3600 },
    async issueToken(req) {
      assert.equal(req.ip, '127.0.0.1')
      return { token: 'token-value', tokenId: 'token-id', isTemporary: true }
    },
    async verifyRequestToken(_req, token) {
      return token === 'token-value'
    }
  })
  const response = createResponse()

  await controller.generateToken({ ip: '127.0.0.1' }, response)
  assert.deepEqual(response.headers, {
    'X-CSRF-Token': 'token-value',
    'X-CSRF-Token-Id': 'token-id'
  })
  assert.deepEqual(response.body, {
    success: true,
    message: '临时 CSRF Token 生成成功',
    data: {
      csrfToken: 'token-value',
      tokenId: 'token-id',
      expiresIn: 3600,
      isTemporary: true
    }
  })

  await controller.verifyToken({ body: {} }, response)
  assert.equal(response.statusCode, 400)
  assert.deepEqual(response.body, { success: false, message: '缺少 CSRF Token' })

  await controller.verifyToken({ body: { token: 'token-value' } }, response)
  assert.deepEqual(response.body, { success: true, message: 'CSRF Token 验证成功' })
})
