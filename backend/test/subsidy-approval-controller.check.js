'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const Controller = require('../src/controllers/subsidy-approval.controller')
const Service = require('../src/services/subsidy-approval.service')
const Repository = require('../src/repositories/subsidy-approval.repository')

const routeSource = fs.readFileSync(path.join(__dirname, '../src/routes/subsidy.js'), 'utf8')
const makeResponse = () => ({
  status(code) { this.statusCode = code; return this },
  json(body) { this.body = body; return this }
})

test('subsidy approval route keeps authentication, permission and controller delegation', () => {
  assert.match(routeSource, /router\.put\('\/:id\/approve', unifiedAuth, requirePermission\('subsidy:approve'\), subsidyApprovalController\.approve\.bind\(subsidyApprovalController\)\)/)
})

test('subsidy approval controller validates boolean input and preserves response contracts', async () => {
  const errors = []
  const approvals = []
  const controller = new Controller({
    service: {
      async approve(id, _approved) {
        approvals.push([id, _approved])
        if (id === 'missing') return false
        if (id === 'failure') throw new Error('database unavailable')
        return true
      }
    },
    logger: { error(...args) { errors.push(args) } }
  })

  const invalid = makeResponse()
  await controller.approve({ params: { id: '1' }, body: { approved: 'true' } }, invalid)
  assert.equal(invalid.statusCode, 400)
  assert.deepEqual(invalid.body, { success: false, message: '请提供审批结果' })

  const accepted = makeResponse()
  await controller.approve({ params: { id: '1' }, body: { approved: true } }, accepted)
  assert.deepEqual(accepted.body, { success: true, message: '审批通过' })

  const rejected = makeResponse()
  await controller.approve({ params: { id: '2' }, body: { approved: false } }, rejected)
  assert.deepEqual(rejected.body, { success: true, message: '审批拒绝' })
  assert.deepEqual(approvals.slice(0, 2), [['1', true], ['2', false]])

  const missing = makeResponse()
  await controller.approve({ params: { id: 'missing' }, body: { approved: true } }, missing)
  assert.equal(missing.statusCode, 404)
  assert.deepEqual(missing.body, { success: false, message: '国补记录不存在' })

  const failure = makeResponse()
  await controller.approve({ params: { id: 'failure' }, body: { approved: true } }, failure)
  assert.equal(failure.statusCode, 500)
  assert.deepEqual(failure.body, { success: false, message: '审批失败', error: 'database unavailable' })
  assert.equal(errors.length, 1)
})

test('subsidy approval service maps status and clears cache only after updating a record', async () => {
  const calls = []
  let updated = false
  const service = new Service({
    repository: { async setApprovalStatus(...args) { calls.push(['update', ...args]); return updated } },
    invalidateCache(key) { calls.push(['cache', key]) }
  })

  assert.equal(await service.approve('0007', true), false)
  assert.deepEqual(calls, [['update', '0007', 'approved']])
  updated = true
  assert.equal(await service.approve('8', false), true)
  assert.deepEqual(calls.slice(1), [['update', '8', 'rejected'], ['cache', '/subsidy']])
})

test('subsidy approval repository binds status and original record ID', async () => {
  const calls = []
  const repository = new Repository({ getDb: () => ({
    async execute(sql, params) {
      calls.push({ sql, params })
      return [{ affectedRows: 1 }]
    }
  }) })

  assert.equal(await repository.setApprovalStatus('0007', 'approved'), true)
  assert.deepEqual(calls[0].params, ['approved', '0007'])
  assert.match(calls[0].sql, /UPDATE national_subsidies SET apply_status = \? WHERE id = \?/)
})
