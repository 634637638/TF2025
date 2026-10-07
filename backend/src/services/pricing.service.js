/**
 * 统一价格计算服务。
 *
 * 三个价格渠道彼此独立：
 * - sales: 销售报价页使用全局销售规则
 * - wholesale: 批发报价页使用全局批发规则
 * - h5: 商城使用颜色模板规则
 *
 * 这里不修改 price_list 的采集原值，展示价格在读取时计算。
 */
const SystemSettingsService = require('./system-settings.service')

const DEFAULT_CONFIG = Object.freeze({
  mode: 'fixed',
  lowFixed: 250,
  highFixed: 200,
  lowPercent: 8,
  highPercent: 3,
  threshold: 6000,
  enabled: true,
  wholesale: {
    enabled: false,
    adjustment: 0
  }
})

const roundPrice = value => Math.round(Number(value) * 100) / 100

class PricingService {
  normalizeGlobalConfig(config) {
    const source = config && typeof config === 'object' ? config : {}
    const wholesale = source.wholesale && typeof source.wholesale === 'object'
      ? source.wholesale
      : {}

    return {
      mode: source.mode === 'percentage' ? 'percentage' : DEFAULT_CONFIG.mode,
      lowFixed: Number(source.lowFixed ?? DEFAULT_CONFIG.lowFixed),
      highFixed: Number(source.highFixed ?? DEFAULT_CONFIG.highFixed),
      lowPercent: Number(source.lowPercent ?? DEFAULT_CONFIG.lowPercent),
      highPercent: Number(source.highPercent ?? DEFAULT_CONFIG.highPercent),
      threshold: Number(source.threshold ?? DEFAULT_CONFIG.threshold),
      enabled: typeof source.enabled === 'boolean' ? source.enabled : DEFAULT_CONFIG.enabled,
      wholesale: {
        enabled: typeof wholesale.enabled === 'boolean'
          ? wholesale.enabled
          : DEFAULT_CONFIG.wholesale.enabled,
        adjustment: Number(wholesale.adjustment ?? DEFAULT_CONFIG.wholesale.adjustment),
        sourceAdjustments: Object.entries(
          wholesale.sourceAdjustments && typeof wholesale.sourceAdjustments === 'object'
            ? wholesale.sourceAdjustments
            : {}
        ).reduce((result, [sourceId, adjustment]) => {
          const numericAdjustment = Number(adjustment)
          if (sourceId && Number.isFinite(numericAdjustment)) {
            result[String(sourceId)] = numericAdjustment
          }
          return result
        }, {})
      }
    }
  }

  async getGlobalConfig() {
    try {
      const setting = await SystemSettingsService.getSettingByKey('price_markup_config')
      return this.normalizeGlobalConfig(setting?.value)
    } catch (_error) {
      return this.normalizeGlobalConfig(DEFAULT_CONFIG)
    }
  }

  calculateSalesPriceByConfig(wholesalePrice, config) {
    const base = Number(wholesalePrice)
    if (!Number.isFinite(base) || base <= 0) return null
    if (!config.enabled) return roundPrice(base)

    const lowTier = base < config.threshold
    if (config.mode === 'percentage') {
      const percent = lowTier ? config.lowPercent : config.highPercent
      return roundPrice(base * (1 + percent / 100))
    }

    const amount = lowTier ? config.lowFixed : config.highFixed
    return roundPrice(base + amount)
  }

  async calculateSalesPrice(wholesalePrice) {
    const config = await this.getGlobalConfig()
    return this.calculateSalesPriceByConfig(wholesalePrice, config)
  }

  calculateWholesalePriceByConfig(wholesalePrice, config, sourceConfigId = null) {
    const base = Number(wholesalePrice)
    if (!Number.isFinite(base) || base <= 0) return null
    if (!config.wholesale.enabled) return roundPrice(base)

    const sourceKey = sourceConfigId === null || sourceConfigId === undefined || sourceConfigId === ''
      ? null
      : String(sourceConfigId)
    const sourceAdjustments = config.wholesale.sourceAdjustments || {}
    const hasSourceAdjustment = sourceKey !== null
      && Object.prototype.hasOwnProperty.call(sourceAdjustments, sourceKey)
    const adjustment = hasSourceAdjustment
      ? Number(sourceAdjustments[sourceKey])
      : Number(config.wholesale.adjustment)

    return roundPrice(base + (Number.isFinite(adjustment) ? adjustment : 0))
  }

  async calculateWholesalePrice(wholesalePrice) {
    const config = await this.getGlobalConfig()
    return this.calculateWholesalePriceByConfig(wholesalePrice, config)
  }

  calculateH5PriceByTemplate(basePrice, template) {
    const base = Number(basePrice)
    if (!Number.isFinite(base) || base <= 0) return null

    const markup = Number(template?.price_markup || 0)
    if (!Number.isFinite(markup) || markup <= 0) return roundPrice(base)

    if (template?.price_markup_type === 'percentage') {
      return roundPrice(base * (1 + markup / 100))
    }

    return roundPrice(base + markup)
  }
}

module.exports = new PricingService()
