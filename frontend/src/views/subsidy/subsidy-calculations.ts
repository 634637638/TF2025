import type { NationalSubsidyRecord } from '@/types'
import { formatAmount } from '@/utils/format'
import { TIME_FORMATS, TimeUtil } from '@/utils/time'

// 国补计算先转换为分；相对误差补偿避免 30.014999999999997 等浮点尾差。
const toCents = (amount: number) => Math.round((amount + Number.EPSILON * Math.max(1, Math.abs(amount))) * 100)

export const calculateSubsidyAmount = (price: number, rate = 15): number => {
  if (!Number.isFinite(price) || !Number.isFinite(rate) || price <= 0 || price > 6000 || rate < 0) return 0
  return Math.min(Math.round(toCents(price) * rate / 100), 50000) / 100
}

/** 新申请与编辑缺省备注共用；已有人工备注原样保留。 */
export const buildSubsidyRemarks = (item: Pick<NationalSubsidyRecord,
  'sale_price' | 'subsidy_amount' | 'subsidy_rate' | 'serial_number' | 'sale_time' | 'remarks'
>): string => {
  if (item.remarks?.trim()) return item.remarks
  const salePrice = Number(item.sale_price ?? 0)
  if (!Number.isFinite(salePrice) || salePrice <= 0) return ''
  if (salePrice > 6000) return `商品售价${formatAmount(salePrice)}元（超过6000元，无法享受国补优惠）`

  const suppliedAmount = Number(item.subsidy_amount ?? calculateSubsidyAmount(salePrice, Number(item.subsidy_rate ?? 15)))
  const subsidyCents = Number.isFinite(suppliedAmount) ? toCents(suppliedAmount) : 0
  const cardPayment = (toCents(salePrice) - subsidyCents) / 100
  const saleTime = item.sale_time ? TimeUtil.format(item.sale_time, TIME_FORMATS.DATE) : ''
  return `序列号：${item.serial_number || ''}\n购买时间：${saleTime}\n商品售价：${formatAmount(salePrice)}元 国补优惠${formatAmount(subsidyCents / 100)}元 实际刷卡支付${formatAmount(cardPayment)}元`
}
