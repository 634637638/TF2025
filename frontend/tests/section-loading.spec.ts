import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import SectionLoading from '@/components/SectionLoading.vue'
import { useLoadingStore } from '@/stores/loading'

describe('区块加载占位', () => {
  const wrappers: VueWrapper[] = []

  beforeEach(() => {
    setActivePinia(createPinia())
  })

  afterEach(() => {
    wrappers.splice(0).forEach(wrapper => wrapper.unmount())
  })

  it('直接使用区块占位也会抑制全局慢请求，移除后释放登记', () => {
    const store = useLoadingStore()
    store.startLoading('首载', 'request')
    const wrapper = mount(SectionLoading, { props: { text: '读取区块数据...' } })
    wrappers.push(wrapper)

    expect(wrapper.text()).toContain('读取区块数据...')
    expect(store.hasLocalLoading).toBe(true)
    expect(store.isGlobalVisible).toBe(false)
    wrapper.unmount()
    wrappers.pop()
    expect(store.hasLocalLoading).toBe(false)
    expect(store.isGlobalVisible).toBe(false)
    store.stopLoading('request')
  })

  it('多个区块各自释放，全部卸载后后续独立请求可使用全局反馈', () => {
    const first = mount(SectionLoading)
    const second = mount(SectionLoading)
    wrappers.push(first, second)
    second.unmount()
    wrappers.pop()
    expect(useLoadingStore().hasLocalLoading).toBe(true)
    first.unmount()
    wrappers.pop()

    const store = useLoadingStore()
    expect(store.hasLocalLoading).toBe(false)
    store.startLoading('新请求', 'next')
    expect(store.isGlobalVisible).toBe(true)
  })
})
