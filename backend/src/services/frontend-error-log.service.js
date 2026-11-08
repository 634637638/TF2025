'use strict'

const {
  redactString,
  redactValue,
  serializeRedactedJson
} = require('../utils/sensitive-data')
const FrontendErrorLogRepository = require('../repositories/frontend-error-log.repository')

const MAX_BATCH_SIZE = 50
const MAX_JSON_LENGTH = 32_000
const ALLOWED_LEVELS = new Set(['low', 'medium', 'high', 'critical'])
const ALLOWED_TYPES = new Set([
  'vue', 'javascript', 'network', 'async', 'permission', 'validation', 'performance', 'business'
])

const truncate = (value, maxLength) => String(value ?? '').slice(0, maxLength)
const serializeJson = value => serializeRedactedJson(value, MAX_JSON_LENGTH)

const normalizeOccurredAt = timestamp => {
  const numericTimestamp = Number(timestamp)
  const date = new Date(Number.isFinite(numericTimestamp) ? numericTimestamp : Date.now())
  return Number.isNaN(date.getTime()) ? new Date() : date
}

const normalizeError = (entry, index) => {
  if (!entry || typeof entry !== 'object') return null
  const message = truncate(entry.message, 1000).trim()
  if (!message) return null

  return {
    errorKey: truncate(entry.id || `frontend-${index}`, 80),
    level: ALLOWED_LEVELS.has(entry.level) ? entry.level : 'high',
    errorType: ALLOWED_TYPES.has(entry.type) ? entry.type : 'javascript',
    message: redactString(message),
    stack: entry.stack ? redactString(entry.stack) : null,
    context: serializeJson(entry.context),
    component: entry.component ? truncate(entry.component, 160) : null,
    action: entry.action ? truncate(entry.action, 160) : null,
    tags: serializeJson(Array.isArray(entry.tags) ? entry.tags.slice(0, 20) : []),
    occurredAt: normalizeOccurredAt(entry.timestamp),
    count: Math.max(1, Math.min(Number(entry.count) || 1, 1_000_000)),
    pageUrl: entry.url ? redactString(entry.url).slice(0, 2048) : null,
    userAgent: entry.userAgent ? truncate(entry.userAgent, 512) : null
  }
}

class FrontendErrorLogService {
  constructor({ repository = new FrontendErrorLogRepository() } = {}) {
    this.repository = repository
  }

  prepareReport(body = {}) {
    const sourceErrors = Array.isArray(body.errors)
      ? body.errors
      : (body.error ? [body.error] : [])

    if (sourceErrors.length === 0) {
      return { error: { status: 400, message: '缺少错误日志数据' } }
    }
    if (sourceErrors.length > MAX_BATCH_SIZE) {
      return { error: { status: 400, message: `单次最多上报 ${MAX_BATCH_SIZE} 条错误` } }
    }

    const errors = sourceErrors.map(normalizeError).filter(Boolean)
    if (errors.length === 0) {
      return { error: { status: 400, message: '错误日志格式无效' } }
    }

    return {
      errors,
      sessionId: truncate(body.sessionId || 'unknown', 128),
      environment: serializeJson(body.environment),
      sessionData: serializeJson(body.session)
    }
  }

  async submitReport(body, userId) {
    const report = this.prepareReport(body)
    if (report.error) return report
    await this.repository.insertBatch({ userId, ...report })
    return { accepted: report.errors.length }
  }
}

module.exports = FrontendErrorLogService
module.exports.normalizeError = normalizeError
module.exports.redactValue = redactValue
