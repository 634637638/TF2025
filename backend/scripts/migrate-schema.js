'use strict'

process.env.SCHEMA_MIGRATION_MODE = 'true'

const crypto = require('crypto')
const { connectToDatabase, getDatabase, closeDatabase } = require('../src/config/database')

const MIGRATION_ID = '20261104_runtime_schema_baseline'
const MIGRATION_NAME = '将历史运行时结构补齐纳入显式迁移台账'
const CHECKSUM_SOURCE = `${MIGRATION_ID}:${MIGRATION_NAME}:v2`
const MIGRATION_LOCK_NAME = 'tf2025_schema_migration'
const applyChanges = process.argv.includes('--apply')

async function ensureMigrationLedger(db) {
  await db.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id VARCHAR(80) NOT NULL,
      name VARCHAR(255) NOT NULL,
      checksum CHAR(64) NOT NULL,
      applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      execution_time INT UNSIGNED NOT NULL DEFAULT 0,
      PRIMARY KEY (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)
}

async function findExistingMigration(db) {
  const [ledgerTables] = await db.query(`
    SELECT 1 AS present
    FROM information_schema.tables
    WHERE table_schema = DATABASE()
      AND table_name = 'schema_migrations'
    LIMIT 1
  `)
  if (ledgerTables.length === 0) return []

  const [rows] = await db.query(
    'SELECT checksum, applied_at FROM schema_migrations WHERE id = ? LIMIT 1',
    [MIGRATION_ID]
  )
  return rows
}

function assertExistingChecksum(existingRows, checksum) {
  if (existingRows.length > 0 && existingRows[0].checksum !== checksum) {
    throw new Error(`迁移 ${MIGRATION_ID} 校验和不一致，禁止自动覆盖`)
  }
}

async function runMigration(db) {
  const { ensureRentalSchema } = require('../src/utils/rental-schema')
  const { ensureSupplierPaymentSchema } = require('../src/utils/supplier-payment-schema')
  const { migrateShopTemplateMediaSchema } = require('../src/utils/shop-template-media-schema')
  const { ensurePriceSourceSchema } = require('../src/utils/price-source-schema')
  const { ensureAttendanceSchema } = require('../src/utils/attendance-schema')
  const { ensureFrontendErrorLogSchema } = require('../src/utils/frontend-error-log-schema')
  const { ensureGuideSchema } = require('../src/utils/guide-schema')
  const { ensureSharedSchema } = require('../src/utils/shared-schema')
  const { ensureReminderSchema } = require('../src/utils/reminder-schema')
  const { ensurePhoneStockWarningSchema } = require('../src/utils/phone-stock-warning-schema')
  const { ensureIconSchema, ensureMenuIconSchema } = require('../src/utils/iconStore')
  const { ensureRateLimitLogTable } = require('../src/middleware/rate-limit')
  const { ensureDataCheckBackupSchema } = require('../src/utils/data-check-backup-schema')

  await ensureRentalSchema()
  await ensureSupplierPaymentSchema()
  await migrateShopTemplateMediaSchema(db)
  await ensurePriceSourceSchema()
  await ensureAttendanceSchema()
  await ensureFrontendErrorLogSchema()
  await ensureGuideSchema()
  await ensureSharedSchema()
  await ensureReminderSchema()
  await ensurePhoneStockWarningSchema()
  await ensureIconSchema(db)
  await ensureMenuIconSchema(db)
  await ensureRateLimitLogTable(db)
  await ensureDataCheckBackupSchema(db)
  await db.query(`
    CREATE TABLE IF NOT EXISTS invoice_sequences (
      sequence_date CHAR(8) NOT NULL,
      type_suffix VARCHAR(4) NOT NULL,
      current_sequence INT UNSIGNED NOT NULL DEFAULT 0,
      PRIMARY KEY (sequence_date, type_suffix)
    ) ENGINE=InnoDB
  `)
}

async function main() {
  const connected = await connectToDatabase()
  if (!connected) throw new Error('数据库连接失败')
  const db = getDatabase()
  const checksum = crypto.createHash('sha256').update(CHECKSUM_SOURCE).digest('hex')
  let existingRows = await findExistingMigration(db)
  assertExistingChecksum(existingRows, checksum)
  if (existingRows.length > 0) {
    console.log(`迁移已登记，无需重复执行: ${MIGRATION_ID}`)
    return
  }

  if (!applyChanges) {
    console.log(JSON.stringify({
      mode: 'dry-run',
      pending: true,
      id: MIGRATION_ID,
      name: MIGRATION_NAME,
      applyCommand: 'npm run migrate:schema -- --apply'
    }, null, 2))
    return
  }

  const lockConnection = await db.getConnection()
  try {
    const [[lockResult]] = await lockConnection.query('SELECT GET_LOCK(?, 10) AS acquired', [MIGRATION_LOCK_NAME])
    if (Number(lockResult?.acquired) !== 1) throw new Error('无法获取数据库迁移锁，请稍后重试')

    await ensureMigrationLedger(db)
    existingRows = await findExistingMigration(db)
    assertExistingChecksum(existingRows, checksum)
    if (existingRows.length > 0) {
      console.log(`迁移已由其他进程完成: ${MIGRATION_ID}`)
      return
    }

    const startedAt = Date.now()
    await runMigration(db)
    await db.query(
      'INSERT INTO schema_migrations (id, name, checksum, execution_time) VALUES (?, ?, ?, ?)',
      [MIGRATION_ID, MIGRATION_NAME, checksum, Date.now() - startedAt]
    )
    console.log(`迁移完成: ${MIGRATION_ID}`)
  } finally {
    await lockConnection.query('SELECT RELEASE_LOCK(?)', [MIGRATION_LOCK_NAME]).catch(() => {})
    lockConnection.release()
  }
}

main()
  .catch(error => {
    console.error(`迁移失败: ${error.message}`)
    process.exitCode = 1
  })
  .finally(() => closeDatabase())
