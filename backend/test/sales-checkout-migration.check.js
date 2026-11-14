'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const path = require('node:path')
const os = require('node:os')
const { migrate } = require('../scripts/migrate-sales-checkout')

const fixture = require('./helpers/sales-checkout-schema')

async function files(t) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'tf-checkout-migration-'))
  t.after(() => fs.rm(directory, { recursive: true, force: true }))
  return name => path.join(directory, `${name}.json`)
}

test('迁移预览零写入、执行先备份、核对原字段摘要、重复运行幂等', async t => {
  const f = fixture(), file = await files(t)
  assert.equal((await migrate(f.db)).status, 'dry_run')
  assert.equal(f.writes.length, 0)
  await assert.rejects(migrate(f.db, { apply: true }), /backup-file/)
  await assert.rejects(migrate(f.db, { apply: true, backupFile: __filename }), { code: 'EEXIST' })
  assert.equal(f.writes.length, 0)
  const backupFile = file('before')
  assert.equal((await migrate(f.db, { apply: true, backupFile })).originalDataUnchanged, true)
  const backup = JSON.parse(await fs.readFile(backupFile, 'utf8'))
  assert.equal(backup.tables.payment_records.count, 1)
  assert.equal(backup.tables.payment_records.digest.length, 64)
  assert.equal(Object.hasOwn(backup.tables.payment_records, 'rows'), false)
  assert.equal((await fs.stat(backupFile)).mode & 0o777, 0o600)
  assert.equal((await migrate(f.db)).status, 'already_ready')
})

test('DDL中断后按已完成结构安全重跑；冲突字段和幂等索引拒绝覆盖', async t => {
  const f = fixture(), file = await files(t)
  f.interrupt(3)
  await assert.rejects(migrate(f.db, { apply: true, backupFile: file('partial') }), { code: 'DDL_INTERRUPTED' })
  assert.equal((await migrate(f.db, { apply: true, backupFile: file('retry') })).status, 'migrated_and_verified')
  f.columns.find(row => row.COLUMN_NAME === 'request_key').COLUMN_TYPE = 'int'
  await assert.rejects(migrate(f.db), /结构冲突/)
  f.columns.find(row => row.COLUMN_NAME === 'request_key').COLUMN_TYPE = 'varchar(36)'
  f.indexes.find(row => row.INDEX_NAME === 'uq_sales_checkout_request').NON_UNIQUE = 1
  await assert.rejects(migrate(f.db), /索引结构冲突/)
})

test('已有交易事实、无手机ID收款或旧枚举无法容纳的方式时禁止回退', async t => {
  const file = await files(t)
  for (const occupied of [true, false]) {
    const f = fixture()
    await migrate(f.db, { apply: true, backupFile: file(`before-${occupied}`) })
    if (occupied) f.occupy(); else f.incompatible()
    const count = f.writes.length
    await assert.rejects(migrate(f.db, { rollback: true, apply: true, backupFile: file(`rollback-${occupied}`) }), /拒绝回退/)
    assert.equal(f.writes.length, count)
  }
})

test('空明细可受控回退且不改历史收款，原字段摘要变化时必须报告失败', async t => {
  const file = await files(t), f = fixture()
  await migrate(f.db, { apply: true, backupFile: file('before') })
  assert.equal((await migrate(f.db, { rollback: true })).writes, false)
  assert.equal((await migrate(f.db, { rollback: true, apply: true, backupFile: file('rollback') })).originalDataUnchanged, true)
  assert.equal((await migrate(f.db, { rollback: true })).status, 'already_ready')
  const changed = fixture(); changed.change()
  await assert.rejects(migrate(changed.db, { apply: true, backupFile: file('changed') }), /原销售收款记录变化/)
})
