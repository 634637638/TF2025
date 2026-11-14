'use strict'

const schema = require('../contracts/performance-report.schema.json')
const BaseService = require('../core/base/base.service')
const log = require('../utils/log')

/** 固定大小的分钟聚合；不按用户、路径分组，不保存原始上报，也不读写数据库。 */
class PerformanceReportService extends BaseService {
  constructor({ clock = Date.now, logger = log } = {}) {
    super()
    this.clock = clock
    this.logger = logger
    this.reset()
  }

  reset() {
    this.startedAt = this.clock()
    this.samples = 0
    this.metrics = Object.fromEntries(Object.keys(schema.properties).map(key => [key, { count: 0, sum: 0, max: 0 }]))
  }

  validate(report) {
    if (!report || Array.isArray(report) || typeof report !== 'object' ||
      Object.keys(report).length !== Object.keys(schema.properties).length) throw this.createError('性能报告仅接受完整的数值指标', 400)
    for (const [key, rule] of Object.entries(schema.properties)) {
      const value = report[key]
      if (typeof value !== 'number' || !Number.isFinite(value) || value < rule.minimum || value > rule.maximum ||
        (rule.type === 'integer' && !Number.isSafeInteger(value))) throw this.createError('性能报告指标无效', 400)
    }
  }

  accept(report) {
    this.validate(report)
    if (this.clock() - this.startedAt >= 60000 || this.samples >= 10000) this.flush()
    this.samples++
    for (const [key, value] of Object.entries(report)) {
      // 未观测到的 0 不计入 Web Vitals 平均值；计数本身仍保留 0。
      if (value === 0 && ['fcp', 'lcp', 'inp', 'ttfb', 'tti', 'domReady', 'loadComplete'].includes(key)) continue
      const metric = this.metrics[key]
      metric.count++
      metric.sum += value
      metric.max = Math.max(metric.max, value)
    }
    return { accepted: true }
  }

  flush() {
    if (this.samples) this.logger.info('性能指标聚合', { samples: this.samples, windowMs: this.clock() - this.startedAt,
      metrics: Object.fromEntries(Object.entries(this.metrics).map(([key, metric]) => [key, {
        count: metric.count, average: metric.count ? metric.sum / metric.count : 0, max: metric.max
      }])) })
    this.reset()
  }
}

module.exports = PerformanceReportService
