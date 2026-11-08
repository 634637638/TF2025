'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const GitController = require('../src/controllers/git.controller')
const GitService = require('../src/services/git.service')

const routeSource = fs.readFileSync(path.join(__dirname, '../src/routes/git.js'), 'utf8')

const makeResponse = () => ({
  status(code) { this.statusCode = code; return this },
  json(body) { this.body = body; return this }
})

test('git status route keeps view permission and delegates to controller', () => {
  assert.match(routeSource, /router\.get\('\/status', requireGitView, gitController\.getStatus\.bind\(gitController\)\)/)
  assert.match(routeSource, /router\.get\('\/log', requireGitView, gitController\.getLog\.bind\(gitController\)\)/)
  assert.match(routeSource, /router\.get\('\/branches', requireGitView, gitController\.getBranches\.bind\(gitController\)\)/)
  assert.match(routeSource, /router\.post\('\/clean', requireGitEdit, gitController\.cleanUntrackedFiles\.bind\(gitController\)\)/)
  assert.match(routeSource, /router\.post\('\/create-branch', requireGitCreate, gitController\.createBranch\.bind\(gitController\)\)/)
  assert.match(routeSource, /router\.delete\('\/delete-branch', requireGitDelete, gitController\.deleteBranch\.bind\(gitController\)\)/)
  assert.match(routeSource, /router\.post\('\/switch-branch', requireGitEdit, gitController\.switchBranch\.bind\(gitController\)\)/)
  assert.match(routeSource, /router\.post\('\/checkout', requireGitEdit, gitController\.checkoutCommit\.bind\(gitController\)\)/)
  assert.match(routeSource, /router\.post\('\/backup\/branch', requireGitCreate, gitController\.createBranchBackup\.bind\(gitController\)\)/)
  assert.match(routeSource, /router\.post\('\/delete-commit', requireGitDelete, gitController\.hideCommit\.bind\(gitController\)\)/)
})

test('git status service preserves status parsing, branch counts and recent commits', async () => {
  const commands = []
  const service = new GitService({
    executeCommand: async command => {
      commands.push(command)
      const outputs = {
        'git status --porcelain': 'M file.js\n?? new.js',
        'git status --short --branch': '## main...origin/main [ahead 2, behind 3]',
        'git log --oneline -5': 'a1 first\nb2 second',
        'git branch --show-current': 'main',
        'git rev-parse --short HEAD': 'c3d4'
      }
      return { stdout: outputs[command] }
    }
  })

  assert.deepEqual(await service.getStatus(), {
    branch: 'main',
    branchDisplay: 'main',
    detached: false,
    headCommit: 'c3d4',
    aheadCount: 2,
    behindCount: 3,
    hasChanges: true,
    changes: [
      { status: 'M', file: 'file.js' },
      { status: '??', file: 'new.js' }
    ],
    recentCommits: ['a1 first', 'b2 second']
  })
  assert.deepEqual(commands, [
    'git status --porcelain',
    'git status --short --branch',
    'git log --oneline -5',
    'git branch --show-current',
    'git rev-parse --short HEAD'
  ])
})

test('git status controller preserves success and server-error responses', async () => {
  const data = { branch: 'main', hasChanges: false }
  const success = makeResponse()
  await new GitController({ service: { async getStatus() { return data } } }).getStatus({}, success)
  assert.deepEqual(success.body, { success: true, data })

  const errors = []
  const failure = makeResponse()
  await new GitController({
    service: { async getStatus() { throw Object.assign(new Error('failed'), { error: 'Git 不可用' }) } },
    logger: { error(...args) { errors.push(args) } }
  }).getStatus({}, failure)
  assert.equal(failure.statusCode, 500)
  assert.deepEqual(failure.body, { success: false, error: 'Git 不可用' })
  assert.equal(errors.length, 1)
})

test('git clean service only runs cleanup when porcelain status contains untracked files', async () => {
  const commands = []
  const outputs = [' M tracked.js\n?? new.js\n?? folder/file.js', ' M tracked.js']
  const service = new GitService({
    executeCommand: async command => {
      commands.push(command)
      return { stdout: outputs.shift() || '' }
    }
  })

  assert.deepEqual(await service.cleanUntrackedFiles(), {
    message: '已清理 2 个未跟踪文件',
    cleanedCount: 2,
    files: ['new.js', 'folder/file.js']
  })
  assert.deepEqual(await service.cleanUntrackedFiles(), {
    message: '没有未跟踪的文件需要清理',
    cleanedCount: 0
  })
  assert.deepEqual(commands, ['git status --porcelain', 'git clean -fd', 'git status --porcelain'])
})

