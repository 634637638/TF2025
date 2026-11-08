'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const RepairMediaCleanupController = require('../src/controllers/repair-media-cleanup.controller')
const RepairMediaCleanupService = require('../src/services/repair-media-cleanup.service')

const response = () => ({
  status(code) { this.statusCode = code; return this },
  json(body) { this.body = body; return this }
})

test('repair media cleanup route retains authentication and create/edit permissions while delegating to controller', () => {
  const route = fs.readFileSync(path.join(__dirname, '../src/routes/repairs.js'), 'utf8')
  assert.match(route, /router\.post\('\/upload\/cleanup', unifiedAuth, requireAnyPermission\(\['repairs:create', 'repairs:edit'\]\), repairMediaCleanupController\.cleanup\.bind\(repairMediaCleanupController\)\)/)
})

test('repair media cleanup validates ownership for every URL before touching files', async () => {
  const calls = []
  const service = new RepairMediaCleanupService({
    getRelativePath(url) { return url },
    resolvePath(url) { return url },
    filesystem: { promises: {
      async stat(filePath) { calls.push(['stat', filePath]); return { isFile: () => true, mtimeMs: 1000 } },
      async unlink(filePath) { calls.push(['unlink', filePath]) }
    } },
    now: () => 2000
  })

  await assert.rejects(service.cleanup(['repairs/temp/7_ok.png', 'repairs/temp/8_other.png'], 7), error => (
    error.statusCode === 403 && error.code === 'REPAIR_MEDIA_OWNER_REQUIRED'
  ))
  assert.deepEqual(calls, [])

  await assert.rejects(service.cleanup(['repairs/7_saved.png'], 7), error => error.code === 'REPAIR_MEDIA_OWNER_REQUIRED')
  assert.deepEqual(calls, [])
})

test('repair media cleanup deletes only recent regular files and ignores missing files', async () => {
  const calls = []
  const service = new RepairMediaCleanupService({
    getRelativePath: url => url,
    resolvePath: url => `/uploads/${url}`,
    filesystem: { promises: {
      async stat(filePath) {
        calls.push(['stat', filePath])
        if (filePath.endsWith('missing.png')) throw Object.assign(new Error('missing'), { code: 'ENOENT' })
        if (filePath.endsWith('old.png')) return { isFile: () => true, mtimeMs: 0 }
        if (filePath.endsWith('directory')) return { isFile: () => false, mtimeMs: 1900 }
        return { isFile: () => true, mtimeMs: 1000 }
      },
      async unlink(filePath) { calls.push(['unlink', filePath]) }
    } },
    now: () => 1000 + 2 * 60 * 60 * 1000
  })

  await service.cleanup([
    'repairs/temp/7_recent.png',
    'repairs/temp/7_old.png',
    'repairs/temp/7_directory',
    'repairs/temp/7_missing.png'
  ], 7)
  assert.deepEqual(calls.filter(([method]) => method === 'unlink'), [
    ['unlink', '/uploads/repairs/temp/7_recent.png']
  ])
})

test('repair media cleanup propagates filesystem failures other than missing-file errors', async () => {
  const service = new RepairMediaCleanupService({
    getRelativePath: url => url,
    resolvePath: url => url,
    filesystem: { promises: {
      async stat() { throw Object.assign(new Error('permission denied'), { code: 'EACCES' }) },
      async unlink() { assert.fail('unlink must not run after stat failure') }
    } }
  })

  await assert.rejects(service.cleanup(['repairs/temp/7_recent.png'], 7), error => error.code === 'EACCES')
})

test('repair media cleanup controller preserves success, ownership denial and server-error responses', async () => {
  const successController = new RepairMediaCleanupController({
    service: { async cleanup(files, userId) { assert.deepEqual(files, ['url']); assert.equal(userId, 7) } }
  })
  const success = response()
  await successController.cleanup({ body: { files: ['url'] }, user: { id: 7 } }, success)
  assert.equal(success.body.message, '未保存维修媒体已清理')
  assert.equal('data' in success.body, false)

  const ownerController = new RepairMediaCleanupController({
    service: { async cleanup() { throw Object.assign(new Error('只能清理本人上传的维修临时媒体'), { code: 'REPAIR_MEDIA_OWNER_REQUIRED' }) } }
  })
  const denied = response()
  await ownerController.cleanup({ body: {}, user: { id: 7 } }, denied)
  assert.deepEqual(denied.body, {
    success: false, message: '只能清理本人上传的维修临时媒体', code: 'REPAIR_MEDIA_OWNER_REQUIRED'
  })
  assert.equal(denied.statusCode, 403)

  const failedController = new RepairMediaCleanupController({
    service: { async cleanup() { throw new Error('filesystem unavailable') } },
    logger: { error() {} }
  })
  const failed = response()
  await failedController.cleanup({ body: {}, user: { id: 7 } }, failed)
  assert.equal(failed.statusCode, 500)
  assert.equal(failed.body.message, '服务器内部错误，请稍后重试')
})
