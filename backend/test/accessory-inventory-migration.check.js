'use strict'
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const path = require('node:path')
const os = require('node:os')
const { migrate, definitions, nullable, indexes } = require('../scripts/migrate-accessory-inventory-events')

function fixture() {
  let ready = false, count = 0, conflict, altered = false
  const writes = []
  const db = { async query(sql) {
    if (sql.includes('information_schema.TABLES')) return [ready ? [{ ENGINE: conflict === 'engine' ? 'MyISAM' : 'InnoDB' }] : []]
    if (sql.includes('information_schema.COLUMNS')) return [Object.entries(definitions).map(([name, type]) => ({
      COLUMN_NAME: name, COLUMN_TYPE: conflict === 'type' && name === 'purchase_cost' ? 'float' : type,
      IS_NULLABLE: conflict === 'nullable' && name === 'purchase_cost' ? 'NO' : nullable.has(name) ? 'YES' : 'NO'
    }))]
    if (sql.includes('information_schema.STATISTICS')) return [Object.entries(indexes).flatMap(([name, columns]) => columns.map((column, index) => ({
      INDEX_NAME: name, COLUMN_NAME: conflict === 'index' && name === 'idx_accessory_event_stock' ? 'wrong' : column,
      NON_UNIQUE: name === 'PRIMARY' ? 0 : 1, SEQ_IN_INDEX: index + 1
    })))]
    if (sql.startsWith('SHOW CREATE')) return [[{ Table: 'original', 'Create Table': 'unchanged' }]]
    if (sql.startsWith('SELECT *')) return [[{ id: 1, value: altered && writes.length ? 'changed' : 'original' }]]
    if (sql.startsWith('SELECT COUNT')) return [[{ count }]]
    writes.push(sql); ready = sql.startsWith('CREATE TABLE'); return [{}]
  } }
  return { db, writes, occupy() { count = 1 }, conflict(value) { conflict = value }, alter() { altered = true } }
}

async function temporary(t) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'tf-inventory-migration-'))
  t.after(() => fs.rm(directory, { recursive: true, force: true }))
  return name => path.join(directory, `${name}.json`)
}

test('批次迁移预览零写入，先备份8张原表再创建；重复执行不重建', async t => {
  const file = await temporary(t), f = fixture()
  assert.equal((await migrate(f.db)).status, 'dry_run')
  assert.equal(f.writes.length, 0)
  await assert.rejects(migrate(f.db, { apply: true }), /backup-file/)
  await assert.rejects(migrate(f.db, { apply: true, backupFile: __filename }), { code: 'EEXIST' })
  assert.equal(f.writes.length, 0)
  const backupFile = file('before')
  assert.equal((await migrate(f.db, { apply: true, backupFile })).originalDataUnchanged, true)
  const backup = JSON.parse(await fs.readFile(backupFile, 'utf8'))
  assert.equal(Object.keys(backup).length, 8)
  assert.equal(backup.accessory_stock.count, 1)
  assert.equal(backup.accessory_stock.digest.length, 64)
  assert.equal((await fs.stat(backupFile)).mode & 0o777, 0o600)
  assert.equal((await migrate(f.db, { apply: true, backupFile })).status, 'already_ready')
  assert.equal(f.writes.length, 1)
})

for (const kind of ['engine', 'type', 'nullable', 'index']) test(`已有库存流水结构冲突(${kind})时拒绝覆盖`, async t => {
  const file = await temporary(t), f = fixture()
  await migrate(f.db, { apply: true, backupFile: file('before') })
  f.conflict(kind)
  await assert.rejects(migrate(f.db), /结构冲突|引擎冲突/)
  assert.equal(f.writes.length, 1)
})

test('有事件禁止回退；空表回退先备份且原业务内容不变', async t => {
  const file = await temporary(t), f = fixture()
  await migrate(f.db, { apply: true, backupFile: file('before') })
  f.occupy()
  await assert.rejects(migrate(f.db, { rollback: true, apply: true, backupFile: file('rollback') }), /已有库存流水/)
  assert.equal(f.writes.length, 1)
  const empty = fixture()
  await migrate(empty.db, { apply: true, backupFile: file('empty') })
  assert.equal((await migrate(empty.db, { rollback: true })).writes, false)
  await assert.rejects(migrate(empty.db, { rollback: true, apply: true }), /backup-file/)
  assert.equal((await migrate(empty.db, { rollback: true, apply: true, backupFile: file('empty-rollback') })).originalDataUnchanged, true)
  assert.equal((await migrate(empty.db, { rollback: true })).status, 'already_ready')
})

test('迁移期间原业务摘要变化即报错，不伪报无损迁移', async t => {
  const file = await temporary(t), f = fixture()
  f.alter()
  await assert.rejects(migrate(f.db, { apply: true, backupFile: file('before') }), /原业务数据变化/)
})
