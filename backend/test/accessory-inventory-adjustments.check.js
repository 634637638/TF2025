'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const Service = require('../src/services/accessory-inventory-adjustment.service')

function fixture({ serialTracking = 0, quantity = 4, failAt = null, replay = null } = {}) {
  const state = { quantity, events: [], records: [], commits: 0, rollbacks: 0 }
  let before
  const connection = {
    async execute() {}, async beginTransaction() { before = structuredClone(state) },
    async commit() { state.commits++ }, async rollback() {
      state.quantity = before.quantity; state.events = before.events; state.records = before.records
      state.rollbacks++
    }, destroy() {}
  }
  const repository = {
    async withConnection(operation) { return operation(connection) },
    async adjustmentSchemaReady() { return true },
    async batchConflict() { return failAt === 'ledger' },
    async adjustmentByKey() { return replay },
    async adjustmentBatch(eventId, accessoryId, _scope, _db, lock) {
      assert.equal(eventId, 91); assert.equal(accessoryId, 31); assert.equal(lock, true)
      return { accessory_id: 31, store_id: 2, stock_in_id: 7, purchase_cost: '12.50', usage_type: 'sale',
        serial_tracking: serialTracking, quantity: state.quantity, batch_no: 'IN-7', supplier_id: 9, purchase_quantity: 10, purchase_status: 'completed' }
    },
    async adjustQuantity(id, storeId, delta) {
      if (failAt === 'balance') return false
      assert.equal(id, 31); assert.equal(storeId, 2); state.quantity += delta; return true
    },
    async append(data) { if (failAt === 'event') throw new Error('event failure'); state.events.push(data); return 111 },
    async appendAdjustmentRecord(data) { if (failAt === 'audit') throw new Error('audit failure'); state.records.push(data); return 112 }
  }
  const accessories = { accessoryRepository: {
    async getAccessoryById(id) { return id === 31 ? { id: 31, template_id: 3 } : null },
    async lockAccessory(id) { assert.equal(id, 3); return true },
    async lockStoreStock(id, storeId) { assert.equal(id, 31); assert.equal(storeId, 2); return { quantity: state.quantity } }
  } }
  return { service: new Service({ repository, accessoryService: accessories }), state }
}

const body = extra => ({ request_key: 'a'.repeat(32), row_key: 'event:91', expected_quantity: 4, counted_quantity: 6, reason: '盘点发现少件', ...extra })
const actor = { id: 7, name: '盘点员', store_ids: [2] }

test('普通数量批次按实物差额更新结存并追加原批次审计及stock_correct流水', async () => {
  const f = fixture()
  const result = await f.service.adjust(actor, 31, body())
  assert.deepEqual(result, { adjustment_id: 112, accessory_id: 31, store_id: 2, stock_in_id: 7,
    previous_quantity: 4, counted_quantity: 6, delta: 2, replayed: false })
  assert.equal(f.state.quantity, 6); assert.equal(f.state.commits, 1); assert.equal(f.state.rollbacks, 0)
  assert.deepEqual(f.state.events[0], { accessory_id: 31, store_id: 2, stock_in_id: 7, purchase_cost: '12.50',
    usage_type: 'sale', serial_tracking: 0, event_type: 'stock_correct', quantity_delta: 2, operator_id: 7, operator_name: '盘点员',
    remarks: '库存盘点：盘点发现少件', time: f.state.records[0].time })
  assert.deepEqual(f.state.records[0], { request_key: 'a'.repeat(32), request_hash: f.state.records[0].request_hash,
    accessory_id: 31, store_id: 2, stock_in_id: 7, previous_quantity: 4, counted_quantity: 6, quantity_delta: 2,
    inventory_event_id: 111, operator_id: 7, operator_name: '盘点员', remarks: '盘点发现少件', time: f.state.records[0].time })
})

test('允许盘点为零及向下调整，减少不能改写累计采购/销售流水', async () => {
  const f = fixture({ quantity: 4 })
  const result = await f.service.adjust(actor, 31, body({ counted_quantity: 0, reason: '实物已核实为零' }))
  assert.equal(result.delta, -4); assert.equal(f.state.quantity, 0)
  assert.equal(f.state.events[0].quantity_delta, -4)
})

test('相同库存只确认盘点数量，不制造零差异审计流水', async () => {
  const f = fixture({ quantity: 4 })
  const result = await f.service.adjust(actor, 31, body({ counted_quantity: 4 }))
  assert.equal(result.unchanged, true)
  assert.equal(result.delta, 0)
  assert.equal(result.adjustment_id, null)
  assert.equal(f.state.events.length, 0)
  assert.equal(f.state.records.length, 0)
  assert.equal(f.state.commits, 1)
})

test('幂等重试返回原盘点前后数量，且门店权限撤销后不泄露回执', async t => {
  const prior = { id: 112, request_hash: 'unused', accessory_id: 31, store_id: 2, stock_in_id: 7,
    previous_quantity: 4, counted_quantity: 6, quantity_delta: 2, operator_id: 7 }
  const hash = require('node:crypto').createHash('sha256').update(JSON.stringify([7, 31, 'event:91', 6, '盘点发现少件', 4])).digest('hex')
  const replay = fixture({ quantity: 6, replay: { ...prior, request_hash: hash } })
  const result = await replay.service.adjust(actor, 31, body())
  assert.deepEqual(result, { adjustment_id: 112, accessory_id: 31, store_id: 2, stock_in_id: 7,
    previous_quantity: 4, counted_quantity: 6, delta: 2, replayed: true })
  assert.equal(replay.state.events.length, 0)
  await t.test('撤销门店权限', async () => {
    const denied = fixture({ replay: { ...prior, request_hash: hash } })
    await assert.rejects(denied.service.adjust({ id: 7, store_ids: [1] }, 31, body()), /无权访问/)
    assert.equal(denied.state.rollbacks, 1)
  })
})

test('SN批次、门店越权、非法输入、缺结构或事务阶段失败均拒绝并回滚', async t => {
  const serials = fixture({ serialTracking: 1 })
  await assert.rejects(serials.service.adjust(actor, 31, body()), error => error.code === 'INVENTORY_ADJUSTMENT_SERIAL_REQUIRED')
  assert.equal(serials.state.rollbacks, 1)
  await t.test('越权门店', async () => {
    const f = fixture()
    await assert.rejects(f.service.adjust({ id: 7, store_ids: [1] }, 31, body()), /无权访问/)
    assert.equal(f.state.rollbacks, 1)
  })
  for (const counted_quantity of [-1, 1.5, 'abc', 1000000]) {
    const f = fixture()
    await assert.rejects(f.service.adjust(actor, 31, body({ counted_quantity })), error => error.code === 'VALIDATION_ERROR')
    assert.equal(f.state.commits, 0)
  }
  for (const failAt of ['ledger', 'balance', 'event', 'audit']) {
    const f = fixture({ failAt })
    await assert.rejects(f.service.adjust(actor, 31, body()))
    assert.equal(f.state.rollbacks, 1)
    assert.equal(f.state.commits, 0)
    assert.equal(f.state.quantity, 4)
    assert.deepEqual(f.state.events, [])
    assert.deepEqual(f.state.records, [])
  }
})

test('盘点期间发生出库或其他盘点时拒绝覆盖新结存', async () => {
  const f = fixture({ quantity: 3 })
  await assert.rejects(f.service.adjust(actor, 31, body()), { code: 'INVENTORY_ADJUSTMENT_STALE' })
  assert.equal(f.state.events.length, 0)
  assert.equal(f.state.records.length, 0)
  assert.equal(f.state.rollbacks, 1)
})
