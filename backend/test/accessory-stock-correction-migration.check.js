'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const { migrate, definitions, indexes } = require('../scripts/migrate-accessory-stock-corrections')
const { definitions: eventFields, nullable, indexes: eventIndexes, returnEventType, correctionEventTypes, inspect: inspectInventory } = require('../scripts/migrate-accessory-inventory-events')
const { migrate: migrateReturns } = require('../scripts/migrate-accessory-inventory-returns')
const Repository = require('../src/repositories/accessory-stock-correction.repository')

function fixture() {
  let exists = false, eventType = returnEventType, count = 0, eventCount = 0, conflict, tamper = false
  const writes = []
  const columns = (entries, correction = false) => Object.entries(entries).map(([name, type]) => ({
    COLUMN_NAME: name, COLUMN_TYPE: correction && conflict === 'type' && name === 'before_snapshot' ? 'text' : name === 'event_type' ? eventType : type,
    IS_NULLABLE: correction ? name === 'operator_name' ? 'YES' : 'NO' : nullable.has(name) ? 'YES' : 'NO',
    COLLATION_NAME: ['request_key', 'request_hash'].includes(name) ? conflict === 'collation' ? 'utf8mb4_general_ci' : 'ascii_bin' : null
  }))
  const keys = (entries, correction = false) => Object.entries(entries).flatMap(([name, names]) => names.map((column, index) => ({
    INDEX_NAME: name, COLUMN_NAME: column, NON_UNIQUE: correction ? conflict === 'index' ? 1 : 0 : name === 'PRIMARY' ? 0 : 1, SEQ_IN_INDEX: index + 1, SUB_PART: null
  })))
  const db = { async query(sql) {
    const isCorrection = sql.includes("TABLE_NAME = 'accessory_stock_corrections'")
    if (sql.includes('information_schema.TABLES')) {
      if (sql.includes('TABLE_NAME IN')) return [Array.from({ length: exists ? 7 : 6 }, () => ({ ENGINE: 'InnoDB' }))]
      return [isCorrection && !exists ? [] : [{ ENGINE: isCorrection && conflict === 'engine' ? 'MyISAM' : 'InnoDB' }]]
    }
    if (sql.includes('information_schema.COLUMNS')) {
      if (sql.includes("AND COLUMN_NAME = 'event_type'")) return [[{ COLUMN_TYPE: eventType }]]
      if (isCorrection) return [columns(definitions, true)]
      return [columns(eventFields)]
    }
    if (sql.includes('information_schema.STATISTICS')) return [isCorrection ? keys(indexes, true) : keys(eventIndexes)]
    if (sql.startsWith('SELECT COUNT')) return [[{ count: sql.includes('FROM accessory_stock_corrections') ? count : eventCount }]]
    if (sql.startsWith('SELECT *')) return [[{ id: 1, value: tamper && writes.length ? 'changed' : 'unchanged' }]]
    if (sql.startsWith('SHOW CREATE')) return [[{ Table: 'original', 'Create Table': 'original schema' }]]
    writes.push(sql)
    if (sql.startsWith('CREATE TABLE accessory_stock_corrections')) exists = true
    else if (sql.startsWith('DROP TABLE accessory_stock_corrections')) exists = false
    else if (sql.startsWith('ALTER TABLE accessory_inventory_events')) eventType = sql.match(/MODIFY COLUMN event_type (enum\(.+?\)) NOT NULL/i)?.[1] || eventType
    else throw new Error(`unexpected statement ${sql}`)
    return [{}]
  } }
  return { db, writes, conflict(value) { conflict = value }, occupied() { count = 1 }, eventUsed() { eventCount = 1 }, tamper() { tamper = true },
    async partial() { exists = true }, get eventType() { return eventType } }
}

async function temporary(t) {
  const folder = await fs.mkdtemp(path.join(os.tmpdir(), 'tf-stock-correction-'))
  t.after(() => fs.rm(folder, { recursive: true, force: true }))
  return name => path.join(folder, `${name}.json`)
}

