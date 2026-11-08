'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const {
  createCustomerToken,
  extractBearerToken,
  hashCustomerToken
} = require('../src/utils/customer-token')

const backendRoot = path.resolve(__dirname, '..')

test('客户 Token 使用高熵随机值且 SHA-256 摘要稳定', () => {
  const first = createCustomerToken()
  const second = createCustomerToken()
  assert.match(first, /^[A-Za-z0-9_-]{43}$/)
  assert.notEqual(first, second)
  assert.match(hashCustomerToken(first), /^[a-f0-9]{64}$/)
  assert.equal(hashCustomerToken(first), hashCustomerToken(first))
  assert.notEqual(hashCustomerToken(first), hashCustomerToken(second))
})

test('Bearer Token 提取严格且空 Token 拒绝摘要', () => {
  assert.equal(extractBearerToken(`Bearer token-value`), 'token-value')
  assert.equal(extractBearerToken('Basic value'), '')
  assert.throws(() => hashCustomerToken(''), /不能为空/)
})

test('H5 客户认证只按摘要读写并在登录时轮换旧 Token', () => {
  const route = fs.readFileSync(path.join(backendRoot, 'src/routes/shop-public.js'), 'utf8')
  const controller = fs.readFileSync(path.join(backendRoot, 'src/controllers/shop-public-auth.controller.js'), 'utf8')
  const service = fs.readFileSync(path.join(backendRoot, 'src/services/shop-public.service.js'), 'utf8')
  assert.match(route, /router\.post\('\/auth\/register', publicAuthRateLimit, shopPublicAuthController\.register\.bind\(shopPublicAuthController\)\)/)
  assert.match(route, /router\.post\('\/auth\/login', publicAuthRateLimit, shopPublicAuthController\.login\.bind\(shopPublicAuthController\)\)/)
  assert.match(service, /WHERE ct\.token_hash = \? AND ct\.expires_at > NOW\(\)/)
  assert.match(service, /DELETE FROM customer_tokens WHERE customer_id = \? OR expires_at <= NOW\(\)/)
  assert.match(service, /INSERT INTO customers \(name, phone, password, member_number, source, status, created_at\)/)
  assert.match(service, /INSERT INTO customer_tokens \(customer_id, token_hash, expires_at\)/)
  assert.match(route, /router\.post\('\/auth\/logout', publicAuthRateLimit, shopPublicAuthController\.logout\.bind\(shopPublicAuthController\)\)/)
  assert.match(controller, /hashCustomerToken\(token\)/)
  assert.match(controller, /this\.service\.logoutCustomer\(/)
  assert.match(service, /DELETE FROM customer_tokens WHERE token_hash = \?/)
  assert.doesNotMatch(route, /WHERE (?:ct\.)?token = \?/)
  assert.doesNotMatch(route, /INSERT INTO customer_tokens \(customer_id, token, expires_at\)/)
})

test('Token 迁移支持预览、兼容回滚和最终清空明文', () => {
  const migration = fs.readFileSync(path.join(backendRoot, 'scripts/migrate-customer-token-hashes.js'), 'utf8')
  assert.match(migration, /process\.argv\.includes\('--apply'\)/)
  assert.match(migration, /process\.argv\.includes\('--finalize'\)/)
  assert.match(migration, /process\.argv\.includes\('--rollback'\)/)
  assert.match(migration, /SHA2\(token, 256\)/)
  assert.match(migration, /SET token = NULL/)
  assert.match(migration, /无法从 SHA-256 摘要反推/)
})
