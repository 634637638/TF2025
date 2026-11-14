import { computed, shallowRef, ref, toValue, watch, type MaybeRefOrGetter } from 'vue'
import type { TableDoubleTapOptions } from '@/directives/table-double-tap'
import { isInteractiveTableTarget, isNestedTableDetailEvent } from '@/directives/table-double-tap'

interface Options<T> {
  enabled: MaybeRefOrGetter<boolean>
  rows: MaybeRefOrGetter<readonly T[]>
  getKey: (row: T) => string | number | undefined
  rowSelector?: string
  onOpen?: (row: T) => void
}

/** 手机平面表格的详情入口；不改变选择、不调用写接口。 */
export function useMobileTableDetail<T>(options: Options<T>) {
  const detailRow = shallowRef<T | null>(null)
  const detailVisible = ref(false)
  const openDetail = (row: T) => {
    if (!toValue(options.enabled) || options.getKey(row) === undefined) return
    if (options.onOpen) {
      options.onOpen(row)
      return
    }
    detailRow.value = row
    detailVisible.value = true
  }
  const closeDetail = () => { detailVisible.value = false }
  const doubleTapOptions = computed<TableDoubleTapOptions>(() => ({
    enabled: toValue(options.enabled),
    rowSelector: options.rowSelector,
    getRowKey: index => {
      const row = toValue(options.rows)[index]
      return row ? options.getKey(row) : undefined
    },
    onDoubleTap: index => {
      const row = toValue(options.rows)[index]
      if (row) openDetail(row)
    }
  }))
  const handleRowDoubleClick = (row: T, _column: unknown, event?: Event) => {
    if (!isInteractiveTableTarget(event?.target ?? null) && !isNestedTableDetailEvent(event)) openDetail(row)
  }
  const runDetailAction = (action: (row: T) => unknown) => {
    const row = detailRow.value
    if (!row || !detailVisible.value || !toValue(options.enabled)) return
    if (!toValue(options.rows).some(item => options.getKey(item) === options.getKey(row))) return
    closeDetail()
    return action(row)
  }
  watch(() => toValue(options.enabled), enabled => { if (!enabled) closeDetail() })
  watch(() => [...toValue(options.rows)], rows => {
    const current = detailRow.value
    if (!current) return
    const updated = rows.find(row => options.getKey(row) === options.getKey(current))
    if (updated) detailRow.value = updated
    else closeDetail()
  })
  return { detailRow, detailVisible, doubleTapOptions, handleRowDoubleClick, runDetailAction, closeDetail }
}
