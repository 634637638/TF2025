'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const Service = require('../src/services/accessory-purchase.service')
const Repository = require('../src/repositories/accessory-purchase.repository')

const actor = { id: 7, store_ids: [1, 2] }

/** 首次普通读取固定RR版本，外部追加不阻塞当前只读请求。 */
function fixture({ failAt, appendAfterCount = false } = {}) {
  const state = { purchase: { id: 8, store_id: 1 }, payments: [{ id: 1, stock_in_id: 8, operator_id: 7, reference_event_id: null }] }
  const events = [], reads = []
  let active = false, snapshot, leases = 0
  const connection = {
    async execute(sql) {
      events.push('configure')
      assert.equal(sql, 'SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY')
      if (failAt === 'configure') throw new Error('configure-failed')
    },
    async beginTransaction() {
      events.push('begin')
      if (failAt === 'begin') throw new Error('begin-failed')
      active = true; snapshot = undefined
    },
    async query(sql, params) {
      assert.equal(active, true)
      assert.doesNotMatch(sql, /FOR UPDATE|INSERT|DELETE|UPDATE |request_key|request_hash/)
      snapshot ??= structuredClone(state)
      reads.push({ sql, params }); events.push('read')
      if (failAt === `read:${reads.length}`) throw new Error('read-failed')
      if (sql.includes('FROM accessory_stock_in')) return [params.includes(snapshot.purchase.store_id) ? [snapshot.purchase] : []]
      assert.equal(params[0], 8)
      if (sql.includes('COUNT(*)')) {
        if (appendAfterCount && state.payments.length === 1) state.payments.push({ ...state.payments[0], id: 2 })
        return [[{ total: snapshot.payments.length }]]
      }
      const [, size, offset] = params
      return [snapshot.payments.toSorted((a, b) => b.id - a.id).slice(offset, offset + size)]
    },
    async rollback() {
      events.push('rollback')
      if (failAt === 'rollback') throw new Error('rollback-failed')
      active = false; snapshot = undefined
    },
    destroy() { events.push('destroy'); active = false; snapshot = undefined },
    release() { events.push('release'); assert.equal(active, false) }
  }
  const repository = new Repository()
  repository.getConnection = () => ({ async getConnection() { leases++; events.push('acquire'); return connection } })
  const service = new Service({ repository })
  return { service, state, events, reads, get leases() { return leases } }
}

test('付款历史授权原单、COUNT及分页行共用只读快照，并发追加下次读取才出现', async () => {
  const f = fixture({ appendAfterCount: true })
  const first = await f.service.history(actor, 8)
  assert.equal(f.state.payments.length, 2)
  assert.equal(first.pagination.total, 1)
  assert.deepEqual(first.rows.map(row => row.id), [1])
  const second = await f.service.history(actor, 8)
  assert.equal(second.pagination.total, 2)
  assert.deepEqual(second.rows.map(row => row.id), [2, 1])
  assert.equal(f.leases, 2)
  assert.deepEqual(f.events, Array(2).fill(['acquire', 'configure', 'begin', 'read', 'read', 'read', 'rollback', 'release']).flat())
})

test('付款历史分页参数绑定原单ID与偏移，不返回内部请求凭据；越店原单在读取历史前拒绝', async () => {
  const f = fixture()
  f.state.payments.push({ ...f.state.payments[0], id: 2 })
  const result = await f.service.history(actor, 8, { page: '2', page_size: '1' })
  assert.deepEqual(f.reads[2].params, [8, 1, 1])
  assert.deepEqual(result.rows.map(row => row.id), [1])
  assert.deepEqual(result.pagination, { page: 2, page_size: 1, total: 2, total_pages: 2 })
  f.state.purchase.store_id = 99
  await assert.rejects(f.service.history(actor, 8), { statusCode: 404 })
  assert.equal(f.reads.length, 4, '第二次请求只核对原单，不读取越店付款记录')
  assert.deepEqual(f.events.slice(-2), ['rollback', 'release'])
})

