'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const { execFile } = require('node:child_process')
const os = require('node:os')
const path = require('node:path')
const test = require('node:test')
const { promisify } = require('node:util')
const Controller = require('../src/controllers/git.controller')
const GitArchiveBackupService = require('../src/services/git-archive-backup.service')

const routeSource = fs.readFileSync(path.join(__dirname, '../src/routes/git.js'), 'utf8')
const response = () => ({
  status(code) { this.statusCode = code; return this },
  json(body) { this.body = body; return this }
})

const createService = ({ archive, exists = [], status = ' M src/app.js', gitLog = '1234567890abcdef|subject|date|author', logger } = {}) => {
  const archiveCalls = []
  const commands = []
  const root = '/project'
  const service = new GitArchiveBackupService({
    projectRoot: root,
    fileSystem: {
      async mkdir(...args) { commands.push(['mkdir', ...args]) },
      async stat(filePath) { commands.push(['stat', filePath]); return { size: 2097152 } }
    },
    existsSync: filePath => exists.includes(filePath),
    executeCommand: async command => {
      commands.push(['command', command])
      if (command === 'git status --porcelain') return { stdout: status }
      if (command.startsWith('git log')) return { stdout: gitLog }
      throw new Error(`unexpected command ${command}`)
    },
    executeArchive: async (...args) => {
      archiveCalls.push(args)
      if (archive) return archive(...args)
      return { stdout: '', stderr: '' }
    },
    now: () => new Date('2026-11-08T12:34:56.000Z'),
    logger: logger || { debug() {}, error() {} }
  })
  return { service, archiveCalls, commands, root }
}

test('archive route keeps create permission and delegates to the Git controller', () => {
  assert.match(routeSource, /router\.post\('\/backup\/archive', requireGitCreate, gitController\.createArchiveBackup\.bind\(gitController\)\)/)
})

test('archive service preserves safe name, Beijing timestamp, file selection, exclusions, and response data', async () => {
  const { service, archiveCalls, commands, root } = createService({
    exists: [
      '/project/docs',
      '/project/backend/src',
      '/project/backend/package.json',
      '/project/backend/package-lock.json',
      '/project/backend/server.js',
      '/project/backend/start-production.js',
      '/project/backend/ecosystem.production.config.js',
      '/project/backend/scripts',
      '/project/backend/deploy',
      '/project/backend/database',
      '/project/backend/migrations',
      '/project/backend/.env.example',
      '/project/package-lock.json',
      '/project/scripts',
      '/project/eslint.config.js',
      '/project/AGENTS.md',
      '/project/CLAUDE.md',
      '/project/.gitignore'
    ]
  })
  const result = await service.createArchiveBackup(' My/Backup! ')
  assert.equal(result.message, '本地压缩包备份创建成功 (2.00 MB)')
  assert.deepEqual(result.backup, {
    fileName: 'My_Backup_.tar.gz',
    filePath: path.join(root, '本地备份', 'My_Backup_.tar.gz'),
    fileSize: '2.00 MB',
    fileSizeBytes: 2097152,
    createdAt: '2026-11-08T12:34:56.000Z',
    gitInfo: { hash: '12345678', message: 'subject', date: 'date', author: 'author' },
    hasChanges: true,
    includedItems: [
      'frontend', 'package.json', 'docs', 'backend/src', 'backend/package.json', 'backend/package-lock.json',
      'backend/server.js', 'backend/start-production.js', 'backend/ecosystem.production.config.js',
      'backend/scripts', 'backend/deploy', 'backend/database', 'backend/migrations', 'backend/.env.example',
      'package-lock.json', 'scripts', 'eslint.config.js', 'AGENTS.md', 'CLAUDE.md', '.gitignore'
    ],
    type: 'archive'
  })
  assert.equal(archiveCalls.length, 1)
  assert.equal(archiveCalls[0][0], 'tar')
  assert.equal(archiveCalls[0][1][archiveCalls[0][1].indexOf('-czf') + 1], path.join(root, '本地备份', 'My_Backup_.tar.gz'))
  assert.deepEqual(archiveCalls[0][1].slice(-result.backup.includedItems.length), result.backup.includedItems)
  assert.ok(archiveCalls[0][1].includes('--exclude=backend/.env.production'))
  assert.ok(!archiveCalls[0][1].includes('--exclude=backend/scripts/*.json'))
  assert.deepEqual(archiveCalls[0][2], { cwd: root, maxBuffer: 10 * 1024 * 1024, timeout: 120000 })
  assert.ok(commands.some(call => call[1] === 'git status --porcelain'))
})

