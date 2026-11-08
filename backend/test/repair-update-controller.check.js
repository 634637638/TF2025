'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const RepairUpdateController = require('../src/controllers/repair-update.controller')
const RepairUpdateService = require('../src/services/repair-update.service')
const RepairUpdateRepository = require('../src/repositories/repair-update.repository')

const response = () => ({
  status(code) { this.statusCode = code; return this },
  json(body) { this.body = body; return this }
})

const parseId = value => /^\d+$/.test(String(value)) && Number(value) > 0 ? Number(value) : null
const parseMoney = value => Number.isFinite(Number(value)) && Number(value) >= 0 ? Number(Number(value).toFixed(2)) : null

const createService = overrides => new RepairUpdateService({
  repository: {
    async hasReference() { return true },
    async withConnection(operation) {
      const connection = {
        async beginTransaction() {},
        async commit() {},
        async rollback() {},
        async execute() { return [{ affectedRows: 1 }] }
      }
      try { return await operation(connection) } finally { connection.release?.() }
    },
    async getMediaForUpdate() { return { photos: '[]' } },
    async update() { return [{ affectedRows: 1 }] },
    async getUpdated() { return { id: 12, photos: [] } },
    ...overrides?.repository
  },
  parseId,
  parseMoney,
  validateMedia: overrides?.validateMedia || (items => items),
  moveMedia: overrides?.moveMedia || (async items => ({ archivedMedia: items, movedFiles: [] })),
  rollbackMedia: overrides?.rollbackMedia || (async () => {}),
  removeMedia: overrides?.removeMedia || (async () => {}),
  parseStoredMedia: overrides?.parseStoredMedia || (value => JSON.parse(value)),
  normalizeMedia: overrides?.normalizeMedia || (value => value),
  logger: { warn() {} }
})

test('repair update route preserves auth, edit permission and field permission middleware', () => {
  const route = fs.readFileSync(path.join(__dirname, '../src/routes/repairs.js'), 'utf8')
  assert.match(route, /router\.put\('\/:id', unifiedAuth, requirePermission\('repairs:edit'\), rejectHiddenRepairWriteFields, repairUpdateController\.update\.bind\(repairUpdateController\)\)/)
})

test('repair update validates and normalizes fields before opening its transaction', async () => {
  const calls = []
  const service = createService({
    repository: {
      async hasReference(table, id, activeOnly) { calls.push(['reference', table, id, activeOnly]); return table !== 'brands' }
    }
  })
  await assert.rejects(service.update(12, { brand_id: 4 }, { id: 7 }), error => error.code === 'BAD_REQUEST' && error.message === '品牌不存在')
  await assert.rejects(service.update(12, { customer_id: null }, { id: 7 }), error => error.code === 'BAD_REQUEST' && error.message === '客户编号无效')

  const update = await service.buildUpdate({ phone_model: ' Model X ', actual_cost: '12.345', repair_time: '2026-11-01 10:30' })
  assert.deepEqual(update.fields, ['phone_model = ?', 'actual_cost = ?', 'repair_time = ?'])
  assert.deepEqual(update.values, ['Model X', 12.35, '2026-11-01 10:30'])
  assert.deepEqual(calls, [['reference', 'brands', 4, false]])
})

test('repair update transaction locks photos, persists submitted media and returns the updated row', async () => {
  const events = []
  const repository = {
    async hasReference() { return true },
    async withConnection(operation) {
      const connection = {
        async beginTransaction() { events.push('begin') },
        async commit() { events.push('commit') },
        async rollback() { events.push('rollback') }
      }
      try { return await operation(connection) } finally { events.push('release') }
    },
    async getMediaForUpdate(_connection, id) { events.push(['lock-media', id]); return { photos: '[]' } },
    async update(_connection, fields, values, id) { events.push(['update', fields, values, id]); return [{ affectedRows: 1 }] },
    async getUpdated(_connection, id) { events.push(['read-updated', id]); return { id, photos: [] } }
  }
  const service = createService({
    repository,
    validateMedia(items, userId) { events.push(['validate-media', userId]); return items },
    async moveMedia(items, id, userId) { events.push(['move-media', id, userId]); return { archivedMedia: [{ url: '/saved/new.jpg' }], movedFiles: [] } }
  })

  const updated = await service.update('12', { remarks: ' fixed ', photos: [{ url: '/temporary/new.jpg' }] }, { id: 7 })
  assert.deepEqual(updated, { id: 12, photos: [] })
  assert.deepEqual(events.map(event => Array.isArray(event) ? event[0] : event), [
    'begin', 'lock-media', 'validate-media', 'move-media', 'update', 'commit', 'read-updated', 'release'
  ])
  const update = events.find(event => Array.isArray(event) && event[0] === 'update')
  assert.deepEqual(update[1], ['remarks = ?', 'photos = ?'])
  assert.deepEqual(update[2], ['fixed', JSON.stringify([{ url: '/saved/new.jpg' }])])
})

test('repair update rolls back the database and moved media after a failed write', async () => {
  const events = []
  const failure = new Error('write failed')
  const movedFiles = [{ sourcePath: '/temp/a', targetPath: '/repairs/12/a' }]
  const service = createService({
    repository: {
      async withConnection(operation) {
        const connection = {
          async beginTransaction() { events.push('begin') },
          async commit() {},
          async rollback() { events.push('rollback') }
        }
        try { return await operation(connection) } finally { events.push('release') }
      },
      async getMediaForUpdate() { return { photos: '[]' } },
      async update() { throw failure }
    },
    async moveMedia() { return { archivedMedia: [], movedFiles } },
    async rollbackMedia(files) { events.push(['rollback-media', files]) }
  })

  await assert.rejects(service.update(12, { photos: [] }, { id: 7 }), error => error === failure)
  assert.deepEqual(events, ['begin', 'rollback', ['rollback-media', movedFiles], 'release'])
})

test('repair update controller maps validation and missing-record failures to established responses', async () => {
  const controller = new RepairUpdateController({
    service: { async update() { throw Object.assign(new Error('维修单编号无效'), { statusCode: 400, code: 'BAD_REQUEST' }) } },
    normalizeRepairRow: row => row,
    maskRepairItem: async row => row
  })
  const res = response()
  await controller.update({ params: { id: 'bad' }, body: {}, user: { id: 7 } }, res)
  assert.equal(res.statusCode, 400)
  assert.equal(res.body.message, '维修单编号无效')
})

test('repair update repository limits dynamic reference tables and binds values', async () => {
  const calls = []
  const repository = new RepairUpdateRepository({
    getDb: async () => ({ async execute(sql, params) { calls.push({ sql, params }); return [[{ id: 4 }]] } }),
    listQuery: 'SELECT r.id FROM repairs r'
  })
  assert.equal(await repository.hasReference('customers', 4, true), true)
  assert.deepEqual(calls, [{ sql: 'SELECT id FROM customers WHERE id = ? AND status = 1', params: [4] }])
  await assert.rejects(repository.hasReference('roles', 4), /Unsupported repair reference table/)
})
