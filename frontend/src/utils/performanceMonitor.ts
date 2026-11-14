/** 公共性能采集：仅固定数值，不收集 URL、用户输入或设备标识。 */
import { reactive, type App } from 'vue'
import { onFCP, onLCP, onINP, onCLS, onTTFB } from 'web-vitals'
import { emptyPerformanceReport, PerformanceReporter } from './performance-reporting'
import type { PerformanceReport } from '@/types/performance'

interface PerformanceConfig {
  enabled: boolean
  sampleRate: number
  enableWebVitals: boolean
  enableResourceTiming: boolean
  enableLongTasks: boolean
  autoReport: boolean
  reportInterval: number
}

export class PerformanceMonitor {
  private config: PerformanceConfig
  private isMonitoring = false
  private vitalsRegistered = false
  private observedBefore = false
  private reports: PerformanceReport[] = []
  private observers: PerformanceObserver[] = []
  private timer?: number
  private reporter: PerformanceReporter
  private metrics = reactive(emptyPerformanceReport())

  constructor(config: Partial<PerformanceConfig> = {}) {
    this.config = { enabled: true, sampleRate: 0.1, enableWebVitals: true, enableResourceTiming: true,
      enableLongTasks: true, autoReport: true, reportInterval: 60000, ...config }
    this.reporter = new PerformanceReporter({ enabled: this.config.autoReport && import.meta.env.VITE_PERFORMANCE_REPORT_ENABLED !== 'false',
      sampleRate: this.config.sampleRate })
  }

  startMonitoring() {
    if (!this.config.enabled || this.isMonitoring || !window.performance) return
    this.isMonitoring = true
    const buffered = !this.observedBefore
    this.observedBefore = true
    this.metrics.pageViews++
    if (this.config.enableWebVitals && !this.vitalsRegistered) {
      this.vitalsRegistered = true
      const record = (key: keyof PerformanceReport) => ({ value }: { value: number }) => {
        if (this.isMonitoring) this.metrics[key] = Math.max(0, value)
      }
      onFCP(record('fcp'))
      onLCP(record('lcp'), { reportAllChanges: true })
      onINP(record('inp'), { reportAllChanges: true })
      onCLS(record('cls'), { reportAllChanges: true })
      onTTFB(record('ttfb'))
    }
    for (const entry of performance.getEntriesByType('navigation')) this.recordNavigation(entry as PerformanceNavigationTiming)
    this.observe('navigation', entries => entries.forEach(entry => this.recordNavigation(entry as PerformanceNavigationTiming)), buffered)
    if (this.config.enableResourceTiming) this.observe('resource', entries => {
      for (const entry of entries) {
        this.metrics.resourceCount++
        this.metrics.resourceSize += (entry as PerformanceResourceTiming).transferSize || 0
      }
    }, buffered)
    if (this.config.enableLongTasks) this.observe('longtask', entries => { this.metrics.longTaskCount += entries.length }, buffered)
    if (this.config.autoReport) this.timer = window.setInterval(() => this.generateReport(), Math.max(60000, this.config.reportInterval))
  }

  private observe(type: string, receive: (entries: PerformanceEntry[]) => void, buffered: boolean) {
    if (typeof PerformanceObserver === 'undefined' || !PerformanceObserver.supportedEntryTypes.includes(type)) return
    const observer = new PerformanceObserver(list => { if (this.isMonitoring) receive(list.getEntries()) })
    observer.observe({ type, buffered })
    this.observers.push(observer)
  }

  private recordNavigation(entry: PerformanceNavigationTiming) {
    this.metrics.domReady = Math.max(0, entry.domContentLoadedEventEnd - entry.fetchStart)
    this.metrics.loadComplete = Math.max(0, entry.loadEventEnd - entry.fetchStart)
    // 沿用历史近似值；它是 DOM 就绪时间，不声称这是标准 TTI 测量。
    this.metrics.tti = this.metrics.domReady
  }

  stopMonitoring() {
    this.isMonitoring = false
    this.observers.forEach(observer => observer.disconnect())
    this.observers = []
    if (this.timer !== undefined) window.clearInterval(this.timer)
    this.timer = undefined
  }

  recordMetric(name: string, value: number, _unit: 'ms' | 'bytes' | 'count' | 'percent' = 'ms') {
    if (!this.isMonitoring || !Number.isFinite(value) || value < 0) return
    if (Object.prototype.hasOwnProperty.call(this.metrics, name)) this.metrics[name as keyof PerformanceReport] = value
  }

  recordApiLatency(duration: number) {
    if (!this.isMonitoring || !Number.isFinite(duration) || duration < 0) return
    this.metrics.apiCount++
    this.metrics.apiTotal += duration
    this.metrics.apiMax = Math.max(this.metrics.apiMax, duration)
  }

  getMetrics(): PerformanceReport { return { ...this.metrics } }
  generateReport(): PerformanceReport {
    const report = this.getMetrics()
    this.reports.push(report)
    if (this.reports.length > 20) this.reports.shift()
    if (this.isMonitoring && this.config.autoReport) void this.reporter.report(report)
    return report
  }
  getReports() { return this.reports.map(report => ({ ...report })) }
  clearReports() { this.reports = [] }
  getPerformanceScore(): number {
    return Math.max(0, 100 - (this.metrics.fcp > 3000 ? 20 : 0) - (this.metrics.lcp > 4000 ? 25 : 0) -
      (this.metrics.inp > 500 ? 15 : 0) - (this.metrics.cls > 0.25 ? 20 : 0))
  }
  getPerformanceRecommendations(): string[] {
    return [this.metrics.fcp > 3000 ? 'FCP过长，建议优化首屏渲染资源' : '',
      this.metrics.lcp > 4000 ? 'LCP过长，建议优化最大内容元素加载' : '',
      this.metrics.inp > 500 ? 'INP过长，建议减少交互处理阻塞' : '',
      this.metrics.cls > 0.25 ? 'CLS过高，建议优化布局稳定性' : '',
      this.metrics.ttfb > 1800 ? 'TTFB过长，建议优化服务器响应时间' : ''].filter(Boolean)
  }
}

export const performanceMonitor = new PerformanceMonitor()
export const PerformancePlugin = {
  install(app: App) {
    app.provide('performanceMonitor', performanceMonitor)
    if (window.__TF2025__) window.__TF2025__.performance = performanceMonitor
  }
}
export function usePerformance() {
  return {
    monitor: performanceMonitor,
    recordMetric: performanceMonitor.recordMetric.bind(performanceMonitor),
    startMonitoring: performanceMonitor.startMonitoring.bind(performanceMonitor),
    stopMonitoring: performanceMonitor.stopMonitoring.bind(performanceMonitor),
    getMetrics: performanceMonitor.getMetrics.bind(performanceMonitor),
    generateReport: performanceMonitor.generateReport.bind(performanceMonitor),
    getReports: performanceMonitor.getReports.bind(performanceMonitor),
    getPerformanceScore: performanceMonitor.getPerformanceScore.bind(performanceMonitor),
    getPerformanceRecommendations: performanceMonitor.getPerformanceRecommendations.bind(performanceMonitor)
  }
}
export default performanceMonitor
