'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const path = require('node:path')
const os = require('node:os')
const schemaFixture = require('./helpers/customer-points-schema')
const { migrate: migrateLedger } = require('../scripts/migrate-customer-points-ledger')
const { migrate } = require('../scripts/migrate-customer-points-aftersales')

async function fixture(t) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'tf-points-aftersale-migration-'))
  t.after(() => fs.rm(directory, { recursive: true, force: true }))
  const f = schemaFixture()
  const file = name => path.join(directory, `${name}.json`)
  await migrateLedger(f.db, { apply: true, backupFile: file('ledger') })
  return { ...f, file }
}

test('售后账必须先完成两张来源账，预览零写入，不更改旧表或积分', async t => {
  await assert.rejects(migrate(schemaFixture().db), /先完成/)
  const f = await fixture(t), before = structuredClone(f.originals)
  const result = await migrate(f.db)
  assert.equal(result.status, 'dry_run')
  assert.equal(result.writes, false)
  assert.equal(result.sql.length, 1)
  assert.match(result.sql[0], /^CREATE TABLE customer_points_aftersales/)
  assert.equal(f.writes.length, 2)
  assert.deepEqual(f.originals, before)
})

test('先独占备份再迁移；原表摘要不变，重跑不重复建表，备份只保存摘要与结构', async t => {
  const f = await fixture(t)
  await assert.rejects(migrate(f.db, { apply: true }), /backup-file/)
  await assert.rejects(migrate(f.db, { apply: true, backupFile: __filename }), { code: 'EEXIST' })
  assert.equal(f.writes.length, 2)
  const backupFile = f.file('before')
  assert.equal((await migrate(f.db, { apply: true, backupFile })).status, 'migrated_and_verified')
  const backup = JSON.parse(await fs.readFile(backupFile, 'utf8'))
  assert.deepEqual(Object.keys(backup.tables.customers).sort(), ['count', 'digest'])
  assert.equal(backup.tables.customers.digest.length, 64)
  assert.equal(Object.keys(backup.tables).length, 5)
  assert.equal((await fs.stat(backupFile)).mode & 0o777, 0o600)
  assert.equal((await migrate(f.db)).status, 'already_ready')
  assert.equal(f.writes.length, 3)
})

test('DDL中断可重跑；已有字段、唯一索引、排序规则或未知级联不能覆盖', async t => {
  const f = await fixture(t)
  f.interrupt(2)
  await assert.rejects(migrate(f.db, { apply: true, backupFile: f.file('interrupted') }), /ddl-interrupted/)
  await migrate(f.db, { apply: true, backupFile: f.file('resume') })
  const field = f.columns.find(row => row.TABLE_NAME === 'customer_points_aftersales' && row.COLUMN_NAME === 'request_key')
  field.COLLATION_NAME = 'ascii_general_ci'
  await assert.rejects(migrate(f.db), /字段结构冲突/)
  field.COLLATION_NAME = 'ascii_bin'
  field.COLUMN_TYPE = 'varchar(99)'
  await assert.rejects(migrate(f.db), /字段结构冲突/)
  field.COLUMN_TYPE = 'varchar(100)'
  const index = f.indexes.find(row => row.INDEX_NAME === 'uq_points_aftersale_request')
  index.NON_UNIQUE = 1
  await assert.rejects(migrate(f.db), /索引冲突/)
  index.NON_UNIQUE = 0
  f.foreignKeys.push({ TABLE_NAME: 'customer_points_aftersales', CONSTRAINT_NAME: 'unexpected', DELETE_RULE: 'CASCADE' })
  await assert.rejects(migrate(f.db), /未知外键/)
})

test('只有空售后账允许受控回退，已有历史连预览也拒绝删除；原来源与余额保留', async t => {
  const f = await fixture(t)
  await migrate(f.db, { apply: true, backupFile: f.file('before') })
  const original = structuredClone(f.originals.customers)
  assert.equal((await migrate(f.db, { rollback: true })).status, 'dry_run')
  await assert.rejects(migrate(f.db, { apply: true, rollback: true }), /backup-file/)
  assert.equal((await migrate(f.db, { apply: true, rollback: true, backupFile: f.file('rollback') })).status, 'migrated_and_verified')
  assert.equal((await migrate(f.db, { rollback: true })).status, 'already_ready')
  assert.deepEqual(f.originals.customers, original)
  await migrate(f.db, { apply: true, backupFile: f.file('reinstall') })
  f.occupy()
  await assert.rejects(migrate(f.db, { rollback: true }), /已有积分售后历史/)
})

test('迁移期间原凭据变化或非事务引擎报告失败，不宣称原数据未变', async t => {
  const f = await fixture(t)
  f.tables.find(row => row.TABLE_NAME === 'customers').ENGINE = 'MyISAM'
  await assert.rejects(migrate(f.db), /InnoDB/)
  f.tables.find(row => row.TABLE_NAME === 'customers').ENGINE = 'InnoDB'
  f.mutate()
  await assert.rejects(migrate(f.db, { apply: true, backupFile: f.file('changed') }), /原余额或销售积分凭据变化/)
})
