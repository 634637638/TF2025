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

  it('业务长操作不被自动请求覆盖，结束后切回剩余请求文案', () => {
    const store = useLoadingStore()
    store.startLoading('正在创建数据库备份...', 'backup')
    store.startLoading('正在保存备份记录...', 'write', -1)
    store.startLoading('正在读取员工资料...', 'read', -2)
    expect(store.loadingText).toBe('正在创建数据库备份...')
    store.stopLoading('backup')
    expect(store.loadingText).toBe('正在保存备份记录...')
    store.stopLoading('write')
    expect(store.loadingText).toBe('正在读取员工资料...')
    store.stopLoading('read')
    expect(store.loadingText).toBe('')
  })

  it('按任务更新进度文案，低优先级任务不抢占当前提示且更新不会丢失', () => {
    const store = useLoadingStore()
    store.startLoading('正在导出...', 'export')
    store.startLoading('正在读取列表...', 'read', -2)
    store.setLoadingText('正在读取统计...', 'read')
    expect(store.loadingText).toBe('正在导出...')
    store.setLoadingText('正在打包导出文件...')
    expect(store.loadingText).toBe('正在打包导出文件...')
    store.stopLoading('read')
    expect(store.loadingText).toBe('正在打包导出文件...')
    store.stopLoading('export')
    expect(store.activeOperationCount).toBe(0)
  })

  it('匿名兼容任务结束不会关闭有独立标识的请求', () => {
    const store = useLoadingStore()
    store.setLoading(true, '正在处理...')
    store.startLoading('正在读取列表...', 'read', -2)
    store.setLoading(false)
    expect(store.loadingText).toBe('正在读取列表...')
    expect(store.activeOperationCount).toBe(1)
    store.stopLoading('read')
    expect(store.isLoading).toBe(false)
  })
})
