'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const log = require('../src/utils/log')
const QueryRepository = require('../src/repositories/query.repository')
const QueryMutationService = require('../src/services/query-mutation.service')

log.debug = () => {}
log.error = () => {}

const returnDetails = {
  return_reason: '客户退货', return_type: '退货处理', handle_method: '重新入库',
  refund_amount: 0, refund_method: '原路退回', reversal_date: '2026-11-08T10:20', remarks: '退货'
}

const createRepository = (execute, events) => {
  const repository = new QueryRepository()
  repository.getConnection = () => ({
    async getConnection() {
      events.push('acquire')
      return {
        async execute(sql, params) {
          events.push(['execute', sql, params])
          return execute(sql, params)
        },
        async beginTransaction() { events.push('begin') },
        async commit() { events.push('commit') },
        async rollback() { events.push('rollback') },
        release() { events.push('release') }
      }
    }
  })
  return repository
}

test('退库业务异常会回滚并由共享连接 helper 释放一次', async () => {
  const events = []
  const repository = createRepository(sql => {
    if (sql.includes('SELECT status, store_id')) return [[{ status: 'sold', store_id: 3 }]]
    if (sql.includes('FROM sales s')) return [[]]
    throw new Error(`unexpected SQL: ${sql}`)
  }, events)

  await assert.rejects(
    new QueryMutationService({ repository }).returnToStock(12, 7, returnDetails, { storeIds: [3] }),
    /未找到相关销售记录/
  )
  assert.deepEqual(events.filter(value => typeof value === 'string'), [
    'acquire', 'begin', 'rollback', 'release'
  ])
})

test('删除手机在单一事务内提交，helper 在提交后释放连接', async () => {
  const events = []
  const repository = createRepository(sql => {
    if (sql.includes('SELECT store_id FROM phones')) return [[{ store_id: 3 }]]
    if (sql.includes('SELECT id FROM sales WHERE phone_id')) return [[]]
    if (sql.includes('DELETE FROM phones')) return [{ affectedRows: 1 }]
    return [{ affectedRows: 0 }]
  }, events)

  const result = await new QueryMutationService({ repository }).deletePhoneRecord(12, { storeIds: [3] })
  assert.equal(result.success, true)
  assert.deepEqual(events.filter(value => typeof value === 'string'), [
    'acquire', 'begin', 'commit', 'release'
  ])
})

test('退库在同一连接冲回积分、删除销售、条件恢复库存后才提交', async () => {
  const events = []
  const repository = createRepository((sql, params) => {
    if (sql.includes('SELECT status, store_id')) return [[{ status: 'sold', store_id: 3 }]]
    if (sql.includes('FROM sales s')) return [[{ id: 21, customer_id: 8, operator_id: 5, sale_operator_name: '销售员' }]]
    if (sql.includes('INSERT INTO sale_reversal_logs')) {
      assert.deepEqual(params.slice(0, 14), [12, 21, 'sold', 8, 5, '销售员', 7, '2026-11-08 10:20:00', '退货', '客户退货', '退货处理', '重新入库', 0, '原路退回'])
      assert.equal(params[14], null)
      assert.match(params[15], /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)
    }
    return [{ affectedRows: 1 }]
  }, events)
  const service = new QueryMutationService({ repository, reversePoints: async ({ executor, saleId }) => {
    assert.equal(typeof executor.execute, 'function')
    assert.equal(saleId, 21)
    events.push('reverse-points')
  } })
  const result = await service.returnToStock(12, 7, returnDetails, { storeIds: [3] })
  assert.equal(result.success, true)
  assert.deepEqual(events.filter(value => typeof value === 'string'), ['acquire', 'begin', 'reverse-points', 'commit', 'release'])
  const reverseIndex = events.indexOf('reverse-points')
  assert.ok(events.findIndex(value => Array.isArray(value) && value[1].startsWith('DELETE FROM sales')) > reverseIndex)
})

test('退库门店越权和条件更新冲突都回滚，不提交', async () => {
  for (const scenario of ['scope', 'conflict']) {
    const events = []
    const repository = createRepository(sql => {
      if (sql.includes('SELECT status, store_id')) return [[{ status: 'sold', store_id: 3 }]]
      if (sql.includes('FROM sales s')) return [[{ id: 21 }]]
      return [{ affectedRows: 0 }]
    }, events)
    let reversals = 0
    const service = new QueryMutationService({ repository, reversePoints: async () => { reversals++ } })
    await assert.rejects(service.returnToStock(12, 7, returnDetails, { storeIds: scenario === 'scope' ? [4] : [3] }), scenario === 'scope' ? /无权/ : /销售记录状态已变化/)
    assert.equal(reversals, scenario === 'scope' ? 0 : 1)
    assert.deepEqual(events.filter(value => typeof value === 'string'), ['acquire', 'begin', 'rollback', 'release'])
  }
})

test('删除手机逐条冲回积分，积分异常时不删除并回滚释放', async () => {
  const events = []
  const repository = createRepository(sql => {
    if (sql.includes('SELECT store_id FROM phones')) return [[{ store_id: 3 }]]
    if (sql.includes('SELECT id FROM sales WHERE phone_id')) return [[{ id: 21 }, { id: 22 }]]
    throw new Error('不应执行删除')
  }, events)
  const reversed = []
  const service = new QueryMutationService({ repository, reversePoints: async ({ saleId }) => {
    reversed.push(saleId)
    if (saleId === 22) throw new Error('积分冲回失败')
  } })
  await assert.rejects(service.deletePhoneRecord(12, { storeIds: [3] }), /积分冲回失败/)
  assert.deepEqual(reversed, [21, 22])
  assert.deepEqual(events.filter(value => typeof value === 'string'), ['acquire', 'begin', 'rollback', 'release'])
})
