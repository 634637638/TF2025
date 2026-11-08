'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const log = require('../src/utils/log')
const QueryRepository = require('../src/repositories/query.repository')

log.debug = () => {}
log.error = () => {}

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
    repository.returnToStock(12, 7, {}, { storeIds: [3] }),
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

  const result = await repository.deletePhoneRecord(12, { storeIds: [3] })
  assert.equal(result.success, true)
  assert.deepEqual(events.filter(value => typeof value === 'string'), [
    'acquire', 'begin', 'commit', 'release'
  ])
})
