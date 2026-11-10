'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { CloudBackupService } = require('../src/services/cloud-backup.service')
const Repository = require('../src/repositories/cloud-backup.repository')
const backupService = require('../src/services/backup.service')

const HOUR = 3600_000
const RETRY = 300_000

test('云端服务器使用 UTC 时区时，备份文件名仍按北京时间生成', t => {
  const previous = process.env.TZ
  process.env.TZ = 'UTC'
  t.after(() => { if (previous === undefined) delete process.env.TZ; else process.env.TZ = previous })
  t.mock.method(Date, 'now', () => Date.parse('2026-11-10T16:05:06.000Z'))
  assert.equal(backupService.getTimestamp(), '20261111_000506')
})

async function fixture(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'tf-backup-automation-'))
  const repository = new Repository(path.join(directory, '.cloud'))
  const source = path.join(directory, '.source')
  fs.mkdirSync(source)
  fs.writeFileSync(path.join(source, 'asset'), 'synthetic backup asset')
  const zip = path.join(directory, '.fixture.zip')
  await backupService.compressBackup(source, zip)
  fs.rmSync(source, { recursive: true })
  let now = Date.parse('2026-11-10T12:00:00.000Z'), serial = 0
  const created = [], uploaded = [], deleted = [], uploadFailures = new Set()
  const backup = {
    getBackupDir: () => directory,
    isValidBackupFilename: backupService.isValidBackupFilename.bind(backupService),
    getBackupList: () => fs.readdirSync(directory).filter(name => backupService.isValidBackupFilename(name)).map(filename => ({
      filename, created_at: fs.statSync(path.join(directory, filename)).mtime.toISOString()
    })),
    deleteBackup(filename) {
      assert.equal(backup.canDeleteBackup(filename), true)
      deleted.push(filename)
      fs.unlinkSync(path.join(directory, filename))
    },
    async createBackup(type) {
      created.push(type)
      const filename = `${type === 'database' ? 'sql-' : 'backup_'}20261110_${String(++serial).padStart(6, '0')}.${type === 'database' ? 'sql' : 'zip'}`
      add(filename)
      return { filename }
    }
  }
  function add(filename, mtime = now) {
    const file = path.join(directory, filename)
    if (filename.endsWith('.zip')) fs.copyFileSync(zip, file)
    else fs.writeFileSync(file, '-- synthetic database\n-- TF2025 database backup complete\n')
    fs.utimesSync(file, new Date(mtime), new Date(mtime))
    return filename
  }
  const previousKey = process.env.CONFIG_ENCRYPTION_KEY
  process.env.CONFIG_ENCRYPTION_KEY = 'synthetic-backup-automation-key-32-chars'
  const options = { backup, repository, now: () => now, logger: { warn() {}, error() {} }, clientFactory: () => ({
    async upload(input) {
      if (uploadFailures.has(input.filename)) throw new Error('synthetic upload failure')
      uploaded.push(input.filename)
      return { fileId: `remote-${input.filename}`, driveId: 'drive', folderId: 'target' }
    }
  }) }
  const service = new CloudBackupService(options)
  const account = service.saveAccount({ name: '模拟云盘', token: 'synthetic-automation-refresh-token' })
  const save = input => service.saveSettings({ accountId: account.id, enabled: false, driveId: 'drive', folderId: 'target', ...input })
  save({})
  t.after(() => {
    service.stop()
    if (previousKey === undefined) delete process.env.CONFIG_ENCRYPTION_KEY
    else process.env.CONFIG_ENCRYPTION_KEY = previousKey
    fs.rmSync(directory, { recursive: true, force: true })
  })
  return { service, backup, repository, options, directory, save, add, created, uploaded, deleted, uploadFailures,
    advance: value => { now += value }, now: () => now }
}

test('旧状态默认不启用生成或清理；策略校验失败保持原子性，忽略客户端运行状态', async t => {
  const f = await fixture(t)
  assert.equal(f.service.getSettings().schedule.enabled, false)
  assert.equal(f.service.getSettings().retention.enabled, false)
  const before = f.repository.read()
  for (const schedule of [null, { enabled: true, intervalHours: 0, type: 'full' }, { enabled: true, intervalHours: 1.5, type: 'database' },
    { enabled: true, intervalHours: 721, type: 'full' }, { enabled: true, intervalHours: '24', type: 'full' }, { enabled: true, intervalHours: 24, type: 'other' }]) {
    assert.throws(() => f.save({ schedule }), error => error.statusCode === 400)
    assert.deepEqual(f.repository.read(), before)
  }
  for (const retention of [null, { enabled: true, sqlCount: 0, zipCount: 10 }, { enabled: true, sqlCount: 10, zipCount: 1001 },
    { enabled: 'true', sqlCount: 10, zipCount: 10 }, { enabled: true, sqlCount: 10.5, zipCount: 10 }]) {
    assert.throws(() => f.save({ schedule: { enabled: true, intervalHours: 24, type: 'full' }, retention }), error => error.statusCode === 400)
    assert.deepEqual(f.repository.read(), before)
  }
  const result = f.save({ schedule: { enabled: true, intervalHours: 24, type: 'full', nextRunAt: 'past', lastStatus: 'success' },
    retention: { enabled: true, sqlCount: 10, zipCount: 10, lastError: 'injected' } })
  assert.equal(result.schedule.nextRunAt, new Date(f.now() + 24 * HOUR).toISOString())
  assert.equal(result.schedule.lastStatus, 'idle')
  assert.equal(result.retention.lastError, '')
})

