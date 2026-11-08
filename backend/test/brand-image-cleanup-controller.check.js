'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const BrandImageController = require('../src/controllers/brand-image.controller')
const BrandImageService = require('../src/services/brand-image.service')
const BrandImageRepository = require('../src/repositories/brand-image.repository')

const response = () => ({
  status(code) {
    this.statusCode = code
    return this
  },
  json(body) {
    this.body = body
    return this
  }
})

test('brand image cleanup route keeps authentication and system:delete permission while delegating', () => {
  const source = fs.readFileSync(path.join(__dirname, '../src/routes/system.js'), 'utf8')
  assert.match(source, /router\.post\('\/cleanup-brand-images', unifiedAuth, requirePermission\('system:delete'\), brandImageController\.cleanup\.bind\(brandImageController\)\)/)
  assert.match(source, /router\.get\('\/brand-images-info', unifiedAuth, requirePermission\('system:view'\), brandImageController\.getInfo\.bind\(brandImageController\)\)/)
  assert.match(source, /router\.post\('\/upload-brand-image', unifiedAuth, requirePermission\('system:edit'\), upload\.single\('image'\), brandImageController\.upload\.bind\(brandImageController\)\)/)
})

test('brand image cleanup controller preserves disconnected, success and failure responses', async () => {
  const unavailable = response()
  await new BrandImageController({ service: { isConnected: () => false } }).cleanup({}, unavailable)
  assert.equal(unavailable.statusCode, 500)

  const success = response()
  await new BrandImageController({
    service: {
      isConnected: () => true,
      async cleanupUnreferencedFiles() { return { deletedFiles: 2, message: '已清理 2 个无用文件' } }
    }
  }).cleanup({}, success)
  assert.equal(success.body.success, true)
  assert.deepEqual(success.body.data, { deletedFiles: 2, message: '已清理 2 个无用文件' })

  const failed = response()
  await new BrandImageController({
    service: { isConnected: () => true, async cleanupUnreferencedFiles() { throw new Error('database unavailable') } },
    logger: { error() {} }
  }).cleanup({}, failed)
  assert.equal(failed.statusCode, 500)
  assert.equal(failed.body.message, '服务器内部错误，请稍后重试')
})

test('brand image upload controller keeps missing-file, success and failure responses', async () => {
  const missing = response()
  await new BrandImageController({ service: {} }).upload({}, missing)
  assert.equal(missing.statusCode, 400)
  assert.equal(missing.body.message, '没有上传文件')

  const success = response()
  const result = { url: '/uploads/brand/logo.png', filename: 'logo.png', size: 12 }
  await new BrandImageController({ service: { async upload() { return result } } }).upload({ file: {} }, success)
  assert.equal(success.body.message, '图片上传成功')
  assert.deepEqual(success.body.data, result)

  const invalid = response()
  await new BrandImageController({
    service: { async upload() { const error = new Error('文件内容与图片格式不匹配'); error.statusCode = 400; throw error } }
  }).upload({ file: {} }, invalid)
  assert.equal(invalid.statusCode, 400)
  assert.equal(invalid.body.message, '文件内容与图片格式不匹配')

  const failed = response()
  await new BrandImageController({
    service: { async upload() { throw new Error('disk unavailable') } },
    logger: { error() {} }
  }).upload({ file: {} }, failed)
  assert.equal(failed.statusCode, 500)
  assert.equal(failed.body.message, '服务器内部错误，请稍后重试')
})

test('brand image upload service validates, persists the logo and removes the replaced file', async () => {
  const filesystemEvents = []
  const service = new BrandImageService({
    repository: {
      async getCurrentLogoUrl() { return '/uploads/brand/old.png' },
      async saveCurrentLogoUrl(url) { filesystemEvents.push(['save', url]) }
    },
    connected: () => true,
    fileSystem: {
      async access() {},
      async rename(from, to) { filesystemEvents.push(['rename', from, to]) },
      async unlink(filePath) { filesystemEvents.push(['unlink', filePath]) }
    },
    resolveUploadSubdir: (...segments) => `/uploads/${segments.join('/')}`,
    uploadUrl: (...segments) => `/uploads/${segments.join('/')}`,
    uploadPathFromUrl: url => url.replace('/uploads', '/data/uploads'),
    validateFileSignature: async (file, types) => { assert.equal(file.path, '/tmp/upload'); assert.deepEqual(types, ['image']); return true },
    removeFiles: async () => { throw new Error('unexpected cleanup') },
    now: () => 123,
    logger: { warn() {} }
  })

  assert.deepEqual(await service.upload({ path: '/tmp/upload', originalname: 'logo.png', size: 12 }), {
    url: '/uploads/brand/brand_123.png', filename: 'brand_123.png', size: 12
  })
  assert.deepEqual(filesystemEvents, [
    ['rename', '/tmp/upload', '/uploads/brand/brand_123.png'],
    ['save', '/uploads/brand/brand_123.png'],
    ['unlink', '/data/uploads/brand/old.png']
  ])
})

