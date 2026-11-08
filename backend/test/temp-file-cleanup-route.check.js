const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const TempFileCleanupService = require('../src/services/temp-file-cleanup.service')
const TempFileCleanupController = require('../src/controllers/temp-file-cleanup.controller')
const { createTempFilePermissionGuard } = require('../src/middleware/temp-file-permissions')

const createResponse = () => ({
  status(code) {
    this.statusCode = code
    return this
  },
  json(body) {
    this.body = body
    return this
  }
})

test('临时文件权限只允许本人导航草稿并保留 guide:upload 检查', () => {
  const permissionCalls = []
  const guard = createTempFilePermissionGuard({
    getRelativePath: fileUrl => fileUrl.replace('/uploads/', ''),
    permissionFactory: permissions => (req, res, next) => {
      permissionCalls.push(permissions)
      return next()
    }
  })
  let nextCalled = false
  const next = () => { nextCalled = true }

  guard({ user: { id: 42 }, body: { files: ['/uploads/guide/draft_42_1_file.png'] } }, {}, next)
  assert.equal(nextCalled, true)
  assert.deepEqual(permissionCalls, [['guide:upload']])

  const wrongOwnerResponse = createResponse()
  guard({ user: { id: 42 }, body: { files: ['/uploads/guide/draft_7_1_file.png'] } }, wrongOwnerResponse, next)
  assert.equal(wrongOwnerResponse.statusCode, 403)
  assert.equal(wrongOwnerResponse.body.message, '导航正式文件不允许通过临时接口删除')

  const wrongDirectoryResponse = createResponse()
  guard({ user: { id: 42 }, body: { files: ['/uploads/subsidy/draft_42_1_file.jpg'] } }, wrongDirectoryResponse, next)
  assert.equal(wrongDirectoryResponse.statusCode, 403)
  assert.equal(wrongDirectoryResponse.body.message, '该目录不允许通过临时文件接口删除')
})

test('临时文件 service 删除近期文件、拒绝过期/越界文件并清理空子目录', async t => {
  const uploadsRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'tf-temp-upload-'))
  t.after(() => fs.rmSync(uploadsRoot, { recursive: true, force: true }))
  const recentPath = path.join(uploadsRoot, 'guide', 'draft_42_recent', 'image.png')
  const stalePath = path.join(uploadsRoot, 'guide', 'draft_42_stale', 'image.png')
  fs.mkdirSync(path.dirname(recentPath), { recursive: true })
  fs.mkdirSync(path.dirname(stalePath), { recursive: true })
  fs.writeFileSync(recentPath, 'recent')
  fs.writeFileSync(stalePath, 'stale')
  const staleTime = new Date(Date.now() - 3 * 60 * 60 * 1000)
  fs.utimesSync(stalePath, staleTime, staleTime)
  const logger = { warn() {}, error() {}, debug() {} }
  const service = new TempFileCleanupService({
    getRoot: () => uploadsRoot,
    getRelativePath: fileUrl => decodeURIComponent(fileUrl.replace('/uploads/', '')),
    resolveFilePath: fileUrl => path.resolve(uploadsRoot, decodeURIComponent(fileUrl.replace('/uploads/', ''))),
    logger
  })

  const missingFile = '/uploads/guide/draft_42_missing/missing.png'
  const outsideFile = '/uploads/../outside.png'
  const result = await service.deleteTempFiles([
    '/uploads/guide/draft_42_recent/image.png',
    '/uploads/guide/draft_42_stale/image.png',
    missingFile,
    outsideFile
  ])

  assert.deepEqual(result.deletedFiles, ['guide/draft_42_recent/image.png'])
  assert.deepEqual(result.failedFiles, ['/uploads/guide/draft_42_stale/image.png', outsideFile])
  assert.equal(fs.existsSync(recentPath), false)
  assert.equal(fs.existsSync(stalePath), true)
  assert.equal(fs.existsSync(path.dirname(recentPath)), false)
  assert.equal(fs.existsSync(path.join(uploadsRoot, 'guide')), true)
})

test('临时清理 controller 保持空清单与清理结果响应', async () => {
  const controller = new TempFileCleanupController({
    async deleteTempFiles() {
      return { deletedFiles: ['guide/draft.png'], failedFiles: [] }
    }
  })
  const response = createResponse()

  await controller.deleteTempFiles({ body: { files: [] } }, response)
  assert.equal(response.body.message, '没有需要删除的文件')

  await controller.deleteTempFiles({ body: { files: ['/uploads/guide/draft.png'] } }, response)
  assert.equal(response.body.message, '已清理 1 个临时文件')
  assert.deepEqual(response.body.data, {
    deleted: 1,
    failed: 0,
    deletedFiles: ['guide/draft.png'],
    failedFiles: []
  })
})
