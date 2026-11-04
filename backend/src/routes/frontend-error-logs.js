'use strict'

const express = require('express')
const { getDatabase } = require('../config/database')
const { unifiedAuth } = require('../middleware/unified-auth')
const log = require('../utils/log')
const {
  redactString,
  redactValue,
  serializeRedactedJson
} = require('../utils/sensitive-data')

const router = express.Router()

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

router.post('/errors', unifiedAuth, async (req, res) => {
  try {
    const userId = Number(req.user?.id)
    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(401).json({ success: false, message: '登录状态无效' })
    }

    const sourceErrors = Array.isArray(req.body?.errors)
      ? req.body.errors
      : (req.body?.error ? [req.body.error] : [])
    if (sourceErrors.length === 0) {
      return res.status(400).json({ success: false, message: '缺少错误日志数据' })
    }
    if (sourceErrors.length > MAX_BATCH_SIZE) {
      return res.status(400).json({ success: false, message: `单次最多上报 ${MAX_BATCH_SIZE} 条错误` })
    }

    const errors = sourceErrors.map(normalizeError).filter(Boolean)
    if (errors.length === 0) {
      return res.status(400).json({ success: false, message: '错误日志格式无效' })
    }

    const sessionId = truncate(req.body?.sessionId || 'unknown', 128)
    const environment = serializeJson(req.body?.environment)
    const sessionData = serializeJson(req.body?.session)
    const rowSql = '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    const values = errors.flatMap(error => [
      error.errorKey,
      userId,
      sessionId,
      error.level,
      error.errorType,
      error.message,
      error.stack,
      error.context,
      error.component,
      error.action,
      error.tags,
      error.occurredAt,
      error.count,
      error.pageUrl,
      error.userAgent,
      environment,
      sessionData
    ])

    const db = getDatabase()
    await db.execute(`
      INSERT INTO frontend_error_logs (
        error_key, user_id, session_id, level, error_type, message, stack,
        context, component, action_name, tags, occurred_at, occurrence_count,
        page_url, user_agent, environment, session_data
      ) VALUES ${errors.map(() => rowSql).join(', ')}
      ON DUPLICATE KEY UPDATE
        occurrence_count = GREATEST(occurrence_count, VALUES(occurrence_count)),
        updated_at = CURRENT_TIMESTAMP
    `, values)

    return res.json({
      success: true,
      message: '错误日志上报成功',
      data: { accepted: errors.length }
    })
  } catch (error) {
    log.error('前端错误日志上报失败:', error)
    return res.status(500).json({ success: false, message: '错误日志上报失败' })
  }
})

module.exports = router
module.exports.redactValue = redactValue
module.exports.normalizeError = normalizeError
