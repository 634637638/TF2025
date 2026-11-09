'use strict'

const options = require('../config/return-stock-options.json')
const paymentOptions = require('../config/payment-methods.json')
const { normalizeDateTime } = require('../utils/time')

function invalid(message) {
  const error = new Error(message)
  error.statusCode = 400
  error.code = 'INVALID_RETURN_STOCK'
  throw error
}

/** 创建必须完整提交；编辑只校验显式提交字段，保留历史空值。 */
function normalizeReturnStockInfo(payload = {}, { partial = false } = {}) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) invalid('退库信息无效')
  const result = {}
  const labels = {
    return_reason: '退库原因', return_type: '退库类型',
    handle_method: '处理方式', refund_method: '退款方式'
  }
  for (const [field, label] of Object.entries(labels)) {
    if (partial && !Object.prototype.hasOwnProperty.call(payload, field)) continue
    const value = typeof payload[field] === 'string' ? payload[field].trim() : ''
    const allowed = field === 'refund_method'
      ? [...paymentOptions.sale.filter(option => !paymentOptions.refund.excludedSaleMethods.includes(option.value)),
        ...paymentOptions.refund.extraMethods].map(option => option.value)
      : options[field]
    if (!allowed.includes(value)) invalid(`请选择有效的${label}`)
    result[field] = value
  }

  if (!partial || ['refund_method', 'refund_channel'].some(field => Object.prototype.hasOwnProperty.call(payload, field))) {
    if (!result.refund_method) invalid('修改退款渠道时请同时提交退款方式')
    const channels = paymentOptions.channels[result.refund_method] || []
    const value = typeof payload.refund_channel === 'string' ? payload.refund_channel.trim() : ''
    if (channels.length && !channels.some(channel => channel.value === value)) invalid('请选择有效的退款渠道')
    if (!channels.length && value) invalid('当前退款方式不支持退款渠道')
    if (payload.refund_channel !== null && payload.refund_channel !== undefined && typeof payload.refund_channel !== 'string') invalid('退款渠道无效')
    result.refund_channel = value || null
  }

  if (!partial || Object.prototype.hasOwnProperty.call(payload, 'refund_amount')) {
    const value = payload.refund_amount
    if ((typeof value !== 'number' && typeof value !== 'string') || String(value).trim() === '') {
      invalid('请填写退款金额，未退款时填写0')
    }
    const amount = Number(value)
    if (!Number.isFinite(amount) || amount < 0 || amount > 99999999.99 ||
        Math.abs(amount * 100 - Math.round(amount * 100)) > 0.00001) {
      invalid('退款金额须为0至99999999.99之间、最多两位小数的金额')
    }
    result.refund_amount = amount
  }

  if (!partial || Object.prototype.hasOwnProperty.call(payload, 'reversal_date')) {
    const value = typeof payload.reversal_date === 'string' ? payload.reversal_date.trim() : ''
    const normalized = value ? normalizeDateTime(value, false) : null
    const parsed = normalized ? new Date(`${normalized.replace(' ', 'T')}+08:00`) : null
    if (!normalized || !parsed || Number.isNaN(parsed.getTime()) ||
        normalizeDateTime(parsed, false) !== normalized) invalid('请选择有效的退库时间')
    result.reversal_date = normalized
  }

  if (!partial || Object.prototype.hasOwnProperty.call(payload, 'remarks')) {
    if (payload.remarks !== null && payload.remarks !== undefined && typeof payload.remarks !== 'string') invalid('备注必须是文本')
    const remarks = (payload.remarks || '').trim()
    if (remarks.length > 200) invalid('备注不能超过200字')
    result.remarks = remarks
  }
  return result
}

module.exports = { normalizeReturnStockInfo }
