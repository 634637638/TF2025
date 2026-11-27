'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')

const { migrate } = require('../scripts/migrate-subsidy-identifier-nullability')

function createDatabase({ nullable = false, nullCount = 0 } = {}) {
  const state = { nullable, nullCount }
  return {
    state,
    async execute(sql) {
      if (sql.includes('information_schema.COLUMNS')) {
        return [[{
          COLUMN_NAME: 'imei1',
          COLUMN_TYPE: 'varchar(50)',
          IS_NULLABLE: state.nullable ? 'YES' : 'NO',
          COLUMN_DEFAULT: null
        }]]
      }
      if (sql.includes('SELECT COUNT(*) AS null_count')) return [[{ null_count: state.nullCount }]]
      if (sql.startsWith('ALTER TABLE')) {
        state.nullable = sql.includes('VARCHAR(50) NULL')
        return [[]]
      }
      throw new Error(`unexpected SQL: ${sql}`)
    }
  }
}

test('国补 IMEI1 可空迁移支持预览和执行后结构核验', async () => {
  const previewDb = createDatabase()
  const preview = await migrate(previewDb, { apply: false, rollback: false })
  assert.equal(preview.status, 'dry_run')
  assert.match(preview.sql, /MODIFY COLUMN imei1 VARCHAR\(50\) NULL/)
  assert.equal(previewDb.state.nullable, false)

  const applyDb = createDatabase()
  const applied = await migrate(applyDb, { apply: true, rollback: false })
  assert.equal(applied.status, 'migrated_and_verified')
  assert.equal(applied.after.column.IS_NULLABLE, 'YES')
  assert.equal(applyDb.state.nullable, true)
})

test('国补 IMEI1 已产生空值时禁止回退为非空字段', async () => {
  const db = createDatabase({ nullable: true, nullCount: 1 })
  await assert.rejects(
    () => migrate(db, { apply: false, rollback: true }),
    /已有空 IMEI1 记录，拒绝回退为 NOT NULL/
  )
})