test('git clean controller preserves success and failure response contracts', async () => {
  const success = makeResponse()
  await new GitController({ service: { async cleanUntrackedFiles() { return { cleanedCount: 0 } } } })
    .cleanUntrackedFiles({}, success)
  assert.deepEqual(success.body, { success: true, data: { cleanedCount: 0 } })

  const failure = makeResponse()
  await new GitController({
    service: { async cleanUntrackedFiles() { throw Object.assign(new Error('failed'), { error: '清理失败' }) } },
    logger: { error() {} }
  }).cleanUntrackedFiles({}, failure)
  assert.equal(failure.statusCode, 500)
  assert.deepEqual(failure.body, { success: false, error: '清理失败' })
})

test('git log service bounds results and hides reverted, marked and backup commits', async () => {
  const commands = []
  const entries = [
    ['a'.repeat(40), 'visible', 'visible body', 'author', '2026-11-08'].join('\x1f'),
    ['b'.repeat(40), 'hidden', 'hidden body', 'author', '2026-11-08'].join('\x1f'),
    ['c'.repeat(40), 'reverted source', 'source body', 'author', '2026-11-08'].join('\x1f'),
    ['d'.repeat(40), 'revert commit', `This reverts commit ${'c'.repeat(40)}.`, 'author', '2026-11-08'].join('\x1f'),
    ['e'.repeat(40), '自动备份 snapshot', 'backup', 'author', '2026-11-08'].join('\x1f')
  ].join('\x1e')
  const service = new GitService({
    executeCommand: async () => ({ stdout: '' }),
    executeArgs: async args => {
      commands.push(args)
      if (args[0] === 'log') return { stdout: entries }
      if (args[0] === 'config') return { stdout: `${'b'.repeat(40)}\n` }
      throw new Error('unexpected git args')
    }
  })

  assert.deepEqual(await service.getCommits('4'), [
    { hash: 'a'.repeat(40), message: 'visible', author: 'author', date: '2026-11-08' }
  ])
  assert.deepEqual(commands, [
    ['log', '-12', '--date=iso', '--pretty=format:%H%x1f%s%x1f%B%x1f%an%x1f%ad%x1e'],
    ['config', '--local', '--get-all', 'tf2025.hiddenCommit']
  ])
})

test('git log controller preserves response envelope and safe error message', async () => {
  const response = makeResponse()
  await new GitController({ service: { async getCommits(limit) { assert.equal(limit, '2'); return [{ hash: 'abc' }] } } })
    .getLog({ query: { limit: '2' } }, response)
  assert.deepEqual(response.body, { success: true, data: { commits: [{ hash: 'abc' }] } })

  const errors = []
  const failure = makeResponse()
  await new GitController({
    service: { async getCommits() { throw Object.assign(new Error('git failed'), { error: '读取历史失败' }) } },
    logger: { error(...args) { errors.push(args) } }
  }).getLog({ query: {} }, failure)
  assert.equal(failure.statusCode, 500)
  assert.deepEqual(failure.body, { success: false, error: '读取历史失败' })
  assert.equal(errors.length, 1)
})

test('git branches service preserves local current marker and filters remote HEAD', async () => {
  const commands = []
  const outputs = {
    'git branch': '* main\n  release/1.0\n',
    'git branch -r': '  origin/HEAD -> origin/main\n  origin/main\n  origin/release/1.0\n',
    'git branch --show-current': 'main',
    'git rev-parse --short HEAD': 'a1b2c3d'
  }
  const service = new GitService({
    executeCommand: async command => {
      commands.push(command)
      return { stdout: outputs[command] || '' }
    }
  })

  assert.deepEqual(await service.getBranches(), {
    current: 'main',
    currentDisplay: 'main',
    detached: false,
    branches: [
      { name: 'main', type: 'local', current: true },
      { name: 'release/1.0', type: 'local', current: false },
      { name: 'origin/main', type: 'remote', current: false },
      { name: 'origin/release/1.0', type: 'remote', current: false }
    ]
  })
  assert.deepEqual(commands, ['git branch', 'git branch -r', 'git branch --show-current', 'git rev-parse --short HEAD'])
})

test('git create-branch service validates names and checks out the requested base before creating', async () => {
  const commands = []
  const service = new GitService({
    executeCommand: async command => ({ stdout: command }),
    executeArgs: async args => {
      commands.push(args)
      return { stdout: '' }
    }
  })

  assert.deepEqual(await service.createBranch(' feature/new ', ' main '), {
    message: '已创建并切换到新分支: feature/new',
    branch: 'feature/new'
  })
  assert.deepEqual(commands, [['checkout', 'main'], ['checkout', '-b', 'feature/new']])
  await assert.rejects(service.createBranch('-bad'), { code: 'INVALID_BRANCH' })
  await assert.rejects(service.createBranch('valid', 'bad..base'), { code: 'INVALID_BRANCH' })
})

