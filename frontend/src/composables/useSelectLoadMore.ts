import { shallowRef } from 'vue'
import type { ScrollbarEmits, SelectInstance } from 'element-plus'

/** 复用 Select 内置 Scrollbar 的滚动事件，不再注册无限滚动指令。 */
export function useSelectLoadMore(loadMore: () => void | Promise<void>, disabled: () => boolean) {
  const selectRef = shallowRef<SelectInstance | SelectInstance[]>()

  const onPopupScroll = ({ scrollTop }: Parameters<ScrollbarEmits['scroll']>[0]) => {
    // 字段配置通过 v-for 渲染时，Vue 会把唯一的 Select 引用也放进数组。
    const select = Array.isArray(selectRef.value) ? selectRef.value[0] : selectRef.value
    const wrap = select?.scrollbarRef?.wrapRef
    // 关闭/重置候选会回到顶部；未显示或没有纵向滚动时不触发翻页。
    if (disabled() || !wrap || wrap.clientHeight <= 0 || scrollTop <= 0) return
    if (wrap.scrollHeight - wrap.clientHeight - scrollTop <= 1) return loadMore()
  }

  return { selectRef, onPopupScroll }
}
