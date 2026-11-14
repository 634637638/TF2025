'use strict'

const { validId, moneyCents } = require('./sale-input')
const { isIntegerInput } = require('./input-values')

const reject = message => {
  throw Object.assign(new Error(message), { statusCode: 400, code: 'CHECKOUT_INVALID' })
}
const only = (value, keys) => {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !keys.includes(key))) reject('结算包含无效或尚未支持的字段')
}
const redemptionPoints = value => {
  if (value === undefined) return 0
  if (!isIntegerInput(value) || Number(value) < 0 || Number(value) > 2147483647 ||
    typeof value === 'string' && value.startsWith('-')) reject('抵扣积分须为有效非负整数')
  return Number(value)
}

/** 共同结算商品输入的唯一规范化入口；无约定/零积分保持旧请求摘要兼容。 */
function normalizeCheckoutGoods(rows, { phoneIds = new Set(), normalizeSerials }) {
  if (!Array.isArray(rows) || rows.length > 1000) reject('请添加有效的销售明细，每单最多1000条')
  const keys = new Set()
  let total = 0
  const items = rows.map(row => {
    only(row, ['key', 'accessory_id', 'quantity', 'unit_price', 'sale_type', 'linked_phone_id', 'serial_numbers', 'redeem_points', 'gift_return_unit_price'])
    const redeemPoints = redemptionPoints(row.redeem_points)
    if (redeemPoints && row.sale_type === 'gift') reject('赠品不能使用积分抵扣')
    const cents = moneyCents(row.unit_price), quantity = Number(row.quantity)
    if (typeof row.key !== 'string' || !/^[a-zA-Z0-9_-]{1,64}$/.test(row.key) || keys.has(row.key) || !validId(row.accessory_id) ||
      !isIntegerInput(row.quantity) || quantity < 1 || quantity > 999999 ||
      !['sale', 'gift'].includes(row.sale_type) || cents === null || (row.sale_type === 'gift' ? cents !== 0 : !cents)) reject('商品明细、数量或售价无效')
    if (phoneIds.size ? !validId(row.linked_phone_id) || !phoneIds.has(Number(row.linked_phone_id)) : row.linked_phone_id !== undefined && row.linked_phone_id !== null) reject('每条搭售或赠品必须关联本单中的手机，单卖商品不关联手机')
    if (row.sale_type !== 'gift' && row.gift_return_unit_price !== undefined) reject('只有赠品可以保存未退回时的原单约定金额')
    const agreedCents = row.gift_return_unit_price === undefined || row.gift_return_unit_price === null ? null : moneyCents(row.gift_return_unit_price)
    if (row.gift_return_unit_price !== undefined && row.gift_return_unit_price !== null &&
      (agreedCents === null || agreedCents * quantity >= 10000000000)) reject('赠品原单约定金额无效或整行金额超出范围')
    keys.add(row.key)
    const serials = normalizeSerials(row.serial_numbers).sort()
    if (serials.length && serials.length !== quantity) reject('SN 数量与商品数量不一致')
    total += cents * quantity
    return { key: row.key, accessory_id: Number(row.accessory_id), quantity, unit_price: cents / 100,
      sale_type: row.sale_type, linked_phone_id: phoneIds.size ? Number(row.linked_phone_id) : null, serial_numbers: serials,
      // 没有约定时不改变旧规范化载荷，保持已存在请求标识的重试摘要兼容。
      ...(agreedCents === null ? {} : { gift_return_unit_price: agreedCents / 100 }),
      ...(redeemPoints ? { redeem_points: redeemPoints } : {}) }
  }).sort((a, b) => a.accessory_id - b.accessory_id || a.key.localeCompare(b.key))
  if (!Number.isSafeInteger(total) || total >= 10000000000) reject('结算总金额超出范围')
  return { items, total_cents: total }
}

module.exports = { normalizeCheckoutGoods }
