'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const path = require('node:path')
const os = require('node:os')
const { migrate, definitions, indexes } = require('../scripts/migrate-salary-goods-settlement')

const fixture = () => {
  const state = { column: false, table: false, salaryId: 'bigint unsigned', employeeId: 'int unsigned',
    snapshot: null, claims: [], writes: [], corrupt: false, failure: null, override: {},
    original: { id: 71, employee_id: 8, period_start: '2026-10-01', period_end: '2026-10-31',
      commission_amount: '120.00', net_salary: '3120.00', status: 'paid', paid_at: '2026-11-01 10:00:00' } }
  const columns = () => Object.entries(definitions(state.salaryId, state.employeeId)).map(([name, type]) => ({
    COLUMN_NAME: name, COLUMN_TYPE: type, IS_NULLABLE: name === 'original_salary_record_id' ? 'YES' : 'NO',
    COLUMN_DEFAULT: null, EXTRA: name === 'id' ? 'auto_increment' : '',
    COLLATION_NAME: ['source_key', 'source_hash'].includes(name) ? 'ascii_bin' : null }))
  const keys = () => indexes.flatMap(([name, fields, unique]) => fields.map((field, offset) => ({
    INDEX_NAME: name, COLUMN_NAME: field, NON_UNIQUE: Number(!unique), SEQ_IN_INDEX: offset + 1, SUB_PART: null })))
  const foreign = () => ['salary_record_id', 'original_salary_record_id'].map(field => ({
    CONSTRAINT_NAME: field === 'salary_record_id' ? 'fk_salary_goods_record' : 'fk_salary_goods_original',
    COLUMN_NAME: field, REFERENCED_TABLE_NAME: 'salary_records', REFERENCED_COLUMN_NAME: 'id',
    ORDINAL_POSITION: 1, DELETE_RULE: 'RESTRICT', UPDATE_RULE: 'RESTRICT' }))
  const db = { async query(sql) {
    if (sql.includes('information_schema.TABLES')) return [sql.includes("'salary_records'")
      ? [{ ENGINE: state.override.parentEngine || 'InnoDB' }]
      : state.table ? [{ ENGINE: state.override.engine || 'InnoDB' }] : []]
    if (sql.includes('information_schema.COLUMNS')) {
      if (sql.includes("'salary_records'")) return [[{ COLUMN_NAME: 'id', COLUMN_TYPE: state.salaryId },
        { COLUMN_NAME: 'employee_id', COLUMN_TYPE: state.employeeId },
        ...(state.column ? [{ COLUMN_NAME: 'goods_commission_snapshot', COLUMN_TYPE: 'json', IS_NULLABLE: 'YES',
          COLUMN_DEFAULT: null, ...state.override.snapshotColumn }] : [])]]
      return [state.override.columns || columns()]
    }
    if (sql.includes('information_schema.STATISTICS')) return [state.override.indexes || keys()]
    if (sql.includes('information_schema.KEY_COLUMN_USAGE')) return [state.override.foreign || foreign()]
    if (sql.startsWith('SELECT * FROM salary_records')) return [[{ ...state.original,
      ...(state.column ? { goods_commission_snapshot: state.snapshot } : {}), ...(state.corrupt ? { net_salary: '3121.00' } : {}) }]]
    if (sql.startsWith('SELECT * FROM salary_goods_settlements')) return [structuredClone(state.claims)]
    if (sql.startsWith('SHOW CREATE TABLE')) return [[{ Table: sql.split(' ').at(-1), 'Create Table': `${sql} (...)` }]]
    if (state.failure && sql.startsWith(state.failure)) throw new Error('ddl-failed')
    if (sql.startsWith('ALTER TABLE salary_records')) state.column = sql.includes('ADD COLUMN')
    else if (sql.startsWith('CREATE TABLE salary_goods_settlements')) {
      assert.ok(sql.includes(`salary_record_id ${state.salaryId} NOT NULL`))
      assert.ok(sql.includes(`employee_id ${state.employeeId} NOT NULL`))
      assert.match(sql, /UNIQUE KEY uq_salary_goods_source \(source_key\)/)
      assert.match(sql, /ON DELETE RESTRICT ON UPDATE RESTRICT/)
      state.table = true
    } else if (sql === 'DROP TABLE salary_goods_settlements') state.table = false
    else assert.fail(`未处理SQL：${sql}`)
    state.writes.push(sql)
    return [{}]
  } }
  return { db, state, columns, keys, foreign }
}
const temporary = async t => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'tf-salary-settlement-'))
  t.after(() => fs.rm(dir, { recursive: true, force: true }))
  return dir
}