test('git create-branch controller preserves success and invalid-name responses', async () => {
  const success = makeResponse()
  await new GitController({
    service: { async createBranch(name, baseBranch) {
      assert.equal(name, 'feature/new')
      assert.equal(baseBranch, 'main')
      return { message: '已创建并切换到新分支: feature/new', branch: 'feature/new' }
    } }
  }).createBranch({ body: { name: 'feature/new', baseBranch: 'main' } }, success)
  assert.deepEqual(success.body, {
    success: true,
    data: { message: '已创建并切换到新分支: feature/new', branch: 'feature/new' }
  })

  const invalid = makeResponse()
  await new GitController({
    service: { async createBranch() { throw Object.assign(new Error('invalid'), { code: 'INVALID_BRANCH', error: '新分支名称不合法' }) } },
    logger: { error() {} }
  }).createBranch({ body: {} }, invalid)
  assert.equal(invalid.statusCode, 400)
  assert.deepEqual(invalid.body, { success: false, error: '新分支名称不合法' })
})

test('git delete-branch service validates the branch and selects safe or force deletion', async () => {
  const commands = []
  const service = new GitService({
    executeCommand: async () => ({ stdout: '' }),
    executeArgs: async args => {
      commands.push(args)
      return { stdout: '' }
    }
  })

  assert.deepEqual(await service.deleteBranch(' feature/old '), {
    message: '已删除分支: feature/old',
    branch: 'feature/old'
  })
  await service.deleteBranch('feature/forced', true)
  assert.deepEqual(commands, [['branch', '-d', 'feature/old'], ['branch', '-D', 'feature/forced']])
  await assert.rejects(service.deleteBranch('-invalid'), { code: 'INVALID_BRANCH' })
})

test('git delete-branch controller preserves success and validation responses', async () => {
  const success = makeResponse()
  await new GitController({
    service: { async deleteBranch(branch, force) {
      assert.equal(branch, 'feature/old')
      assert.equal(force, true)
      return { message: '已删除分支: feature/old', branch: 'feature/old' }
    } }
  }).deleteBranch({ body: { branch: 'feature/old', force: true } }, success)
  assert.deepEqual(success.body, {
    success: true,
    data: { message: '已删除分支: feature/old', branch: 'feature/old' }
  })

  const invalid = makeResponse()
  await new GitController({
    service: { async deleteBranch() { throw Object.assign(new Error('invalid'), { code: 'INVALID_BRANCH', error: '分支名称不合法' }) } },
    logger: { error() {} }
  }).deleteBranch({ body: {} }, invalid)
  assert.equal(invalid.statusCode, 400)
  assert.deepEqual(invalid.body, { success: false, error: '分支名称不合法' })
})

test('git switch-branch service validates and checks out the normalized branch', async () => {
  const commands = []
  const service = new GitService({
    executeCommand: async () => ({ stdout: '' }),
    executeArgs: async args => { commands.push(args); return { stdout: '' } }
  })
  assert.deepEqual(await service.switchBranch(' feature/main '), {
    message: '已切换到分支: feature/main',
    branch: 'feature/main'
  })
  assert.deepEqual(commands, [['checkout', 'feature/main']])
  await assert.rejects(service.switchBranch('-invalid'), { code: 'INVALID_BRANCH' })
})

test('git switch-branch controller preserves validation, conflict and missing-branch responses', async () => {
  const success = makeResponse()
  await new GitController({ service: { async switchBranch() { return { branch: 'main' } } } })
    .switchBranch({ body: { branch: 'main' } }, success)
  assert.deepEqual(success.body, { success: true, data: { branch: 'main' } })

  const conflict = makeResponse()
  await new GitController({
    service: { async switchBranch() { throw Object.assign(new Error('checkout failed'), { stderr: 'would be overwritten by checkout' }) } },
    logger: { error() {} }
  }).switchBranch({ body: { branch: 'main' } }, conflict)
  assert.equal(conflict.statusCode, 409)
  assert.equal(conflict.body.code, 'UNCOMMITTED_CHANGES')

  const missing = makeResponse()
  await new GitController({
    service: { async switchBranch() { throw Object.assign(new Error('checkout failed'), { stderr: "error: pathspec 'missing' did not match any file(s) known to git" }) } },
    logger: { error() {} }
  }).switchBranch({ body: { branch: 'missing' } }, missing)
  assert.equal(missing.statusCode, 404)
  assert.equal(missing.body.error, '分支不存在: missing')
})

