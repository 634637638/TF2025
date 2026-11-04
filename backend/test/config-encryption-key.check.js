'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { spawnSync } = require('node:child_process')
const test = require('node:test')
const dotenv = require('dotenv')

const {
  decryptConfigSecret,
  encryptConfigSecret,
  sealConfigMigrationBackup,
  unsealConfigMigrationBackup
} = require('../src/utils/config-secret-crypto')

const backendRoot = path.resolve(__dirname, '..')
const currentKey = 'current-config-encryption-key-at-least-32-characters'
const previousKey = 'previous-config-encryption-key-at-least-32-characters'

test('支付秘密使用独立 AES-256-GCM 密钥并支持 current/previous 解密', () => {
  const currentCiphertext = encryptConfigSecret('current-secret', currentKey)
  const previousCiphertext = encryptConfigSecret('previous-secret', previousKey)
  const sources = [
    { name: 'CONFIG_ENCRYPTION_KEY', value: currentKey },
    { name: 'CONFIG_ENCRYPTION_PREVIOUS_KEY', value: previousKey }
  ]

  assert.match(currentCiphertext, /^enc:v1:[a-f0-9]{24}:[a-f0-9]{32}:[a-f0-9]+$/)
  assert.equal(decryptConfigSecret(currentCiphertext, sources), 'current-secret')
  assert.equal(decryptConfigSecret(previousCiphertext, sources), 'previous-secret')
  assert.throws(() => decryptConfigSecret(previousCiphertext, sources.slice(0, 1)), /解密失败/)
})

test('配置密文迁移备份由新密钥包裹且可回读', () => {
  const previousCiphertext = encryptConfigSecret('secret', previousKey)
  const backup = sealConfigMigrationBackup(previousCiphertext, currentKey)
  assert.match(backup, /^backup:config:v1:/)
  assert.equal(unsealConfigMigrationBackup(backup, currentKey), previousCiphertext)
  assert.throws(() => unsealConfigMigrationBackup(backup, previousKey), /解密失败/)
})

test('配置迁移脚本限定秘密字段、条件更新并保留回滚能力', () => {
  const source = fs.readFileSync(path.join(backendRoot, 'scripts/migrate-config-encryption-key.js'), 'utf8')
  assert.match(source, /SECRET_CONFIG_KEYS/)
  assert.match(source, /other_payment_secret/)
  assert.match(source, /WHERE id = \? AND config_value = \?/)
  assert.match(source, /--rollback/)
  assert.match(source, /previous_ciphertext_wrapped/)
  assert.doesNotMatch(source, /CONFIG_ENCRYPTION_KEY\s*=\s*['"][a-f0-9]{64,}['"]/i)
})

test('签名密钥轮换脚本不处理数据加密密钥且不会输出密钥值', () => {
  const source = fs.readFileSync(path.join(backendRoot, 'scripts/rotate-signing-key.js'), 'utf8')
  assert.doesNotMatch(source, /CONFIG_ENCRYPTION_KEY|PRICE_SYNC_ENCRYPTION_KEY/)
  assert.match(source, /secretValuesPrinted: false/)
  assert.doesNotMatch(source, /console\.log\([^)]*currentValue/)
})

test('安全初始化只在首次生成 current 时设置过渡 previous', (t) => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tf2025-security-keys-'))
  t.after(() => fs.rmSync(tempDir, { recursive: true, force: true }))
  const envFile = path.join(tempDir, '.env')
  const jwtSecret = 'existing-jwt-secret-at-least-32-characters-long'
  const existingFileKey = 'existing-file-key-at-least-32-characters-long'
  fs.writeFileSync(envFile, `JWT_SECRET=${jwtSecret}\nFILE_ACCESS_SIGNING_KEY=${existingFileKey}\n`, { mode: 0o600 })

  const result = spawnSync(process.execPath, [
    path.join(backendRoot, 'scripts/setup-security-keys.js'),
    `--env-file=${envFile}`,
    '--apply'
  ], { cwd: backendRoot, encoding: 'utf8' })
  assert.equal(result.status, 0, result.stderr)

  const updatedContent = fs.readFileSync(envFile, 'utf8')
  const parsed = dotenv.parse(updatedContent)
  assert.equal(parsed.FILE_ACCESS_SIGNING_KEY, existingFileKey)
  assert.equal(parsed.FILE_ACCESS_PREVIOUS_SIGNING_KEY, undefined)
  assert.equal(parsed.JWT_REFRESH_PREVIOUS_SECRET, jwtSecret)
  assert.notEqual(parsed.JWT_REFRESH_SECRET, jwtSecret)
  assert.match(updatedContent, /# \[TF2025:JWT_REFRESH_SECRET\] 刷新令牌当前签名密钥/)
  assert.match(updatedContent, /# \[TF2025:CONFIG_ENCRYPTION_KEY\] 支付配置当前加密密钥/)
  assert.doesNotMatch(updatedContent, /# \[TF2025:FILE_ACCESS_PREVIOUS_SIGNING_KEY\]/)
  assert.equal(new Set([
    parsed.JWT_REFRESH_SECRET,
    parsed.ORDER_ACCESS_SIGNING_KEY,
    parsed.INVENTORY_QUERY_SIGNING_KEY,
    parsed.CONFIG_ENCRYPTION_KEY
  ]).size, 4)
})

test('签名密钥轮换把旧 current 移入 previous 并生成新 current', (t) => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tf2025-signing-rotation-'))
  t.after(() => fs.rmSync(tempDir, { recursive: true, force: true }))
  const envFile = path.join(tempDir, '.env')
  const oldCurrent = 'old-order-signing-key-at-least-32-characters-long'
  fs.writeFileSync(envFile, `ORDER_ACCESS_SIGNING_KEY=${oldCurrent}\n`, { mode: 0o600 })

  const result = spawnSync(process.execPath, [
    path.join(backendRoot, 'scripts/rotate-signing-key.js'),
    '--scope=order-access',
    `--env-file=${envFile}`,
    '--apply'
  ], { cwd: backendRoot, encoding: 'utf8' })
  assert.equal(result.status, 0, result.stderr)

  const parsed = dotenv.parse(fs.readFileSync(envFile))
  assert.equal(parsed.ORDER_ACCESS_PREVIOUS_SIGNING_KEY, oldCurrent)
  assert.notEqual(parsed.ORDER_ACCESS_SIGNING_KEY, oldCurrent)
  assert.equal(parsed.ORDER_ACCESS_SIGNING_KEY.length, 128)
  assert.equal(fs.statSync(envFile).mode & 0o777, 0o600)
})
