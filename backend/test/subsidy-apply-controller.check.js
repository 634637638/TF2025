'use strict'

const scopedActor = { id: 8, store_id: 1, store_ids: [1, 2, 3, 4, 5, 6, 7, 8, 9] }

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

const input = { store_id: 1,
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
  imei1: '123456789012345',
  imei2: '234567890123456',
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
    async findSaleForUpdate() { return { id: input.sale_id, customer_id: input.customer_id, store_id: 1 } },
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
  const result = await service.create(input, 19, scopedActor)
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

test('subsidy apply requires a serial number but accepts devices without IMEI identifiers', async () => {
  const missing = createHarness()
  const resultWithoutImeis = await missing.service.create({ ...input, imei1: null, imei2: '' }, 19, scopedActor)
  assert.equal(resultWithoutImeis.status, 200)
  const createdWithoutImeis = missing.events.find(event => Array.isArray(event) && event[0] === 'create')[1]
  assert.equal(createdWithoutImeis.imei1, null)
  assert.equal(createdWithoutImeis.imei2, '')

  const legacyNoImei = createHarness()
  const legacyNoImeiResult = await legacyNoImei.service.create({ ...input, imei1: input.serial_number, imei2: '' }, 19, scopedActor)
  assert.equal(legacyNoImeiResult.status, 200)
  const createdLegacyNoImei = legacyNoImei.events.find(event => Array.isArray(event) && event[0] === 'create')[1]
  assert.equal(createdLegacyNoImei.imei1, null)
  assert.equal(createdLegacyNoImei.imei2, '')

  const missingSerial = createHarness()
  assert.equal((await missingSerial.service.create({ ...input, serial_number: '' }, 19, scopedActor)).status, 400)
  assert.deepEqual(missingSerial.events, [])
  assert.deepEqual(missingSerial.invalidations, [])

  const incomplete = createHarness()
  assert.equal((await incomplete.service.create({ ...input, phone_id: null }, 19, scopedActor)).status, 400)
  assert.deepEqual(incomplete.events, [])
  assert.deepEqual(incomplete.invalidations, [])

  assert.deepEqual(missing.events.map(event => Array.isArray(event) ? event[0] : event), ['begin', 'find', 'idcard', 'create', 'commit', 'release'])
  assert.deepEqual(missing.invalidations, ['/subsidy'])

  const duplicate = createHarness({ existing: { id: 44, apply_status: 'pending' } })
  const duplicateResult = await duplicate.service.create(input, 19, scopedActor)
  assert.equal(duplicateResult.status, 400)
  assert.deepEqual(duplicateResult.body.data, { existing_id: 44, apply_status: 'pending' })
  assert.deepEqual(duplicate.events.map(event => Array.isArray(event) ? event[0] : event), ['begin', 'find', 'rollback', 'release'])
  assert.deepEqual(duplicate.invalidations, [])
})

test('国补申请非法姓名、电话和金额在取连接前拒绝，不写客户或照片引用、不失效缓存', async () => {
  for (const patch of [
    { customer_name: '123' }, { customer_name: '张\n三' }, { customer_name: '张'.repeat(51) },
    { customer_phone: '138中00000000' }, { customer_phone: ['13800000000'] },
    { sale_price: '1e3' }, { sale_price: true }, { sale_price: '10.001' },
    { subsidy_amount: '3元' }, { handler_info: { handler_name: '代\t办' } },
    { imei1: '123456789012345中' }, { imei2: 123456789012345 }, { imei1: '1e14' },
    { serial_number: 'ABC中1234' }, { serial_number: 'S'.repeat(51) }, { serial_number: ['SERIAL'] }, { serial_number: '   ' },
    { handler_info: { handler_phone: '138000000001' } }, { handler_info: [] }
  ]) {
    const harness = createHarness()
    const result = await harness.service.create({ ...input, ...patch }, 19, scopedActor)
    assert.equal(result.status, 400, JSON.stringify(patch))
    assert.deepEqual(harness.events, [])
    assert.deepEqual(harness.invalidations, [])
  }
})

test('国补申请保留合法姓名标点，按约定整理国家码手机号，不改原请求', async () => {
  const harness = createHarness()
  const request = { ...input, customer_name: "Anne O'Neil·张", customer_phone: '+86 138-0000-0000' }
  assert.equal((await harness.service.create(request, 19, scopedActor)).status, 200)
  const created = harness.events.find(event => Array.isArray(event) && event[0] === 'create')[1]
  assert.equal(created.customer_phone, '13800000000')
  assert.equal(created.customer_name, request.customer_name)
  assert.equal(request.customer_phone, '+86 138-0000-0000')
})

test('subsidy apply rolls back failed photo validation and controller preserves status mapping', async () => {
  const failed = createHarness({ failPhotoValidation: true })
  await assert.rejects(failed.service.create({
    ...input,
    subsidy_photos: ['/uploads/subsidy/photo.jpg?expires=1&signature=invalid&user=19']
  }, 19, scopedActor), /国补照片链接无效/)
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

  await repository.withConnection(async connection => {
    await repository.create(connection, {
      ...input,
      serial_number: null,
      imei1: null,
      imei2: '',
      customer_idcard: null,
      sale_time: null,
      subsidy_photos: [],
      handler_name: null,
      handler_phone: null,
      handler_idcard: null
    })
  })
  assert.equal(calls[5][1][10], null)
  assert.equal(calls[5][1][11], null)
  assert.equal(calls[5][1][12], null)
  assert.deepEqual(calls[6], ['release'])
})
