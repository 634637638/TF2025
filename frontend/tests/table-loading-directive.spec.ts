import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent, h, withDirectives, type PropType } from 'vue'
import { vTFLoading } from '@/directives'
import type { TFLoadingValue } from '@/directives'
import { useLoadingStore } from '@/stores/loading'

const ListRegion = defineComponent({
  props: { loading: { type: [Boolean, Object] as PropType<TFLoadingValue>, required: true } },
  setup(props) {
    return () => withDirectives(h('div', [h('span', '已有业务数据')]), [[vTFLoading, props.loading]])
  }
})

describe('列表加载指令', () => {
  const wrappers: VueWrapper[] = []

  beforeEach(() => {
    setActivePinia(createPinia())
  })

  afterEach(() => {
    wrappers.splice(0).forEach(wrapper => wrapper.unmount())
  })

  function mountRegion(loading: TFLoadingValue) {
    const wrapper = mount(ListRegion, { props: { loading } })
    wrappers.push(wrapper)
    return wrapper
  }

  it('初始正在请求时交给全局层，后续刷新显示区域反馈并保留数据', async () => {
    const wrapper = mountRegion(true)
    const store = useLoadingStore()
    store.startLoading('首次读取', 'initial')
    expect(wrapper.find('.tf2025-loading-spinner').exists()).toBe(false)
    expect(store.isGlobalVisible).toBe(true)

    await wrapper.setProps({ loading: false })
    store.stopLoading('initial')
    await wrapper.setProps({ loading: true })
    expect(wrapper.text()).toContain('已有业务数据')
    expect(wrapper.text()).toContain('正在读取列表...')
    expect(wrapper.attributes('aria-busy')).toBe('true')
    expect(store.hasLocalLoading).toBe(true)
  })

  it('初始已就绪的列表第一次刷新即显示反馈', async () => {
    const wrapper = mountRegion(false)
    await wrapper.setProps({ loading: true })

    expect(wrapper.findAll('.tf2025-loading-spinner')).toHaveLength(1)
    expect(useLoadingStore().hasLocalLoading).toBe(true)

    await wrapper.setProps({ loading: false })
    expect(wrapper.find('.tf2025-loading-spinner').exists()).toBe(false)
    expect(wrapper.attributes('aria-busy')).toBeUndefined()
    expect(useLoadingStore().hasLocalLoading).toBe(false)
  })

  it('刷新期间抑制全局层，结束后不重现旧请求的全屏提示', async () => {
    const wrapper = mountRegion(false)
    const store = useLoadingStore()
    store.startLoading('请求', 'request')
    await wrapper.setProps({ loading: true })
    expect(store.isGlobalVisible).toBe(false)
    await wrapper.setProps({ loading: false })
    expect(store.isGlobalVisible).toBe(false)
    store.stopLoading('request')
  })

  it('多个区域独立释放，卸载时清理遮罩和局部登记', async () => {
    const first = mountRegion(false)
    const second = mountRegion(false)
    await first.setProps({ loading: true })
    await second.setProps({ loading: true })
    await first.setProps({ loading: false })
    expect(useLoadingStore().hasLocalLoading).toBe(true)
    second.unmount()
    wrappers.pop()
    expect(second.element.querySelector('.tf2025-loading-spinner')).toBeNull()
    expect(useLoadingStore().hasLocalLoading).toBe(false)
  })

  it('业务对象按 active 控制显示，运行中切换文案且始终作为纯文本呈现', async () => {
    const wrapper = mountRegion({ active: false, text: '正在读取备份列表...' })
    expect(wrapper.find('.tf2025-loading-spinner').exists()).toBe(false)
    await wrapper.setProps({ loading: { active: true, text: '正在刷新备份列表...' } })
    expect(wrapper.text()).toContain('正在刷新备份列表...')
    await wrapper.setProps({ loading: { active: true, text: '<img src=x onerror=alert(1)>' } })
    expect(wrapper.find('.tf2025-loading-spinner').text()).toBe('<img src=x onerror=alert(1)>')
    expect(wrapper.find('img').exists()).toBe(false)
    expect(wrapper.findAll('.tf2025-loading-spinner')).toHaveLength(1)
    await wrapper.setProps({ loading: { active: false, text: '已完成' } })
    expect(useLoadingStore().hasLocalLoading).toBe(false)
  })
})
