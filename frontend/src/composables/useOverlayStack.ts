import { computed, onScopeDispose, shallowReactive, watch, type Ref } from 'vue'

// MobileDialog 与媒体查看器共享锁；关闭任意一个覆盖层不能解锁仍打开的页面。
const overlays = shallowReactive<{ id: symbol; priority: number }[]>([])
let previousOverflow = ''

export function useOverlayStack(visible: Ref<boolean>, priority: Ref<number>) {
  const id = Symbol('overlay')
  const release = () => {
    const index = overlays.findIndex(item => item.id === id)
    if (index < 0) return
    overlays.splice(index, 1)
    if (!overlays.length) document.body.style.overflow = previousOverflow
  }

  watch(visible, open => {
    if (!open) return release()
    if (!overlays.length) previousOverflow = document.body.style.overflow
    overlays.push({ id, priority: priority.value })
    document.body.style.overflow = 'hidden'
  }, { immediate: true })
  onScopeDispose(release)

  const order = computed(() => overlays.findIndex(item => item.id === id))
  const isTop = computed(() => {
    const top = overlays.reduce<(typeof overlays)[number] | undefined>((current, item) =>
      !current || item.priority >= current.priority ? item : current, undefined)
    return top?.id === id
  })
  return { isTop, order }
}
