/**
 * 全局性能监控系统
 * 提供核心Web指标和自定义性能指标的跟踪、分析和报告
 */

import { ref, reactive, onMounted, onUnmounted } from 'vue'
import logger from '@/utils/logger'

// 性能监控配置
interface PerformanceConfig {
  enabled: boolean
  sampleRate: number // 采样率 0-1
  enableWebVitals: boolean
  enableResourceTiming: boolean
  enableLongTasks: boolean
  autoReport: boolean
  reportInterval: number // 自动报告间隔(毫秒)
}

// 默认配置
const DEFAULT_CONFIG: PerformanceConfig = {
  enabled: true,
  sampleRate: 0.1, // 10% 采样率
  enableWebVitals: true,
  enableResourceTiming: true,
  enableLongTasks: true,
  autoReport: false,
  reportInterval: 30000 // 30秒
}

// Core Web Vitals 阈值
const WEB_VITALS_THRESHOLDS = {
  FCP: { good: 1800, needsImprovement: 3000 }, // First Contentful Paint
  LCP: { good: 2500, needsImprovement: 4000 }, // Largest Contentful Paint
  FID: { good: 100, needsImprovement: 300 },  // First Input Delay
  CLS: { good: 0.1, needsImprovement: 0.25 }, // Cumulative Layout Shift
  TTFB: { good: 800, needsImprovement: 1800 }, // Time to First Byte
}

/**
 * 性能监控管理器
 */
export class PerformanceMonitor {
  private config: PerformanceConfig
  private isMonitoring = false
  private reports: any[] = []
  private observers: PerformanceObserver[] = []
  private metrics = reactive({
    pageLoadTime: 0,
    domReadyTime: 0,
    fcp: 0,
    lcp: 0,
    fid: 0,
    cls: 0,
    ttfb: 0,
    tti: 0,
    resourceCount: 0,
    resourceSize: 0,
    slowResources: [],
    errorRate: 0,
    userSatisfaction: 100,
    pageViews: 0,
    longTaskCount: 0,
    apiLatency: {},
    timestamp: Date.now()
  })
  private errorCount = 0
  private longTasks: any[] = []

  constructor(config: Partial<PerformanceConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.initialize()
  }

  /**
   * 初始化性能监控
   */
  private initialize() {
    if (!this.config.enabled || !window.performance) {
      logger.warn('性能监控未启用或浏览器不支持 Performance API')
      return
    }

    // 监听页面卸载事件
    window.addEventListener('beforeunload', () => {
      this.reportFinalMetrics()
    })

    // 监听错误事件
    window.addEventListener('error', () => {
      this.errorCount++
      this.metrics.errorRate = this.calculateErrorRate()
    })

    // 监听未捕获的Promise错误
    window.addEventListener('unhandledrejection', () => {
      this.errorCount++
      this.metrics.errorRate = this.calculateErrorRate()
    })
  }

  /**
   * 开始监控
   */
  startMonitoring() {
    if (this.isMonitoring) {
      return
    }
    this.isMonitoring = true
    this.setupObservers()
    this.startAutoReporting()
  }

  private setupObservers() {
    if (this.config.enableWebVitals) {
      this.setupWebVitalsObserver()
    }

    this.setupResourceTimingObserver()
    this.setupNavigationTiming()

    if (this.config.enableLongTasks) {
      this.setupLongTaskObserver()
    }
  }

  /**
   * 停止监控
   */
  stopMonitoring() {
    if (!this.isMonitoring) return

    this.isMonitoring = false

    // 断开所有观察者
    this.observers.forEach(observer => observer.disconnect())
    this.observers = []

    // 停止自动报告
    this.stopAutoReporting()
  }

  /**
   * 记录自定义指标
   */
  recordMetric(name: string, value: number, unit: 'ms' | 'bytes' | 'count' | 'percent' = 'ms') {
    if (!this.isMonitoring) return

    // 记录到用户时间标记
    if (this.config.enableWebVitals) {
      performance.mark(`custom-metric-${name}-${value}`)
    }

    // 如果是采样率内的请求，记录到报告
    if (Math.random() < this.config.sampleRate) {
      this.addCustomMetric(name, value, unit)
    }
  }

  /**
   * 开始页面加载跟踪
   */
  private startPageLoadTracking() {
    const navigation = performance.getEntriesByType('navigation')[0] as any

    if (navigation) {
      this.metrics.pageLoadTime = navigation.loadEventEnd - navigation.fetchStart
      this.metrics.domReadyTime = navigation.domContentLoadedEventEnd - navigation.fetchStart
      this.metrics.ttfb = navigation.responseStart - navigation.requestStart
    }
  }

