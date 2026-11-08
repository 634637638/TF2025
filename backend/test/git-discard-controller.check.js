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

test('discard route keeps global authentication, edit permission and delegates to controller', () => {
  assert.match(routeSource, /router\.use\(unifiedAuth\)/)
  assert.match(routeSource, /const requireGitEdit = requirePermission\('git-management:edit'\)/)
  assert.match(routeSource, /router\.post\('\/discard', requireGitEdit, gitController\.discardChanges\.bind\(gitController\)\)/)
})

test('git service runs discard commands in the established order', async () => {
  const commands = []
  const service = new GitService({ executeCommand: async command => commands.push(command) })
  await service.discardChanges()
  assert.deepEqual(commands, ['git reset --hard HEAD', 'git clean -fd'])
})

test('git discard controller preserves success and failure response contracts', async () => {
  const success = makeResponse()
  await new GitController({ service: { async discardChanges() {} } }).discardChanges({}, success)
  assert.deepEqual(success.body, {
    success: true,
    data: { message: '已丢弃所有未提交的更改' }
  })

  const errors = []
  const failure = makeResponse()
  await new GitController({
    service: { async discardChanges() { throw Object.assign(new Error('git failure'), { error: '执行失败' }) } },
    logger: { error(...args) { errors.push(args) } }
  }).discardChanges({}, failure)
  assert.equal(failure.statusCode, 500)
  assert.deepEqual(failure.body, { success: false, error: '执行失败' })
  assert.equal(errors.length, 1)
})
