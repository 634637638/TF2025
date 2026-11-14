'use strict'

const paymentOptions = require('../config/payment-methods.json')

/** 销售及编辑共用配置；不把渠道当作顶层方式，也不猜测缺失渠道。 */
function validateSalePayment(method, channel) {
  const reject = message => { throw Object.assign(new Error(message), { statusCode: 400 }) }
  if (!paymentOptions.sale.some(option => option.value === method)) reject('请选择有效的支付方式')
  const normalizedChannel = channel === undefined || channel === '' ? null : channel
  const channels = paymentOptions.channels[method] || []
  if (channels.length ? !channels.some(option => option.value === normalizedChannel) : normalizedChannel !== null) {
    reject('请选择有效的支付渠道')
  }
  return { payment_method: method, payment_channel: normalizedChannel }
}

/** 退款共用销售派生方式和原路退回配置，不维护第二份选项。 */
function validateRefundPayment(method, channel) {
  const reject = message => { throw Object.assign(new Error(message), { statusCode: 400 }) }
  const methods = [...paymentOptions.sale.filter(option => !paymentOptions.refund.excludedSaleMethods.includes(option.value)),
    ...paymentOptions.refund.extraMethods]
  if (!methods.some(option => option.value === method)) reject('请选择有效的退款方式')
  if (channel !== null && channel !== undefined && typeof channel !== 'string') reject('退款渠道无效')
  const value = typeof channel === 'string' ? channel.trim() : ''
  const channels = paymentOptions.channels[method] || []
  if (channels.length && !channels.some(option => option.value === value)) reject('请选择有效的退款渠道')
  if (!channels.length && value) reject('当前退款方式不支持退款渠道')
  return { refund_method: method, refund_channel: value || null }
}

module.exports = { validateSalePayment, validateRefundPayment }
