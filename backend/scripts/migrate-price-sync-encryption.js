'use strict'

const crypto = require('node:crypto')
const path = require('node:path')
const dotenv = require('dotenv')
const mysql = require('mysql2/promise')
const {
  decryptPriceSyncPassword,
  encryptPriceSyncPassword,
  getEncryptionKey,
  isPriceSyncCiphertext,
  sealLegacyCiphertext,
  unsealLegacyCiphertext
} = require('../src/utils/price-sync-crypto')

dotenv.config({ path: path.resolve(__dirname, '../.env'), quiet: true })

const BACKUP_TABLE = 'price_sync_encryption_backup'
const applyChanges = process.argv.includes('--apply')
const rollbackChanges = process.argv.includes('--rollback')

if (applyChanges && rollbackChanges) {
  throw new Error('--apply 与 --rollback 不能同时使用')
}

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

function decryptLegacyCiphertext(ciphertext) {
  const passphrase = process.env.PRICE_SYNC_LEGACY_PASSPHRASE
  const salt = process.env.PRICE_SYNC_LEGACY_SALT
  if (!passphrase || !salt) {
    throw new Error('迁移旧密文必须临时设置 PRICE_SYNC_LEGACY_PASSPHRASE 和 PRICE_SYNC_LEGACY_SALT')
  }

  const parts = String(ciphertext || '').split(':')
  if (parts.length !== 2 || !/^[a-f0-9]{32}$/i.test(parts[0]) || !/^[a-f0-9]+$/i.test(parts[1])) {
    throw new Error('发现无法识别的旧价格同步密文')
  }

  const key = crypto.scryptSync(passphrase, salt, 32)
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, Buffer.from(parts[0], 'hex'))
  return Buffer.concat([
    decipher.update(Buffer.from(parts[1], 'hex')),
    decipher.final()
  ]).toString('utf8')
}

