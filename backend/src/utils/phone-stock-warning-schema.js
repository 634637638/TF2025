const { getDatabase } = require('../config/database');

let ensurePromise = null;

async function runEnsurePhoneStockWarningSchema() {
  const db = getDatabase();

  if (!db) {
    throw new Error('数据库连接池为空');
  }

  const [columns] = await db.query(`
    SELECT COLUMN_NAME
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'phone_stock_warnings'
      AND COLUMN_NAME = 'is_new'
  `);

  if (columns.length === 0) {
    await db.query(`
      ALTER TABLE phone_stock_warnings
      ADD COLUMN is_new TINYINT(1) DEFAULT NULL
      COMMENT '库存成色：1-全新，0-二手，NULL-全部'
      AFTER memory_id
    `);
  }

  const [indexes] = await db.query(`
    SHOW INDEX FROM phone_stock_warnings
    WHERE Key_name = 'idx_is_new'
  `);

  if (indexes.length === 0) {
    await db.query(`
      ALTER TABLE phone_stock_warnings
      ADD INDEX idx_is_new (is_new)
    `);
  }
}

async function ensurePhoneStockWarningSchema() {
  if (!ensurePromise) {
    ensurePromise = runEnsurePhoneStockWarningSchema().catch(error => {
      ensurePromise = null;
      throw error;
    });
  }

  return ensurePromise;
}

module.exports = {
  ensurePhoneStockWarningSchema
};
