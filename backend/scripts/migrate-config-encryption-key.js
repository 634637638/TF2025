'use strict'

const crypto = require('node:crypto')
const path = require('node:path')
const dotenv = require('dotenv')
const mysql = require('mysql2/promise')
const {
  decryptConfigSecret,
  encryptConfigSecret,
  getEncryptionKey,
  sealConfigMigrationBackup,
  unsealConfigMigrationBackup
} = require('../src/utils/config-secret-crypto')

const envFileArg = process.argv.find(argument => argument.startsWith('--env-file='))
const envFile = path.resolve(
  process.cwd(),
  envFileArg?.slice('--env-file='.length) || process.env.ENV_FILE || '.env'
)
dotenv.config({ path: envFile, quiet: true })

const BACKUP_TABLE = 'h5_config_encryption_backup'
const SECRET_CONFIG_KEYS = [
  'wechat_pay_api_v3_key',
  'wechat_pay_private_key',
  'alipay_private_key',
  'alipay_public_key',
  'other_payment_secret'
]
const applyChanges = process.argv.includes('--apply')
const rollbackChanges = process.argv.includes('--rollback')

if (applyChanges && rollbackChanges) throw new Error('--apply 与 --rollback 不能同时使用')

function createConnection() {
  return mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD || process.env.DB_PASS,
    database: process.env.DB_NAME,
    charset: 'utf8mb4',
    timezone: 'Z',
    dateStrings: true,
    connectTimeout: 30000
  })
}

function sha256(value) {
  return crypto.createHash('sha256').update(String(value), 'utf8').digest('hex')
}

function currentSource() {
  return [{ name: 'CONFIG_ENCRYPTION_KEY', value: process.env.CONFIG_ENCRYPTION_KEY }]
}

function previousSource() {
  return [{ name: 'CONFIG_ENCRYPTION_PREVIOUS_KEY', value: process.env.CONFIG_ENCRYPTION_PREVIOUS_KEY }]
}

function decryptWithCurrent(value) {
  return decryptConfigSecret(value, currentSource())
}

function decryptWithPrevious(value) {
  if (!String(value || '').startsWith('enc:v1:')) return String(value || '')
  return decryptConfigSecret(value, previousSource())
}

function isEncryptedWithCurrent(value) {
  try {
    decryptWithCurrent(value)
    return true
  } catch {
    return false
  }
}

