import { afterEach, describe, expect, it, vi } from 'vitest'
import type { PerformanceReport } from '@/types/performance'
import { storage } from '@/services/storage'
import { unifiedApi } from '@/utils/unified-api'
import { emptyPerformanceReport, PerformanceReporter } from '@/utils/performance-reporting'

vi.mock('@/services/storage', () => ({ storage: { getToken: vi.fn(() => null) } }))
vi.mock('@/utils/unified-api', () => ({ unifiedApi: { post: vi.fn(async () => ({ success: true })) } }))
afterEach(() => vi.unstubAllEnvs())

const create = (options: ConstructorParameters<typeof PerformanceReporter>[0] = {}) => {
  const transport = vi.fn(async (_report: PerformanceReport) => {})
  const random = vi.fn(() => 0.05)
  const reporter = new PerformanceReporter({ production: true, enabled: true, sampleRate: 0.1, random,
    isAuthenticated: () => true, transport, ...options })
  return { reporter, transport, random }
}

describe('性能数值上报', () => {
  it('默认传输复用统一API，关闭Loading、错误提示及错误递归上报', async () => {
    vi.mocked(storage.getToken).mockReturnValue('synthetic-inert-token')
    try {
      const reporter = new PerformanceReporter({ production: true, enabled: true, random: () => 0 })
      expect(await reporter.report(emptyPerformanceReport())).toBe(true)
      expect(unifiedApi.post).toHaveBeenCalledWith('/performance/report', emptyPerformanceReport(), {
        showLoading: false, showError: false, reportError: false, timeout: 5000
      })
    } finally { vi.mocked(storage.getToken).mockReturnValue(null) }
  })
  it.each([{ production: false }, { enabled: false }, { isAuthenticated: () => false }, { sampleRate: 0 }])('未满足生产、开关、认证或采样时不联网 %o', async options => {
    const { reporter, transport } = create(options)
    expect(await reporter.report(emptyPerformanceReport())).toBe(false)
    expect(transport).not.toHaveBeenCalled()
  })

  it('固定采样且一分钟限频，剔除额外身份和URL字段', async () => {
    let now = 1000
    const { reporter, transport, random } = create({ now: () => now })
    const input = { ...emptyPerformanceReport(), inp: 100, apiCount: 2, url: '/private', userId: 20 }
    expect(await reporter.report(input)).toBe(true)
    expect(await reporter.report(input)).toBe(false)
    now += 60000
    expect(await reporter.report(input)).toBe(true)
    expect(transport).toHaveBeenCalledTimes(2)
    expect(random).toHaveBeenCalledTimes(1)
    expect(transport.mock.calls[0][0]).toEqual({ ...emptyPerformanceReport(), inp: 100, apiCount: 2 })
  })

  it('只允许一个在途请求，失败不抛出且不重试循环', async () => {
    let finish: (() => void) | undefined
    const transport = vi.fn(() => new Promise<void>((_resolve, reject) => { finish = () => reject(new Error('offline')) }))
    let now = 0
    const { reporter } = create({ transport, now: () => now })
    const pending = reporter.report(emptyPerformanceReport())
    now = 60000
    expect(await reporter.report(emptyPerformanceReport())).toBe(false)
    finish!()
    expect(await pending).toBe(false)
    expect(transport).toHaveBeenCalledTimes(1)
  })

  it('拒绝非有限数，按唯一契约限制计数和大小', async () => {
    const { reporter, transport } = create()
    expect(await reporter.report({ ...emptyPerformanceReport(), fcp: NaN })).toBe(false)
    expect(await reporter.report({ ...emptyPerformanceReport(), apiCount: 1.9, inp: 1e10 })).toBe(true)
    expect(transport.mock.calls[0][0]).toMatchObject({ apiCount: 1, inp: 86400000 })
  })
})
