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
  return numericPrice.toFixed(2)
}

export const getInventoryDaysClass = (days: number): string => {
  if (days >= 30) return 'days-critical'
  if (days >= 20) return 'days-warning'
  if (days >= 10) return 'days-caution'
  return 'days-normal'
}

export const getInventoryDaysText = (days: number): string => `${days}天`

export const getLongestInventoryClass = (days: number): string => {
  if (days <= 15) return 'days-green'
  if (days <= 30) return 'days-yellow'
  return 'days-red'
}

export const getMemoryBadgeClass = (memory?: string): string => {
  if (!memory) return ''

  const capacity = Number.parseInt(memory, 10)
  if (Number.isNaN(capacity)) return 'memory-other'
  if (capacity >= 1000) return 'memory-1tb'
  if (capacity >= 512) return 'memory-512gb'
  if (capacity >= 256) return 'memory-256gb'
  if (capacity >= 128) return 'memory-128gb'
  if (capacity >= 64) return 'memory-64gb'
  return 'memory-small'
}
