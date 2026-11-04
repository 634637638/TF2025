const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const backupService = require('../src/services/backup.service')
const routeSource = fs.readFileSync(path.join(__dirname, '../src/routes/backup.js'), 'utf8')
const frontendSource = fs.readFileSync(path.join(__dirname, '../../frontend/src/views/backup/BackupView.vue'), 'utf8')

test('backup service accepts only canonical full and database backup filenames', () => {
  assert.equal(backupService.isValidBackupFilename('backup_20261104_120000.zip'), true)
  assert.equal(backupService.isValidBackupFilename('database_20261104_120000.sql'), true)
  assert.equal(backupService.isValidBackupFilename('../database_20261104_120000.sql'), false)
  assert.equal(backupService.isValidBackupFilename('database_20261104_120000.zip'), false)
})

test('backup API keeps full backup as the legacy default and validates requested type', () => {
  assert.match(routeSource, /req\.body\?\.type\s*\|\|\s*'full'/)
  assert.match(routeSource, /\['full', 'database'\]\.includes\(type\)/)
  assert.match(routeSource, /backupService\.createBackup\(type\)/)
})

test('backup page exposes database-only and full backup choices', () => {
  assert.match(frontendSource, /value="database"/)
  assert.match(frontendSource, /value="full"/)
  assert.match(frontendSource, /type: backupType\.value/)
})
