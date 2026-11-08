'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const Controller = require('../src/controllers/subsidy-arrival.controller')
const Service = require('../src/services/subsidy-arrival.service')
const Repository = require('../src/repositories/subsidy-arrival.repository')

const routeSource = fs.readFileSync(path.join(__dirname, '../src/routes/subsidy.js'), 'utf8')
const response = () => ({
  status(code) { this.statusCode = code; return this },
  json(body) { this.body = body; return this }
})

test('subsidy arrival route preserves authentication, arrival permission, and controller delegation', () => {
  assert.match(routeSource, /router\.put\('\/:id\/confirm-arrival', unifiedAuth, requirePermission\('subsidy:arrival'\), subsidyArrivalController\.confirmArrival\.bind\(subsidyArrivalController\)\)/)
})

test('subsidy arrival controller preserves missing, success, and error responses', async () => {
  const errors = []
  const controller = new Controller({
    service: { async confirmArrival(id) {
      if (id === 'missing') return false
      if (id === 'failure') throw new Error('database unavailable')
      return true
    } },
    logger: { error(...args) { errors.push(args) } }
  })

  const missing = response()
  await controller.confirmArrival({ params: { id: 'missing' } }, missing)
  assert.equal(missing.statusCode, 400)
  assert.deepEqual(missing.body, { success: false, message: '国补记录不存在' })

  const success = response()
  await controller.confirmArrival({ params: { id: '17' } }, success)
  assert.deepEqual(success.body, { success: true, message: '确认到账成功' })

  const failure = response()
  await controller.confirmArrival({ params: { id: 'failure' } }, failure)
  assert.equal(failure.statusCode, 500)
  assert.deepEqual(failure.body, {
    success: false,
    message: '确认到账失败',
    error: 'database unavailable'
  })
  assert.equal(errors.length, 1)
})

test('subsidy arrival service invalidates cache only after updating an existing row', async () => {
  const calls = []
  let updated = false
  const service = new Service({
    repository: { async confirmArrival(id) { calls.push(['update', id]); return updated } },
    invalidateCache(key) { calls.push(['invalidate', key]) }
  })

  assert.equal(await service.confirmArrival('8'), false)
  assert.deepEqual(calls, [['update', '8']])
  updated = true
  assert.equal(await service.confirmArrival('9'), true)
  assert.deepEqual(calls.slice(1), [['update', '9'], ['invalidate', '/subsidy']])
})

test('subsidy arrival repository binds the original route parameter and uses the arrival timestamp', async () => {
  const calls = []
  const repository = new Repository({
    getDb: () => ({
      async execute(sql, params) {
        calls.push({ sql, params })
        return [{ affectedRows: 1 }]
      }
    })
  })
  assert.equal(await repository.confirmArrival('0042'), true)
  assert.deepEqual(calls[0].params, ['0042'])
  assert.match(calls[0].sql, /UPDATE national_subsidies[\s\S]*SET arrival_time = NOW\(\)[\s\S]*WHERE id = \?/)
})
