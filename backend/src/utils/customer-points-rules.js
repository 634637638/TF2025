'use strict'

const CUSTOMER_POINTS_AMOUNT_PER_POINT = 100
const SOURCES = Object.freeze(['new', 'used', 'accessory'])
const DEFAULT_POINTS_CONFIG = Object.freeze({
  enabled: true, amount_per_point: CUSTOMER_POINTS_AMOUNT_PER_POINT,
  include_new: true, include_used: true, include_accessories: false,
  new_points_per_100: 1, used_points_per_100: 1, accessory_points_per_100: 1,
  redemption: Object.freeze({ enabled: false, points_per_yuan: null, max_percent: null,
    sources: Object.freeze([]), all_accessory_categories: false, category_ids: Object.freeze([]) })
})
const invalid = message => { throw Object.assign(new Error(message), { statusCode: 400, code: 'POINTS_RULE_INVALID' }) }
const boolean = (value, fallback) => {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : value
  if ([true, 1, '1', 'true', 'yes', 'on'].includes(normalized)) return true
  if ([false, 0, '0', 'false', 'no', 'off'].includes(normalized)) return false
  return fallback
}
const integer = (value, min, max) => ['number', 'string'].includes(typeof value) &&
  String(value).trim() !== '' && Number.isSafeInteger(Number(value)) && Number(value) >= min && Number(value) <= max
const unique = values => [...new Set(values)]

/** 读取旧配置时保留手机规则；未配置的商品累计/抵扣均不自动启用。 */
const normalizePointsConfig = (input = {}) => {
  const config = input && typeof input === 'object' && !Array.isArray(input) ? input : {}
  const raw = config.redemption && typeof config.redemption === 'object' && !Array.isArray(config.redemption) ? config.redemption : {}
  const redemption = {
    enabled: boolean(raw.enabled, false),
    points_per_yuan: integer(raw.points_per_yuan, 1, 1000000) ? Number(raw.points_per_yuan) : null,
    max_percent: integer(raw.max_percent, 1, 100) ? Number(raw.max_percent) : null,
    sources: Array.isArray(raw.sources) ? unique(raw.sources.filter(source => SOURCES.includes(source))) : [],
    all_accessory_categories: boolean(raw.all_accessory_categories, false),
    ...(raw.accessory_ids === undefined ? {} : { accessory_ids: Array.isArray(raw.accessory_ids) ? unique(raw.accessory_ids.filter(id => integer(id, 1, 2147483647)).map(Number)).sort((a, b) => a - b) : [] }),
    category_ids: Array.isArray(raw.category_ids) ? unique(raw.category_ids.filter(id => integer(id, 1, 2147483647)).map(Number)).sort((a, b) => a - b) : []
  }
  if (!redemption.points_per_yuan || !redemption.max_percent || !redemption.sources.length ||
    (redemption.sources.includes('accessory') && !redemption.all_accessory_categories && (!redemption.category_ids.length || (redemption.accessory_ids !== undefined && !redemption.accessory_ids.length)))) redemption.enabled = false
  return {
    enabled: boolean(config.enabled, true), amount_per_point: CUSTOMER_POINTS_AMOUNT_PER_POINT,
    include_new: boolean(config.include_new, true), include_used: boolean(config.include_used, true),
    include_accessories: boolean(config.include_accessories, false),
    ...Object.fromEntries(['new_points_per_100', 'used_points_per_100', 'accessory_points_per_100']
      .map(field => [field, integer(config[field], 1, 100) ? Number(config[field]) : 1])),
    redemption
  }
}

/** 保存必须严格校验；省略扩展字段的旧客户端不会清空已设置的抵扣规则。 */
const validatePointsConfig = (input, previous = DEFAULT_POINTS_CONFIG) => {
  if (!input || typeof input !== 'object' || Array.isArray(input)) invalid('积分设置格式无效')
  const merged = { ...normalizePointsConfig(previous), ...input }
  for (const field of ['enabled', 'include_new', 'include_used', 'include_accessories']) {
    if (typeof merged[field] !== 'boolean') invalid('积分开关必须是开启或关闭')
  }
  for (const [field, label] of [['new_points_per_100', '全新'], ['used_points_per_100', '二手'], ['accessory_points_per_100', '商品']]) {
    if (!integer(merged[field], 1, 100)) invalid(`${label}积分必须是1到100之间的整数`)
  }
  if (merged.enabled && !merged.include_new && !merged.include_used && !merged.include_accessories) invalid('请至少选择一种积分来源')
  let r = merged.redemption
  if (r && typeof r === 'object' && !Array.isArray(r) && r.accessory_ids === undefined && previous.redemption?.accessory_ids !== undefined) merged.redemption = { ...r, accessory_ids: previous.redemption.accessory_ids }
  r = merged.redemption
  if (!r || typeof r !== 'object' || Array.isArray(r) || typeof r.enabled !== 'boolean' || typeof r.all_accessory_categories !== 'boolean') invalid('抵扣规则格式无效')
  if (!Array.isArray(r.sources) || r.sources.some(source => !SOURCES.includes(source)) || unique(r.sources).length !== r.sources.length) invalid('请选择有效且不重复的可抵扣类型')
  if (!Array.isArray(r.category_ids) || r.category_ids.length > 1000 || r.category_ids.some(id => !integer(id, 1, 2147483647)) || unique(r.category_ids.map(Number)).length !== r.category_ids.length) invalid('请选择有效且不重复的商品类型')
  if (r.accessory_ids !== undefined && (!Array.isArray(r.accessory_ids) || r.accessory_ids.length > 1000 || r.accessory_ids.some(id => !integer(id, 1, 2147483647)) || unique(r.accessory_ids.map(Number)).length !== r.accessory_ids.length)) invalid('请选择有效且不重复的商品，最多1000个')
  if ((r.points_per_yuan !== null && !integer(r.points_per_yuan, 1, 1000000)) || (r.max_percent !== null && !integer(r.max_percent, 1, 100))) invalid('兑换比例须为1到1000000的整数，抵扣上限须为1到100的整数百分比')
  if (r.enabled && (!r.points_per_yuan || !r.max_percent || !r.sources.length ||
    (r.sources.includes('accessory') && !r.all_accessory_categories && (!r.category_ids.length || (r.accessory_ids !== undefined && !r.accessory_ids.length))))) invalid('启用抵扣前，请填写兑换比例、单件上限和可抵扣范围')
  return normalizePointsConfig(merged)
}

