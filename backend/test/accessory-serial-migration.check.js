'use strict'
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const { migrate } = require('../scripts/migrate-accessory-serials')

function fixture() {
  const columns = ['accessories', 'accessory_sales'].map(TABLE_NAME => ({ TABLE_NAME, COLUMN_NAME: 'id' }))
  const tables = { accessories: [{ id: 1, name: '原装头', updated_at: '2026-11-12' }], accessory_stock: [], accessory_stock_in: [], accessory_sales: [{ id: 2, quantity: 1 }] }
  const writes = []
  return { tables, writes, async query(sql) {
    if (sql.includes('information_schema.COLUMNS')) return [columns.map(item => ({ ...item }))]
    if (sql.includes('information_schema.STATISTICS')) return [[{ COLUMN_NAME: 'serial_number', NON_UNIQUE: 0 }]]
    if (sql.startsWith('SHOW CREATE')) return [[{ Table: sql.split(' ').at(-1) }]]
    if (sql.startsWith('SELECT *')) return [tables[sql.split(' ')[3]].map(item => ({ ...item }))]
    if (sql.startsWith('SELECT COUNT')) {
      const table = sql.split(' ')[5]
      const rows = tables[table]
      return [[{ count: rows.filter(row => table === 'accessories' ? row.serial_tracking !== 0 : table === 'accessory_sales' ? row.sale_type !== 'sale' : true).length }]]
    }
    writes.push(sql)
    const added = sql.match(/ALTER TABLE (\w+) ADD COLUMN (\w+)/)
    if (added) {
      const [, table, name] = added
      columns.push({ TABLE_NAME: table, COLUMN_NAME: name, COLUMN_TYPE: name === 'serial_tracking' ? 'tinyint(1)' : 'varchar(10)', IS_NULLABLE: 'NO', COLUMN_DEFAULT: name === 'serial_tracking' ? '0' : 'sale' })
      tables[table].forEach(row => { row[name] = name === 'serial_tracking' ? 0 : 'sale' })
    }
    const created = sql.match(/CREATE TABLE (\w+)/)
    if (created) {
      const table = created[1]
      tables[table] = []
      const names = table === 'accessory_serials'
        ? ['id','accessory_id','serial_number','store_id','stock_in_id','sale_id','purchase_cost','status','created_at','updated_at']
        : ['id','serial_id','event_type','stock_in_id','sale_id','store_id','operator_id','operator_name','created_at']
      names.forEach(COLUMN_NAME => columns.push({ TABLE_NAME: table, COLUMN_NAME }))
    }
    return [{}]
  } }
}

test('SN迁移默认只预览，必须先落盘备份，文件已存在时不写库', async () => {
  const db = fixture()
  assert.equal((await migrate(db)).status, 'dry_run')
  await assert.rejects(migrate(db, { apply: true }), /backup-file/)
  await assert.rejects(migrate(db, { apply: true, backupFile: __filename }), { code: 'EEXIST' })
  assert.deepEqual(db.writes, [])
})

test('SN迁移保存原资料、金额、时间，默认数量管理及正常销售；可重入；有SN历史禁止回退', async t => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'tf-accessory-sn-'))
  t.after(() => fs.rm(dir, { recursive: true, force: true }))
  const backupFile = path.join(dir, 'before.json')
  const db = fixture()
  assert.equal((await migrate(db, { apply: true, backupFile })).originalDataUnchanged, true)
  assert.equal(JSON.parse(await fs.readFile(backupFile, 'utf8')).accessories.rows[0].serial_tracking, undefined)
  assert.deepEqual(db.tables.accessories[0], { id: 1, name: '原装头', updated_at: '2026-11-12', serial_tracking: 0 })
  assert.equal(db.tables.accessory_sales[0].sale_type, 'sale')
  const count = db.writes.length
  assert.equal((await migrate(db, { apply: true, backupFile })).status, 'already_ready')
  db.tables.accessory_serials.push({ id: 1 })
  await assert.rejects(migrate(db, { apply: true, rollback: true, backupFile }), /拒绝删除/)
  assert.equal(db.writes.length, count)
})