test('git checkout service preserves reset command order and view fallback behavior', async () => {
  const commands = []
  let createBranchFails = false
  const service = new GitService({
    executeCommand: async command => {
      commands.push(command)
      return { stdout: command === 'git status --porcelain' ? '?? leftover.txt' : '' }
    },
    executeArgs: async args => {
      commands.push(args)
      if (createBranchFails && args[0] === 'checkout' && args[1] === '-b') throw new Error('branch exists')
      return { stdout: '' }
    }
  })
  const commit = 'a'.repeat(40)

  assert.deepEqual(await service.checkoutCommit(commit, 'reset'), {
    message: `已重置到版本 ${commit.substring(0, 8)}`,
    mode: 'reset',
    cleaned: true,
    hasUntrackedFiles: true
  })
  assert.deepEqual(commands.splice(0), [
    ['reset', '--hard', commit],
    'git clean -fd',
    'git status --porcelain'
  ])

  assert.deepEqual(await service.checkoutCommit(commit, 'view'), {
    message: `已切换到版本 ${commit.substring(0, 8)} (临时分支: temp-view-${commit.substring(0, 8)})`,
    mode: 'view',
    branch: `temp-view-${commit.substring(0, 8)}`
  })
  createBranchFails = true
  assert.deepEqual(await service.checkoutCommit(commit, 'view'), {
    message: `已切换到版本 ${commit.substring(0, 8)} (分离 HEAD 状态)`,
    mode: 'view',
    branch: null
  })
  assert.deepEqual(commands, [
    ['checkout', '-b', `temp-view-${commit.substring(0, 8)}`, commit],
    ['checkout', '-b', `temp-view-${commit.substring(0, 8)}`, commit],
    ['checkout', commit]
  ])
  await assert.rejects(service.checkoutCommit('invalid'), { code: 'INVALID_COMMIT' })
})

test('git checkout controller preserves success and invalid-commit responses', async () => {
  const success = makeResponse()
  await new GitController({
    service: { async checkoutCommit(commit, mode) {
      assert.equal(commit, 'abcdef1234567')
      assert.equal(mode, 'view')
      return { mode, branch: 'temp-view-abcdef12' }
    } }
  }).checkoutCommit({ body: { commit: 'abcdef1234567' } }, success)
  assert.deepEqual(success.body, { success: true, data: { mode: 'view', branch: 'temp-view-abcdef12' } })

  const invalid = makeResponse()
  await new GitController({
    service: { async checkoutCommit() { throw Object.assign(new Error('invalid'), { code: 'INVALID_COMMIT', error: '提交哈希不合法' }) } },
    logger: { error() {} }
  }).checkoutCommit({ body: { commit: 'bad' } }, invalid)
  assert.equal(invalid.statusCode, 400)
  assert.deepEqual(invalid.body, { success: false, error: '提交哈希不合法' })
})

test('git branch backup service preserves snapshot commands, commit cleanup and original checkout', async () => {
  const commands = []
  const written = []
  const deleted = []
  const service = new GitService({
    now: () => new Date('2026-11-08T04:00:00.000Z'),
    executeCommand: async command => {
      commands.push(command)
      const outputs = {
        'git branch --show-current': 'main',
        'git rev-parse --short HEAD': 'abc1234',
        'git rev-parse HEAD': 'abc123456789',
        'git status --porcelain': ' M changed.js'
      }
      return { stdout: outputs[command] || '' }
    },
    executeArgs: async args => {
      commands.push(args)
      if (args[0] === 'rev-parse' && args[1] === '--verify') {
        throw Object.assign(new Error('missing branch'), { code: 128 })
      }
      if (args[0] === 'log') return { stdout: 'deadbeef|backup commit|2026-11-08 12:00:00 +0800|author' }
      return { stdout: '' }
    },
    fileSystem: {
      async writeFile(file, content) { written.push({ file, content }) },
      async unlink(file) { deleted.push(file) }
    },
    osModule: { tmpdir: () => '/tmp' }
  })

  const result = await service.createBranchBackupSnapshot({
    name: 'backup/test',
    message: '手工备份',
    includeChanges: true,
    returnToOriginal: true
  })
  assert.deepEqual(result, {
    headState: { branch: 'main', detached: false, shortCommit: 'abc1234', displayName: 'main' },
    originalRef: 'main',
    backupBranch: 'backup/test',
    activeBranch: 'main',
    hasChanges: true,
    commit: { hash: 'deadbeef', message: 'backup commit', date: '2026-11-08 12:00:00 +0800', author: 'author' }
  })
  assert.deepEqual(commands, [
    'git branch --show-current',
    'git rev-parse --short HEAD',
    'git rev-parse HEAD',
    'git status --porcelain',
    ['rev-parse', '--verify', 'refs/heads/backup/test'],
    ['checkout', '-b', 'backup/test'],
    'git add .',
    ['commit', '-F', '/tmp/tf2025_backup_commit_1794110400000.txt'],
    ['log', 'backup/test', '-1', '--pretty=format:%H|%s|%ai|%an'],
    ['checkout', 'main']
  ])
  assert.deepEqual(written, [{ file: '/tmp/tf2025_backup_commit_1794110400000.txt', content: '手工备份' }])
  assert.deepEqual(deleted, ['/tmp/tf2025_backup_commit_1794110400000.txt'])
})

