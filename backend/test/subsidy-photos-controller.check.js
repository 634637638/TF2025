'use strict'

const assert = require('node:assert/strict')
const crypto = require('node:crypto')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const Controller = require('../src/controllers/subsidy-photos.controller')
const Service = require('../src/services/subsidy-photos.service')
const Repository = require('../src/repositories/subsidy-photos.repository')

const routeSource = fs.readFileSync(path.join(__dirname, '../src/routes/subsidy.js'), 'utf8')

test('subsidy record deletion route preserves authentication, delete permission and controller delegation', () => {
  assert.match(routeSource, /router\.delete\('\/:id', unifiedAuth, requirePermission\('subsidy:delete'\), subsidyPhotosController\.deleteRecord\.bind\(subsidyPhotosController\)\)/)
})

test('subsidy photo route preserves upload permission and controller delegation', () => {
  assert.match(routeSource, /router\.get\('\/:id\/photos', unifiedAuth, requireSubsidyUpload, subsidyPhotosController\.getPhotos\.bind\(subsidyPhotosController\)\)/)
})

test('subsidy photo update route preserves upload permission and delegates to controller', () => {
  assert.match(routeSource, /router\.put\('\/:id\/photos', unifiedAuth, requireSubsidyUpload, subsidyPhotosController\.updatePhotos\.bind\(subsidyPhotosController\)\)/)
})

test('subsidy photo update controller preserves validation, missing-record, success and failure responses', async () => {
  const makeResponse = () => ({
    status(code) { this.statusCode = code; return this },
    json(body) { this.body = body; return this }
  })
  const controller = new Controller({
    service: {
      async updatePhotos(id, photos, deleted, userId) {
        assert.deepEqual([id, photos, deleted, userId], ['4', ['photo'], undefined, 7])
        return { status: 400, message: '国补照片格式不正确' }
      }
    },
    logger: { error() {} }
  })
  const invalid = makeResponse()
  await controller.updatePhotos({ params: { id: '4' }, body: { subsidy_photos: ['photo'] }, user: { id: 7 } }, invalid)
  assert.equal(invalid.statusCode, 400)
  assert.deepEqual(invalid.body, { success: false, message: '国补照片格式不正确' })

  controller.service.updatePhotos = async () => ({ status: 404, message: '国补记录不存在' })
  const missing = makeResponse()
  await controller.updatePhotos({ params: { id: '4' }, body: {}, user: { id: 7 } }, missing)
  assert.equal(missing.statusCode, 404)

  controller.service.updatePhotos = async () => ({ status: 200 })
  const success = makeResponse()
  await controller.updatePhotos({ params: { id: '4' }, body: {}, user: { id: 7 } }, success)
  assert.deepEqual(success.body, { success: true, message: '照片保存成功' })

  controller.service.updatePhotos = async () => { throw Object.assign(new Error('bad signature'), { statusCode: 400 }) }
  const failure = makeResponse()
  await controller.updatePhotos({ params: { id: '4' }, body: {}, user: { id: 7 } }, failure)
  assert.equal(failure.statusCode, 400)
  assert.deepEqual(failure.body, { success: false, message: 'bad signature' })
})

test('subsidy photo update service locks and commits before removing obsolete files and invalidating cache', async () => {
  const events = []
  const files = new Set(['/uploads/subsidy/old.jpg'])
  const service = new Service({
    repository: {
      async withConnection(operation) {
        const connection = {
          async beginTransaction() { events.push('begin') },
          async commit() { events.push('commit') },
          async rollback() { events.push('rollback') },
          release() { events.push('release') }
        }
        try {
          return await operation(connection)
        } finally {
          connection.release()
        }
      },
      async getPhotosForUpdate(connection, id) {
        events.push(['lock', id])
        return { subsidy_photos: JSON.stringify(['/uploads/subsidy/old.jpg']) }
      },
      async updatePhotos(connection, id, photos) { events.push(['update', id, photos]) },
      async hasOtherPhotoReference() { return false }
    },
    uploadsRoot: () => '/uploads',
    subsidyRoot: () => '/uploads/subsidy',
    fileSystem: {
      existsSync(file) { return files.has(file) || file === '/uploads/subsidy' },
      unlinkSync(file) { events.push(['unlink', file]); files.delete(file) },
      readdirSync() { return [] },
      rmdirSync(directory) { events.push(['rmdir', directory]) }
    },
    invalidateCache(route) { events.push(['cache', route]) },
    logger: { error() {}, warn() {} }
  })

  assert.deepEqual(await service.updatePhotos('12', [], [], 7), { status: 200 })
  assert.deepEqual(events.slice(0, 5), ['begin', ['lock', '12'], ['update', '12', []], 'commit', 'release'])
  assert.deepEqual(events.slice(5), [
    ['unlink', '/uploads/subsidy/old.jpg'],
    ['cache', '/subsidy']
  ])
  assert.equal(files.has('/uploads/subsidy/old.jpg'), false)
})

