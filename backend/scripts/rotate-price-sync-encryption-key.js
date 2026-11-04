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
  sealRotationCiphertext,
  unsealLegacyCiphertext,
  unsealRotationCiphertext
} = require('../src/utils/price-sync-crypto')

dotenv.config({ path: path.resolve(__dirname, '../.env'), quiet: true })

const MIGRATION_BACKUP_TABLE = 'price_sync_encryption_backup'
const ROTATION_BACKUP_TABLE = 'price_sync_key_rotation_backup'
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

function keyFingerprint(value) {
  getEncryptionKey(value)
  return sha256(value).slice(0, 16)
}

async function tableExists(db, tableName) {
  const [[row]] = await db.execute(
    `SELECT COUNT(*) AS count
     FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
    [tableName]
  )
  return Number(row?.count || 0) === 1
}

async function ensureRotationBackupTable(db) {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS ${ROTATION_BACKUP_TABLE} (
      config_id BIGINT NOT NULL PRIMARY KEY,
      previous_ciphertext_wrapped TEXT NOT NULL,
      rotated_ciphertext_hash CHAR(64) NOT NULL,
      previous_key_fingerprint CHAR(16) NOT NULL,
      current_key_fingerprint CHAR(16) NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
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

async function loadMigrationBackups(db) {
  if (!await tableExists(db, MIGRATION_BACKUP_TABLE)) return []
  const [rows] = await db.execute(
    `SELECT config_id, legacy_ciphertext_wrapped
     FROM ${MIGRATION_BACKUP_TABLE}
     ORDER BY config_id`
  )
  return rows
}

async function loadRotationBackups(db) {
  if (!await tableExists(db, ROTATION_BACKUP_TABLE)) return []
  const [rows] = await db.execute(
    `SELECT config_id, previous_ciphertext_wrapped, rotated_ciphertext_hash,
            previous_key_fingerprint, current_key_fingerprint
     FROM ${ROTATION_BACKUP_TABLE}
     ORDER BY config_id`
  )
  return rows
}

function validateCurrentData(configs, migrationBackups, sourceKey) {
  for (const config of configs) {
    if (!isPriceSyncCiphertext(config.login_password)) {
      throw new Error(`配置 ${config.id} 不是 enc:v2 密文，拒绝轮换`)
    }
    decryptPriceSyncPassword(config.login_password, sourceKey)
  }
  for (const backup of migrationBackups) {
    unsealLegacyCiphertext(backup.legacy_ciphertext_wrapped, sourceKey)
  }
}

async function applyRotation(db, configs, migrationBackups, currentKey, nextKey) {
  const previousFingerprint = keyFingerprint(currentKey)
  const currentFingerprint = keyFingerprint(nextKey)
  if (previousFingerprint === currentFingerprint) throw new Error('新旧价格同步密钥不能相同')

  validateCurrentData(configs, migrationBackups, currentKey)
  await ensureRotationBackupTable(db)
  const existingRotationBackups = await loadRotationBackups(db)
  if (existingRotationBackups.length > 0) {
    throw new Error('存在尚未清理的密钥轮换备份，请先确认或回滚上一次轮换')
  }

  await db.beginTransaction()
  try {
    for (const config of configs) {
      const plaintext = decryptPriceSyncPassword(config.login_password, currentKey)
      const rotatedCiphertext = encryptPriceSyncPassword(plaintext, nextKey)
      if (decryptPriceSyncPassword(rotatedCiphertext, nextKey) !== plaintext) {
        throw new Error(`配置 ${config.id} 新密钥回读校验失败`)
      }

      await db.execute(
        `INSERT INTO ${ROTATION_BACKUP_TABLE}
         (config_id, previous_ciphertext_wrapped, rotated_ciphertext_hash,
          previous_key_fingerprint, current_key_fingerprint)
         VALUES (?, ?, ?, ?, ?)`,
        [
          config.id,
          sealRotationCiphertext(config.login_password, nextKey),
          sha256(rotatedCiphertext),
          previousFingerprint,
          currentFingerprint
        ]
      )

      const [result] = await db.execute(
        `UPDATE price_sync_config
         SET login_password = ?
         WHERE id = ? AND login_password = ?`,
        [rotatedCiphertext, config.id, config.login_password]
      )
      if (result.affectedRows !== 1) throw new Error(`配置 ${config.id} 轮换时发生并发修改`)
    }

    for (const backup of migrationBackups) {
      const legacyCiphertext = unsealLegacyCiphertext(backup.legacy_ciphertext_wrapped, currentKey)
      const rewrapped = sealLegacyCiphertext(legacyCiphertext, nextKey)
      const [result] = await db.execute(
        `UPDATE ${MIGRATION_BACKUP_TABLE}
         SET legacy_ciphertext_wrapped = ?
         WHERE config_id = ? AND legacy_ciphertext_wrapped = ?`,
        [rewrapped, backup.config_id, backup.legacy_ciphertext_wrapped]
      )
      if (result.affectedRows !== 1) throw new Error(`配置 ${backup.config_id} 迁移备份重包裹时发生并发修改`)
    }

    await db.commit()
  } catch (error) {
    await db.rollback()
    throw error
  }

  const verifiedConfigs = await loadConfigs(db)
  const verifiedMigrationBackups = await loadMigrationBackups(db)
  validateCurrentData(verifiedConfigs, verifiedMigrationBackups, nextKey)
  return { rotated: verifiedConfigs.length, rewrapped_backups: verifiedMigrationBackups.length }
}

async function rollbackRotation(db, configs, migrationBackups, rotationBackups, currentKey, previousKey) {
  if (rotationBackups.length === 0) throw new Error('未找到价格同步密钥轮换备份，拒绝回滚')
  const currentFingerprint = keyFingerprint(currentKey)
  const previousFingerprint = keyFingerprint(previousKey)
  const backupById = new Map(rotationBackups.map(item => [Number(item.config_id), item]))

  for (const backup of rotationBackups) {
    if (backup.current_key_fingerprint !== currentFingerprint || backup.previous_key_fingerprint !== previousFingerprint) {
      throw new Error('提供的新旧密钥与轮换备份指纹不匹配')
    }
  }
  if (configs.some(config => !backupById.has(Number(config.id)))) {
    throw new Error('存在轮换后新增或缺少备份的配置，拒绝自动回滚')
  }
  validateCurrentData(configs, migrationBackups, currentKey)

  await db.beginTransaction()
  try {
    for (const config of configs) {
      const backup = backupById.get(Number(config.id))
      if (sha256(config.login_password) !== backup.rotated_ciphertext_hash) {
        throw new Error(`配置 ${config.id} 在轮换后已修改密码，拒绝覆盖回滚`)
      }
      const previousCiphertext = unsealRotationCiphertext(backup.previous_ciphertext_wrapped, currentKey)
      decryptPriceSyncPassword(previousCiphertext, previousKey)
      const [result] = await db.execute(
        `UPDATE price_sync_config
         SET login_password = ?
         WHERE id = ? AND login_password = ?`,
        [previousCiphertext, config.id, config.login_password]
      )
      if (result.affectedRows !== 1) throw new Error(`配置 ${config.id} 回滚时发生并发修改`)
    }

    for (const backup of migrationBackups) {
      const legacyCiphertext = unsealLegacyCiphertext(backup.legacy_ciphertext_wrapped, currentKey)
      const rewrapped = sealLegacyCiphertext(legacyCiphertext, previousKey)
      const [result] = await db.execute(
        `UPDATE ${MIGRATION_BACKUP_TABLE}
         SET legacy_ciphertext_wrapped = ?
         WHERE config_id = ? AND legacy_ciphertext_wrapped = ?`,
        [rewrapped, backup.config_id, backup.legacy_ciphertext_wrapped]
      )
      if (result.affectedRows !== 1) throw new Error(`配置 ${backup.config_id} 迁移备份回滚时发生并发修改`)
    }

    await db.execute(`DELETE FROM ${ROTATION_BACKUP_TABLE}`)
    await db.commit()
  } catch (error) {
    await db.rollback()
    throw error
  }

  const verifiedConfigs = await loadConfigs(db)
  const verifiedMigrationBackups = await loadMigrationBackups(db)
  validateCurrentData(verifiedConfigs, verifiedMigrationBackups, previousKey)
  return { restored: verifiedConfigs.length, rewrapped_backups: verifiedMigrationBackups.length }
}

async function main() {
  const db = await createConnection()
  try {
    const currentKey = process.env.PRICE_SYNC_ENCRYPTION_KEY
    const [[databaseRow]] = await db.execute('SELECT DATABASE() AS database_name')
    const configs = await loadConfigs(db)
    const migrationBackups = await loadMigrationBackups(db)
    const rotationBackups = await loadRotationBackups(db)
    validateCurrentData(configs, migrationBackups, currentKey)

    if (!applyChanges && !rollbackChanges) {
      console.log(JSON.stringify({
        status: rotationBackups.length > 0 ? 'rotation_backup_present' : 'dry_run',
        database: databaseRow?.database_name || process.env.DB_NAME,
        configs: configs.length,
        migration_backups: migrationBackups.length,
        rotation_backups: rotationBackups.length,
        instruction: rotationBackups.length > 0
          ? '当前密钥可解密数据，轮换备份仍保留；确认稳定后可继续保留作为紧急回滚依据'
          : '设置 PRICE_SYNC_NEXT_ENCRYPTION_KEY 后使用 --apply 执行轮换'
      }, null, 2))
      return
    }

    if (rollbackChanges) {
      const previousKey = process.env.PRICE_SYNC_PREVIOUS_ENCRYPTION_KEY
      const result = await rollbackRotation(
        db,
        configs,
        migrationBackups,
        rotationBackups,
        currentKey,
        previousKey
      )
      console.log(JSON.stringify({
        status: 'rotation_rolled_back_and_verified',
        database: databaseRow?.database_name || process.env.DB_NAME,
        ...result,
        instruction: '数据库已恢复为上一密钥对应密文，应用环境也必须恢复上一密钥后再启动'
      }, null, 2))
      return
    }

    const nextKey = process.env.PRICE_SYNC_NEXT_ENCRYPTION_KEY
    const result = await applyRotation(db, configs, migrationBackups, currentKey, nextKey)
    console.log(JSON.stringify({
      status: 'key_rotated_and_verified',
      database: databaseRow?.database_name || process.env.DB_NAME,
      ...result,
      instruction: '立即把应用 PRICE_SYNC_ENCRYPTION_KEY 更新为新密钥并重启；轮换备份已保留'
    }, null, 2))
  } finally {
    await db.end()
  }
}

main().catch(error => {
  console.error(JSON.stringify({
    status: 'failed',
    code: error.code || 'PRICE_SYNC_KEY_ROTATION_ERROR',
    message: error.message
  }, null, 2))
  process.exitCode = 1
})
