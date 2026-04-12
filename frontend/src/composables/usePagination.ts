/**
 * 分页组合式函数 - 统一标准实现
 *
 * 功能：
 * - 分页状态管理
 * - 分页导航
 * - 总数/页数计算
 * - 每页条数控制
 *
 * 使用示例：
 * const pagination = usePagination({ page: 1, limit: 20, total: 100 })
 * pagination.nextPage()
 */
import { ref, computed, watch, type Ref, type ComputedRef } from 'vue'

export interface PaginationOptions {
  page?: number
  limit?: number
  total?: number
  onChange?: (page: number, limit: number) => void
}

export interface PaginationReturn {
  // 响应式状态
  page: Ref<number>
  limit: Ref<number>
  total: Ref<number>

  // 计算属性
  totalPages: ComputedRef<number>
  hasNextPage: ComputedRef<boolean>
  hasPrevPage: ComputedRef<boolean>
  startIndex: ComputedRef<number>
  endIndex: ComputedRef<number>
  range: ComputedRef<string>

  // 方法
  goToPage: (page: number) => void
  nextPage: () => void
  prevPage: () => void
  firstPage: () => void
  lastPage: () => void
  setLimit: (limit: number) => void
  setTotal: (total: number) => void
  reset: (options?: Partial<PaginationOptions>) => void

  // 便捷属性
  currentPage: ComputedRef<number>
  currentLimit: ComputedRef<number>
  currentTotal: ComputedRef<number>
}

export function usePagination(initialOptions: PaginationOptions = {}): PaginationReturn {
  const {
    page = 1,
    limit = 100,
    total = 0,
    onChange
  } = initialOptions

  // 响应式状态
  const currentPage = ref(page)
  const currentLimit = ref(limit)
  const currentTotal = ref(total)

  // 计算属性
  const totalPages = computed(() => {
    return Math.ceil(currentTotal.value / currentLimit.value) || 1
  })

  const hasNextPage = computed(() => {
    return currentPage.value < totalPages.value
  })

  const hasPrevPage = computed(() => {
    return currentPage.value > 1
  })

  const startIndex = computed(() => {
    return (currentPage.value - 1) * currentLimit.value
  })

  const endIndex = computed(() => {
    return Math.min(startIndex.value + currentLimit.value, currentTotal.value)
  })

  const range = computed(() => {
    if (currentTotal.value === 0) return '0-0'
    return `${startIndex.value + 1}-${endIndex.value}`
  })

  // 方法
  const goToPage = (pageNum: number) => {
    if (pageNum >= 1 && pageNum <= totalPages.value) {
      currentPage.value = pageNum
      onChange?.(currentPage.value, currentLimit.value)
    }
  }

  const nextPage = () => {
    if (hasNextPage.value) {
      goToPage(currentPage.value + 1)
    }
  }

  const prevPage = () => {
    if (hasPrevPage.value) {
      goToPage(currentPage.value - 1)
    }
  }

  const firstPage = () => {
    goToPage(1)
  }

  const lastPage = () => {
    goToPage(totalPages.value)
  }

  const setLimit = (newLimit: number) => {
    currentLimit.value = newLimit
    currentPage.value = 1
    onChange?.(currentPage.value, currentLimit.value)
  }

  const setTotal = (newTotal: number) => {
    currentTotal.value = newTotal
    // 如果当前页超出范围，重置到最后一页
    if (currentPage.value > totalPages.value) {
      currentPage.value = Math.max(1, totalPages.value)
    }
  }

  const reset = (options: Partial<PaginationOptions> = {}) => {
    currentPage.value = options.page ?? 1
    currentLimit.value = options.limit ?? 100
    currentTotal.value = options.total ?? 0
    onChange?.(currentPage.value, currentLimit.value)
  }

  // 监听总数变化，自动调整当前页
  watch(currentTotal, () => {
    if (currentPage.value > totalPages.value) {
      currentPage.value = Math.max(1, totalPages.value)
    }
  })

  return {
    // 响应式状态
    page: currentPage,
    limit: currentLimit,
    total: currentTotal,

    // 计算属性
    totalPages,
    hasNextPage,
    hasPrevPage,
    startIndex,
    endIndex,
    range,

    // 方法
    goToPage,
    nextPage,
    prevPage,
    firstPage,
    lastPage,
    setLimit,
    setTotal,
    reset,

    // 便捷属性
    currentPage: computed(() => currentPage.value),
    currentLimit: computed(() => currentLimit.value),
    currentTotal: computed(() => currentTotal.value)
  }
}

export default usePagination
