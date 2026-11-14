'use strict'

/** 外部报价搜索与结果解析；不读取环境、数据库、Cookie，也不发起网络请求。 */
class PriceSourceParser {
  constructor({ htmlParser, baseUrl }) {
    this.htmlParser = htmlParser
    this.baseUrl = baseUrl
  }

  /**
   * 返回外部报价站点的型号搜索候选词。
   *
   * 外部站点对型号代码和展示名称的检索并不始终等价：代码检索可能返回
   * 通用表格或空表，名称检索才会返回完整的系列数据。因此代码优先，名称
   * 作为有条件的补搜；真正写回前仍由型号代码、颜色和内存严格匹配。
   */
  getExternalModelSearchTerms(modelKey, modelNumber, externalModel, modelCode) {
    const normalizedKey = String(modelKey || '').toLowerCase().replace(/\s+/g, '')
    const formatModelSearchTerm = () => {
      if (modelNumber && /iphone/i.test(modelNumber)) return modelNumber

      const suffix = normalizedKey.replace(/^iphone/, '')
        .replace(/promax$/, ' Pro Max')
        .replace(/pro$/, ' Pro')
        .replace(/plus$/, ' Plus')
        .replace(/duo$/, ' Duo')
        .replace(/air$/, ' Air')

      return normalizedKey.startsWith('iphone')
        ? `iPhone ${suffix}`
        : (modelNumber || modelKey)
    }

    const isDuoModel = ['iphone18duo', 'iphoneduo', '18duo'].includes(normalizedKey)
    const nameTerm = isDuoModel
      ? 'iPhone Duo'
      : normalizedKey === 'iphone16'
        ? 'iPhone 16'
        : (/^iphone\d/.test(normalizedKey)
          ? `iPhone ${normalizedKey.slice(6).replace(/promax$/, ' Pro Max').replace(/pro$/, ' Pro').replace(/plus$/, ' Plus').replace(/duo$/, ' Duo').replace(/air$/, ' Air')}`
          : formatModelSearchTerm())
    const duoAliases = isDuoModel
      ? ['iPhone Duo', 'iPhone 18 Duo', '18 Duo', '18duo']
      : []
    const candidates = [modelCode, externalModel, nameTerm, ...duoAliases]
      .map(value => String(value || '').trim())
      .filter(Boolean)

    return [...new Set(candidates)]
  }

  /**
   * 判断一次外部搜索结果是否确实包含目标型号。
   * 不满足时允许调用方使用名称搜索补齐，避免把登录页/通用页当成有效结果。
   */
  hasExternalModelInTable(tableHtml, modelCode, modelKey) {
    const html = String(tableHtml || '')
    if (!html) return false
    if (modelCode && html.toLowerCase().includes(String(modelCode).toLowerCase())) return true

    const normalized = String(modelKey || '').toLowerCase().replace(/\s+/g, '')
    if (!normalized) return false

    const text = html
      .replace(/<[^>]*>/g, ' ')
      .toLowerCase()
      .replace(/\s+/g, '')
    const aliases = [
      normalized,
      normalized.replace(/^iphone/, 'iphone '),
      normalized.replace(/^iphone/, '苹果iphone'),
      ...(['iphone18duo', 'iphoneduo', '18duo'].includes(normalized)
        ? ['iphoneduo', 'iphone duo', 'iphone18duo', 'iphone 18 duo', '18duo', '18 duo']
        : [])
    ]
    return aliases.some(alias => text.includes(alias.replace(/\s+/g, '')))
  }

  /**
   * 判断外部表格是否包含可解析的商品行。
   * 外部站点无结果时仍会返回搜索表格和表头，不能只用 table 是否存在判断成功。
   */
  hasExternalPriceRows(tableHtml) {
    if (!this.htmlParser || !tableHtml) return false

    const $ = this.htmlParser.load(`<table>${tableHtml}</table>`)
    return $('tr').toArray().some(row => {
      const cells = $(row).find('td')
      if (cells.length < 2) return false

      const rowText = $(row).text().replace(/\s+/g, ' ')
      return /[￥¥]\s*\d+(?:\.\d+)?/.test(rowText)
    })
  }

  /**
   * 构造外部型号检索地址。
   *
   * 型号代码是跨品牌的数据源标识，外部站点在同时传入 pp=苹果 时会把
   * A3521 等代码过滤成空表。因此型号检索必须保留空品牌筛选，品牌只在
   * 返回行的严格匹配阶段校验。
   */
  buildExternalModelSearchUrl(searchTerm) {
    const params = new URLSearchParams({
      km: '',
      pp: '',
      network: '',
      arg_name: String(searchTerm || ''),
      s_jg: '',
      e_jg: '',
      policyid: '',
      tykhgsdm: '',
      isqh: '0'
    })

    return `${this.baseUrl}/quoteList.action?${params.toString()}`
  }
}

module.exports = PriceSourceParser
