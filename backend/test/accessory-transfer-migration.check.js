'use strict'
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const { migrate, inspect } = require('../scripts/migrate-accessory-transfers')
function fixture() {
  let ready = false
  const state = { writes: [], count: 0, badIndex: false, badJson: false }
  return { state, async query(sql) {
    if (sql.includes('information_schema.TABLES')) return [ready ? [{ ENGINE: 'InnoDB' }] : []]
    if (sql.includes('information_schema.COLUMNS')) return [[...'id request_key request_hash accessory_id from_store_id to_store_id quantity serial_numbers operator_id operator_name remarks created_at'.split(' ').map(COLUMN_NAME => ({ COLUMN_NAME, COLUMN_TYPE: COLUMN_NAME === 'serial_numbers' && !state.badJson ? 'json' : 'bigint', IS_NULLABLE: 'NO' }))]]
    if (sql.includes('information_schema.STATISTICS')) return [[{ COLUMN_NAME: 'request_key', NON_UNIQUE: state.badIndex ? 1 : 0 }]]
    if (sql.startsWith('SHOW CREATE')) return [[{ Table: sql.split(' ').at(-1) }]]
    if (sql.startsWith('SELECT *')) return [[{ id: 1, value: 'original' }]]
    if (sql.startsWith('SELECT COUNT')) return [[{ count: state.count }]]
    state.writes.push(sql)
    ready = sql.startsWith('CREATE')
    return [{}]
  } }
}
test('划拨迁移默认预览；备份缺失或文件已存在时禁止DDL', async () => {
  const db = fixture()
  assert.equal((await migrate(db)).status, 'dry_run')
  await assert.rejects(migrate(db, { apply: true }), /backup-file/)
  await assert.rejects(migrate(db, { apply: true, backupFile: __filename }), { code: 'EEXIST' })
  assert.deepEqual(db.state.writes, [])
})
test('迁移保留原六表摘要，可重复运行，异构结构拒绝覆盖，有记录禁止回退', async t => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'tf-transfer-migration-'))
  t.after(() => fs.rm(dir, { recursive: true, force: true }))
  const backupFile = path.join(dir, 'before.json')
  const db = fixture()
  assert.equal((await migrate(db, { apply: true, backupFile })).originalDataUnchanged, true)
  assert.equal(Object.keys(JSON.parse(await fs.readFile(backupFile, 'utf8'))).length, 6)
  assert.equal((await fs.stat(backupFile)).mode & 0o777, 0o600)
  assert.equal((await migrate(db, { apply: true, backupFile })).status, 'already_ready')
  db.state.badIndex = true
  await assert.rejects(inspect(db), /索引冲突/)
  db.state.badIndex = false
  db.state.badJson = true
  await assert.rejects(inspect(db), /结构冲突/)
  db.state.badJson = false
  db.state.count = 1
  await assert.rejects(migrate(db, { rollback: true, apply: true, backupFile }), /拒绝删除/)
  assert.equal(db.state.writes.length, 1)
})
