'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const RepairStatusController = require('../src/controllers/repair-status.controller')
const RepairStatusService = require('../src/services/repair-status.service')
const RepairStatusRepository = require('../src/repositories/repair-status.repository')

const response = () => ({
  status(code) { this.statusCode = code; return this },
  json(body) { this.body = body; return this }
})

test('repair status route keeps authentication and edit permission while delegating to controller', () => {
  const route = fs.readFileSync(path.join(__dirname, '../src/routes/repairs.js'), 'utf8')
  assert.match(route, /router\.patch\('\/:id\/status', unifiedAuth, requirePermission\('repairs:edit'\), repairStatusController\.update\.bind\(repairStatusController\)\)/)
  assert.match(route, /router\.delete\('\/:id', unifiedAuth, requirePermission\('repairs:delete'\), repairStatusController\.cancel\.bind\(repairStatusController\)\)/)
})

test('repair status service validates IDs and allowed statuses before repository access', async () => {
  const calls = []
  const service = new RepairStatusService({
    repository: {
      async updateStatus(id, status) { calls.push({ id, status }); return { id, status } },
      async cancel(id) { calls.push({ cancel: id }); return true }
    },
    validStatuses: new Set(['pending', 'processing', 'completed', 'cancelled']),
    parseId: value => /^\d+$/.test(String(value)) && Number(value) > 0 ? Number(value) : null
  })

  await assert.rejects(service.update('x', 'completed'), error => error.statusCode === 400 && error.code === 'BAD_REQUEST')
  await assert.rejects(service.update('8', 'unknown'), error => error.statusCode === 400 && error.code === 'BAD_REQUEST')
  await assert.rejects(service.cancel('x'), error => error.statusCode === 400 && error.code === 'BAD_REQUEST')
  assert.deepEqual(await service.update('8', 'completed'), { id: 8, status: 'completed' })
  assert.equal(await service.cancel('8'), true)
  assert.deepEqual(calls, [{ id: 8, status: 'completed' }, { cancel: 8 }])
})

test('repair status repository updates completion time and returns the canonical row without controller SQL', async () => {
  const calls = []
  const repository = new RepairStatusRepository({
    async getDatabase() {
      return {
        async execute(sql, params) {
          calls.push({ sql, params })
          return sql.startsWith('UPDATE') ? [{ affectedRows: 1 }] : [[{ id: 8, status: 'completed' }]]
        }
      }
    },
    listQuery: 'SELECT r.id, r.status FROM repairs r'
  })

  assert.deepEqual(await repository.updateStatus(8, 'completed'), { id: 8, status: 'completed' })
  assert.match(calls[0].sql, /completed_at = CASE WHEN \? = 'completed' THEN COALESCE\(completed_at, NOW\(\)\) ELSE NULL END/)
  assert.deepEqual(calls[0].params, ['completed', 'completed', 8])
  assert.equal(calls[1].sql, 'SELECT r.id, r.status FROM repairs r WHERE r.id = ?')
})

test('repair status controller preserves response, masking and not-found behavior', async () => {
  const calls = []
  const controller = new RepairStatusController({
    service: { async update(id, status) { calls.push({ id, status }); return { id: 8, photos: [] } } },
    normalizeRepairRow(row, userId) { return { ...row, normalized_for: userId } },
    async maskRepairItem(row, req) { assert.equal(req.user.id, 7); return { ...row, masked: true } },
    response: {
      success(res, data, message) { res.body = { success: true, data, message }; return res },
      notFound(res, message) { res.statusCode = 404; res.body = { message }; return res },
      badRequest(res, message) { res.statusCode = 400; res.body = { message }; return res },
      serverError(res, message) { res.statusCode = 500; res.body = { message }; return res }
    },
    logger: { error() {} }
  })
  const req = { params: { id: '8' }, body: { status: 'completed' }, user: { id: 7 } }
  const success = response()
  await controller.update(req, success)
  assert.deepEqual(success.body, {
    success: true,
    data: { id: 8, photos: [], normalized_for: 7, masked: true },
    message: '维修状态更新成功'
  })
  assert.deepEqual(calls, [{ id: '8', status: 'completed' }])

  controller.service.update = async () => null
  const missing = response()
  await controller.update(req, missing)
  assert.equal(missing.statusCode, 404)
})

test('repair cancellation preserves invalid, completed-or-missing and success responses', async () => {
  const controller = new RepairStatusController({
    service: {
      async cancel(id) {
        if (id === 'invalid') throw Object.assign(new Error('维修单编号无效'), { code: 'BAD_REQUEST' })
        return id === 'active'
      }
    },
    normalizeRepairRow: row => row,
    maskRepairItem: row => row,
    response: {
      success(res, data, message) { res.body = { success: true, data, message }; return res },
      notFound(res, message) { res.statusCode = 404; res.body = { message }; return res },
      badRequest(res, message) { res.statusCode = 400; res.body = { message }; return res },
      serverError(res, message) { res.statusCode = 500; res.body = { message }; return res }
    },
    logger: { error() {} }
  })

  const invalid = response()
  await controller.cancel({ params: { id: 'invalid' } }, invalid)
  assert.equal(invalid.statusCode, 400)

  const completed = response()
  await controller.cancel({ params: { id: 'completed' } }, completed)
  assert.equal(completed.statusCode, 404)
  assert.equal(completed.body.message, '维修单不存在或已完成')

  const cancelled = response()
  await controller.cancel({ params: { id: 'active' } }, cancelled)
  assert.deepEqual(cancelled.body, { success: true, data: null, message: '维修单已取消' })
})
