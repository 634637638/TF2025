'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const path = require('node:path')
const os = require('node:os')
const { migrate } = require('../scripts/migrate-accessory-inventory-returns')
const { inspect: inspectBase, definitions, nullable, indexes: baseIndexes } = require('../scripts/migrate-accessory-inventory-events')

function fixture() {
  const fields = Object.entries(definitions).map(([COLUMN_NAME, COLUMN_TYPE]) => ({ COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE: nullable.has(COLUMN_NAME) ? 'YES' : 'NO' }))
  const indexes = Object.entries(baseIndexes).flatMap(([INDEX_NAME, names]) => names.map((COLUMN_NAME, i) => ({ INDEX_NAME, COLUMN_NAME, SEQ_IN_INDEX: i + 1, NON_UNIQUE: INDEX_NAME === 'PRIMARY' ? 0 : 1 })))
  const writes = []
  let present = true, occupied = false, mutateAt = Infinity, engine = 'InnoDB', interrupted = false
  const db = { async query(sql) {
    if (sql.includes('information_schema.TABLES')) return [present ? [{ ENGINE: engine }] : []]
    if (sql.includes('information_schema.COLUMNS')) return [structuredClone(fields)]
    if (sql.includes('information_schema.STATISTICS')) return [structuredClone(indexes).sort((a, b) => a.INDEX_NAME.localeCompare(b.INDEX_NAME) || a.SEQ_IN_INDEX - b.SEQ_IN_INDEX)]
    if (sql.startsWith('SHOW CREATE')) return [[{ 'Create Table': 'original schema' }]]
    if (sql.startsWith('SELECT COUNT')) return [[{ count: Number(occupied) }]]
    if (sql.startsWith('SELECT ')) return [[{ id: 1, value: writes.length > mutateAt ? 'changed' : 'original' }]]
    assert.match(sql, /^ALTER TABLE accessory_inventory_events/)
    if (interrupted) { interrupted = false; throw new Error('ddl-interrupted') }
    writes.push(sql)
    for (const match of sql.matchAll(/ADD COLUMN (\w+) (BIGINT UNSIGNED|VARCHAR\(100\)|CHAR\(64\))/g)) fields.push({
      COLUMN_NAME: match[1], COLUMN_TYPE: match[2].toLowerCase(), IS_NULLABLE: 'YES', COLLATION_NAME: match[1] === 'source_event_id' ? null : 'ascii_bin'
    })
    for (const match of sql.matchAll(/ADD (UNIQUE )?KEY (\w+) \(([^)]+)\)/g)) match[3].split(',').forEach((name, i) => indexes.push({
      INDEX_NAME: match[2], COLUMN_NAME: name.trim(), NON_UNIQUE: match[1] ? 0 : 1, SEQ_IN_INDEX: i + 1
    }))
    for (const match of sql.matchAll(/DROP COLUMN (\w+)/g)) fields.splice(fields.findIndex(row => row.COLUMN_NAME === match[1]), 1)
    for (const match of sql.matchAll(/DROP INDEX (\w+)/g)) for (let i = indexes.length - 1; i >= 0; i--) if (indexes[i].INDEX_NAME === match[1]) indexes.splice(i, 1)
    const event = sql.match(/MODIFY COLUMN event_type (ENUM\([^)]*\))/i)
    if (event) fields.find(row => row.COLUMN_NAME === 'event_type').COLUMN_TYPE = event[1].toLowerCase()
    return [{}]
  } }
  return { db, fields, indexes, writes, missing() { present = false }, occupy() { occupied = true }, mutate() { mutateAt = writes.length },
    interrupt() { interrupted = true }, engine(value) { engine = value } }
}
async function files(t) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'tf-accessory-return-migration-'))
  t.after(() => fs.rm(directory, { recursive: true, force: true }))
  return name => path.join(directory, `${name}.json`)
}

test('返库迁移零写预览，显式执行先备份并一次ALTER扩展原表，不新增平行库存', async t => {
  const f = fixture(), file = await files(t)
  const preview = await migrate(f.db)
  assert.equal(preview.status, 'dry_run')
  assert.equal(f.writes.length, 0)
  assert.match(preview.sql, /^ALTER TABLE accessory_inventory_events/)
  assert.match(preview.sql, /sale_return','gift_return'/)
  await assert.rejects(migrate(f.db, { apply: true }), /backup-file/)
  await assert.rejects(migrate(f.db, { apply: true, backupFile: __filename }), { code: 'EEXIST' })
  const backupFile = file('before')
  assert.equal((await migrate(f.db, { apply: true, backupFile })).originalDataUnchanged, true)
  const backup = JSON.parse(await fs.readFile(backupFile, 'utf8'))
  assert.equal(Object.keys(backup.tables).length, 7)
  assert.deepEqual(Object.keys(backup.tables.accessory_stock).sort(), ['count', 'digest'])
  assert.equal((await fs.stat(backupFile)).mode & 0o777, 0o600)
  assert.equal((await migrate(f.db)).status, 'already_ready')
  assert.equal(await inspectBase(f.db), true, '原库存迁移认识已升级事件，不覆盖或误报旧版本')
  assert.equal(f.writes.length, 1)
})

test('已有返库或任一新增字段保存凭据时拒绝回退，空扩展可受控回退且旧数据不变', async t => {
  const f = fixture(), file = await files(t)
  await migrate(f.db, { apply: true, backupFile: file('before') })
  assert.equal((await migrate(f.db, { rollback: true })).status, 'dry_run')
  await assert.rejects(migrate(f.db, { apply: true, rollback: true }), /backup-file/)
  await migrate(f.db, { apply: true, rollback: true, backupFile: file('rollback') })
  assert.equal((await migrate(f.db, { rollback: true })).status, 'already_ready')
  assert.equal(f.fields.length, Object.keys(definitions).length)
  await migrate(f.db, { apply: true, backupFile: file('again') })
  f.occupy()
  await assert.rejects(migrate(f.db, { rollback: true }), /已有商品返库追踪/)
})

test('缺前置、字段/索引/排序规则冲突或非事务引擎拒绝，不自动覆盖', async t => {
  const missing = fixture()
  missing.missing()
  await assert.rejects(migrate(missing.db), /先完成批次库存/)
  const f = fixture(), file = await files(t)
  await migrate(f.db, { apply: true, backupFile: file('before') })
  const field = f.fields.find(row => row.COLUMN_NAME === 'return_key')
  field.COLLATION_NAME = 'ascii_general_ci'
  await assert.rejects(migrate(f.db), /字段结构冲突/)
  field.COLLATION_NAME = 'ascii_bin'
  const index = f.indexes.find(row => row.INDEX_NAME === 'uq_accessory_return_source')
  index.NON_UNIQUE = 1
  await assert.rejects(migrate(f.db), /索引结构冲突/)
  index.NON_UNIQUE = 0
  f.engine('MyISAM')
  await assert.rejects(migrate(f.db), /引擎冲突/)
})

test('中断重跑不会重造原事件，原数据并发变化必须报告失败', async t => {
  const f = fixture(), file = await files(t)
  f.interrupt()
  await assert.rejects(migrate(f.db, { apply: true, backupFile: file('partial') }), /ddl-interrupted/)
  assert.equal(f.writes.length, 0)
  await migrate(f.db, { apply: true, backupFile: file('resume') })
  assert.equal(f.writes.length, 1)
  const changed = fixture()
  changed.mutate()
  await assert.rejects(migrate(changed.db, { apply: true, backupFile: file('changed') }), /原库存或销售凭据变化/)
})
