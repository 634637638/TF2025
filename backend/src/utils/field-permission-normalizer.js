function normalizeFieldList(value) {
  if (!Array.isArray(value)) {
    return []
  }

  return Array.from(new Set(value.filter(Boolean)))
}

function normalizeFieldConfig(value, { strict = false } = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }

  const normalized = {}
  for (const [key, rawValue] of Object.entries(value)) {
    if (!/^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/.test(key)) {
      return null
    }
    if (key === 'scopes') {
      if (!rawValue || typeof rawValue !== 'object' || Array.isArray(rawValue) ||
        Object.keys(rawValue).some(scope => scope !== 'goods')) return null
      normalized.scopes = {}
      for (const [scope, config] of Object.entries(rawValue)) {
        if (config && Object.hasOwn(config, 'scopes')) return null
        const scoped = normalizeFieldConfig(config, { strict: true })
        if (!scoped) return null
        normalized.scopes[scope] = scoped
      }
    } else if (key === 'hidden_fields' || key === 'editable_fields' || key === 'readonly_fields') {
      if ((strict || key === 'readonly_fields') && (!Array.isArray(rawValue) || rawValue.some(field =>
        typeof field !== 'string' || !field.trim() || field !== field.trim()))) {
        return null
      }
      normalized[key] = normalizeFieldList(rawValue)
    } else {
      normalized[key] = rawValue
    }
  }

  return normalized
}

/** 聚合 JSON 与现存单字段列共用解析；只有 SQL NULL 可使用单字段列，JSON null 仍属无效配置。 */
function normalizeStoredFieldConfig(row, options = {}) {
  const sqlNull = row.field_config_is_null === 1 || row.field_config_is_null === '1'
  if (row.field_config !== null || !sqlNull) {
    let value
    try {
      value = typeof row.field_config === 'string' ? JSON.parse(row.field_config) : row.field_config
    } catch {
      throw new Error('字段权限配置无效')
    }
    const config = normalizeFieldConfig(value, options)
    return config ? { config, readonlyFields: config.readonly_fields || [], hasEditableScope: Object.hasOwn(config, 'editable_fields') } : null
  }

  const field = row.field_key
  const flag = value => value === 0 || value === '0' ? false : value === 1 || value === '1' ? true : null
  const visible = flag(row.can_view), editable = flag(row.can_edit), hidden = flag(row.is_hidden)
  if (typeof field !== 'string' || !field.trim() || field !== field.trim() ||
    visible === null || editable === null || hidden === null ||
    !['FULL', 'PARTIAL', 'READ_ONLY', 'HIDDEN'].includes(row.permission_level)) return null

  const isHidden = !visible || hidden || row.permission_level === 'HIDDEN'
  const isReadonly = !editable || row.permission_level === 'READ_ONLY'
  return {
    config: { hidden_fields: isHidden ? [field] : [], editable_fields: !isHidden && !isReadonly ? [field] : [] },
    readonlyFields: isReadonly ? [field] : []
  }
}

/** 商品查询字段属于综合查询；每个角色未单独保存时继续使用原配件限制。 */
function resolveQueryGoodsFieldConfigs(rows) {
  const roles = new Map()
  for (const row of rows) {
    if (!['query_queryview', 'accessories_accessoriesview'].includes(row.module_key)) continue
    if (!roles.has(row.role_id)) roles.set(row.role_id, { query: [], legacy: [] })
    roles.get(row.role_id)[row.module_key === 'query_queryview' ? 'query' : 'legacy'].push(row)
  }
  const result = []
  const parse = row => {
    const normalized = normalizeStoredFieldConfig(row, { strict: true })
    if (!normalized) throw new Error('字段权限配置无效')
    return normalized
  }
  for (const [roleId, { query, legacy }] of roles) {
    const configured = query.map(parse).filter(item => Object.hasOwn(item.config.scopes || {}, 'goods'))
    const configs = configured.length ? configured.map(item => ({
      config: item.config.scopes.goods, readonlyFields: item.config.scopes.goods.readonly_fields || [],
      hasEditableScope: Object.hasOwn(item.config.scopes.goods, 'editable_fields')
    })) : legacy.map(parse)
    for (const normalized of configs) result.push({ role_id: roleId, normalized })
  }
  return result
}

module.exports = {
  normalizeFieldConfig,
  normalizeFieldList,
  normalizeStoredFieldConfig,
  resolveQueryGoodsFieldConfigs
}
