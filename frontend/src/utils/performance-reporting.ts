import { storage } from '@/services/storage'
import schema from '../../../backend/src/contracts/performance-report.schema.json'
import type { PerformanceReport } from '@/types/performance'

export const emptyPerformanceReport = (): PerformanceReport => ({
  fcp: 0, lcp: 0, inp: 0, cls: 0, ttfb: 0, domReady: 0, loadComplete: 0, tti: 0,
  resourceCount: 0, resourceSize: 0, apiCount: 0, apiTotal: 0, apiMax: 0, longTaskCount: 0, pageViews: 0
})

const defaults = {
  production: import.meta.env.PROD,
  enabled: import.meta.env.VITE_PERFORMANCE_REPORT_ENABLED !== 'false',
  sampleRate: 0.1,
  now: Date.now,
  random: Math.random,
  isAuthenticated: () => Boolean(storage.getToken()),
  transport: async (report: PerformanceReport): Promise<void> => {
    const { unifiedApi } = await import('@/utils/unified-api')
    await unifiedApi.post('/performance/report', report, {
      showLoading: false, showError: false, reportError: false, timeout: 5000
    })
  }
}

/** 会话固定采样、分钟限频、单请求在途；失败静默且不递归上报。 */
export class PerformanceReporter {
  private options: typeof defaults
  private sampled: boolean
  private lastSent = -Infinity
  private pending = false
  constructor(options: Partial<typeof defaults> = {}) {
    this.options = { ...defaults, ...options }
    this.sampled = this.options.random() < Math.max(0, Math.min(1, this.options.sampleRate))
  }

  async report(metrics: PerformanceReport): Promise<boolean> {
    if (!this.options.production || !this.options.enabled || !this.sampled || !this.options.isAuthenticated() ||
      this.pending || this.options.now() - this.lastSent < 60000) return false
    const payload = emptyPerformanceReport()
    for (const key of Object.keys(payload) as Array<keyof PerformanceReport>) {
      const rule = schema.properties[key]
      const value = metrics[key]
      if (!Number.isFinite(value)) return false
      const bounded = Math.max(0, Math.min(rule.maximum, value))
      payload[key] = rule.type === 'integer' ? Math.floor(bounded) : bounded
    }
    this.lastSent = this.options.now()
    this.pending = true
    try { await this.options.transport(payload); return true }
    catch { return false }
    finally { this.pending = false }
  }
}
