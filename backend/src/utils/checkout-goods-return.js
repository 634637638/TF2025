'use strict'

const { readCheckoutGoods } = require('./checkout-goods-facts')
const { moneyCents } = require('./sale-input')
const { goodsCommissionReturn, readGoodsCommissionReturn } = require('./goods-commission')

const conflict = message => { throw Object.assign(new Error(message), { statusCode: 409, code: 'CHECKOUT_RETURN_CONFLICT' }) }
const json = value => {
  try { return typeof value === 'string' ? JSON.parse(value) : value }
  catch { conflict('原售后凭据损坏，请核对历史') }
}

/** 普通件按原分摊顺序退，SN按原快照位置退；从不按现价或当前积分规则计算。 */
function planGoodsReturn(row, history, quantity, serials) {
  const { item, units, commission } = readCheckoutGoods(row)
  // 无逐件凭据的老商品不按整行平均积分补造，保留到历史核对流程。
  if (!units && item.points_awarded && quantity) conflict('原商品缺少逐件积分凭据，请先核对历史')
  const groups = units || [{ quantity: item.quantity, points_used: 0, deduction_cents: 0,
    payable_cents: moneyCents(item.unit_price), points_awarded: 0 }]
  const tracked = item.serial_numbers.length > 0, used = new Set()
  let returned = 0, charged = null
  for (const previous of history) {
    const count = Number(previous.quantity), fact = json(previous.fact_snapshot)
    if (!Number.isSafeInteger(count) || count < 0 || !fact || !Array.isArray(fact.unit_ranges) ||
      count === 0 && !fact.gift_charge || fact.kind !== undefined && !['return', 'gift_charge', 'return_and_charge'].includes(fact.kind)) conflict('原售后数量凭据异常')
    let covered = 0
    const previousSerials = []
    for (const range of fact.unit_ranges) {
      if (!Array.isArray(range) || range.length !== 2 || !range.every(Number.isSafeInteger) || range[0] < 0 || range[1] <= range[0] || range[1] > item.quantity) conflict('原售后分摊区间异常')
      covered += range[1] - range[0]
      // SN逐件核对；普通件只核对连续数量，无须展开十万件。
      if (tracked) for (let i = range[0]; i < range[1]; i++) {
        if (used.has(i)) conflict('原SN售后存在重复区间')
        used.add(i)
        previousSerials.push(item.serial_numbers[i])
      }
    }
    if (covered !== count || !tracked && (count ? fact.unit_ranges.length !== 1 || fact.unit_ranges[0][0] !== returned : fact.unit_ranges.length !== 0)) conflict('原售后分摊与数量不一致')
    readGoodsCommissionReturn(fact.commission_return, commission, fact.unit_ranges)
    if (tracked && (!Array.isArray(fact.serial_numbers) || fact.serial_numbers.length !== count ||
      new Set(fact.serial_numbers).size !== count || previousSerials.some(sn => !fact.serial_numbers.includes(sn)))) conflict('原售后SN与分摊区间不一致')
    const expectedRefund = charged ? count * charged.unit_cents : 0
    if (!charged && (Object.hasOwn(fact, 'gift_refund_cents') || Object.hasOwn(fact, 'gift_charge_aftersale_id'))) conflict('赠品退款早于原实际扣款凭据')
    if ((fact.gift_refund_cents ?? 0) !== expectedRefund || charged && count &&
      (fact.gift_refund_cents !== expectedRefund || fact.gift_charge_aftersale_id !== charged.aftersale_id)) conflict('赠品原实际扣款退款凭据不一致')
    returned += count
    if (returned > item.quantity) conflict('原售后数量超出原单')
    if (fact.gift_charge) {
      const charge = fact.gift_charge
      const remainingSerials = tracked ? item.serial_numbers.filter((_, index) => !used.has(index)) : []
      if (charged || item.sale_type !== 'gift' || item.gift_return_unit_price === null ||
        !Number.isSafeInteger(Number(previous.aftersale_id)) || Number(previous.aftersale_id) < 1 ||
        charge.quantity !== item.quantity - returned || charge.quantity < 1 ||
        charge.unit_cents !== moneyCents(item.gift_return_unit_price) || charge.amount_cents !== charge.quantity * charge.unit_cents ||
        !Array.isArray(charge.serial_numbers) || charge.serial_numbers.length !== remainingSerials.length ||
        charge.serial_numbers.some((sn, index) => sn !== remainingSerials[index]) ||
        fact.kind !== (count ? 'return_and_charge' : 'gift_charge')) conflict('赠品未退扣款凭据异常')
      charged = { ...charge, aftersale_id: Number(previous.aftersale_id) }
    } else if (fact.kind && fact.kind !== 'return') conflict('原售后动作与实物数量不一致')
  }
  if (returned + quantity > item.quantity) conflict('退货数量超过原单剩余可退数量')
  let ranges
  if (tracked) {
    if (serials.length !== quantity) conflict('请录入本次退回的全部原单SN')
    ranges = serials.map(sn => {
      const index = item.serial_numbers.indexOf(sn)
      if (index < 0 || used.has(index)) conflict('SN不属于原单或已经退回')
      return [index, index + 1]
    }).sort((a, b) => a[0] - b[0])
  } else {
    if (serials.length) conflict('原单为数量模式，不能补填SN')
    ranges = quantity ? [[returned, returned + quantity]] : []
  }
  const share = { payable_cents: 0, points_used: 0, points_awarded: 0, deduction_cents: 0 }
  let offset = 0
  for (const group of groups) {
    const end = offset + group.quantity
    for (const [start, stop] of ranges) {
      const count = Math.max(0, Math.min(stop, end) - Math.max(start, offset))
      for (const key of Object.keys(share)) share[key] += count * group[key]
    }
    offset = end
  }
  const giftRefund = charged ? quantity * charged.unit_cents : 0
  return { item, ...share, unit_ranges: ranges, commission_return: goodsCommissionReturn(commission, ranges),
    returned_quantity: returned, remaining_quantity: item.quantity - returned - quantity,
    gift_refund_cents: giftRefund, gift_charge_aftersale_id: charged?.aftersale_id ?? null,
    outstanding_gift_charge_cents: charged ? (item.quantity - returned) * charged.unit_cents : 0,
    available_serial_numbers: tracked ? item.serial_numbers.filter((_, index) => !used.has(index)) : [] }
}

/** 手机退货时一次结清未退赠品；扣款不占用已退数量，不修改任何SN或库存。 */
function planGiftCharge(plan, returnedSerials) {
  if (plan.item.sale_type !== 'gift' || !plan.remaining_quantity || plan.gift_charge_aftersale_id !== null ||
    plan.item.gift_return_unit_price === null) conflict('未退赠品缺少原单约定，或已经办理扣款')
  const unit = moneyCents(plan.item.gift_return_unit_price)
  return { quantity: plan.remaining_quantity, unit_cents: unit, amount_cents: unit * plan.remaining_quantity,
    serial_numbers: plan.available_serial_numbers.filter(sn => !returnedSerials.includes(sn)) }
}

module.exports = { planGoodsReturn, planGiftCharge }
