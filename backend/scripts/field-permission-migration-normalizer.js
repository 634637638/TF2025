'use strict'

const FIELD_CONFIG_KEY_MAP = Object.freeze({
  hiddenFields: 'hidden_fields',
  editableFields: 'editable_fields'
})

const FIELD_ID_MAP = Object.freeze({
  'time_info.Inventorytime': 'time_info.inventory_time',
  'time_info.salestime': 'time_info.sale_time',
  'basic_info.purchase_price': 'basic_info.purchase_cost',
  'price_info.purchase_price': 'price_info.purchase_cost'
})

function normalizeFieldId(fieldId) {
  return FIELD_ID_MAP[fieldId] || fieldId
}

function normalizeFieldList(value) {
  if (!Array.isArray(value)) return []
  return Array.from(new Set(value.filter(Boolean).map(normalizeFieldId)))
}

function normalizeFieldConfig(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null

  const normalized = {}
  for (const [rawKey, rawValue] of Object.entries(value)) {
    const key = FIELD_CONFIG_KEY_MAP[rawKey] || rawKey
    normalized[key] = key === 'hidden_fields' || key === 'editable_fields'
      ? normalizeFieldList(rawValue)
      : rawValue
  }
  return normalized
}

module.exports = {
  FIELD_CONFIG_KEY_MAP,
  FIELD_ID_MAP,
  normalizeFieldConfig
}
