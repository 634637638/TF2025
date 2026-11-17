'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const Service = require('../src/services/query-goods.service')
const Repository = require('../src/repositories/query-goods.repository')
const { allocateAftersaleSettlement } = require('../src/utils/sales-aftersale-settlement')

const actor = { id: 7, store_ids: [1] }
const sale = { id: 51, name: '充电器', quantity: 1, sale_type: 'sale', total_price: 20 }

/** 以首次普通SELECT固定版本模拟RR，外部提交不受只读事务阻塞。 */
function fixture({ state = {}, read, afterRead, failAt } = {}) {
  const events = [], reads = []
  let active = false, configured = false, snapshot, leases = 0
  const connection = {
    async execute(sql) {
      events.push('configure')
      assert.equal(sql, 'SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY')
      if (failAt === 'configure') throw new Error('configure-failed')
      configured = true
      return []
    },
    async beginTransaction() {
      events.push('begin')
      assert.equal(configured, true)
      if (failAt === 'begin') throw new Error('begin-failed')
      configured = false; active = true; snapshot = undefined
    },
    async query(sql, params) {
      assert.equal(active, true, '所有业务读取须处于同一活动快照')
      assert.match(sql, /^SELECT /)
      assert.doesNotMatch(sql, /FOR UPDATE|LOCK IN SHARE MODE/)
      snapshot ??= structuredClone(state)
      reads.push({ sql, params })
      events.push('read')
      if (failAt === `read:${reads.length}`) throw new Error('read-failed')
      const result = await read(sql, params, snapshot, connection)
      await afterRead?.(sql, state)
      return [result]
    },
    async rollback() {
      events.push('rollback')
      if (failAt === 'rollback') throw new Error('rollback-failed')
      active = false; snapshot = undefined
    },
    destroy() { events.push('destroy'); active = false; configured = false; snapshot = undefined },
    release() { events.push('release'); assert.equal(active, false) }
  }
  const repository = new Repository({ database: () => ({ async getConnection() { leases++; events.push('acquire'); return connection } }) })
  const service = new Service({ repository, permissionCheck: async () => true })
  return { service, repository, connection, events, reads, state, get leases() { return leases } }
}

test('商品列表COUNT后发生新销售，当前页仍读原快照，下次查询才见新销售', async () => {
  const f = fixture({ state: { sales: [sale] },
    read: (sql, _params, state) => sql.startsWith('SELECT COUNT') ? [{ total: state.sales.length }] : state.sales,
    afterRead(sql, state) { if (sql.startsWith('SELECT COUNT') && state.sales.length === 1) state.sales.push({ ...sale, id: 52 }) }
  })
  const first = await f.service.list(actor, {}, [])
  assert.equal(f.state.sales.length, 2, '外部销售可以提交')
  assert.equal(first.pagination.total, 1); assert.deepEqual(first.data.map(row => row.id), [51])
  const next = await f.service.list(actor, {}, [])
  assert.equal(next.pagination.total, 2); assert.equal(next.data.length, 2)
  assert.equal(f.leases, 2, '每次查询仅租借一个连接')
  assert.deepEqual(f.events, Array(2).fill(['acquire', 'configure', 'begin', 'read', 'read', 'rollback', 'release']).flat())
})

test('原销售详情、SN和采购来源同一快照，查询中来源变化不混入已读单据', async () => {
  const f = fixture({ state: { serials: [{ serial_number: '000SN1' }], batches: [{ supplier_name: '原采购商', quantity: 1 }] },
    read(sql, _params, state) {
      if (sql.includes('FROM accessory_sales')) return [sale]
      return sql.includes('FROM accessory_serial_events') ? state.serials : state.batches
    },
    afterRead(sql, state) {
      if (sql.includes('FROM accessory_sales')) { state.serials = []; state.batches = [] }
    }
  })
  const result = await f.service.detail(actor, 51)
  assert.deepEqual(result.serial_numbers, ['000SN1'])
  assert.equal(result.batches[0].supplier_name, '原采购商')
  assert.equal(f.leases, 1)
  assert.deepEqual(f.events, ['acquire', 'configure', 'begin', 'read', 'read', 'read', 'rollback', 'release'])
})

