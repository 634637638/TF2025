import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import LoadingOverlay from '@/components/LoadingOverlay.vue'
import { useLoadingStore } from '@/stores/loading'

describe('LoadingOverlay', () => {
  let wrapper: VueWrapper | undefined

  beforeEach(() => {
    setActivePinia(createPinia())
  })

  afterEach(() => {
    wrapper?.unmount()
    wrapper = undefined
  })

  it('加载时显示公共区块提示并登记局部 Loading', () => {
    wrapper = mount(LoadingOverlay, {
      props: { loading: true, text: '加载配置中...' },
      slots: { default: '<div>已有表单内容</div>' }
    })

    expect(wrapper.text()).toContain('已有表单内容')
    expect(wrapper.text()).toContain('加载配置中...')
    expect(useLoadingStore().hasLocalLoading).toBe(true)
  })

  it('结束或卸载时释放局部 Loading', async () => {
    wrapper = mount(LoadingOverlay, { props: { loading: true } })
    const loadingStore = useLoadingStore()

    await wrapper.setProps({ loading: false })
    await nextTick()
    expect(loadingStore.hasLocalLoading).toBe(false)

    await wrapper.setProps({ loading: true })
    expect(loadingStore.hasLocalLoading).toBe(true)
    wrapper.unmount()
    wrapper = undefined
    expect(loadingStore.hasLocalLoading).toBe(false)
  })
})