test('subsidy photo update service rejects a removed-file list that does not belong to the record and rolls back', async () => {
  const events = []
  const service = new Service({
    repository: {
      async withConnection(operation) {
        const connection = {
          async beginTransaction() { events.push('begin') },
          async commit() { events.push('commit') },
          async rollback() { events.push('rollback') },
          release() { events.push('release') }
        }
        try {
          return await operation(connection)
        } finally {
          connection.release()
        }
      },
      async getPhotosForUpdate() { return { subsidy_photos: '[]' } },
      async updatePhotos() { events.push('update') }
    },
    uploadsRoot: () => '/uploads',
    subsidyRoot: () => '/uploads/subsidy',
    logger: { error() {}, warn() {} }
  })

  assert.deepEqual(await service.updatePhotos('12', [], ['/uploads/subsidy/other.jpg'], 7), {
    status: 400,
    message: '待删除照片不属于当前记录或仍在使用'
  })
  assert.deepEqual(events, ['begin', 'rollback', 'release'])
})

test('subsidy record deletion controller preserves missing, success and error responses', async () => {
  const makeResponse = () => ({
    status(code) { this.statusCode = code; return this },
    json(body) { this.body = body; return this }
  })
  const controller = new Controller({
    service: { async deleteRecord(id) {
      if (id === 'missing') return false
      if (id === 'failure') throw new Error('database unavailable')
      return true
    } },
    logger: { error() {} }
  })

  const missing = makeResponse()
  await controller.deleteRecord({ params: { id: 'missing' } }, missing)
  assert.equal(missing.statusCode, 404)
  assert.deepEqual(missing.body, { success: false, message: '国补记录不存在' })

  const success = makeResponse()
  await controller.deleteRecord({ params: { id: '4' } }, success)
  assert.deepEqual(success.body, { success: true, message: '删除成功' })

  const failure = makeResponse()
  await controller.deleteRecord({ params: { id: 'failure' } }, failure)
  assert.equal(failure.statusCode, 500)
  assert.deepEqual(failure.body, { success: false, message: '删除失败', error: 'database unavailable' })
})

test('subsidy record deletion service removes only safe photo paths and invalidates cache after database deletion', async () => {
  const events = []
  const files = new Set(['/uploads/subsidy/record/photo.jpg', '/uploads/outside.jpg'])
  const service = new Service({
    repository: {
      async findRecordForDelete(id) {
        events.push(['find', id])
        return { id, subsidy_photos: JSON.stringify([
          '/uploads/subsidy/record/photo.jpg',
          '/uploads/../../outside.jpg'
        ]) }
      },
      async deleteRecord(id) { events.push(['delete', id]); return true }
    },
    fileSystem: {
      existsSync(target) { return files.has(target) || target === '/uploads/subsidy/record' },
      unlinkSync(target) { events.push(['unlink', target]); files.delete(target) },
      readdirSync() { return [] },
      rmdirSync(target) { events.push(['rmdir', target]) }
    },
    uploadsRoot: () => '/uploads',
    subsidyRoot: () => '/uploads/subsidy',
    invalidateCache(pathname) { events.push(['cache', pathname]) },
    logger: { error() {} }
  })

  assert.equal(await service.deleteRecord('12'), true)
  assert.deepEqual(events.slice(0, 4), [
    ['find', '12'],
    ['delete', '12'],
    ['unlink', '/uploads/subsidy/record/photo.jpg'],
    ['rmdir', '/uploads/subsidy/record']
  ])
  assert.deepEqual(events.at(-1), ['cache', '/subsidy'])
  assert.equal(files.has('/uploads/outside.jpg'), true)
})

test('subsidy record deletion keeps the database deletion when photo metadata or cleanup is invalid', async () => {
  const errors = []
  const cacheInvalidations = []
  const deleted = []
  const service = new Service({
    repository: {
      async findRecordForDelete() { return { id: 3, subsidy_photos: '{invalid' } },
      async deleteRecord(id) { deleted.push(id) }
    },
    invalidateCache(pathname) { cacheInvalidations.push(pathname) },
    logger: { error(...args) { errors.push(args) } }
  })

  assert.equal(await service.deleteRecord(3), true)
  assert.deepEqual(deleted, [3])
  assert.deepEqual(cacheInvalidations, ['/subsidy'])
  assert.equal(errors.length, 1)
})