test('git branch backup controller preserves success, duplicate and invalid-name responses', async () => {
  const success = makeResponse()
  await new GitController({
    service: { async createBranchBackupSnapshot() {
      return {
        headState: { detached: false },
        backupBranch: 'backup/test',
        activeBranch: 'main',
        commit: { hash: 'deadbeef', message: 'backup', date: 'date', author: 'author' },
        hasChanges: true
      }
    } }
  }).createBranchBackup({ body: { name: 'backup/test', includeChanges: true } }, success)
  assert.deepEqual(success.body.data.backup, {
    branch: 'backup/test',
    current: 'main',
    commit: { hash: 'deadbeef', message: 'backup', date: 'date', author: 'author' },
    hasChanges: true,
    type: 'branch'
  })

  const duplicate = makeResponse()
  await new GitController({
    service: { async createBranchBackupSnapshot() { throw Object.assign(new Error('exists'), { code: 'BRANCH_EXISTS', error: '备份分支已存在: backup/test' }) } },
    logger: { error() {}, debug() {} }
  }).createBranchBackup({ body: {} }, duplicate)
  assert.equal(duplicate.statusCode, 409)
  assert.equal(duplicate.body.code, 'BRANCH_EXISTS')

  const invalid = makeResponse()
  await new GitController({
    service: { async createBranchBackupSnapshot() { throw Object.assign(new Error('bad'), { code: 'INVALID_BRANCH', error: '备份分支名称不合法' }) } },
    logger: { error() {}, debug() {} }
  }).createBranchBackup({ body: {} }, invalid)
  assert.equal(invalid.statusCode, 400)
  assert.deepEqual(invalid.body, { success: false, error: '备份分支名称不合法' })
})

test('git hide-commit service validates hashes and adds a hidden marker only once', async () => {
  const calls = []
  let existing = ''
  const service = new GitService({
    executeCommand: async () => ({ stdout: '' }),
    executeArgs: async args => {
      calls.push(args)
      if (args[0] === 'config' && args[2] === '--get-all') return { stdout: existing }
      if (args[0] === 'config' && args[2] === '--add') {
        existing = args[4]
        return { stdout: '' }
      }
      throw new Error('unexpected git args')
    }
  })
  const hash = 'AbCdEf123456789'
  assert.deepEqual(await service.hideCommit(hash), {
    message: '已从历史列表隐藏提交 AbCdEf12',
    hiddenHash: hash,
    method: 'hide',
    affectsWorkingTree: false
  })
  assert.match((await service.hideCommit(hash)).message, /已经处于隐藏状态/)
  await assert.rejects(service.hideCommit('invalid hash'), { code: 'INVALID_COMMIT' })
  assert.equal(calls.filter(args => args[2] === '--add').length, 1)
})

test('git hide-commit controller preserves success and validation responses', async () => {
  const success = makeResponse()
  await new GitController({ service: { async hideCommit() { return { hiddenHash: 'abcdef1' } } } })
    .hideCommit({ body: { hash: 'abcdef1' } }, success)
  assert.deepEqual(success.body, { success: true, data: { hiddenHash: 'abcdef1' } })

  const invalid = makeResponse()
  await new GitController({
    service: { async hideCommit() { throw Object.assign(new Error('bad'), { code: 'INVALID_COMMIT', error: '提交哈希不合法' }) } },
    logger: { error() {} }
  }).hideCommit({ body: {} }, invalid)
  assert.equal(invalid.statusCode, 400)
  assert.deepEqual(invalid.body, { success: false, error: '提交哈希不合法' })
})
