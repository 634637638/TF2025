'use strict'

/** 价目采集的纯匹配职责；配置按需读取主服务唯一状态，不保存数据库或外部会话。 */
class PriceProductMatcher {
  constructor(readConfig) { this.readConfig = readConfig }
  get standardColors() { return this.readConfig().standardColors }
  get colorMapping() { return this.readConfig().colorMapping }

  /**
   * 在颜色管理标准中查找目标颜色。
   * 例如颜色管理只有“绿色”时，草绿、深绿、浅绿都会归一为“绿色”。
   */
  findStandardColor(target) {
    if (!target) return null
    const normalizedTarget = String(target).trim().toLowerCase()
    return this.standardColors.find(color => color.toLowerCase() === normalizedTarget) || null
  }

  /**
   * 将外部颜色名称映射到数据库颜色名称
   * 支持智能模糊匹配：包含关键字就映射到目标颜色
   */
  normalizeColor(colorName) {
    if (!colorName) return colorName

    const normalized = colorName.trim()

    // 颜色管理中的标准名称优先，避免把“深青色”等已配置颜色错误归并。
    const exactStandardColor = this.findStandardColor(normalized)
    if (exactStandardColor) return exactStandardColor

    // 优先使用显式颜色映射，处理星光色/深空灰色等命名差异
    if (this.colorMapping[normalized]) {
      return this.findStandardColor(this.colorMapping[normalized]) || this.colorMapping[normalized]
    }

    // 🔥 智能映射规则：按优先级从高到低匹配
    // 包含特定关键字 → 映射到标准颜色
    // 注意：匹配顺序很重要，先匹配更具体的组合词

    // 黑色系：本站颜色管理将灰色、天空灰、深空灰等作为黑色系统一维护。
    if (/黑|乌|墨|灰|碳|石墨|午夜|深空|天空灰|子夜|星岩|深黑/.test(normalized)) return this.findStandardColor('黑色') || '黑色'

    // 白色系（包含 银、白、霜、雪、云、雾 等）- 必须先匹配"银色"
    if (/银色/.test(normalized)) return this.findStandardColor('白色') || '白色'
    if (/银|霜|雪|云|雾|流金白|星辉白|星光色|月光|冰霜/.test(normalized)) return this.findStandardColor('白色') || '白色'
    if (/白/.test(normalized)) return this.findStandardColor('白色') || '白色'

    // 蓝色系（排除"银色"中的"青"字，避免误匹配）
    if (/蓝|冰川|深蓝|水蓝|丹宁|靛|天蓝/.test(normalized)) return this.findStandardColor('蓝色') || '蓝色'

    // 紫色系（包含 紫、罗兰、薰衣草 等）
    if (/紫|罗兰|薰衣草|葡萄|丁香|浅紫|曙光|烟霞/.test(normalized)) return this.findStandardColor('紫色') || '紫色'

    // 绿色系
    if (/绿|翠|碧|青绿|橄榄|薄荷|草|鼠尾草|青柠/.test(normalized)) return this.findStandardColor('绿色') || '绿色'

    // 橙色系
    if (/橙|橘|星宇/.test(normalized)) return this.findStandardColor('橙色') || '橙色'
    // 特别处理"星宇橙色" -> "橙色"
    if (/星宇橙色/.test(normalized)) return this.findStandardColor('橙色') || '橙色'

    // 粉色系
    if (/粉|桃|樱|蔷薇|玫瑰|牡丹|玫瑰金/.test(normalized)) return this.findStandardColor('粉色') || '粉色'

    // 金色系
    if (/金|铜|钛金|茶|沙漠/.test(normalized)) return this.findStandardColor('金色') || '金色'

    // 原色系
    if (/原色|钛金属/.test(normalized)) return this.findStandardColor('原色') || '原色'

    // 黄色系
    if (/黄/.test(normalized)) return this.findStandardColor('黄色') || '黄色'

    // 红色系
    if (/红/.test(normalized)) return this.findStandardColor('红色') || '红色'

    // 青色系
    if (/深青/.test(normalized)) return this.findStandardColor('深青色') || this.findStandardColor('青色') || '青色'
    if (/青色/.test(normalized)) return this.findStandardColor('青色') || this.findStandardColor('深青色') || '青色'

    // 如果没有匹配，返回原始颜色。未知颜色不强行映射，等待颜色管理新增标准后再归类。
    return normalized
  }

