'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const SiteSettingsController = require('../src/controllers/site-settings.controller')
const SiteSettingsService = require('../src/services/site-settings.service')
const SiteSettingsRepository = require('../src/repositories/site-settings.repository')

const response = () => ({
  status(code) { this.statusCode = code; return this },
  json(body) { this.body = body; return this }
})

test('site settings routes preserve public access and admin permissions while delegating', () => {
  const source = fs.readFileSync(path.join(__dirname, '../src/routes/system.js'), 'utf8')
  assert.match(source, /router\.get\('\/site-settings', siteSettingsController\.getPublic\.bind\(siteSettingsController\)\)/)
  assert.match(source, /router\.get\('\/site-settings\/admin', unifiedAuth, requirePermission\('system:view'\), siteSettingsController\.getAdmin\.bind\(siteSettingsController\)\)/)
  assert.match(source, /router\.post\('\/site-settings', unifiedAuth, requirePermission\('system:edit'\), siteSettingsController\.save\.bind\(siteSettingsController\)\)/)
  assert.doesNotMatch(source, /router\.(?:get|post)\('\/site-settings[^\n]*async\s*\(/)
})

test('site settings controller preserves disconnected, read and save responses', async () => {
  const unavailable = response()
  await new SiteSettingsController({ service: { isConnected: () => false }, logger: { warn() {} } }).getPublic({}, unavailable)
  assert.equal(unavailable.statusCode, 503)
  assert.equal(unavailable.body.success, false)

  const settings = { logoUrl: '/logo.png', siteName: '门店' }
  const publicResponse = response()
  await new SiteSettingsController({ service: { isConnected: () => true, async getPublicSettings() { return settings } } }).getPublic({}, publicResponse)
  assert.deepEqual(publicResponse.body.data, settings)

  const adminResponse = response()
  await new SiteSettingsController({ service: { isConnected: () => true, async getSettings() { return settings } } }).getAdmin({}, adminResponse)
  assert.deepEqual(adminResponse.body.data, settings)

  const saved = response()
  const result = { savedFields: ['siteName'], unsupportedFields: ['contactEmail'] }
  await new SiteSettingsController({ service: { isConnected: () => true, async saveSettings(payload) { assert.deepEqual(payload, { siteName: '门店' }); return result } } }).save({ body: { siteName: '门店' } }, saved)
  assert.deepEqual(saved.body.data, result)
  assert.equal(saved.body.message, '站点信息已保存，但以下字段当前未写入数据库：contactEmail')

  const failed = response()
  await new SiteSettingsController({
    service: { isConnected: () => true, async saveSettings() { throw new Error('database unavailable') } },
    logger: { error() {} }
  }).save({ body: {} }, failed)
  assert.equal(failed.body.message, '服务器内部错误，请稍后重试')
})

test('site settings service returns canonical defaults and filters public fields', async () => {
  const service = new SiteSettingsService({
    connected: () => true,
    repository: {
      async ensurePublicPriceColumns() {},
      async getTableMeta() { return { isKeyValueTable: true } },
      async listKeyValueSettings() { return [{ key_name: 'site_name', value: '门店' }, { key_name: 'company_email', value: 'private@example.test' }] }
    }
  })
  const all = await service.getSettings()
  assert.equal(all.siteName, '门店')
  assert.equal(all.publicPriceWatermarkEnabled, '1')
  assert.equal(all.contactEmail, 'private@example.test')
  const publicSettings = await service.getPublicSettings()
  assert.equal(publicSettings.siteName, '门店')
  assert.equal('contactEmail' in publicSettings, false)
})

test('site settings service maps legacy single-row aliases and reports unsupported fields', async () => {
  const service = new SiteSettingsService({
    connected: () => true,
    repository: {
      async ensurePublicPriceColumns() {},
      async getTableMeta() { return { isKeyValueTable: false } },
      async getColumnMap() { return { siteName: 'site_name', companyName: null, contactEmail: null } },
      async getSingleRowSettings() { return { site_name: '历史站点' } },
      async saveSingleRowSettings(entries) { this.entries = entries }
    }
  })
  assert.equal((await service.getSettings()).siteName, '历史站点')
  const result = await service.saveSettings({ siteName: '新名称' })
  assert.deepEqual(result, { savedFields: ['siteName'], unsupportedFields: ['companyName', 'contactEmail'] })
})

test('site settings service saves all canonical key-value settings with defaults', async () => {
  const writes = []
  const service = new SiteSettingsService({
    repository: {
      async ensurePublicPriceColumns() {},
      async getTableMeta() { return { isKeyValueTable: true } },
      async saveKeyValueSetting(...args) { writes.push(args) }
    }
  })
  const result = await service.saveSettings({ siteName: '新名称' })
  assert.equal(result.savedFields.length, 15)
  assert.deepEqual(result.unsupportedFields, [])
  assert.deepEqual(writes.find(([key]) => key === 'site_name'), ['site_name', '新名称', '站点名称'])
  assert.deepEqual(writes.find(([key]) => key === 'site_subtitle'), ['site_subtitle', '', '站点副标题'])
})

test('site settings repository keeps schema changes policy-gated and parameterizes values', async () => {
  const calls = []
  const columns = [{ Field: 'id' }, { Field: 'site_name' }]
  const repository = new SiteSettingsRepository({
    database: () => ({ async execute(sql, params) { calls.push([sql, params]); return [columns] } }),
    canChangeSchema: () => false
  })
  await repository.ensurePublicPriceColumns()
  assert.equal(calls.length, 1)
  assert.equal(calls[0][0], 'SHOW COLUMNS FROM settings')

  const valueRepository = new SiteSettingsRepository({
    database: () => ({ async execute(sql, params) { calls.push([sql, params]); return [{ affectedRows: 1 }] } }),
    canChangeSchema: () => false
  })
  await valueRepository.saveKeyValueSetting('site_name', '安全站点', '站点名称')
  assert.match(calls[1][0], /INSERT INTO settings \(key_name, value, type, description\)/)
  assert.deepEqual(calls[1][1], ['site_name', '安全站点', '站点名称'])
})
