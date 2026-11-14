'use strict'

const { parseInput } = require('../middleware/validation')

const parseRentalInput = body => parseInput(body, {
  ...Object.fromEntries(['unit_price', 'sale_price', 'purchase_cost', 'down_payment', 'monthly_rent', 'deposit'].map(field => [field, {
    type: 'money', min: 0, required: body?.[field] !== undefined, label: field
  }])),
  ...Object.fromEntries(['customer_id', 'phone_id', 'sale_operator_id', 'sale_store_id'].map(field => [field, { type: 'id', label: field }])),
  term_months: { type: 'number', integer: true, min: 1, max: 12, label: '期数' },
  monitoring_lock: { type: 'boolean', required: body?.monitoring_lock !== undefined, label: '监管锁' },
  billing_mode: { type: ['daily', 'buyout'], label: '计费方式' },
  start_date: { type: 'string', maxLength: 10, pattern: '^\\d{4}-\\d{2}-\\d{2}$', label: '开始日期' },
  sale_payment_method: { type: 'string', maxLength: 50, label: '支付方式' },
  sale_payment_channel: { type: 'string', maxLength: 50, label: '支付渠道' },
  sale_remarks: { type: 'string', multiline: true, maxLength: 500, label: '销售备注' },
  remarks: { type: 'string', multiline: true, maxLength: 500, label: '备注' }
})

const parseRentalId = id => parseInput({ id }, { id: { type: 'id', required: true, label: '租赁合同ID' } }).id

module.exports = { parseRentalInput, parseRentalId }
