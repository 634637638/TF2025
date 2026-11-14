'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const path = require('node:path')
const os = require('node:os')
const checkoutFixture = require('./helpers/sales-checkout-schema')
const { migrate: migrateCheckout } = require('../scripts/migrate-sales-checkout')
const { migrate } = require('../scripts/migrate-sales-aftersales')

async function fixture(t, ready = true) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'tf-sales-aftersale-migration-'))
  t.after(() => fs.rm(directory, { recursive: true, force: true }))
  const file = name => path.join(directory, `${name}.json`)
  const base = checkoutFixture()
  if (ready) await migrateCheckout(base.db, { apply: true, backupFile: file('checkout') })
  const fields = [], indexes = [], tables = [], data = {}, foreign = [], writes = []
  let failAfter = Infinity, changed = false
  const db = { async query(sql, params = []) {
    const table = params[0]
    if (sql.includes('information_schema') && typeof table === 'string' && (table.startsWith('sales_aftersale') || table === 'sales_goods_exchanges')) {
      if (sql.includes('information_schema.TABLES')) return [tables.filter(row => row.TABLE_NAME === table)]
      if (sql.includes('information_schema.COLUMNS')) return [fields.filter(row => row.TABLE_NAME === table)]
      if (sql.includes('information_schema.STATISTICS')) return [indexes.filter(row => row.TABLE_NAME === table).sort((a, b) => a.SEQ_IN_INDEX - b.SEQ_IN_INDEX)]
      if (sql.includes('information_schema.KEY_COLUMN_USAGE')) return [foreign.filter(row => row.TABLE_NAME === table)]
    }
    if (sql.startsWith('SHOW CREATE')) return [[{ 'Create Table': 'original schema' }]]
    if (sql.startsWith('SELECT COUNT(*)')) {
      const rows = data[sql.match(/`(\w+)`/)[1]] || []
      const column = sql.match(/WHERE (\w+) <> 0/)?.[1]
      return [[{ count: column ? rows.filter(row => row[column] !== 0).length : rows.length }]]
    }
    if (sql.startsWith('SELECT * FROM')) {
      const name = sql.match(/`(\w+)`/)[1]
      return [changed && writes.length ? [{ id: 99 }] : structuredClone(data[name] || [])]
    }
    if (/^ALTER TABLE `sales_aftersales`/.test(sql)) {
      if (writes.length === failAfter) { failAfter = Infinity; throw new Error('ddl-interrupted') }
      writes.push(sql)
      if (sql.includes('MODIFY COLUMN `operation_type`')) fields.find(row => row.COLUMN_NAME === 'operation_type').COLUMN_TYPE = "enum('goods_return','phone_return','goods_exchange')"
      else {
        const column = sql.match(/ADD COLUMN `(\w+)`/)[1]
        fields.push({ TABLE_NAME: 'sales_aftersales', COLUMN_NAME: column, COLUMN_TYPE: 'bigint unsigned', IS_NULLABLE: 'NO', COLUMN_DEFAULT: '0', EXTRA: '', COLLATION_NAME: null })
        for (const row of data.sales_aftersales) row[column] = 0
      }
      return [{}]
    }
    if (/^(CREATE|DROP) TABLE `sales_(?:aftersale|goods_exchanges)/.test(sql)) {
      if (writes.length === failAfter) { failAfter = Infinity; throw new Error('ddl-interrupted') }
      writes.push(sql)
      const name = sql.match(/TABLE `(\w+)`/)[1]
      if (sql.startsWith('DROP')) {
        tables.splice(tables.findIndex(row => row.TABLE_NAME === name), 1)
        for (const rows of [fields, indexes]) for (let i = rows.length - 1; i >= 0; i--) if (rows[i].TABLE_NAME === name) rows.splice(i, 1)
        delete data[name]
        return [{}]
      }
      tables.push({ TABLE_NAME: name, ENGINE: 'InnoDB' }); data[name] = []
      for (const match of sql.matchAll(/`(\w+)` ((?:bigint|int)(?: unsigned)?|varchar\(\d+\)|char\(\d+\)|enum\('[^)]*\)|json|datetime)(?: CHARACTER SET ascii COLLATE ascii_bin)? (NOT NULL|NULL)( AUTO_INCREMENT)?/g)) {
        fields.push({ TABLE_NAME: name, COLUMN_NAME: match[1], COLUMN_TYPE: match[2], IS_NULLABLE: match[3] === 'NULL' ? 'YES' : 'NO',
          COLUMN_DEFAULT: ['gift_charge_cents', 'replacement_cents'].includes(match[1]) ? '0' : null,
          EXTRA: match[4] ? 'auto_increment' : '', COLLATION_NAME: ['request_key', 'request_hash'].includes(match[1]) ? 'ascii_bin' : null })
      }
      for (const match of sql.matchAll(/(PRIMARY KEY|(?:UNIQUE )?KEY `(\w+)`) \(([^)]+)\)/g)) {
        const unique = match[1] === 'PRIMARY KEY' || match[1].startsWith('UNIQUE')
        const columns = [...match[3].matchAll(/`(\w+)`/g)].map(value => value[1])
        columns.forEach((column, i) => indexes.push({ TABLE_NAME: name, INDEX_NAME: match[2] || 'PRIMARY', COLUMN_NAME: column, SEQ_IN_INDEX: i + 1, NON_UNIQUE: Number(!unique) }))
      }
      return [{}]
    }
    return base.db.query(sql, params)
  } }
  return { db, file, fields, indexes, tables, data, foreign, writes, interrupt(count) { failAfter = count }, mutate() { changed = true } }
}

test('共同售后迁移要求原共同单结构完整；默认三张追加凭据预览零写入，不新建库存或积分主表', async t => {
  const notReady = await fixture(t, false)
  await assert.rejects(migrate(notReady.db), /先完成共同结算/)
  const f = await fixture(t), result = await migrate(f.db)
  assert.equal(result.status, 'dry_run'); assert.equal(result.sql.length, 3)
  assert.equal(result.sql.map(sql => sql.match(/CREATE TABLE `(\w+)`/)[1]).sort().join(','), 'sales_aftersale_items,sales_aftersales,sales_goods_exchanges')
  assert.equal(f.writes.length, 0)
})

test('执行先独占0600摘要/结构备份；原数据摘要守恒，重复运行不重复建表', async t => {
  const f = await fixture(t)
  await assert.rejects(migrate(f.db, { apply: true }), /backup-file/)
  await assert.rejects(migrate(f.db, { apply: true, backupFile: __filename }), { code: 'EEXIST' })
  assert.equal(f.writes.length, 0)
  const backupFile = f.file('before')
  assert.equal((await migrate(f.db, { apply: true, backupFile })).status, 'migrated_and_verified')
  const backup = JSON.parse(await fs.readFile(backupFile, 'utf8'))
  assert.equal(Object.keys(backup.tables).length, 11)
  assert.deepEqual(Object.keys(backup.tables.sales_orders).sort(), ['count', 'digest'])
  assert.equal((await fs.stat(backupFile)).mode & 0o777, 0o600)
  assert.equal((await migrate(f.db)).status, 'already_ready'); assert.equal(f.writes.length, 3)
})

test('中断只补缺失表；字段、大小写排序、唯一索引和外键冲突均拒绝覆盖', async t => {
  const f = await fixture(t)
  f.interrupt(1)
  await assert.rejects(migrate(f.db, { apply: true, backupFile: f.file('partial') }), /ddl-interrupted/)
  assert.equal(f.tables.length, 1)
  await migrate(f.db, { apply: true, backupFile: f.file('retry') })
  const field = f.fields.find(row => row.COLUMN_NAME === 'request_key')
  field.COLLATION_NAME = 'ascii_general_ci'
  await assert.rejects(migrate(f.db), /字段结构冲突/)
  field.COLLATION_NAME = 'ascii_bin'
  const index = f.indexes.find(row => row.INDEX_NAME === 'uq_sales_aftersale_request')
  index.NON_UNIQUE = 1
  await assert.rejects(migrate(f.db), /索引结构冲突/)
  index.NON_UNIQUE = 0
  f.foreign.push({ TABLE_NAME: 'sales_aftersale_items', CONSTRAINT_NAME: 'unexpected' })
  await assert.rejects(migrate(f.db), /未知外键/)
})

test('只有空凭据允许受控回退，头或明细任一有历史连预览均拒绝；迁移期间原事实变化报错', async t => {
  const f = await fixture(t)
  await migrate(f.db, { apply: true, backupFile: f.file('before') })
  for (const table of ['sales_aftersales', 'sales_aftersale_items', 'sales_goods_exchanges']) {
    f.data[table].push({ id: 1 })
    await assert.rejects(migrate(f.db, { rollback: true }), /已有共同售后历史/)
    f.data[table] = []
  }
  await assert.rejects(migrate(f.db, { apply: true, rollback: true }), /backup-file/)
  assert.equal((await migrate(f.db, { apply: true, rollback: true, backupFile: f.file('rollback') })).status, 'migrated_and_verified')
  assert.equal((await migrate(f.db, { rollback: true })).status, 'already_ready')
  const changed = await fixture(t); changed.mutate()
  await assert.rejects(migrate(changed.db, { apply: true, backupFile: changed.file('changed') }), /原销售、库存或收款事实变化/)
})

test('已安装旧商品售后可原地追加手机类型和赠品扣款，旧头/明细原样保留，DDL中断只补缺项', async t => {
  const f = await fixture(t)
  await migrate(f.db, { apply: true, backupFile: f.file('initial') })
  f.fields.find(row => row.COLUMN_NAME === 'operation_type').COLUMN_TYPE = "enum('goods_return')"
  f.fields.splice(f.fields.findIndex(row => row.COLUMN_NAME === 'gift_charge_cents'), 1)
  f.data.sales_aftersales.push({ id: 1, operation_type: 'goods_return', result_snapshot: { refund: 10 }, replacement_cents: 0 })
  f.data.sales_aftersale_items.push({ id: 1, aftersale_id: 1, fact_snapshot: { original: true } })
  const before = structuredClone(f.data), writes = f.writes.length
  const preview = await migrate(f.db)
  assert.equal(preview.sql.length, 2); assert.equal(f.writes.length, writes)
  f.interrupt(writes + 1)
  await assert.rejects(migrate(f.db, { apply: true, backupFile: f.file('partial-upgrade') }), /ddl-interrupted/)
  assert.equal((await migrate(f.db)).sql.length, 1)
  await migrate(f.db, { apply: true, backupFile: f.file('finish-upgrade') })
  assert.deepEqual(f.data.sales_aftersales, before.sales_aftersales.map(row => ({ ...row, gift_charge_cents: 0 })))
  assert.deepEqual(f.data.sales_aftersale_items, before.sales_aftersale_items)
  assert.equal((await migrate(f.db)).status, 'already_ready')
  await assert.rejects(migrate(f.db, { rollback: true }), /已有共同售后历史/)
  f.fields.find(row => row.COLUMN_NAME === 'gift_charge_cents').COLUMN_DEFAULT = null
  await assert.rejects(migrate(f.db), /字段结构冲突/)
})

test('旧手机售后原地增加换货类型、零默认替换金额及关系表；中断后不改历史只补缺失结构', async t => {
  const f = await fixture(t)
  await migrate(f.db, { apply: true, backupFile: f.file('initial') })
  f.tables.splice(f.tables.findIndex(row => row.TABLE_NAME === 'sales_goods_exchanges'), 1)
  for (const rows of [f.fields, f.indexes]) for (let i = rows.length - 1; i >= 0; i--) if (rows[i].TABLE_NAME === 'sales_goods_exchanges') rows.splice(i, 1)
  delete f.data.sales_goods_exchanges
  f.fields.splice(f.fields.findIndex(row => row.COLUMN_NAME === 'replacement_cents'), 1)
  f.fields.find(row => row.COLUMN_NAME === 'operation_type').COLUMN_TYPE = "enum('goods_return','phone_return')"
  f.data.sales_aftersales.push({ id: 1, operation_type: 'phone_return', gift_charge_cents: 500, result_snapshot: { original: true } })
  f.data.sales_aftersale_items.push({ id: 1, aftersale_id: 1, fact_snapshot: { original: true } })
  const before = structuredClone(f.data)
  assert.equal((await migrate(f.db)).sql.length, 3)
  f.interrupt(f.writes.length + 2)
  await assert.rejects(migrate(f.db, { apply: true, backupFile: f.file('partial') }), /ddl-interrupted/)
  assert.equal((await migrate(f.db)).sql.length, 1)
  await migrate(f.db, { apply: true, backupFile: f.file('retry') })
  assert.deepEqual(f.data.sales_aftersales, before.sales_aftersales.map(row => ({ ...row, replacement_cents: 0 })))
  assert.deepEqual(f.data.sales_aftersale_items, before.sales_aftersale_items)
  assert.equal((await migrate(f.db)).status, 'already_ready')
  f.fields.find(row => row.COLUMN_NAME === 'replacement_cents').IS_NULLABLE = 'YES'
  await assert.rejects(migrate(f.db), /字段结构冲突/)
})
