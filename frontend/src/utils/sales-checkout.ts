import { getRequestErrorPayload, getRequestErrorStatus } from '@/utils/api-response'
import { isValidMobilePhone, normalizePersonName, normalizePhoneDigits } from '@/utils/security'
import { isValidAccessorySerial, normalizeAccessorySerial } from '@/utils/accessory-serial'
import type { CheckoutCustomerForm, CheckoutGoodsDraft, CheckoutPhone, CheckoutQuickPhone, SalesCheckoutInput,
  GoodsReturnContext, GoodsReturnInput, GoodsReturnQuote, PhoneReturnSource, PhoneReturnChecklist,
  PhoneReturnInput, PhoneReturnQuote, GoodsExchangeContext, GoodsExchangeInput, GoodsExchangeQuote, GoodsExchangeResult } from '@/types/sales-checkout'

/** 仅识别事务前校验或已回滚的明确拒绝；不能据此解除此前已未知的提交。 */
export const isCheckoutSubmissionRejected = (error: unknown): boolean => {
  const status = getRequestErrorStatus(error), payload = getRequestErrorPayload(error)
  if (payload?.success !== false || typeof payload.code !== 'string') return false
  return (status === 400 || status === 409) && ['FILM_SERVICE_INVALID', 'FILM_DEVICE_REQUIRED', 'FILM_TEMPLATE_OVERLAP', 'FILM_TEMPLATE_REQUIRED', 'FILM_STOCK_AMBIGUOUS', 'FILM_STOCK_INSUFFICIENT', 'FILM_PRODUCT_REQUIRED', 'FILM_SERVICE_NOT_READY'].includes(payload.code) ||
    status === 400 && ['CHECKOUT_INVALID', 'CHECKOUT_RETURN_INVALID', 'POINTS_AVAILABLE_INSUFFICIENT'].includes(payload.code) ||
    status === 409 && ['CHECKOUT_RETURN_QUOTE_CHANGED', 'CHECKOUT_RETURN_PAYMENT_REQUIRED'].includes(payload.code)
}

export const createCheckoutKey = () => [...crypto.getRandomValues(new Uint8Array(16))].map(value => value.toString(16).padStart(2, '0')).join('')
/** 日期、备注及收款渠道可在外层完善；积分依据只绑定客户、门店和实际交易明细。 */
export const checkoutPointsContext = (input: SalesCheckoutInput) => JSON.stringify({
  store_id: input.store_id, customer_phone: input.customer_info.phone, phones: input.phones,
  quick_phone: input.quick_phone, accessories: input.accessories.map(row => ({
    key: row.key, accessory_id: row.accessory_id, quantity: row.quantity, unit_price: row.unit_price,
    sale_type: row.sale_type, linked_phone_id: row.linked_phone_id, serial_numbers: row.serial_numbers,
    gift_return_unit_price: row.gift_return_unit_price, redeem_points: row.redeem_points || 0
  }))
})
const nonnegativeInteger = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
const record = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value))
const serialList = (value: unknown): value is string[] => Array.isArray(value) && value.every(item => typeof item === 'string' && item.length > 0) && new Set(value).size === value.length

const positiveId = (value: unknown): value is number => nonnegativeInteger(value) && value > 0
const nullableInteger = (value: unknown): value is number | null => value === null || nonnegativeInteger(value)
const nullableMoney = (value: unknown): value is number | null => value === null || typeof value === 'number' &&
  Number.isFinite(value) && value >= 0 && value < 100000000 && Math.abs(value * 100 - Math.round(value * 100)) < 0.000001