test('到期自动生成 SQL 并进入既有上传队列，重启保留下次时间，停机过期只补一次', async t => {
  const f = await fixture(t)
  const input = { enabled: true, intervalHours: 6, type: 'database' }
  f.save({ enabled: true, schedule: input })
  await f.service.tick()
  assert.deepEqual(f.created, [])
  f.advance(6 * HOUR)
  await f.service.tick()
  assert.deepEqual(f.created, ['database'])
  assert.deepEqual(f.uploaded, ['sql-20261110_000001.sql'])
  assert.equal(f.service.getSettings().schedule.lastStatus, 'success')
  const next = f.service.getSettings().schedule.nextRunAt
  f.save({ enabled: true, schedule: input })
  assert.equal(f.service.getSettings().schedule.nextRunAt, next, '不改规则的保存不顺延计划')
  const restarted = new CloudBackupService(f.options)
  assert.equal(restarted.getSettings().schedule.nextRunAt, next)
  await restarted.tick()
  assert.equal(f.created.length, 1)
  f.advance(30 * HOUR)
  await restarted.tick()
  await restarted.tick()
  assert.equal(f.created.length, 2, '不追补停机期间的每个周期')
  assert.equal(restarted.getSettings().schedule.nextRunAt, new Date(f.now() + 6 * HOUR).toISOString())
  assert.equal(f.uploaded.length, 2)
})

test('同一时刻的周期检查及其他进程不能重复生成，手动生成占用时推迟执行', async t => {
  const f = await fixture(t)
  f.save({ schedule: { enabled: true, intervalHours: 1, type: 'full' } })
  f.advance(HOUR)
  f.backup.creatingBackup = true
  await f.service.tick()
  assert.deepEqual(f.created, [])
  f.backup.creatingBackup = false
  let finish, started
  const entered = new Promise(resolve => { started = resolve })
  const original = f.backup.createBackup
  f.backup.createBackup = async type => { started(); await new Promise(resolve => { finish = resolve }); return original(type) }
  const pending = f.service.tick()
  await entered
  try {
    await f.service.tick()
    await new CloudBackupService(f.options).tick()
    assert.deepEqual(f.created, [])
  } finally { finish(); await pending }
  assert.deepEqual(f.created, ['full'])
  assert.equal(f.service.getSettings().schedule.lastStatus, 'success')
})

test('生成失败不上传半成品，持久化脱敏错误及重试时间，修复后恢复执行', async t => {
  const f = await fixture(t)
  f.save({ enabled: true, schedule: { enabled: true, intervalHours: 1, type: 'database' } })
  const original = f.backup.createBackup
  f.backup.createBackup = async () => { throw new Error('synthetic-private-db-credential') }
  f.advance(HOUR)
  await f.service.tick()
  const failed = f.service.getSettings().schedule
  assert.equal(failed.lastStatus, 'failed')
  assert.equal(failed.nextRunAt, new Date(f.now() + RETRY).toISOString())
  assert.equal(JSON.stringify(f.service.getSettings()).includes('synthetic-private'), false)
  assert.deepEqual(f.uploaded, [])
  f.advance(RETRY - 1)
  await f.service.tick()
  assert.deepEqual(f.created, [])
  f.backup.createBackup = original
  f.advance(1)
  await new CloudBackupService(f.options).tick()
  assert.equal(f.service.getSettings().schedule.lastStatus, 'success')
  assert.equal(f.service.getSettings().schedule.lastError, '')
  assert.equal(f.uploaded.length, 1)
})

test('异常重启识别中断记录并退避，关闭生成规则不再执行也不影响上传开关', async t => {
  const f = await fixture(t)
  f.save({ schedule: { enabled: true, intervalHours: 1, type: 'full' } })
  const state = f.repository.read()
  state.schedule.lastStatus = 'running'
  f.repository.write(state)
  await new CloudBackupService(f.options).tick()
  assert.equal(f.service.getSettings().schedule.lastStatus, 'failed')
  assert.match(f.service.getSettings().schedule.lastError, /重启中断/)
  assert.equal(f.service.getSettings().schedule.nextRunAt, new Date(f.now() + RETRY).toISOString())
  f.save({ schedule: { enabled: false, intervalHours: 1, type: 'full' } })
  f.advance(10 * HOUR)
  await f.service.tick()
  assert.deepEqual(f.created, [])
  assert.equal(f.service.getSettings().schedule.nextRunAt, null)
  assert.equal(f.service.getSettings().enabled, false)
})

