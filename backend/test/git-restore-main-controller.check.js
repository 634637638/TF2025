'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const GitController = require('../src/controllers/git.controller')
const GitRestoreMainService = require('../src/services/git-restore-main.service')

const routeSource = fs.readFileSync(path.join(__dirname, '../src/routes/git.js'), 'utf8')
const response = () => ({
  status(code) { this.statusCode = code; return this },
  json(body) { this.body = body; return this }
})

const makeService = ({ branch = 'main', detached = false, status = '', commands = {}, backupResult = { backupBranch: 'backup-snapshot' } } = {}) => {
  const calls = []
  const service = new GitRestoreMainService({
    gitService: {
      async getHeadState() { return { branch, detached, shortCommit: 'abc1234' } },
      async createBranchBackupSnapshot(options) { calls.push(['backup', options]); return backupResult }
    },
    async executeCommand(command) {
      calls.push(['command', command])
      if (command === 'git status --porcelain') return { stdout: status }
      if (command === 'git status --porcelain --untracked-files=all') return { stdout: commands.residualStatus || '' }
      if (commands.failCommand === command) throw Object.assign(new Error('command failed'), { error: 'command failed', stderr: commands.stderr || '' })
      return { stdout: '' }
    },
    async executeArgs(args) {
      calls.push(['args', args])
      if (commands.failArgs === args[0]) throw Object.assign(new Error('operation failed'), { stderr: commands.stderr || '' })
    },
    projectRoot: '/fake/project',
    fileSystem: {
      async access() { throw Object.assign(new Error('missing'), { code: 'ENOENT' }) },
      async mkdir() {}, async rename() {}, async copyFile() {}, async unlink() {}
    },
    now: () => new Date('2026-11-08T12:34:56.000Z'),
    logger: { warn() {} }
  })
  return { service, calls }
}

test('restore-main route keeps edit permission and delegates to the controller', () => {
  assert.match(routeSource, /router\.post\('\/restore-main', requireGitEdit, gitRestoreMainController\.restoreMain\.bind\(gitRestoreMainController\)\)/)
  assert.doesNotMatch(routeSource, /router\.post\('\/restore-main',[\s\S]{0,500}async\s*\(/)
})

test('restore-main service preserves the current-main response without running Git mutations', async () => {
  const { service, calls } = makeService({ branch: 'main', status: ' M app.js' })
  assert.deepEqual(await service.restoreMain(), {
    success: true,
    data: { message: '当前已经在 main，最新未提交代码已保留，无需恢复', branch: 'main', hasChanges: true }
  })
  assert.deepEqual(calls, [['command', 'git status --porcelain']])
})

test('restore-main service backs up dirty work, stashes residual files, returns to main and merges the snapshot', async () => {
  const { service, calls } = makeService({
    branch: 'feature/work',
    status: ' M app.js',
    commands: { residualStatus: '?? untracked.txt' }
  })
  assert.deepEqual(await service.restoreMain(), {
    success: true,
    data: {
      message: '已恢复到 main，并已带回 backup-snapshot 的最新代码，剩余文件也已恢复',
      branch: 'main',
      restoredFromDetached: false,
      backupBranch: 'backup-snapshot',
      snapshotBranch: 'backup-snapshot',
      merged: true,
      appliedStash: true,
      movedGeneratedFiles: []
    }
  })
  const backupOptions = calls.find(call => call[0] === 'backup')[1]
  assert.equal(backupOptions.name, 'backup-2026-11-08T12-34-56')
  assert.match(backupOptions.message, /^🌿 自动恢复主线备份 - .+\n\n修改内容:\n恢复到 main 之前自动保存当前状态。/)
  assert.equal(backupOptions.includeChanges, true)
  assert.equal(backupOptions.returnToOriginal, false)
  assert.ok(calls.some(call => call[0] === 'args' && call[1][0] === 'checkout'))
  assert.ok(calls.some(call => call[0] === 'args' && call[1][0] === 'merge'))
  assert.ok(calls.some(call => call[0] === 'command' && call[1] === 'git stash drop'))
})

test('restore-main service preserves merge and stash conflict contracts', async () => {
  const mergeConflict = makeService({
    branch: 'feature/work',
    commands: { failArgs: 'merge' }
  })
  assert.deepEqual(await mergeConflict.service.restoreMain(), {
    status: 409,
    body: {
      success: false,
      error: '已回到 main，但当前最新代码未能自动合并到主线',
      hint: '你的代码已经安全保存在分支 feature/work。请后续手动将该分支合并到 main。',
      code: 'MERGE_CONFLICT',
      data: { backupBranch: 'feature/work', snapshotBranch: null }
    }
  })

  const stashConflict = makeService({
    branch: 'feature/work',
    commands: { residualStatus: '?? file.txt', failCommand: 'git stash apply' }
  })
  const result = await stashConflict.service.restoreMain()
  assert.equal(result.status, 409)
  assert.equal(result.body.code, 'STASH_APPLY_CONFLICT')
  assert.equal(result.body.data.backupBranch, 'feature/work')
  assert.equal(result.body.data.stashName, 'auto-restore-main-1794141296000')
})

test('restore-main service retries checkout only when generated declaration files block the switch', async () => {
  const calls = []
  let checkoutAttempts = 0
  const service = new GitRestoreMainService({
    gitService: {},
    executeCommand: async () => ({ stdout: '' }),
    async executeArgs(args) {
      calls.push(args)
      checkoutAttempts += 1
      if (checkoutAttempts === 1) throw Object.assign(new Error('blocked'), { stderr: 'frontend/src/components.d.ts would be overwritten' })
    },
    projectRoot: '/fake/project',
    fileSystem: {
      async access(filePath) { if (!filePath.endsWith('frontend/src/components.d.ts')) throw new Error('missing') },
      async mkdir() {},
      async rename(source, target) { calls.push(['move', source, target]) },
      async copyFile() {}, async unlink() {}
    },
    now: () => new Date('2026-11-08T12:34:56.000Z'),
    logger: { warn() {} }
  })

  assert.deepEqual(await service.checkoutMainWithGeneratedFileRetry('main'), ['frontend/src/components.d.ts'])
  assert.equal(calls.filter(call => call[0] === 'checkout').length, 2)
  assert.ok(calls.some(call => call[0] === 'move'))
})

test('restore-main controller keeps successful, blocked-checkout and generic error responses', async () => {
  const controller = new GitController({
    executeCommand: async () => ({ stdout: '' }),
    restoreMainService: { async restoreMain() { return { success: true, data: { branch: 'main' } } } },
    logger: { error() {} }
  })
  const success = response()
  await controller.restoreMain({}, success)
  assert.equal(success.statusCode, 200)
  assert.deepEqual(success.body, { success: true, data: { branch: 'main' } })

  controller.restoreMainService.restoreMain = async () => { throw Object.assign(new Error('blocked'), { stderr: 'would be overwritten by checkout', code: 1 }) }
  const blocked = response()
  await controller.restoreMain({}, blocked)
  assert.equal(blocked.statusCode, 409)
  assert.equal(blocked.body.code, 'CHECKOUT_BLOCKED')

  controller.restoreMainService.restoreMain = async () => { throw new Error('unexpected') }
  const failed = response()
  await controller.restoreMain({}, failed)
  assert.equal(failed.statusCode, 500)
  assert.deepEqual(failed.body, {
    success: false,
    error: '恢复到 main 失败',
    hint: '请检查 Git 仓库状态后重试',
    details: { stderr: undefined, code: undefined }
  })
})
