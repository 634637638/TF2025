import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import TableLoadingRow from '@/components/TableLoadingRow.vue'
import { useLoadingStore } from '@/stores/loading'

describe('TableLoadingRow', () => {
  let wrapper: VueWrapper | undefined

  beforeEach(() => {
    setActivePinia(createPinia())
  })

  afterEach(() => {
    wrapper?.unmount()
    wrapper = undefined
  })

  it('首载占位登记局部 Loading，抑制同一请求的全屏层', () => {
    wrapper = mount(TableLoadingRow, {
      props: { mode: 'block', text: '正在加载批发价格数据中...' }
    })
    const loadingStore = useLoadingStore()

    expect(wrapper.text()).toContain('正在加载批发价格数据中...')
    expect(loadingStore.hasLocalLoading).toBe(true)

    loadingStore.startLoading('获取列表', 'price-list')
    expect(loadingStore.isGlobalVisible).toBe(false)
  })

  it('占位移除时释放局部 Loading', () => {
    wrapper = mount(TableLoadingRow, { props: { mode: 'block' } })
    const loadingStore = useLoadingStore()

    expect(loadingStore.hasLocalLoading).toBe(true)
    wrapper.unmount()
    wrapper = undefined
    expect(loadingStore.hasLocalLoading).toBe(false)
  })
})
