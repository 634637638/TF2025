'use strict'

const { isEmail } = require('validator')

// 运行时仅从后端本机环境读取；不从浏览器或数据库接收 SMTP 配置。
const readErrorAlertConfig = (env = process.env) => {
  const requested = env.ERROR_ALERT_ENABLED === 'true'
  const production = env.NODE_ENV === 'production'
  const errors = []
  const address = value => String(value || '').trim()
  const validAddress = value => !/[\r\n]/.test(value) && isEmail(value, { allow_display_name: false })
  const recipients = address(env.ERROR_ALERT_TO).split(',').map(value => value.trim()).filter(Boolean)
  const from = address(env.ERROR_ALERT_FROM)
  const host = address(env.ERROR_ALERT_SMTP_HOST)
  const portText = String(env.ERROR_ALERT_SMTP_PORT || '465')
  const thresholdText = String(env.ERROR_ALERT_THRESHOLD || '10')
  const user = address(env.ERROR_ALERT_SMTP_USER)
  const pass = String(env.ERROR_ALERT_SMTP_PASSWORD || '')

  if (requested && production) {
    if (!/^[a-z0-9.-]+$/i.test(host) || host.length > 253) errors.push('ERROR_ALERT_SMTP_HOST 无效')
    if (!['465', '587'].includes(portText)) errors.push('ERROR_ALERT_SMTP_PORT 仅支持 465 或 587')
    if (!user || !pass || /[\r\n]/.test(user)) errors.push('SMTP 用户或授权密码未正确配置')
    if (!validAddress(from)) errors.push('ERROR_ALERT_FROM 必须为单个邮箱地址')
    if (!recipients.length || recipients.length > 5 || recipients.some(value => !validAddress(value))) {
      errors.push('ERROR_ALERT_TO 需要 1 至 5 个有效邮箱地址')
    }
    if (!/^\d+$/.test(thresholdText) || Number(thresholdText) < 2 || Number(thresholdText) > 1000) {
      errors.push('ERROR_ALERT_THRESHOLD 必须为 2 至 1000 的整数')
    }
  }

  return {
    enabled: requested && production && errors.length === 0,
    requested,
    production,
    errors,
    threshold: Number(thresholdText),
    windowMs: 5 * 60 * 1000,
    minSpanMs: 30 * 1000,
    cooldownMs: 5 * 60 * 1000,
    retryDelayMs: 30 * 1000,
    maxAttempts: 3,
    maxPerWindow: 5,
    maxGroups: 500,
    maxPending: 50,
    maxDedup: 2000,
    timeoutMs: 5000,
    from,
    recipients: [...new Set(recipients)],
    smtp: {
      host,
      port: Number(portText),
      secure: portText === '465',
      requireTLS: true,
      tls: { rejectUnauthorized: true, minVersion: 'TLSv1.2' },
      auth: { user, pass },
      connectionTimeout: 4000,
      greetingTimeout: 4000,
      socketTimeout: 5000,
      logger: false,
      debug: false
    }
  }
}

module.exports = { readErrorAlertConfig }
