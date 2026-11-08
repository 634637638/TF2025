'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const Controller = require('../src/controllers/subsidy-apply.controller')
const Service = require('../src/services/subsidy-apply.service')
const Repository = require('../src/repositories/subsidy-apply.repository')

const routeSource = fs.readFileSync(path.join(__dirname, '../src/routes/subsidy.js'), 'utf8')
const response = () => ({
  status(code) { this.statusCode = code; return this },
  json(body) { this.body = body; return this }
})

const input = {
  phone_id: 8,
  sale_id: 12,
  customer_id: 5,
  customer_name: '测试客户',
  customer_phone: '13800000000',
  customer_idcard: '  ID-CARD  ',
  phone_brand: '品牌',
  phone_model: '型号',
  phone_color: '黑色',
  phone_memory: '256GB',
  serial_number: 'SERIAL',
  imei1: '111',
  imei2: '222',
  sale_price: 5000,
  sale_time: '2026-11-08T15:30:00.000Z',
  subsidy_photos: [],
  subsidy_amount: 0,
  subsidy_rate: 0,
  has_different_handler: true,
  handler_info: { handler_name: '代办', handler_phone: '13900000000', handler_idcard: 'HANDLER-ID' }
}

const createHarness = ({ existing = null, insertId = 31, failPhotoValidation = false } = {}) => {
  const events = []
  const connection = {
    async beginTransaction() { events.push('begin') },
    async commit() { events.push('commit') },
    async rollback() { events.push('rollback') },
    release() { events.push('release') }
  }
  const repository = {
    async withConnection(operation) {
      try { return await operation(connection) } finally { events.push('release') }
    },
    async findByPhoneForUpdate(_connection, id) { events.push(['find', id]); return existing },
    async updateCustomerIdCard(_connection, id, card) { events.push(['idcard', id, card]) },
    async hasPhotoReference() { if (failPhotoValidation) throw Object.assign(new Error('国补照片链接无效'), { statusCode: 400 }); return false },
    async create(_connection, data) { events.push(['create', data]); return insertId }
  }
  const invalidations = []
  const service = new Service({
    repository,
    invalidateCache: key => invalidations.push(key),
    logger: { warn() {}, error() {} },
    now: () => new Date('2026-11-08T00:00:00.000Z')
  })
  return { service, events, invalidations }
}

test('subsidy apply route preserves authentication, create permission, photo permission, and controller delegation', () => {
  assert.match(routeSource, /router\.post\([\s\S]*'\/apply',[\s\S]*unifiedAuth,[\s\S]*requirePermission\('subsidy:create'\),[\s\S]*requireSubsidyUploadWhenPhotosPresent,[\s\S]*subsidyApplyController\.create\.bind\(subsidyApplyController\)/)
})

test('subsidy apply service commits normalized application data and invalidates cache after commit', async () => {
  const { service, events, invalidations } = createHarness()
  const result = await service.create(input, 19)
  assert.equal(result.status, 200)
  assert.deepEqual(result.body, {
    success: true,
    message: '国补记录创建成功',
    data: { id: 31, apply_time: new Date('2026-11-08T00:00:00.000Z'), apply_status: 'completed' }
  })
  const created = events.find(event => Array.isArray(event) && event[0] === 'create')[1]
  assert.equal(created.sale_time, '2026-11-08 00:00:00')
  assert.equal(created.customer_idcard, '  ID-CARD  ')
  assert.equal(created.subsidy_rate, 15)
  assert.equal(created.subsidy_amount, 0)
  assert.deepEqual([created.handler_name, created.handler_phone, created.handler_idcard], ['代办', '13900000000', 'HANDLER-ID'])
  assert.deepEqual(events.map(event => Array.isArray(event) ? event[0] : event), ['begin', 'find', 'idcard', 'create', 'commit', 'release'])
  assert.deepEqual(invalidations, ['/subsidy'])
})

test('subsidy apply rejects missing fields and duplicate applications without leaving a transaction open', async () => {
  const missing = createHarness()
  assert.equal((await missing.service.create({ ...input, imei2: '' }, 19)).status, 400)
  assert.deepEqual(missing.events, [])
  assert.deepEqual(missing.invalidations, [])

  const duplicate = createHarness({ existing: { id: 44, apply_status: 'pending' } })
  const result = await duplicate.service.create(input, 19)
  assert.equal(result.status, 400)
  assert.deepEqual(result.body.data, { existing_id: 44, apply_status: 'pending' })
  assert.deepEqual(duplicate.events.map(event => Array.isArray(event) ? event[0] : event), ['begin', 'find', 'rollback', 'release'])
  assert.deepEqual(duplicate.invalidations, [])
})

test('subsidy apply rolls back failed photo validation and controller preserves status mapping', async () => {
  const failed = createHarness({ failPhotoValidation: true })
  await assert.rejects(failed.service.create({
    ...input,
    subsidy_photos: ['/uploads/subsidy/photo.jpg?expires=1&signature=invalid&user=19']
  }, 19), /国补照片链接无效/)
  assert.deepEqual(failed.events.map(event => Array.isArray(event) ? event[0] : event), ['begin', 'find', 'idcard', 'rollback', 'release'])
  assert.deepEqual(failed.invalidations, [])

  const controller = new Controller({ service: { async create() { throw Object.assign(new Error('国补照片链接无效'), { statusCode: 400 }) } }, logger: { error() {} } })
  const res = response()
  await controller.create({ body: input, user: { id: 19 } }, res)
  assert.equal(res.statusCode, 400)
  assert.deepEqual(res.body, { success: false, message: '国补照片链接无效' })
})

test('subsidy apply repository binds phone, customer, and full insert values', async () => {
  const calls = []
  const repository = new Repository({ getDb: () => ({
    async getConnection() {
      return {
        async execute(sql, params) {
          calls.push([sql, params])
          if (sql.includes('SELECT id, apply_status')) return [[{ id: 6, apply_status: 'pending' }]]
          if (sql.includes('SELECT id FROM national_subsidies')) return [[]]
          if (sql.includes('INSERT INTO national_subsidies')) return [{ insertId: 6 }]
          return [{ affectedRows: 1 }]
        },
        release() { calls.push(['release']) }
      }
    }
  }) })
  await repository.withConnection(async connection => {
    assert.deepEqual(await repository.findByPhoneForUpdate(connection, 8), { id: 6, apply_status: 'pending' })
    await repository.updateCustomerIdCard(connection, 5, 'CARD')
    assert.equal(await repository.hasPhotoReference(connection, 'subsidy/a.jpg'), false)
    const id = await repository.create(connection, { ...input, customer_idcard: 'CARD', sale_time: null, subsidy_photos: ['subsidy/a.jpg'], handler_name: null, handler_phone: null, handler_idcard: null })
    assert.equal(id, 6)
  })
  assert.match(calls[0][0], /WHERE phone_id = \? FOR UPDATE/)
  assert.deepEqual(calls[0][1], [8])
  assert.deepEqual(calls[1][1], ['CARD', 5])
  assert.deepEqual(calls[2][1], ['%subsidy/a.jpg%'])
  assert.match(calls[3][0], /INSERT INTO national_subsidies/)
  assert.equal(calls[3][1][1], 8)
  assert.equal(calls[3][1][5], 'CARD')
  assert.equal(calls[3][1][22], '["subsidy/a.jpg"]')
  assert.deepEqual(calls[4], ['release'])
})
