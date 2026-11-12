import { afterEach, describe, expect, it } from 'vitest'
import { computed, effectScope, ref, type EffectScope } from 'vue'
import { useOverlayStack } from '@/composables/useOverlayStack'

const scopes: EffectScope[] = []
function overlay(priority = 0, initial = true) {
  const visible = ref(initial)
  const scope = effectScope()
  scopes.push(scope)
  const stack = scope.run(() => useOverlayStack(visible, computed(() => priority)))!
  return { ...stack, visible, dispose: () => scope.stop() }
}
afterEach(() => { scopes.splice(0).forEach(scope => scope.stop()); document.body.style.overflow = '' })

describe('公共覆盖层顺序与滚动锁', () => {
  it('先挂载的隐藏弹窗和卸载不改变外部已有滚动状态', () => {
    document.body.style.overflow = 'clip'
    const hidden = overlay(0, false)
    hidden.dispose()
    expect(document.body.style.overflow).toBe('clip')
  })
  it('按打开顺序识别最上层，同级重开后居于最上层', async () => {
    const first = overlay(), second = overlay()
    expect(first.isTop.value).toBe(false)
    expect(second.isTop.value).toBe(true)
    first.visible.value = false
    await Promise.resolve()
    first.visible.value = true
    await Promise.resolve()
    expect(first.isTop.value).toBe(true)
  })
  it('媒体优先于普通弹窗；任意关闭顺序都在最后一层关闭后恢复原值', async () => {
    document.body.style.overflow = 'clip'
    const first = overlay(), viewer = overlay(2), other = overlay()
    expect(viewer.isTop.value).toBe(true)
    expect(document.body.style.overflow).toBe('hidden')
    first.dispose()
    expect(document.body.style.overflow).toBe('hidden')
    viewer.visible.value = false
    await Promise.resolve()
    expect(other.isTop.value).toBe(true)
    expect(document.body.style.overflow).toBe('hidden')
    other.dispose()
    expect(document.body.style.overflow).toBe('clip')
  })
})
