'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { spawnSync } = require('node:child_process')
const test = require('node:test')
const jwt = require('jsonwebtoken')

const {
  createHmacSignature,
  signJwt,
  verifyHmacSignature,
  verifyJwt
} = require('../src/utils/security-keyring')
const { createOrderAccessToken, verifyOrderAccessToken } = require('../src/utils/order-access')
const { createInventoryQueryToken, verifyInventoryQueryToken } = require('../src/utils/inventory-query-token')

const backendRoot = path.resolve(__dirname, '..')
const currentAccess = 'current-access-secret-at-least-32-characters-long'
const previousAccess = 'previous-access-secret-at-least-32-characters-long'
const currentRefresh = 'current-refresh-secret-at-least-32-characters-long'
const previousRefresh = 'previous-refresh-secret-at-least-32-characters-long'
const issuer = 'tf2025-backend'
const audience = 'tf2025-users'

test('JWT 当前密钥签发且当前与上一密钥均可在对应用途验证', () => {
  const currentToken = signJwt('JWT_ACCESS', { sub: 1, type: 'access' }, {
    expiresIn: '5m',
    issuer,
    audience
  }, currentAccess)
  const previousToken = jwt.sign({ sub: 2, type: 'access' }, previousAccess, {
    algorithm: 'HS256',
    expiresIn: '5m',
    issuer,
    audience
  })

  const options = { issuer, audience }
  const keys = { current: currentAccess, previous: previousAccess }
  assert.equal(verifyJwt('JWT_ACCESS', currentToken, options, keys).sub, 1)
  assert.equal(verifyJwt('JWT_ACCESS', previousToken, options, keys).sub, 2)
})

test('访问、刷新及其他用途密钥不能交叉验证', () => {
  const refreshToken = jwt.sign({ sub: 1, type: 'refresh' }, currentRefresh, {
    algorithm: 'HS256',
    expiresIn: '5m',
    issuer,
    audience
  })

  assert.equal(verifyJwt('JWT_REFRESH', refreshToken, { issuer, audience }, {
    current: currentRefresh,
    previous: previousRefresh
  }).type, 'refresh')
  assert.throws(() => verifyJwt('JWT_ACCESS', refreshToken, { issuer, audience }, {
    current: currentAccess,
    previous: previousAccess
  }), /signature/)
})

test('HMAC 当前密钥签名并兼容上一密钥验证', () => {
  const payload = 'file:7:1800000000'
  const currentSignature = createHmacSignature('FILE_ACCESS', payload, 'hex', currentAccess)
  const previousSignature = createHmacSignature('FILE_ACCESS', payload, 'hex', previousAccess)
  const keys = { current: currentAccess, previous: previousAccess }

  assert.equal(verifyHmacSignature('FILE_ACCESS', payload, currentSignature, 'hex', keys), true)
  assert.equal(verifyHmacSignature('FILE_ACCESS', payload, previousSignature, 'hex', keys), true)
  assert.equal(verifyHmacSignature('FILE_ACCESS', `${payload}:changed`, previousSignature, 'hex', keys), false)
})

test('订单与库存查询凭证支持平滑轮换且用途隔离', () => {
  const order = { id: 7, order_number: 'TF-7', customer_phone: '13800000000' }
  const oldOrderToken = createOrderAccessToken(order, 60, { sourceKey: previousAccess })
  assert.equal(verifyOrderAccessToken(oldOrderToken, order, {
    sourceKey: currentAccess,
    previousSourceKey: previousAccess
  }), true)

  const inventoryToken = createInventoryQueryToken({ id: 9, name: 'tester' }, { sourceKey: previousRefresh })
  assert.equal(verifyInventoryQueryToken(inventoryToken, {
    sourceKey: currentRefresh,
    previousSourceKey: previousRefresh
  }).type, 'inventory-query')
  assert.throws(() => verifyInventoryQueryToken(inventoryToken, {
    sourceKey: currentAccess,
    previousSourceKey: previousAccess
  }), /signature/)
})

