export type ShopPaymentMethodCode =
  | 'pickup'
  | 'bank'
  | 'qr_wechat'
  | 'qr_alipay'
  | 'qr_other'
  | 'merchant_wechat'
  | 'merchant_alipay'
  | 'merchant_other'

export interface ShopPaymentConfig {
  wechat_qrcode?: string
  alipay_qrcode?: string
  other_qrcode?: string
  payment_qr_wechat_enabled?: boolean
  payment_qr_alipay_enabled?: boolean
  payment_qr_other_enabled?: boolean
  payment_qr_other_name?: string
  payment_bank_enabled?: boolean
  bank_info?: string
  wechat_pay_enabled?: boolean
  alipay_pay_enabled?: boolean
  payment_merchant_other_enabled?: boolean
  payment_default_method?: ShopPaymentMethodCode | string
}

export interface ShopPaymentOption {
  code: ShopPaymentMethodCode
  label: string
  description: string
  icon: string
  iconClass: string
}

/**
 * 根据公开配置生成商城可选支付方式。二维码必须同时满足开关和图片存在，
 * 商家接口由后台开关控制；服务端仍会再次校验，前端隐藏只负责改善体验。
 */
export function getShopPaymentOptions(config: ShopPaymentConfig): ShopPaymentOption[] {
  const options: ShopPaymentOption[] = [
    {
      code: 'pickup',
      label: '到店自提',
      description: '到店支付，方便快捷',
      icon: 'fas fa-store',
      iconClass: 'pickup'
    }
  ]

  if (config.payment_qr_wechat_enabled && config.wechat_qrcode) {
    options.push({ code: 'qr_wechat', label: '微信二维码', description: '使用微信扫一扫付款', icon: 'fab fa-weixin', iconClass: 'wechat' })
  }
  if (config.payment_qr_alipay_enabled && config.alipay_qrcode) {
    options.push({ code: 'qr_alipay', label: '支付宝二维码', description: '使用支付宝扫一扫付款', icon: 'fab fa-alipay', iconClass: 'alipay' })
  }
  if (config.payment_qr_other_enabled && config.other_qrcode && config.payment_qr_other_name) {
    options.push({ code: 'qr_other', label: config.payment_qr_other_name, description: '使用收款二维码付款', icon: 'fas fa-qrcode', iconClass: 'other' })
  }
  // 商家接口需要真正的下单适配器和回调验签；仅配置密钥不足以安全开放。
  if (config.payment_bank_enabled && config.bank_info) {
    options.push({ code: 'bank', label: '银行转账', description: '按银行信息完成转账', icon: 'fas fa-university', iconClass: 'bank' })
  }
  return options
}

export function isOnlinePaymentMethod(method: string): boolean {
  return method !== 'pickup'
}

export function getPaymentMethodLabel(method: string, config?: ShopPaymentConfig): string {
  const legacyLabels: Record<string, string> = { wechat: '微信支付', alipay: '支付宝' }
  if (legacyLabels[method]) return legacyLabels[method]
  const option = config ? getShopPaymentOptions(config).find(item => item.code === method) : undefined
  return option?.label || ({ pickup: '到店自提', bank: '银行转账', qr_wechat: '微信二维码', qr_alipay: '支付宝二维码', qr_other: '其他二维码', merchant_wechat: '微信商家支付', merchant_alipay: '支付宝商家支付', merchant_other: '其他商家支付' }[method] || '其他')
}
