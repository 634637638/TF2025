'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const RepairCreateController = require('../src/controllers/repair-create.controller')
const RepairCreateService = require('../src/services/repair-create.service')
const RepairCreateRepository = require('../src/repositories/repair-create.repository')

const response = () => ({
  status(code) { this.statusCode = code; return this },
  json(body) { this.body = body; return this }
})

test('repair create route retains authentication, create permission and field permission middleware', () => {
  const route = fs.readFileSync(path.join(__dirname, '../src/routes/repairs.js'), 'utf8')
  assert.match(route, /router\.post\('\/', unifiedAuth, requirePermission\('repairs:create'\), rejectHiddenRepairWriteFields, repairCreateController\.create\.bind\(repairCreateController\)\)/)
})

test('repair create service validates, writes and moves signed media inside one transaction', async () => {
  const events = []
  const connection = {
    async beginTransaction() { events.push('begin') },
    async commit() { events.push('commit') },
    async rollback() { events.push('rollback') },
    release() { events.push('release') }
  }
  const repository = {
    async validateReferences(input) { events.push(['references', input.customerId]); return null },
    async withConnection(operation) { events.push('acquire'); try { return await operation(connection) } finally { connection.release() } },
    async insert(receivedConnection, input) { assert.equal(receivedConnection, connection); events.push(['insert', input]); return 45 },
    async updatePhotos(receivedConnection, id, photos) { assert.equal(receivedConnection, connection); events.push(['photos', id, photos]) },
    async getCreated(receivedConnection, id) { assert.equal(receivedConnection, connection); events.push(['read', id]); return { id, status: 'pending', photos: [] } }
  }
  const service = new RepairCreateService({
    repository,
    parseId: value => /^\d+$/.test(String(value)) && Number(value) > 0 ? Number(value) : null,
    validateMedia(value, userId) { events.push(['validate-media', userId]); return value.map(item => ({ ...item, url: item.url })) },
    async moveMedia(media, repairId, userId) {
      events.push(['move-media', repairId, userId])
      return { archivedMedia: [{ url: `/uploads/repairs/${repairId}/7_photo.jpg` }], movedFiles: [{ sourcePath: '/temp/photo', targetPath: '/repairs/45/photo' }] }
    },
    async rollbackMedia(files) { events.push(['rollback-media', files]) },
    randomBytes: () => Buffer.from([0xab, 0xcd]),
    now: () => new Date('2026-11-07T00:00:00.000Z')
  })

  const created = await service.create({
    customer_id: '3', brand_id: '2', phone_model: '  Model X ', problem_description: '  screen broken ',
    imei: ' 123 ', serial_number: ' SN-1 ', remarks: ' note ', repair_time: '2026-11-01 10:30',
    photos: [{ url: '/signed/photo' }]
  }, { id: 7 })

  assert.deepEqual(created, { id: 45, status: 'pending', photos: [] })
  assert.deepEqual(events.map(event => Array.isArray(event) ? event[0] : event), [
    'validate-media', 'references', 'acquire', 'begin', 'insert', 'move-media', 'photos', 'commit', 'read', 'release'
  ])
  assert.equal(events.find(event => Array.isArray(event) && event[0] === 'insert')[1].orderNo, 'WX-20261107-ABCD')
  assert.equal(events.find(event => Array.isArray(event) && event[0] === 'insert')[1].phoneModel, 'Model X')
  assert.equal(events.find(event => Array.isArray(event) && event[0] === 'insert')[1].imei, '123')
})

test('repair create service preserves validation and reference errors before opening a transaction', async () => {
  const events = []
  const service = new RepairCreateService({
    repository: {
      async validateReferences() { events.push('references'); return '客户不存在或已停用' },
      async withConnection() { events.push('connection'); assert.fail('invalid references must not start a transaction') }
    },
    parseId: value => Number(value) || null,
    validateMedia: () => [],
    moveMedia: async () => ({ archivedMedia: [], movedFiles: [] }),
    rollbackMedia: async () => {}
  })

  await assert.rejects(service.create({ customer_id: 0, phone_model: 'M', problem_description: 'P' }, { id: 1 }), error => error.message === '请填写客户、手机型号和故障描述')
  await assert.rejects(service.create({ customer_id: 1, phone_model: 'M', problem_description: 'P', technician_id: 'bad' }, { id: 1 }), error => error.message === '维修员编号无效')
  await assert.rejects(service.create({ customer_id: 1, phone_model: 'M', problem_description: 'P', repair_time: 'yesterday' }, { id: 1 }), error => error.message === '维修时间格式不正确')
  await assert.rejects(service.create({ customer_id: 1, phone_model: 'M', problem_description: 'P' }, { id: 1 }), error => error.message === '客户不存在或已停用')
  assert.deepEqual(events, ['references'])
})

