'use strict'

const { moneyCents } = require('./sale-input')
const { isIntegerInput } = require('./input-values')
const { readGoodsCommission } = require('./goods-commission')
const reject = (message, statusCode = 409, code = 'CHECKOUT_FACTS_CONFLICT') => {
  throw Object.assign(new Error(message), { statusCode, code })
}
const points = value => ['number', 'string'].includes(typeof value) && /^\d+$/.test(String(value)) &&
  Number.isSafeInteger(Number(value)) && Number(value) >= 0 && Number(value) <= 2147483647
// 纯金额/分摊规划可不带关联ID；数据库事实有ID时统一按安全整数读取BIGINT。
const identity = value => {
  if (value === undefined || value === null) return value
  if (!isIntegerInput(value) || Number(value) <= 0) reject('关联商品原单标识异常')
  return Number(value)
}
const parseSnapshot = value => {
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed
  } catch { /* 原单损坏时拒绝猜测或读取当前商品资料补齐。 */ }
  reject('原商品快照异常，请核对原单')
}

/** 凭证与售后共用原赠品约定解析，缺失不当作零元，不取当前售价。 */
function readGiftReturnAgreement(value, saleType, quantity) {
  const snapshot = parseSnapshot(value)
  if (!['sale', 'gift'].includes(saleType) || snapshot.sale_type !== saleType ||
    !Number.isSafeInteger(quantity) || quantity < 1 || quantity > 999999) reject('赠品原单约定归属异常')
  const raw = snapshot.gift_return_unit_price
  const cents = raw === undefined || raw === null ? null : moneyCents(raw)
  if (raw !== undefined && raw !== null && (saleType !== 'gift' || cents === null || cents * quantity >= 10000000000)) reject('赠品原单约定金额异常')
  return { gift_return_unit_price: cents === null ? null : cents / 100,
    gift_return_total: cents === null ? null : cents * quantity / 100,
    gift_agreement_state: saleType === 'gift' ? cents === null ? 'not_recorded' : 'recorded' : null }
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
  const agreement = readGiftReturnAgreement(snapshot, snapshot.sale_type, quantity)
  const item = { item_id: identity(row.item_id), accessory_id: identity(row.accessory_id), accessory_sale_id: identity(row.accessory_sale_id),
    sale_type: snapshot.sale_type, name: typeof snapshot.name === 'string' ? snapshot.name : null,
    unit: typeof snapshot.unit === 'string' ? snapshot.unit : null,
    quantity, unit_price: price / 100, points_used: used, deduction_amount: deduction / 100, gross_amount: gross / 100, total_amount: total / 100, points_awarded: Number(row.points_awarded), serial_numbers: serials,
    ...agreement }
  const commission = readGoodsCommission(snapshot.commission, { employeeId: row.sale_operator_id, quantity, saleType: snapshot.sale_type, paidCents: total,
    purchaseCostCents: row.purchase_cost === null ? null : moneyCents(row.purchase_cost) ?? undefined, pointsUsed: used })
  return { item, units: snapshot.points_units, commission }
}

module.exports = { readCheckoutGoods, readGiftReturnAgreement }
