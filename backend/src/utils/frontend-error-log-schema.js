'use strict'

const { getDatabase } = require('../config/database')
const { schemaChangesAllowed } = require('./schema-change-policy')

let ensurePromise = null

async function ensureFrontendErrorLogSchema() {
  if (!schemaChangesAllowed()) return
  if (ensurePromise) return ensurePromise

  ensurePromise = (async () => {
    const db = getDatabase()
    if (!db) throw new Error('数据库连接池为空')

    await db.query(`
      CREATE TABLE IF NOT EXISTS frontend_error_logs (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        error_key VARCHAR(80) NOT NULL,
        user_id BIGINT UNSIGNED NOT NULL,
        session_id VARCHAR(128) NOT NULL,
        level VARCHAR(20) NOT NULL,
        error_type VARCHAR(40) NOT NULL,
        message VARCHAR(1000) NOT NULL,
        stack MEDIUMTEXT NULL,
        context JSON NULL,
        component VARCHAR(160) NULL,
        action_name VARCHAR(160) NULL,
        tags JSON NULL,
        occurred_at DATETIME(3) NOT NULL,
        occurrence_count INT UNSIGNED NOT NULL DEFAULT 1,
        page_url VARCHAR(2048) NULL,
        user_agent VARCHAR(512) NULL,
        environment JSON NULL,
        session_data JSON NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uk_frontend_error_event (user_id, session_id, error_key, occurred_at),
        KEY idx_frontend_error_created (created_at),
        KEY idx_frontend_error_level (level, created_at),
        KEY idx_frontend_error_user (user_id, created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `)
  })().catch(error => {
    ensurePromise = null
    throw error
  })

  return ensurePromise
}

module.exports = { ensureFrontendErrorLogSchema }