async function ensureBackupTable(db) {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS ${BACKUP_TABLE} (
      config_id BIGINT NOT NULL PRIMARY KEY,
      config_key VARCHAR(191) NOT NULL,
      previous_ciphertext_wrapped TEXT NOT NULL,
      migrated_ciphertext_hash CHAR(64) NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
}

async function backupTableExists(db) {
  const [rows] = await db.execute(
    `SELECT COUNT(*) AS count
     FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
    [BACKUP_TABLE]
  )
  return Number(rows[0]?.count || 0) === 1
}

async function loadConfigs(db) {
  const placeholders = SECRET_CONFIG_KEYS.map(() => '?').join(', ')
  const [rows] = await db.execute(
    `SELECT id, config_key, config_value
     FROM H5_config
     WHERE config_key IN (${placeholders})
       AND config_value IS NOT NULL
       AND config_value <> ''
     ORDER BY id`,
    SECRET_CONFIG_KEYS
  )
  return rows
}

async function loadBackups(db) {
  if (!await backupTableExists(db)) return []
  const [rows] = await db.execute(
    `SELECT config_id, config_key, previous_ciphertext_wrapped, migrated_ciphertext_hash
     FROM ${BACKUP_TABLE}
     ORDER BY config_id`
  )
  return rows
}

async function applyMigration(db, configs) {
  getEncryptionKey()
  await ensureBackupTable(db)
  await db.beginTransaction()
  try {
    let migrated = 0
    for (const config of configs) {
      if (isEncryptedWithCurrent(config.config_value)) continue

      const plaintext = decryptWithPrevious(config.config_value)
      const migratedCiphertext = encryptConfigSecret(plaintext)
      if (decryptWithCurrent(migratedCiphertext) !== plaintext) {
        throw new Error(`配置 ${config.config_key} 新密文回读校验失败`)
      }

      await db.execute(
        `INSERT INTO ${BACKUP_TABLE}
         (config_id, config_key, previous_ciphertext_wrapped, migrated_ciphertext_hash)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           config_key = VALUES(config_key),
           previous_ciphertext_wrapped = VALUES(previous_ciphertext_wrapped),
           migrated_ciphertext_hash = VALUES(migrated_ciphertext_hash),
           updated_at = NOW()`,
        [
          config.id,
          config.config_key,
          sealConfigMigrationBackup(config.config_value),
          sha256(migratedCiphertext)
        ]
      )

      const [result] = await db.execute(
        `UPDATE H5_config
         SET config_value = ?, updated_at = NOW()
         WHERE id = ? AND config_value = ?`,
        [migratedCiphertext, config.id, config.config_value]
      )
      if (result.affectedRows !== 1) throw new Error(`配置 ${config.config_key} 迁移时发生并发修改`)
      migrated += 1
    }
    await db.commit()
    return migrated
  } catch (error) {
    await db.rollback()
    throw error
  }
}

async function rollbackMigration(db, configs, backups) {
  getEncryptionKey()
  if (backups.length === 0) throw new Error('未找到配置密钥迁移备份，拒绝回滚')

  const configById = new Map(configs.map(item => [Number(item.id), item]))
  await db.beginTransaction()
  try {
    let restored = 0
    for (const backup of backups) {
      const config = configById.get(Number(backup.config_id))
      if (!config) continue
      if (sha256(config.config_value) !== backup.migrated_ciphertext_hash) {
        throw new Error(`配置 ${backup.config_key} 在迁移后已修改，拒绝覆盖回滚`)
      }

      const previousCiphertext = unsealConfigMigrationBackup(backup.previous_ciphertext_wrapped)
      const [result] = await db.execute(
        `UPDATE H5_config
         SET config_value = ?, updated_at = NOW()
         WHERE id = ? AND config_value = ?`,
        [previousCiphertext, config.id, config.config_value]
      )
      if (result.affectedRows !== 1) throw new Error(`配置 ${backup.config_key} 回滚时发生并发修改`)
      restored += 1
    }
    await db.commit()
    return restored
  } catch (error) {
    await db.rollback()
    throw error
  }
}

async function verifyCurrent(db) {
  const configs = await loadConfigs(db)
  for (const config of configs) decryptWithCurrent(config.config_value)
  return configs.length
}

async function main() {
  const db = await createConnection()
  try {
    const [[databaseRow]] = await db.execute('SELECT DATABASE() AS database_name')
    const configs = await loadConfigs(db)
    const backups = await loadBackups(db)
    const current = configs.filter(config => isEncryptedWithCurrent(config.config_value)).length
    const summary = { total: configs.length, current, requiresMigration: configs.length - current, backups: backups.length }

    if (!applyChanges && !rollbackChanges) {
      console.log(JSON.stringify({
        status: summary.requiresMigration > 0 ? 'dry_run' : 'already_ready',
        database: databaseRow?.database_name || process.env.DB_NAME,
        envFile,
        summary,
        instruction: summary.requiresMigration > 0
          ? '确认 current/previous 配置正确后追加 --apply；迁移仅处理支付秘密字段'
          : null
      }, null, 2))
      return
    }

    if (rollbackChanges) {
      const restored = await rollbackMigration(db, configs, backups)
      console.log(JSON.stringify({
        status: 'rolled_back',
        database: databaseRow?.database_name || process.env.DB_NAME,
        envFile,
        restored,
        instruction: '回滚后必须把 CONFIG_ENCRYPTION_KEY 切回上一密钥，或继续保留 CONFIG_ENCRYPTION_PREVIOUS_KEY'
      }, null, 2))
      return
    }

    const migrated = await applyMigration(db, configs)
    const verified = await verifyCurrent(db)
    console.log(JSON.stringify({
      status: 'migrated_and_verified',
      database: databaseRow?.database_name || process.env.DB_NAME,
      envFile,
      migrated,
      verified,
      instruction: '确认应用读写正常后，达到回滚观察期再移除 CONFIG_ENCRYPTION_PREVIOUS_KEY'
    }, null, 2))
  } finally {
    await db.end()
  }
}

main().catch(error => {
  console.error(JSON.stringify({
    status: 'failed',
    code: error.code || 'CONFIG_ENCRYPTION_MIGRATION_ERROR',
    message: error.message
  }, null, 2))
  process.exitCode = 1
})