test('更正迁移默认只读预览两条DDL；先保留7表摘要和结构，执行后原数据不变且可重复执行', async t => {
  const file = await temporary(t), f = fixture()
  const preview = await migrate(f.db)
  assert.equal(preview.writes, false); assert.equal(preview.sql.length, 2); assert.equal(f.writes.length, 0)
  await assert.rejects(migrate(f.db, { apply: true }), /backup-file/)
  const backupFile = file('before')
  const result = await migrate(f.db, { apply: true, backupFile })
  assert.equal(result.originalDataUnchanged, true); assert.equal(f.writes.length, 2)
  assert.equal((await fs.stat(backupFile)).mode & 0o777, 0o600)
  const backup = JSON.parse(await fs.readFile(backupFile, 'utf8'))
  assert.equal(Object.keys(backup.tables).length, 7)
  assert.equal(Object.keys(backup.schemas).length, 7)
  assert.equal((await migrate(f.db)).status, 'already_ready')
  assert.equal(await new Repository().ready(f.db), true)
  assert.equal(await inspectInventory(f.db), true)
})

for (const conflict of ['engine', 'type', 'collation', 'index']) {
  test(`已有更正结构${conflict}冲突时不覆盖；运行时失败关闭`, async t => {
    const file = await temporary(t), f = fixture()
    await migrate(f.db, { apply: true, backupFile: file('before') })
    f.conflict(conflict)
    await assert.rejects(migrate(f.db), /冲突/)
    assert.equal(await new Repository().ready(f.db), false)
    assert.equal(f.writes.length, 2)
  })
}

test('迁移中断只建表未扩枚举时可继续，旧库存/返库迁移接受已扩展枚举且不删除更正事件', async t => {
  const file = await temporary(t), f = fixture()
  await f.partial()
  assert.equal((await migrate(f.db)).sql.length, 1)
  await migrate(f.db, { apply: true, backupFile: file('partial') })
  assert.equal(f.eventType, correctionEventTypes[1])
  assert.equal(await inspectInventory(f.db), true)
  const preview = await migrateReturns(f.db)
  assert.ok(preview.sql.includes('source_event_id'))
  assert.equal(preview.sql.includes('MODIFY COLUMN event_type'), false)
  await assert.rejects(migrateReturns(f.db, { rollback: true }), /先受控回退商品库存更正结构/)
})

test('有更正记录或冲回流水拒绝回退；空结构回退保留原库存事件及所有原业务', async t => {
  const file = await temporary(t), f = fixture()
  await migrate(f.db, { apply: true, backupFile: file('before') })
  f.occupied()
  await assert.rejects(migrate(f.db, { rollback: true }), /已有库存更正记录/)
  const used = fixture()
  await migrate(used.db, { apply: true, backupFile: file('used') }); used.eventUsed()
  await assert.rejects(migrate(used.db, { rollback: true }), /已有库存更正流水/)
  const empty = fixture()
  await migrate(empty.db, { apply: true, backupFile: file('empty') })
  assert.equal((await migrate(empty.db, { rollback: true })).sql.length, 2)
  assert.equal((await migrate(empty.db, { apply: true, rollback: true, backupFile: file('rollback') })).originalDataUnchanged, true)
  assert.equal(empty.eventType, returnEventType)
  assert.equal((await migrate(empty.db, { rollback: true })).status, 'already_ready')
})

test('备份文件已存在和迁移期间原业务改变均停止，不虚报迁移完成', async t => {
  const file = await temporary(t), f = fixture()
  await assert.rejects(migrate(f.db, { apply: true, backupFile: __filename }), { code: 'EEXIST' })
  assert.equal(f.writes.length, 0)
  f.tamper()
  await assert.rejects(migrate(f.db, { apply: true, backupFile: file('tamper') }), /原业务记录发生变化/)
})
