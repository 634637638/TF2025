const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const backupService = require('../src/services/backup.service')
const BackupController = require('../src/controllers/backup.controller')
const routeSource = fs.readFileSync(path.join(__dirname, '../src/routes/backup.js'), 'utf8')
const frontendSource = fs.readFileSync(path.join(__dirname, '../../frontend/src/views/backup/BackupView.vue'), 'utf8')

const createResponse = () => ({
  status(code) { this.statusCode = code; return this },
  json(body) { this.body = body; return this },
  download(filePath, filename, callback) { this.downloadArgs = { filePath, filename, callback }; return this }
})

test('backup service accepts only canonical full and database backup filenames', () => {
  assert.equal(backupService.isValidBackupFilename('backup_20261104_120000.zip'), true)
  assert.equal(backupService.isValidBackupFilename('sql-20261104_120000.sql'), true)
  assert.equal(backupService.isValidBackupFilename('database_20261104_120000.sql'), true)
  assert.equal(backupService.isValidBackupFilename('../sql-20261104_120000.sql'), false)
  assert.equal(backupService.isValidBackupFilename('database_20261104_120000.zip'), false)
  assert.equal(backupService.isValidBackupFilename('sql-20261104_120000.zip'), false)
  assert.equal(backupService.isValidBackupFilename('sql-20261104_120000.sql.tmp'), false)
})

test('backup API keeps full backup as the legacy default and validates requested type', () => {
  assert.match(routeSource, /router\.post\('\/create', unifiedAuth, requirePermission\('backup:create'\), backupController\.create\.bind\(backupController\)\)/)
  assert.match(routeSource, /const authenticateBackupDownload = backupController\.authenticateDownload\.bind\(backupController\)/)
  assert.match(routeSource, /router\.get\('\/download\/:filename', authenticateBackupDownload, backupController\.download\.bind\(backupController\)\)/)
  const calls = []
  const controller = new BackupController({
    service: { async createBackup(type) { calls.push(type); return { filename: 'sql-20261104_120000.sql' } } },
    logger: { error() {} }
  })
  const invalid = createResponse()
  controller.create({ body: { type: 'other' } }, invalid)
  assert.equal(invalid.statusCode, 400)

  const success = createResponse()
  return controller.create({}, success).then(() => {
    assert.deepEqual(calls, ['full'])
    assert.deepEqual(success.body.data, { filename: 'sql-20261104_120000.sql' })
  })
})

test('backup controller binds short-lived download tokens to one filename', () => {
  let now = 1_000
  const controller = new BackupController({
    service: {
      isValidBackupFilename: filename => filename === 'sql-20261104_120000.sql',
      getBackupPath: () => '/safe/sql-20261104_120000.sql'
    },
    logger: { error() {} },
    now: () => now,
    createToken: () => 'single-use-test-token'
  })
  const link = createResponse()
  controller.downloadLink({ params: { filename: 'sql-20261104_120000.sql' }, user: { id: 7 } }, link)
  assert.equal(link.body.data.url, '/api/backup/download/sql-20261104_120000.sql?download_token=single-use-test-token')

  let nextCalled = false
  const accepted = createResponse()
  controller.authenticateDownload({ params: { filename: 'sql-20261104_120000.sql' }, query: { download_token: 'single-use-test-token' } }, accepted, () => { nextCalled = true })
  assert.equal(nextCalled, true)

  const wrongFilename = createResponse()
  controller.authenticateDownload({ params: { filename: 'other.sql' }, query: { download_token: 'single-use-test-token' } }, wrongFilename, () => assert.fail('wrong filename must not pass'))
  assert.equal(wrongFilename.statusCode, 401)

  now += 60_001
  const expired = createResponse()
  controller.authenticateDownload({ params: { filename: 'sql-20261104_120000.sql' }, query: { download_token: 'single-use-test-token' } }, expired, () => assert.fail('expired token must not pass'))
  assert.equal(expired.statusCode, 401)
})

test('backup controller validates filenames before download and streams the service path', () => {
  const controller = new BackupController({
    service: {
      isValidBackupFilename: filename => filename === 'sql-20261104_120000.sql',
      getBackupPath: () => '/safe/sql-20261104_120000.sql'
    },
    logger: { error() {} }
  })
  const invalid = createResponse()
  controller.download({ params: { filename: '../secret.sql' } }, invalid)
  assert.equal(invalid.statusCode, 400)

  const valid = createResponse()
  controller.download({ params: { filename: 'sql-20261104_120000.sql' } }, valid)
  assert.deepEqual({ filePath: valid.downloadArgs.filePath, filename: valid.downloadArgs.filename }, {
    filePath: '/safe/sql-20261104_120000.sql', filename: 'sql-20261104_120000.sql'
  })
})

test('backup page exposes database-only and full backup choices', () => {
  assert.match(frontendSource, /value="database"/)
  assert.match(frontendSource, /value="full"/)
  assert.match(frontendSource, /type: backupType\.value/)
})
