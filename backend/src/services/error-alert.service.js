'use strict'

const { createHash } = require('node:crypto')
const { readErrorAlertConfig } = require('../config/error-alerts')
const { createErrorAlertMailer } = require('../utils/error-alert-mailer')
const { normalizeDateTime } = require('../utils/time')
const log = require('../utils/log')

const SYSTEM_FAILURES = Object.freeze({
  database_unavailable: '数据库启动连接不可用',
  startup_failed: '服务启动失败',
  uncaught_exception: '服务发生未捕获异常',
  unhandled_rejection: '服务发生未处理异步异常'
})
const TECHNICAL_TYPES = new Set(['vue', 'javascript', 'async', 'network'])
const parseObject = value => {
  try { return typeof value === 'string' ? JSON.parse(value) : (value || {}) } catch { return {} }
}
const fingerprint = value => createHash('sha256').update(JSON.stringify(value)).digest('hex')
const safeRequestId = value => /^[a-z0-9._:-]{8,128}$/i.test(String(value || '')) ? String(value) : ''

const formatAlert = event => ({
  subject: `[TF2025][生产故障] ${event.severity === 'critical' ? '严重故障' : '持续高频失败'}`,
  text: [
    'TF2025 生产故障通知',
    `来源：${event.source === 'backend' ? '后端' : '浏览器技术错误'}`,
    `事件：${SYSTEM_FAILURES[event.kind] || (event.source === 'backend' ? 'HTTP 5xx 持续失败' : '多次技术错误上报')}`,
    `接口模板：${event.method || '-'} ${event.route || '-'}`,
    `状态码：${event.status || '-'}`,
    `本窗口已观察次数：${event.count}`,
    `首次时间（北京时间）：${normalizeDateTime(event.firstAt)}`,
    `最近时间（北京时间）：${normalizeDateTime(event.lastAt)}`,
    `请求编号：${event.requestIds.join('、') || '无'}`,
    '请通过请求编号核对服务器日志。通知不包含请求体、用户资料、错误堆栈或认证凭据。'
  ].join('\n')
})

class ErrorAlertService {
  constructor({ config = readErrorAlertConfig(), mailer, now = Date.now, setTimer = setTimeout, clearTimer = clearTimeout, logger = log } = {}) {
    this.config = config
    this.mailer = mailer || (config.enabled ? createErrorAlertMailer(config) : null)
    this.now = now
    this.setTimer = setTimer
    this.clearTimer = clearTimer
    this.logger = logger
    this.groups = new Map()
    this.dedup = new Map()
    this.pending = []
    this.attempts = []
    this.running = false
    this.closed = false
    this.timer = null
    if (config.errors.length) logger.warn('故障邮件配置无效，已禁用告警', { fields: config.errors })
  }

  get enabled() { return this.config.enabled && !this.closed }

  recordSystemFailure(kind) {
    if (!Object.hasOwn(SYSTEM_FAILURES, kind)) return
    this.record({ source: 'backend', severity: 'critical', kind })
  }

  recordHttpFailure({ status, method, route, scope, requestId }) {
    if (!Number.isInteger(status) || status < 500 || status > 599) return
    const template = typeof route === 'string' && /^\/[a-z0-9_/:.?*()-]{0,180}$/i.test(route) ? route : '/unmatched'
    this.record({
      source: 'backend', severity: 'high', kind: 'http', status,
      method: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'].includes(method) ? method : 'OTHER',
      route: template,
      // 注册身份只以摘要参与分组，避免跨模块同名 /:id 被合并。
      scope: fingerprint(typeof scope === 'string' ? scope : ''),
      requestId: safeRequestId(requestId)
    })
  }

