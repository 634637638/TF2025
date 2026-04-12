/**
 * 防抖工具组合式函数
 * 用于防止频繁触发的事件（如搜索输入、窗口大小变化等）
 */

import { ref, watch, onUnmounted, type Ref } from 'vue'

export function useDebounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number = 300
): {
  debouncedFn: (...args: Parameters<T>) => void
  cancel: () => void
  flush: (...args: Parameters<T>) => void
} {
  let timeoutId: NodeJS.Timeout | null = null

  const debouncedFn = (...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId)
    }

    timeoutId = setTimeout(() => {
      fn(...args)
    }, delay)
  }

  const cancel = () => {
    if (timeoutId) {
      clearTimeout(timeoutId)
      timeoutId = null
    }
  }

  const flush = (...args: Parameters<T>) => {
    cancel()
    fn(...args)
  }

  // 组件卸载时清理定时器
  onUnmounted(() => {
    cancel()
  })

  return {
    debouncedFn,
    cancel,
    flush
  }
}

export function useDebouncedValue<T>(
  value: Ref<T>,
  delay: number = 300
): {
  debouncedValue: Ref<T>
  cancel: () => void
} {
  const debouncedValue = ref(value.value) as Ref<T>
  let timeoutId: NodeJS.Timeout | null = null

  const cancel = () => {
    if (timeoutId) {
      clearTimeout(timeoutId)
      timeoutId = null
    }
  }

  watch(
    value,
    (newValue) => {
      cancel()

      timeoutId = setTimeout(() => {
        debouncedValue.value = newValue
      }, delay)
    },
    { immediate: true }
  )

  onUnmounted(() => {
    cancel()
  })

  return {
    debouncedValue,
    cancel
  }
}

// 专门的搜索防抖hook
export function useSearchDebounce(
  onSearch: (keyword: string) => void,
  delay: number = 500
) {
  const searchKeyword = ref('')
  const { debouncedFn, cancel } = useDebounce(onSearch, delay)

  const handleSearchInput = (keyword: string) => {
    searchKeyword.value = keyword
    debouncedFn(keyword)
  }

  const clearSearch = () => {
    cancel()
    searchKeyword.value = ''
    onSearch('')
  }

  return {
    searchKeyword,
    handleSearchInput,
    clearSearch,
    cancel
  }
}