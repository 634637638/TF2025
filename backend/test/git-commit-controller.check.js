'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const Controller = require('../src/controllers/git.controller')
const GitCommitService = require('../src/services/git-commit.service')

const routeSource = fs.readFileSync(path.join(__dirname, '../src/routes/git.js'), 'utf8')
const response = () => ({
  status(code) { this.statusCode = code; return this },
  json(body) { this.body = body; return this }
})

const setup = ({ headState = { branch: 'main', detached: false, shortCommit: 'abc1234' }, status = ' M file.js', remote = 'origin', blockedFiles = [], verified = true, pushError } = {}) => {
  const commands = []
  const args = []
  const files = []
  const errors = []
  const service = new GitCommitService({
    getHeadState: async () => headState,
    executeCommand: async command => {
      commands.push(command)
      if (command === 'git status --porcelain') return { stdout: status }
      if (command === 'git remote') return { stdout: remote }
      if (command === 'git push' || command === 'git push --set-upstream origin main') {
        if (pushError) throw pushError
        return { stdout: 'pushed', stderr: '' }
      }
      if (command === 'git log --oneline -1') return { stdout: 'abc1234 latest commit' }
      return { stdout: '' }
    },
    executeArgs: async values => { args.push(values); return { stdout: '' } },
    getUpstreamRef: async () => 'origin/main',
    getPendingPushFileSizeCheck: async () => ({ blockedFiles, warningFiles: [] }),
    buildPushSizeHint: () => 'oversized file hint',
    verifyPushOutcome: async () => ({ verified }),
    fileSystem: {
      async writeFile(...values) { files.push(['write', ...values]) },
      async unlink(...values) { files.push(['unlink', ...values]) }
    },
    osModule: { tmpdir: () => '/tmp' },
    now: () => 123,
    logger: { error(...values) { errors.push(values) } }
  })
  return { service, commands, args, files, errors }
}

test('git commit route keeps edit permission and delegates to controller', () => {
  assert.match(routeSource, /router\.post\('\/commit', requireGitEdit, gitCommitController\.commitChanges\.bind\(gitCommitController\)\)/)
})

test('git commit service rejects detached and non-main HEAD with existing 409 contracts', async () => {
  const detached = await setup({ headState: { detached: true, shortCommit: 'def5678' } }).service.commitChanges()
  assert.equal(detached.statusCode, 409)
  assert.equal(detached.body.code, 'DETACHED_HEAD')
  assert.match(detached.body.hint, /def5678/)

  const feature = await setup({ headState: { branch: 'feature/demo', detached: false } }).service.commitChanges()
  assert.equal(feature.statusCode, 409)
  assert.equal(feature.body.code, 'NOT_MAIN_BRANCH')
  assert.match(feature.body.error, /feature\/demo/)
})

test('git commit service returns without writing when there are no changes', async () => {
  const { service, commands, args } = setup({ status: '' })
  assert.deepEqual(await service.commitChanges(), {
    statusCode: 200,
    body: { success: true, data: { message: '没有需要提交的更改', committed: false, pushed: false } }
  })
  assert.deepEqual(commands, ['git status --porcelain'])
  assert.deepEqual(args, [])
})

test('git commit service commits with a temp message file and verifies successful push', async () => {
  const { service, commands, args, files } = setup()
  const result = await service.commitChanges({ message: 'release update' })
  assert.equal(result.statusCode, 200)
  assert.deepEqual(result.body.data, {
    message: '提交并推送成功', committed: true, pushed: true,
    commit: 'abc1234 latest commit', pushOutput: 'pushed', pushWarning: ''
  })
  assert.ok(commands.includes('git add .'))
  assert.ok(commands.includes('git push'))
  assert.deepEqual(args, [['commit', '-F', '/tmp/tf2025_git_commit_123.txt']])
  assert.equal(files[0][0], 'write')
  assert.match(files[0][2], /release update[\s\S]*Co-Authored-By: Claude/)
  assert.deepEqual(files[1], ['unlink', '/tmp/tf2025_git_commit_123.txt'])
})

test('git commit preserves no-remote and oversized-push outcomes after the local commit', async () => {
  const noRemote = await setup({ remote: '' }).service.commitChanges()
  assert.equal(noRemote.body.data.committed, true)
  assert.equal(noRemote.body.data.pushed, false)
  assert.equal(noRemote.body.data.error, '未配置远程仓库')

  const oversized = await setup({ blockedFiles: [{ path: 'large.bin' }] }).service.commitChanges()
  assert.equal(oversized.body.data.committed, true)
  assert.equal(oversized.body.data.pushed, false)
  assert.deepEqual(oversized.body.data.largeFiles, [{ path: 'large.bin' }])
  assert.equal(oversized.body.data.hint, 'oversized file hint')
})

test('git commit reports failed push verification and controller maps results and errors', async () => {
  const unverified = await setup({ verified: false }).service.commitChanges()
  assert.equal(unverified.body.data.message, '提交成功，但远端未同步，请稍后重试推送')
  assert.equal(unverified.body.data.pushed, false)

  const success = response()
  await new Controller({ service: {}, commitService: { async commitChanges() { return { statusCode: 200, body: { success: true } } } } }).commitChanges({ body: {} }, success)
  assert.equal(success.statusCode, 200)
  assert.deepEqual(success.body, { success: true })

  const errors = []
  const failure = response()
  await new Controller({
    service: {},
    commitService: { async commitChanges() { throw Object.assign(new Error('failed'), { stderr: 'fatal', code: 2 }) } },
    logger: { error(...values) { errors.push(values) } }
  }).commitChanges({ body: {} }, failure)
  assert.equal(failure.statusCode, 500)
  assert.deepEqual(failure.body, { success: false, error: '提交失败', details: { stderr: 'fatal', code: 2 } })
  assert.equal(errors.length, 1)
})
