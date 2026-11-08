'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const createResponse = () => ({
  status(code) {
    this.statusCode = code
    return this
  },
  json(body) {
    this.body = body
    return this
  }
})

test('品牌设置 route 保留认证和 system:view 权限并委托 controller', () => {
  const route = fs.readFileSync(path.join(__dirname, '../src/routes/system.js'), 'utf8')
  assert.match(route, /router\.get\('\/brand-settings', unifiedAuth, requirePermission\('system:view'\), brandSettingsController\.getCurrent\.bind\(brandSettingsController\)\)/)
  assert.doesNotMatch(route, /router\.get\('\/brand-settings'[^\n]*async\s*\(/)
  assert.match(route, /router\.post\('\/brand-settings', unifiedAuth, requirePermission\('system:edit'\), brandSettingsController\.saveCurrent\.bind\(brandSettingsController\)\)/)
  assert.doesNotMatch(route, /router\.post\('\/brand-settings'[^\n]*async\s*\(/)
})

test('品牌设置 controller 保留未连接、未配置、成功和数据库失败响应', async () => {
  const BrandSettingsController = require('../src/controllers/brand-settings.controller')
  const settings = { systemName: 'TF2025' }

  const success = createResponse()
  await new BrandSettingsController({ service: {
    isConnected: () => true,
    async getCurrent() { return settings }
  } }).getCurrent({}, success)
  assert.equal(success.body.success, true)
  assert.deepEqual(success.body.data, settings)

  const missing = createResponse()
  await new BrandSettingsController({ service: {
    isConnected: () => true,
    async getCurrent() { return null }
  } }).getCurrent({}, missing)
  assert.equal(missing.statusCode, 404)
  assert.equal(missing.body.message, '品牌设置尚未配置')

  const unavailable = createResponse()
  await new BrandSettingsController({ service: { isConnected: () => false } }).getCurrent({}, unavailable)
  assert.equal(unavailable.statusCode, 503)
  assert.equal(unavailable.body.message, '服务器内部错误，请稍后重试')

  const failed = createResponse()
  await new BrandSettingsController({
    service: { isConnected: () => true, async getCurrent() { throw new Error('database unavailable') } },
    logger: { warn() {}, error() {} }
  }).getCurrent({}, failed)
  assert.equal(failed.statusCode, 500)
  assert.equal(failed.body.message, '服务器内部错误，请稍后重试')
})

test('品牌设置保存 controller 保留连接检查、字段白名单和成功响应', async () => {
  const BrandSettingsController = require('../src/controllers/brand-settings.controller')
  const settings = {
    logoUrl: '/logo.png',
    systemName: 'TF2025',
    systemShortName: 'TF',
    loginTitle: '欢迎',
    loginSubtitle: '登录',
    loginBackgroundUrl: '/background.png',
    primaryColor: '#123456',
    accentColor: '#abcdef'
  }
  let saved
  const success = createResponse()
  await new BrandSettingsController({ service: {
    isConnected: () => true,
    async saveCurrent(value) { saved = value }
  } }).saveCurrent({ body: { ...settings, ignored: 'field' } }, success)
  assert.equal(success.body.success, true)
  assert.equal(success.body.message, '品牌设置保存成功')
  assert.deepEqual(saved, settings)

  const unavailable = createResponse()
  await new BrandSettingsController({ service: { isConnected: () => false } }).saveCurrent({ body: settings }, unavailable)
  assert.equal(unavailable.statusCode, 500)

  const failed = createResponse()
  await new BrandSettingsController({
    service: { isConnected: () => true, async saveCurrent() { throw new Error('database unavailable') } },
    logger: { error() {} }
  }).saveCurrent({ body: settings }, failed)
  assert.equal(failed.statusCode, 500)
  assert.equal(failed.body.message, '服务器内部错误，请稍后重试')
})

test('品牌设置 repository 只读取现有 brand_settings 记录', async () => {
  const BrandSettingsRepository = require('../src/repositories/brand-settings.repository')
  let query
  const repository = new BrandSettingsRepository(() => ({
    async execute(sql, params) {
      query = { sql, params }
      return [[{ id: 1, systemName: 'TF2025' }]]
    }
  }))

  assert.deepEqual(await repository.getCurrent(), { id: 1, systemName: 'TF2025' })
  assert.equal(query.sql, 'SELECT * FROM brand_settings LIMIT 1')
})

test('品牌设置 repository 更新固定记录，缺失时插入默认记录', async () => {
  const settings = {
    logoUrl: '/logo.png',
    systemName: 'TF2025',
    systemShortName: 'TF',
    loginTitle: '欢迎',
    loginSubtitle: '登录',
    loginBackgroundUrl: '/background.png',
    primaryColor: '#123456',
    accentColor: '#abcdef'
  }
  const values = Object.values(settings)
  const runSave = async affected => {
    const queries = []
    const repository = new (require('../src/repositories/brand-settings.repository'))(() => ({
      async execute(sql, params) {
        queries.push({ sql, params })
        if (sql === 'SELECT ROW_COUNT() as affected') return [[{ affected }]]
        return [{ affectedRows: 1 }]
      }
    }))
    await repository.saveCurrent(settings)
    return queries
  }

  const updated = await runSave(1)
  assert.equal(updated.length, 2)
  assert.match(updated[0].sql, /UPDATE brand_settings SET[\s\S]*WHERE id = 1/)
  assert.deepEqual(updated[0].params, values)

  const inserted = await runSave(0)
  assert.equal(inserted.length, 3)
  assert.match(inserted[2].sql, /INSERT INTO brand_settings/)
  assert.deepEqual(inserted[2].params, values)
})