test('默认预览零写，apply先创建0600独占备份；原工资不变并可幂等重入', async t => {
  const dir = await temporary(t), { db, state } = fixture()
  const preview = await migrate(db)
  assert.equal(preview.writes, false); assert.equal(preview.sql.length, 2)
  assert.equal(state.writes.length, 0)
  await assert.rejects(migrate(db, { apply: true }), /backup-file/)
  const backupFile = path.join(dir, 'before.json')
  await fs.writeFile(backupFile, 'existing')
  await assert.rejects(migrate(db, { apply: true, backupFile }), { code: 'EEXIST' })
  assert.equal(state.writes.length, 0)
  await fs.unlink(backupFile)
  assert.equal((await migrate(db, { apply: true, backupFile })).originalDataUnchanged, true)
  const backup = JSON.parse(await fs.readFile(backupFile, 'utf8'))
  assert.deepEqual(backup.salary_records, [state.original]); assert.deepEqual(backup.salary_goods_settlements, [])
  assert.equal((await fs.stat(backupFile)).mode & 0o777, 0o600)
  assert.deepEqual(await migrate(db, { apply: true, backupFile }), { status: 'already_ready', writes: false })
  assert.equal(state.writes.length, 2)
})

test('关联列沿用真实signed/unsigned整数类型，拒绝无法核对的父表类型', async () => {
  for (const [salaryId, employeeId] of [['int', 'bigint'], ['bigint unsigned', 'int unsigned']]) {
    const { db, state } = fixture(); Object.assign(state, { salaryId, employeeId })
    const result = await migrate(db)
    assert.ok(result.sql[1].includes(`salary_record_id ${salaryId} NOT NULL`))
    assert.ok(result.sql[1].includes(`employee_id ${employeeId} NOT NULL`))
  }
  for (const salaryId of ['varchar(20)', 'bigint; DROP TABLE salary_records', undefined]) {
    const { db, state } = fixture(); state.salaryId = salaryId
    await assert.rejects(migrate(db, { apply: true }), /拒绝猜测/)
    assert.equal(state.writes.length, 0)
  }
})

test('快照、引擎、金额、字符排序、唯一索引及外键冲突全部拒绝覆盖', async () => {
  const variants = [f => { f.state.override.parentEngine = 'MyISAM' }, f => { f.state.override.engine = 'MyISAM' },
    f => { f.state.override.snapshotColumn = { COLUMN_TYPE: 'text' } }, f => { f.state.override.snapshotColumn = { IS_NULLABLE: 'NO' } },
    f => { f.state.override.snapshotColumn = { COLUMN_DEFAULT: 'null' } },
    f => { f.state.override.columns = f.columns().map(row => row.COLUMN_NAME === 'amount_cents' ? { ...row, COLUMN_TYPE: 'bigint unsigned' } : row) },
    f => { f.state.override.columns = f.columns().map(row => row.COLUMN_NAME === 'source_key' ? { ...row, COLLATION_NAME: 'ascii_general_ci' } : row) },
    f => { f.state.override.columns = f.columns().slice(1) },
    f => { f.state.override.indexes = f.keys().map(row => row.INDEX_NAME === 'uq_salary_goods_source' ? { ...row, NON_UNIQUE: 1 } : row) },
    f => { f.state.override.indexes = f.keys().map(row => row.INDEX_NAME === 'uq_salary_goods_source' ? { ...row, SUB_PART: 20 } : row) },
    f => { f.state.override.foreign = f.foreign().map(row => ({ ...row, DELETE_RULE: 'CASCADE' })) },
    f => { f.state.override.foreign = f.foreign().slice(1) }]
  for (const change of variants) {
    const f = fixture(); f.state.column = f.state.table = true; change(f)
    await assert.rejects(migrate(f.db, { apply: true }), /冲突|安全关联/)
    assert.equal(f.state.writes.length, 0)
  }
})

