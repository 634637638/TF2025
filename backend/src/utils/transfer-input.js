'use strict'

const { parseInput } = require('../middleware/validation')

function parseTransferInput(input, { proxy = false } = {}) {
  const parsed = parseInput(input, {
    phone_ids: { type: 'array', required: true, minItems: 1, maxItems: Number.MAX_SAFE_INTEGER, itemType: 'id', label: '手机ID' },
    customer_id: { type: 'id', label: '客户ID' },
    supplier_id: { type: 'id', required: proxy, label: '供应商ID' },
    operator_id: { type: 'id', required: true, label: '操作员ID' },
    store_id: { type: 'id', label: '门店ID' },
    customer_name: { type: 'personName', maxLength: 50, label: '客户姓名' },
    customer_phone: { type: 'phone', label: '客户手机号' },
    salesperson_name: { type: 'personName', maxLength: 50, label: '销售员姓名' },
    remarks: { type: 'string', maxLength: 1000, multiline: true, label: '备注' }
  })
  // 通用数组规则只验证原数组；ID均已逐项验证后，再统一数字表示以检查重复与匹配明细。
  parsed.phone_ids = parsed.phone_ids.map(Number)
  if (new Set(parsed.phone_ids).size !== parsed.phone_ids.length) {
    throw Object.assign(new Error('手机ID不能重复'), { statusCode: 400, code: 'VALIDATION_ERROR' })
  }
  return parsed
}

// 保留逐台成功/失败语义，但先拒绝全部非法价格，避免无有效明细时仍新建客户。
function prepareWholesalePrices(ids, phones = []) {
  parseInput({ phones }, { phones: { type: 'array', required: true, maxItems: Number.MAX_SAFE_INTEGER, label: '手机价格明细' } })
  const rows = new Map()
  for (const row of phones) {
    const { phone_id } = parseInput(row, { phone_id: { type: 'id', required: true, label: '手机ID' } })
    if (rows.has(phone_id) || !ids.includes(phone_id)) {
      throw Object.assign(new Error('手机价格明细包含重复或未选择的手机ID'), { statusCode: 400, code: 'VALIDATION_ERROR' })
    }
    rows.set(phone_id, row)
  }
  const prices = new Map()
  const failed_phones = []
  for (const phone_id of ids) {
    try {
      const row = parseInput(rows.get(phone_id) || {}, {
        wholesale_price: { type: 'money', required: true, min: 0.01, max: 99999999.99, label: '批发价格' },
        purchase_cost: { type: 'money', min: 0, max: 99999999.99, label: '入库成本' }
      })
      prices.set(phone_id, { wholesale_price: row.wholesale_price, purchase_cost: row.purchase_cost ?? null })
    } catch (error) {
      if (error.statusCode !== 400) throw error
      failed_phones.push({ phone_id, error: error.message })
    }
  }
  return { prices, failed_phones }
}

module.exports = { parseTransferInput, prepareWholesalePrices }
