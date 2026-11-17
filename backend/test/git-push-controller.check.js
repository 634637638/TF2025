'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const Controller = require('../src/controllers/git.controller')
const GitPushService = require('../src/services/git-push.service')

const routeSource = fs.readFileSync(path.join(__dirname, '../src/routes/git.js'), 'utf8')
const response = () => ({
  locals: {},
  status(code) { this.statusCode = code; return this },
  json(body) { this.body = body; return this }
})

const setup = ({
  headState = { branch: 'main', detached: false, shortCommit: 'abc1234' },
  upstreamRef = 'origin/main',
  blockedFiles = [],
  warningFiles = [],
  verified = true,
  pushOutput = { stdout: 'pushed', stderr: '' },
  pushError
} = {}) => {
  const commands = []
  const errors = []
  const service = new GitPushService({
    getHeadState: async () => headState,
    executeCommand: async command => {
      commands.push(command)
      if (command === 'git push' || command === 'git push --set-upstream origin main') {
        if (pushError) throw pushError
        return pushOutput
      }
      return { stdout: '' }
    },
    getUpstreamRef: async () => upstreamRef,
    getPendingPushFileSizeCheck: async () => ({ blockedFiles, warningFiles }),
    buildPushSizeHint: () => 'oversized file hint',
    verifyPushOutcome: async () => ({ verified, hasUpstream: Boolean(upstreamRef), ahead: verified ? 0 : 2 }),
    logger: { error(...values) { errors.push(values) } }
  })
  return { service, commands, errors }
}

test('git push route keeps edit permission and delegates to controller', () => {
  assert.match(routeSource, /router\.post\('\/push', requireGitEdit, gitPushController\.pushChanges\.bind\(gitPushController\)\)/)
})

test('Git controller marks only structured push outcomes for safe response handling', async () => {
  const controller = new Controller({
    service: {},
    pushService: { async pushChanges() { return {
      statusCode: 502,
      body: { success: false, code: 'GIT_PUSH_FAILED', error: 'Git 远端推送失败' }
    } } }
  })
  const res = response()
  await controller.pushChanges({}, res)
  assert.equal(res.statusCode, 502)
  assert.equal(res.locals.safeErrorResponse, true)
})

test('git push service rejects detached and non-main branches with conflict responses', async () => {
  const detached = await setup({ headState: { detached: true, shortCommit: 'deadbee' } }).service.pushChanges()
  assert.equal(detached.statusCode, 409)
  assert.equal(detached.body.code, 'DETACHED_HEAD')
  assert.match(detached.body.hint, /deadbee/)

  const branch = await setup({ headState: { branch: 'feature/ui', detached: false } }).service.pushChanges()
  assert.equal(branch.statusCode, 409)
  assert.equal(branch.body.code, 'NOT_MAIN_BRANCH')
})

test('git push blocks oversized pending files before running push and preserves sync details', async () => {
  const { service, commands } = setup({ blockedFiles: [{ path: 'large.bin' }], warningFiles: [{ path: 'medium.bin' }] })
  const result = await service.pushChanges()
  assert.equal(result.statusCode, 409)
  assert.equal(result.body.hint, 'oversized file hint')
  assert.deepEqual(result.body.details.largeFiles, [{ path: 'large.bin' }])
  assert.deepEqual(result.body.details.warningFiles, [{ path: 'medium.bin' }])
  assert.deepEqual(result.body.details.syncStatus, { verified: true, hasUpstream: true, ahead: 0 })
  assert.ok(!commands.includes('git push'))
})

