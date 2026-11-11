'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const PriceListManagementService = require('../src/services/price-list-management.service')
const { migratePriceRuleSchema } = require('../src/utils/price-rule-schema')

function fixture({ missingItem = false, missingSource = false, updateFailure = false } = {}) {
  const calls = []
  const connection = {
    async beginTransaction() { calls.push('begin') },
    async commit() { calls.push('commit') },
    async rollback() { calls.push('rollback') },
    release() { calls.push('release') },
    async query(sql, params) {
      calls.push({ sql, params })
      if (sql.includes('FROM price_sync_config')) return [missingSource ? [] : [{ id: params[0] }]]
      if (sql.startsWith('SELECT')) return [missingItem ? [] : params.map(id => ({ id }))]
      if (updateFailure) throw new Error('update failed')
      return [{ affectedRows: params.length }]
    }
  }
  const service = new PriceListManagementService({ database: () => ({ getConnection: async () => connection }) })
  return { service, calls }
}

test('批量状态只更新选择的项目，价格、来源和其他状态保持原值', async () => {
  const { service, calls } = fixture()
  const result = await service.batchUpdatePriceItems({ price_list_ids: [9, 3, 9], changes: { status: 0 } })
  assert.deepEqual(result.data, { requested: 2, updated: 2 })
  const update = calls.find(call => call.sql?.startsWith('UPDATE'))
  assert.match(update.sql, /SET status = \?, updated_at = NOW\(\)/)
  assert.doesNotMatch(update.sql, /wholesale|source_config|is_collect|show_price/)
  assert.deepEqual(update.params, [0, 3, 9])
  assert.deepEqual(calls.filter(call => typeof call === 'string'), ['begin', 'commit', 'release'])
})

test('同一次事务设置采集源、三个状态与额外加价，不覆盖采集价格', async () => {
  const { service, calls } = fixture()
  await service.batchUpdatePriceItems({ price_list_ids: [3], changes: {
    source_config_id: 2, is_collect: 0, status: 1, show_price: 0,
    wholesale_rule: { mode: 'extra', adjustment: 20 }
  } })
  const update = calls.find(call => call.sql?.startsWith('UPDATE'))
  assert.deepEqual(update.params, [2, 0, 1, 0, 'extra', 20, 3])
  assert.doesNotMatch(update.sql, /wholesale_price\s*=/)
  assert.match(calls.find(call => call.sql?.includes('FROM price_list')).sql, /FOR UPDATE/)
})

for (const mode of ['inherit', 'original']) {
  test(`${mode} 清除旧的独立金额，重复设置不累加`, async () => {
    const { service, calls } = fixture()
    const payload = { price_list_ids: [3], changes: { wholesale_rule: { mode, adjustment: 50 } } }
    await service.batchUpdatePriceItems(payload)
    await service.batchUpdatePriceItems(payload)
    const updates = calls.filter(call => call.sql?.startsWith('UPDATE'))
    assert.deepEqual(updates.map(update => update.params), [[mode, 0, 3], [mode, 0, 3]])
  })
}

for (const failure of ['missingItem', 'missingSource', 'updateFailure']) {
  test(`批量 ${failure} 全部回滚并释放连接，不报告成功`, async () => {
    const { service, calls } = fixture({ [failure]: true })
    await assert.rejects(service.batchUpdatePriceItems({ price_list_ids: [3], changes: { source_config_id: 2, status: 0 } }))
    assert.deepEqual(calls.filter(call => typeof call === 'string'), ['begin', 'rollback', 'release'])
    if (failure !== 'updateFailure') assert.equal(calls.some(call => call.sql?.startsWith('UPDATE')), false)
  })
}

