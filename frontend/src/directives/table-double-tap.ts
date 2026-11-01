import type { Directive } from 'vue'

interface TableDoubleTapOptions {
  enabled: boolean
  getRowKey: (rowIndex: number) => string | number | undefined
  onDoubleTap: (rowIndex: number) => void
}

const DOUBLE_TAP_DELAY = 400
const MOVE_TOLERANCE = 10
const INTERACTIVE_SELECTOR = 'button, a, input, select, textarea, [role="button"], [contenteditable="true"], .el-button, .el-checkbox, .el-radio, .el-switch, .actions-cell, .action-buttons'

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

/** 普通平面 Element Plus 表格：同一记录连续完成两次轻触后打开详情。 */
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
      if (!(target instanceof Element) || target.closest(INTERACTIVE_SELECTOR)) return -1
      const row = target.closest('tr.el-table__row')
      if (!row || !el.contains(row) || row.closest('.el-table') !== el) return -1
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
      if (lastTap?.key === key && now - lastTap.time <= DOUBLE_TAP_DELAY) {
        // 只在确认双击时取消兼容 click/dblclick，避免新弹窗遮罩收到同一次轻触。
        if (event.cancelable) event.preventDefault()
        suppressNativeUntil = now + DOUBLE_TAP_DELAY
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