  recordFrontendReport(report, userId, requestId) {
    if (!this.enabled || parseObject(report.environment)?.mode !== 'production') return
    const now = this.now()
    for (const [key, value] of this.dedup) {
      if (now - value.at >= this.config.windowMs) this.dedup.delete(key)
    }
    for (const error of report.errors) {
      const context = parseObject(error.context)
      const tags = parseObject(error.tags)
      if (!TECHNICAL_TYPES.has(error.errorType) || !['high', 'critical'].includes(error.level)) continue
      if (context?.status >= 400 && context?.status < 500) continue
      // API 失败由服务端响应观测；不叠加浏览器转报，也不相信客户端 critical 或累计 count。
      if (error.component?.startsWith('API:') || (Array.isArray(tags) && tags.includes('api'))) continue
      const key = fingerprint([userId, report.sessionId, error.errorKey])
      const previous = this.dedup.get(key)
      if (previous && error.count <= previous.count) continue
      if (!previous && this.dedup.size >= this.config.maxDedup) continue
      this.dedup.set(key, { count: error.count, at: now })
      this.record({
        source: 'frontend', severity: 'high', kind: 'frontend',
        errorKey: fingerprint([error.errorType, error.message]), requestId: safeRequestId(requestId)
      })
    }
  }

  record(event) {
    if (!this.enabled) return
    const now = this.now()
    for (const [key, group] of this.groups) {
      if (!group.queued && now - group.lastAt >= this.config.windowMs && now >= group.nextAllowedAt) this.groups.delete(key)
    }
    const { requestId, ...identity } = event
    const key = fingerprint(identity)
    let group = this.groups.get(key)
    if (!group) {
      if (this.groups.size >= this.config.maxGroups) return
      group = { ...identity, count: 0, firstAt: now, lastAt: now, requestIds: [], nextAllowedAt: 0, queued: false }
      this.groups.set(key, group)
    }
    if (now - group.firstAt >= this.config.windowMs) {
      group.count = 0
      group.firstAt = now
      group.requestIds = []
    }
    group.count = Math.min(group.count + 1, 1_000_000)
    group.lastAt = now
    if (requestId && !group.requestIds.includes(requestId)) group.requestIds = [...group.requestIds, requestId].slice(-3)
    const qualifies = group.severity === 'critical' || (group.count >= this.config.threshold && now - group.firstAt >= this.config.minSpanMs)
    if (!qualifies || group.queued || now < group.nextAllowedAt || this.pending.length >= this.config.maxPending) return
    group.queued = true
    this.pending.push({ group, event: { ...group, requestIds: [...group.requestIds] }, attempts: 0, dueAt: now })
    this.flush().catch(() => this.logger.warn('故障邮件队列执行失败，业务继续运行'))
  }

  schedule(delay) {
    if (this.timer !== null) this.clearTimer(this.timer)
    this.timer = this.setTimer(() => {
      this.timer = null
      return this.flush()
    }, Math.max(1, delay))
    this.timer.unref?.()
  }

  async flush() {
    if (!this.enabled || this.running) return
    this.running = true
    try {
      while (this.enabled && this.pending.length) {
        const now = this.now()
        this.attempts = this.attempts.filter(at => now - at < this.config.windowMs)
        if (this.attempts.length >= this.config.maxPerWindow) {
          this.schedule(this.attempts[0] + this.config.windowMs - now)
          return
        }
        const index = this.pending.findIndex(job => job.dueAt <= now)
        if (index < 0) {
          this.schedule(Math.min(...this.pending.map(job => job.dueAt)) - now)
          return
        }
        const [job] = this.pending.splice(index, 1)
        job.attempts++
        this.attempts.push(now)
        try {
          await this.mailer.send(formatAlert(job.event))
          job.group.queued = false
          job.group.nextAllowedAt = this.now() + this.config.cooldownMs
        } catch {
          if (this.closed) return
          this.logger.warn('故障邮件发送失败', { attempt: job.attempts, maxAttempts: this.config.maxAttempts })
          if (job.attempts < this.config.maxAttempts) {
            job.dueAt = this.now() + this.config.retryDelayMs
            this.pending.push(job)
          } else {
            job.group.queued = false
            job.group.nextAllowedAt = this.now() + this.config.cooldownMs
          }
        }
      }
    } finally {
      this.running = false
    }
  }

  close() {
    this.closed = true
    if (this.timer !== null) this.clearTimer(this.timer)
    this.timer = null
    this.pending = []
    this.groups.clear()
    this.dedup.clear()
    this.mailer?.close()
  }
}

let instance
const getErrorAlertService = () => {
  if (!instance) instance = new ErrorAlertService()
  return instance
}

module.exports = { ErrorAlertService, getErrorAlertService }
