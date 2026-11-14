'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const path = require('node:path')
const os = require('node:os')
const { migrate } = require('../scripts/migrate-customer-points-ledger')

const fixture = require('./helpers/customer-points-schema')

async function files(t) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'tf-points-ledger-migration-'))
  t.after(() => fs.rm(directory, { recursive: true, force: true }))
  return name => path.join(directory, `${name}.json`)
}

test('积分账迁移默认零写入预览；只建追加账，不回填或改写历史积分', async () => {
  const f = fixture(), before = structuredClone(f.originals)
  const result = await migrate(f.db)
  assert.equal(result.status, 'dry_run')
  assert.equal(result.writes, false)
  assert.equal(result.sql.length, 2)
  assert.ok(result.sql.every(sql => sql.startsWith('CREATE TABLE customer_points_')))
  assert.equal(f.writes.length, 0)
  assert.deepEqual(f.originals, before)
})

test('迁移先备份、核对原余额及凭据摘要，重复执行不写入；备份不输出客户明细', async t => {
  const f = fixture(), file = await files(t)
  await assert.rejects(migrate(f.db, { apply: true }), /backup-file/)
  await assert.rejects(migrate(f.db, { apply: true, backupFile: __filename }), { code: 'EEXIST' })
  assert.equal(f.writes.length, 0)
  const backupFile = file('before')
  assert.equal((await migrate(f.db, { apply: true, backupFile })).originalDataUnchanged, true)
  const backup = JSON.parse(await fs.readFile(backupFile, 'utf8'))
  assert.deepEqual(Object.keys(backup.tables.customers).sort(), ['count', 'digest'])
  assert.equal(backup.tables.customers.count, 1)
  assert.equal(backup.tables.customers.digest.length, 64)
  assert.equal((await fs.stat(backupFile)).mode & 0o777, 0o600)
  assert.equal((await migrate(f.db)).status, 'already_ready')
  assert.equal(f.writes.length, 2)
})

test('DDL中断后按真实现有结构重跑，不重建来源表；冲突字段、索引及级联外键拒绝', async t => {
  const f = fixture(), file = await files(t)
  f.interrupt(1)
  await assert.rejects(migrate(f.db, { apply: true, backupFile: file('partial') }), /ddl-interrupted/)
  assert.equal((await migrate(f.db)).sql.length, 1)
  await migrate(f.db, { apply: true, backupFile: file('resume') })
  assert.equal(f.writes.length, 2)
  const column = f.columns.find(row => row.TABLE_NAME === 'customer_points_entries' && row.COLUMN_NAME === 'points')
  column.COLUMN_TYPE = 'int unsigned'
  await assert.rejects(migrate(f.db), /字段结构冲突/)
  column.COLUMN_TYPE = 'int'
  const index = f.indexes.find(row => row.INDEX_NAME === 'uq_points_redemption_item')
  index.NON_UNIQUE = 1
  await assert.rejects(migrate(f.db), /索引结构冲突/)
  index.NON_UNIQUE = 0
  f.foreignKeys[0].DELETE_RULE = 'CASCADE'
  await assert.rejects(migrate(f.db), /外键结构冲突/)
})

test('有来源或消费事实禁止回退；空账可先备份再回退，原余额和凭据仍完整', async t => {
  const file = await files(t), f = fixture()
  await migrate(f.db, { apply: true, backupFile: file('before') })
  assert.equal((await migrate(f.db, { rollback: true })).status, 'dry_run')
  assert.equal((await migrate(f.db, { rollback: true, apply: true, backupFile: file('rollback') })).originalDataUnchanged, true)
  assert.equal((await migrate(f.db, { rollback: true })).status, 'already_ready')
  const used = fixture()
  await migrate(used.db, { apply: true, backupFile: file('used') })
  used.occupy()
  await assert.rejects(migrate(used.db, { rollback: true }), /拒绝回退/)
  assert.equal(used.writes.length, 2)
})

test('缺少前置结构、非事务引擎及迁移期间原积分变化均报告失败', async t => {
  const missing = fixture()
  missing.tables.pop()
  await assert.rejects(migrate(missing.db), /先完成/)
  const engine = fixture()
  engine.tables[0].ENGINE = 'MyISAM'
  await assert.rejects(migrate(engine.db), /InnoDB/)
  const changed = fixture(), file = await files(t)
  changed.mutate()
  await assert.rejects(migrate(changed.db, { apply: true, backupFile: file('changed') }), /原客户余额或积分凭据变化/)
})
