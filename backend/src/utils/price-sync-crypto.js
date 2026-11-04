'use strict'

const crypto = require('crypto')

const ENCRYPTED_PREFIX = 'enc:v2:'
const MIGRATION_BACKUP_PREFIX = 'backup:v1:'
const KEY_ROTATION_BACKUP_PREFIX = 'rotation:v1:'
const MIN_KEY_LENGTH = 32

function getEncryptionKey(sourceKey = process.env.PRICE_SYNC_ENCRYPTION_KEY) {
  const normalizedKey = String(sourceKey || '')
  if (normalizedKey.length < MIN_KEY_LENGTH) {
    throw new Error(`PRICE_SYNC_ENCRYPTION_KEY 必须至少 ${MIN_KEY_LENGTH} 个字符`)
  }

  return crypto.createHash('sha256').update(normalizedKey, 'utf8').digest()
}

function encryptValue(value, { prefix, purpose, sourceKey } = {}) {
  const plaintext = String(value ?? '')
  if (!plaintext) return ''

  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', getEncryptionKey(sourceKey), iv)
  cipher.setAAD(Buffer.from(purpose, 'utf8'))
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])

  return `${prefix}${iv.toString('hex')}:${cipher.getAuthTag().toString('hex')}:${encrypted.toString('hex')}`
}

function decryptValue(value, { prefix, purpose, sourceKey } = {}) {
  const serialized = String(value || '')
  if (!serialized.startsWith(prefix)) {
    throw new Error('密文版本不受支持，请先执行迁移')
  }

  const payload = serialized.slice(prefix.length)
  const parts = payload.split(':')
  if (parts.length !== 3) throw new Error('密文格式无效')

  const [ivHex, authTagHex, encryptedHex] = parts
  if (!/^[a-f0-9]{24}$/i.test(ivHex) || !/^[a-f0-9]{32}$/i.test(authTagHex) || !/^[a-f0-9]+$/i.test(encryptedHex)) {
    throw new Error('密文格式无效')
  }

  try {
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      getEncryptionKey(sourceKey),
      Buffer.from(ivHex, 'hex')
    )
    decipher.setAAD(Buffer.from(purpose, 'utf8'))
    decipher.setAuthTag(Buffer.from(authTagHex, 'hex'))
    return Buffer.concat([
      decipher.update(Buffer.from(encryptedHex, 'hex')),
      decipher.final()
    ]).toString('utf8')
  } catch (error) {
    throw new Error(`价格同步密文解密失败: ${error.message}`)
  }
}

function encryptPriceSyncPassword(password, sourceKey) {
  return encryptValue(password, {
    prefix: ENCRYPTED_PREFIX,
    purpose: 'tf2025:price-sync:password:v2',
    sourceKey
  })
}

function decryptPriceSyncPassword(ciphertext, sourceKey) {
  return decryptValue(ciphertext, {
    prefix: ENCRYPTED_PREFIX,
    purpose: 'tf2025:price-sync:password:v2',
    sourceKey
  })
}

function sealLegacyCiphertext(ciphertext, sourceKey) {
  return encryptValue(ciphertext, {
    prefix: MIGRATION_BACKUP_PREFIX,
    purpose: 'tf2025:price-sync:migration-backup:v1',
    sourceKey
  })
}

function unsealLegacyCiphertext(ciphertext, sourceKey) {
  return decryptValue(ciphertext, {
    prefix: MIGRATION_BACKUP_PREFIX,
    purpose: 'tf2025:price-sync:migration-backup:v1',
    sourceKey
  })
}

function sealRotationCiphertext(ciphertext, sourceKey) {
  return encryptValue(ciphertext, {
    prefix: KEY_ROTATION_BACKUP_PREFIX,
    purpose: 'tf2025:price-sync:key-rotation-backup:v1',
    sourceKey
  })
}

function unsealRotationCiphertext(ciphertext, sourceKey) {
  return decryptValue(ciphertext, {
    prefix: KEY_ROTATION_BACKUP_PREFIX,
    purpose: 'tf2025:price-sync:key-rotation-backup:v1',
    sourceKey
  })
}

function isPriceSyncCiphertext(value) {
  return String(value || '').startsWith(ENCRYPTED_PREFIX)
}

module.exports = {
  ENCRYPTED_PREFIX,
  KEY_ROTATION_BACKUP_PREFIX,
  MIGRATION_BACKUP_PREFIX,
  MIN_KEY_LENGTH,
  decryptPriceSyncPassword,
  encryptPriceSyncPassword,
  getEncryptionKey,
  isPriceSyncCiphertext,
  sealLegacyCiphertext,
  sealRotationCiphertext,
  unsealLegacyCiphertext,
  unsealRotationCiphertext
}
