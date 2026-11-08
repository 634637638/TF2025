'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const RepairReadController = require('../src/controllers/repair-read.controller')
const RepairReadService = require('../src/services/repair-read.service')
const RepairReadRepository = require('../src/repositories/repair-read.repository')

const response = () => ({
  status(code) { this.statusCode = code; return this },
  json(body) { this.body = body; return this }
})

test('repair list, stats and detail routes keep authentication and permission checks while delegating to controller', () => {
  const route = fs.readFileSync(path.join(__dirname, '../src/routes/repairs.js'), 'utf8')
  assert.match(route, /router\.get\('\/', unifiedAuth, requirePermission\('repairs:view'\), repairReadController\.list\.bind\(repairReadController\)\)/)
  assert.match(route, /router\.get\('\/stats', unifiedAuth, requirePermission\('repairs:view'\), repairReadController\.stats\.bind\(repairReadController\)\)/)
  assert.match(route, /router\.get\('\/:id', unifiedAuth, requirePermission\('repairs:view'\), repairReadController\.detail\.bind\(repairReadController\)\)/)
})

test('repair stats service preserves status and searchable-field permissions and binds filters through repository', async () => {
  const calls = []
  const masked = []
  const service = new RepairReadService({
    repository: {
      async ensureReady() {},
      async getStatistics(where, params) {
        calls.push({ where, params })
        return [{ pending: '2', processing: '3', completed: '4', monthly_revenue: '19.5' }]
      }
    },
    getHiddenFields: async () => new Set(['customer_info.customer_phone', 'device_info.imei']),
    validStatuses: new Set(['pending', 'processing', 'completed', 'cancelled']),
    parseId: value => Number.parseInt(String(value), 10) || null,
    normalizeRepairRow: row => row,
    maskRepairList: rows => rows,
    async maskRepairItem(item, req) { masked.push({ item, req }); return { ...item, masked: true } }
  })
  const req = { query: { status: 'completed', search: '  SN-1  ' } }

  assert.deepEqual(await service.getStats(req), {
    pending: 2, processing: 3, completed: 4, monthly_revenue: 19.5, masked: true
  })
  assert.match(calls[0].where, /r\.status = \?/)
  assert.match(calls[0].where, /r\.order_no LIKE \?/)
  assert.doesNotMatch(calls[0].where, /c\.phone|r\.imei/)
  assert.deepEqual(calls[0].params, ['completed', '%SN-1%', '%SN-1%', '%SN-1%', '%SN-1%'])
  assert.equal(masked[0].req, req)

  const deniedStatus = new RepairReadService({
    repository: {
      async ensureReady() {},
      async getStatistics() { assert.fail('status permission must be checked before querying') }
    },
    getHiddenFields: async () => new Set(['status_info.status']),
    validStatuses: new Set(['pending']), parseId: () => null,
    normalizeRepairRow: row => row, maskRepairItem: item => item, maskRepairList: rows => rows
  })
  await assert.rejects(deniedStatus.getStats({ query: { status: 'pending' } }), error => (
    error.statusCode === 403 && error.code === 'FIELD_PERMISSION_DENIED'
  ))

  const noSearchFields = new RepairReadService({
    repository: {
      async ensureReady() {},
      async getStatistics() { assert.fail('search must be rejected before querying') }
    },
    getHiddenFields: async () => new Set([
      'basic_info.order_no', 'customer_info.customer_name', 'customer_info.customer_phone',
      'device_info.phone_model', 'device_info.imei', 'device_info.serial_number'
    ]),
    validStatuses: new Set(['pending']), parseId: () => null,
    normalizeRepairRow: row => row, maskRepairItem: item => item, maskRepairList: rows => rows
  })
  await assert.rejects(noSearchFields.getStats({ query: { search: 'term' } }), error => (
    error.statusCode === 403 && error.code === 'FIELD_PERMISSION_DENIED'
  ))
  await assert.rejects(service.getStats({ query: { status: 'unknown' } }), error => error.code === 'BAD_REQUEST')
})

test('repair detail service validates ids, returns not-found as null and normalizes then masks existing rows', async () => {
  const calls = []
  const req = { user: { id: 7 } }
  const service = new RepairReadService({
    repository: { async getDetail(id) { calls.push(id); return id === 9 ? { id, photos: [] } : null } },
    getHiddenFields: async () => new Set(),
    validStatuses: new Set(['pending']),
    parseId: value => /^\d+$/.test(String(value)) && Number(value) > 0 ? Number(value) : null,
    normalizeRepairRow(row, userId) { return { ...row, normalized_for: userId } },
    maskRepairList: rows => rows,
    async maskRepairItem(row, request) { assert.equal(request, req); return { ...row, masked: true } }
  })

  await assert.rejects(service.getDetail('x', req), error => error.code === 'BAD_REQUEST')
  assert.deepEqual(await service.getDetail('8', req), null)
  assert.deepEqual(await service.getDetail('9', req), { id: 9, photos: [], normalized_for: 7, masked: true })
  assert.deepEqual(calls, [8, 9])
})

