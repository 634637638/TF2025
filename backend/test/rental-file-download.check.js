'use strict'

const scopedActor = { id: 8, store_id: 1, store_ids: [1, 2, 3, 4, 5, 6, 7, 8, 9] }

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
  const service = new Service({ access,
    ensureSchema: async () => calls.push('schema'),
    repository: { async findContractFile(...args) { calls.push(args); return { store_id: 1, file_url: '/uploads/rentals/contracts/file.pdf', file_name: '租赁合同.pdf' } } },
    resolveUploadPath: url => `/private${url}`
  })

  assert.deepEqual(await service.getContractFile(8, 13, scopedActor), {
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
  assert.match(calls[0].sql, /WHERE f\.id=\? AND f\.rental_id=\?/)
})

const RentalUpdateService = require('../src/services/rental-update.service')
const { requirePermission } = require('../src/middleware/unified-auth')
const access = new RentalUpdateService({ permissionCheck: async (actor, permission) => {
  let allowed = false
  await requirePermission(permission)({ user: actor }, makeResponse(), () => { allowed = true })
  return allowed
} })
const editor = { id: 5, store_ids: [1], permissions: ['rentals:edit'] }
const historyEditor = { id: 5, store_ids: [1], permissions: ['rentals:edit', 'rentals:edit-history'] }
const connectionFixture = events => ({
  async beginTransaction() { events.push('begin') },
  async commit() { events.push('commit') },
  async rollback() { events.push('rollback') },
  release() { events.push('release') }
})
const provider = connection => () => ({ async getConnection() { return connection } })

test('附件删除在父合同锁及权限检查后提交，再清理物理文件', async () => {
  const events = []
  const connection = connectionFixture(events)
  const service = new Service({ access,
    ensureSchema: async () => events.push('schema'),
    databaseProvider: provider(connection),
    repository: {
      async findRentalForUpdate(conn, id) { assert.equal(conn, connection); assert.equal(id, 8); events.push('lock'); return { store_id: 1, source_store_id: 1, status: 'active' } },
      async deleteContractFile(conn, id, fileId) { assert.equal(conn, connection); assert.deepEqual([id, fileId], [8, 13]); events.push('delete'); return { store_id: 1, file_url: '/uploads/rentals/contracts/file.pdf' } }
    },
    resolveUploadPath: url => `/private${url}`,
    fileSystem: { unlinkSync(path) { events.push(path); throw new Error('disk unavailable') } },
    logger: { warn() { events.push('warn') } }
  })
  assert.equal(await service.deleteContractFile(8, 13, editor), true)
  assert.deepEqual(events, ['schema', 'begin', 'lock', 'delete', 'commit', 'release', '/private/uploads/rentals/contracts/file.pdf', 'warn'])
})

test('附件上传锁定父合同后写入真实操作人，同一事务提交并释放连接', async () => {
  const events = []
  const connection = connectionFixture(events)
  const service = new Service({ access,
    ensureSchema: async () => {}, databaseProvider: provider(connection),
    repository: {
      async findRentalForUpdate() { return { store_id: 1, source_store_id: 1, status: 'active' } },
      async insertContractFiles(conn, id, actorId, files) {
        assert.equal(conn, connection)
        assert.deepEqual([id, actorId], [8, 5])
        assert.deepEqual(files, [{ fileUrl: '/rentals/contracts/a.pdf', fileName: '合同.pdf' }])
        events.push('insert'); return [{ id: 31 }]
      }
    },
    createUploadUrl: (...parts) => `/${parts.join('/')}`
  })
  assert.deepEqual(await service.uploadContractFiles(8, editor, [{ filename: 'a.pdf', originalname: '合同.pdf' }]), [{ id: 31 }])
  assert.deepEqual(events, ['begin', 'insert', 'commit', 'release'])
})

for (const status of ['active', 'returned', 'bought_out', 'cancelled']) {
  test(`合同状态 ${status} 的附件增删与正文共用编辑及历史更正权限`, async () => {
    for (const actor of [{ id: 5, permissions: [] }, editor, historyEditor]) {
      for (const upload of [false, true]) {
        const events = []
        const connection = connectionFixture(events)
        let removed = 0
        const service = new Service({ access,
          ensureSchema: async () => {}, databaseProvider: provider(connection),
          removeFiles: async () => { removed++ },
          fileSystem: { unlinkSync() {} }, resolveUploadPath: () => '/isolated/file',
          repository: {
            async findRentalForUpdate() { events.push('lock'); return { store_id: 1, status } },
            async insertContractFiles() { events.push('write'); return [{ id: 1 }] },
            async deleteContractFile() { events.push('write'); return { store_id: 1, file_url: '/isolated' } }
          }
        })
        const run = () => upload ? service.uploadContractFiles(8, actor, []) : service.deleteContractFile(8, 1, actor)
        const allowed = actor === historyEditor || (status === 'active' && actor === editor)
        if (allowed) { await run(); assert.ok(events.includes('commit')); assert.equal(removed, 0) }
        else { await assert.rejects(run(), { statusCode: 403 }); assert.ok(!events.includes('write')); assert.equal(removed, upload ? 1 : 0) }
      }
    }
  })
}

test('附件上传在合同不存在或写入失败时回滚并清理临时文件', async () => {
  for (const missing of [false, true]) {
    const events = []
    const files = [{ filename: 'a.pdf' }]
    const service = new Service({ access,
      ensureSchema: async () => {}, databaseProvider: provider(connectionFixture(events)),
      removeFiles: async value => { assert.equal(value, files); events.push('cleanup') },
      repository: {
        async findRentalForUpdate() { return missing ? null : { store_id: 1, status: 'active' } },
        async insertContractFiles() { throw new Error('insert failed') }
      }
    })
    await assert.rejects(service.uploadContractFiles(8, editor, files), missing ? { statusCode: 404 } : /insert failed/)
    assert.deepEqual(events, ['begin', 'rollback', 'release', 'cleanup'])
  }
})