/** 新配置按类型与具体商品双重匹配；未配置商品ID的旧规则保留原类型语义。 */
const matchesAccessoryRedemption = (rule, item) => rule.all_accessory_categories ||
  (rule.category_ids.includes(Number(item.category_id)) &&
    (rule.accessory_ids === undefined || rule.accessory_ids.includes(Number(item.accessory_id))))

const sourceRate = (source, config) => {
  const fields = { new: ['include_new', 'new_points_per_100'], used: ['include_used', 'used_points_per_100'], accessory: ['include_accessories', 'accessory_points_per_100'] }
  const pair = fields[source]
  return config.enabled && pair && config[pair[0]] ? config[pair[1]] : 0
}

/** 只计算，不扣余额。调用方必须传结算前已锁定的余额，并在同一事务记账。金额单位为分。 */
const quoteCustomerPoints = ({ items, available_points, config = DEFAULT_POINTS_CONFIG }) => {
  if (!Array.isArray(items) || !items.length || items.length > 1000 || !integer(available_points, 0, 2147483647)) invalid('商品明细或可用积分无效')
  const normalized = normalizePointsConfig(config), rule = normalized.redemption
  const keys = new Set()
  let spent = 0, awarded = 0, deduction = 0
  const lines = items.map(item => {
    if (!item || typeof item.key !== 'string' || !item.key.trim() || item.key.length > 100 || keys.has(item.key) || !SOURCES.includes(item.source) ||
      !integer(item.amount_cents, 0, 9999999999) || typeof item.is_gift !== 'boolean' || !integer(item.redeem_points, 0, 2147483647)) invalid('商品明细、金额或抵扣积分无效')
    keys.add(item.key)
    const amount = Number(item.amount_cents), points = Number(item.redeem_points)
    let redeemed = 0
    if (item.is_gift && (amount !== 0 || points !== 0)) invalid('赠品金额和抵扣积分必须为0')
    if (points) {
      if (!rule.enabled || !rule.sources.includes(item.source) || item.is_gift || !amount ||
        (item.source === 'accessory' && !matchesAccessoryRedemption(rule, item))) invalid('该商品不符合积分抵扣范围')
      // 整数积分按可精确到分的兑换步长抵扣，不吞掉不足一分的积分。
      if ((points * 100) % rule.points_per_yuan !== 0) invalid('抵扣积分不能精确兑换到分，请调整积分数量')
      redeemed = points * 100 / rule.points_per_yuan
      if (redeemed > Math.floor(amount * rule.max_percent / 100)) invalid('抵扣金额超过该商品的最高抵扣比例')
    }
    spent += points
    if (spent > Number(available_points)) invalid('只能使用结算前已有积分，可用积分不足')
    const rate = sourceRate(item.source, normalized)
    const earned = item.is_gift || points ? 0 : Math.floor(amount * rate / 10000)
    awarded += earned; deduction += redeemed
    if (awarded > 2147483647 || deduction >= 10000000000) invalid('本次积分或抵扣金额超出范围')
    return { key: item.key, source: item.source, amount_cents: amount, points_used: points,
      deduction_cents: redeemed, payable_cents: amount - redeemed, points_awarded: earned,
      points_rate: rate }
  })
  if (Number(available_points) - spent + awarded > 2147483647) invalid('结算后积分余额超出范围')
  return { lines, points_used: spent, points_awarded: awarded, deduction_cents: deduction,
    balance_after: Number(available_points) - spent + awarded, config_snapshot: normalized }
}

module.exports = { CUSTOMER_POINTS_AMOUNT_PER_POINT, DEFAULT_POINTS_CONFIG, normalizePointsConfig, validatePointsConfig, matchesAccessoryRedemption, sourceRate, quoteCustomerPoints }
