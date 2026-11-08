'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const Controller = require('../src/controllers/rental-device.controller')
const Service = require('../src/services/rental-device.service')
const Repository = require('../src/repositories/rental-device.repository')

const routeSource = fs.readFileSync(path.join(__dirname, '../src/routes/rentals.js'), 'utf8')
const response = () => ({
  status(code) { this.statusCode = code; return this },
  json(body) { this.body = body; return this }
})

test('rental device route retains permission and delegates to its controller', () => {
  assert.match(routeSource, /router\.get\('\/devices', requireAnyPermission\(\['rentals:view', 'rentals:create'\]\), rentalDeviceController\.listAvailable\.bind\(rentalDeviceController\)\)/)
})

test('rental device service retains schema setup, hidden-field search and pagination behavior', async () => {
  const calls = []
  const service = new Service({
    ensureSchema: async () => calls.push('schema'),
    masking: {
      async getUserFieldPermissions(userId, moduleKey) {
        calls.push(['permissions', userId, moduleKey])
        return { hiddenFields: ['device_info.imei', 'device_info.brand'] }
      },
      filterSensitiveFields(rows, permissions) {
        calls.push(['mask', rows.length, permissions.hiddenFields])
        return rows.map(row => ({ ...row, imei: permissions.hiddenFields.includes('device_info.imei') ? null : row.imei }))
      }
    },
    repository: {
      async listAvailable(input) {
        calls.push(input)
        return [{ id: 1, imei: '123', brand: 'A' }, { id: 2, imei: '456', brand: 'B' }]
      }
    }
  })

  const result = await service.listAvailable({ keyword: '  phone ', page: '2', page_size: '2' }, 9)
  assert.deepEqual(calls[0], 'schema')
  assert.deepEqual(calls[1], ['permissions', 9, 'rentals_rentalsview'])
  assert.deepEqual(calls[2], {
    keyword: 'phone',
    searchableFieldIds: ['device_info.serial_number', 'device_info.model', 'device_info.color', 'device_info.memory'],
    page: 2,
    pageSize: 2,
    hasPagination: true
  })
  assert.deepEqual(result.rows.map(row => row.imei), [null, null])
  assert.deepEqual(result.pagination, { page: 2, page_size: 2, count: 2, has_more: true })
})

test('rental device service rejects search when every searchable field is hidden', async () => {
  let repositoryCalls = 0
  const service = new Service({
    ensureSchema: async () => {},
    masking: {
      async getUserFieldPermissions() {
        return { hiddenFields: [
          'device_info.imei', 'device_info.serial_number', 'device_info.brand',
          'device_info.model', 'device_info.color', 'device_info.memory'
        ] }
      },
      filterSensitiveFields(rows) { return rows }
    },
    repository: { async listAvailable() { repositoryCalls += 1; return [] } }
  })
  assert.deepEqual(await service.listAvailable({ keyword: 'abc' }, 1), { forbidden: true })
  assert.equal(repositoryCalls, 0)
})

test('rental device controller preserves forbidden, success and server-error responses', async () => {
  const errors = []
  const controller = new Controller({
    service: {
      async listAvailable(query, userId) {
        if (query.fail) throw new Error('failure')
        if (query.forbidden) return { forbidden: true }
        return { rows: [{ id: userId }], pagination: query.page ? { page: 1 } : null }
      }
    },
    logger: { error(...args) { errors.push(args) } }
  })
  const denied = response()
  await controller.listAvailable({ query: { forbidden: true }, user: { id: 4 } }, denied)
  assert.equal(denied.statusCode, 403)
  assert.equal(denied.body.code, 'FIELD_PERMISSION_DENIED')

  const listed = response()
  await controller.listAvailable({ query: { page: '1' }, user: { id: 4 } }, listed)
  assert.deepEqual(listed.body.data, [{ id: 4 }])
  assert.deepEqual(listed.body.pagination, { page: 1 })

  const failed = response()
  await controller.listAvailable({ query: { fail: true }, user: { id: 4 } }, failed)
  assert.equal(failed.statusCode, 500)
  assert.equal(errors.length, 1)
})

test('rental device repository binds search text and restricts sortable SQL identifiers', async () => {
  const calls = []
  const repository = new Repository({
    getDb: () => ({
      async execute(sql, params) {
        calls.push({ sql, params })
        return [[{ id: 1 }]]
      }
    })
  })
  await repository.listAvailable({
    keyword: '%_x',
    searchableFieldIds: ['device_info.imei', 'invalid.field', 'device_info.model'],
    page: 3,
    pageSize: 20,
    hasPagination: true
  })
  assert.deepEqual(calls[0].params, ['%%_x%', '%%_x%'])
  assert.match(calls[0].sql, /p\.imei LIKE \? OR m\.name LIKE \?\)/)
  assert.match(calls[0].sql, /LIMIT 20 OFFSET 40/)
  assert.equal(calls[0].sql.includes('invalid.field'), false)
})
