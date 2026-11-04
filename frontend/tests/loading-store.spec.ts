import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useLoadingStore } from '@/stores/loading'

describe('全局 Loading Store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('并发任务全部结束后才关闭全局 Loading', () => {
    const store = useLoadingStore()

    store.startLoading('任务 A', 'task-a')
    store.startLoading('任务 B', 'task-b')
    expect(store.isLoading).toBe(true)
    expect(store.activeOperationCount).toBe(2)

    store.stopLoading('task-a')
    expect(store.isLoading).toBe(true)
    expect(store.isOperationLoading('task-b')).toBe(true)

    store.stopLoading('task-b')
    expect(store.isLoading).toBe(false)
    expect(store.loadingProgress).toBe(100)
  })

  it('局部 Loading 激活时不会重复展示全局 Loading', () => {
    const store = useLoadingStore()

    store.startLocalLoading()
    store.startLoading('后台刷新', 'refresh')

    expect(store.hasLocalLoading).toBe(true)
    expect(store.isGlobalVisible).toBe(false)
    expect(store.isOperationLoading('refresh')).toBe(true)

    store.clearAllLoading()
    expect(store.hasLocalLoading).toBe(false)
    expect(store.activeOperationCount).toBe(0)
  })
})