test('本地 SQL/ZIP 独立保留最新份数，兼容旧 SQL 名称，云端及其他文件不删除', async t => {
  const f = await fixture(t)
  const files = [
    'database_20261101_120000.sql', 'sql-20261102_120000.sql', 'sql-20261103_120000.sql',
    'backup_20261101_120000.zip', 'backup_20261102_120000.zip', 'backup_20261103_120000.zip'
  ]
  files.forEach((name, i) => f.add(name, f.now() + (i % 3) * 1000))
  fs.writeFileSync(path.join(f.directory, 'future-rule.json'), '{}')
  fs.writeFileSync(path.join(f.directory, 'sql-20261101_100000.sql.tmp'), 'unfinished')
  f.save({ retention: { enabled: true, sqlCount: 1, zipCount: 2 } })
  const remoteTasks = f.repository.read()
  remoteTasks.tasks.push({ id: 'old-remote-task', filename: files[0], status: 'success', remote: { fileId: 'retain-in-cloud' } })
  f.repository.write(remoteTasks)
  await f.service.tick()
  assert.deepEqual(f.deleted.sort(), [files[0], files[1], files[3]].sort())
  assert.equal(fs.existsSync(path.join(f.directory, 'future-rule.json')), true)
  assert.equal(fs.existsSync(path.join(f.directory, 'sql-20261101_100000.sql.tmp')), true)
  assert.equal(f.service.getSettings().retention.lastDeleted, 3)
  assert.deepEqual(f.repository.read().tasks, remoteTasks.tasks, '不改变云盘文件或成功记录')
  await f.service.tick()
  assert.equal(f.deleted.length, 3)
})

test('自动上传开启时，仅清理已成功上传且指纹匹配的旧文件，失败及等待任务保留', async t => {
  const f = await fixture(t)
  const names = [1, 2, 3, 4, 5].map(i => f.add(`sql-2026110${i}_120000.sql`, f.now() + i * 1000))
  f.save({ enabled: true, retention: { enabled: true, sqlCount: 1, zipCount: 1 } })
  names.forEach(name => f.service.enqueue(name, true))
  const state = f.repository.read()
  Object.assign(state.tasks[0], { status: 'success' })
  Object.assign(state.tasks[1], { status: 'failed', error: '模拟上传失败' })
  Object.assign(state.tasks[2], { nextAttempt: f.now() + HOUR })
  Object.assign(state.tasks[3], { status: 'success', fingerprint: 'stale-fingerprint' })
  Object.assign(state.tasks[4], { status: 'success' })
  f.repository.write(state)
  f.uploadFailures.add(names[3])
  await f.service.tick()
  assert.deepEqual(f.deleted, [names[0]])
  for (const name of names.slice(1)) assert.equal(fs.existsSync(path.join(f.directory, name)), true)
  assert.equal(f.service.getSettings().retention.lastError, '')
})

test('待上传文件在自动上传关闭时同样受保护；半成品、符号链接不自动删除', async t => {
  const f = await fixture(t)
  const queued = f.add('sql-20261101_120000.sql', f.now() - 4000)
  const incomplete = f.add('sql-20261102_120000.sql', f.now() - 3000)
  fs.writeFileSync(path.join(f.directory, incomplete), 'partial')
  fs.symlinkSync(path.join(f.directory, queued), path.join(f.directory, 'sql-20261103_120000.sql'))
  f.add('sql-20261104_120000.sql', f.now())
  const task = f.service.enqueue(queued)
  f.service.updateTask(task.id, { nextAttempt: f.now() + HOUR })
  f.save({ retention: { enabled: true, sqlCount: 1, zipCount: 1 } })
  await f.service.tick()
  assert.deepEqual(f.deleted, [])
  assert.equal(f.service.getSettings().retention.lastError, '', '半成品及链接属于预期排除项')
  assert.equal(fs.lstatSync(path.join(f.directory, 'sql-20261103_120000.sql')).isSymbolicLink(), true)
})

test('清理失败有持久化提示和退避，修复后清除错误；关闭后不删除', async t => {
  const f = await fixture(t)
  const old = f.add('sql-20261101_120000.sql', f.now() - 1000)
  f.add('sql-20261102_120000.sql')
  f.save({ retention: { enabled: true, sqlCount: 1, zipCount: 1 } })
  const original = f.backup.deleteBackup
  f.backup.deleteBackup = () => { throw new Error('synthetic-private-file-path') }
  await f.service.tick()
  assert.equal(JSON.stringify(f.service.getSettings()).includes('synthetic-private'), false)
  assert.match(f.service.getSettings().retention.lastError, /清理失败/)
  f.backup.deleteBackup = original
  await f.service.tick()
  assert.deepEqual(f.deleted, [])
  f.advance(RETRY)
  await f.service.tick()
  assert.deepEqual(f.deleted, [old])
  assert.equal(f.service.getSettings().retention.lastError, '')
  f.add('sql-20261103_120000.sql')
  f.save({ retention: { enabled: false, sqlCount: 1, zipCount: 1 } })
  f.advance(RETRY)
  await f.service.tick()
  assert.deepEqual(f.deleted, [old])
})
