'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const backendRoot = path.resolve(__dirname, '..')
const read = relativePath => fs.readFileSync(path.join(backendRoot, relativePath), 'utf8')

test('CSRF Token 只有数据库持久化成功后才进入内存缓存', () => {
  const source = read('src/services/csrf-token.service.js')
  const routeSource = read('src/routes/csrf.js')
  const insertIndex = source.indexOf('INSERT INTO csrf_tokens')
  const cacheIndex = source.indexOf('csrfTokens.set(tokenId', insertIndex)

  assert.ok(insertIndex >= 0)
  assert.ok(cacheIndex > insertIndex)
  assert.doesNotMatch(source.slice(insertIndex, cacheIndex), /catch\s*\(error\)/)
  assert.match(source, /从数据库验证 CSRF Token 失败:[\s\S]{0,100}throw error/)
  assert.match(routeSource, /CSRF_VALIDATION_ERROR[\s\S]{0,100}request_id: req\.requestId/)
  assert.match(routeSource, /router\.get\('\/token', csrfController\.generateToken\.bind\(csrfController\)\)/)
  assert.match(routeSource, /router\.post\('\/verify', csrfController\.verifyToken\.bind\(csrfController\)\)/)
})

test('CSRF 生产表迁移默认预览并支持旧 user_id 结构升级', () => {
  const migration = read('scripts/migrate-csrf-tokens.js')
  const packageJson = JSON.parse(read('package.json'))

  assert.equal(packageJson.scripts['migrate:csrf-tokens'], 'node scripts/migrate-csrf-tokens.js')
  assert.match(migration, /process\.argv\.includes\('--apply'\)/)
  assert.match(migration, /CREATE TABLE \$\{TABLE_NAME\}/)
  assert.match(migration, /user_id VARCHAR\(191\) NOT NULL/)
  assert.doesNotMatch(migration, /requiredColumns = \['id'/)
  assert.match(migration, /ALTER TABLE \$\{TABLE_NAME\} MODIFY COLUMN user_id VARCHAR\(191\) NOT NULL/)
  assert.match(migration, /idx_user_token_expiry/)
  assert.match(migration, /迁移后校验失败/)
})

test('单号序列表可独立预览和修复，不依赖已登记的统一迁移台账', () => {
  const migration = read('scripts/migrate-invoice-sequences.js')
  const packageJson = JSON.parse(read('package.json'))

  assert.equal(packageJson.scripts['migrate:invoice-sequences'], 'node scripts/migrate-invoice-sequences.js')
  assert.match(migration, /process\.argv\.includes\('--apply'\)/)
  assert.match(migration, /process\.env\.NODE_ENV === 'production' \? '\.env\.production'/)
  assert.match(migration, /CREATE TABLE \$\{TABLE_NAME\}/)
  assert.match(migration, /PRIMARY KEY \(sequence_date, type_suffix\)/)
  assert.match(migration, /迁移后校验失败/)
})

test('销售出库 500 响应提供可关联日志的请求 ID，且不返回内部异常', () => {
  const route = read('src/routes/sales.js')
  const controller = read('src/controllers/sales-phone.controller.js')

  assert.match(route, /router\.post\('\/phone',[\s\S]*salesPhoneController\.sell\.bind/)
  assert.match(controller, /requestId: req\.requestId/)
  assert.match(controller, /code: 'INTERNAL_ERROR'/)
  assert.match(controller, /request_id: req\.requestId \|\| null/)
  assert.doesNotMatch(controller, /error: error\.message/)
})
