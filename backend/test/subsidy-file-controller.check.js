'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const Controller = require('../src/controllers/subsidy-file.controller')
const Service = require('../src/services/subsidy-file.service')

test('已签名国补照片仍核验当前门店；空绑定、字段故障和孤立旧照片不得绕过', async () => {
  let records = [{ store_id: 2, subsidy_photos: '["/uploads/subsidy/photo.jpg"]' }]
  let permissions = ['subsidy:view']
  let brokenFields = false
  const service = new Service({ uploadsRoot: () => '/uploads', fileSystem: { existsSync: () => true },
    repository: { findPhotoReferences: async () => records },
    checkPermission: async (_actor, permission) => permissions.includes(permission),
    masking: { async getUserFieldPermissions() {
      if (brokenFields) throw new Error('字段配置读取失败')
      return { hiddenFields: [] }
    } }
  })
  const actor = { id: 7, store_ids: [2] }
  assert.equal(await service.getAuthorizedFilePath('subsidy/photo.jpg', actor), '/uploads/subsidy/photo.jpg')
  for (const store_ids of [[1], []]) {
    await assert.rejects(service.getAuthorizedFilePath('subsidy/photo.jpg', { ...actor, store_ids }), { statusCode: 403 })
  }
  brokenFields = true
  await assert.rejects(service.getAuthorizedFilePath('subsidy/photo.jpg', actor), /字段配置读取失败/)
  brokenFields = false
  records = []
  await assert.rejects(service.getAuthorizedFilePath('subsidy/photo.jpg', actor), { statusCode: 403 })
  permissions = ['subsidy:upload']
  assert.equal(await service.getAuthorizedFilePath('subsidy/photo.jpg', actor), '/uploads/subsidy/photo.jpg')
  await assert.rejects(service.getAuthorizedFilePath('subsidy/photo.jpg', { id: 7, store_ids: [] }), { statusCode: 403 })
})

const routeSource = fs.readFileSync(path.join(__dirname, '../src/routes/subsidy.js'), 'utf8')

const makeResponse = () => ({
  headers: {},
  setHeader(name, value) { this.headers[name] = value },
  status(code) { this.statusCode = code; return this },
  json(body) { this.body = body; return this },
  sendFile(filePath) { this.filePath = filePath; return this }
})

test('private subsidy file route keeps signature verification before controller delegation', () => {
  assert.match(routeSource, /router\.get\('\/files\/\*', authenticateSubsidyFileAccess, requireAnyPermission\(\['subsidy:view', 'subsidy:upload'\]\), subsidyFileController\.getFile\.bind\(subsidyFileController\)\)/)
  assert.match(routeSource, /namespace: 'subsidy-file',[\s\S]*?relativePath,[\s\S]*?userId: req\.query\.user/)
})

test('subsidy file service rejects invalid, escaping and missing paths', () => {
  const service = new Service({
    uploadsRoot: () => '/uploads',
    fileSystem: { existsSync: target => target === '/uploads/subsidy/valid/photo.jpg' }
  })

  assert.throws(() => service.getFilePath('../outside.jpg'), { statusCode: 400, message: '无效的文件路径' })
  assert.throws(() => service.getFilePath(''), { statusCode: 400, message: '无效的文件路径' })
  assert.throws(() => service.getFilePath('subsidy/valid/missing.jpg'), { statusCode: 404, message: '文件不存在' })
  assert.equal(service.getFilePath('subsidy/valid/photo.jpg'), '/uploads/subsidy/valid/photo.jpg')
})

test('subsidy file controller sends private-file headers and the resolved file', async () => {
  const controller = new Controller({ service: { getAuthorizedFilePath: () => '/uploads/subsidy/photo.jpg' } })
  const response = makeResponse()

  await controller.getFile({ params: { 0: 'subsidy/photo.jpg' } }, response)

  assert.equal(response.filePath, '/uploads/subsidy/photo.jpg')
  assert.deepEqual(response.headers, {
    'Cache-Control': 'private, no-store',
    'X-Content-Type-Options': 'nosniff',
    'Cross-Origin-Resource-Policy': 'same-origin'
  })
})

test('subsidy file controller maps expected path failures and logs unexpected errors', async () => {
  const errors = []
  const controller = new Controller({
    service: { getAuthorizedFilePath() { throw Object.assign(new Error('文件不存在'), { statusCode: 404 }) } },
    logger: { error(...args) { errors.push(args) } }
  })
  const missing = makeResponse()
  await controller.getFile({ params: { 0: 'gone.jpg' } }, missing)
  assert.equal(missing.statusCode, 404)
  assert.deepEqual(missing.body, { success: false, message: '文件不存在' })

  controller.service.getAuthorizedFilePath = () => { throw new Error('unexpected') }
  const failed = makeResponse()
  await controller.getFile({ params: { 0: 'broken.jpg' } }, failed)
  assert.equal(failed.statusCode, 500)
  assert.deepEqual(failed.body, { success: false, message: 'unexpected' })
  assert.equal(errors.length, 1)
})