/** 核对允许字段脱敏为NULL；有权限可见的事实仍须数量、SN和原赠品约定守恒。 */
export const isPhoneReturnSource = (value: unknown, phoneId: number): value is PhoneReturnSource => {
  if (!record(value)) return false
  if (value.mode === 'standalone') return value.phone_id === phoneId && positiveId(value.sale_id)
  if (value.mode !== 'checkout' || !record(value.phone) || value.phone.phone_id !== phoneId ||
    !positiveId(value.order_id) || typeof value.order_no !== 'string' || !value.order_no.trim() ||
    !positiveId(value.store_id) || !positiveId(value.phone.sale_id) || !positiveId(value.phone.item_id) ||
    !nullableMoney(value.phone.total_amount) || !nullableInteger(value.phone.points_awarded) || !Array.isArray(value.accessories)) return false
  const ids = new Set<number>()
  return value.accessories.every(item => {
    if (!record(item) || !positiveId(item.item_id) || ids.has(item.item_id) ||
      !(item.accessory_id === null || positiveId(item.accessory_id)) || !positiveId(item.accessory_sale_id) ||
      !(typeof item.name === 'string' || item.name === null) || !(item.sale_type === null || item.sale_type === 'sale' || item.sale_type === 'gift') ||
      !(item.unit === undefined || item.unit === null || typeof item.unit === 'string') ||
      !['quantity', 'returned_quantity', 'remaining_quantity'].every(key => nullableInteger(item[key])) ||
      !['unit_price', 'total_amount', 'gift_return_unit_price', 'gift_return_total', 'remaining_gift_return_total'].every(key => nullableMoney(item[key])) ||
      !(item.gift_agreement_state === null || item.gift_agreement_state === 'recorded' || item.gift_agreement_state === 'not_recorded') ||
      !(item.serial_numbers === null || serialList(item.serial_numbers)) ||
      !(item.available_serial_numbers === null || serialList(item.available_serial_numbers))) return false
    ids.add(item.item_id)
    const { quantity, returned_quantity: returned, remaining_quantity: remaining, serial_numbers: serials, available_serial_numbers: available } = item
    if ([quantity, returned, remaining].some(part => part === null) && ![quantity, returned, remaining].every(part => part === null) ||
      (serials === null) !== (available === null)) return false
    if (typeof quantity === 'number' && typeof returned === 'number' && typeof remaining === 'number' &&
      (!quantity || returned + remaining !== quantity)) return false
    if (Array.isArray(serials) && Array.isArray(available) && (available.some(sn => !serials.includes(sn)) ||
      (!serials.length && available.length) || typeof quantity === 'number' && serials.length > 0 && serials.length !== quantity ||
      typeof remaining === 'number' && serials.length > 0 && available.length !== remaining)) return false
    return !(item.sale_type === 'gift' && typeof item.gift_return_unit_price === 'number' && typeof remaining === 'number' &&
      typeof item.remaining_gift_return_total === 'number' && Math.round(item.gift_return_unit_price * 100) * remaining !== Math.round(item.remaining_gift_return_total * 100))
  })
}

/** JSON不能仅凭TS声明信任；资金确认前核对原明细、数量及金额守恒。 */
export const isGoodsReturnContext = (value: unknown, orderId: number, itemId: number): value is GoodsReturnContext =>
  record(value) && value.order_id === orderId && value.item_id === itemId &&
  (value.name === null || typeof value.name === 'string') && (value.sale_type === 'sale' || value.sale_type === 'gift') &&
  nonnegativeInteger(value.quantity) && value.quantity > 0 && nonnegativeInteger(value.returned_quantity) && nonnegativeInteger(value.remaining_quantity) &&
  value.returned_quantity + value.remaining_quantity === value.quantity && typeof value.serial_tracking === 'boolean' && serialList(value.serial_numbers) &&
  (value.serial_tracking ? value.serial_numbers.length === value.remaining_quantity : value.serial_numbers.length === 0)

const goodsReturnFacts = (value: unknown, context: GoodsReturnContext, input: GoodsReturnInput): value is GoodsReturnQuote => {
  if (!record(value) || value.order_id !== context.order_id || value.item_id !== context.item_id || value.store_id !== input.store_id ||
    value.quantity !== input.quantity || value.remaining_quantity !== context.remaining_quantity - input.quantity || !serialList(value.serial_numbers) ||
    input.settlement && (input.settlement.refund_amount !== value.refund_amount || input.settlement.collection_amount !== value.collection_amount) ||
    JSON.stringify([...value.serial_numbers].sort()) !== JSON.stringify([...input.serial_numbers].sort()) ||
    typeof value.points_delta !== 'number' || !Number.isSafeInteger(value.points_delta) ||
    !nonnegativeInteger(value.points_award_returned) || !nonnegativeInteger(value.points_redemption_returned)) return false
  const fields = ['base_refund_amount', 'points_recovery_amount', 'points_compensation_amount', 'refund_amount', 'collection_amount']
  const amounts = fields.map(field => value[field])
  if (!amounts.every((amount): amount is number => typeof amount === 'number' && amount >= 0 &&
    Number.isSafeInteger(Math.round(amount * 100)) && Math.abs(amount * 100 - Math.round(amount * 100)) < 0.000001)) return false
  return !(Number(value.refund_amount) && Number(value.collection_amount))
}

