'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const { migrate, parseArgs, legacyIndex, targetIndex } = require('../scripts/migrate-film-order-phone-index')

function fixture() {
  const state = { index: legacyIndex, rows: [{ id: 1, order_id: 10, phone_id: null, quantity: 2 }], writes: [], fail: false }
  const db = { async query(sql) {
    if (sql.includes('information_schema.TABLES')) return [[{ TABLE_NAME: 'customer_film_services', ENGINE: 'InnoDB' }]]
    if (sql.includes('information_schema.COLUMNS')) return [[{ COLUMN_NAME: 'order_id', IS_NULLABLE: 'NO' }, { COLUMN_NAME: 'phone_id', IS_NULLABLE: 'YES' }]]
    if (sql.includes('information_schema.STATISTICS')) return [[...(state.index === legacyIndex
      ? [{ INDEX_NAME: legacyIndex, COLUMN_NAME: 'order_id', SEQ_IN_INDEX: 1, NON_UNIQUE: 0, SUB_PART: null }]
      : [{ INDEX_NAME: targetIndex, COLUMN_NAME: 'order_id', SEQ_IN_INDEX: 1, NON_UNIQUE: 0, SUB_PART: null },
        { INDEX_NAME: targetIndex, COLUMN_NAME: 'phone_id', SEQ_IN_INDEX: 2, NON_UNIQUE: 0, SUB_PART: null }])]]
    if (sql.includes('GROUP BY order_id, phone_id')) return [state.duplicatePairs || []]
    if (sql.includes('GROUP BY order_id HAVING')) return [state.duplicateOrders || []]
    if (sql.startsWith('SHOW CREATE TABLE')) return [[{ 'Create Table': `CREATE TABLE ${state.index}` }]]
    if (sql === 'SELECT * FROM customer_film_services ORDER BY id') return [structuredClone(state.rows)]
    if (sql.startsWith('ALTER TABLE')) {
      if (state.fail) throw new Error('ddl-failed')
      state.index = sql.includes(`ADD UNIQUE KEY ${legacyIndex} (`) ? legacyIndex : targetIndex
      state.writes.push(sql)
      return [{}]
    }
    assert.fail(`未声明SQL: ${sql}`)
  } }
  return { state, db }
}

async function backupPath(t) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'tf-film-index-'))
  t.after(() => fs.rm(directory, { recursive: true, force: true }))
  return path.join(directory, 'before.json')
}

test('默认预览只更换唯一索引，执行前创建独占备份并回读原记录', async t => {
  const f = fixture(), file = await backupPath(t)
  const preview = await migrate(f.db)
  assert.equal(preview.status, 'dry_run')
  assert.equal(preview.writes, false)
  assert.equal(preview.sql.length, 1)
  await assert.rejects(migrate(f.db, { apply: true }), /backup-file/)
  const result = await migrate(f.db, { apply: true, backupFile: file })
  assert.equal(result.originalDataUnchanged, true)
  assert.equal(f.state.index, targetIndex)
  assert.equal(f.state.rows.length, 1)
  assert.equal((await fs.stat(file)).mode & 0o777, 0o600)
  assert.deepEqual(await migrate(f.db), { status: 'already_ready', writes: false })
})

test('重复事实、结构冲突及一单多台回退均拒绝写入', async () => {
  const duplicate = fixture(); duplicate.state.duplicatePairs = [{ order_id: 10, phone_id: null, count: 2 }]
  await assert.rejects(migrate(duplicate.db), /重复订单手机/)
  assert.deepEqual(duplicate.state.writes, [])
  const multiple = fixture(); multiple.state.index = targetIndex
  multiple.state.duplicateOrders = [{ order_id: 10, count: 2 }]
  await assert.rejects(migrate(multiple.db, { rollback: true }), /多台手机/)
  assert.deepEqual(multiple.state.writes, [])
  for (const args of [['--apply=true'], ['--apply', '--apply'], ['--backup-file='], ['--other']]) assert.throws(() => parseArgs(args), /参数无效/)
})

test('迁移中DDL失败保留原索引及备份用于核对', async t => {
  const f = fixture(), file = await backupPath(t)
  f.state.fail = true
  await assert.rejects(migrate(f.db, { apply: true, backupFile: file }), /ddl-failed/)
  assert.equal(f.state.index, legacyIndex)
  assert.ok(await fs.stat(file))
})
