import { ref, type Ref } from 'vue'

interface UseMobileRowDoubleTapOptions {
  /** 两次轻触判定为双击的最大间隔（毫秒），默认 320 */
  interval?: number
}

interface UseMobileRowDoubleTapReturn {
  /** 判断本次轻触是否在时间窗内命中同一行的第二次点击；命中后自动重置 */
  isDoubleTap: (key: string | number) => boolean
  /** 清空双击记录，切换视图、离开移动端或关闭行操作时调用 */
  resetDoubleTap: () => void
  lastTappedKey: Ref<string | number | null>
  lastTapTimestamp: Ref<number>
}

/**
 * 移动端表格行双击防护。
 *
 * el-table 的 `dblclick` 在移动端不可靠，页面统一通过 `@row-click` 记录同一行的
 * 两次轻触。这里只负责“时间窗 + 同一行”的检测与命中重置，双击后的具体行为
 * （展开行、打开详情、切换行操作菜单）仍由各页面决定，避免把某一类交互固化进公共实现。
 */
export function useMobileRowDoubleTap(
  options: UseMobileRowDoubleTapOptions = {}
): UseMobileRowDoubleTapReturn {
  const interval = options.interval ?? 320
  const lastTappedKey = ref<string | number | null>(null)
  const lastTapTimestamp = ref(0)

  const resetDoubleTap = () => {
    lastTappedKey.value = null
    lastTapTimestamp.value = 0
  }

  const isDoubleTap = (key: string | number): boolean => {
    const now = Date.now()
    if (Object.is(lastTappedKey.value, key) && now - lastTapTimestamp.value <= interval) {
      resetDoubleTap()
      return true
    }
    lastTappedKey.value = key
    lastTapTimestamp.value = now
    return false
  }

  return { isDoubleTap, resetDoubleTap, lastTappedKey, lastTapTimestamp }
}

export default useMobileRowDoubleTap
