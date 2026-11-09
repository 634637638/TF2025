/**
 * 全站支付方式配置。
 *
 * 这些值必须与现有接口契约保持一致。销售场景的 payment_method
 * 与结算场景的 payment_method 语义不同，因此通过场景筛选选项，
 * 但所有显示名称和历史值解析都从这里统一维护。
 * 销售类顶层支付方式固定为现金支付、移动支付、银行卡、国补刷卡；
 * 银行卡下的刷卡付款和银行转账属于 payment_channel，不是 payment_method。
 */
import paymentOptions from '../../../backend/src/config/payment-methods.json'

export type PaymentMethodValue =
  | 'cash'
  | 'mobile'
  | 'bank_card'
  | 'subsidy_card'
  | 'transfer'
  | 'bank_transfer'
  | 'wechat'
  | 'alipay'
  | 'card_consumption'
  | 'other'

export interface PaymentMethodOption {
  label: string
  value: PaymentMethodValue | string
}

export const SALE_PAYMENT_METHODS: readonly PaymentMethodOption[] = paymentOptions.sale

export const BATCH_SALE_PAYMENT_METHODS: readonly PaymentMethodOption[] = [
  ...SALE_PAYMENT_METHODS
]

/** 销售表单中需要展示支付渠道的顶层支付方式。 */
export const hasPaymentChannelOptions = (paymentMethod?: string): boolean => {
  return getPaymentChannelOptions(paymentMethod).length > 0
}

/** 销售表单中允许填写交易流水号的顶层支付方式。 */
export const requiresTransactionNumber = (paymentMethod?: string): boolean => {
  return ['mobile', 'bank_card'].includes(String(paymentMethod || ''))
}

export const RENTAL_PAYMENT_METHODS: readonly PaymentMethodOption[] = [
  ...BATCH_SALE_PAYMENT_METHODS,
  ...paymentOptions.settlement.filter(option => option.value === 'other')
]

/** 退款复用全局支付方式的名称和编码，并保留原路退回。 */
export const REFUND_PAYMENT_METHODS: readonly PaymentMethodOption[] = [
  ...SALE_PAYMENT_METHODS.filter(option => !paymentOptions.refund.excludedSaleMethods.includes(option.value)),
  ...paymentOptions.refund.extraMethods
]

export const SETTLEMENT_PAYMENT_METHODS: readonly PaymentMethodOption[] = paymentOptions.settlement

export const MOBILE_PAYMENT_CHANNELS: readonly PaymentMethodOption[] = paymentOptions.channels.mobile

export const BANK_CARD_PAYMENT_CHANNELS: readonly PaymentMethodOption[] = paymentOptions.channels.bank_card

export const SUBSIDY_PAYMENT_CHANNELS: readonly PaymentMethodOption[] = paymentOptions.channels.subsidy_card

export const TRANSFER_PAYMENT_CHANNELS = MOBILE_PAYMENT_CHANNELS

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  transfer: '银行转账',
  现金: '现金支付',
  现金支付: '现金支付',
  微信支付: '微信',
  银行卡: '银行卡',
  银行转账: '银行转账',
  其他: '其他',
  ...Object.fromEntries([
    ...SALE_PAYMENT_METHODS, ...SETTLEMENT_PAYMENT_METHODS,
    ...REFUND_PAYMENT_METHODS, ...Object.values(paymentOptions.channels).flat()
  ].map(option => [option.value, option.label]))
}

export const getPaymentMethodLabel = (value: unknown, fallback = '-') => {
  const normalizedValue = String(value ?? '').trim()
  return PAYMENT_METHOD_LABELS[normalizedValue] || normalizedValue || fallback
}

const PAYMENT_CHANNELS: Readonly<Record<string, readonly PaymentMethodOption[]>> = paymentOptions.channels

export const getPaymentChannelOptions = (paymentMethod?: string): readonly PaymentMethodOption[] =>
  PAYMENT_CHANNELS[paymentMethod === 'transfer' ? 'mobile' : paymentMethod || ''] || []
