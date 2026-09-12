/**
 * 全站支付方式配置。
 *
 * 这些值必须与现有接口契约保持一致。销售场景的 payment_method
 * 与结算场景的 payment_method 语义不同，因此通过场景筛选选项，
 * 但所有显示名称和历史值解析都从这里统一维护。
 */
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

export const SALE_PAYMENT_METHODS: readonly PaymentMethodOption[] = [
  { label: '现金支付', value: 'cash' },
  { label: '移动支付', value: 'mobile' },
  { label: '银行卡', value: 'bank_card' },
  { label: '国补刷卡', value: 'subsidy_card' }
]

export const BATCH_SALE_PAYMENT_METHODS: readonly PaymentMethodOption[] = [
  ...SALE_PAYMENT_METHODS,
  { label: '银行转账', value: 'transfer' }
]

export const RENTAL_PAYMENT_METHODS: readonly PaymentMethodOption[] = [
  ...BATCH_SALE_PAYMENT_METHODS,
  { label: '其他', value: 'other' }
]

export const REFUND_PAYMENT_METHODS: readonly PaymentMethodOption[] = [
  { label: '现金退款', value: '现金退款' },
  { label: '原路退回', value: '原路退回' },
  { label: '银行转账', value: '银行转账' },
  { label: '支付宝', value: '支付宝' },
  { label: '微信支付', value: '微信支付' }
]

export const SETTLEMENT_PAYMENT_METHODS: readonly PaymentMethodOption[] = [
  { label: '现金支付', value: 'cash' },
  { label: '银行转账', value: 'bank_transfer' },
  { label: '微信', value: 'wechat' },
  { label: '支付宝', value: 'alipay' },
  { label: '其他', value: 'other' }
]

export const MOBILE_PAYMENT_CHANNELS: readonly PaymentMethodOption[] = [
  { label: '微信', value: 'wechat' },
  { label: '支付宝', value: 'alipay' }
]

export const BANK_CARD_PAYMENT_CHANNELS: readonly PaymentMethodOption[] = [
  { label: '刷卡消费', value: 'card_consumption' },
  { label: '银行转账', value: 'bank_transfer' }
]

export const SUBSIDY_PAYMENT_CHANNELS: readonly PaymentMethodOption[] = [
  { label: '国补刷卡', value: 'subsidy_card' }
]

export const TRANSFER_PAYMENT_CHANNELS: readonly PaymentMethodOption[] = [
  { label: '微信', value: 'wechat' },
  { label: '支付宝', value: 'alipay' }
]

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: '现金支付',
  mobile: '移动支付',
  bank_card: '银行卡',
  subsidy_card: '国补刷卡',
  transfer: '银行转账',
  bank_transfer: '银行转账',
  wechat: '微信',
  alipay: '支付宝',
  card_consumption: '刷卡消费',
  other: '其他',
  现金: '现金支付',
  现金支付: '现金支付',
  微信支付: '微信',
  银行卡: '银行卡',
  银行转账: '银行转账',
  其他: '其他'
}

export const getPaymentMethodLabel = (value: unknown, fallback = '-') => {
  const normalizedValue = String(value ?? '').trim()
  return PAYMENT_METHOD_LABELS[normalizedValue] || normalizedValue || fallback
}

export const getPaymentChannelOptions = (paymentMethod?: string): readonly PaymentMethodOption[] => {
  switch (paymentMethod) {
  case 'mobile':
    return MOBILE_PAYMENT_CHANNELS
  case 'bank_card':
    return BANK_CARD_PAYMENT_CHANNELS
  case 'subsidy_card':
    return SUBSIDY_PAYMENT_CHANNELS
  case 'transfer':
    return TRANSFER_PAYMENT_CHANNELS
  default:
    return []
  }
}
