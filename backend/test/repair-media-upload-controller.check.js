'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const RepairMediaUploadController = require('../src/controllers/repair-media-upload.controller')
const RepairMediaUploadService = require('../src/services/repair-media-upload.service')

const response = () => ({
  status(code) { this.statusCode = code; return this },
  json(body) { this.body = body; return this }
})

test('repair media upload route preserves authentication and either create or edit permission', () => {
  const route = fs.readFileSync(path.join(__dirname, '../src/routes/repairs.js'), 'utf8')
  assert.match(route, /router\.post\([\s\S]{0,160}'\/upload\/media',[\s\S]{0,120}unifiedAuth,[\s\S]{0,100}requireAnyPermission\(\['repairs:create', 'repairs:edit'\]\),[\s\S]{0,130}repairMediaUploadController\.parseUpload\.bind\(repairMediaUploadController\),[\s\S]{0,100}repairMediaUploadController\.upload\.bind\(repairMediaUploadController\)/)
})

test('repair media upload service validates all file contents before returning signed canonical media', async () => {
  const calls = []
  const files = [
    { filename: '7_a.jpg', originalname: 'photo.jpg', mimetype: 'image/jpeg', size: 12 },
    { filename: '7_b.mp4', originalname: 'video.mp4', mimetype: '', size: 34 }
  ]
  const service = new RepairMediaUploadService({
    async validateFile(file, kinds) { calls.push([file.filename, kinds]); return true },
    async removeFiles(uploads) { calls.push(['remove', uploads.length]) },
    buildMediaUrl(relativePath, userId) { return `/signed/${userId}/${relativePath}` },
    mediaTypeFromUrl: filename => filename.endsWith('.mp4') ? 'video' : 'image'
  })

  assert.deepEqual(await service.upload(files, 7), {
    files: [
      { url: '/signed/7/temp/7_a.jpg', name: 'photo.jpg', type: 'image/jpeg', size: 12 },
      { url: '/signed/7/temp/7_b.mp4', name: 'video.mp4', type: 'video', size: 34 }
    ]
  })
  assert.deepEqual(calls, [['7_a.jpg', ['image', 'video']], ['7_b.mp4', ['image', 'video']]])
})

test('repair media upload service rejects empty and mismatched files and removes rejected files', async () => {
  const removed = []
  const service = new RepairMediaUploadService({
    validateFile: async file => file.valid,
    async removeFiles(files) { removed.push(...files) },
    buildMediaUrl: () => '/signed',
    mediaTypeFromUrl: () => 'image'
  })

  await assert.rejects(service.upload([], 7), error => error.statusCode === 400 && error.code === 'BAD_REQUEST')
  const files = [{ valid: true }, { valid: false }]
  await assert.rejects(service.upload(files, 7), error => error.message === '文件内容与图片或视频格式不匹配')
  assert.deepEqual(removed, files)
})

test('repair media upload controller maps parser errors, validation errors and unexpected failures', async () => {
  const events = []
  const controller = new RepairMediaUploadController({
    uploadParser(_req, _res, callback) { callback(Object.assign(new Error('文件过大'), { status: 413 })) },
    service: {
      async removeUploadedFiles(files) { events.push(['remove', files]) },
      async upload(files, userId) { events.push(['upload', files, userId]); return { files: [] } }
    },
    response: {
      error(res, message, status) { res.statusCode = status; res.body = { message }; return res },
      badRequest(res, message) { res.statusCode = 400; res.body = { message }; return res },
      success(res, data, message) { res.body = { data, message }; return res },
      serverError(res, message) { res.statusCode = 500; res.body = { message }; return res }
    },
    logger: { warn() {}, error() {} }
  })

  const parseResponse = response()
  await controller.parseUpload({ files: ['partial'] }, parseResponse, () => assert.fail('parser error must not continue'))
  assert.equal(parseResponse.statusCode, 413)
  assert.deepEqual(events.shift(), ['remove', ['partial']])

  const success = response()
  await controller.upload({ files: [], user: { id: 7 } }, success)
  assert.deepEqual(success.body, { data: { files: [] }, message: '媒体上传成功' })

  controller.service.upload = async () => { throw Object.assign(new Error('请选择图片或视频'), { code: 'BAD_REQUEST' }) }
  const badRequest = response()
  await controller.upload({ files: [], user: { id: 7 } }, badRequest)
  assert.equal(badRequest.statusCode, 400)

  controller.service.upload = async () => { throw new Error('disk unavailable') }
  const failed = response()
  await controller.upload({ files: ['file'], user: { id: 7 } }, failed)
  assert.equal(failed.statusCode, 500)
})
