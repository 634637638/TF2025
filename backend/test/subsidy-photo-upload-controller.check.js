'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const Controller = require('../src/controllers/subsidy-photos.controller')
const UploadService = require('../src/services/subsidy-photo-upload.service')

const routeSource = fs.readFileSync(path.join(__dirname, '../src/routes/subsidy.js'), 'utf8')
const response = () => ({
  status(code) { this.statusCode = code; return this },
  json(body) { this.body = body; return this }
})

test('subsidy photo upload route retains auth, upload permission, multer and controller delegation', () => {
  assert.match(routeSource, /router\.post\('\/upload\/photo', unifiedAuth, requireSubsidyUpload, handleSubsidyPhotoUpload, subsidyPhotosController\.uploadPhoto\.bind\(subsidyPhotosController\)\)/)
  assert.match(routeSource, /upload\.single\('file'\)/)
})

test('subsidy photo upload controller preserves missing-file, success, and conversion error responses', async () => {
  const controller = new Controller({
    uploadService: { async upload(file, body, userId) {
      if (!file) return { status: 400, message: '没有上传文件' }
      assert.deepEqual([body.sale_time, userId], ['2026-11-08', 9])
      return { status: 200, data: { url: '/signed/photo.jpg', filename: 'subsidy/photo.jpg', size: 23 } }
    } },
    logger: { error() {} }
  })
  const missing = response()
  await controller.uploadPhoto({ body: {}, user: { id: 9 } }, missing)
  assert.equal(missing.statusCode, 400)
  assert.equal(missing.body.success, false)
  assert.equal(missing.body.message, '没有上传文件')

  const success = response()
  await controller.uploadPhoto({ file: {}, body: { sale_time: '2026-11-08' }, user: { id: 9 } }, success)
  assert.equal(success.body.success, true)
  assert.equal(success.body.message, '照片上传成功')
  assert.deepEqual(success.body.data, { url: '/signed/photo.jpg', filename: 'subsidy/photo.jpg', size: 23 })

  controller.uploadService.upload = async () => ({ status: 500, message: 'HEIC格式转换失败' })
  const failed = response()
  await controller.uploadPhoto({ file: {}, body: {}, user: { id: 9 } }, failed)
  assert.equal(failed.statusCode, 500)
  assert.equal(failed.body.success, false)
  assert.equal(failed.body.message, '服务器内部错误，请稍后重试')
})

test('subsidy photo upload service renames ordinary images and returns a protected relative URL', async () => {
  const events = []
  const service = new UploadService({
    fileSystem: {
      mkdirSync(directory, options) { events.push(['mkdir', directory, options]) },
      renameSync(source, destination) { events.push(['rename', source, destination]) }
    },
    uploadSubdir: (...parts) => path.join('/uploads', ...parts),
    getNaming: () => ({ displayName: '张三', directoryName: '张三IMEI1', isSecondHand: false }),
    createProtectedUrl(url, userId) { events.push(['sign', url, userId]); return '/signed/photo.jpg' },
    now: () => 123,
    logger: { error() {} }
  })

  const result = await service.upload({
    path: '/uploads/subsidy/temp.jpg', originalname: 'photo.JPG', size: 23
  }, { sale_time: '2026/11/08 10:10' }, 9)
  assert.deepEqual(result, {
    status: 200,
    data: { url: '/signed/photo.jpg', filename: 'subsidy/张三IMEI1/张三-IMEI1-202611081010-123.jpg', size: 23 }
  })
  assert.deepEqual(events[1], ['rename', '/uploads/subsidy/temp.jpg', '/uploads/subsidy/张三IMEI1/张三-IMEI1-202611081010-123.jpg'])
  assert.deepEqual(events[2], ['sign', '/uploads/subsidy/张三IMEI1/张三-IMEI1-202611081010-123.jpg', 9])
})

test('subsidy photo upload service converts HEIC, removes the temporary source, and cleans failed conversions', async () => {
  const files = new Set(['/tmp/photo.heic'])
  const calls = []
  const service = new UploadService({
    fileSystem: {
      mkdirSync() {},
      readFileSync(file) { calls.push(['read', file]); return Buffer.from('heic') },
      writeFileSync(file) { calls.push(['write', file]) },
      unlinkSync(file) { calls.push(['unlink', file]); files.delete(file) },
      existsSync(file) { return files.has(file) }
    },
    uploadSubdir: () => '/uploads/subsidy/record',
    getNaming: () => ({ displayName: '客户', directoryName: '客户IMEI', isSecondHand: false }),
    convert: async options => { calls.push(['convert', options.format, options.quality]); return Buffer.from('jpeg') },
    createProtectedUrl: () => '/signed/heic.jpg',
    now: () => 4,
    logger: { error() {} }
  })
  const converted = await service.upload({ path: '/tmp/photo.heic', originalname: 'photo.HEIC', size: 8 }, {}, 2)
  assert.equal(converted.data.filename, 'subsidy/客户IMEI/客户-IMEI--4.jpg')
  assert.ok(calls.some(call => call[0] === 'convert' && call[1] === 'JPEG' && call[2] === 0.9))
  assert.ok(calls.some(call => call[0] === 'write' && call[1].endsWith('.jpg')))
  assert.deepEqual(calls.find(call => call[0] === 'unlink'), ['unlink', '/tmp/photo.heic'])

  const failedCalls = []
  const failing = new UploadService({
    fileSystem: {
      mkdirSync() {}, readFileSync() { return Buffer.from('heic') },
      existsSync() { return true }, unlinkSync(file) { failedCalls.push(['unlink', file]) }
    },
    uploadSubdir: () => '/uploads/subsidy/record',
    getNaming: () => ({ displayName: '客户', directoryName: '客户IMEI', isSecondHand: false }),
    convert: async () => { throw new Error('convert failed') },
    removeEmptyDirectories(relativePath) { failedCalls.push(['cleanup', relativePath]) },
    now: () => 4,
    logger: { error() {} }
  })
  assert.deepEqual(await failing.upload({ path: '/tmp/bad.heic', originalname: 'bad.heic' }, {}, 2), {
    status: 500, message: 'HEIC格式转换失败'
  })
  assert.deepEqual(failedCalls, [
    ['unlink', '/tmp/bad.heic'],
    ['cleanup', path.posix.join('subsidy', '客户IMEI', '客户-IMEI--4.heic')]
  ])
})