  /**
   * 设置Web Vitals观察者
   */
  private setupWebVitalsObserver() {
    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          this.processWebVitalEntry(entry as any)
        }
      })

      observer.observe({ entryTypes: ['largest-contentful-paint', 'first-input', 'layout-shift'] })
      this.observers.push(observer)

      // First Contentful Paint 需要单独处理
      const paintObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.name === 'first-contentful-paint') {
            this.metrics.fcp = entry.startTime
            this.evaluateWebVital('FCP', entry.startTime)
          }
        }
      })

      paintObserver.observe({ entryTypes: ['paint'] })
      this.observers.push(paintObserver)

    } catch (error) {
      logger.warn('Web Vitals 观察者初始化失败', error)
    }
  }

  /**
   * 处理Web Vitals条目
   */
  private processWebVitalEntry(entry: any) {
    switch (entry.entryType) {
      case 'largest-contentful-paint':
        this.metrics.lcp = entry.startTime
        this.evaluateWebVital('LCP', entry.startTime)
        break

      case 'first-input':
        if (entry.processingStart) {
          const fid = entry.processingStart - entry.startTime
          this.metrics.fid = fid
          this.evaluateWebVital('FID', fid)
        }
        break

      case 'layout-shift':
        if (!entry.hadRecentInput) {
          this.metrics.cls = (this.metrics.cls || 0) + entry.value
          this.evaluateWebVital('CLS', this.metrics.cls)
        }
        break
    }
  }

  /**
   * 评估Web Vitals质量
   */
  private evaluateWebVital(name: string, value: number) {
    const thresholds = (WEB_VITALS_THRESHOLDS as any)[name]
    if (!thresholds) return

    let rating: 'good' | 'needs-improvement' | 'poor' = 'good'

    if (value >= thresholds.needsImprovement) {
      rating = 'poor'
    } else if (value >= thresholds.good) {
      rating = 'needs-improvement'
    }

    this.recordMetric(`web-vital-${name.toLowerCase()}`, value)
    this.updateUserSatisfactionRating(name, rating)
  }

  /**
   * 更新用户满意度评分
   */
  private updateUserSatisfactionRating(vital: string, rating: string) {
    if (rating === 'good') {
      this.metrics.userSatisfaction = Math.min(100, (this.metrics.userSatisfaction || 100) + 2)
    } else if (rating === 'poor') {
      this.metrics.userSatisfaction = Math.max(0, (this.metrics.userSatisfaction || 100) - 5)
    } else {
      this.metrics.userSatisfaction = Math.max(0, (this.metrics.userSatisfaction || 100) - 1)
    }
  }

  /**
   * 设置资源时间观察者
   */
  private setupResourceTimingObserver() {
    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          this.processResourceEntry(entry as PerformanceResourceTiming)
        }
      })

      observer.observe({ entryTypes: ['resource'] })
      this.observers.push(observer)

    } catch (error) {
      logger.warn('资源时间观察者初始化失败', error)
    }
  }

  /**
   * 处理资源条目
   */
  private processResourceEntry(entry: PerformanceResourceTiming) {
    const url = entry.name
    const duration = entry.responseEnd - entry.startTime
    const size = entry.transferSize || 0

    // 记录慢资源
    if (duration > 1000) { // 超过1秒的资源
      this.metrics.slowResources = (this.metrics.slowResources || []).concat({
        name: url,
        duration,
        size,
        type: this.getResourceType(entry)
      })

      // 只保留前10个慢资源
      if (this.metrics.slowResources.length > 10) {
        this.metrics.slowResources = this.metrics.slowResources.slice(0, 10)
      }
    }

    // 更新资源统计
    this.metrics.resourceCount = (this.metrics.resourceCount || 0) + 1
    this.metrics.resourceSize = (this.metrics.resourceSize || 0) + size
  }

  /**
   * 获取资源类型
   */
  private getResourceType(entry: PerformanceResourceTiming): string {
    const url = entry.name
    if (url.match(/\.(js|css)$/)) return 'script/style'
    if (url.match(/\.(png|jpg|jpeg|gif|svg|webp)$/)) return 'image'
    if (url.match(/\.(woff|woff2|ttf|eot)$/)) return 'font'
    if (url.match(/\.(mp4|webm|ogg|mp3|wav)$/)) return 'media'
    return 'other'
  }

  /**
   * 设置长任务观察者
   */
  private setupLongTaskObserver() {
    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          this.longTasks.push(entry)

          // 只保留最近的长任务
          if (this.longTasks.length > 50) {
            this.longTasks = this.longTasks.slice(-50)
          }
        }
      })

      observer.observe({ entryTypes: ['longtask'] })
      this.observers.push(observer)

    } catch (error) {
      logger.warn('长任务观察者初始化失败', error)
    }
  }

  /**
   * 设置导航时间观察者
   */
  private setupNavigationTiming() {
    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          this.processNavigationEntry(entry as PerformanceNavigationTiming)
        }
      })

      observer.observe({ entryTypes: ['navigation'] })
      this.observers.push(observer)

    } catch (error) {
      logger.warn('导航时间观察者初始化失败', error)
    }
  }

  /**
   * 处理导航条目
   */
  private processNavigationEntry(entry: PerformanceNavigationTiming) {
    // 简化的TTI计算
    this.metrics.tti = entry.domContentLoadedEventEnd - entry.fetchStart
  }

  /**
   * 开始自动报告
   */
  private startAutoReporting() {
    setInterval(() => {
      if (this.isMonitoring && this.shouldReport()) {
        this.generateReport()
      }
    }, this.config.reportInterval)
  }

  /**
   * 停止自动报告
   */
  private stopAutoReporting() {
    // 清理定时器
  }

  /**
   * 判断是否应该报告
   */
  private shouldReport(): boolean {
    return Math.random() < this.config.sampleRate
  }

  /**
   * 添加自定义指标
   */
  private addCustomMetric(name: string, value: number, unit: string) {
    // 实现自定义指标记录逻辑
  }

  /**
   * 计算错误率
   */
  private calculateErrorRate(): number {
    return this.metrics.pageViews > 0 ? (this.errorCount / this.metrics.pageViews) * 100 : 0
  }

  /**
   * 获取当前指标
   */
  getMetrics() {
    return { ...this.metrics }
  }

  /**
   * 生成性能报告
   */
  generateReport() {
    const report = {
      // Core Web Vitals
      fcp: this.metrics.fcp || 0,
      lcp: this.metrics.lcp || 0,
      fid: this.metrics.fid || 0,
      cls: this.metrics.cls || 0,
      ttfb: this.metrics.ttfb || 0,

      // Navigation Timing
      domReady: this.metrics.domReadyTime || 0,
      loadComplete: this.metrics.pageLoadTime || 0,
      tti: this.metrics.tti || 0,

      // Resource Metrics
      resourceCount: this.metrics.resourceCount || 0,
      resourceSize: this.metrics.resourceSize || 0,
      slowResources: this.metrics.slowResources || [],

      // Custom Metrics
      apiLatency: this.metrics.apiLatency || {},
      errorRate: this.metrics.errorRate || 0,
      userSatisfaction: this.metrics.userSatisfaction || 100,

      // Additional Info
      pageViews: this.metrics.pageViews,
      longTaskCount: this.longTasks.length,
      userAgent: navigator.userAgent,
      url: window.location.href,
      timestamp: Date.now()
    }

    // 添加到报告历史
    this.reports.push(report)

    // 发送报告到服务器（如果配置了）
    if (this.config.autoReport) {
      this.sendReport(report)
    }

    return report
  }

  /**
   * 发送报告到服务器
   */
  private async sendReport(report: any) {
    try {
      const response = await fetch('/api/performance/report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(report)
      })

      if (!response.ok) {
        logger.warn('性能报告发送失败')
      }
    } catch (error) {
      logger.warn('性能报告发送错误', error)
    }
  }

  /**
   * 生成最终报告（页面卸载时）
   */
  private reportFinalMetrics() {
    this.generateReport()
  }

  /**
   * 获取历史报告
   */
  getReports() {
    return [...this.reports]
  }

  /**
   * 清除报告历史
   */
  clearReports() {
    this.reports = []
  }

  /**
   * 获取性能评分
   */
  getPerformanceScore(): number {
    let score = 100

    // 基于Web Vitals计算分数
    if (this.metrics.fcp && this.metrics.fcp > 3000) score -= 20
    if (this.metrics.lcp && this.metrics.lcp > 4000) score -= 25
    if (this.metrics.fid && this.metrics.fid > 300) score -= 15
    if (this.metrics.cls && this.metrics.cls > 0.25) score -= 20

    // 基于错误率
    if (this.metrics.errorRate && this.metrics.errorRate > 5) score -= 10

    // 基于慢资源
    if (this.metrics.slowResources && this.metrics.slowResources.length > 5) score -= 10

    return Math.max(0, score)
  }

  /**
   * 获取性能建议
   */
  getPerformanceRecommendations(): string[] {
    const recommendations: string[] = []

    if (this.metrics.fcp && this.metrics.fcp > 3000) {
      recommendations.push('FCP过长，建议优化首屏渲染资源')
    }

    if (this.metrics.lcp && this.metrics.lcp > 4000) {
      recommendations.push('LCP过长，建议优化最大内容元素加载')
    }

    if (this.metrics.fid && this.metrics.fid > 300) {
      recommendations.push('FID过长，建议减少JavaScript执行阻塞')
    }

    if (this.metrics.cls && this.metrics.cls > 0.25) {
      recommendations.push('CLS过高，建议优化布局稳定性')
    }

    if (this.metrics.ttfb && this.metrics.ttfb > 1800) {
      recommendations.push('TTFB过长，建议优化服务器响应时间')
    }

    if (this.metrics.errorRate && this.metrics.errorRate > 5) {
      recommendations.push('错误率过高，建议加强错误处理和监控')
    }

    return recommendations
  }
}

// 创建全局实例
export const performanceMonitor = new PerformanceMonitor()

// Vue插件
export const PerformancePlugin = {
  install(app: any) {
    app.provide('performanceMonitor', performanceMonitor)

    if (window.__TF2025__) {
      window.__TF2025__.performance = performanceMonitor
    }
  }
}

// Composable
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
