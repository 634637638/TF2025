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
