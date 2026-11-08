'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const Controller = require('../src/controllers/rental-file.controller')
const Service = require('../src/services/rental-file.service')
const Repository = require('../src/repositories/rental-file.repository')

const routeSource = fs.readFileSync(path.join(__dirname, '../src/routes/rentals.js'), 'utf8')
const makeResponse = () => ({
  status(code) { this.statusCode = code; return this },
  json(body) { this.body = body; return this },
  download(filePath, filename) { this.downloadArgs = { filePath, filename }; return this }
})

test('rental contract download retains authentication, permission and field visibility checks', () => {
  assert.match(routeSource, /router\.use\(unifiedAuth\)/)
  assert.match(routeSource, /router\.get\(\s*'\/:id\/files\/:fileId\/download',\s*requirePermission\('rentals:view'\),\s*requireVisibleRentalFieldOrAction\('contract_info\.contract_files', 'edit'\),\s*rentalFileController\.downloadContractFile\.bind\(rentalFileController\)\s*\)/)
  assert.match(routeSource, /router\.post\('\/:id\/files', requirePermission\('rentals:edit'\), contractUpload\.array\('files', 12\), validateContractUploads, rentalFileController\.uploadContractFiles\.bind\(rentalFileController\)\)/)
  assert.match(routeSource, /router\.delete\('\/:id\/files\/:fileId', requirePermission\('rentals:edit'\), rentalFileController\.deleteContractFile\.bind\(rentalFileController\)\)/)
})

test('rental file service initializes schema, scopes by rental, and resolves the private upload path', async () => {
  const calls = []
  const service = new Service({
    ensureSchema: async () => calls.push('schema'),
    repository: { async findContractFile(...args) { calls.push(args); return { file_url: '/uploads/rentals/contracts/file.pdf', file_name: '租赁合同.pdf' } } },
    resolveUploadPath: url => `/private${url}`
  })

  assert.deepEqual(await service.getContractFile(8, 13), {
    filePath: '/private/uploads/rentals/contracts/file.pdf',
    fileName: '租赁合同.pdf'
  })
  assert.deepEqual(calls, ['schema', [8, 13]])
})

test('rental file controller preserves missing, download and missing-disk-file responses', async () => {
  const controller = new Controller({ service: { async getContractFile() { return { filePath: '/private/file.pdf', fileName: '合同.pdf' } } } })
  const downloaded = makeResponse()
  await controller.downloadContractFile({ params: { id: '8', fileId: '13' } }, downloaded)
  assert.deepEqual(downloaded.downloadArgs, { filePath: '/private/file.pdf', filename: '合同.pdf' })

  const missingRecord = new Controller({ service: { async getContractFile() { return null } } })
  const notFound = makeResponse()
  await missingRecord.downloadContractFile({ params: { id: '8', fileId: '13' } }, notFound)
  assert.equal(notFound.statusCode, 404)
  assert.equal(notFound.body.message, '合同备份不存在')

  const missingDiskFile = new Controller({ service: { async getContractFile() { throw Object.assign(new Error('missing'), { code: 'ENOENT' }) } } })
  const diskNotFound = makeResponse()
  await missingDiskFile.downloadContractFile({ params: { id: '8', fileId: '13' } }, diskNotFound)
  assert.equal(diskNotFound.statusCode, 404)
  assert.equal(diskNotFound.body.message, '合同文件不存在')
})

test('rental file repository binds both file id and owning rental id', async () => {
  const calls = []
  const repository = new Repository({ getDb: () => ({
    async execute(sql, params) {
      calls.push({ sql, params })
      return [[{ file_url: '/uploads/rentals/contracts/file.pdf', file_name: '合同.pdf' }]]
    }
  }) })

  assert.deepEqual(await repository.findContractFile(8, 13), {
    file_url: '/uploads/rentals/contracts/file.pdf', file_name: '合同.pdf'
  })
  assert.deepEqual(calls[0].params, [13, 8])
  assert.match(calls[0].sql, /WHERE id=\? AND rental_id=\?/)
})

test('rental file deletion removes its record before best-effort physical cleanup', async () => {
  const calls = []
  const warnings = []
  const service = new Service({
    ensureSchema: async () => calls.push('schema'),
    repository: { async deleteContractFile(...args) { calls.push(args); return { id: 13, file_url: '/uploads/rentals/contracts/file.pdf' } } },
    resolveUploadPath: url => `/private${url}`,
    fileSystem: { unlinkSync(filePath) { calls.push(filePath); throw new Error('disk unavailable') } },
    logger: { warn(...args) { warnings.push(args) } }
  })
  assert.equal(await service.deleteContractFile(8, 13), true)
  assert.deepEqual(calls, ['schema', [8, 13], '/private/uploads/rentals/contracts/file.pdf'])
  assert.equal(warnings.length, 1)

  const missing = new Service({
    ensureSchema: async () => {},
    repository: { async deleteContractFile() { return null } },
    fileSystem: { unlinkSync() { assert.fail('missing records must not remove a file') } }
  })
  assert.equal(await missing.deleteContractFile(8, 404), false)
})

test('rental file upload validates rental ownership, commits IDs, and releases its connection', async () => {
  const calls = []
  let released = false
  const service = new Service({
    ensureSchema: async () => calls.push('schema'),
    repository: {
      async rentalExists(id) { calls.push(['exists', id]); return true },
      async insertContractFiles(connection, rentalId, actorId, files) {
        calls.push(['insert', rentalId, actorId, files])
        return [{ id: 31 }, { id: 32 }]
      }
    },
    createUploadUrl: (...parts) => `/${parts.join('/')}`,
    databaseProvider: () => ({
      async getConnection() {
        return {
          async beginTransaction() { calls.push('begin') },
          async commit() { calls.push('commit') },
          async rollback() { calls.push('rollback') },
          release() { released = true }
        }
      }
    })
  })

  const result = await service.uploadContractFiles(8, 5, [
    { filename: 'a.pdf', originalname: '合同.pdf' },
    { filename: 'b.jpg', originalname: '现场.jpg' }
  ])
  assert.deepEqual(result, [{ id: 31 }, { id: 32 }])
  assert.deepEqual(calls, [
    'schema', ['exists', 8], 'begin',
    ['insert', 8, 5, [
      { fileUrl: '/rentals/contracts/a.pdf', fileName: '合同.pdf' },
      { fileUrl: '/rentals/contracts/b.jpg', fileName: '现场.jpg' }
    ]],
    'commit'
  ])
  assert.equal(released, true)
})

test('rental file upload removes files when rental is missing or its transaction fails', async () => {
  const files = [{ filename: 'a.pdf' }]
  const removed = []
  const missing = new Service({
    ensureSchema: async () => {},
    repository: { async rentalExists() { return false } },
    removeFiles: async input => removed.push(input)
  })
  assert.equal(await missing.uploadContractFiles(404, 5, files), null)
  assert.deepEqual(removed, [files])

  let rolledBack = false
  const failed = new Service({
    ensureSchema: async () => {},
    repository: {
      async rentalExists() { return true },
      async insertContractFiles() { throw new Error('insert failed') }
    },
    removeFiles: async input => removed.push(input),
    databaseProvider: () => ({
      async getConnection() {
        return {
          async beginTransaction() {},
          async commit() {},
          async rollback() { rolledBack = true },
          release() {}
        }
      }
    })
  })
  await assert.rejects(failed.uploadContractFiles(8, 5, files), /insert failed/)
  assert.equal(rolledBack, true)
  assert.deepEqual(removed, [files, files])
})