test('temporary photo cleanup route preserves authentication, upload permission and controller delegation', () => {
  assert.match(routeSource, /router\.post\('\/delete-temp-photos', unifiedAuth, requirePermission\('subsidy:upload'\), subsidyPhotosController\.deleteTemporaryPhotos\.bind\(subsidyPhotosController\)\)/)
})

test('temporary photo cleanup controller preserves empty, success and failure responses', async () => {
  const makeResponse = () => ({
    status(code) { this.statusCode = code; return this },
    json(body) { this.body = body; return this }
  })
  const controller = new Controller({
    service: {
      async deleteTemporaryPhotos(photos, userId) {
        assert.equal(userId, 7)
        if (!photos) return { empty: true, deleted: [], failed: [] }
        return { empty: false, deleted: ['subsidy/photo.jpg'], failed: ['invalid'] }
      }
    }
  })
  const empty = makeResponse()
  await controller.deleteTemporaryPhotos({ body: {}, user: { id: 7 } }, empty)
  assert.equal(empty.body.message, '没有需要删除的照片')

  const success = makeResponse()
  await controller.deleteTemporaryPhotos({ body: { photos: ['photo'] }, user: { id: 7 } }, success)
  assert.deepEqual(success.body.data, { deleted: 1, failed: 1 })

  const errors = []
  const failingController = new Controller({
    service: { async deleteTemporaryPhotos() { throw new Error('cleanup failed') } },
    logger: { error(...args) { errors.push(args) } }
  })
  const failure = makeResponse()
  await failingController.deleteTemporaryPhotos({ body: { photos: [] }, user: { id: 7 } }, failure)
  assert.equal(failure.statusCode, 500)
  assert.equal(failure.body.message, '服务器内部错误，请稍后重试')
  assert.equal(errors.length, 1)
})

test('subsidy photo controller preserves missing, success and error responses', async () => {
  const controller = new Controller({
    service: { async getPhotos(id, userId) {
      if (id === 'missing') return null
      if (id === 'failure') throw new Error('database unavailable')
      assert.equal(userId, 7)
      return ['/api/subsidy/files/subsidy/a.jpg?signature=signed']
    } },
    logger: { error() {} }
  })
  const makeResponse = () => ({
    status(code) { this.statusCode = code; return this },
    json(body) { this.body = body; return this }
  })

  const missing = makeResponse()
  await controller.getPhotos({ params: { id: 'missing' }, user: { id: 7 } }, missing)
  assert.equal(missing.statusCode, 404)
  assert.equal(missing.body.message, '国补记录不存在')

  const success = makeResponse()
  await controller.getPhotos({ params: { id: '8' }, user: { id: 7 } }, success)
  assert.deepEqual(success.body, {
    success: true,
    data: { subsidy_photos: ['/api/subsidy/files/subsidy/a.jpg?signature=signed'] }
  })

  const failure = makeResponse()
  await controller.getPhotos({ params: { id: 'failure' }, user: { id: 7 } }, failure)
  assert.equal(failure.statusCode, 500)
  assert.equal(failure.body.error, 'database unavailable')
})

test('subsidy photo service signs valid paths for the requesting user and tolerates malformed JSON', async () => {
  const previousSigningKey = process.env.FILE_ACCESS_SIGNING_KEY
  process.env.FILE_ACCESS_SIGNING_KEY = crypto.randomBytes(32).toString('hex')
  const warnings = []
  try {
    const service = new Service({
      repository: { async getPhotos(id) {
        return id === 'malformed'
          ? '{invalid'
          : JSON.stringify(['/uploads/subsidy/contract/photo.jpg', '/uploads/other/photo.jpg'])
      } },
      logger: { warn(...args) { warnings.push(args) } }
    })

    const photos = await service.getPhotos('12', 41)
    assert.match(photos[0], /^\/api\/subsidy\/files\/subsidy\/contract\/photo\.jpg\?user=41&expires=\d+&signature=/)
    assert.equal(photos[1], '/uploads/other/photo.jpg')
    assert.deepEqual(await service.getPhotos('malformed', 41), [])
    assert.equal(warnings.length, 1)
  } finally {
    if (previousSigningKey === undefined) delete process.env.FILE_ACCESS_SIGNING_KEY
    else process.env.FILE_ACCESS_SIGNING_KEY = previousSigningKey
  }
})

test('subsidy photo repository binds the record ID and distinguishes a missing record', async () => {
  const calls = []
  const rows = [[{ subsidy_photos: '["photo"]' }], []]
  const repository = new Repository({ getDb: () => ({
    async execute(sql, params) { calls.push({ sql, params }); return [rows.shift()] }
  }) })

  assert.equal(await repository.getPhotos('0012'), '["photo"]')
  assert.equal(await repository.getPhotos('99'), null)
  assert.deepEqual(calls.map(call => call.params), [['0012'], ['99']])
  assert.ok(calls.every(call => /WHERE id = \?/.test(call.sql)))
})

