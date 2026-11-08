'use strict'

const { isConnected } = require('../config/database')
const SiteSettingsRepository = require('../repositories/site-settings.repository')

const DEFAULT_SITE_SETTINGS = Object.freeze({
  logoUrl: '',
  siteName: '',
  siteSubtitle: '',
  siteDomain: '',
  icpNumber: '',
  companyName: '',
  contactPhone: '',
  contactEmail: '',
  companyAddress: '',
  publicPriceContacts: '',
  publicPriceDefaultContact: '',
  publicPriceWatermark: '',
  publicPriceWatermarkEnabled: '1',
  publicPriceWatermarkTimeEnabled: '1',
  publicPriceWatermarkColor: '#6b7280'
})

const SITE_SETTINGS_COLUMN_ALIASES = Object.freeze({
  logoUrl: ['logo_url'],
  siteName: ['site_name'],
  siteSubtitle: ['site_subtitle', 'site_description', 'site_desc', 'subtitle'],
  siteDomain: ['site_domain', 'domain'],
  icpNumber: ['icp_number', 'icp_no', 'beian_number', 'beian_no'],
  companyName: ['company_name'],
  contactPhone: ['company_phone', 'contact_phone', 'phone'],
  contactEmail: ['company_email', 'contact_email', 'email'],
  companyAddress: ['company_address', 'address'],
  publicPriceContacts: ['public_price_contacts'],
  publicPriceDefaultContact: ['public_price_default_contact'],
  publicPriceWatermark: ['public_price_watermark'],
  publicPriceWatermarkEnabled: ['public_price_watermark_enabled'],
  publicPriceWatermarkTimeEnabled: ['public_price_watermark_time_enabled'],
  publicPriceWatermarkColor: ['public_price_watermark_color']
})

const SITE_SETTINGS_KEY_MAP = Object.freeze({
  logoUrl: 'logo_url',
  siteName: 'site_name',
  siteSubtitle: 'site_subtitle',
  siteDomain: 'site_domain',
  icpNumber: 'icp_number',
  companyName: 'company_name',
  contactPhone: 'company_phone',
  contactEmail: 'company_email',
  companyAddress: 'company_address',
  publicPriceContacts: 'public_price_contacts',
  publicPriceDefaultContact: 'public_price_default_contact',
  publicPriceWatermark: 'public_price_watermark',
  publicPriceWatermarkEnabled: 'public_price_watermark_enabled',
  publicPriceWatermarkTimeEnabled: 'public_price_watermark_time_enabled',
  publicPriceWatermarkColor: 'public_price_watermark_color'
})

const SITE_SETTINGS_KEY_DESCRIPTIONS = Object.freeze({
  logoUrl: '站点Logo',
  siteName: '站点名称',
  siteSubtitle: '站点副标题',
  siteDomain: '站点域名',
  icpNumber: 'ICP备案号',
  companyName: '公司名称',
  contactPhone: '联系电话',
  contactEmail: '联系邮箱',
  companyAddress: '公司地址',
  publicPriceContacts: '公开报价联系方式',
  publicPriceDefaultContact: '默认报价联系人',
  publicPriceWatermark: '公开报价图片水印',
  publicPriceWatermarkEnabled: '公开报价图片水印开关',
  publicPriceWatermarkTimeEnabled: '公开报价水印时间开关',
  publicPriceWatermarkColor: '公开报价水印颜色'
})

const PUBLIC_SITE_SETTING_FIELDS = [
  'logoUrl', 'siteName', 'siteSubtitle', 'siteDomain', 'icpNumber', 'companyName',
  'publicPriceContacts', 'publicPriceDefaultContact', 'publicPriceWatermark',
  'publicPriceWatermarkEnabled', 'publicPriceWatermarkTimeEnabled', 'publicPriceWatermarkColor'
]

class SiteSettingsService {
  constructor({ repository = new SiteSettingsRepository(), connected = isConnected } = {}) {
    this.repository = repository
    this.connected = connected
  }

  isConnected() {
    return this.connected()
  }

  async getSettings() {
    await this.repository.ensurePublicPriceColumns()
    const tableMeta = await this.repository.getTableMeta()
    if (tableMeta.isKeyValueTable) {
      const rows = await this.repository.listKeyValueSettings(Object.values(SITE_SETTINGS_KEY_MAP))
      const keyValueMap = new Map(rows.map(row => [row.key_name, row.value]))
      const settings = { ...DEFAULT_SITE_SETTINGS }
      for (const [field, keyName] of Object.entries(SITE_SETTINGS_KEY_MAP)) {
        const value = keyValueMap.get(keyName)
        if (value !== undefined && value !== null && value !== '') settings[field] = value
      }
      return settings
    }

    const columnMap = await this.repository.getColumnMap(SITE_SETTINGS_COLUMN_ALIASES)
    const row = await this.repository.getSingleRowSettings()
    const settings = { ...DEFAULT_SITE_SETTINGS }
    for (const [field, column] of Object.entries(columnMap)) {
      const value = row?.[column]
      if (column && value !== undefined && value !== null && value !== '') settings[field] = value
    }
    return settings
  }

  async getPublicSettings() {
    const settings = await this.getSettings()
    return Object.fromEntries(PUBLIC_SITE_SETTING_FIELDS.map(field => [field, settings[field]]))
  }

  async saveSettings(payload) {
    await this.repository.ensurePublicPriceColumns()
    const tableMeta = await this.repository.getTableMeta()
    if (tableMeta.isKeyValueTable) {
      for (const [field, keyName] of Object.entries(SITE_SETTINGS_KEY_MAP)) {
        const rawValue = payload?.[field]
        const value = rawValue === undefined || rawValue === null ? DEFAULT_SITE_SETTINGS[field] : rawValue
        await this.repository.saveKeyValueSetting(
          keyName,
          value,
          SITE_SETTINGS_KEY_DESCRIPTIONS[field] || keyName
        )
      }
      return { savedFields: Object.keys(SITE_SETTINGS_KEY_MAP), unsupportedFields: [] }
    }

    const columnMap = await this.repository.getColumnMap(SITE_SETTINGS_COLUMN_ALIASES)
    const entries = Object.entries(columnMap)
      .filter(([, column]) => !!column)
      .map(([field, column]) => ({
        field,
        column,
        value: payload?.[field] === undefined || payload?.[field] === null
          ? DEFAULT_SITE_SETTINGS[field]
          : payload[field]
      }))
    const unsupportedFields = Object.entries(columnMap)
      .filter(([, column]) => !column)
      .map(([field]) => field)
    if (!entries.length) {
      const error = new Error('settings表缺少站点信息字段，无法保存')
      error.code = 'SITE_SETTINGS_SCHEMA_UNSUPPORTED'
      throw error
    }

    await this.repository.saveSingleRowSettings(entries)
    return { savedFields: entries.map(item => item.field), unsupportedFields }
  }
}

module.exports = SiteSettingsService