test('brand image upload service removes rejected and disconnected uploads', async () => {
  const removed = []
  const createService = options => new BrandImageService({
    repository: {},
    fileSystem: {},
    removeFiles: async files => removed.push(...files),
    ...options
  })
  const invalidFile = { path: '/tmp/invalid' }
  await assert.rejects(createService({ validateFileSignature: async () => false }).upload(invalidFile), { statusCode: 400 })
  assert.deepEqual(removed, [invalidFile])

  const offlineFile = { path: '/tmp/offline' }
  await assert.rejects(createService({ connected: () => false, validateFileSignature: async () => true }).upload(offlineFile), { message: '数据库未连接' })
  assert.deepEqual(removed, [invalidFile, offlineFile])
})

test('brand image upload service removes the new file when persisting its URL fails', async () => {
  const removed = []
  const service = new BrandImageService({
    repository: {
      async getCurrentLogoUrl() { return '' },
      async saveCurrentLogoUrl() { throw new Error('database write failed') }
    },
    connected: () => true,
    fileSystem: {
      async access() {},
      async rename() {}
    },
    resolveUploadSubdir: (...segments) => `/uploads/${segments.join('/')}`,
    validateFileSignature: async () => true,
    removeFiles: async files => removed.push(...files),
    now: () => 123
  })
  await assert.rejects(service.upload({ path: '/tmp/upload', originalname: 'logo.png', size: 12 }), /database write failed/)
  assert.deepEqual(removed, [{ path: '/uploads/brand/brand_123.png' }])
})

test('brand image cleanup service deletes only files missing from database references', async () => {
  const deletedPaths = []
  const warnings = []
  const service = new BrandImageService({
    repository: {
      async listReferencedPaths() {
        return [{ filepath: '/uploads/brand/current.png' }, { filepath: '/uploads/brand/failed.png' }]
      }
    },
    connected: () => true,
    fileSystem: {
      async access(directory) { assert.equal(directory, '/uploads/brand') },
      async readdir() { return ['current.png', 'orphan.png', 'unremovable.png'] },
      async unlink(filePath) {
        if (filePath.endsWith('unremovable.png')) throw new Error('file is busy')
        deletedPaths.push(filePath)
      }
    },
    resolveUploadSubdir: (...segments) => `/uploads/${segments.join('/')}`,
    relativePathFromUrl: url => url.replace('/uploads/', ''),
    logger: { warn(...args) { warnings.push(args) } }
  })

  assert.deepEqual(await service.cleanupUnreferencedFiles(), {
    deletedFiles: 1,
    message: '已清理 1 个无用文件'
  })
  assert.deepEqual(deletedPaths, ['/uploads/brand/orphan.png'])
  assert.equal(warnings.length, 1)
})

test('brand image cleanup treats a missing directory as an empty cleanup result', async () => {
  const service = new BrandImageService({
    repository: { async listReferencedPaths() { return [] } },
    fileSystem: { async access() { throw new Error('missing') } },
    resolveUploadSubdir: () => '/uploads/brand'
  })
  assert.deepEqual(await service.cleanupUnreferencedFiles(), {
    deletedFiles: 0,
    message: '品牌图片目录不存在或为空'
  })
})

test('brand image info controller preserves connection checks and returns service data', async () => {
  const unavailable = response()
  await new BrandImageController({ service: { isConnected: () => false } }).getInfo({}, unavailable)
  assert.equal(unavailable.statusCode, 500)

  const expected = { currentImage: '/uploads/brand/logo.png', databaseRecords: [], physicalFiles: [], totalFiles: 0, totalSize: 0 }
  const success = response()
  await new BrandImageController({
    service: { isConnected: () => true, async getManagementInfo() { return expected } }
  }).getInfo({}, success)
  assert.equal(success.body.success, true)
  assert.deepEqual(success.body.data, expected)
})

