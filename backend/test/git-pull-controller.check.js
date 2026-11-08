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

test('git pull route keeps edit permission and delegates to controller', () => {
  assert.match(routeSource, /router\.post\('\/pull', requireGitEdit, gitController\.pull\.bind\(gitController\)\)/)
})

test('git service pulls only from main and preserves detached and non-main conflicts', async () => {
  const commands = []
  const service = new GitService({
    executeCommand: async command => {
      commands.push(command)
      if (command === 'git branch --show-current') return { stdout: 'main\n' }
      if (command === 'git rev-parse --short HEAD') return { stdout: 'abc1234\n' }
      return { stdout: 'Already up to date.' }
    }
  })

  assert.deepEqual(await service.pull(), { message: '拉取成功', output: 'Already up to date.' })
  assert.deepEqual(commands, ['git branch --show-current', 'git rev-parse --short HEAD', 'git pull'])

  const detached = new GitService({ executeCommand: async command => ({
    stdout: command.includes('branch --show-current') ? '' : 'abc1234'
  }) })
  await assert.rejects(detached.pull(), error => {
    assert.equal(error.statusCode, 409)
    assert.equal(error.code, 'DETACHED_HEAD')
    assert.equal(error.shortCommit, 'abc1234')
    return true
  })

  const feature = new GitService({ executeCommand: async command => ({
    stdout: command.includes('branch --show-current') ? 'feature/test' : 'abc1234'
  }) })
  await assert.rejects(feature.pull(), error => {
    assert.equal(error.statusCode, 409)
    assert.equal(error.code, 'NOT_MAIN_BRANCH')
    assert.equal(error.branch, 'feature/test')
    return true
  })
})

test('git pull controller preserves success, conflict and server-error responses', async () => {
  const success = makeResponse()
  await new GitController({ service: {
    async pull() { return { message: '拉取成功', output: 'ok' } }
  } }).pull({}, success)
  assert.deepEqual(success.body, { success: true, data: { message: '拉取成功', output: 'ok' } })

  const detached = makeResponse()
  await new GitController({ service: {
    async pull() { throw Object.assign(new Error('detached'), { statusCode: 409, code: 'DETACHED_HEAD', shortCommit: 'abc1234' }) }
  } }).pull({}, detached)
  assert.equal(detached.statusCode, 409)
  assert.deepEqual(detached.body, {
    success: false,
    error: '当前仓库处于分离 HEAD 状态，不能直接提交并推送',
    hint: '请先在 Git 管理页切换到正常分支（例如 main），或基于当前提交 abc1234 新建分支后再提交。',
    code: 'DETACHED_HEAD'
  })

  const conflict = makeResponse()
  const conflictBody = { success: false, error: '当前分支为 feature/test，请先恢复到 main', hint: '当前 Git 管理页已按主线模式运行。请先点击“恢复到 main”，确认最新代码已带回主线后，再执行提交、推送或拉取。', code: 'NOT_MAIN_BRANCH' }
  await new GitController({ service: {
    async pull() { throw Object.assign(new Error('branch conflict'), { statusCode: 409, code: 'NOT_MAIN_BRANCH', branch: 'feature/test' }) }
  } }).pull({}, conflict)
  assert.equal(conflict.statusCode, 409)
  assert.deepEqual(conflict.body, conflictBody)

  const errors = []
  const failure = makeResponse()
  await new GitController({
    service: { async pull() { throw Object.assign(new Error('failure'), { error: '执行失败' }) } },
    logger: { error(...args) { errors.push(args) } }
  }).pull({}, failure)
  assert.equal(failure.statusCode, 500)
  assert.deepEqual(failure.body, { success: false, error: '执行失败' })
  assert.equal(errors.length, 1)
})