/** 换入用途来自原单实际扣款核对，不按旧赠品标记或客户端售价推断。 */
export const isGoodsExchangeContext = (value: unknown, orderId: number, itemId: number): value is GoodsExchangeContext =>
  record(value) && isGoodsReturnContext(value, orderId, itemId) && typeof value.gift_charge_settled === 'boolean' &&
  (value.gift_charge_settled ? value.sale_type === 'gift' && value.replacement_sale_type === 'sale' : value.replacement_sale_type === value.sale_type)

export const isGoodsReturnQuote = (value: unknown, context: GoodsReturnContext, input: GoodsReturnInput): value is GoodsReturnQuote =>
  goodsReturnFacts(value, context, input) && Math.round(value.base_refund_amount * 100) + Math.round(value.points_compensation_amount * 100) -
    Math.round(value.points_recovery_amount * 100) === Math.round(value.refund_amount * 100) - Math.round(value.collection_amount * 100)

/** 新件按完整净价核验，现金只确认本次净差价；销售员及新旧SN均与当前草稿一致。 */
export const isGoodsExchangeQuote = (value: unknown, context: GoodsReturnContext, input: GoodsExchangeInput): value is GoodsExchangeQuote => {
  if (!isGoodsExchangeContext(context, context.order_id, context.item_id) || !record(value) || !goodsReturnFacts(value, context, input) || value.operator_id !== input.operator_id ||
    value.replacement_accessory_id !== input.replacement.accessory_id || !serialList(value.replacement_serial_numbers) ||
    JSON.stringify([...value.replacement_serial_numbers].sort()) !== JSON.stringify([...(input.replacement.serial_numbers || [])].sort()) ||
    !nonnegativeInteger(value.points_used) || value.points_used !== (input.replacement.redeem_points || 0) || !nonnegativeInteger(value.points_earned) ||
    (value.points_used > 0 || context.replacement_sale_type === 'gift') && value.points_earned !== 0) return false
  const fields = ['replacement_amount', 'replacement_paid_amount', 'original_collection_amount', 'deduction_amount']
  if (!fields.every(key => typeof value[key] === 'number' && value[key] >= 0 && Number.isSafeInteger(Math.round(value[key] * 100)) &&
    Math.abs(value[key] * 100 - Math.round(value[key] * 100)) < 0.000001)) return false
  const newAmount = Math.round(Number(value.replacement_amount) * 100), paid = Math.round(Number(value.replacement_paid_amount) * 100),
    original = Math.round(Number(value.original_collection_amount) * 100), deduction = Math.round(Number(value.deduction_amount) * 100),
    collection = Math.round(value.collection_amount * 100)
  const net = Math.round(value.base_refund_amount * 100) + Math.round(value.points_compensation_amount * 100) - Math.round(value.points_recovery_amount * 100) - newAmount
  return Number.isSafeInteger(net) && Number.isSafeInteger(newAmount + deduction) && newAmount + deduction === Math.round(input.replacement.unit_price * 100) * input.quantity &&
    paid === Math.min(collection, newAmount) && original === Math.max(0, collection - newAmount) &&
    net === Math.round(value.refund_amount * 100) - collection && (value.points_used > 0 || deduction === 0)
}

export const isGoodsExchangeResult = (value: unknown, context: GoodsReturnContext, input: GoodsExchangeInput): value is GoodsExchangeResult =>
  record(value) && isGoodsExchangeQuote(value, context, input) &&
  ['aftersale_id', 'replacement_order_id', 'replacement_item_id', 'root_order_id', 'root_item_id'].every(key => positiveId(value[key])) &&
  value.replacement_order_id !== context.order_id && Number(value.replacement_item_id) > context.item_id && Number(value.root_item_id) <= context.item_id &&
  typeof value.exchange_credit_amount === 'number' && value.exchange_credit_amount >= 0 && Number.isSafeInteger(Math.round(value.exchange_credit_amount * 100)) &&
  Math.abs(value.exchange_credit_amount * 100 - Math.round(value.exchange_credit_amount * 100)) < 0.000001 && Math.round(value.exchange_credit_amount * 100) ===
    Math.max(0, Math.round(value.replacement_amount * 100) - Math.round(value.collection_amount * 100))