test('git push chooses the correct upstream command and reports verified outcomes', async () => {
  const existingUpstream = setup()
  const result = await existingUpstream.service.pushChanges()
  assert.equal(result.statusCode, 200)
  assert.deepEqual(result.body.data, {
    message: '推送成功', output: 'pushed', warning: '',
    syncStatus: { verified: true, hasUpstream: true, ahead: 0 }
  })
  assert.ok(existingUpstream.commands.includes('git push'))

  const noUpstream = setup({ upstreamRef: '' })
  await noUpstream.service.pushChanges()
  assert.ok(noUpstream.commands.includes('git push --set-upstream origin main'))

  const current = await setup({ pushOutput: { stdout: 'Everything up-to-date', stderr: '' } }).service.pushChanges()
  assert.equal(current.body.data.message, '已是最新，无需推送')
})

test('git push tolerates a command error only when sync verification succeeds', async () => {
  const { service, errors } = setup({
    pushError: Object.assign(new Error('transport output missing'), { error: 'transport error', stderr: 'warning' })
  })
  const result = await service.pushChanges()
  assert.equal(result.statusCode, 200)
  assert.equal(result.body.data.message, '远端已同步，推送输出异常已忽略')
  assert.equal(result.body.data.warning, '推送命令返回异常，但远端同步已确认')
  assert.equal(errors.length, 1)
})

test('git push verification failure distinguishes remote rejection from unknown sync results', async () => {
  const rejected = await setup({
    verified: false,
    pushError: Object.assign(new Error('non-fast-forward'), { error: 'rejected: non-fast-forward', stderr: 'remote rejected', code: 1 })
  }).service.pushChanges()
  assert.equal(rejected.statusCode, 409)
  assert.equal(rejected.body.code, 'GIT_REMOTE_REJECTED')
  assert.equal(rejected.body.error, '远端分支有新提交，推送被拒绝')
  assert.doesNotMatch(JSON.stringify(rejected.body), /remote rejected|non-fast-forward/)

  const unavailable = await setup({ verified: false }).service.pushChanges()
  assert.equal(unavailable.statusCode, 503)
  assert.equal(unavailable.body.code, 'GIT_SYNC_UNVERIFIED')
  assert.match(unavailable.body.hint, /先刷新 Git 状态/)
})

test('git push verification exceptions advise checking remote status before retrying', async () => {
  const service = new GitPushService({
    getHeadState: async () => ({ branch: 'main', detached: false, shortCommit: 'abc1234' }),
    executeCommand: async () => ({ stdout: 'pushed', stderr: '' }),
    getUpstreamRef: async () => 'origin/main',
    getPendingPushFileSizeCheck: async () => ({ blockedFiles: [], warningFiles: [] }),
    buildPushSizeHint: () => '',
    verifyPushOutcome: async () => { throw new Error('remote query failed') },
    logger: { error() {} }
  })
  const result = await service.pushChanges()
  assert.equal(result.statusCode, 503)
  assert.equal(result.body.code, 'GIT_SYNC_CHECK_UNAVAILABLE')
  assert.match(result.body.hint, /再决定是否重试/)
})

test('git push maps unverified sync and outer network failures to established errors', async () => {
  const unverified = await setup({
    verified: false,
    pushError: Object.assign(new Error('rejected'), { error: 'Permission denied', stderr: 'denied', code: 1 })
  }).service.pushChanges()
  assert.equal(unverified.statusCode, 502)
  assert.equal(unverified.body.code, 'GIT_REMOTE_AUTH_FAILED')
  assert.equal(unverified.body.error, 'Git 远端认证失败')
  assert.match(unverified.body.hint, /远端凭据/)
  assert.deepEqual(unverified.body.details.syncStatus, { verified: false, hasUpstream: true, ahead: 2 })

  const controller = new Controller({
    service: {},
    pushService: { async pushChanges() { throw Object.assign(new Error('connection failed'), { error: 'Could not connect', stderr: 'network', code: 7 }) } },
    logger: { error() {} }
  })
  const failed = response()
  await controller.pushChanges({}, failed)
  assert.equal(failed.statusCode, 500)
  assert.equal(failed.body.error, '无法连接到 GitHub')
  assert.match(failed.body.hint, /网络连接失败/)
  assert.deepEqual(failed.body.details, { stderr: 'network', code: 7 })
})
