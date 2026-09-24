'use strict'

const { getDatabase } = require('../config/database')

let ensurePromise = null

async function hasColumn(db, tableName, columnName) {
  const [rows] = await db.query(`
    SELECT COLUMN_NAME
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = ?
      AND COLUMN_NAME = ?
  `, [tableName, columnName])
  return rows.length > 0
}

async function ensurePriceSourceSchema() {
  if (ensurePromise) return ensurePromise

  ensurePromise = (async () => {
    const db = getDatabase()
    if (!db) throw new Error('数据库连接池为空')

    if (!(await hasColumn(db, 'price_sync_config', 'source_type'))) {
      await db.query(`
        ALTER TABLE price_sync_config
        ADD COLUMN source_type ENUM('account', 'public') NOT NULL DEFAULT 'account'
        COMMENT '采集来源：登录账户或公开未登录'
        AFTER config_name
      `)
    }

    if (!(await hasColumn(db, 'price_list', 'source_config_id'))) {
      await db.query(`
        ALTER TABLE price_list
        ADD COLUMN source_config_id INT NULL
        COMMENT '指定采集来源；NULL 表示跟随默认来源'
        AFTER external_model
      `)
    }

    // 公开采集源需要真实的配置 ID，才能与商品来源绑定并参与同步。
    // 旧系统只有登录配置时，基于默认数据源自动补一条非默认公开配置。
    const [publicSources] = await db.query(
      "SELECT id FROM price_sync_config WHERE source_type = 'public' LIMIT 1"
    )
    if (publicSources.length === 0) {
      const [defaultSources] = await db.query(
        'SELECT source_url FROM price_sync_config WHERE is_default = 1 LIMIT 1'
      )
      if (defaultSources.length > 0 && defaultSources[0].source_url) {
        await db.query(`
          INSERT INTO price_sync_config
            (config_name, source_type, source_url, login_url, login_username, login_password, sync_interval, is_default)
          VALUES (?, 'public', ?, NULL, NULL, NULL, 0, 0)
        `, ['公开未登录', defaultSources[0].source_url])
      }
    }

    await db.query(`
      CREATE TABLE IF NOT EXISTS price_source_prices (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        price_list_id INT NOT NULL,
        source_config_id INT NOT NULL,
        wholesale_price DECIMAL(12, 2) NULL,
        retail_price DECIMAL(12, 2) NULL,
        external_model VARCHAR(100) NULL,
        fetched_at DATETIME NOT NULL,
        sync_batch_id VARCHAR(64) NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uk_price_source_item (price_list_id, source_config_id),
        KEY idx_price_source_batch (sync_batch_id),
        KEY idx_price_source_fetched (fetched_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `)
  })().catch(error => {
    ensurePromise = null
    throw error
  })

  return ensurePromise
}

module.exports = { ensurePriceSourceSchema }
