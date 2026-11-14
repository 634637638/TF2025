'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const path = require('node:path')
const os = require('node:os')
const { migrate } = require('../scripts/migrate-salary-goods-commission')

const fixture = () => {
  const state = { ready: false, rule: null, corrupt: false, schema: {}, writes: [],
    original: { id: 4, name: '原工资模板', base_salary: '2500.00', commission_new_fixed: '20.00',
      commission_used_fixed: '0.00', updated_at: '2026-11-01 09:00:00', auto_raise_rule: null } }
  const db = { async query(sql) {
    if (sql.includes('information_schema')) return [state.ready ? [{ COLUMN_TYPE: 'json', IS_NULLABLE: 'YES', COLUMN_DEFAULT: null, ...state.schema }] : []]
    if (sql.startsWith('SHOW CREATE TABLE')) return [[{ Table: 'salary_templates', 'Create Table': 'CREATE TABLE salary_templates (...)' }]]
    if (sql.startsWith('SELECT *')) return [[{ ...state.original,
      ...(state.ready ? { goods_commission_rule: state.rule } : {}), ...(state.corrupt ? { base_salary: '2600.00' } : {}) }]]
    assert.match(sql, /^ALTER TABLE salary_templates (ADD|DROP) COLUMN goods_commission_rule/)
    state.writes.push(sql)
    state.ready = sql.includes('ADD COLUMN')
    return [{}]
  } }
  return { db, state }
}
const temporary = async t => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'tf-salary-goods-'))
  t.after(() => fs.rm(dir, { recursive: true, force: true }))
  return dir
}

test('默认预览不写；apply必须先独占创建备份，新增可空规则且原模板逐项不变', async t => {
  const dir = await temporary(t), { db, state } = fixture()
  const preview = await migrate(db)
  assert.equal(preview.status, 'dry_run'); assert.equal(preview.writes, false)
  assert.match(preview.sql, /ADD COLUMN goods_commission_rule JSON NULL/)
  await assert.rejects(migrate(db, { apply: true }), /backup-file/)
  const backupFile = path.join(dir, 'before.json')
  await fs.writeFile(backupFile, 'existing')
  await assert.rejects(migrate(db, { apply: true, backupFile }), { code: 'EEXIST' })
  assert.equal(state.writes.length, 0)
  await fs.unlink(backupFile)
  assert.equal((await migrate(db, { apply: true, backupFile })).originalDataUnchanged, true)
  const backup = JSON.parse(await fs.readFile(backupFile, 'utf8'))
  assert.deepEqual(backup.rows, [state.original]); assert.equal(backup.table, 'salary_templates')
  assert.equal((await fs.stat(backupFile)).mode & 0o777, 0o600)
  assert.equal((await migrate(db, { apply: true, backupFile })).status, 'already_ready')
  assert.equal(state.writes.length, 1)
})

test('字段类型、可空或默认值冲突直接拒绝，不覆盖既有结构', async () => {
  for (const schema of [{ COLUMN_TYPE: 'text' }, { IS_NULLABLE: 'NO' }, { COLUMN_DEFAULT: 'null' }]) {
    const { db, state } = fixture(); state.ready = true; state.schema = schema
    await assert.rejects(migrate(db, { apply: true }), /结构冲突/)
    assert.equal(state.writes.length, 0)
  }
})

test('回滚仅允许从未配置的空规则，关闭或零规则同样拒绝删除；回滚前仍须备份', async t => {
  const dir = await temporary(t), { db, state } = fixture(); state.ready = true
  for (const rule of [{ enabled: false, type: 'fixed', fixed_amount: 0, percentage: 0 }, '{}', 'null']) {
    state.rule = rule
    await assert.rejects(migrate(db, { apply: true, rollback: true, backupFile: path.join(dir, 'forbidden.json') }), /已有商品提成配置/)
  }
  assert.equal(state.writes.length, 0)
  state.rule = null
  assert.equal((await migrate(db, { rollback: true })).status, 'dry_run')
  assert.equal((await migrate(db, { apply: true, rollback: true, backupFile: path.join(dir, 'rollback.json') })).originalDataUnchanged, true)
  assert.equal(state.ready, false)
  assert.equal((await migrate(db, { apply: true, rollback: true })).status, 'already_ready')
  assert.equal(state.writes.length, 1)
})

test('DDL后原模板或规则被并发更改时核对失败，保留备份不自动删字段', async t => {
  const dir = await temporary(t)
  for (const changed of ['base', 'rule']) {
    const { db, state } = fixture(), query = db.query
    db.query = async sql => {
      const result = await query(sql)
      if (sql.startsWith('ALTER')) {
        if (changed === 'base') state.corrupt = true
        else state.rule = { enabled: false }
      }
      return result
    }
    const backupFile = path.join(dir, `${changed}.json`)
    await assert.rejects(migrate(db, { apply: true, backupFile }), /原工资模板或新规则发生变化/)
    assert.deepEqual(JSON.parse(await fs.readFile(backupFile, 'utf8')).rows, [state.original])
    assert.equal(state.writes.length, 1); assert.equal(state.ready, true)
  }
})
