'use strict'

const crypto = require('node:crypto')
const { assertSecret } = require('./security-keyring')

const ENCRYPTED_PREFIX = 'enc:v1:'
const MIGRATION_BACKUP_PREFIX = 'backup:config:v1:'
const ROTATION_BACKUP_PREFIX = 'rotation:config:v1:'

function getEncryptionKey(sourceKey = process.env.CONFIG_ENCRYPTION_KEY, envName = 'CONFIG_ENCRYPTION_KEY') {
  return crypto
    .createHash('sha256')
    .update(assertSecret(sourceKey, envName), 'utf8')
    .digest()
}

function encryptValue(value, { prefix, purpose, sourceKey } = {}) {
  const plaintext = String(value ?? '')
  if (!plaintext) return ''

  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', getEncryptionKey(sourceKey), iv)
  if (purpose) cipher.setAAD(Buffer.from(purpose, 'utf8'))
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])

  return `${prefix}${iv.toString('hex')}:${cipher.getAuthTag().toString('hex')}:${encrypted.toString('hex')}`
}

function decryptWithKey(serialized, { prefix, purpose, sourceKey, envName } = {}) {
  if (!serialized.startsWith(prefix)) throw new Error('配置密文版本不受支持')

  const parts = serialized.slice(prefix.length).split(':')
  if (parts.length !== 3) throw new Error('配置密文格式无效')
  const [ivHex, authTagHex, encryptedHex] = parts
  if (!/^[a-f0-9]{24}$/i.test(ivHex) || !/^[a-f0-9]{32}$/i.test(authTagHex) || !/^[a-f0-9]+$/i.test(encryptedHex)) {
    throw new Error('配置密文格式无效')
  }

  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    getEncryptionKey(sourceKey, envName),
    Buffer.from(ivHex, 'hex')
  )
  if (purpose) decipher.setAAD(Buffer.from(purpose, 'utf8'))
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'))
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedHex, 'hex')),
    decipher.final()
  ]).toString('utf8')
}

function decryptValue(value, { prefix, purpose, sourceKeys } = {}) {
  const serialized = String(value || '')
  const keys = [...new Set((sourceKeys || []).filter(Boolean))]
  let lastError

  for (const item of keys) {
    try {
      return decryptWithKey(serialized, {
        prefix,
        purpose,
        sourceKey: item.value,
        envName: item.name
      })
    } catch (error) {
      lastError = error
    }
  }

  throw new Error(`配置密钥解密失败: ${lastError?.message || '没有可用密钥'}`)
}

function getRuntimeSourceKeys() {
  return [
    { name: 'CONFIG_ENCRYPTION_KEY', value: process.env.CONFIG_ENCRYPTION_KEY },
    { name: 'CONFIG_ENCRYPTION_PREVIOUS_KEY', value: process.env.CONFIG_ENCRYPTION_PREVIOUS_KEY }
  ]
}

function encryptConfigSecret(value, sourceKey) {
  return encryptValue(value, {
    prefix: ENCRYPTED_PREFIX,
    sourceKey
  })
}

function decryptConfigSecret(value, sourceKeys = getRuntimeSourceKeys()) {
  return decryptValue(value, {
    prefix: ENCRYPTED_PREFIX,
    sourceKeys
  })
}

function sealConfigMigrationBackup(ciphertext, sourceKey) {
  return encryptValue(ciphertext, {
    prefix: MIGRATION_BACKUP_PREFIX,
    purpose: 'tf2025:config-secret:migration-backup:v1',
    sourceKey
  })
}

function unsealConfigMigrationBackup(ciphertext, sourceKey) {
  return decryptValue(ciphertext, {
    prefix: MIGRATION_BACKUP_PREFIX,
    purpose: 'tf2025:config-secret:migration-backup:v1',
    sourceKeys: [{ name: 'CONFIG_ENCRYPTION_KEY', value: sourceKey || process.env.CONFIG_ENCRYPTION_KEY }]
  })
}

function sealConfigRotationBackup(ciphertext, sourceKey) {
  return encryptValue(ciphertext, {
    prefix: ROTATION_BACKUP_PREFIX,
    purpose: 'tf2025:config-secret:rotation-backup:v1',
    sourceKey
  })
}

function unsealConfigRotationBackup(ciphertext, sourceKey) {
  return decryptValue(ciphertext, {
    prefix: ROTATION_BACKUP_PREFIX,
    purpose: 'tf2025:config-secret:rotation-backup:v1',
    sourceKeys: [{ name: 'CONFIG_ENCRYPTION_KEY', value: sourceKey || process.env.CONFIG_ENCRYPTION_KEY }]
  })
}

module.exports = {
  ENCRYPTED_PREFIX,
  MIGRATION_BACKUP_PREFIX,
  ROTATION_BACKUP_PREFIX,
  decryptConfigSecret,
  encryptConfigSecret,
  getEncryptionKey,
  sealConfigMigrationBackup,
  sealConfigRotationBackup,
  unsealConfigMigrationBackup,
  unsealConfigRotationBackup
}
