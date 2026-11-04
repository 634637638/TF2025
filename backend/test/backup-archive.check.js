const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const backupService = require('../src/services/backup.service')

test('backup compression supports the current archiver module export', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tf-backup-archive-'))
  const source = path.join(root, 'source')
  const output = path.join(root, 'backup.zip')
  fs.mkdirSync(source, { recursive: true })
  fs.writeFileSync(path.join(source, 'audit.txt'), 'tf2025-backup-smoke')

  t.after(() => fs.rmSync(root, { recursive: true, force: true }))

  const result = await backupService.compressBackup(source, output)

  const signature = fs.readFileSync(output).subarray(0, 4)
  assert.deepEqual([...signature], [0x50, 0x4b, 0x03, 0x04])
  assert.ok(fs.statSync(output).size > 20)
  assert.equal(result.file_count, 1)
  assert.equal(result.size_bytes, fs.statSync(output).size)
  assert.ok(result.duration_ms >= 0)
})
