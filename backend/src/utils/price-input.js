'use strict'

const { parseInput } = require('../middleware/validation')

const parsePriceInput = (source, { spreadsheet = false } = {}) => {
  const body = parseInput(source, {})
  if (spreadsheet) {
    for (const field of ['retail_price', 'wholesale_price', 'stock_quantity']) {
      const value = body[field]
      // Excel 明示允许完整千分组；不删除单位、百分号、换行或混输字符。
      if (typeof value === 'string' && /^\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?$/.test(value)) body[field] = value.replaceAll(',', '')
    }
  }
  return parseInput(body, {
    brand_name: { type: 'string', required: true, maxLength: 100, label: '品牌' },
    model_number: { type: 'string', required: true, maxLength: 100, label: '型号' },
    ...Object.fromEntries(['color_name', 'memory', 'external_model'].map(field => [field, { type: 'string', maxLength: 100, label: field }])),
    retail_price: { type: 'money', min: 0, label: '零售价' },
    wholesale_price: { type: 'money', min: 0, label: '批发价' },
    stock_quantity: { type: 'number', integer: true, min: 0, max: 2147483647, label: '库存数量' },
    source_config_id: { type: 'id', label: '采集来源' },
    ...Object.fromEntries(['is_collect', 'show_price', 'status'].map(field => [field, { type: 'number', integer: true, min: 0, max: 1, required: body[field] !== undefined, label: field }])),
    remark: { type: 'string', multiline: true, maxLength: 1000, label: '备注' }
  })
}

module.exports = { parsePriceInput }