async function ensureBackupTable(db) {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS ${BACKUP_TABLE} (
      config_id BIGINT NOT NULL PRIMARY KEY,
      legacy_ciphertext_wrapped TEXT NOT NULL,
      migrated_ciphertext_hash CHAR(64) NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
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
  const [rows] = await db.execute(
    `SELECT id, login_password
     FROM price_sync_config
     WHERE login_password IS NOT NULL AND login_password <> ''
     ORDER BY id`
  )
  return rows
}

async function loadBackups(db) {
  if (!await backupTableExists(db)) return []
  const [rows] = await db.execute(
    `SELECT config_id, legacy_ciphertext_wrapped, migrated_ciphertext_hash
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
      if (isPriceSyncCiphertext(config.login_password)) {
        decryptPriceSyncPassword(config.login_password)
        continue
      }

      const plaintext = decryptLegacyCiphertext(config.login_password)
      const migratedCiphertext = encryptPriceSyncPassword(plaintext)
      if (decryptPriceSyncPassword(migratedCiphertext) !== plaintext) {
        throw new Error(`配置 ${config.id} 新密文回读校验失败`)
      }

      const [existingBackups] = await db.execute(
        `SELECT legacy_ciphertext_wrapped FROM ${BACKUP_TABLE} WHERE config_id = ? FOR UPDATE`,
        [config.id]
      )
      if (existingBackups.length > 0) {
        if (unsealLegacyCiphertext(existingBackups[0].legacy_ciphertext_wrapped) !== config.login_password) {
          throw new Error(`配置 ${config.id} 已有迁移备份与当前旧密文不一致`)
        }
        await db.execute(
          `UPDATE ${BACKUP_TABLE} SET migrated_ciphertext_hash = ? WHERE config_id = ?`,
          [sha256(migratedCiphertext), config.id]
        )
      } else {
        await db.execute(
          `INSERT INTO ${BACKUP_TABLE}
           (config_id, legacy_ciphertext_wrapped, migrated_ciphertext_hash)
           VALUES (?, ?, ?)`,
          [config.id, sealLegacyCiphertext(config.login_password), sha256(migratedCiphertext)]
        )
      }

      const [result] = await db.execute(
        `UPDATE price_sync_config
         SET login_password = ?
         WHERE id = ? AND login_password = ?`,
        [migratedCiphertext, config.id, config.login_password]
      )
      if (result.affectedRows !== 1) throw new Error(`配置 ${config.id} 迁移时发生并发修改`)
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
  if (backups.length === 0) throw new Error('未找到价格同步密文迁移备份，拒绝回滚')

  const backupById = new Map(backups.map(item => [Number(item.config_id), item]))
  const unbacked = configs.filter(config => isPriceSyncCiphertext(config.login_password) && !backupById.has(Number(config.id)))
  if (unbacked.length > 0) {
    throw new Error(`存在 ${unbacked.length} 条迁移后新增或缺少备份的配置，拒绝自动回滚`)
  }

  await db.beginTransaction()
  try {
    let restored = 0
    for (const config of configs) {
      const backup = backupById.get(Number(config.id))
      if (!backup) continue
      if (sha256(config.login_password) !== backup.migrated_ciphertext_hash) {
        throw new Error(`配置 ${config.id} 在迁移后已修改密码，拒绝覆盖回滚`)
      }
      const legacyCiphertext = unsealLegacyCiphertext(backup.legacy_ciphertext_wrapped)
      const [result] = await db.execute(
        `UPDATE price_sync_config
         SET login_password = ?
         WHERE id = ? AND login_password = ?`,
        [legacyCiphertext, config.id, config.login_password]
      )
      if (result.affectedRows !== 1) throw new Error(`配置 ${config.id} 回滚时发生并发修改`)
      restored += 1
    }
    await db.commit()
    return restored
  } catch (error) {
    await db.rollback()
    throw error
  }
}

async function verifyV2(db) {
  const configs = await loadConfigs(db)
  for (const config of configs) {
    if (!isPriceSyncCiphertext(config.login_password)) {
      throw new Error(`配置 ${config.id} 仍不是 enc:v2 密文`)
    }
    decryptPriceSyncPassword(config.login_password)
  }
  return configs.length
}

async function main() {
  const db = await createConnection()
  try {
    const [[databaseRow]] = await db.execute('SELECT DATABASE() AS database_name')
    const configs = await loadConfigs(db)
    const backups = await loadBackups(db)
    const summary = {
      total: configs.length,
      legacy: configs.filter(config => !isPriceSyncCiphertext(config.login_password)).length,
      v2: configs.filter(config => isPriceSyncCiphertext(config.login_password)).length,
      backups: backups.length
    }

    if (!applyChanges && !rollbackChanges) {
      console.log(JSON.stringify({
        status: summary.legacy > 0 ? 'dry_run' : 'already_ready',
        database: databaseRow?.database_name || process.env.DB_NAME,
        summary,
        instruction: summary.legacy > 0
          ? '设置新旧密钥环境变量后使用 --apply；迁移后可使用 --rollback 恢复旧密文'
          : null
      }, null, 2))
      return
    }

    if (rollbackChanges) {
      const restored = await rollbackMigration(db, configs, backups)
      console.log(JSON.stringify({
        status: 'rolled_back_and_verified',
        database: databaseRow?.database_name || process.env.DB_NAME,
        restored
      }, null, 2))
      return
    }

    const migrated = await applyMigration(db, configs)
    const verified = await verifyV2(db)
    console.log(JSON.stringify({
      status: 'migrated_and_verified',
      database: databaseRow?.database_name || process.env.DB_NAME,
      migrated,
      verified
    }, null, 2))
  } finally {
    await db.end()
  }
}

main().catch(error => {
  console.error(JSON.stringify({
    status: 'failed',
    code: error.code || 'PRICE_SYNC_ENCRYPTION_MIGRATION_ERROR',
    message: error.message
  }, null, 2))
  process.exitCode = 1
})
