interface TouchDoubleTapOptions {
  interval?: number
  suppressNativeDuration?: number
}

interface TouchDoubleTapHandlers<T> {
  handleTouchEnd: (event: TouchEvent, key: T) => void
  handleDoubleClick: (key: T) => void
}

const isIgnoredTouchTarget = (target: EventTarget | null): boolean => {
  const element = target instanceof HTMLElement ? target : null
  return Boolean(element?.closest('button, .el-button, .el-input__clear, .el-input__suffix'))
}

/**
 * 为桌面 dblclick 提供移动端两次触摸兜底，并抑制同一次手势造成的重复切换。
 */
export const useTouchDoubleTap = <T = undefined>(
  onDoubleTap: (key: T) => void,
  options: TouchDoubleTapOptions = {}
): TouchDoubleTapHandlers<T> => {
  const interval = options.interval ?? 400
  const suppressNativeDuration = options.suppressNativeDuration ?? 500
  let lastKey: T | undefined
  let hasLastKey = false
  let lastTouchAt = 0
  let suppressNativeUntil = 0

  const reset = () => {
    hasLastKey = false
    lastKey = undefined
    lastTouchAt = 0
  }

  const handleTouchEnd = (event: TouchEvent, key: T) => {
    if (isIgnoredTouchTarget(event.target)) {
      reset()
      return
    }

    const now = Date.now()
    if (hasLastKey && Object.is(lastKey, key) && now - lastTouchAt <= interval) {
      reset()
      suppressNativeUntil = now + suppressNativeDuration
      onDoubleTap(key)
      return
    }

    lastKey = key
    hasLastKey = true
    lastTouchAt = now
  }

  const handleDoubleClick = (key: T) => {
    if (Date.now() < suppressNativeUntil) return
    onDoubleTap(key)
  }

  return { handleTouchEnd, handleDoubleClick }
}
