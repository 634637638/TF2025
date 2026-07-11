type OptionRecord = Record<string, unknown>

interface SortOptions {
  labelKeys?: string[]
  missingOrder?: number
}

const DEFAULT_LABEL_KEYS = [
  'name',
  'label',
  'title',
  'display_name',
  'username',
  'store_name',
  'capacity',
  'size',
  'value',
  'code'
]

const ORDER_KEYS = ['sort_order', 'sortOrder', 'order']
const ID_KEYS = ['id', 'value', 'key']

const isRecord = (value: unknown): value is OptionRecord =>
  typeof value === 'object' && value !== null

const toFiniteNumber = (value: unknown): number | null => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }

  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }

  return null
}

export const getOptionSortOrder = (item: unknown, missingOrder = 0): number => {
  if (!isRecord(item)) {
    return missingOrder
  }

  for (const key of ORDER_KEYS) {
    const order = toFiniteNumber(item[key])
    if (order !== null) {
      return order
    }
  }

  return missingOrder
}

export const getOptionLabel = (item: unknown, labelKeys: string[] = DEFAULT_LABEL_KEYS): string => {
  if (typeof item === 'string' || typeof item === 'number') {
    return String(item)
  }

  if (!isRecord(item)) {
    return ''
  }

  for (const key of labelKeys) {
    const value = item[key]
    if (value !== undefined && value !== null && String(value).trim()) {
      return String(value)
    }
  }

  return ''
}

const getOptionId = (item: unknown): number | string => {
  if (!isRecord(item)) {
    return ''
  }

  for (const key of ID_KEYS) {
    const value = item[key]
    if (value !== undefined && value !== null && String(value).trim()) {
      return toFiniteNumber(value) ?? String(value)
    }
  }

  return ''
}

export const sortOptionsByOrder = <T>(items: readonly T[] = [], options: SortOptions = {}): T[] => {
  const labelKeys = options.labelKeys || DEFAULT_LABEL_KEYS
  const missingOrder = options.missingOrder ?? 0

  return [...items]
    .map((item, index) => ({ item, index }))
    .sort((left, right) => {
      const orderDiff = getOptionSortOrder(left.item, missingOrder) - getOptionSortOrder(right.item, missingOrder)
      if (orderDiff !== 0) {
        return orderDiff
      }

      const labelDiff = getOptionLabel(left.item, labelKeys).localeCompare(
        getOptionLabel(right.item, labelKeys),
        'zh-CN',
        { numeric: true, sensitivity: 'base' }
      )
      if (labelDiff !== 0) {
        return labelDiff
      }

      const leftId = getOptionId(left.item)
      const rightId = getOptionId(right.item)
      if (typeof leftId === 'number' && typeof rightId === 'number' && leftId !== rightId) {
        return leftId - rightId
      }

      const idDiff = String(leftId).localeCompare(String(rightId), 'zh-CN', { numeric: true, sensitivity: 'base' })
      return idDiff || left.index - right.index
    })
    .map(({ item }) => item)
}
