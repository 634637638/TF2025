'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const RepairMediaReadController = require('../src/controllers/repair-media-read.controller')
const RepairMediaReadService = require('../src/services/repair-media-read.service')

const response = () => ({
  headers: {},
  status(code) { this.statusCode = code; return this },
  json(body) { this.body = body; return this },
  setHeader(name, value) { this.headers[name] = value },
  sendFile(filePath, options) { this.file = filePath; this.options = options; return this }
})

test('repair media route remains signature-only and delegates the file response', () => {
  const route = fs.readFileSync(path.join(__dirname, '../src/routes/repairs.js'), 'utf8')
  assert.match(route, /router\.get\('\/media\/\*', repairMediaReadController\.read\.bind\(repairMediaReadController\)\)/)
  assert.doesNotMatch(route, /router\.get\('\/media\/\*', unifiedAuth/)
})

test('repair media read service validates signatures, path shape, upload root and file existence', () => {
  const service = new RepairMediaReadService({
    verifyAccess: payload => Number(payload.userId) === 7 && payload.relativePath === 'temp/7_image.png',
    resolveUploadPath: value => `/uploads-root/${value.replace('/uploads/', '')}`,
    getRepairDirectory: () => '/uploads-root/repairs',
    exists: value => value === '/uploads-root/repairs/temp/7_image.png'
  })
  assert.equal(service.resolve('temp/7_image.png', { user: '7', expires: '100', signature: 'sig' }), '/uploads-root/repairs/temp/7_image.png')

  assert.throws(() => service.resolve('temp/7_image.png', { user: '8' }), error => error.statusCode === 403)
  assert.throws(() => service.resolve('../secret', { user: '7' }), error => error.statusCode === 403)

  const invalidShape = new RepairMediaReadService({
    verifyAccess: () => true,
    resolveUploadPath: value => `/uploads-root/${value.replace('/uploads/', '')}`,
    getRepairDirectory: () => '/uploads-root/repairs',
    exists: value => value.endsWith('/nested/deeper/file.jpg')
  })
  assert.throws(() => invalidShape.resolve('nested/deeper/file.jpg', {}), error => error.statusCode === 400)
  assert.throws(() => invalidShape.resolve('photo.jpg', {}), error => error.statusCode === 404)
})

test('repair media read controller applies private response headers and preserves error statuses', async () => {
  const controller = new RepairMediaReadController({
    service: { resolve: () => '/uploads/repairs/temp/7_image.png' },
    logger: { error() {} }
  })
  const success = response()
  await controller.read({ params: { 0: 'temp/7_image.png' }, query: {} }, success)
  assert.equal(success.file, '/uploads/repairs/temp/7_image.png')
  assert.deepEqual(success.options, { acceptRanges: true })
  assert.deepEqual(success.headers, {
    'Cache-Control': 'private, no-store',
    'X-Content-Type-Options': 'nosniff',
    'Cross-Origin-Resource-Policy': 'same-origin'
  })

  const denied = response()
  controller.service.resolve = () => { throw Object.assign(new Error('expired'), { statusCode: 403 }) }
  controller.response = { error(res, message, status) { res.statusCode = status; res.body = { message }; return res } }
  await controller.read({ params: { 0: '' }, query: {} }, denied)
  assert.equal(denied.statusCode, 403)
})
