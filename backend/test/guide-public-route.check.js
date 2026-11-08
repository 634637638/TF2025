const test = require('node:test')
const assert = require('node:assert/strict')

const createResponse = () => ({
  headers: {},
  set(name, value) {
    if (typeof name === 'string') this.headers[name] = value
    else Object.assign(this.headers, name)
    return this
  },
  status(code) {
    this.statusCode = code
    return this
  },
  json(body) {
    this.body = body
    return this
  },
  sendFile(filePath) {
    this.filePath = filePath
    return this
  }
})

test('公开导航 route 全部委托给 controller', () => {
  const fs = require('node:fs')
  const path = require('node:path')
  const route = fs.readFileSync(path.join(__dirname, '../src/routes/guide-public.js'), 'utf8')
  assert.match(route, /router\.get\('\/', guidePublicController\.list\.bind\(guidePublicController\)\)/)
  assert.match(route, /router\.post\('\/categories\/:id\/unlock', guidePublicController\.unlock\.bind\(guidePublicController\)\)/)
  assert.match(route, /router\.get\('\/categories\/:id', guidePublicController\.getCategory\.bind\(guidePublicController\)\)/)
  assert.match(route, /router\.get\('\/files\/:id', guidePublicController\.getFile\.bind\(guidePublicController\)\)/)
  assert.doesNotMatch(route, /async\s*\(/)
})

test('公开导航 controller 保留服务调用、缓存头和不存在响应', async () => {
  const GuidePublicController = require('../src/controllers/guide-public.controller')
  const calls = []
  const controller = new GuidePublicController({
    service: {
      async listPublicGuide() {
        calls.push('list')
        return { categories: [] }
      },
      async unlockCategory(id, password) {
        calls.push(['unlock', id, password])
        return { token: 'token' }
      },
      async getProtectedCategory(id, token) {
        calls.push(['category', id, token])
        return null
      }
    }
  })

  const listResponse = createResponse()
  await controller.list({}, listResponse)
  assert.equal(listResponse.headers['Cache-Control'], 'no-store')
  assert.equal(listResponse.body.success, true)

  const unlockResponse = createResponse()
  await controller.unlock({ params: { id: '7' }, body: { password: 'secret' } }, unlockResponse)
  assert.deepEqual(calls[1], ['unlock', 7, 'secret'])
  assert.equal(unlockResponse.headers['Cache-Control'], 'no-store')

  const categoryResponse = createResponse()
  await controller.getCategory({
    params: { id: '8' },
    get: name => name === 'X-Guide-Token' ? 'token-8' : undefined
  }, categoryResponse)
  assert.equal(categoryResponse.statusCode, 404)
  assert.deepEqual(categoryResponse.body, { success: false, message: '分类不存在', timestamp: categoryResponse.body.timestamp })
  assert.deepEqual(calls[2], ['category', 8, 'token-8'])
})

test('公开分类导航文件无需签名，且仍使用受控目录和安全响应头', async () => {
  const GuidePublicController = require('../src/controllers/guide-public.controller')
  let verificationCalls = 0
  const controller = new GuidePublicController({
    service: { async getFileAccessRecord(id) {
      assert.equal(id, 23)
      return {
        requires_token: false,
        file_url: '/uploads/guide/public.pdf',
        file_mime: 'application/pdf',
        file_name: '指南.pdf'
      }
    } },
    verifyFileToken() { verificationCalls += 1; return false },
    resolveFilePath: () => '/uploads-root/guide/public.pdf',
    guideRoot: '/uploads-root/guide',
    fileExists: () => true
  })
  const response = createResponse()
  await controller.getFile({ params: { id: '23' }, get: () => undefined }, response)

  assert.equal(verificationCalls, 0)
  assert.equal(response.filePath, '/uploads-root/guide/public.pdf')
  assert.equal(response.headers['Cache-Control'], 'private, no-store')
  assert.equal(response.headers['X-Content-Type-Options'], 'nosniff')
  assert.match(response.headers['Content-Disposition'], /attachment/)
})

test('密码分类导航文件拒绝缺失或无效签名并接受有效短时签名', async () => {
  const GuidePublicController = require('../src/controllers/guide-public.controller')
  const verificationCalls = []
  const controller = new GuidePublicController({
    service: { async getFileAccessRecord() {
      return {
        requires_token: true,
        file_url: '/uploads/guide/protected.png',
        file_mime: 'image/png',
        file_name: '保护图片.png'
      }
    } },
    verifyFileToken: (...args) => {
      verificationCalls.push(args)
      return args[2] === 'valid-signature'
    },
    resolveFilePath: () => '/uploads-root/guide/protected.png',
    guideRoot: '/uploads-root/guide',
    fileExists: () => true
  })

  for (const headers of [
    {},
    { 'X-Guide-File-Expires': '1900000000', 'X-Guide-File-Signature': 'invalid-signature' }
  ]) {
    const response = createResponse()
    await controller.getFile({ params: { id: '24' }, get: name => headers[name] }, response)
    assert.equal(response.statusCode, 404)
    assert.deepEqual(response.body, { success: false, message: '资源不存在' })
  }

  const validResponse = createResponse()
  await controller.getFile({
    params: { id: '24' },
    get: name => ({
      'X-Guide-File-Expires': '1900000000',
      'X-Guide-File-Signature': 'valid-signature'
    })[name]
  }, validResponse)
  assert.equal(validResponse.filePath, '/uploads-root/guide/protected.png')
  assert.deepEqual(verificationCalls, [
    [24, undefined, undefined],
    [24, '1900000000', 'invalid-signature'],
    [24, '1900000000', 'valid-signature']
  ])
  assert.match(validResponse.headers['Content-Disposition'], /inline/)
})
