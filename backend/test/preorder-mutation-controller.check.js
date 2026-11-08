'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')

const createResponse = () => ({
  status(code) {
    this.statusCode = code
    return this
  },
  json(body) {
    this.body = body
    return this
  }
})

test('预定删除 route 保留认证、删除权限并委托 mutation controller', () => {
  const fs = require('node:fs')
  const path = require('node:path')
  const route = fs.readFileSync(path.join(__dirname, '../src/routes/preorders.js'), 'utf8')

  assert.match(route, /router\.delete\('\/:id', unifiedAuth, requirePermission\('preorders:delete'\), preorderMutationController\.remove\.bind\(preorderMutationController\)\)/)
  assert.match(route, /router\.put\('\/:id\/cancel', unifiedAuth, requirePermission\('preorders:cancel'\), preorderMutationController\.cancel\.bind\(preorderMutationController\)\)/)
  assert.match(route, /router\.put\('\/:id\/deliver', unifiedAuth, requirePermission\('preorders:deliver'\), rejectHiddenPreorderWriteFields, preorderMutationController\.deliver\.bind\(preorderMutationController\)\)/)
  assert.match(route, /router\.put\('\/:id\/restore', unifiedAuth, requirePermission\('preorders:edit'\), preorderMutationController\.restore\.bind\(preorderMutationController\)\)/)
  assert.match(route, /router\.put\('\/:id\/match', unifiedAuth, requirePermission\('preorders:match'\), rejectHiddenPreorderWriteFields, preorderMutationController\.match\.bind\(preorderMutationController\)\)/)
  assert.match(route, /router\.put\('\/:id', unifiedAuth, requirePermission\('preorders:edit'\), rejectHiddenPreorderWriteFields, preorderMutationController\.update\.bind\(preorderMutationController\)\)/)
  assert.match(route, /router\.post\('\/', unifiedAuth, requirePermission\('preorders:create'\), rejectHiddenPreorderWriteFields, preorderMutationController\.create\.bind\(preorderMutationController\)\)/)
  assert.doesNotMatch(route, /router\.put\('\/:id'[^\n]*async\s*\(/)
})

test('预定旧交付 route 保持拒绝响应并由 controller 输出', async () => {
  const PreorderMutationController = require('../src/controllers/preorder-mutation.controller')
  const response = createResponse()
  await new PreorderMutationController().deliver({}, response)
  assert.equal(response.statusCode, 409)
  assert.equal(response.body.message, '预定交付请从预定管理点击“交付”，在销售页面完成出库')
})

test('预定恢复 controller 保持状态错误、字段脱敏和匹配响应契约', async () => {
  const PreorderMutationController = require('../src/controllers/preorder-mutation.controller')
  const controller = new PreorderMutationController({
    service: { async restore(id) {
      assert.equal(id, '23')
      return { data: { id: 23, status: 'arrived' }, matched: true }
    } },
    async maskItem(item, req) {
      assert.equal(req.user.id, 8)
      return { id: item.id, masked: true }
    }
  })
  const response = createResponse()
  await controller.restore({ params: { id: '23' }, user: { id: 8 } }, response)
  assert.deepEqual(response.body.data, { id: 23, masked: true })
  assert.equal(response.body.message, '预定单已恢复，并已按当前商品规格自动匹配库存')

  for (const [error, status, message] of [
    ['not_found', 404, '预定单不存在'],
    ['invalid_status', 400, '只能恢复已取消状态的预定单'],
    ['phone_in_use', 400, '库存设备刚刚被占用，请重新恢复']
  ]) {
    const failed = new PreorderMutationController({ service: { async restore() { return { error } } } })
    const failedResponse = createResponse()
    await failed.restore({ params: { id: '23' } }, failedResponse)
    assert.equal(failedResponse.statusCode, status)
    assert.equal(failedResponse.body.message, message)
  }
})

test('预定匹配 controller 保持错误映射、字段脱敏和成功消息', async () => {
  const PreorderMutationController = require('../src/controllers/preorder-mutation.controller')
  const controller = new PreorderMutationController({
    service: { async match(id, body) {
      assert.equal(id, '23')
      assert.equal(body.phone_id, 81)
      return { data: { id: 23, matched_phone_id: 81 }, message: '预定单匹配成功，库存已预留，尚未出库' }
    } },
    async maskItem(item) { return { id: item.id, masked: true } }
  })
  const response = createResponse()
  await controller.match({ params: { id: '23' }, body: { phone_id: 81 } }, response)
  assert.deepEqual(response.body.data, { id: 23, masked: true })
  assert.equal(response.body.message, '预定单匹配成功，库存已预留，尚未出库')

  for (const [error, status, message] of [
    ['phone_required', 400, '请选择要匹配的手机或输入IMEI'],
    ['invalid_date', 400, '到货日期格式必须为 YYYY-MM-DD'],
    ['preorder_not_found', 404, '预定单不存在'],
    ['phone_not_found', 404, '设备不存在'],
    ['phone_reservation_failed', 400, '设备已被其他预定单占用，请重新选择']
  ]) {
    const failed = new PreorderMutationController({ service: { async match() { return { error } } } })
    const failedResponse = createResponse()
    await failed.match({ params: { id: '23' }, body: {} }, failedResponse)
    assert.equal(failedResponse.statusCode, status)
    assert.equal(failedResponse.body.message, message)
  }
})

test('预定创建 controller 保持错误、脱敏及自动匹配响应契约', async () => {
  const PreorderMutationController = require('../src/controllers/preorder-mutation.controller')
  const controller = new PreorderMutationController({
    service: { async create(body, user) {
      assert.equal(body.customer_id, 17)
      assert.equal(user.id, 8)
      return {
        data: { id: 23, preorder_number: 'PR123', auto_matched: true, matched_phone_id: 81, imei: 'test-imei' },
        matched: true
      }
    } },
    async maskItem(item, req) {
      assert.equal(req.user.id, 8)
      return { id: item.id, masked: true }
    }
  })
  const response = createResponse()
  await controller.create({ body: { customer_id: 17 }, user: { id: 8 } }, response)
  assert.deepEqual(response.body.data, { id: 23, masked: true })
  assert.equal(response.body.message, '预定单创建成功，已自动匹配并预留库存，尚未出库')

  for (const [error, status, message] of [
    ['invalid_condition', 400, '成色必须为全新或二手'],
    ['customer_required', 400, '请选择客户'],
    ['invalid_deposit', 400, '请输入有效的定金金额'],
    ['customer_not_found', 404, '客户不存在'],
    ['brand_not_found', 404, '品牌不存在'],
    ['invalid_preorder_person', 400, '预定人编号无效']
  ]) {
    const failed = new PreorderMutationController({ service: { async create() { return { error } } } })
    const failedResponse = createResponse()
    await failed.create({ body: {}, user: { id: 8 } }, failedResponse)
    assert.equal(failedResponse.statusCode, status)
    assert.equal(failedResponse.body.message, message)
  }
})

test('预定更新 controller 映射业务错误并保留脱敏及响应消息', async () => {
  const PreorderMutationController = require('../src/controllers/preorder-mutation.controller')
  const response = createResponse()
  const masked = { id: 23, status: 'pending', remarks: 'visible' }
  const controller = new PreorderMutationController({
    service: { async update(id, input) {
      assert.equal(id, '23')
      assert.deepEqual(input, { remarks: 'visible' })
      return { data: { id: 23 }, staleMatchNeedsClearing: true }
    } },
    async maskItem(item) { assert.deepEqual(item, { id: 23 }); return masked }
  })
  await controller.update({ params: { id: '23' }, body: { remarks: 'visible' } }, response)
  assert.equal(response.body.success, true)
  assert.equal(response.body.message, '原匹配已解除，请按当前商品规格重新匹配库存')
  assert.deepEqual(response.body.data, masked)

  const invalid = createResponse()
  const invalidController = new PreorderMutationController({ service: { async update() { return { error: 'invalid_status' } } } })
  await invalidController.update({ params: { id: '23' }, body: {} }, invalid)
  assert.equal(invalid.statusCode, 400)
  assert.equal(invalid.body.message, '只能编辑待匹配或已匹配的预定单')
})

test('预定取消 controller 保持事务业务错误和成功响应契约', async () => {
  const PreorderMutationController = require('../src/controllers/preorder-mutation.controller')
  const request = { params: { id: '23' }, body: { reason: '客户改期' } }
  const success = createResponse()
  const controller = new PreorderMutationController({
    service: { async cancel(id, reason) {
      assert.equal(id, '23')
      assert.equal(reason, '客户改期')
      return { data: { id: 23, message: '预定单取消成功' } }
    } }
  })
  await controller.cancel(request, success)
  assert.equal(success.body.success, true)
  assert.deepEqual(success.body.data, { id: 23, message: '预定单取消成功' })
  assert.equal(success.body.message, '预定单取消成功')

  for (const [error, expectedStatus, message] of [
    ['not_found', 404, '预定单不存在'],
    ['already_cancelled', 400, '预定单已被取消'],
    ['delivered', 400, '已交付的预定单不能取消'],
    ['phone_in_use', 400, '匹配设备仍被其他预定单占用，无法取消']
  ]) {
    const failed = new PreorderMutationController({ service: { async cancel() { return { error } } } })
    const response = createResponse()
    await failed.cancel(request, response)
    assert.equal(response.statusCode, expectedStatus)
    assert.equal(response.body.message, message)
  }
})

test('预定取消 service 在一个事务内锁定状态、释放匹配设备并清理预定单', async () => {
  const PreorderMutationService = require('../src/services/preorder-mutation.service')
  const calls = []
  let committed = false
  let released = false
  const connection = {
    async beginTransaction() { calls.push({ type: 'begin' }) },
    async commit() { committed = true },
    async rollback() { calls.push({ type: 'rollback' }) }
  }
  const service = new PreorderMutationService({ repository: {
    async withConnection(callback) {
      try { return await callback(connection) } finally { released = true }
    },
    async getForUpdate(executor, id) {
      assert.equal(executor, connection)
      calls.push({ type: 'lock', id })
      return { id: 23, status: 'arrived', matched_phone_id: 68 }
    },
    async releaseMatchedPhone(executor, phoneId, id) {
      assert.equal(executor, connection)
      calls.push({ type: 'release-phone', phoneId, id })
      return true
    },
    async markCancelled(executor, id, reason) {
      assert.equal(executor, connection)
      calls.push({ type: 'cancel', id, reason })
    }
  } })

  const result = await service.cancel('23', '客户改期')
  assert.deepEqual(result, { data: { id: 23, message: '预定单取消成功' } })
  assert.equal(calls[0].type, 'begin')
  assert.deepEqual(calls[1], { type: 'lock', id: '23' })
  assert.deepEqual(calls[2], { type: 'release-phone', phoneId: 68, id: '23' })
  assert.deepEqual(calls[3], { type: 'cancel', id: '23', reason: '客户改期' })
  assert.equal(committed, true)
  assert.equal(calls.some(call => call.type === 'rollback'), false)
  assert.equal(released, true)
})

test('预定取消 service 对缺失、终态、占用冲突和写入错误回滚并释放连接', async () => {
  const PreorderMutationService = require('../src/services/preorder-mutation.service')
  const cases = [
    { preorder: null, expected: { error: 'not_found' } },
    { preorder: { status: 'cancelled' }, expected: { error: 'already_cancelled' } },
    { preorder: { status: 'completed' }, expected: { error: 'delivered' } },
    { preorder: { status: 'arrived', matched_phone_id: 68 }, released: false, expected: { error: 'phone_in_use' } }
  ]

  for (const item of cases) {
    const calls = []
    let released = false
    const connection = {
      async beginTransaction() { calls.push('begin') },
      async commit() { calls.push('commit') },
      async rollback() { calls.push('rollback') }
    }
    const service = new PreorderMutationService({ repository: {
      async withConnection(callback) { try { return await callback(connection) } finally { released = true } },
      async getForUpdate() { return item.preorder },
      async releaseMatchedPhone() { return item.released },
      async markCancelled() { calls.push('update') }
    } })
    assert.deepEqual(await service.cancel('23'), item.expected)
    assert.equal(calls.includes('rollback'), true)
    assert.equal(calls.includes('commit'), false)
    assert.equal(released, true)
  }

  const calls = []
  let released = false
  const connection = {
    async beginTransaction() { calls.push('begin') },
    async commit() { calls.push('commit') },
    async rollback() { calls.push('rollback') }
  }
  const failingService = new PreorderMutationService({ repository: {
    async withConnection(callback) { try { return await callback(connection) } finally { released = true } },
    async getForUpdate() { return { id: 23, status: 'pending' } },
    async releaseMatchedPhone() { return true },
    async markCancelled() { throw new Error('write failed') }
  } })
  await assert.rejects(failingService.cancel('23'), /write failed/)
  assert.deepEqual(calls, ['begin', 'rollback'])
  assert.equal(released, true)
})

test('预定取消 repository 只在提供的事务连接上执行绑定 SQL', async () => {
  const PreorderMutationRepository = require('../src/repositories/preorder-mutation.repository')
  const calls = []
  const repository = new PreorderMutationRepository()
  const connection = {
    async execute(sql, params) {
      calls.push({ sql, params })
      return sql.includes('UPDATE phones') ? [{ affectedRows: 1 }] : [[{ id: 23 }]]
    }
  }
  const preorder = await repository.getForUpdate(connection, '23')
  assert.equal(preorder.id, 23)
  assert.match(calls[0].sql, /FROM preorders WHERE id = \? FOR UPDATE/)
  assert.deepEqual(calls[0].params, ['23'])
  assert.equal(await repository.releaseMatchedPhone(connection, 68, '23'), true)
  assert.match(calls[1].sql, /NOT EXISTS[\s\S]*active_preorder\.id <> \?/)
  assert.deepEqual(calls[1].params, [68, '23'])
  await repository.markCancelled(connection, '23', '客户改期')
  assert.match(calls[2].sql, /status = 'cancelled'[\s\S]*matched_phone_id = NULL[\s\S]*cancel_reason = \?/)
  assert.deepEqual(calls[2].params, ['客户改期', '23'])
})

test('预定删除 controller 保持缺失、状态拒绝和成功响应', async () => {
  const PreorderMutationController = require('../src/controllers/preorder-mutation.controller')
  const controller = new PreorderMutationController({
    service: { async remove() { return { data: { id: 23, deleted: true } } } }
  })
  const success = createResponse()
  await controller.remove({ params: { id: '23' } }, success)
  assert.equal(success.body.success, true)
  assert.deepEqual(success.body.data, { id: 23, deleted: true })
  assert.equal(success.body.message, '预定单删除成功')

  for (const [error, expectedStatus, expectedMessage] of [
    ['not_found', 404, '预定单不存在'],
    ['invalid_status', 400, '只能删除已取消或已交付的预定单']
  ]) {
    const failed = new PreorderMutationController({ service: { async remove() { return { error } } } })
    const response = createResponse()
    await failed.remove({ params: { id: '23' } }, response)
    assert.equal(response.statusCode, expectedStatus)
    assert.equal(response.body.message, expectedMessage)
  }
})

test('预定删除 service 仅允许删除已取消或已交付记录', async () => {
  const PreorderMutationService = require('../src/services/preorder-mutation.service')
  const cases = [
    { status: null, expected: { error: 'not_found' }, deletes: 0 },
    { status: 'pending', expected: { error: 'invalid_status' }, deletes: 0 },
    { status: 'cancelled', expected: { data: { id: 23, deleted: true } }, deletes: 1 },
    { status: 'completed', expected: { data: { id: 23, deleted: true } }, deletes: 1 }
  ]
  for (const item of cases) {
    const calls = []
    const service = new PreorderMutationService({ repository: {
      async getStatus(id) { calls.push(['status', id]); return item.status },
      async deleteById(id) { calls.push(['delete', id]); return true }
    } })
    assert.deepEqual(await service.remove('23'), item.expected)
    assert.equal(calls.filter(([name]) => name === 'delete').length, item.deletes)
  }
})

test('预定删除 repository 只执行参数化状态读取和删除', async () => {
  const PreorderMutationRepository = require('../src/repositories/preorder-mutation.repository')
  const calls = []
  const repository = new PreorderMutationRepository({ database: () => ({
    async execute(sql, params) {
      calls.push({ sql, params })
      return sql.startsWith('SELECT') ? [[{ status: 'cancelled' }]] : [{ affectedRows: 1 }]
    }
  }) })
  assert.equal(await repository.getStatus('23'), 'cancelled')
  assert.equal(await repository.deleteById('23'), true)
  assert.deepEqual(calls, [
    { sql: 'SELECT status FROM preorders WHERE id = ?', params: ['23'] },
    { sql: 'DELETE FROM preorders WHERE id = ?', params: ['23'] }
  ])
})

test('预定恢复 service 在同一事务内清理历史匹配、重新匹配并读取脱敏前详情', async () => {
  const PreorderMutationService = require('../src/services/preorder-mutation.service')
  const calls = []
  const connection = {
    async beginTransaction() { calls.push('begin') },
    async commit() { calls.push('commit') },
    async rollback() { calls.push('rollback') }
  }
  const service = new PreorderMutationService({
    repository: {
      async withConnection(callback) { return callback(connection) },
      async getForRestore(executor, id) {
        assert.equal(executor, connection)
        calls.push(['lock', id])
        return { id: 23, status: 'cancelled', matched_phone_id: 68, brand_id: 1, model_id: 2, color_id: 3, memory_id: 4, is_new: 1 }
      },
      async releaseMatchedPhone(executor, phoneId, id) { calls.push(['release', phoneId, id]) },
      async findRestoreCandidate(executor, preorder) {
        assert.equal(executor, connection)
        assert.equal(preorder.id, 23)
        calls.push('find-candidate')
        return { id: 81, imei: 'test-imei', brand_name: '品牌', model_name: '型号' }
      },
      async reserveRestoreCandidate(executor, phoneId) { calls.push(['reserve', phoneId]); return true },
      async restorePreorder(executor, id, phone) { calls.push(['restore', id, phone.id]) }
    },
    readRepository: { async getById(id, executor) {
      assert.equal(id, '23')
      assert.equal(executor, connection)
      calls.push('read-detail')
      return { id: 23, status: 'arrived' }
    } }
  })

  assert.deepEqual(await service.restore('23'), { data: { id: 23, status: 'arrived' }, matched: true })
  assert.deepEqual(calls, [
    'begin', ['lock', '23'], ['release', 68, '23'], 'find-candidate', ['reserve', 81],
    ['restore', '23', 81], 'commit', 'read-detail'
  ])
})

test('预定恢复 service 在缺失、错误状态、设备冲突或读写异常时回滚', async () => {
  const PreorderMutationService = require('../src/services/preorder-mutation.service')
  for (const item of [
    { preorder: null, error: 'not_found' },
    { preorder: { status: 'pending' }, error: 'invalid_status' },
    { preorder: { status: 'cancelled' }, candidate: { id: 81 }, reserve: false, error: 'phone_in_use' }
  ]) {
    const calls = []
    const service = new PreorderMutationService({
      repository: {
        async withConnection(callback) {
          return callback({ async beginTransaction() { calls.push('begin') }, async rollback() { calls.push('rollback') }, async commit() { calls.push('commit') } })
        },
        async getForRestore() { return item.preorder },
        async releaseMatchedPhone() {},
        async findRestoreCandidate() { return item.candidate || null },
        async reserveRestoreCandidate() { return item.reserve },
        async restorePreorder() { calls.push('write') }
      },
      readRepository: { async getById() { throw new Error('must not read') } }
    })
    assert.deepEqual(await service.restore('23'), { error: item.error })
    assert.equal(calls.includes('rollback'), true)
    assert.equal(calls.includes('commit'), false)
  }

  const calls = []
  const failing = new PreorderMutationService({
    repository: {
      async withConnection(callback) {
        return callback({ async beginTransaction() { calls.push('begin') }, async rollback() { calls.push('rollback') }, async commit() { calls.push('commit') } })
      },
      async getForRestore() { return { status: 'cancelled' } },
      async findRestoreCandidate() { return null },
      async restorePreorder() { throw new Error('restore write failed') }
    }
  })
  await assert.rejects(failing.restore('23'), /restore write failed/)
  assert.deepEqual(calls, ['begin', 'rollback'])
})

test('预定匹配 service 在事务中核对规格、释放旧设备并预留新设备', async () => {
  const PreorderMutationService = require('../src/services/preorder-mutation.service')
  const calls = []
  const connection = {
    async beginTransaction() { calls.push('begin') },
    async commit() { calls.push('commit') },
    async rollback() { calls.push('rollback') }
  }
  const service = new PreorderMutationService({ repository: {
    async withConnection(callback) { return callback(connection) },
    async getForMatching(executor, id) {
      assert.equal(executor, connection)
      calls.push(['preorder', id])
      return {
        status: 'arrived', matched_phone_id: 67,
        brand_id: 1, model_id: 2, color_id: 3, memory_id: 4, is_new: 1,
        total_price: 300, deposit_amount: 100
      }
    },
    async getPhoneForMatching(_executor, phoneId, imei) {
      calls.push(['phone', phoneId, imei])
      return {
        id: 81, imei: 'test-imei', brand_id: 1, model_id: 2, color_id: 3,
        memory_id: 4, is_new: 1, status: 'in_stock', is_preordered: 0,
        sale_price: 350, brand_name: '品牌', model_name: '型号'
      }
    },
    async hasOtherActivePreorder() { calls.push('other-preorder'); return false },
    async getPreviousPhoneForMatching(_executor, phoneId) {
      calls.push(['old-phone', phoneId])
      return { id: phoneId, status: 'reserved', is_preordered: 1 }
    },
    async releasePreviousPhone(_executor, phoneId) { calls.push(['release-old', phoneId]); return true },
    async updateMatchedPreorder(_executor, values) { calls.push(['update-preorder', values]) },
    async reserveMatchedPhone(_executor, phoneId) { calls.push(['reserve-new', phoneId]); return true }
  } })

  const result = await service.match('23', {
    phone_id: 81, actual_model: '指定机型', arrival_date: '2026-11-07', actual_price: '320'
  })
  assert.deepEqual(result, {
    data: {
      id: 23, matched_phone_id: 81, imei: 'test-imei', actual_model: '指定机型',
      actual_price: 320, remaining_amount: 220
    },
    message: '匹配设备更换成功，库存已重新预留'
  })
  assert.deepEqual(calls.map(call => Array.isArray(call) ? call[0] : call), [
    'begin', 'preorder', 'phone', 'other-preorder', 'old-phone', 'release-old',
    'update-preorder', 'reserve-new', 'commit'
  ])
  assert.equal(calls.some(call => call === 'rollback'), false)
})

test('预定创建 service 验证引用后在同一事务内自动预留库存并创建订单', async () => {
  const PreorderMutationService = require('../src/services/preorder-mutation.service')
  const calls = []
  const connection = {
    async beginTransaction() { calls.push('begin') },
    async commit() { calls.push('commit') },
    async rollback() { calls.push('rollback') }
  }
  const service = new PreorderMutationService({ repository: {
    async withConnection(callback) { try { return await callback(connection) } finally { calls.push('release') } },
    async hasCustomer(executor, id) { assert.equal(executor, connection); calls.push(['customer', id]); return true },
    async hasReference(executor, table, id) { assert.equal(executor, connection); calls.push([table, id]); return true },
    async hasActiveUser(executor, id) { assert.equal(executor, connection); calls.push(['user', id]); return true },
    async findAutoMatchCandidate(executor, spec) {
      assert.equal(executor, connection)
      calls.push(['candidate', spec])
      return { id: 81, imei: 'test-imei' }
    },
    async reserveAutoMatchPhone(executor, phoneId) { assert.equal(executor, connection); calls.push(['reserve', phoneId]); return true },
    async insertPreorder(executor, values) { assert.equal(executor, connection); calls.push(['insert', values]); return 23 }
  } })
  const result = await service.create({
    customer_id: 17, store_id: 4, brand_id: 1, model_id: 2, color_id: 3, memory_id: 5,
    is_new: 1, total_price: '300', deposit_amount: '100', expected_arrival: '2026-11-07', remarks: '备注'
  }, { id: 8, store_id: 6 })

  assert.deepEqual(result.data, {
    id: 23,
    preorder_number: result.data.preorder_number,
    auto_matched: true,
    matched_phone_id: 81,
    imei: 'test-imei'
  })
  assert.match(result.data.preorder_number, /^PR\d{14}$/)
  assert.equal(result.matched, true)
  assert.deepEqual(calls.map(call => Array.isArray(call) ? call[0] : call), [
    'customer', 'brands', 'models', 'colors', 'memories', 'user', 'begin',
    'candidate', 'reserve', 'insert', 'commit', 'release'
  ])
  const inserted = calls.find(call => Array.isArray(call) && call[0] === 'insert')[1]
  assert.equal(inserted.customerId, 17)
  assert.equal(inserted.storeId, 4)
  assert.equal(inserted.createdBy, 8)
  assert.equal(inserted.depositAmount, 100)
  assert.equal(inserted.totalPrice, 300)
  assert.equal(inserted.status, 'arrived')
  assert.equal(inserted.matchedPhone.id, 81)
})

test('预定创建 service 拒绝废弃字段和无效输入，并回滚库存预留失败', async () => {
  const PreorderMutationService = require('../src/services/preorder-mutation.service')
  let connections = 0
  const earlyValidation = new PreorderMutationService({ repository: {
    async withConnection(callback) { connections += 1; return callback({}) }
  } })
  assert.deepEqual(await earlyValidation.create({ deposit: 1 }), { error: 'legacy_field', field: 'deposit' })
  assert.deepEqual(await earlyValidation.create({ is_new: 2 }), { error: 'invalid_condition' })
  assert.equal(connections, 0)

  const calls = []
  const connection = {
    async beginTransaction() { calls.push('begin') },
    async commit() { calls.push('commit') },
    async rollback() { calls.push('rollback') }
  }
  const failing = new PreorderMutationService({ repository: {
    async withConnection(callback) { return callback(connection) },
    async hasCustomer() { return true },
    async hasReference() { return true },
    async hasActiveUser() { return true },
    async findAutoMatchCandidate() { return { id: 81 } },
    async reserveAutoMatchPhone() { return false }
  } })
  await assert.rejects(failing.create({
    customer_id: 17, brand_id: 1, model_id: 2, color_id: 3, memory_id: 5,
    is_new: 1, deposit_amount: 100
  }, { id: 8 }), /匹配设备已被占用/)
  assert.deepEqual(calls, ['begin', 'rollback'])
})

test('预定更新 service 锁定状态、释放旧匹配并在同一事务内写入', async () => {
  const PreorderMutationService = require('../src/services/preorder-mutation.service')
  const calls = []
  const connection = {
    async beginTransaction() { calls.push('begin') },
    async commit() { calls.push('commit') },
    async rollback() { calls.push('rollback') },
    release() { calls.push('release') }
  }
  const service = new PreorderMutationService({
    repository: {
      async withConnection(callback) { return callback(connection) },
      async getForUpdate(executor, id) {
        assert.equal(executor, connection)
        calls.push(['lock', id])
        return { id: 23, status: 'arrived', matched_phone_id: 81, brand_id: 1, model_id: 2, color_id: 3, memory_id: 4, is_new: 1 }
      },
      async hasCustomer(executor, id) { assert.equal(executor, connection); calls.push(['customer', id]); return true },
      async hasActiveUser(executor, id) { assert.equal(executor, connection); calls.push(['creator', id]); return true },
      async releaseMatchedPhone(executor, phoneId, preorderId) {
        assert.equal(executor, connection)
        calls.push(['release', phoneId, preorderId])
        return true
      },
      async updateEditablePreorder(executor, id, updates, clearMatch) {
        assert.equal(executor, connection)
        calls.push(['update', id, updates, clearMatch])
      },
      async getEditablePreorderById(executor, id) {
        assert.equal(executor, connection)
        assert.equal(id, '23')
        calls.push('read')
        return { id: 23, status: 'pending' }
      }
    },
  })

  const result = await service.update('23', {
    customer_id: '17', brand_id: 9, deposit_amount: '100', total_price: '300', created_by: '8', remarks: '备注'
  })
  assert.deepEqual(result, { data: { id: 23, status: 'pending' }, staleMatchNeedsClearing: true })
  const update = calls.find(call => Array.isArray(call) && call[0] === 'update')
  assert.deepEqual(update, ['update', '23', {
    customer_id: 17, created_by: 8, brand_id: 9, total_price: 300, deposit_amount: 100, remarks: '备注'
  }, true])
  assert.deepEqual(calls.map(call => Array.isArray(call) ? call[0] : call), [
    'begin', 'lock', 'customer', 'creator', 'release', 'update', 'commit', 'read'
  ])
})

test('预定更新 service 对无效字段和状态拒绝时回滚并释放连接', async () => {
  const PreorderMutationService = require('../src/services/preorder-mutation.service')
  for (const scenario of [
    { preorder: null, input: { remarks: '备注' }, error: 'not_found' },
    { preorder: { status: 'completed' }, input: { remarks: '备注' }, error: 'invalid_status' },
    { preorder: { status: 'pending' }, input: { customer_name: '旧字段' }, error: 'legacy_field', field: 'customer_name' },
    { preorder: { status: 'pending' }, input: { expected_arrival: '2026-02-30' }, error: 'invalid_expected_arrival' },
    { preorder: { status: 'pending' }, input: { remarks: '备注', deposit_amount: 0 }, error: 'invalid_deposit' },
    { preorder: { status: 'pending' }, input: { customer_id: 'bad' }, error: 'invalid_customer_id' },
    { preorder: { status: 'pending' }, input: {}, error: 'no_fields' },
    { preorder: { status: 'pending' }, input: { created_by: 7 }, error: 'creator_unavailable', creatorAvailable: false },
    { preorder: { status: 'arrived', matched_phone_id: 81, brand_id: 1 }, input: { brand_id: 2 }, error: 'release_failed', release: false }
  ]) {
    const calls = []
    const connection = {
      async beginTransaction() { calls.push('begin') },
      async commit() { calls.push('commit') },
      async rollback() { calls.push('rollback') },
      release() { calls.push('release') }
    }
    const service = new PreorderMutationService({ repository: {
      async withConnection(callback) { try { return await callback(connection) } finally { connection.release() } },
      async getForUpdate() { return scenario.preorder },
      async hasCustomer() { return true },
      async hasActiveUser() { return scenario.creatorAvailable ?? true },
      async releaseMatchedPhone() { return scenario.release },
      async updateEditablePreorder() { calls.push('unexpected-update') }
    }, readRepository: { async getById() { return { id: 23 } } } })
    const result = await service.update('23', scenario.input)
    assert.equal(result.error, scenario.error, JSON.stringify(scenario))
    if (scenario.field) assert.equal(result.field, scenario.field)
    assert.equal(calls.includes('rollback'), true, scenario.error)
    assert.equal(calls.includes('commit'), false, scenario.error)
    assert.equal(calls.at(-1), 'release')
  }
})

test('预定匹配 service 校验输入并对业务拒绝及设备占用失败回滚', async () => {
  const PreorderMutationService = require('../src/services/preorder-mutation.service')
  let opened = false
  const validationService = new PreorderMutationService({ repository: {
    async withConnection(callback) { opened = true; return callback({}) }
  } })
  assert.deepEqual(await validationService.match('23', {}), { error: 'phone_required' })
  assert.deepEqual(await validationService.match('23', { phone_id: 1, arrival_date: '2026-02-30' }), { error: 'invalid_date' })
  assert.equal(opened, false)

  const scenarios = [
    { preorder: null, error: 'preorder_not_found' },
    { preorder: { status: 'cancelled' }, error: 'invalid_preorder_status' },
    { preorder: { status: 'pending' }, phone: null, error: 'phone_not_found' },
    { preorder: { status: 'pending' }, phone: { id: 81, status: 'sold', is_preordered: 0 }, error: 'phone_unavailable' },
    { preorder: { status: 'pending', brand_id: 1, model_id: 2, color_id: 3, memory_id: 4, is_new: 1 }, phone: { id: 81, brand_id: 9, status: 'in_stock', is_preordered: 0 }, error: 'specification_mismatch' },
    { preorder: { status: 'pending', brand_id: 1, model_id: 2, color_id: 3, memory_id: 4, is_new: 1 }, phone: { id: 81, brand_id: 1, model_id: 2, color_id: 3, memory_id: 4, is_new: 1, status: 'in_stock', sale_price: 10 }, other: true, error: 'phone_has_other_preorder' },
    { preorder: { status: 'pending', brand_id: 1, model_id: 2, color_id: 3, memory_id: 4, is_new: 1 }, phone: { id: 81, brand_id: 1, model_id: 2, color_id: 3, memory_id: 4, is_new: 1, status: 'in_stock' }, price: 'bad', error: 'invalid_price' },
    { preorder: { status: 'pending', matched_phone_id: 67, brand_id: 1, model_id: 2, color_id: 3, memory_id: 4, is_new: 1 }, phone: { id: 81, brand_id: 1, model_id: 2, color_id: 3, memory_id: 4, is_new: 1, status: 'in_stock' }, previous: null, error: 'previous_phone_unavailable' },
    { preorder: { status: 'pending', matched_phone_id: 67, brand_id: 1, model_id: 2, color_id: 3, memory_id: 4, is_new: 1 }, phone: { id: 81, brand_id: 1, model_id: 2, color_id: 3, memory_id: 4, is_new: 1, status: 'in_stock' }, previous: { status: 'in_stock', is_preordered: 0 }, error: 'previous_phone_state_invalid' },
    { preorder: { status: 'pending', matched_phone_id: 67, brand_id: 1, model_id: 2, color_id: 3, memory_id: 4, is_new: 1 }, phone: { id: 81, brand_id: 1, model_id: 2, color_id: 3, memory_id: 4, is_new: 1, status: 'in_stock' }, previous: { status: 'in_stock', is_preordered: 1 }, release: false, error: 'previous_phone_release_failed' },
    { preorder: { status: 'pending', brand_id: 1, model_id: 2, color_id: 3, memory_id: 4, is_new: 1 }, phone: { id: 81, brand_id: 1, model_id: 2, color_id: 3, memory_id: 4, is_new: 1, status: 'in_stock' }, reserve: false, error: 'phone_reservation_failed' }
  ]

  for (const item of scenarios) {
    const calls = []
    const service = new PreorderMutationService({ repository: {
      async withConnection(callback) {
        return callback({ async beginTransaction() { calls.push('begin') }, async rollback() { calls.push('rollback') }, async commit() { calls.push('commit') } })
      },
      async getForMatching() { return item.preorder },
      async getPhoneForMatching() { return item.phone },
      async hasOtherActivePreorder() { return Boolean(item.other) },
      async getPreviousPhoneForMatching() { return item.previous },
      async releasePreviousPhone() { return item.release },
      async updateMatchedPreorder() { calls.push('write') },
      async reserveMatchedPhone() { return item.reserve }
    } })
    assert.deepEqual(await service.match('23', { phone_id: 81, actual_price: item.price }), { error: item.error })
    assert.equal(calls.includes('rollback'), true, item.error)
    assert.equal(calls.includes('commit'), false, item.error)
  }
})

test('预定恢复 repository 执行锁定、规格查找、占用和状态恢复 SQL', async () => {
  const PreorderMutationRepository = require('../src/repositories/preorder-mutation.repository')
  const calls = []
  const connection = {
    async execute(sql, params) {
      calls.push({ sql, params })
      if (sql.includes('SELECT id, status, matched_phone_id')) return [[{ id: 23, status: 'cancelled' }]]
      if (sql.includes('SELECT p.id, p.imei')) return [[{ id: 81, imei: 'test-imei', brand_name: '品牌', model_name: '型号' }]]
      return [{ affectedRows: 1 }]
    }
  }
  const repository = new PreorderMutationRepository()
  const preorder = await repository.getForRestore(connection, '23')
  assert.equal(preorder.id, 23)
  assert.match(calls[0].sql, /WHERE id = \? FOR UPDATE/)
  assert.deepEqual(calls[0].params, ['23'])

  const candidate = await repository.findRestoreCandidate(connection, {
    brand_id: 1, model_id: 2, color_id: 3, memory_id: 4, is_new: 1
  })
  assert.equal(candidate.id, 81)
  assert.match(calls[1].sql, /NOT EXISTS[\s\S]*ORDER BY p\.inventory_time ASC, p\.id ASC[\s\S]*FOR UPDATE/)
  assert.deepEqual(calls[1].params, [1, 2, 3, 4, 1])
  assert.equal(await repository.reserveRestoreCandidate(connection, 81), true)
  assert.deepEqual(calls[2].params, [81])
  assert.equal(await repository.restorePreorder(connection, '23', candidate), true)
  assert.deepEqual(calls[3].params, ['arrived', 81, 'test-imei', 81, 81, '品牌 型号', '23'])
})

test('预定匹配 repository 锁定订单和设备，并使用绑定条件执行更新', async () => {
  const PreorderMutationRepository = require('../src/repositories/preorder-mutation.repository')
  const calls = []
  const connection = {
    async execute(sql, params) {
      calls.push({ sql, params })
      if (sql.includes('FROM preorders WHERE id =')) return [[{ id: 23, status: 'arrived' }]]
      if (sql.includes('FROM phones p') && sql.includes('p.id = ?')) return [[{ id: 81, imei: 'test-imei' }]]
      if (sql.includes('SELECT id FROM preorders')) return [[]]
      if (sql.includes('SELECT id, status, is_preordered')) return [[{ id: 67, status: 'reserved', is_preordered: 1 }]]
      return [{ affectedRows: 1 }]
    }
  }
  const repository = new PreorderMutationRepository()
  assert.equal((await repository.getForMatching(connection, '23')).id, 23)
  assert.equal((await repository.getPhoneForMatching(connection, 81, 'ignored')).id, 81)
  assert.equal(await repository.hasOtherActivePreorder(connection, 81, '23'), false)
  assert.equal((await repository.getPreviousPhoneForMatching(connection, 67)).id, 67)
  assert.equal(await repository.releasePreviousPhone(connection, 67), true)
  await repository.updateMatchedPreorder(connection, {
    id: '23', phone: { id: 81, imei: 'test-imei' }, model: '品牌 型号', arrivalDate: '2026-11-07', price: 320
  })
  assert.equal(await repository.reserveMatchedPhone(connection, 81), true)
  assert.match(calls[0].sql, /FROM preorders WHERE id = \? FOR UPDATE/)
  assert.match(calls[1].sql, /WHERE p\.id = \?\s+FOR UPDATE/)
  assert.deepEqual(calls[1].params, [81])
  assert.deepEqual(calls[5].params, ['arrived', 81, 'test-imei', '品牌 型号', '2026-11-07', 320, '23'])
  assert.deepEqual(calls[6].params, [81, 81])
})

test('预定创建 repository 使用固定引用表、绑定参数和自动匹配事务连接', async () => {
  const PreorderMutationRepository = require('../src/repositories/preorder-mutation.repository')
  const calls = []
  const connection = {
    async execute(sql, params) {
      calls.push({ sql, params })
      if (sql.trimStart().startsWith('SELECT')) return [[{ id: 1 }]]
      if (sql.trimStart().startsWith('INSERT')) return [{ insertId: 23 }]
      return [{ affectedRows: 1 }]
    }
  }
  const repository = new PreorderMutationRepository()
  assert.equal(await repository.hasCustomer(connection, 17), true)
  assert.equal(await repository.hasReference(connection, 'brands', 1), true)
  assert.equal(await repository.hasActiveUser(connection, 8), true)
  const phone = await repository.findAutoMatchCandidate(connection, {
    brand_id: 1, model_id: 2, color_id: 3, memory_id: 5, is_new: 1
  })
  assert.equal(phone.id, 1)
  assert.equal(await repository.reserveAutoMatchPhone(connection, 81), true)
  const id = await repository.insertPreorder(connection, {
    preorderNumber: 'PR20261107010101', customerId: 17, storeId: 4,
    brandId: 1, modelId: 2, colorId: 3, memoryId: 5, isNew: 1,
    depositAmount: 100, totalPrice: 300, expectedArrival: '2026-11-07',
    status: 'arrived', remarks: '备注', createdBy: 8, matchedPhone: { id: 81, imei: 'test-imei' }
  })
  assert.equal(id, 23)
  assert.match(calls[3].sql, /FOR UPDATE/)
  assert.deepEqual(calls[3].params, [1, 2, 3, 5, 1])
  assert.deepEqual(calls[5].params, [
    'PR20261107010101', 17, 4, 1, 2, 3, 5, 1, 100, 100, 300, '2026-11-07',
    'arrived', '备注', null, 8, 81, 'test-imei', calls[5].params[18]
  ])
  assert.ok(calls[5].params[18] instanceof Date)
  await assert.rejects(repository.hasReference(connection, 'users; DROP TABLE users', 1), /Unsupported/)
})

test('预定更新 repository 仅更新白名单字段并绑定所有请求值', async () => {
  const PreorderMutationRepository = require('../src/repositories/preorder-mutation.repository')
  let call
  const connection = {
    async execute(sql, params) { call = { sql, params } }
  }
  const repository = new PreorderMutationRepository()
  await repository.updateEditablePreorder(connection, '23', {
    customer_id: 17,
    remarks: '备注',
    arbitrary_column: 'ignored'
  }, true)
  assert.match(call.sql, /customer_id = \?, remarks = \?, status = \?, matched_phone_id = NULL/)
  assert.match(call.sql, /updated_at = NOW\(\) WHERE id = \?$/)
  assert.deepEqual(call.params, [17, '备注', 'pending', '23'])
  assert.doesNotMatch(call.sql, /arbitrary_column/)
})

test('预定更新后读取只返回既有核心字段且复用事务连接', async () => {
  const PreorderMutationRepository = require('../src/repositories/preorder-mutation.repository')
  let query
  const connection = {
    async execute(sql, params) {
      query = { sql, params }
      return [[{ id: 23, status: 'pending', remarks: '备注' }]]
    }
  }
  const repository = new PreorderMutationRepository()
  assert.deepEqual(await repository.getEditablePreorderById(connection, '23'), {
    id: 23, status: 'pending', remarks: '备注'
  })
  assert.match(query.sql, /SELECT id, customer_id, store_id[\s\S]*FROM preorders WHERE id = \?$/)
  assert.doesNotMatch(query.sql, /JOIN customers|status_text|product_name/)
  assert.deepEqual(query.params, ['23'])
})

test('预定详情仓储可复用事务连接读取并由调用方释放', async () => {
  const PreorderReadRepository = require('../src/repositories/preorder-read.repository')
  const connection = {
    released: false,
    async execute() { return [[{ id: 23, status: 'arrived' }]] },
    release() { this.released = true }
  }
  const repository = new PreorderReadRepository()
  assert.deepEqual(await repository.getById('23', connection), { id: 23, status: 'arrived' })
  assert.equal(connection.released, false)
})
