'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const Controller = require('../src/controllers/rental-finish.controller')
const Service = require('../src/services/rental-finish.service')
const Repository = require('../src/repositories/rental-finish.repository')

const routeSource = fs.readFileSync(path.join(__dirname, '../src/routes/rentals.js'), 'utf8')
const createResponse = () => ({
  statusCode: 200,
  status(code) { this.statusCode = code; return this },
  json(body) { this.body = body; return this }
})

test('rental finish route retains edit permission and delegates to its controller', () => {
  assert.match(routeSource, /router\.post\('\/:id\/finish', requirePermission\('rentals:edit'\), rentalFinishController\.finish\.bind\(rentalFinishController\)\)/)
})

test('rental finish controller preserves success and business error responses', async () => {
  const controller = new Controller({
    service: { async finish(id) {
      if (id === 7) return id
      throw new Error('该合同已经结束')
    } }
  })
  const success = createResponse()
  await controller.finish({ params: { id: '7' } }, success)
  assert.equal(success.body.success, true)
  assert.equal(success.body.message, '租赁已结束，设备已恢复在库')
  assert.deepEqual(success.body.data, { id: 7 })

  const invalid = createResponse()
  await controller.finish({ params: { id: '8' } }, invalid)
  assert.equal(invalid.statusCode, 400)
  assert.equal(invalid.body.success, false)
  assert.equal(invalid.body.message, '该合同已经结束')
})

test('rental finish service commits return updates and rolls back invalid contracts', async () => {
  const events = []
  let rental = { id: 7, status: 'active', billing_mode: 'daily', phone_id: 9 }
  const connection = {
    async beginTransaction() { events.push('begin') },
    async commit() { events.push('commit') },
    async rollback() { events.push('rollback') },
    release() { events.push('release') }
  }
  const repository = {
    async getForUpdate(_connection, id) { events.push(['lock', id]); return rental },
    async calculateTotalCost(_connection, id) { events.push(['cost', id]); return 48 },
    async finishRental(_connection, id, cost) { events.push(['finish', id, cost]) },
    async restorePhone(_connection, id) { events.push(['restore', id]) }
  }
  const service = new Service({
    repository,
    databaseProvider: () => ({ getConnection: async () => connection }),
    ensureSchema: async () => events.push('schema')
  })

  assert.equal(await service.finish(7), 7)
  assert.deepEqual(events, [
    'schema', 'begin', ['lock', 7], ['cost', 7], ['finish', 7, 48], ['restore', 9], 'commit', 'release'
  ])

  events.length = 0
  rental = { ...rental, status: 'returned' }
  await assert.rejects(service.finish(7), /该合同已经结束/)
  assert.deepEqual(events, ['schema', 'begin', ['lock', 7], 'rollback', 'release'])
})

test('rental finish repository keeps row locking and conditional phone restore', async () => {
  const calls = []
  const repository = new Repository()
  const connection = {
    async execute(sql, params) {
      calls.push({ sql, params })
      if (/SELECT id,status/.test(sql)) return [[{ id: 7 }]]
      if (/SELECT ROUND/.test(sql)) return [[{ cost: '48.00' }]]
      return [{ affectedRows: 1 }]
    }
  }
  assert.deepEqual(await repository.getForUpdate(connection, 7), { id: 7 })
  assert.equal(await repository.calculateTotalCost(connection, 7), 48)
  await repository.finishRental(connection, 7, 48)
  await repository.restorePhone(connection, 9)
  assert.match(calls[0].sql, /WHERE id=\? FOR UPDATE/)
  assert.deepEqual(calls[0].params, [7])
  assert.match(calls[3].sql, /status='in_stock'.*status='rented'/)
  assert.deepEqual(calls[3].params, [9])
})