test('客户定向历史COUNT与成交行共用快照，新增购买在下一次读取才出现', async () => {
  const f = fixture({ state: { sales: [sale] },
    read: (sql, params, state) => {
      assert.match(sql, /s\.customer_id = \?/)
      assert.deepEqual(params.slice(0, 2), [1, 8])
      return sql.startsWith('SELECT COUNT') ? [{ total: state.sales.length }] : state.sales
    },
    afterRead(sql, state) { if (sql.startsWith('SELECT COUNT') && state.sales.length === 1) state.sales.push({ ...sale, id: 52 }) }
  })
  const first = await f.service.customerHistory(actor, 8)
  assert.equal(first.pagination.total, 1); assert.deepEqual(first.data.map(row => row.id), [51])
  const next = await f.service.customerHistory(actor, 8)
  assert.equal(next.pagination.total, 2); assert.deepEqual(next.data.map(row => row.id), [51, 52])
  assert.equal(f.leases, 2)
  assert.deepEqual(f.events, Array(2).fill(['acquire', 'configure', 'begin', 'read', 'read', 'rollback', 'release']).flat())
})

test('手机随单购买/赠品及原SN同一快照，重读在新事务读取新版本', async () => {
  const f = fixture({ state: { serials: [{ sale_id: 51, serial_number: '000SN1' }] },
    read: (sql, _params, state) => sql.includes('FROM accessory_sales') ? [{ ...sale, receipt_snapshot: { sale_type: 'sale' } },
      { ...sale, id: 52, sale_type: 'gift', total_price: 0, receipt_snapshot: { sale_type: 'gift' } }] : state.serials,
    afterRead(sql, state) { if (sql.includes('FROM accessory_sales')) state.serials.push({ sale_id: 52, serial_number: '000GIFT' }) }
  })
  const rows = await f.service.phoneReceipt(actor, 81)
  assert.deepEqual(rows.map(row => row.serial_numbers), [['000SN1'], []])
  assert.deepEqual(rows.map(row => row.sale_type), ['sale', 'gift'])
  assert.deepEqual((await f.service.phoneReceipt(actor, 81))[1].serial_numbers, ['000GIFT'])
  assert.equal(f.leases, 2)
})

function exchange() {
  const allocation = allocateAftersaleSettlement([{ original_item_id: 61, base_refund_cents: 2000, recovery_cents: 0,
    compensation_cents: 0, gift_charge_cents: 0, replacement_cents: 5000, points_delta: 0 }], { version: 3 })
  const fact = { kind: 'return', payable_cents: 2000, serial_numbers: ['000OLD'], points_awarded: 0, points_used: 0,
    return_reason: '客户换货', restock_confirmed: true, settlement: allocation.items[0].settlement,
    exchange: { replacement_order_id: 72, replacement_item_id: 62, root_order_id: 71, root_item_id: 61, replacement_cents: 5000, quantity: 1 } }
  return {
    header: { id: 31, order_id: 71, operation_type: 'goods_exchange', aftersale_item_id: 41, original_item_id: 61,
      customer_id: 9, original_store_id: 1, store_id: 1, settlement_method: 'cash', settlement_channel: null, ...allocation.totals },
    item: { id: 41, aftersale_id: 31, original_item_id: 61, item_order_id: 71, item_type: 'accessory', quantity: 1, fact_snapshot: fact },
    link: { aftersale_id: 31, original_item_id: 61, order_id: 71, replacement_order_id: 72, quantity: 1, exchange_credit_cents: 2000 },
    original: { id: 71, store_id: 1, customer_id: 9 },
    loaded: { order: { id: 72, order_no: 'NEW-ORDER', customer_id: 9, store_id: 1 },
      row: { sale_no: 'NEW-SALE', sale_operator_name: '新销售员' },
      plan: { item: { name: '新充电器', serial_numbers: ['000NEW'] } }, lineage: { root_order_id: 71, root_item_id: 61 } }
  }
}

