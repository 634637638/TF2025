'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const SharedController = require('../src/controllers/shared.controller')

const createResponse = () => ({
  headers: {},
  status(code) { this.statusCode = code; return this },
  json(body) { this.body = body; return this },
  setHeader(name, value) { this.headers[name] = value; return this },
  sendFile(filePath) { this.filePath = filePath; return this }
})

test('分享 routes 保留公开签名附件、权限和字段权限并委托业务 handler', () => {
  const route = fs.readFileSync(path.join(__dirname, '../src/routes/shared.js'), 'utf8')

  assert.ok(route.indexOf("'/files/:filename'") < route.indexOf('router.use(unifiedAuth)'))
  assert.match(route, /requirePermission\('shared:view'\), sharedController\.list\.bind/)
  assert.match(route, /requirePermission\('shared:create'\), sharedController\.rejectHiddenWrites\(SharedController\.FIELD_WRITE_IDS\)/)
  assert.match(route, /requireAnyPermission\(\['shared:create', 'shared:edit', 'shared:manage'\]\), sharedController\.requireVisibleField\('post_info\.attachments'\)/)
  assert.equal((route.match(/sharedController\.[A-Za-z]+\.bind\(sharedController\)/g) || []).length, 15)
  assert.doesNotMatch(route, /async\s*\(/)
})

test('分享列表拒绝隐藏筛选并基于可见字段执行搜索、遮蔽和签名', async () => {
  let listArgs
  const signatures = []
  const controller = new SharedController({
    service: {
      async list(userId, options) {
        listArgs = { userId, options }
        return {
          rows: [{ title: '私有标题', content: '内容 /uploads/shared/7_image.jpg', attachments: [{ url: '/uploads/shared/7_image.jpg' }] }],
          pagination: { page: 1 }
        }
      }
    },
    masking: {
      async getUserFieldPermissions() { return { hiddenFields: ['post_info.title'] } },
      filterSensitiveFields(rows) { return rows }
    },
    fileUrlFactory(storageUrl, userId) {
      signatures.push([storageUrl, userId])
      return `/signed/${userId}`
    }
  })
  const response = createResponse()

  await controller.list({ user: { id: 7 }, query: { keyword: '内容', page_size: '12' } }, response)

  assert.equal(listArgs.userId, 7)
  assert.deepEqual(listArgs.options.search_fields, ['content'])
  assert.equal(listArgs.options.page_size, '12')
  assert.equal(response.body.data[0].title, null)
  assert.equal(response.body.data[0].attachments[0].url, '/signed/7')
  assert.match(response.body.data[0].content, /\/signed\/7/)
  assert.deepEqual(response.body.pagination, { page: 1 })
  assert.equal(signatures.length, 2)

  const deniedController = new SharedController({
    service: { async list() { assert.fail('隐藏筛选字段不应查询') } },
    masking: {
      async getUserFieldPermissions() { return { hiddenFields: ['post_info.category'] } },
      filterSensitiveFields(rows) { return rows }
    }
  })
  const deniedResponse = createResponse()
  await deniedController.list({ user: { id: 7 }, query: { category: '内部' } }, deniedResponse)
  assert.equal(deniedResponse.statusCode, 403)
  assert.equal(deniedResponse.body.field, 'post_info.category')
})

test('分享附件验证签名、引用权限、上传者归属和安全响应头', async () => {
  const controller = new SharedController({
    service: { async canAccessAttachment() { return { referenced: true, allowed: true } } },
    uploadDir: '/uploads/shared',
    uploadUrl: (_scope, filename) => `/uploads/shared/${filename}`,
    fileAccessVerifier: payload => payload.filename === '7_photo.jpg' && payload.userId === 7,
    filesystem: { existsSync: () => true }
  })
  const response = createResponse()
  const request = {
    params: { filename: '7_photo.jpg' },
    query: { user: '7', expires: '1800000000', signature: 'test-signature' }
  }
  await new Promise((resolve, reject) => controller.verifySharedFileAccess(request, response, error => error ? reject(error) : resolve()))
  await new Promise((resolve, reject) => controller.canAccessAttachment(request, response, error => error ? reject(error) : resolve()))
  controller.readAttachment(request, response)

  assert.equal(response.filePath, '/uploads/shared/7_photo.jpg')
  assert.equal(response.headers['Cache-Control'], 'private, no-store')
  assert.equal(response.headers['X-Content-Type-Options'], 'nosniff')
  assert.equal(response.headers['Cross-Origin-Resource-Policy'], 'same-origin')
})

test('分享 HEIC 上传转换失败时删除源文件并返回客户端错误', async () => {
  const removed = []
  const existingFiles = new Set(['/uploads/shared/7_photo.heic', '/uploads/shared/7_photo.jpg'])
  const controller = new SharedController({
    uploadDir: '/uploads/shared',
    converter: async () => { throw new Error('decode failed') },
    filesystem: {
      readFileSync: () => Buffer.from('test'),
      existsSync(filePath) { return existingFiles.has(filePath) },
      unlinkSync(filePath) { removed.push(filePath); existingFiles.delete(filePath) }
    }
  })
  const response = createResponse()

  await controller.upload({
    user: { id: 7 },
    files: [{ filename: '7_photo.heic', path: '/uploads/shared/7_photo.heic', originalname: 'photo.heic', mimetype: 'image/heic' }]
  }, response)

  assert.deepEqual(removed, ['/uploads/shared/7_photo.heic', '/uploads/shared/7_photo.jpg'])
  assert.equal(response.statusCode, 500)
  assert.equal(response.body.message, '服务器内部错误，请稍后重试')
})

test('分享创建与删除根据用户权限计算管理能力', async () => {
  const calls = []
  const controller = new SharedController({
    service: {
      async create(...args) { calls.push(['create', ...args]); return { id: 5, title: '帖子' } },
      async remove(...args) { calls.push(['remove', ...args]) }
    },
    masking: {
      async getUserFieldPermissions() { return { hiddenFields: [] } },
      filterSensitiveFields(rows) { return rows }
    },
    fileUrlFactory: value => value
  })
  const createResult = createResponse()
  await controller.create({ user: { id: 8, permissions: ['shared:manage'] }, body: { title: '帖子' } }, createResult)
  await controller.remove({ user: { id: 8, permissions: [] }, params: { id: '5' } }, createResponse())

  assert.deepEqual(calls, [
    ['create', 8, true, { title: '帖子' }],
    ['remove', 5, 8, false]
  ])
})
