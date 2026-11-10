import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import axios, { AxiosError, AxiosHeaders } from 'axios'
import type { AxiosAdapter, InternalAxiosRequestConfig } from 'axios'
import { unifiedApi } from '@/utils/unified-api'
import { ErrorLevel, ErrorType, globalErrorLogger } from '@/utils/error-logger'
import { storage } from '@/services/storage'
import { SECURITY_STORAGE_KEYS } from '@/constants/storage'
import { useLoadingStore } from '@/stores/loading'

const feedback = vi.hoisted(() => ({
  error: vi.fn(), warning: vi.fn(), notification: vi.fn(), success: vi.fn()
}))
vi.mock('@/utils/element-feedback', () => ({
  showElementError: feedback.error, showElementWarning: feedback.warning,
  showElementNotification: feedback.notification, showElementSuccess: feedback.success
}))
vi.mock('@/utils/logger', () => ({
  default: { warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  logger: { warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
}))

const instance = unifiedApi.getInstance()
const originalAdapter = instance.defaults.adapter
const fail = (config: InternalAxiosRequestConfig, status: number, data: unknown = '') => {
  throw new AxiosError('模拟请求失败', 'ERR_BAD_RESPONSE', config, undefined, {
    config, status, data, statusText: 'Failure', headers: new AxiosHeaders()
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  globalErrorLogger.clear()
  useLoadingStore().clearAllLoading()
  storage.set(SECURITY_STORAGE_KEYS.CSRF_TOKEN, {
    token: 'synthetic-csrf-token', expiresAt: Date.now() + 3_600_000
  }, 'session')
})
afterEach(() => {
  instance.defaults.adapter = originalAdapter
  globalErrorLogger.clear()
  storage.remove(SECURITY_STORAGE_KEYS.CSRF_TOKEN, 'session')
})
afterAll(() => globalErrorLogger.destroy())

describe('统一请求与错误上报的提示隔离', () => {
  it('首次上报获取 CSRF 失败时仍沿用上报的静默策略，不递归且不跳过 CSRF', async () => {
    storage.remove(SECURITY_STORAGE_KEYS.CSRF_TOKEN, 'session')
    const create = axios.create.bind(axios)
    const requests: string[] = []
    vi.spyOn(axios, 'create').mockImplementationOnce(config => {
      const csrf = create(config)
      csrf.defaults.adapter = async request => {
        requests.push(request.url || '')
        return fail(request, 500)
      }
      return csrf
    })
    const reportAdapter = vi.fn<AxiosAdapter>()
    instance.defaults.adapter = reportAdapter
    globalErrorLogger.logError({ level: ErrorLevel.HIGH, type: ErrorType.JAVASCRIPT, message: '模拟待上报错误' })
    await globalErrorLogger.flushReports()
    expect(requests).toEqual(['/csrf/token'])
    expect(reportAdapter).not.toHaveBeenCalled()
    expect(feedback.error).not.toHaveBeenCalled()
    expect(globalErrorLogger.getLogs()).toHaveLength(1)
    expect(globalErrorLogger.getLogs()[0].reported).toBe(false)
  })

  it.each([403, 404, 409, 422, 429, 500, 502, 503])('showError=false 时 HTTP %s 不弹全局业务消息，仍拒绝原请求', async status => {
    instance.defaults.adapter = async config => fail(config, status)
    await expect(unifiedApi.post('/backup/cloud/folders', {}, {
      showLoading: false, showError: false
    })).rejects.toBeInstanceOf(AxiosError)
    expect(feedback.error).not.toHaveBeenCalled()
    expect(feedback.warning).not.toHaveBeenCalled()
    expect(feedback.notification).not.toHaveBeenCalled()
    expect(globalErrorLogger.getLogs()).toHaveLength(1)
  })

  it.each([403, 404, 429, 500, 502, 503])('普通 HTTP %s 失败只展示一次提示', async status => {
    instance.defaults.adapter = async config => fail(config, status)
    await expect(unifiedApi.post('/backup/cloud/folders', {}, { showLoading: false })).rejects.toBeInstanceOf(AxiosError)
    expect(feedback.error.mock.calls.length + feedback.warning.mock.calls.length).toBe(1)
  })

  it('批量上报遇到空 500 时不新增递归日志、不弹提示、不触发 Loading；原日志保留重试', async () => {
    globalErrorLogger.logError({ level: ErrorLevel.HIGH, type: ErrorType.JAVASCRIPT, message: '模拟原始故障' })
    const calls: InternalAxiosRequestConfig[] = []
    instance.defaults.adapter = async config => { calls.push(config); return fail(config, 500) }
    await globalErrorLogger.flushReports()
    expect(calls).toHaveLength(1)
    expect(calls[0].url).toBe('/logs/errors')
    expect(calls[0].headers.get('X-CSRF-Token')).toBe('synthetic-csrf-token')
    expect(feedback.error).not.toHaveBeenCalled()
    expect(globalErrorLogger.getLogs()).toHaveLength(1)
    expect(globalErrorLogger.getLogs()[0].reported).toBe(false)
    expect(useLoadingStore().activeOperationCount).toBe(0)
    const successAdapter: AxiosAdapter = async config => ({
      config, status: 200, statusText: 'OK', headers: new AxiosHeaders(), data: { success: true, data: { accepted: 1 } }
    })
    instance.defaults.adapter = successAdapter
    await globalErrorLogger.flushReports()
    expect(globalErrorLogger.getLogs()[0].reported).toBe(true)
  })

  it('高优先级立即上报遇到网络中断不会递归上报，业务失败响应不误标记已接收', async () => {
    const requests: string[] = []
    instance.defaults.adapter = async config => {
      requests.push(config.url || '')
      throw new AxiosError('模拟网络中断', 'ERR_NETWORK', config)
    }
    globalErrorLogger.logError({ level: ErrorLevel.CRITICAL, type: ErrorType.NETWORK, message: '模拟断网故障' })
    await flushPromises()
    expect(requests).toEqual(['/logs/errors'])
    expect(feedback.error).not.toHaveBeenCalled()
    expect(globalErrorLogger.getLogs()).toHaveLength(1)
    expect(globalErrorLogger.getLogs()[0].reported).toBe(false)
    instance.defaults.adapter = async config => ({
      config, status: 200, statusText: 'OK', headers: new AxiosHeaders(), data: { success: false }
    })
    await globalErrorLogger.flushReports()
    expect(globalErrorLogger.getLogs()[0].reported).toBe(false)
  })
})