test('repair list service preserves bounded pagination, visible search fields, normalization and masking', async () => {
  const calls = []
  const events = []
  const req = { query: { page: '2', page_size: '150', status: 'processing', search: '  SN-1  ' }, user: { id: 4 } }
  const service = new RepairReadService({
    repository: {
      async ensureReady() { events.push('ready') },
      async getList(where, params, pageSize, offset) {
        events.push('query')
        calls.push({ where, params, pageSize, offset })
        return { rows: [{ id: 1 }], total: 41 }
      }
    },
    getHiddenFields: async () => new Set(['customer_info.customer_phone', 'device_info.imei']),
    validStatuses: new Set(['pending', 'processing', 'completed', 'cancelled']),
    parseId: () => null,
    normalizeRepairRow(row, userId) { return { ...row, normalized_for: userId } },
    maskRepairItem: item => item,
    async maskRepairList(rows, request) {
      assert.equal(request, req)
      return rows.map(row => ({ ...row, masked: true }))
    }
  })

  assert.deepEqual(await service.getList(req), {
    records: [{ id: 1, normalized_for: 4, masked: true }],
    pagination: { page: 2, page_size: 100, total: 41, total_pages: 1, has_next: false, has_prev: true }
  })
  assert.deepEqual(calls, [{
    where: ' WHERE r.status = ? AND (r.order_no LIKE ? OR c.name LIKE ? OR r.phone_model LIKE ? OR r.serial_number LIKE ?)',
    params: ['processing', '%SN-1%', '%SN-1%', '%SN-1%', '%SN-1%'],
    pageSize: 100,
    offset: 100
  }])
  assert.deepEqual(events, ['ready', 'query'])

  const defaultService = new RepairReadService({
    repository: {
      async ensureReady() {},
      async getList(_where, _params, pageSize, offset) {
        assert.equal(pageSize, 20)
        assert.equal(offset, 0)
        return { rows: [], total: 0 }
      }
    },
    getHiddenFields: async () => new Set(),
    validStatuses: new Set(['pending']), parseId: () => null,
    normalizeRepairRow: row => row, maskRepairItem: item => item, maskRepairList: rows => rows
  })
  assert.deepEqual((await defaultService.getList({ query: {}, user: { id: 4 } })).pagination, {
    page: 1, page_size: 20, total: 0, total_pages: 0, has_next: false, has_prev: false
  })
  await assert.rejects(service.getList({ ...req, query: { status: 'unknown' } }), error => error.code === 'BAD_REQUEST')
})

test('repair read repository uses schema-checked database and parameterizes stats and detail values', async () => {
  const calls = []
  const repository = new RepairReadRepository({
    getDatabase: async () => ({ async query(sql, params) {
      calls.push({ sql, params })
      return [[{ id: 9 }]]
    } }),
    listQuery: 'SELECT r.id FROM repairs r'
  })

  await repository.getStatistics('WHERE r.status = ? AND r.order_no LIKE ?', ['pending', '%x%'])
  await repository.getDetail(9)
  assert.deepEqual(calls[0].params, ['pending', '%x%'])
  assert.match(calls[0].sql, /FROM repairs r[\s\S]*WHERE r\.status = \? AND r\.order_no LIKE \?/)
  assert.deepEqual(calls[1].params, [9])
  assert.deepEqual(await repository.getDetail(0), { id: 9 })
})

test('repair list repository binds filters and pagination in both row and count queries', async () => {
  const calls = []
  const repository = new RepairReadRepository({
    getDatabase: async () => ({ async query(sql, params) {
      calls.push({ sql, params })
      return calls.length === 1 ? [[{ id: 3 }]] : [[{ total: '7' }]]
    } }),
    listQuery: 'SELECT r.id FROM repairs r LEFT JOIN customers c ON c.id = r.customer_id'
  })

  assert.deepEqual(await repository.getList(' WHERE r.status = ? AND c.name LIKE ?', ['pending', '%Lin%'], 20, 40), {
    rows: [{ id: 3 }], total: 7
  })
  assert.deepEqual(calls[0].params, ['pending', '%Lin%', 20, 40])
  assert.deepEqual(calls[1].params, ['pending', '%Lin%'])
  assert.match(calls[0].sql, /ORDER BY COALESCE\(r\.repair_time, r\.created_at\) DESC, r\.id DESC LIMIT \? OFFSET \?$/)
  assert.match(calls[1].sql, /COUNT\(\*\) AS total[\s\S]*WHERE r\.status = \? AND c\.name LIKE \?$/)
})

test('repair read controller preserves field-permission, validation, not-found and success responses', async () => {
  const listController = new RepairReadController({
    service: { async getList() { return { records: [{ id: 2 }], pagination: { page: 1, total: 1 } } } },
    response: { success(res, data, message, statusCode, extra) {
      res.body = { data, message, statusCode, extra }
      return res.body
    } }
  })
  const listed = response()
  await listController.list({ query: {} }, listed)
  assert.deepEqual(listed.body, {
    data: [{ id: 2 }], message: '获取维修记录成功', statusCode: 200,
    extra: { pagination: { page: 1, total: 1 } }
  })

  const permissionController = new RepairReadController({
    service: { async getList() { throw Object.assign(new Error('无权筛选状态'), { statusCode: 403, code: 'FIELD_PERMISSION_DENIED' }) } },
    logger: { error() {} }
  })
  const denied = response()
  await permissionController.list({ query: {} }, denied)
  assert.equal(denied.statusCode, 403)
  assert.deepEqual(denied.body, { success: false, message: '无权筛选状态', code: 'FIELD_PERMISSION_DENIED' })

  const validationController = new RepairReadController({
    service: { async getDetail() { throw Object.assign(new Error('维修单编号无效'), { code: 'BAD_REQUEST' }) } }
  })
  const invalid = response()
  await validationController.detail({ params: { id: 'x' } }, invalid)
  assert.equal(invalid.statusCode, 400)

  const detailController = new RepairReadController({
    service: { async getDetail() { return null } }
  })
  const missing = response()
  await detailController.detail({ params: { id: '8' } }, missing)
  assert.equal(missing.statusCode, 404)

  const successController = new RepairReadController({
    service: { async getStats() { return { pending: 1 } } },
    response: { success(res, data, message) { res.body = { data, message }; return res.body } }
  })
  const success = response()
  await successController.stats({ query: {} }, success)
  assert.deepEqual(success.body, { data: { pending: 1 }, message: '获取维修统计成功' })
})
