const { getDatabase } = require('../config/database')

let ensurePromise = null

async function runEnsurePhoneStockWarningSchema() {
  const db = getDatabase()

  if (!db) {
    throw new Error('数据库连接池为空')
  }

  const [columns] = await db.query(`
    SELECT COLUMN_NAME
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'phone_stock_warnings'
      AND COLUMN_NAME = 'is_new'
  `)

  if (columns.length === 0) {
    await db.query(`
      ALTER TABLE phone_stock_warnings
      ADD COLUMN is_new TINYINT(1) DEFAULT NULL
      COMMENT '库存成色：1-全新，0-二手，NULL-全部'
      AFTER memory_id
    `)
  }

  const [indexes] = await db.query(`
    SHOW INDEX FROM phone_stock_warnings
    WHERE Key_name = 'idx_is_new'
  `)

  if (indexes.length === 0) {
    await db.query(`
      ALTER TABLE phone_stock_warnings
      ADD INDEX idx_is_new (is_new)
    `)
  }

  // 库存预警的全新和二手是两个独立配置，唯一约束必须包含 is_new。
  // 旧版本索引没有该字段，会导致保存同一规格的全新/二手配置时报重复键 500。
  const [uniqueIndexes] = await db.query(`
    SELECT INDEX_NAME, GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX) AS index_columns
    FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'phone_stock_warnings'
      AND NON_UNIQUE = 0
      AND INDEX_NAME <> 'PRIMARY'
    GROUP BY INDEX_NAME
  `)

  const expectedColumns = 'brand_id,model_id,color_id,memory_id,is_new'
  const conditionUniqueIndex = uniqueIndexes.find(index => index.index_columns === expectedColumns)
  const legacyUniqueIndexes = uniqueIndexes.filter(index =>
    index.index_columns === 'brand_id,model_id,color_id,memory_id'
  )

  for (const index of legacyUniqueIndexes) {
    await db.query(`ALTER TABLE phone_stock_warnings DROP INDEX \`${index.INDEX_NAME}\``)
  }

  if (!conditionUniqueIndex) {
    await db.query(`
      ALTER TABLE phone_stock_warnings
      ADD UNIQUE KEY unique_brand_model_color_memory_condition
      (brand_id, model_id, color_id, memory_id, is_new)
    `)
  }
}

async function ensurePhoneStockWarningSchema() {
  if (!ensurePromise) {
    ensurePromise = runEnsurePhoneStockWarningSchema().catch(error => {
      ensurePromise = null
      throw error
    })
  }

  return ensurePromise
}

module.exports = {
  ensurePhoneStockWarningSchema
}