test('archive service retries with the same protected file exclusions and preserves empty Git metadata fallback', async () => {
  const { service, archiveCalls } = createService({
    status: '',
    gitLog: '',
    archive: async (_command, _args, options) => {
      if (options.timeout === 120000) throw new Error('first tar failed')
      return { stdout: '', stderr: '' }
    }
  })
  const result = await service.createArchiveBackup('')
  assert.equal(archiveCalls.length, 2)
  assert.equal(archiveCalls[1][2].timeout, 60000)
  assert.ok(archiveCalls[1][1].includes('--exclude=backend/.env.production'))
  assert.ok(archiveCalls[1][1].includes('--exclude=backend/logs'))
  assert.ok(archiveCalls[1][1].includes('--exclude=本地备份'))
  assert.deepEqual(archiveCalls[1][1], archiveCalls[0][1])
  assert.equal(result.backup.hasChanges, false)
  assert.equal(result.backup.gitInfo.hash, '')
  assert.equal(result.backup.gitInfo.message, undefined)
  assert.match(result.backup.fileName, /^2026-11-08_20-34-56备份\.tar\.gz$/)
})

test('archive service rejects concurrent work and releases the process lock after success or failure', async () => {
  let finishArchive
  let markArchiveStarted
  const archiveStarted = new Promise(resolve => { markArchiveStarted = resolve })
  const inFlight = createService()
  inFlight.service.executeArchive = () => {
    markArchiveStarted()
    return new Promise(resolve => { finishArchive = resolve })
  }
  const first = inFlight.service.createArchiveBackup('first')
  await archiveStarted
  const controller = new Controller({
    service: {},
    archiveBackupService: inFlight.service,
    logger: { debug() {}, error() {} }
  })
  const rejected = response()
  await controller.createArchiveBackup({ body: { name: 'second' } }, rejected)
  assert.equal(rejected.statusCode, 409)
  assert.deepEqual(rejected.body, { success: false, error: '已有压缩包备份正在创建，请稍后再试' })
  finishArchive({ stdout: '', stderr: '' })
  await first

  const failing = createService({ archive: async () => { throw new Error('tar unavailable') } })
  await assert.rejects(failing.service.createArchiveBackup('bad'), /无法创建压缩包: tar unavailable/)
  const recovered = createService()
  assert.equal((await recovered.service.createArchiveBackup('after-failure')).backup.fileName, 'after-failure.tar.gz')
})

test('archive controller maps successful results and operational failures to the established HTTP shapes', async () => {
  const controller = new Controller({
    service: {},
    archiveBackupService: { async createArchiveBackup(name) { return { message: 'ok', backup: { fileName: `${name}.tar.gz` } } } },
    logger: { debug() {}, error() {} }
  })
  const success = response()
  await controller.createArchiveBackup({ body: { name: 'save' } }, success)
  assert.deepEqual(success.body, { success: true, data: { message: 'ok', backup: { fileName: 'save.tar.gz' } } })

  controller.archiveBackupService.createArchiveBackup = async () => { throw new Error('disk full') }
  const failure = response()
  await controller.createArchiveBackup({ body: {} }, failure)
  assert.equal(failure.statusCode, 500)
  assert.deepEqual(failure.body, {
    success: false,
    error: 'disk full',
    hint: '请检查磁盘空间和 tar 命令是否可用'
  })
})

test('真实压缩包保留两端部署模板和根工具，排除备份、依赖、日志及证书', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tf-git-archive-'))
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  const included = [
    'frontend/src/main.ts', 'frontend/deploy/nginx.conf', 'docs/00-INDEX.md',
    'package.json', 'package-lock.json', 'eslint.config.js', 'scripts/check-docs.mjs',
    'AGENTS.md', 'CLAUDE.md', '.gitignore', 'backend/deploy/nginx.conf',
    'backend/src/config/reminder-policy.json'
  ]
  const excluded = [
    'frontend/node_modules/package/index.js', 'frontend/logs/development.log',
    'frontend/ssl/local-dev-key.pem', 'backend/backups/previous.tar.gz',
    '本地备份/previous.tar.gz', '.claude/settings.json', 'project.private.config.json'
  ]
  for (const file of [...included, ...excluded]) {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true })
    fs.writeFileSync(path.join(root, file), 'fixture\n')
  }
  const execute = promisify(execFile)
  const service = new GitArchiveBackupService({
    projectRoot: root,
    fileSystem: fs.promises,
    existsSync: fs.existsSync,
    executeCommand: async () => ({ stdout: '' }),
    executeArchive: execute,
    logger: { debug() {} }
  })
  const result = await service.createArchiveBackup('source-snapshot')
  assert.equal(path.dirname(result.backup.filePath), path.join(root, '本地备份'))
  const { stdout } = await execute('tar', ['-tzf', result.backup.filePath], { timeout: 10000 })
  const entries = new Set(stdout.trim().split('\n'))
  for (const file of included) assert.ok(entries.has(file), `源码快照缺少 ${file}`)
  for (const file of excluded) assert.ok(!entries.has(file), `源码快照错误包含 ${file}`)
  assert.ok(result.backup.fileSizeBytes > 0)
})
