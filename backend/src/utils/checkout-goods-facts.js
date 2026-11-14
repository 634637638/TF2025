'use strict'

const { moneyCents } = require('./sale-input')
const { readGoodsCommission } = require('./goods-commission')
const reject = (message, statusCode = 409, code = 'CHECKOUT_FACTS_CONFLICT') => {
  throw Object.assign(new Error(message), { statusCode, code })
}
const points = value => ['number', 'string'].includes(typeof value) && /^\d+$/.test(String(value)) &&
  Number.isSafeInteger(Number(value)) && Number(value) >= 0 && Number(value) <= 2147483647
const parseSnapshot = value => {
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed
  } catch { /* 原单损坏时拒绝猜测或读取当前商品资料补齐。 */ }
  reject('原商品快照异常，请核对原单')
}

/** 核对原商品数量、金额、积分、SN及赠品约定，不读取当前售价补造历史。 */
function readCheckoutGoods(row) {
  const snapshot = parseSnapshot(row.snapshot)
  const quantity = Number(row.quantity), price = moneyCents(row.unit_price), total = moneyCents(row.total_amount)
  if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 999999 || price === null || total === null || price * quantity >= 10000000000 ||
    !points(row.points_awarded) || !['sale', 'gift'].includes(snapshot.sale_type) ||
    (snapshot.sale_type === 'gift' ? price !== 0 || total !== 0 || Number(row.points_awarded) !== 0 : price === 0)) reject('关联商品原单数量或金额异常')
  const used = snapshot.points_used === undefined ? 0 : snapshot.points_used
  const deduction = snapshot.deduction_cents === undefined ? 0 : snapshot.deduction_cents
  const gross = price * quantity
  if (!Number.isSafeInteger(used) || used < 0 || used > 2147483647 || !Number.isSafeInteger(deduction) || deduction < 0 ||
    (snapshot.gross_cents !== undefined && snapshot.gross_cents !== gross) || gross - deduction !== total ||
    (used ? snapshot.sale_type !== 'sale' || Number(row.points_awarded) !== 0 || !Number.isSafeInteger(snapshot.points_per_yuan) ||
      snapshot.points_per_yuan < 1 || snapshot.points_per_yuan > 1000000 || !deduction ||
      BigInt(used) * 100n !== BigInt(deduction) * BigInt(snapshot.points_per_yuan) : deduction !== 0)) reject('关联商品原单积分抵扣凭据异常')
  if (snapshot.points_units !== undefined) {
    const units = snapshot.points_units
    if (!Array.isArray(units) || !units.length || units.length > 2 || units.some(unit => !unit ||
      !['quantity', 'points_used', 'deduction_cents', 'payable_cents', 'points_awarded'].every(key => Number.isSafeInteger(unit[key]) && unit[key] >= 0) ||
      !unit.quantity || unit.quantity > quantity || unit.points_used > 2147483647 || unit.points_awarded > 2147483647 ||
      unit.deduction_cents + unit.payable_cents !== price ||
      (used ? unit.points_awarded !== 0 || BigInt(unit.points_used) * 100n !== BigInt(unit.deduction_cents) * BigInt(snapshot.points_per_yuan) : unit.points_used !== 0 || unit.deduction_cents !== 0)) ||
      units.reduce((sum, unit) => sum + unit.quantity, 0) !== quantity ||
      units.reduce((sum, unit) => sum + unit.quantity * unit.points_used, 0) !== used ||
      units.reduce((sum, unit) => sum + unit.quantity * unit.deduction_cents, 0) !== deduction ||
      units.reduce((sum, unit) => sum + unit.quantity * unit.points_awarded, 0) !== Number(row.points_awarded)) reject('关联商品原单分摊凭据异常')
  } else if (used) reject('关联商品原单缺少抵扣分摊凭据')
  const serials = snapshot.serial_numbers
  if (!Array.isArray(serials) || serials.some(serial => typeof serial !== 'string' || !serial.trim()) ||
    new Set(serials).size !== serials.length || (serials.length && serials.length !== quantity)) reject('关联商品原单SN凭据异常')
  const rawAgreement = snapshot.gift_return_unit_price
  const agreement = rawAgreement === undefined || rawAgreement === null ? null : moneyCents(rawAgreement)
  if (rawAgreement !== undefined && rawAgreement !== null && (snapshot.sale_type !== 'gift' || agreement === null || agreement * quantity >= 10000000000)) reject('赠品原单约定金额异常')
  const item = { item_id: row.item_id, accessory_id: row.accessory_id, accessory_sale_id: row.accessory_sale_id,
    sale_type: snapshot.sale_type, name: typeof snapshot.name === 'string' ? snapshot.name : null,
    quantity, unit_price: price / 100, points_used: used, deduction_amount: deduction / 100, gross_amount: gross / 100, total_amount: total / 100, points_awarded: Number(row.points_awarded), serial_numbers: serials,
    gift_return_unit_price: agreement === null ? null : agreement / 100,
    gift_return_total: agreement === null ? null : agreement * quantity / 100,
    gift_agreement_state: snapshot.sale_type === 'gift' ? agreement === null ? 'not_recorded' : 'recorded' : null }
  const commission = readGoodsCommission(snapshot.commission, { employeeId: row.sale_operator_id, quantity, saleType: snapshot.sale_type, paidCents: total,
    purchaseCostCents: row.purchase_cost === null ? null : moneyCents(row.purchase_cost) ?? undefined, pointsUsed: used })
  return { item, units: snapshot.points_units, commission }
}

module.exports = { readCheckoutGoods }
