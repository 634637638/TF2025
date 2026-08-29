import type { Phone } from '@/types'
import {
  extractBrandName,
  extractSeriesNumber,
  getBrandOrderWeight,
  getMemoryOrderWeight
} from '@/utils/productSort'
import type { InventorySummaryItem } from './types'

export const sortInventorySummary = (
  records: readonly InventorySummaryItem[]
): InventorySummaryItem[] => {
  return [...records].sort((left, right) => {
    const leftBrand = left.brand || ''
    const rightBrand = right.brand || ''
    const brandWeightDifference = getBrandOrderWeight(leftBrand) - getBrandOrderWeight(rightBrand)

    if (brandWeightDifference !== 0) return brandWeightDifference

    const normalizedLeftBrand = extractBrandName(leftBrand)
    const normalizedRightBrand = extractBrandName(rightBrand)
    if (normalizedLeftBrand !== normalizedRightBrand) {
      return normalizedLeftBrand.localeCompare(normalizedRightBrand, 'zh-CN')
    }

    if (left.condition !== right.condition) {
      return left.condition === '全新' ? -1 : 1
    }

    const seriesDifference = extractSeriesNumber(left.model) - extractSeriesNumber(right.model)
    if (seriesDifference !== 0) return seriesDifference

    if (left.model !== right.model) {
      return (left.model || '').localeCompare(right.model || '')
    }

    const memoryDifference = getMemoryOrderWeight(left.memory) - getMemoryOrderWeight(right.memory)
    if (memoryDifference !== 0) return memoryDifference

    return (left.color || '').localeCompare(right.color || '')
  })
}

export const sortAvailableSalesPhones = (records: readonly Phone[]): Phone[] => {
  return [...records].sort((left, right) => {
    const leftInventoryTime = new Date(left.inventory_time || 0).getTime()
    const rightInventoryTime = new Date(right.inventory_time || 0).getTime()
    if (leftInventoryTime !== rightInventoryTime) {
      return rightInventoryTime - leftInventoryTime
    }

    const brandWeightDifference = getBrandOrderWeight(left.brand) - getBrandOrderWeight(right.brand)
    if (brandWeightDifference !== 0) return brandWeightDifference

    const leftCondition = left.is_new ? '全新' : '二手'
    const rightCondition = right.is_new ? '全新' : '二手'
    if (leftCondition !== rightCondition) return leftCondition === '全新' ? -1 : 1

    const seriesDifference = extractSeriesNumber(left.model) - extractSeriesNumber(right.model)
    if (seriesDifference !== 0) return seriesDifference

    if (left.model !== right.model) {
      return (left.model || '').localeCompare(right.model || '')
    }

    const memoryDifference = getMemoryOrderWeight(left.memory) - getMemoryOrderWeight(right.memory)
    if (memoryDifference !== 0) return memoryDifference

    return (left.color || '').localeCompare(right.color || '')
  })
}