test('repair create service rolls back database and moved media after transaction failure', async () => {
  const events = []
  const failure = new Error('photo update failed')
  const connection = {
    async beginTransaction() { events.push('begin') },
    async commit() { events.push('commit') },
    async rollback() { events.push('rollback') },
    release() { events.push('release') }
  }
  const moved = [{ sourcePath: '/temp/photo', targetPath: '/repairs/2/photo' }]
  const service = new RepairCreateService({
    repository: {
      async validateReferences() { return null },
      async withConnection(operation) { try { return await operation(connection) } finally { connection.release() } },
      async insert() { return 2 },
      async updatePhotos() { throw failure }
    },
    parseId: value => Number(value) || null,
    validateMedia: () => [],
    async moveMedia() { return { archivedMedia: [{ url: '/archive/photo' }], movedFiles: moved } },
    async rollbackMedia(files) { events.push(['media-rollback', files]) }
  })

  await assert.rejects(service.create({ customer_id: 1, phone_model: 'M', problem_description: 'P' }, { id: 1 }), error => error === failure)
  assert.deepEqual(events, ['begin', 'rollback', ['media-rollback', moved], 'release'])
})

test('repair create repository binds reference checks and insert values while keeping SQL out of controller', async () => {
  const calls = []
  const database = {
    async execute(sql, params) {
      calls.push({ sql, params })
      return [[{ id: 1 }]]
    }
  }
  const repository = new RepairCreateRepository({ getDb: async () => database, listQuery: 'SELECT r.id FROM repairs r' })
  assert.equal(await repository.validateReferences({ customerId: 1, brandId: 2, colorId: 3, memoryId: 4, phoneId: 5, technicianId: 6 }), null)
  assert.deepEqual(calls.map(call => call.params), [[1], [2], [3], [4], [5], [6]])
  assert.match(calls[2].sql, /FROM colors WHERE id = \?/)

  const insertCalls = []
  const insertId = await repository.insert({
    async execute(sql, params) {
      insertCalls.push({ sql, params })
      return [{ insertId: 77 }]
    }
  }, {
    orderNo: 'WX-20261107-ABCD', customerId: 1, phoneId: null, brandId: 2, phoneModel: 'Model X',
    imei: null, serialNumber: null, colorId: null, memoryId: null, problem: '故障描述', technicianId: null,
    remarks: null, repairTime: null
  })
  assert.equal(insertId, 77)
  assert.deepEqual(insertCalls[0].params, [
    'WX-20261107-ABCD', 1, null, 2, 'Model X', null, null, null, null, '故障描述', null, null, '[]', null
  ])
  assert.match(insertCalls[0].sql, /COALESCE\(\?, NOW\(\)\), 'pending'/)

  const controllerSource = fs.readFileSync(path.join(__dirname, '../src/controllers/repair-create.controller.js'), 'utf8')
  assert.doesNotMatch(controllerSource, /\.execute\(|beginTransaction\(|\.query\(/)
})

test('repair create controller preserves created response, masking and validation mapping', async () => {
  const controller = new RepairCreateController({
    service: { async create(body, actor) { assert.equal(body.customer_id, 1); assert.equal(actor.id, 7); return { id: 2 } } },
    normalizeRepairRow(row, userId) { return { ...row, normalized_for: userId } },
    async maskRepairItem(row, req) { assert.equal(req.user.id, 7); return { ...row, masked: true } },
    response: {
      created(res, data, message) { res.statusCode = 201; res.body = { data, message }; return res },
      badRequest(res, message) { res.statusCode = 400; res.body = { message }; return res },
      serverError(res, message) { res.statusCode = 500; res.body = { message }; return res }
    },
    logger: { error() {} }
  })
  const req = { body: { customer_id: 1 }, user: { id: 7 } }
  const success = response()
  await controller.create(req, success)
  assert.equal(success.statusCode, 201)
  assert.deepEqual(success.body, { data: { id: 2, normalized_for: 7, masked: true }, message: '维修单创建成功' })

  controller.service.create = async () => { throw Object.assign(new Error('invalid fields'), { statusCode: 400 }) }
  const invalid = response()
  await controller.create(req, invalid)
  assert.equal(invalid.statusCode, 400)
})