test('subsidy record deletion repository binds IDs for lookup and delete', async () => {
  const calls = []
  const repository = new Repository({ getDb: () => ({
    async execute(sql, params) {
      calls.push({ sql, params })
      return sql.startsWith('SELECT') ? [[{ id: 4, subsidy_photos: null }]] : [{ affectedRows: 1 }]
    }
  }) })

  assert.deepEqual(await repository.findRecordForDelete('004'), { id: 4, subsidy_photos: null })
  assert.equal(await repository.deleteRecord('004'), true)
  assert.deepEqual(calls.map(call => call.params), [['004'], ['004']])
  assert.match(calls[0].sql, /SELECT id, subsidy_photos FROM national_subsidies WHERE id = \?$/)
  assert.match(calls[1].sql, /DELETE FROM national_subsidies WHERE id = \?$/)
})

test('temporary photo cleanup service verifies owner, reference, age and path before unlinking', async () => {
  const now = 10_000_000
  const files = new Set(['/uploads/subsidy/new.jpg', '/uploads/subsidy/old.jpg', '/uploads/subsidy/used.jpg'])
  const removed = []
  const errors = []
  const service = new Service({
    repository: {
      async hasPhotoReference(relativePath) { return relativePath === 'subsidy/used.jpg' }
    },
    logger: { warn() {}, error(...args) { errors.push(args) } },
    fileSystem: {
      existsSync(target) { return files.has(target) || target === '/uploads/subsidy' },
      statSync(target) { return { isFile: () => true, mtimeMs: target.endsWith('old.jpg') ? now - 3 * 60 * 60 * 1000 : now - 1000 } },
      unlinkSync(target) { files.delete(target); removed.push(target) },
      readdirSync() { return [] },
      rmdirSync() {}
    },
    uploadsRoot: () => '/uploads',
    subsidyRoot: () => '/uploads/subsidy',
    relativePathFromUrl: photoUrl => new URL(photoUrl, 'http://localhost').pathname.replace('/api/subsidy/files/', ''),
    verifyAccess: ({ userId, relativePath, signature }) => userId === 7 && relativePath.startsWith('subsidy/') && signature === 'valid',
    now: () => now
  })

  const result = await service.deleteTemporaryPhotos([
    '/api/subsidy/files/subsidy/new.jpg?user=7&expires=123&signature=valid',
    '/api/subsidy/files/subsidy/old.jpg?user=7&expires=123&signature=valid',
    '/api/subsidy/files/subsidy/used.jpg?user=7&expires=123&signature=valid',
    '/api/subsidy/files/subsidy/new.jpg?user=8&expires=123&signature=valid',
    '/api/subsidy/files/subsidy/new.jpg?user=7&expires=123&signature=invalid',
    '/uploads/other/photo.jpg?user=7&expires=123&signature=valid'
  ], 7)

  assert.deepEqual(result.deleted, ['subsidy/new.jpg'])
  assert.equal(result.failed.length, 5)
  assert.deepEqual(removed, ['/uploads/subsidy/new.jpg'])
  assert.equal(errors.length, 0)
})

test('temporary photo cleanup repository binds the normalized path for reference checks', async () => {
  let call
  const repository = new Repository({ getDb: () => ({
    async execute(sql, params) { call = { sql, params }; return [[{ id: 3 }]] }
  }) })
  assert.equal(await repository.hasPhotoReference('subsidy/example.jpg'), true)
  assert.match(call.sql, /subsidy_photos LIKE \? LIMIT 1/)
  assert.deepEqual(call.params, ['%subsidy/example.jpg%'])
})

test('temporary photo cleanup errors never log signed query values', async () => {
  const errors = []
  const service = new Service({
    repository: { async hasPhotoReference() { return false } },
    logger: { error(...args) { errors.push(args) } },
    fileSystem: {
      existsSync() { return true },
      statSync() { throw new Error('filesystem failure') }
    },
    uploadsRoot: () => '/uploads',
    relativePathFromUrl: photoUrl => new URL(photoUrl, 'http://localhost').pathname.replace('/api/subsidy/files/', ''),
    verifyAccess: () => true
  })
  const signedUrl = '/api/subsidy/files/subsidy/photo.jpg?user=7&expires=123&signature=secret-value'

  const result = await service.deleteTemporaryPhotos([signedUrl], 7)

  assert.deepEqual(result.failed, [signedUrl])
  assert.equal(errors.length, 1)
  assert.equal(JSON.stringify(errors).includes('secret-value'), false)
  assert.equal(JSON.stringify(errors).includes('expires=123'), false)
  assert.equal(JSON.stringify(errors).includes('subsidy/photo.jpg'), true)
})