test('售后原单、COUNT、头行、换货关系及祖先核验共用同一连接快照', async () => {
  const original = exchange()
  const f = fixture({ state: { ...original, headers: [original.header] },
    read(sql, _params, state) {
      if (sql === 'SELECT replacement') return [state.loaded]
      if (sql === 'SELECT exchange-link') return [state.link]
      if (sql === 'SELECT root-order') return [state.original]
      if (sql.includes('FROM accessory_sales')) return [{ id: 51, item_id: 61, order_id: 71, store_id: 1 }]
      if (sql.startsWith('SELECT COUNT')) return [{ total: state.headers.length }]
      if (sql.includes('WHERE ai.aftersale_id IN')) return [state.item]
      return state.headers
    },
    afterRead(sql, state) {
      if (sql.startsWith('SELECT COUNT')) state.headers.push({ ...state.header, id: 32 })
    }
  })
  const read = async (connection, sql) => {
    assert.equal(connection, f.connection)
    const [rows] = await connection.query(sql)
    return rows[0]
  }
  f.service.goodsReturns = {
    async load(connection, _input, _actor, options) { assert.equal(options.lock, false); return read(connection, 'SELECT replacement') },
    repository: {
      async exchangeForItem(connection, _id, options) { assert.equal(options.lock, false); return read(connection, 'SELECT exchange-link') },
      async order(connection, _id, options) { assert.equal(options.lock, false); return read(connection, 'SELECT root-order') }
    }
  }
  const result = await f.service.aftersales(actor, 51)
  assert.equal(f.state.headers.length, 2)
  assert.equal(result.pagination.total, 1); assert.equal(result.data.length, 1)
  assert.equal(result.data[0].exchange_credit_amount, 20)
  assert.equal(result.data[0].collection_amount, 30)
  assert.deepEqual(result.data[0].replacement.serial_numbers, ['000NEW'])
  assert.equal(f.leases, 1)
  assert.equal(f.reads.length, 7)
  assert.deepEqual(f.events.slice(-2), ['rollback', 'release'])
})

test('无原销售或无共同明细的旧单仍结束快照，不读取额外售后表', async () => {
  for (const source of [[], [{ id: 51, item_id: null }]]) {
    const f = fixture({ read: () => source })
    if (!source.length) await assert.rejects(f.service.aftersales(actor, 51), { statusCode: 404 })
    else assert.equal((await f.service.aftersales(actor, 51)).pagination.total, 0)
    assert.equal(f.reads.length, 1)
    assert.deepEqual(f.events.slice(-2), ['rollback', 'release'])
  }
})

for (const phase of ['configure', 'begin', 'read:1', 'read:2', 'rollback']) {
  test(`商品查询在${phase}失败时不返回半份结果，释放或销毁连接`, async () => {
    const f = fixture({ failAt: phase, read: sql => sql.startsWith('SELECT COUNT') ? [{ total: 1 }] : [sale] })
    await assert.rejects(f.service.list(actor, {}, []), /failed/)
    assert.equal(f.leases, 1)
    assert.equal(f.events.filter(value => value === 'release').length, 1)
    assert.equal(f.events.includes('destroy'), ['configure', 'begin', 'rollback'].includes(phase))
    assert.equal(f.events.includes('rollback'), !['configure', 'begin'].includes(phase))
  })
}

test('缺权限、越权门店和非法输入均在租借连接前拒绝', async () => {
  const f = fixture({ read: () => assert.fail('不得读取') })
  await assert.rejects(f.service.list(actor, { store_id: 2 }, []), { statusCode: 403 })
  await assert.rejects(f.service.detail(actor, false), { statusCode: 400 })
  f.service.permissionCheck = async () => false
  for (const operation of [() => f.service.list(actor, {}, []), () => f.service.detail(actor, 51),
    () => f.service.phoneReceipt(actor, 81), () => f.service.aftersales(actor, 51)]) await assert.rejects(operation(), { statusCode: 403 })
  assert.equal(f.leases, 0)
})
