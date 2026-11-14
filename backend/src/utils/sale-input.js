'use strict'

const { isIntegerInput, isMoneyInput } = require('./input-values')

const validId = value => isIntegerInput(value) && Number(value) > 0 && Number(value) <= 2147483647
const moneyCents = value => {
  if (typeof value === 'string' && (!isMoneyInput(value) || value.startsWith('-'))) return null
  if (!['number', 'string'].includes(typeof value) || Number(value) < 0) return null
  const scaled = Number(value) * 100, cents = Math.round(scaled)
  const tolerance = Number.EPSILON * Math.max(1, Math.abs(scaled)) * 4
  return Number.isSafeInteger(cents) && cents < 10000000000 && Math.abs(scaled - cents) <= tolerance ? cents : null
}

/** 共同订单售后接入前，旧单台入口不得破坏商品/收款关联及原始快照。 */
const assertStandaloneSale = orderId => {
  if (orderId) throw Object.assign(new Error('该手机属于共同结算单，暂不支持从旧入口编辑、删除或退库，请保留原单据'), {
    statusCode: 400, status: 400, code: 'CHECKOUT_AFTERSALE_NOT_READY'
  })
}

module.exports = { validId, moneyCents, assertStandaloneSale }