test('运行时代码不再把 JWT 密钥作为支付、文件、订单或库存密钥回退', () => {
  const files = [
    'src/services/shop.service.js',
    'src/utils/shared-file-access.js',
    'src/utils/guide-file-access.js',
    'src/utils/order-access.js',
    'src/utils/inventory-query-token.js'
  ]
  for (const relativePath of files) {
    const source = fs.readFileSync(path.join(backendRoot, relativePath), 'utf8')
    assert.doesNotMatch(source, /process\.env\.JWT_SECRET|config\.jwt\.secret/)
  }
})

test('生产环境缺少任一独立 current 密钥时拒绝启动', () => {
  const configPath = path.join(backendRoot, 'src/config/index.js')
  const result = spawnSync(process.execPath, ['-e', `require(${JSON.stringify(configPath)})`], {
    cwd: backendRoot,
    encoding: 'utf8',
    env: {
      NODE_ENV: 'production',
      ENV_FILE: path.join(backendRoot, 'test', 'missing-production-env'),
      DB_HOST: '127.0.0.1',
      DB_USER: 'test',
      DB_PASSWORD: 'test',
      DB_NAME: 'test',
      JWT_SECRET: currentAccess,
      JWT_REFRESH_SECRET: currentRefresh,
      CONFIG_ENCRYPTION_KEY: currentAccess,
      PRICE_SYNC_ENCRYPTION_KEY: currentRefresh,
      FILE_ACCESS_SIGNING_KEY: '',
      ORDER_ACCESS_SIGNING_KEY: currentAccess,
      INVENTORY_QUERY_SIGNING_KEY: currentRefresh
    }
  })

  assert.notEqual(result.status, 0)
  assert.match(`${result.stdout}\n${result.stderr}`, /FILE_ACCESS_SIGNING_KEY/)
})

test('开发只自动加载 .env，生产只自动加载 .env.production', (t) => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tf2025-env-selection-'))
  t.after(() => fs.rmSync(tempDir, { recursive: true, force: true }))
  const fixtureSecret = 'fixture-secret-at-least-32-characters-long'
  const common = [
    'DB_HOST=127.0.0.1',
    'DB_USER=test',
    'DB_PASSWORD=test',
    `JWT_SECRET=${fixtureSecret}`
  ]
  fs.writeFileSync(path.join(tempDir, '.env'), [
    ...common,
    'DB_NAME=development_database'
  ].join('\n'))
  fs.writeFileSync(path.join(tempDir, '.env.production'), [
    ...common,
    'DB_NAME=production_database',
    `JWT_REFRESH_SECRET=${fixtureSecret}-refresh`,
    `FILE_ACCESS_SIGNING_KEY=${fixtureSecret}-file`,
    `ORDER_ACCESS_SIGNING_KEY=${fixtureSecret}-order`,
    `INVENTORY_QUERY_SIGNING_KEY=${fixtureSecret}-inventory`,
    `CONFIG_ENCRYPTION_KEY=${fixtureSecret}-config`,
    `PRICE_SYNC_ENCRYPTION_KEY=${fixtureSecret}-price`
  ].join('\n'))

  const configPath = path.join(backendRoot, 'src/config/index.js')
  const runConfig = (nodeEnv) => spawnSync(
    process.execPath,
    ['-e', `const config=require(${JSON.stringify(configPath)});console.log('DATABASE='+config.db.database)`],
    {
      cwd: tempDir,
      encoding: 'utf8',
      env: { PATH: process.env.PATH, NODE_ENV: nodeEnv }
    }
  )

  const development = runConfig('development')
  const production = runConfig('production')
  assert.equal(development.status, 0, development.stderr)
  assert.equal(production.status, 0, production.stderr)
  assert.match(development.stdout, /DATABASE=development_database/)
  assert.match(production.stdout, /DATABASE=production_database/)
})
