import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { AxiosError, AxiosHeaders, CanceledError } from 'axios'
import type { AxiosResponse, InternalAxiosRequestConfig } from 'axios'
import { unifiedApi } from '@/utils/unified-api'
import { useLoadingStore } from '@/stores/loading'
import { storage } from '@/services/storage'
import { SECURITY_STORAGE_KEYS } from '@/constants/storage'

vi.mock('@/utils/element-feedback', () => ({
  showElementError: vi.fn(), showElementWarning: vi.fn(),
  showElementNotification: vi.fn(), showElementSuccess: vi.fn()
}))
vi.mock('@/utils/error-logger', () => ({ globalErrorLogger: { logError: vi.fn() } }))

const instance = unifiedApi.getInstance()
const originalAdapter = instance.defaults.adapter
const pending = new Map<string, {
  config: InternalAxiosRequestConfig
  resolve: (response: AxiosResponse) => void
  reject: (error: AxiosError) => void
}>()

function succeed(url: string) {
  const request = pending.get(url)
  if (!request) throw new Error(`未登记模拟请求 ${url}`)
  pending.delete(url)
  request.resolve({
    config: request.config, status: 200, statusText: 'OK',
    headers: new AxiosHeaders(), data: { success: true, data: [] }
  })
}

beforeEach(() => {
  setActivePinia(createPinia())
  pending.clear()
  unifiedApi.clearCache()
  storage.set(SECURITY_STORAGE_KEYS.CSRF_TOKEN, {
    token: 'synthetic-csrf-token', expiresAt: Date.now() + 3_600_000
  }, 'session')
  instance.defaults.adapter = config => new Promise<AxiosResponse>((resolve, reject) => {
    pending.set(config.url || '', { config, resolve, reject })
  })
})

afterEach(() => {
  instance.defaults.adapter = originalAdapter
  storage.remove(SECURITY_STORAGE_KEYS.CSRF_TOKEN, 'session')
  useLoadingStore().clearAllLoading()
})

describe('统一 Axios Loading 生命周期与业务文案', () => {
  it('备份页显式提示不会被自动请求或后续列表读取覆盖', async () => {
    const store = useLoadingStore()
    store.startLoading('正在创建数据库备份，请稍候...', 'backup-ui')
    const backup = unifiedApi.post('/backup/create', { type: 'database' })
    const read = unifiedApi.get('/employees')
    await flushPromises()
    expect(store.activeOperationCount).toBe(3)
    expect(store.loadingText).toBe('正在创建数据库备份，请稍候...')
    succeed('/backup/create')
    await backup
    expect(store.loadingText).toBe('正在创建数据库备份，请稍候...')
    store.stopLoading('backup-ui')
    expect(store.loadingText).toBe('正在读取员工资料...')
    succeed('/employees')
    await read
    expect(store.isLoading).toBe(false)
    expect(store.activeOperationCount).toBe(0)
  })

  it('写操作优于并发读，完成后切回仍在等待的读取文案', async () => {
    const store = useLoadingStore()
    const write = unifiedApi.post('/backup/cleanup', {})
    const read = unifiedApi.get('/backup/list')
    await flushPromises()
    expect(store.loadingText).toBe('正在清理旧备份...')
    succeed('/backup/cleanup')
    await write
    expect(store.loadingText).toBe('正在读取备份记录...')
    succeed('/backup/list')
    await read
    expect(store.loadingText).toBe('')
  })

  it('调用方 loadingText 生效；静默请求结束不清理其他任务', async () => {
    const store = useLoadingStore()
    const active = unifiedApi.post('/backup/create', {}, { loadingText: '正在创建完整备份...' })
    const silent = unifiedApi.get('/employees', { showLoading: false })
    await flushPromises()
    expect(store.activeOperationCount).toBe(1)
    expect(store.loadingText).toBe('正在创建完整备份...')
    succeed('/employees')
    await silent
    expect(store.activeOperationCount).toBe(1)
    succeed('/backup/create')
    await active
    expect(store.activeOperationCount).toBe(0)
  })

  it.each(['failure', 'cancel'] as const)('%s 只释放自己的任务', async kind => {
    const store = useLoadingStore()
    store.startLoading('正在导出文件...', 'export')
    const request = unifiedApi.post('/backup/create', {}, { showError: false })
    const rejected = expect(request).rejects.toBeInstanceOf(AxiosError)
    await flushPromises()
    const entry = pending.get('/backup/create')
    if (!entry) throw new Error('未登记模拟请求')
    entry.reject(kind === 'cancel'
      ? new CanceledError('canceled', entry.config)
      : new AxiosError('模拟备份失败', 'ERR_BAD_RESPONSE', entry.config, undefined, {
        config: entry.config, status: 500, statusText: 'Failure', headers: new AxiosHeaders(), data: { success: false }
      }))
    pending.delete('/backup/create')
    await rejected
    expect(store.activeOperationCount).toBe(1)
    expect(store.loadingText).toBe('正在导出文件...')
    store.stopLoading('export')
    expect(store.isLoading).toBe(false)
  })

  it('请求发送前配置失败不清理另一项业务操作', async () => {
    const store = useLoadingStore()
    store.startLoading('正在创建备份...', 'backup-ui')
    const interceptor = instance.interceptors.request.use(() => { throw new AxiosError('模拟请求配置失败') })
    try {
      await expect(unifiedApi.get('/employees', { showError: false })).rejects.toBeInstanceOf(AxiosError)
      expect(store.activeOperationCount).toBe(1)
      expect(store.loadingText).toBe('正在创建备份...')
      expect(pending.size).toBe(0)
    } finally {
      instance.interceptors.request.eject(interceptor)
    }
  })

  it('瞬时读取失败重试不会泄漏原请求任务或影响其他业务文案', async () => {
    const store = useLoadingStore()
    store.startLoading('正在创建备份...', 'backup-ui')
    const request = unifiedApi.get('/employees')
    await flushPromises()
    const first = pending.get('/employees')
    if (!first) throw new Error('未登记模拟请求')
    pending.delete('/employees')
    first.reject(new AxiosError('模拟暂时不可用', 'ERR_BAD_RESPONSE', first.config, undefined, {
      config: first.config, status: 503, statusText: 'Unavailable', headers: new AxiosHeaders(), data: ''
    }))
    await vi.waitFor(() => expect(pending.has('/employees')).toBe(true))
    expect(store.activeOperationCount).toBe(2)
    expect(store.loadingText).toBe('正在创建备份...')
    succeed('/employees')
    await request
    expect(store.activeOperationCount).toBe(1)
    store.stopLoading('backup-ui')
    expect(store.activeOperationCount).toBe(0)
  })
})