for (const failAt of ['configure', 'begin', 'read:1', 'read:2', 'read:3', 'rollback']) {
  test(`付款历史${failAt}失败拒绝返回半份单据并清理连接`, async () => {
    const f = fixture({ failAt })
    await assert.rejects(f.service.history(actor, 8), new RegExp(`${failAt.startsWith('read:') ? 'read' : failAt}-failed`))
    assert.equal(f.leases, 1)
    assert.equal(f.events.at(-1), 'release')
    assert.equal(f.events.includes('destroy'), ['configure', 'begin', 'rollback'].includes(failAt))
    assert.equal(f.events.includes('rollback'), !['configure', 'begin'].includes(failAt))
  })
}

test('付款历史非法分页在租借连接前拒绝', async () => {
  const f = fixture()
  for (const query of [{ page: 0 }, { page: true }, { page_size: 101 }, { page_size: [] }]) {
    await assert.rejects(f.service.history(actor, 8, query), { statusCode: 400 })
  }
  assert.equal(f.leases, 0)
})

/** 模拟默认读已提交连接；只有显式设置RR后，跨语句读取才固定版本。 */
function listFixture({ failAt, appendAfterCount = false } = {}) {
  const state = { rows: [{ id: '8', accessory_id: '3', supplier_id: '4', store_id: '1',
    name: '充电器', product_snapshot: null, quantity: 2, total_amount: 50,
    payment_status: 'unpaid', latest_event_id: '0' }] }
  const events = [], reads = []
  let active = false, repeatable = false, snapshot, leases = 0
  const connection = {
    async execute(sql) {
      events.push('configure')
      assert.equal(sql, 'SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY')
      if (failAt === 'configure') throw new Error('configure-failed')
      repeatable = true
    },
    async beginTransaction() {
      events.push('begin')
      if (failAt === 'begin') throw new Error('begin-failed')
      active = true
    },
    async query(sql, params) {
      assert.equal(active, true)
      assert.doesNotMatch(sql, /FOR UPDATE|INSERT|DELETE|UPDATE |request_key|request_hash/)
      snapshot ??= structuredClone(state)
      const current = repeatable ? snapshot : structuredClone(state)
      reads.push({ sql, params }); events.push('read')
      if (failAt === `read:${reads.length}`) throw new Error('read-failed')
      if (sql.includes('COUNT(*)')) {
        const summary = { total: String(current.rows.length), total_quantity: 0, total_amount: 0, paid_amount: 0, unpaid_amount: 0 }
        for (const row of current.rows) {
          summary.total_quantity += row.quantity
          summary.total_amount += row.total_amount
          summary[row.payment_status === 'paid' ? 'paid_amount' : 'unpaid_amount'] += row.total_amount
        }
        if (appendAfterCount && state.rows.length === 1) {
          state.rows[0].payment_status = 'paid'; state.rows[0].latest_event_id = '1'
          state.rows.push({ ...state.rows[0], id: '9', quantity: 3, total_amount: 75, payment_status: 'unpaid', latest_event_id: '0' })
        }
        return [[summary]]
      }
      const [size, offset] = params.slice(-2)
      return [current.rows.toReversed().slice(offset, offset + size)]
    },
    async commit() { events.push('commit'); active = false; snapshot = undefined; repeatable = false },
    async rollback() {
      events.push('rollback')
      if (failAt === 'rollback') throw new Error('rollback-failed')
      active = false; snapshot = undefined; repeatable = false
    },
    destroy() { events.push('destroy'); active = false; snapshot = undefined; repeatable = false },
    release() { events.push('release'); assert.equal(active, false) }
  }
  const repository = new Repository()
  repository.getConnection = () => ({ async getConnection() { leases++; events.push('acquire'); return connection } })
  return { service: new Service({ repository }), state, reads, events, get leases() { return leases } }
}