  /** 从外部描述提取颜色原名，最终统一由 normalizeColor 映射到颜色管理。 */
  extractColorFromText(text) {
    if (!text) return ''
    const colorPatterns = [
      '勃艮第酒红色', '原色钛金属', '沙漠色钛金属', '白色钛金属', '黑色钛金属',
      '鼠尾草绿色', '冰川蓝色', '薰衣草紫色', '星宇橙色', '青雾蓝色', '深空灰色',
      '深空黑色', '午夜色', '夜空色', '银灰色', '天空灰色', '天空灰', '星辉白', '星光色', '星光白色', '流金白', '云白色',
      '云雾白', '雪松白', '丹宁色', '星岩黑', '子夜黑', '天青蓝', '深蓝色',
      '水蓝色', '浅紫色', '曙光紫', '钛金色', '深黑色', '烟霞紫', '深青色',
      '群青色', '玫瑰金', '酒红色', '酒红', '大红色', '大红', '草绿色', '草绿', '深绿色', '深绿', '浅绿色', '浅绿',
      '墨绿色', '墨绿', '翠绿色', '翠绿', '薄荷绿色', '薄荷绿', '橄榄绿色',
      '橄榄绿', '青绿色', '青绿', '青柠绿', '深空灰', '浅金色', '黑色', '白色',
      '蓝色', '红色', '绿色', '黄色', '紫色', '粉色', '金色', '银色', '灰色',
      '青色', '橙色', '原色', '茶色'
    ]
    return colorPatterns.find(pattern => String(text).includes(pattern)) || ''
  }

  /**
   * 从外部产品文本中提取存储规格。
   * 优先识别显式 GB/TB，并取最大的容量，避免把 12GB+256GB 中的 12GB 识别成存储，
   * 也避免把尾部型号码如 4G4 误识别成 4GB。
   */
  extractMemoryFromText(text) {
    if (!text) return ''

    const normalizedText = String(text)
    const capacities = []

    const tbMatches = normalizedText.matchAll(/(\d+(?:\.\d+)?)\s*TB/ig)
    for (const match of tbMatches) {
      const value = parseFloat(match[1])
      if (!Number.isNaN(value) && value > 0) {
        capacities.push(value * 1024)
      }
    }

    const gbMatches = normalizedText.matchAll(/(\d+(?:\.\d+)?)\s*GB/ig)
    for (const match of gbMatches) {
      const value = parseFloat(match[1])
      if (!Number.isNaN(value) && value > 0) {
        capacities.push(value)
      }
    }

    // 兼容 256G / 1T 这种缩写，但要求前后是分隔符，避免误匹配 4G4。
    const shortMatches = normalizedText.matchAll(/(?:^|[-+\s(（])(\d{2,4})([GT])(?:$|[-+\s)）])/ig)
    for (const match of shortMatches) {
      const value = parseFloat(match[1])
      const unit = match[2].toUpperCase()
      if (Number.isNaN(value) || value <= 0) continue
      capacities.push(unit === 'T' ? value * 1024 : value)
    }

    if (capacities.length === 0) {
      return ''
    }

    const maxGb = Math.max(...capacities)
    if (maxGb >= 2048) return '2TB'
    if (maxGb >= 1024) return '1TB'
    return `${Math.round(maxGb)}GB`
  }

  normalizeModelForMatch(modelText) {
    if (!modelText) return ''

    const normalized = String(modelText)
      .toLowerCase()
      .replace(/\s+/g, '')
      .replace(/[()（）]/g, '')
      .replace(/英寸/g, '寸')

    if (normalized.includes('ipadair7') && !normalized.includes('11寸') && !normalized.includes('13寸')) {
      return 'ipadair711寸'
    }
    if (normalized.includes('ipadair8') && !normalized.includes('11寸') && !normalized.includes('13寸')) {
      return 'ipadair811寸'
    }

    // 外部数据可能写成“iPhone Duo”“iPhone 18 Duo”或“18duo”，
    // 这些都是本地的同一型号，必须使用同一个匹配键。
    if (normalized === 'iphoneduo' || normalized === 'iphone18duo' || normalized === '18duo') {
      return 'iphoneduo'
    }

    return normalized
  }

