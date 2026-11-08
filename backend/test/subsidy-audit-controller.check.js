'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const Controller = require('../src/controllers/subsidy-audit.controller')
const Service = require('../src/services/subsidy-audit.service')
const Repository = require('../src/repositories/subsidy-audit.repository')

const routeSource = fs.readFileSync(path.join(__dirname, '../src/routes/subsidy.js'), 'utf8')

test('subsidy audit route preserves authentication, approval permission and controller delegation', () => {
  assert.match(routeSource, /router\.put\('\/:id\/audit', unifiedAuth, requirePermission\('subsidy:approve'\), subsidyAuditController\.audit\.bind\(subsidyAuditController\)\)/)
})

test('subsidy audit controller preserves missing, success and database error responses', async () => {
  const errors = []
  const controller = new Controller({
    service: { async audit(id) {
      if (id === 'missing') return false
      if (id === 'failure') throw new Error('database unavailable')
      return true
    } },
    logger: { error(...args) { errors.push(args) } }
  })
  const response = () => ({
    status(code) { this.statusCode = code; return this },
    json(body) { this.body = body; return this }
  })

  const missing = response()
  await controller.audit({ params: { id: 'missing' } }, missing)
  assert.equal(missing.statusCode, 404)
  assert.deepEqual(missing.body, { success: false, message: '国补记录不存在' })

  const success = response()
  await controller.audit({ params: { id: '007' } }, success)
  assert.deepEqual(success.body, { success: true, message: '审批成功' })

  const failure = response()
  await controller.audit({ params: { id: 'failure' } }, failure)
  assert.equal(failure.statusCode, 500)
  assert.deepEqual(failure.body, {
    success: false,
    message: '审批失败',
    error: 'database unavailable'
  })
  assert.equal(errors.length, 1)
})

test('subsidy audit service invalidates cache only after an affected row', async () => {
  const calls = []
  let updated = false
  const service = new Service({
    repository: { async markAudited(id) { calls.push(['update', id]); return updated } },
    invalidateCache(key) { calls.push(['cache', key]) }
  })

  assert.equal(await service.audit('1'), false)
  assert.deepEqual(calls, [['update', '1']])
  updated = true
  assert.equal(await service.audit('2'), true)
  assert.deepEqual(calls.slice(1), [['update', '2'], ['cache', '/subsidy']])
})

test('subsidy audit repository binds the original ID and sets apply_time from the database clock', async () => {
  const calls = []
  const repository = new Repository({ getDb: () => ({
    async execute(sql, params) {
      calls.push({ sql, params })
      return [{ affectedRows: 1 }]
    }
  }) })

  assert.equal(await repository.markAudited('0007'), true)
  assert.deepEqual(calls[0].params, ['0007'])
  assert.match(calls[0].sql, /UPDATE national_subsidies[\s\S]*SET apply_time = NOW\(\)[\s\S]*WHERE id = \?/)
})
