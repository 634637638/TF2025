import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ErrorLevel, ErrorLogger, ErrorType } from '@/utils/error-logger'
import { unifiedApi } from '@/utils/unified-api'
import { logger } from '@/utils/logger'

vi.mock('@/utils/unified-api', () => ({ unifiedApi: { post: vi.fn() } }))
vi.mock('@/utils/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn() } }))

let instance: ErrorLogger | undefined
const observeDocumentListeners = () => vi.spyOn(document, 'addEventListener')
const observeWindowListeners = () => vi.spyOn(window, 'addEventListener')
let documentListeners: ReturnType<typeof observeDocumentListeners>
let windowListeners: ReturnType<typeof observeWindowListeners>

beforeEach(() => {
  vi.useFakeTimers()
  documentListeners = observeDocumentListeners()
  windowListeners = observeWindowListeners()
  vi.mocked(unifiedApi.post).mockResolvedValue({ success: true })
})

afterEach(() => {
  instance?.clear()
  instance?.destroy()
  instance = undefined
  for (const [type, listener, options] of documentListeners.mock.calls) {
    document.removeEventListener(type, listener, options)
  }
  for (const [type, listener, options] of windowListeners.mock.calls) {
    window.removeEventListener(type, listener, options)
  }
  vi.clearAllTimers()
  vi.useRealTimers()
  vi.unstubAllEnvs()
})

describe('错误上报的环境与业务边界', () => {
  it.each([false, true])('开发环境配置 enabled=%s 仍仅保留本地诊断，所有触发方式均不发送', async enabled => {
    vi.stubEnv('PROD', false)
    vi.stubEnv('DEV', true)
    instance = new ErrorLogger({ enabled })
    instance.logError({ level: ErrorLevel.CRITICAL, type: ErrorType.VUE, message: '模拟页面故障' })

    expect(instance.getLogs()).toHaveLength(1)
    expect(logger.error).toHaveBeenCalledExactlyOnceWith('[vue] 模拟页面故障')
    expect(vi.getTimerCount()).toBe(0)
    await instance.flushReports()
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(true)
    document.dispatchEvent(new Event('visibilitychange'))
    window.dispatchEvent(new Event('beforeunload'))
    await vi.advanceTimersByTimeAsync(60_000)
    instance.destroy()

    expect(unifiedApi.post).not.toHaveBeenCalled()
    expect(instance.getLogs()[0].reported).toBe(false)
  })

  it.each([ErrorType.JAVASCRIPT, ErrorType.VUE, ErrorType.ASYNC, ErrorType.NETWORK])('生产环境批量上报 %s 技术故障，保持静默策略', async type => {
    vi.stubEnv('PROD', true)
    vi.stubEnv('DEV', false)
    instance = new ErrorLogger()
    instance.logError({ level: ErrorLevel.HIGH, type, message: '模拟技术故障' })
    expect(unifiedApi.post).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(30_000)

    expect(unifiedApi.post).toHaveBeenCalledExactlyOnceWith('/logs/errors', expect.objectContaining({
      errors: [expect.objectContaining({ type, message: '模拟技术故障' })]
    }), { showLoading: false, showError: false, reportError: false, cacheInvalidationScope: false })
    expect(instance.getLogs()[0].reported).toBe(true)
    expect(logger.error).not.toHaveBeenCalled()
  })

  it('生产严重技术故障立即上报，成功后不被定时器重复发送', async () => {
    vi.stubEnv('PROD', true)
    vi.stubEnv('DEV', false)
    instance = new ErrorLogger()
    instance.logError({ level: ErrorLevel.CRITICAL, type: ErrorType.VUE, message: '模拟严重渲染故障' })
    await vi.advanceTimersByTimeAsync(30_000)
    expect(unifiedApi.post).toHaveBeenCalledTimes(1)
    expect(instance.getLogs()[0].reported).toBe(true)
  })

  it('已上报错误再次发生时重新进入批量队列，并保留递增次数', async () => {
    vi.stubEnv('PROD', true)
    instance = new ErrorLogger({ autoReport: false })
    const error = { level: ErrorLevel.HIGH, type: ErrorType.VUE, message: '模拟重复技术故障' }
    instance.logError(error)
    await instance.flushReports()
    expect(instance.getLogs()[0].reported).toBe(true)
    instance.logError(error)
    expect(instance.getLogs()[0]).toMatchObject({ count: 2, reported: false })
    await instance.flushReports()
    expect(unifiedApi.post).toHaveBeenCalledTimes(2)
    expect(vi.mocked(unifiedApi.post).mock.calls[1][1]).toMatchObject({ errors: [{ count: 2 }] })
    expect(instance.getLogs()[0].reported).toBe(true)
  })

  it('发送过程中再次发生的错误不会被旧响应误标为已上报', async () => {
    vi.stubEnv('PROD', true)
    let release: (() => void) | undefined
    const pending = new Promise<void>(resolve => { release = resolve })
    vi.mocked(unifiedApi.post).mockImplementationOnce(async () => {
      await pending
      return { success: true }
    })
    instance = new ErrorLogger({ autoReport: false })
    const error = { level: ErrorLevel.HIGH, type: ErrorType.VUE, message: '模拟发送期间重复故障' }
    instance.logError(error)
    const report = instance.flushReports()
    instance.logError(error)
    release?.()
    await report
    expect(instance.getLogs()[0]).toMatchObject({ count: 2, reported: false })
    await instance.flushReports()
    expect(instance.getLogs()[0].reported).toBe(true)
    expect(unifiedApi.post).toHaveBeenCalledTimes(2)
  })

  it('批量队列已满时严重故障仍立即发送，使用同一 errors 契约并保留普通队列', async () => {
    vi.stubEnv('PROD', true)
    vi.stubEnv('DEV', false)
    instance = new ErrorLogger({ batchSize: 1 })
    instance.logError({ level: ErrorLevel.HIGH, type: ErrorType.NETWORK, message: '模拟等待批量故障' })
    instance.logError({ level: ErrorLevel.CRITICAL, type: ErrorType.VUE, message: '模拟优先严重故障' })
    await vi.advanceTimersByTimeAsync(0)
    expect(unifiedApi.post).toHaveBeenCalledExactlyOnceWith('/logs/errors', expect.objectContaining({
      errors: [expect.objectContaining({ message: '模拟优先严重故障', count: 1 })]
    }), expect.anything())

    await instance.flushReports()
    expect(unifiedApi.post).toHaveBeenCalledTimes(2)
    expect(vi.mocked(unifiedApi.post).mock.calls[1][1]).toMatchObject({
      errors: [{ message: '模拟等待批量故障' }]
    })
    expect(instance.getLogs().every(log => log.reported)).toBe(true)
  })

  it.each([ErrorType.PERMISSION, ErrorType.VALIDATION, ErrorType.BUSINESS])('生产 %s 普通提示即使误标 critical 或扩大配置也不外发', async type => {
    vi.stubEnv('PROD', true)
    vi.stubEnv('DEV', false)
    instance = new ErrorLogger({ typesToReport: Object.values(ErrorType), levelsToReport: Object.values(ErrorLevel) })
    instance.logError({ level: ErrorLevel.CRITICAL, type, message: '模拟普通业务拒绝' })
    await instance.flushReports()
    await vi.advanceTimersByTimeAsync(60_000)
    expect(instance.getLogs()).toHaveLength(1)
    expect(unifiedApi.post).not.toHaveBeenCalled()
  })

  it('技术故障和普通提示同时存在时，上报正文不会夹带普通提示的统计或上下文', async () => {
    vi.stubEnv('PROD', true)
    instance = new ErrorLogger()
    instance.logError({
      level: ErrorLevel.CRITICAL, type: ErrorType.PERMISSION,
      message: '模拟普通权限提示', context: { detail: '仅本地业务说明' }
    })
    instance.logError({ level: ErrorLevel.HIGH, type: ErrorType.VUE, message: '模拟技术故障' })
    await instance.flushReports()

    expect(unifiedApi.post).toHaveBeenCalledTimes(1)
    const payload = vi.mocked(unifiedApi.post).mock.calls[0][1]
    expect(payload).toMatchObject({ errors: [{ message: '模拟技术故障' }] })
    expect(JSON.stringify(payload)).not.toContain('模拟普通权限提示')
    expect(JSON.stringify(payload)).not.toContain('仅本地业务说明')
    expect(payload).not.toHaveProperty('statistics')
    expect(instance.getLogs()).toHaveLength(2)
  })

  it.each([400, 401, 403, 404, 409, 422, 429])('HTTP %s 误标技术故障时仍不外发', async status => {
    vi.stubEnv('PROD', true)
    instance = new ErrorLogger()
    instance.logError({
      level: ErrorLevel.CRITICAL, type: ErrorType.JAVASCRIPT, message: '模拟接口拒绝',
      tags: ['api'], context: { status }
    })
    await instance.flushReports()
    expect(unifiedApi.post).not.toHaveBeenCalled()
  })

  it('生产环境显式关闭时不发送，但仍保留本地记录', async () => {
    vi.stubEnv('PROD', true)
    instance = new ErrorLogger({ enabled: false })
    instance.logError({ level: ErrorLevel.CRITICAL, type: ErrorType.JAVASCRIPT, message: '模拟技术故障' })
    await instance.flushReports()
    expect(vi.getTimerCount()).toBe(0)
    expect(instance.getLogs()).toHaveLength(1)
    expect(unifiedApi.post).not.toHaveBeenCalled()
  })
})