/** 同笔手机售后一次确认净资金，逐条核对返库和未退赠品，不能把扣款数量算作已退。 */
export const isPhoneReturnQuote = (value: unknown, context: PhoneReturnChecklist, input: PhoneReturnInput): value is PhoneReturnQuote => {
  if (!record(value) || value.order_id !== context.order_id || value.sale_id !== context.phone.sale_id ||
    value.phone_id !== context.phone.phone_id || value.store_id !== input.store_id ||
    typeof value.points_delta !== 'number' || !Number.isSafeInteger(value.points_delta) ||
    !Array.isArray(value.accessories) || value.accessories.length !== context.accessories.length) return false
  const fields = ['base_refund_amount', 'points_recovery_amount', 'points_compensation_amount', 'gift_charge_amount', 'refund_amount', 'collection_amount']
  const values = fields.map(key => value[key])
  if (!values.every((amount): amount is number => typeof amount === 'number' && amount >= 0 &&
    Number.isSafeInteger(Math.round(amount * 100)) && Math.abs(amount * 100 - Math.round(amount * 100)) < 0.000001)) return false
  const [base, recovery, compensation, charge, refund, collection] = values.map(amount => Math.round(amount * 100))
  if (refund && collection || ![base + compensation, base + compensation - recovery - charge].every(Number.isSafeInteger) ||
    base + compensation - recovery - charge !== refund - collection) return false
  const ids = new Set<number>()
  let charges = 0
  for (const row of value.accessories) {
    if (!record(row) || !positiveId(row.item_id) || ids.has(row.item_id) ||
      !['returned_quantity', 'remaining_quantity', 'gift_charge_quantity'].every(key => nonnegativeInteger(row[key])) ||
      typeof row.gift_charge_amount !== 'number' || !nullableMoney(row.gift_charge_amount)) return false
    ids.add(row.item_id)
    const original = context.accessories.find(item => item.item_id === row.item_id), chosen = input.accessories.find(item => item.item_id === row.item_id)
    if (!original || !chosen || typeof original.remaining_quantity !== 'number' ||
      row.returned_quantity !== chosen.quantity || row.remaining_quantity !== original.remaining_quantity - chosen.quantity) return false
    const missing = original.sale_type === 'gift' && chosen.charge_missing ? row.remaining_quantity : 0
    if (row.gift_charge_quantity !== missing || missing && (original.gift_return_unit_price === null || !chosen.charge_confirmed) ||
      Math.round(row.gift_charge_amount * 100) !== missing * Math.round((original.gift_return_unit_price || 0) * 100)) return false
    charges += Math.round(row.gift_charge_amount * 100)
  }
  return charges === charge
}

const cents = (value: unknown) => {
  if (value === null || value === undefined || value === '') throw new Error('请填写销售价格')
  const amount = Number(value)
  if (!Number.isFinite(amount) || amount < 0 || Math.abs(amount * 100 - Math.round(amount * 100)) > 0.000001) throw new Error('价格须为非负数且最多两位小数')
  return Math.round(amount * 100)
}

