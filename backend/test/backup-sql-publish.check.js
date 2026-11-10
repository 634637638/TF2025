'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const Module = require('node:module')
const { EventEmitter } = require('node:events')
const { PassThrough } = require('node:stream')

function isolatedService(t, spawn) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tf-backup-sql-'))
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  const filename = require.resolve('../src/services/backup.service')
  const backupRoot = path.resolve(__dirname, '../backups')
  const remap = value => typeof value === 'string' && (value === backupRoot || value.startsWith(`${backupRoot}${path.sep}`))
    ? path.join(root, path.relative(backupRoot, value)) : value
  const isolatedFs = new Proxy(fs, { get(target, key) {
    const value = target[key]
    return typeof value === 'function' ? (...args) => value.apply(target, args.map(remap)) : value
  } })
  const originalLoad = Module._load
  const cached = require.cache[filename]
  let service
  try {
    delete require.cache[filename]
    Module._load = function (name, parent, isMain) {
      if (parent?.filename === filename && name === 'fs') return isolatedFs
      if (parent?.filename === filename && name === 'child_process' && spawn) return { spawn }
      return originalLoad.call(this, name, parent, isMain)
    }
    service = require(filename)
  } finally {
    Module._load = originalLoad
    if (cached) require.cache[filename] = cached
    else delete require.cache[filename]
  }
  return { service, root, remap }
}

test('数据库导出完成前只有临时文件，成功原子发布 SQL；失败不留下可上传文件', async t => {
  const { service, root, remap } = isolatedService(t)
  service.getTimestamp = () => '20261110_120000'
  const filename = 'sql-20261110_120000.sql'
  let release, started
  const ready = new Promise(resolve => { started = resolve })
  const wait = new Promise(resolve => { release = resolve })
  service.backupDatabase = async output => {
    fs.writeFileSync(remap(output), 'SELECT 1;\n')
    started()
    await wait
  }
  const pending = service.createBackup('database')
  await ready
  assert.equal(fs.existsSync(path.join(root, filename)), false)
  assert.equal(fs.existsSync(path.join(root, `${filename}.tmp`)), true)
  await assert.rejects(() => service.createBackup('database'), error => error.statusCode === 409)
  release()
  const result = await pending
  assert.equal(result.filename, filename)
  assert.match(fs.readFileSync(path.join(root, filename), 'utf8'), /-- TF2025 database backup complete\s*$/)
  assert.equal(fs.existsSync(path.join(root, `${filename}.tmp`)), false)
  service.getTimestamp = () => '20261110_130000'
  service.backupDatabase = async output => { fs.writeFileSync(remap(output), 'unfinished'); throw new Error('模拟导出失败') }
  await assert.rejects(() => service.createBackup('database'), /模拟导出失败/)
  assert.deepEqual(fs.readdirSync(root), [filename])

  const legacy = 'database_20261109_142759.sql'
  fs.writeFileSync(path.join(root, legacy), 'SELECT 1;\n')
  fs.writeFileSync(path.join(root, `${filename}.tmp`), 'unfinished')
  const listed = service.getBackupList().map(item => ({ filename: item.filename, type: item.type }))
  assert.deepEqual(listed.sort((a, b) => a.filename.localeCompare(b.filename)), [
    { filename: legacy, type: 'database' }, { filename, type: 'database' }
  ])
  for (const name of [filename, legacy]) {
    assert.equal(remap(service.getBackupPath(name)), path.join(root, name))
    assert.equal(service.deleteBackup(name), true)
    assert.equal(fs.existsSync(path.join(root, name)), false)
  }
})

test('mysqldump 进程成功退出后仍等待数据流写完，不提前完成数据库备份', async t => {
  let child
  const { service, root } = isolatedService(t, () => {
    child = new EventEmitter()
    child.stdout = new PassThrough()
    child.stderr = new PassThrough()
    child.kill = () => {}
    return child
  })
  const previous = {}
  for (const [key, value] of Object.entries({ DB_HOST: 'test.invalid', DB_USER: 'synthetic-user', DB_PASSWORD: 'synthetic-password', DB_NAME: 'synthetic-db' })) {
    previous[key] = process.env[key]
    process.env[key] = value
  }
  t.after(() => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  })
  const output = path.join(root, 'synthetic.sql.tmp')
  let resolved = false
  const pending = service.backupDatabase(output).then(() => { resolved = true })
  child.stdout.write('SELECT 1;\n')
  child.emit('close', 0)
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(resolved, false)
  child.stdout.end('SELECT 2;\n')
  await pending
  assert.equal(fs.readFileSync(output, 'utf8'), 'SELECT 1;\nSELECT 2;\n')
})
