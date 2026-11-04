'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { spawnSync } = require('node:child_process')
const test = require('node:test')

const {
  decryptPriceSyncPassword,
  encryptPriceSyncPassword,
  sealLegacyCiphertext,
  sealRotationCiphertext,
  unsealRotationCiphertext,
  unsealLegacyCiphertext
} = require('../src/utils/price-sync-crypto')

const backendRoot = path.resolve(__dirname, '..')
const testKey = 'test-price-sync-encryption-key-32-characters-minimum'

test('价格同步密码使用带版本的 AES-256-GCM 密文并可回读', () => {
  const ciphertext = encryptPriceSyncPassword('test-password:with-colon', testKey)
  assert.match(ciphertext, /^enc:v2:[a-f0-9]{24}:[a-f0-9]{32}:[a-f0-9]+$/)
  assert.equal(decryptPriceSyncPassword(ciphertext, testKey), 'test-password:with-colon')
})

test('价格同步密码缺密钥、旧格式或密文被篡改时明确失败', () => {
  assert.throws(() => encryptPriceSyncPassword('secret', ''), /至少 32 个字符/)
  assert.throws(() => decryptPriceSyncPassword('0011:ffee', testKey), /版本不受支持/)

  const ciphertext = encryptPriceSyncPassword('secret', testKey)
  const tampered = `${ciphertext.slice(0, -1)}${ciphertext.endsWith('0') ? '1' : '0'}`
  assert.throws(() => decryptPriceSyncPassword(tampered, testKey), /解密失败/)
})

test('迁移回滚备份使用独立域的 GCM 包裹且可恢复旧密文', () => {
  const legacyCiphertext = '0123456789abcdef0123456789abcdef:aabbccdd'
  const backup = sealLegacyCiphertext(legacyCiphertext, testKey)
  assert.match(backup, /^backup:v1:/)
  assert.equal(unsealLegacyCiphertext(backup, testKey), legacyCiphertext)
  assert.throws(() => decryptPriceSyncPassword(backup, testKey), /版本不受支持/)
})

test('密钥轮换备份使用独立域且只能由新密钥解包', () => {
  const nextKey = 'next-price-sync-encryption-key-32-characters-minimum'
  const currentCiphertext = encryptPriceSyncPassword('secret', testKey)
  const backup = sealRotationCiphertext(currentCiphertext, nextKey)

  assert.match(backup, /^rotation:v1:/)
  assert.equal(unsealRotationCiphertext(backup, nextKey), currentCiphertext)
  assert.throws(() => unsealRotationCiphertext(backup, testKey), /解密失败/)
})

test('价格同步接口永不回显明文且迁移脚本不包含旧口令常量', () => {
  const service = fs.readFileSync(path.join(backendRoot, 'src/services/price-list.service.js'), 'utf8')
  const controller = fs.readFileSync(path.join(backendRoot, 'src/controllers/price-list.controller.js'), 'utf8')
  const migration = fs.readFileSync(path.join(backendRoot, 'scripts/migrate-price-sync-encryption.js'), 'utf8')
  const rotation = fs.readFileSync(path.join(backendRoot, 'scripts/rotate-price-sync-encryption-key.js'), 'utf8')

  const publicConfigStart = service.indexOf('async getSyncConfig()')
  const internalConfigStart = service.indexOf('async getSyncConfigWithPassword', publicConfigStart)
  const publicConfigMethods = service.slice(publicConfigStart, internalConfigStart)

  assert.match(publicConfigMethods, /has_password/)
  assert.match(publicConfigMethods, /••••••••/)
  assert.doesNotMatch(publicConfigMethods, /decryptPassword/)
  assert.doesNotMatch(controller, /hidePassword/)
  assert.match(migration, /PRICE_SYNC_LEGACY_PASSPHRASE/)
  assert.match(migration, /PRICE_SYNC_LEGACY_SALT/)
  assert.doesNotMatch(migration, /tf2025-price-sync/)
  assert.doesNotMatch(migration, /scryptSync\(['"][^'"]+['"],\s*['"][^'"]+['"]/)
  assert.match(rotation, /PRICE_SYNC_NEXT_ENCRYPTION_KEY/)
  assert.match(rotation, /PRICE_SYNC_PREVIOUS_ENCRYPTION_KEY/)
  assert.match(rotation, /price_sync_key_rotation_backup/)
  assert.match(rotation, /legacy_ciphertext_wrapped/)
  assert.match(rotation, /发生并发修改/)
  assert.doesNotMatch(rotation, /PRICE_SYNC_(?:NEXT|PREVIOUS)?_?ENCRYPTION_KEY\s*=\s*['"][a-f0-9]{64,}['"]/i)
})

test('生产环境缺少价格同步密钥时配置加载立即失败', () => {
  const configPath = path.join(backendRoot, 'src/config/index.js')
  const result = spawnSync(process.execPath, ['-e', `require(${JSON.stringify(configPath)})`], {
    cwd: backendRoot,
    encoding: 'utf8',
    env: {
      ...process.env,
      NODE_ENV: 'production',
      DB_HOST: '127.0.0.1',
      DB_USER: 'test',
      DB_PASSWORD: 'test',
      DB_NAME: 'test',
      JWT_SECRET: 'test-jwt-secret-at-least-32-characters-long',
      PRICE_SYNC_ENCRYPTION_KEY: ''
    }
  })

  assert.notEqual(result.status, 0)
  assert.match(`${result.stdout}\n${result.stderr}`, /PRICE_SYNC_ENCRYPTION_KEY/)
})
