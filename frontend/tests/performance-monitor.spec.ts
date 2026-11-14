import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PerformanceReport } from '@/types/performance'

const callbacks = vi.hoisted(() => new Map<string, (metric: { value: number }) => void>())
vi.mock('web-vitals', () => Object.fromEntries(['FCP', 'LCP', 'INP', 'CLS', 'TTFB'].map(name => [
  `on${name}`, vi.fn((callback: (metric: { value: number }) => void) => callbacks.set(name, callback))
])))
vi.mock('@/services/storage', () => ({ storage: { getToken: () => null } }))
import { PerformanceMonitor } from '@/utils/performanceMonitor'
import { onINP } from 'web-vitals'

const disconnect = vi.fn()
const observe = vi.fn((_options: { type: string; buffered: boolean }) => {})
beforeEach(() => {
  callbacks.clear()
  vi.useFakeTimers()
  vi.stubGlobal('performance', { getEntriesByType: () => [] })
  vi.stubGlobal('PerformanceObserver', class {
    static supportedEntryTypes = ['navigation', 'resource', 'longtask']
    observe = observe
    disconnect = disconnect
  })
})
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

describe('公共性能监控生命周期', () => {
  it('INP 替代 FID，注册幂等、停止后不采集，重启不重复注册', () => {
    const monitor = new PerformanceMonitor({ autoReport: false })
    monitor.startMonitoring()
    const initialCalls = vi.mocked(onINP).mock.calls.length
    monitor.startMonitoring()
    expect(vi.mocked(onINP)).toHaveBeenCalledTimes(initialCalls)
    expect(observe.mock.calls.slice(-3).map(call => call[0].buffered)).toEqual([true, true, true])
    callbacks.get('INP')!({ value: 321 })
    expect(monitor.getMetrics().inp).toBe(321)
    expect(monitor.getMetrics()).not.toHaveProperty('fid')
    monitor.stopMonitoring()
    callbacks.get('INP')!({ value: 999 })
    expect(monitor.getMetrics().inp).toBe(321)
    expect(disconnect).toHaveBeenCalledTimes(3)
    monitor.startMonitoring()
    expect(vi.mocked(onINP)).toHaveBeenCalledTimes(initialCalls)
    expect(observe.mock.calls.slice(-3).map(call => call[0].buffered)).toEqual([false, false, false])
    monitor.stopMonitoring()
  })

  it('仅保留20份独立历史，API聚合没有URL和身份，不记录任意名称', () => {
    const monitor = new PerformanceMonitor({ autoReport: false, enableWebVitals: false })
    monitor.startMonitoring()
    monitor.recordApiLatency(12)
    monitor.recordApiLatency(20)
    monitor.recordApiLatency(NaN)
    monitor.recordMetric('url', 10)
    for (let i = 0; i < 30; i++) monitor.generateReport()
    expect(monitor.getReports()).toHaveLength(20)
    expect(monitor.getMetrics()).toMatchObject({ apiCount: 2, apiTotal: 32, apiMax: 20 })
    expect(monitor.getMetrics()).not.toHaveProperty('url')
    const history = monitor.getReports()
    history[0].inp = 10000
    expect(monitor.getReports()[0].inp).toBe(0)
    expect(Object.values(monitor.getMetrics()).every(value => typeof value === 'number')).toBe(true)
    monitor.stopMonitoring()
  })

  it('停止清理定时器；禁用时不启动，低能力浏览器安全降级', () => {
    const disabled = new PerformanceMonitor({ enabled: false })
    disabled.startMonitoring()
    expect(vi.getTimerCount()).toBe(0)
    vi.stubGlobal('PerformanceObserver', undefined)
    const monitor = new PerformanceMonitor({ enableWebVitals: false })
    monitor.startMonitoring()
    expect(vi.getTimerCount()).toBe(1)
    monitor.stopMonitoring()
    expect(vi.getTimerCount()).toBe(0)
    monitor.recordApiLatency(10)
    const report: PerformanceReport = monitor.generateReport()
    expect(report.apiCount).toBe(0)
  })
})