  normalizeMemoryForMatch(memoryText) {
    if (!memoryText) return ''

    const normalized = String(memoryText).replace(/\s+/g, '').toLowerCase()
    if (normalized.includes('tb')) {
      const tb = parseFloat(normalized)
      return Number.isNaN(tb) ? normalized : String(tb * 1024)
    }
    if (normalized.includes('gb')) {
      return normalized.replace('gb', '')
    }
    return normalized
  }

  /**
   * 判断外部商品文本是否标记为“同城”
   */
  isSameCityProduct(text) {
    if (!text) return false
    return String(text).includes('同城')
  }

  /**
   * 对候选价格按优先级排序：
   * 1. 同城优先
   * 2. 颜色信息完整优先
   * 3. 内存信息完整优先
   *
   * 业务规则说明：
   * - 苹果 iPhone 15 及以下：同城优先，但允许回退到全国价
   * - 苹果 iPhone 16 及以上：由 getEligiblePriceCandidates 进一步限制为“只能同城”
   */
  prioritizePriceCandidates(priceList = []) {
    return [...priceList].sort((a, b) => {
      const sameCityDiff = Number(Boolean(b?.isLocal)) - Number(Boolean(a?.isLocal))
      if (sameCityDiff !== 0) return sameCityDiff

      const colorDiff = Number(Boolean(b?.color)) - Number(Boolean(a?.color))
      if (colorDiff !== 0) return colorDiff

      return Number(Boolean(b?.memory)) - Number(Boolean(a?.memory))
    })
  }

  /**
   * 提取 iPhone 代数，如 iphone16 / 16promax / iPhone 16 Pro => 16
   */
  extractIPhoneGeneration(modelText) {
    if (!modelText) return null

    const normalized = String(modelText)
      .toLowerCase()
      .replace(/\s+/g, '')
      .replace(/[()]/g, '')

    if (normalized.includes('duo')) return 18

    const match = normalized.match(/(?:iphone)?(\d{2})/)
    if (!match) return null

    const generation = Number(match[1])
    return Number.isNaN(generation) ? null : generation
  }

  /**
   * 苹果 iPhone 16 及以上只能使用同城价格
   *
   * 业务口径：
   * - iPhone 15 及以下：返回 false，允许全国价作为回退候选
   * - iPhone 16 及以上：返回 true，后续匹配时必须过滤掉全国价
   */
  requiresSameCityOnly(productLike = {}) {
    const brand = String(productLike.brand || productLike.brand_name || '').toLowerCase()
    const model = productLike.model || productLike.model_number || ''

    const modelText = String(model).toLowerCase()
    // 库存型号可能使用 18promax 这类简写，不能因为没有 iphone 前缀而跳过同城规则。
    const isIPhoneLike = modelText.includes('iphone') || /^\d{2}(?:[a-z]|$)/.test(modelText.replace(/\s+/g, ''))
    if (!isIPhoneLike) return false

    const isAppleLike = brand.includes('苹果') || brand.includes('apple') || modelText.includes('iphone')
    if (!isAppleLike) return false

    const generation = this.extractIPhoneGeneration(modelText)
    return generation !== null && generation >= 16
  }

  /**
   * 获取最终可参与匹配的候选价格：
   * - 统一先按优先级排序
   * - iPhone 16 及以上只保留同城价
   *
   * 最终效果：
   * - iPhone 15 及以下：候选顺序为“同城在前，全国在后”
   * - iPhone 16 及以上：候选列表里只保留同城记录，没有同城则视为无法匹配
   */
  getEligiblePriceCandidates(priceList = [], productLike = {}) {
    const prioritized = this.prioritizePriceCandidates(priceList)

    if (!this.requiresSameCityOnly(productLike)) {
      return prioritized
    }

    return prioritized.filter(item => item?.isLocal === true)
  }

}

module.exports = PriceProductMatcher
