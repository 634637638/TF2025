import { createApp } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ErrorBoundary, ErrorBoundaryPlugin, ErrorLevel, ErrorType } from '@/utils/error-boundary'

vi.mock('@/utils/logger', () => ({ default: { error: vi.fn() } }))

const observeListeners = () => vi.spyOn(window, 'addEventListener')
let registrations: ReturnType<typeof observeListeners>

beforeEach(() => {
  registrations = observeListeners()
  vi.useFakeTimers()
  vi.stubGlobal('fetch', vi.fn())
})

afterEach(() => {
  for (const [type, listener, options] of registrations.mock.calls) {
    window.removeEventListener(type, listener, options)
  }
  registrations.mockClear()
  vi.clearAllTimers()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('错误边界只转交公共错误上报', () => {
  it.each<[string, ErrorType, ErrorLevel]>([
    ['Permission denied', ErrorType.JAVASCRIPT, ErrorLevel.MEDIUM],
    ['Unauthorized', ErrorType.JAVASCRIPT, ErrorLevel.MEDIUM],
    ['Token expired', ErrorType.JAVASCRIPT, ErrorLevel.MEDIUM],
    ['权限不足', ErrorType.PERMISSION, ErrorLevel.MEDIUM],
    ['Network error', ErrorType.NETWORK, ErrorLevel.HIGH],
    ['Network error', ErrorType.JAVASCRIPT, ErrorLevel.HIGH],
    ['Loading chunk failed', ErrorType.JAVASCRIPT, ErrorLevel.CRITICAL]
  ])('%s 按实际类型分级，普通权限和单次网络问题不升级为 critical', (message, type, level) => {
    const boundary = new ErrorBoundary({ autoRetry: false, enableConsoleLog: false })
    boundary.handleError({ type, message })
    expect(boundary.getErrors()[0].level).toBe(level)
  })

  it('旧上报配置不能启动第二条网络链路，错误仍被保存并转交一次', async () => {
    const onError = vi.fn()
    const legacyOptions = {
      autoRetry: false, enableConsoleLog: false, onError,
      enableReporting: true, reportingEndpoint: 'https://example.invalid/report', reportInterval: 1000
    }
    const boundary = new ErrorBoundary(legacyOptions)
    const id = boundary.handleError({ type: ErrorType.BUSINESS, level: ErrorLevel.HIGH, message: '模拟业务故障' })

    await vi.advanceTimersByTimeAsync(60_000)

    expect(onError).toHaveBeenCalledTimes(1)
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ id, message: '模拟业务故障' }))
    expect(boundary.getUnresolvedErrors()).toHaveLength(1)
    expect(fetch).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)

    boundary.resolveError(id)
    expect(boundary.getUnresolvedErrors()).toHaveLength(0)
    boundary.reset()
    expect(boundary.getErrors()).toHaveLength(0)
  })

  it('Vue 错误保留上下文，复用同一个注入实例并只调用公共回调', () => {
    const onError = vi.fn()
    const app = createApp({ render: () => null })
    app.use(ErrorBoundaryPlugin, { autoRetry: false, enableConsoleLog: false, onError })

    app.config.errorHandler?.(new Error('模拟渲染故障'), null, 'render function')

    const boundary = app.config.globalProperties.$errorBoundary
    expect(boundary.getErrors()).toHaveLength(1)
    expect(onError).toHaveBeenCalledTimes(1)
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({
      type: ErrorType.VUE, message: '模拟渲染故障',
      context: expect.objectContaining({ component: 'Unknown', info: 'render function' })
    }))
    expect(fetch).not.toHaveBeenCalled()
  })
})
