import { TIME_FORMATS, TimeUtil } from '@/utils/time'

export const getInventoryDays = (dateValue?: string): number => {
  if (!dateValue) return 0

  const inventoryDate = TimeUtil.parse(dateValue)
  if (!inventoryDate || !inventoryDate.isValid()) return 0

  const difference = TimeUtil.diff(
    TimeUtil.now().startOf('day'),
    inventoryDate.startOf('day'),
    'day'
  )
  return difference > 0 ? difference : 0
}

export const formatInventoryDate = (dateValue?: string): string => {
  return dateValue ? TimeUtil.format(dateValue, TIME_FORMATS.DATE) : '-'
}

export const formatInventoryPrice = (price?: number | string): string => {
  if (!price && price !== 0) return '-'

  const numericPrice = typeof price === 'string' ? Number.parseFloat(price) : price
  if (Number.isInteger(numericPrice) || numericPrice % 1 === 0) {
    return Math.floor(numericPrice).toString()
  }
  return numericPrice.toFixed(2).replace(/\.?(?:0)+$/, '') || '0'
}

export const getInventoryDaysClass = (days: number): string => {
  if (days >= 30) return 'days-critical'
  if (days >= 20) return 'days-warning'
  if (days >= 10) return 'days-caution'
  return 'days-normal'
}

export const getInventoryDaysText = (days: number): string => `${days}天`

export const getMemoryBadgeClass = (memory?: string): string => {
  // 组合规格按存储容量分级，例如 8+256GB；TB 先换算为 GB。
  const match = memory?.match(/^\s*(?:\d+(?:\.\d+)?\s*(?:GB|G)?\s*\+\s*)?(\d+(?:\.\d+)?)\s*(TB|T|GB|G)?\s*$/i)
  if (!match) return 'memory-other'

  const capacity = Number(match[1]) * (/^T/i.test(match[2] ?? '') ? 1024 : 1)
  if (!Number.isFinite(capacity) || capacity <= 0) return 'memory-other'
  if (capacity >= 1000) return 'memory-1tb'
  if (capacity >= 512) return 'memory-512gb'
  if (capacity >= 256) return 'memory-256gb'
  if (capacity >= 128) return 'memory-128gb'
  if (capacity >= 64) return 'memory-64gb'
  return 'memory-small'
}
