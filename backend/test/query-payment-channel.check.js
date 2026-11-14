'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const QueryRepository = require('../src/repositories/query.repository')
const { clearSchemaInspectorCache } = require('../src/utils/schema-inspector')

test('综合查询回读支付渠道只允许精确销售及客户关联，不能拿手机ID碰撞回读', async t => {
  clearSchemaInspectorCache()
  t.after(clearSchemaInspectorCache)
  let detailSql
  const repository = new QueryRepository()
  repository.getConnection = () => ({
    execute: async () => [[{ exists: 1 }]],
    query: async sql => {
      if (sql.includes('COUNT(DISTINCT p.id)')) return [[{ total: 1 }]]
      if (sql.includes('SELECT DISTINCT p.id')) return [[{ id: 12 }]]
      detailSql = sql
      return [[{ id: 12, payment_channel: null }]]
    }
  })
  const result = await repository.getComprehensivePhoneQuery({ phone_id: 12 })
  assert.equal(result.pagination.total, 1)
  assert.match(detailSql, /pr\.order_id = latest_sale\.id AND pr\.customer_id = latest_sale\.customer_id/)
  assert.doesNotMatch(detailSql, /pr\.order_id IN|pr\.order_id = p\.id/)
})