test('批量接口在获取连接前拒绝无效ID、过大批次、未选字段和非法规则', async () => {
  const { service, calls } = fixture()
  const invalid = [
    { price_list_ids: [], changes: { status: 1 } },
    ...[true, null, 0, -1, 1.5, '3 OR 1=1', Number.MAX_SAFE_INTEGER + 1].map(id => ({ price_list_ids: [id], changes: { status: 1 } })),
    { price_list_ids: Array(501).fill(1), changes: { status: 1 } },
    ...[{}, { status: '1' }, { show_price: null }, { wholesale_price: 1 }, { source_config_id: false }, { wholesale_rule: null },
      { wholesale_rule: { mode: 'unknown' } }, { wholesale_rule: { mode: 'extra' } },
      ...[NaN, Infinity, '20', 1000000, 1.234].map(adjustment => ({ wholesale_rule: { mode: 'adjustment', adjustment } }))
    ].map(changes => ({ price_list_ids: [3], changes }))
  ]
  for (const payload of invalid) await assert.rejects(service.batchUpdatePriceItems(payload), error => error.statusCode === 400)
  assert.deepEqual(calls, [])
})

test('旧采集源接口复用批量事务，null 恢复默认来源', async () => {
  const { service, calls } = fixture()
  await service.batchUpdatePriceSource({ price_list_ids: [3], source_config_id: null })
  assert.deepEqual(calls.find(call => call.sql?.startsWith('UPDATE')).params, [null, 3])
  await assert.rejects(service.batchUpdatePriceSource({ price_list_ids: [3] }), error => error.statusCode === 400)
})

test('报价规则迁移预览不写库，实施后回读且可重复执行', async () => {
  let migrated = false
  const writes = []
  const db = { async query(sql) {
    if (sql.startsWith('ALTER')) { writes.push(sql); migrated = true; return [{}] }
    return [[{ COLUMN_NAME: 'id' }, ...(migrated ? [
      { COLUMN_NAME: 'wholesale_rule_mode', COLUMN_TYPE: "enum('inherit','original','adjustment','extra')", IS_NULLABLE: 'NO', COLUMN_DEFAULT: 'inherit' },
      { COLUMN_NAME: 'wholesale_rule_adjustment', COLUMN_TYPE: 'decimal(12,2)', IS_NULLABLE: 'NO', COLUMN_DEFAULT: '0.00' }
    ] : [])]]
  } }
  assert.equal((await migratePriceRuleSchema(db)).status, 'dry_run')
  assert.equal(writes.length, 0)
  assert.equal((await migratePriceRuleSchema(db, { apply: true })).status, 'migrated_and_verified')
  assert.equal((await migratePriceRuleSchema(db, { apply: true })).status, 'already_ready')
  assert.equal(writes.length, 1)
})

test('报价规则迁移拒绝覆盖已有不兼容字段', async () => {
  const db = { query: async () => [[{ COLUMN_NAME: 'id' }, { COLUMN_NAME: 'wholesale_rule_mode', COLUMN_TYPE: 'varchar(30)' }]] }
  await assert.rejects(migratePriceRuleSchema(db, { apply: true }), /结构不一致/)
})

test('报价规则迁移只扩展已知的三模式枚举，不重建字段或重置记录', async () => {
  let extended = false
  const writes = []
  const db = { async query(sql) {
    if (sql.startsWith('ALTER')) { writes.push(sql); extended = true; return [{}] }
    return [[{ COLUMN_NAME: 'id' },
      { COLUMN_NAME: 'wholesale_rule_mode', COLUMN_TYPE: extended ? "enum('inherit','original','adjustment','extra')" : "enum('inherit','original','adjustment')", IS_NULLABLE: 'NO', COLUMN_DEFAULT: 'inherit' },
      { COLUMN_NAME: 'wholesale_rule_adjustment', COLUMN_TYPE: 'decimal(12,2)', IS_NULLABLE: 'NO', COLUMN_DEFAULT: '0.00' }
    ]]
  } }
  assert.deepEqual((await migratePriceRuleSchema(db)).pending, [{ column: 'wholesale_rule_mode', operation: 'extend_enum' }])
  assert.equal(writes.length, 0)
  await migratePriceRuleSchema(db, { apply: true })
  assert.equal(writes.length, 1)
  assert.match(writes[0], /MODIFY COLUMN wholesale_rule_mode ENUM/)
  assert.doesNotMatch(writes[0], /ADD|DROP|UPDATE|DELETE/)
  assert.equal((await migratePriceRuleSchema(db)).status, 'already_ready')
})
