'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const { migrate } = require('../scripts/remove-accessory-specifications')

const fixture = () => {
  let present = true
  const rows = [{ id: 1, product_model: 'MWVW3CH', specifications: '旧规格', updated_at: '2026-11-12' }]
  const writes = []
  return {
    rows, writes,
    async query(sql, params) {
      if (sql.includes('information_schema.COLUMNS')) return [[
        { COLUMN_NAME: 'product_model' },
        ...(present ? [{ COLUMN_NAME: 'specifications', COLUMN_TYPE: 'text', IS_NULLABLE: 'YES', COLUMN_DEFAULT: null }] : [])
      ]]
      if (sql.includes('information_schema.STATISTICS')) return [[]]
      if (sql.startsWith('SELECT *')) return [rows.map(row => ({ ...row }))]
      writes.push(sql)
      if (sql.includes('DROP COLUMN')) { present = false; rows.forEach(row => { delete row.specifications }) }
      if (sql.includes('ADD COLUMN')) { present = true; rows.forEach(row => { row.specifications = null }) }
      if (sql.startsWith('UPDATE')) rows.find(row => row.id === params[1]).specifications = params[0]
      return [{}]
    },
    async beginTransaction() {}, async commit() {}, async rollback() {}
  }
}

test('移除规格默认只预览；实际执行必须指定落盘备份', async () => {
  const db = fixture()
  assert.equal((await migrate(db)).status, 'dry_run')
  await assert.rejects(migrate(db, { apply: true }), /备份路径/)
  assert.deepEqual(db.writes, [])
})

test('规格删除前备份、可恢复，不改型号及更新时间，重复执行不写库', async t => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'tf-accessory-specs-'))
  t.after(() => fs.rm(directory, { recursive: true, force: true }))
  const backupFile = path.join(directory, 'before.json')
  const db = fixture()
  const result = await migrate(db, { apply: true, backupFile })
  assert.equal(result.status, 'migrated_and_verified')
  assert.deepEqual(db.rows, [{ id: 1, product_model: 'MWVW3CH', updated_at: '2026-11-12' }])
  assert.equal(JSON.parse(await fs.readFile(backupFile, 'utf8')).rows[0].specifications, '旧规格')
  const count = db.writes.length
  assert.equal((await migrate(db, { apply: true, backupFile })).status, 'already_ready')
  assert.equal(db.writes.length, count)
  assert.equal((await migrate(db, { apply: true, rollback: true, backupFile })).status, 'restored')
  assert.equal(db.rows[0].specifications, '旧规格')
  assert.equal(db.rows[0].product_model, 'MWVW3CH')
})

test('无法写入备份时不得删除数据库字段', async () => {
  const db = fixture()
  await assert.rejects(migrate(db, { apply: true, backupFile: __filename }), { code: 'EEXIST' })
  assert.deepEqual(db.writes, [])
})
