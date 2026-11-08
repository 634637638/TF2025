'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const DataImportFileService = require('../src/services/data-import-file.service')

test('导入文件令牌限定用户、目录和有效期', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tf-import-token-'))
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  fs.writeFileSync(path.join(root, 'owned.xlsx'), Buffer.from('workbook'))
  let now = 1000
  const fileService = new DataImportFileService({ importDirectory: root, now: () => now, tokenTtl: 100 })
  fileService.register('owned.xlsx', 7)

  assert.equal(fs.realpathSync(fileService.resolve('owned.xlsx', '7')), fs.realpathSync(path.join(root, 'owned.xlsx')))
  assert.throws(() => fileService.resolve('owned.xlsx', '8'), error => error.statusCode === 403)
  assert.throws(() => fileService.resolve('../owned.xlsx', '7'), error => error.statusCode === 400)
  now = 1101
  assert.throws(() => fileService.resolve('owned.xlsx', '7'), error => error.statusCode === 404)
})

test('导入文件令牌拒绝目录外符号链接和不存在的文件', t => {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'tf-import-token-'))
  const root = path.join(parent, 'import')
  const outside = path.join(parent, 'outside.xlsx')
  fs.mkdirSync(root)
  t.after(() => {
    fs.rmSync(parent, { recursive: true, force: true })
  })
  fs.writeFileSync(outside, Buffer.from('workbook'))
  fs.symlinkSync(outside, path.join(root, 'outside.xlsx'))
  const fileService = new DataImportFileService({ importDirectory: root })

  fileService.register(path.basename(outside), 3)
  assert.throws(() => fileService.resolve(path.basename(outside), 3), error => error.statusCode === 400)

  fileService.register('missing.xlsx', 3)
  assert.throws(() => fileService.resolve('missing.xlsx', 3), error => error.statusCode === 400)
})
