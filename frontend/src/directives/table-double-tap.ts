import type { Directive } from 'vue'

export interface TableDoubleTapOptions {
  enabled: boolean
  /** 卡片/原生列表显式标记记录节点；省略时使用 Element Plus 数据行。 */
  rowSelector?: string
  getRowKey: (rowIndex: number) => string | number | undefined
  onDoubleTap: (rowIndex: number) => void
}

const DOUBLE_TAP_DELAY = 400
const MOVE_TOLERANCE = 10
const INTERACTIVE_SELECTOR = 'button, a, input, select, textarea, [role="button"], [contenteditable="true"], .el-button, .el-checkbox, .el-radio, .el-switch, .actions-cell, .action-buttons, [data-table-interactive], .clickable-text, .qrcode-trigger, .el-dropdown, .el-color-picker, .drag-handle, .group-drag-handle, .el-tabs__header'

export const isInteractiveTableTarget = (target: EventTarget | null): boolean =>
  target instanceof Element && Boolean(target.closest(INTERACTIVE_SELECTOR))

interface Tap {
  key: string | number
  time: number
}

interface TouchStart extends Tap {
  identifier: number
  x: number
  y: number
}

interface TableDoubleTapState {
  options: TableDoubleTapOptions
  reset: () => void
  cleanup: () => void
}

const states = new WeakMap<HTMLElement, TableDoubleTapState>()

/** 原生 dblclick 冒泡时，父记录不可接管已接入公共入口的子列表。 */
export function isNestedTableDetailEvent(event?: Event): boolean {
  if (!(event?.target instanceof Element) || !(event.currentTarget instanceof Element)) return false
  if (event.target === event.currentTarget) return false
  for (let parent = event.target.parentElement; parent && parent !== event.currentTarget; parent = parent.parentElement) {
    if (states.has(parent)) return true
  }
  return false
}

/** 平面表格或显式标记的记录列表：同一记录连续完成两次轻触后打开详情。 */
export const vTableDoubleTap: Directive<HTMLElement, TableDoubleTapOptions> = {
  mounted(el, binding) {
    let lastTap: Tap | null = null
    let touchStart: TouchStart | null = null
    let suppressNativeUntil = 0
    const reset = () => {
      lastTap = null
      touchStart = null
    }
    const state: TableDoubleTapState = { options: binding.value, reset, cleanup: () => {} }

    const getRowIndex = (target: EventTarget | null) => {
      if (!(target instanceof Element) || isInteractiveTableTarget(target)) return -1
      const selector = state.options.rowSelector
      const row = target.closest(selector || 'tr.el-table__row')
      if (!row || !el.contains(row)) return -1
      if (selector) {
        // 子列表独立接入时只交给最近的宿主，避免同时打开父、子两份详情。
        for (let parent = target.parentElement; parent && parent !== el; parent = parent.parentElement) {
          if (states.has(parent)) return -1
        }
        const ownedRows = Array.from(el.querySelectorAll(selector)).filter(record => {
          for (let parent = record.parentElement; parent && parent !== el; parent = parent.parentElement) {
            if (states.has(parent)) return false
          }
          return true
        })
        return row === el ? 0 : ownedRows.indexOf(row)
      }
      if (row.closest('.el-table') !== el) return -1
      return Array.from(row.parentElement?.children || [])
        .filter(child => child.matches('tr.el-table__row'))
        .indexOf(row)
    }

    const handleTouchStart = (event: TouchEvent) => {
      if (!state.options.enabled || event.touches.length !== 1) {
        reset()
        return
      }
      const rowIndex = getRowIndex(event.target)
      const key = rowIndex >= 0 ? state.options.getRowKey(rowIndex) : undefined
      if (key === undefined) {
        reset()
        return
      }
      const touch = event.touches[0]
      touchStart = { key, time: performance.now(), identifier: touch.identifier, x: touch.clientX, y: touch.clientY }
    }

    const handleTouchMove = (event: TouchEvent) => {
      const touch = event.touches[0]
      if (!touchStart || event.touches.length !== 1 || !touch
        || Math.abs(touch.clientX - touchStart.x) > MOVE_TOLERANCE
        || Math.abs(touch.clientY - touchStart.y) > MOVE_TOLERANCE) reset()
    }

    const handleTouchEnd = (event: TouchEvent) => {
      const start = touchStart
      touchStart = null
      const touch = event.changedTouches[0]
      const now = performance.now()
      const rowIndex = getRowIndex(event.target)
      const key = rowIndex >= 0 ? state.options.getRowKey(rowIndex) : undefined
      if (!state.options.enabled || !start || !touch || event.touches.length
        || touch.identifier !== start.identifier || key !== start.key
        || now - start.time > DOUBLE_TAP_DELAY
        || Math.abs(touch.clientX - start.x) > MOVE_TOLERANCE
        || Math.abs(touch.clientY - start.y) > MOVE_TOLERANCE) {
        reset()
        return
      }
      // 触摸只由完整轻触序列判定。浏览器可能把跨行或切页前的 click 合成为
      // 当前行的 dblclick，单次轻触的兼容事件也不能绕过公共双击判定。
      suppressNativeUntil = now + DOUBLE_TAP_DELAY
      if (lastTap?.key === key && now - lastTap.time <= DOUBLE_TAP_DELAY) {
        // 只在确认双击时取消兼容 click，避免新弹窗遮罩收到同一次轻触。
        if (event.cancelable) event.preventDefault()
        reset()
        state.options.onDoubleTap(rowIndex)
      } else {
        lastTap = { key: start.key, time: now }
      }
    }

    const handleNativeDoubleClick = (event: MouseEvent) => {
      if (!state.options.enabled || suppressNativeUntil === 0
        || performance.now() > suppressNativeUntil || getRowIndex(event.target) < 0) return
      // 不可取消的触摸结束也可能生成 dblclick，避免再触发单元格或行双击。
      event.stopImmediatePropagation()
      if (event.cancelable) event.preventDefault()
    }

    el.addEventListener('touchstart', handleTouchStart, { passive: true })
    el.addEventListener('touchmove', handleTouchMove, { passive: true })
    el.addEventListener('touchend', handleTouchEnd, { passive: false })
    el.addEventListener('touchcancel', reset, { passive: true })
    el.addEventListener('scroll', reset, true)
    el.addEventListener('dblclick', handleNativeDoubleClick, true)
    state.cleanup = () => {
      reset()
      el.removeEventListener('touchstart', handleTouchStart)
      el.removeEventListener('touchmove', handleTouchMove)
      el.removeEventListener('touchend', handleTouchEnd)
      el.removeEventListener('touchcancel', reset)
      el.removeEventListener('scroll', reset, true)
      el.removeEventListener('dblclick', handleNativeDoubleClick, true)
    }
    states.set(el, state)
  },
  updated(el, binding) {
    const state = states.get(el)
    if (!state) return
    state.options = binding.value
    if (!binding.value.enabled) state.reset()
  },
  unmounted(el) {
    states.get(el)?.cleanup()
    states.delete(el)
  }
}