test('brand image info service returns file metadata and marks current logo', async () => {
  const warnings = []
  const service = new BrandImageService({
    repository: {
      async getCurrentLogoUrl() { return '/uploads/brand/current.png' },
      async listImageRecords() { return [{ id: 1, filepath: '/uploads/brand/current.png' }] }
    },
    fileSystem: {
      async access() {},
      async readdir(_directory, options) {
        assert.deepEqual(options, { withFileTypes: true })
        return [
          { name: 'current.png', isFile: () => true },
          { name: 'folder', isFile: () => false }
        ]
      },
      async stat(filePath) {
        assert.equal(filePath, '/uploads/brand/current.png')
        return { size: 12, birthtime: 'created', mtime: 'modified' }
      }
    },
    resolveUploadSubdir: (...segments) => `/uploads/${segments.join('/')}`,
    uploadUrl: (...segments) => `/uploads/${segments.join('/')}`,
    relativePathFromUrl: url => url.replace('/uploads/', ''),
    logger: { warn(...args) { warnings.push(args) } }
  })

  assert.deepEqual(await service.getManagementInfo(), {
    currentImage: '/uploads/brand/current.png',
    databaseRecords: [{ id: 1, filepath: '/uploads/brand/current.png' }],
    physicalFiles: [{
      name: 'current.png',
      path: 'brand/current.png',
      size: 12,
      created: 'created',
      modified: 'modified',
      isCurrent: true
    }],
    totalFiles: 1,
    totalSize: 12
  })
  assert.deepEqual(warnings, [])
})

test('brand image info tolerates missing brand_images table and unreadable directory', async () => {
  const warnings = []
  const service = new BrandImageService({
    repository: {
      async getCurrentLogoUrl() { return '' },
      async listImageRecords() { throw new Error('table missing') }
    },
    fileSystem: { async access() { throw new Error('directory missing') } },
    resolveUploadSubdir: () => '/uploads/brand',
    logger: { warn(...args) { warnings.push(args) } }
  })
  assert.deepEqual(await service.getManagementInfo(), {
    currentImage: null,
    databaseRecords: [],
    physicalFiles: [],
    totalFiles: 0,
    totalSize: 0
  })
  assert.equal(warnings.length, 2)
})

test('brand image repository reads both brand_images and settings references', async () => {
  let query
  const repository = new BrandImageRepository(() => ({
    async execute(sql) {
      query = sql
      return [[{ filepath: '/uploads/brand/current.png' }]]
    }
  }))
  assert.deepEqual(await repository.listReferencedPaths(), [{ filepath: '/uploads/brand/current.png' }])
  assert.match(query, /SELECT DISTINCT filepath FROM brand_images/)
  assert.match(query, /SELECT brand_image as filepath FROM settings/)
})

test('brand image repository supports key-value and single-row settings for the current logo', async () => {
  const keyValueRepository = new BrandImageRepository(() => ({
    async execute(sql, params) {
      if (sql === 'SHOW COLUMNS FROM settings') return [[{ Field: 'key_name' }, { Field: 'value' }]]
      assert.equal(sql, 'SELECT value FROM settings WHERE key_name = ? LIMIT 1')
      assert.deepEqual(params, ['logo_url'])
      return [[{ value: '/uploads/brand/key-value.png' }]]
    }
  }))
  assert.equal(await keyValueRepository.getCurrentLogoUrl(), '/uploads/brand/key-value.png')

  const singleRowRepository = new BrandImageRepository(() => ({
    async execute(sql) {
      if (sql === 'SHOW COLUMNS FROM settings') return [[{ Field: 'logo_url' }]]
      assert.equal(sql, 'SELECT logo_url AS logo_url FROM settings LIMIT 1')
      return [[{ logo_url: '/uploads/brand/single-row.png' }]]
    }
  }))
  assert.equal(await singleRowRepository.getCurrentLogoUrl(), '/uploads/brand/single-row.png')
})

test('brand image repository saves the logo using key-value and single-row settings schemas', async () => {
  const calls = []
  const keyValueRepository = new BrandImageRepository(() => ({
    async execute(sql, params) {
      calls.push([sql, params])
      if (sql === 'SHOW COLUMNS FROM settings') return [[{ Field: 'key_name' }, { Field: 'value' }]]
      return [{ affectedRows: 1 }]
    }
  }))
  await keyValueRepository.saveCurrentLogoUrl('/uploads/brand/key-value.png')
  assert.match(calls[1][0], /INSERT INTO settings \(key_name, value, type, description\)/)
  assert.deepEqual(calls[1][1], ['logo_url', '/uploads/brand/key-value.png', '站点Logo'])

  calls.length = 0
  const singleRowRepository = new BrandImageRepository(() => ({
    async execute(sql, params) {
      calls.push([sql, params])
      if (sql === 'SHOW COLUMNS FROM settings') return [[{ Field: 'logo_url' }]]
      if (sql === 'SELECT id FROM settings LIMIT 1') return [[{ id: 7 }]]
      return [{ affectedRows: 1 }]
    }
  }))
  await singleRowRepository.saveCurrentLogoUrl('/uploads/brand/single-row.png')
  assert.equal(calls[2][0], 'UPDATE settings SET logo_url = ? WHERE id = ?')
  assert.deepEqual(calls[2][1], ['/uploads/brand/single-row.png', 7])
})