test('DDL中断保留备份及已加快照，使用新备份只补缺失表，不重写旧工资', async t => {
  const dir = await temporary(t), { db, state } = fixture()
  state.failure = 'CREATE TABLE'
  const first = path.join(dir, 'first.json')
  await assert.rejects(migrate(db, { apply: true, backupFile: first }), /ddl-failed/)
  assert.equal(state.column, true); assert.equal(state.table, false)
  assert.deepEqual(JSON.parse(await fs.readFile(first, 'utf8')).salary_records, [state.original])
  state.failure = null
  assert.equal((await migrate(db)).sql.length, 1)
  assert.equal((await migrate(db, { apply: true, backupFile: path.join(dir, 'resume.json') })).status, 'migrated_and_verified')
  assert.equal(state.writes.length, 2)
})

test('有任意快照或核销历史不许回退，缺失结构也不允许伪造重建', async () => {
  for (const snapshot of [{ entries: [] }, '{}', 'null', { net_cents: 0 }]) {
    const { db, state } = fixture(); state.column = state.table = true; state.snapshot = snapshot
    await assert.rejects(migrate(db, { apply: true, rollback: true }), /已有商品工资/)
    state.table = false
    await assert.rejects(migrate(db, { apply: true }), /已有商品工资/)
    assert.equal(state.writes.length, 0)
  }
  const { db, state } = fixture(); state.table = true; state.claims = [{ id: 1 }]
  await assert.rejects(migrate(db, { rollback: true }), /已有商品工资/)
  await assert.rejects(migrate(db, { apply: true }), /已有商品工资/)
  assert.equal(state.writes.length, 0)
})

test('未使用结构回退先备份再按外键顺序删除，部分回退可安全重入', async t => {
  const dir = await temporary(t), { db, state } = fixture(); state.column = state.table = true
  const preview = await migrate(db, { rollback: true })
  assert.deepEqual(preview.sql, ['DROP TABLE salary_goods_settlements', 'ALTER TABLE salary_records DROP COLUMN goods_commission_snapshot'])
  state.failure = 'ALTER TABLE'
  await assert.rejects(migrate(db, { apply: true, rollback: true, backupFile: path.join(dir, 'first.json') }), /ddl-failed/)
  assert.equal(state.table, false); assert.equal(state.column, true)
  state.failure = null
  assert.equal((await migrate(db, { apply: true, rollback: true, backupFile: path.join(dir, 'resume.json') })).originalDataUnchanged, true)
  assert.deepEqual(await migrate(db, { apply: true, rollback: true }), { status: 'already_ready', writes: false })
})

test('迁移后并发改工资、填快照或追加核销时验证失败，保留备份且不自动破坏历史', async t => {
  const dir = await temporary(t)
  for (const changed of ['salary', 'snapshot', 'ledger']) {
    const { db, state } = fixture(), query = db.query
    db.query = async sql => {
      const result = await query(sql)
      if (sql.startsWith('CREATE TABLE')) {
        if (changed === 'salary') state.corrupt = true
        else if (changed === 'snapshot') state.snapshot = '{}'
        else state.claims.push({ id: 1 })
      }
      return result
    }
    const backupFile = path.join(dir, `${changed}.json`)
    await assert.rejects(migrate(db, { apply: true, backupFile }), /发生变化/)
    assert.deepEqual(JSON.parse(await fs.readFile(backupFile, 'utf8')).salary_records, [state.original])
    assert.equal(state.column, true); assert.equal(state.table, true)
    assert.equal(state.writes.length, 2)
  }
})
