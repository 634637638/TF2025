'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const path = require('node:path')
const os = require('node:os')
const { migrate, LEGACY_TYPE, TARGET_TYPE } = require('../scripts/migrate-sale-payment-methods')

function fixture() {
  let type = LEGACY_TYPE, nullable = 'NO', defaultValue = null, changed = false, occupied = false
  const writes = []
  const db = { async query(sql) {
    if (sql.includes('information_schema.COLUMNS')) return [[{ COLUMN_TYPE: type, IS_NULLABLE: nullable, COLUMN_DEFAULT: defaultValue }]]
    if (sql.startsWith('SHOW CREATE')) return [[{ Table: 'payment_records', 'Create Table': `payment_method ${type} NOT NULL` }]]
    if (sql.startsWith('SELECT COUNT')) return [[{ count: occupied ? 1 : 0 }]]
    if (sql.startsWith('SELECT *')) return [[{ id: 1, payment_method: changed && writes.length ? 'changed' : 'cash', amount: '100.10' }]]
    writes.push(sql)
    type = sql.includes(TARGET_TYPE) ? TARGET_TYPE : LEGACY_TYPE
    return [{}]
  } }
  return { db, writes, conflict(kind) { if (kind === 'type') type = 'int'; if (kind === 'nullable') nullable = 'YES'; if (kind === 'default') defaultValue = 'cash' },
    change() { changed = true }, occupy() { occupied = true } }
}
async function temporary(t) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'tf-payment-migration-'))
  t.after(() => fs.rm(dir, { recursive: true, force: true }))
  return name => path.join(dir, `${name}.json`)
}

test('预览零写入，执行先备份结构/数量/摘要，保留历史收款，重复不改表', async t => {
  const f = fixture(), file = await temporary(t)
  assert.equal((await migrate(f.db)).status, 'dry_run')
  await assert.rejects(migrate(f.db, { apply: true }), /backup-file/)
  await assert.rejects(migrate(f.db, { apply: true, backupFile: __filename }), { code: 'EEXIST' })
  assert.equal(f.writes.length, 0)
  const backupFile = file('before')
  assert.equal((await migrate(f.db, { apply: true, backupFile })).originalDataUnchanged, true)
  const backup = JSON.parse(await fs.readFile(backupFile, 'utf8'))
  assert.equal(backup.count, 1)
  assert.equal(backup.digest.length, 64)
  assert.ok(backup.schema)
  assert.equal(Object.hasOwn(backup, 'rows'), false)
  assert.equal((await fs.stat(backupFile)).mode & 0o777, 0o600)
  assert.equal((await migrate(f.db, { apply: true, backupFile })).status, 'already_ready')
  assert.equal(f.writes.length, 1)
})

for (const kind of ['type', 'nullable', 'default']) test(`结构冲突(${kind})拒绝覆盖`, async () => {
  const f = fixture(); f.conflict(kind)
  await assert.rejects(migrate(f.db, { apply: true, backupFile: __filename }), /结构冲突/)
  assert.equal(f.writes.length, 0)
})

test('出现银行卡/国补等旧枚举无法容纳的方式，预览和执行均拒绝回退', async t => {
  const f = fixture(), file = await temporary(t)
  await migrate(f.db, { apply: true, backupFile: file('before') })
  f.occupy()
  await assert.rejects(migrate(f.db, { rollback: true }), /拒绝回退/)
  await assert.rejects(migrate(f.db, { rollback: true, apply: true, backupFile: file('rollback') }), /拒绝回退/)
  assert.equal(f.writes.length, 1)
})

test('无不兼容记录时可预览和受控回退，不改记录', async t => {
  const f = fixture(), file = await temporary(t)
  await migrate(f.db, { apply: true, backupFile: file('before') })
  assert.equal((await migrate(f.db, { rollback: true })).writes, false)
  await assert.rejects(migrate(f.db, { rollback: true, apply: true }), /backup-file/)
  assert.equal((await migrate(f.db, { rollback: true, apply: true, backupFile: file('rollback') })).originalDataUnchanged, true)
  assert.equal((await migrate(f.db, { rollback: true })).status, 'already_ready')
})

test('迁移期间原数据摘要变化则失败，不把并发写入伪报为无损', async t => {
  const f = fixture(), file = await temporary(t)
  f.change()
  await assert.rejects(migrate(f.db, { apply: true, backupFile: file('before') }), /原收款数据变化/)
})