test('采购列表汇总、付款状态和分页共用快照，并发付款及新增采购在下一次请求可见', async () => {
  const f = listFixture({ appendAfterCount: true })
  const first = await f.service.list(actor)
  assert.equal(f.state.rows.length, 2)
  assert.deepEqual(first.summary, { total: 1, total_quantity: 2, total_amount: 50, paid_amount: 0, unpaid_amount: 50 })
  assert.deepEqual(first.rows.map(row => [row.id, row.payment_status, row.latest_event_id]), [[8, 'unpaid', 0]])
  assert.deepEqual(first.pagination, { page: 1, page_size: 20, total: 1, total_pages: 1 })
  const second = await f.service.list(actor)
  assert.deepEqual(second.summary, { total: 2, total_quantity: 5, total_amount: 125, paid_amount: 50, unpaid_amount: 75 })
  assert.deepEqual(second.rows.map(row => [row.id, row.payment_status, row.latest_event_id]), [[9, 'unpaid', 0], [8, 'paid', 1]])
  assert.equal(f.leases, 2)
  assert.deepEqual(f.events, Array(2).fill(['acquire', 'configure', 'begin', 'read', 'read', 'rollback', 'release']).flat())
})

test('采购列表分页、筛选和整单门店范围绑定同一连接，不暴露原JSON', async () => {
  const f = listFixture()
  const result = await f.service.list(actor, { page: '2', page_size: '1', supplier_id: '4', store_id: '1', product_name: ' 原充电器 ', brand_name: ' 原品牌 ', keyword: ' 充电器 ' })
  assert.deepEqual(result.rows, [])
  assert.deepEqual(f.reads[1].params, [...f.reads[0].params, 1, 1])
  assert.ok(f.reads[0].params.includes('%充电器%'))
  assert.ok(f.reads[0].params.includes('%原充电器%'))
  assert.ok(f.reads[0].params.includes('%原品牌%'))
  assert.match(f.reads[0].sql, /JSON_CONTAINS/)
  const first = await f.service.list(actor)
  assert.equal(first.rows[0].accessory_id, 3)
  assert.equal(first.rows[0].has_snapshot, false)
  assert.equal(Object.hasOwn(first.rows[0], 'product_snapshot'), false)
})

for (const failAt of ['configure', 'begin', 'read:1', 'read:2', 'rollback']) {
  test(`采购列表${failAt}失败不返回部分汇总并清理连接`, async () => {
    const f = listFixture({ failAt })
    await assert.rejects(f.service.list(actor), new RegExp(`${failAt.startsWith('read:') ? 'read' : failAt}-failed`))
    assert.equal(f.leases, 1)
    assert.equal(f.events.at(-1), 'release')
    assert.equal(f.events.includes('destroy'), ['configure', 'begin', 'rollback'].includes(failAt))
    assert.equal(f.events.includes('rollback'), !['configure', 'begin'].includes(failAt))
    assert.equal(f.events.includes('commit'), false)
  })
}

test('采购列表原资料投影异常仍结束只读事务，不返回坏快照', async () => {
  const f = listFixture()
  f.state.rows[0].product_snapshot = '{'
  await assert.rejects(f.service.list(actor), { code: 'PURCHASE_SNAPSHOT_CONFLICT' })
  assert.deepEqual(f.events.slice(-2), ['rollback', 'release'])
  assert.equal(f.events.includes('commit'), false)
})

test('采购列表无效参数或越店请求在租借连接前拒绝', async () => {
  const f = listFixture()
  for (const query of [{ page: 0 }, { page_size: true }, { supplier_id: [] }, { payment_status: 'bad' }]) {
    await assert.rejects(f.service.list(actor, query), { statusCode: 400 })
  }
  await assert.rejects(f.service.list(actor, { store_id: 99 }), { statusCode: 403 })
  assert.equal(f.leases, 0)
})
