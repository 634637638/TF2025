import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import GlobalLoading from '@/components/GlobalLoading.vue'
import { GLOBAL_LOADING_SHOW_DELAY_MS } from '@/constants/loading'
import { useLoadingStore } from '@/stores/loading'

describe('全屏加载提示', () => {
  let wrapper: VueWrapper | undefined

  beforeEach(() => {
    vi.useFakeTimers()
    setActivePinia(createPinia())
    wrapper = mount(GlobalLoading, { global: { stubs: { teleport: true } } })
  })

  afterEach(() => {
    wrapper?.unmount()
    wrapper = undefined
    vi.useRealTimers()
  })

  it('慢请求到达公共延迟才显示，短请求结束后不再出现', async () => {
    const store = useLoadingStore()
    store.startLoading('首次读取', 'short')
    await nextTick()
    await vi.advanceTimersByTimeAsync(GLOBAL_LOADING_SHOW_DELAY_MS - 1)
    expect(wrapper?.find('.global-loading').exists()).toBe(false)
    store.stopLoading('short')
    await nextTick()
    await vi.advanceTimersByTimeAsync(GLOBAL_LOADING_SHOW_DELAY_MS)
    expect(wrapper?.find('.global-loading').exists()).toBe(false)

    store.startLoading('慢请求', 'slow')
    await nextTick()
    await vi.advanceTimersByTimeAsync(GLOBAL_LOADING_SHOW_DELAY_MS)
    expect(wrapper?.find('.global-loading').text()).toContain('慢请求')
    store.stopLoading('slow')
    await nextTick()
    expect(wrapper?.find('.global-loading').exists()).toBe(false)
  })

  it('局部反馈取消全屏等待，结束后不恢复旧遮罩', async () => {
    const store = useLoadingStore()
    store.startLoading('列表请求', 'list')
    await nextTick()
    await vi.advanceTimersByTimeAsync(GLOBAL_LOADING_SHOW_DELAY_MS - 1)
    store.startLocalLoading()
    await nextTick()
    await vi.advanceTimersByTimeAsync(GLOBAL_LOADING_SHOW_DELAY_MS)
    expect(wrapper?.find('.global-loading').exists()).toBe(false)
    store.stopLocalLoading()
    await nextTick()
    await vi.advanceTimersByTimeAsync(GLOBAL_LOADING_SHOW_DELAY_MS)
    expect(wrapper?.find('.global-loading').exists()).toBe(false)
  })

  it('卸载释放延迟任务', async () => {
    useLoadingStore().startLoading('等待请求', 'request')
    await nextTick()
    expect(vi.getTimerCount()).toBeGreaterThan(0)
    wrapper?.unmount()
    wrapper = undefined
    expect(vi.getTimerCount()).toBe(0)
  })

  it('可见文案与无障碍提示都跟随当前业务任务', async () => {
    const store = useLoadingStore()
    store.startLoading('正在创建数据库备份...', 'backup')
    store.startLoading('正在读取员工资料...', 'read', -2)
    await nextTick()
    await vi.advanceTimersByTimeAsync(GLOBAL_LOADING_SHOW_DELAY_MS)
    const loading = wrapper?.find('.global-loading')
    expect(loading?.attributes('aria-label')).toBe('正在创建数据库备份...')
    expect(loading?.text()).toContain('正在创建数据库备份...')
    store.stopLoading('backup')
    await nextTick()
    expect(loading?.attributes('aria-label')).toBe('正在读取员工资料...')
  })
})