/** 销售与换货共用实际库存/SN/价格预检；不替代后端库存锁及积分规则。 */
export const buildCheckoutGoods = (drafts: CheckoutGoodsDraft[], phones: CheckoutPhone[] = []) => {
  if (!drafts.length) throw new Error('请至少添加一条商品')
  const serials = new Set<string>(), quantities = new Map<number, number>()
  return drafts.map(row => {
    if (!row.option) throw new Error('请选择实际库存商品')
    const numbers = row.serial_mode ? row.serial_numbers.map(normalizeAccessorySerial) : []
    if (numbers.some(serial => !isValidAccessorySerial(serial) || serials.has(serial))) throw new Error('SN格式无效或同一单存在重复SN')
    numbers.forEach(serial => serials.add(serial))
    if (new Set(numbers).size !== numbers.length) throw new Error('同一单存在重复SN')
    const quantity = row.serial_mode ? numbers.length : row.quantity
    if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 999999) throw new Error('请填写正整数数量或录入实际SN')
    // 精确SN候选的库存为该件1件；不能把同商品其他SN累计后与这1件比较。
    const pickedSerial = row.option.serial_number
    if (pickedSerial && (!row.serial_mode || quantity !== 1 || numbers[0] !== normalizeAccessorySerial(pickedSerial))) throw new Error('请选择候选对应的实际在库SN')
    const used = pickedSerial ? quantity : (quantities.get(row.option.id) || 0) + quantity
    if (!pickedSerial) quantities.set(row.option.id, used)
    if (used > Number(row.option.quantity)) throw new Error('商品数量超过所选门店库存，请重新核对')
    if (phones.length && !phones.some(item => item.phone_id === row.linked_phone_id)) throw new Error('每条搭售或赠品必须选择关联手机')
    const price = row.sale_type === 'gift' ? 0 : cents(row.unit_price)
    if (row.sale_type === 'sale' && price <= 0) throw new Error('收费商品单价须大于0，赠品请选择赠送')
    const redeem = row.redeem_points ?? 0
    if (typeof redeem !== 'number' || !Number.isSafeInteger(redeem) || redeem < 0 || redeem > 2147483647) throw new Error('抵扣积分须为有效非负整数')
    if (row.sale_type === 'gift' && redeem) throw new Error('赠品不能使用积分抵扣')
    return { key: row.key, accessory_id: row.option.id, quantity, unit_price: price / 100, sale_type: row.sale_type,
      ...(redeem ? { redeem_points: redeem } : {}),
      ...(phones.length ? { linked_phone_id: row.linked_phone_id } : {}), ...(row.serial_mode ? { serial_numbers: numbers } : {}),
      ...(row.sale_type === 'gift' && row.gift_return_unit_price !== null && row.gift_return_unit_price !== undefined ? { gift_return_unit_price: cents(row.gift_return_unit_price) / 100 } : {}) }
  })
}

export const buildCheckoutInput = (form: CheckoutCustomerForm, phones: CheckoutPhone[], drafts: CheckoutGoodsDraft[], key: string, quickPhone?: CheckoutQuickPhone, allowMissingPhone = false): SalesCheckoutInput => {
  if (quickPhone && (phones.length !== 1 || phones[0].phone_id !== 1 || phones[0].sale_price !== quickPhone.sale_price)) throw new Error('快速出库设备与整单内容不一致，请重新打开结算')
  const phone = normalizePhoneDigits(form.customer_phone)
  const name = normalizePersonName(form.customer_name, 50)
  if (name.length < 2 || !allowMissingPhone && !isValidMobilePhone(phone)) throw new Error('请填写客户姓名和有效手机号')
  if (!Number.isSafeInteger(Number(form.store_id)) || Number(form.store_id) < 1 || !Number.isSafeInteger(Number(form.operator_id)) || Number(form.operator_id) < 1) throw new Error('请选择销售门店和销售员')
  if (!form.sale_time || !form.payment_method) throw new Error('请选择销售日期和支付方式')
  let total = 0
  for (const item of phones) {
    if (!Number.isSafeInteger(item.phone_id) || item.phone_id < 1 || cents(item.sale_price) <= 0) throw new Error('每台手机须有有效销售价格')
    total += cents(item.sale_price)
  }
  const accessories = buildCheckoutGoods(drafts, phones)
  total += accessories.reduce((sum, item) => sum + Math.round(item.unit_price * 100) * item.quantity, 0)
  if (!Number.isSafeInteger(total) || total >= 10000000000) throw new Error('整单金额超出范围')
  return { request_key: key, store_id: Number(form.store_id), operator_id: Number(form.operator_id),
    customer_info: { name, phone, ...(form.apple_id ? { apple_id: form.apple_id } : {}) },
    phones: quickPhone ? [] : phones.map(({ phone_id, sale_price }) => ({ phone_id, sale_price })), accessories,
    ...(quickPhone ? { quick_phone: quickPhone } : {}),
    sale_time: form.sale_time, remarks: form.remarks.trim(), payment_info: { payment_method: form.payment_method,
      payment_channel: form.payment_channel || null, transaction_no: form.transaction_no || null,
      payment_amount: total / 100, payment_status: 'success', payment_time: form.sale_time } }
}
