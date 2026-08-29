function normalizeFieldList(value) {
  if (!Array.isArray(value)) {
    return []
  }

  return Array.from(new Set(value.filter(Boolean)))
}

function normalizeFieldConfig(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }

  const normalized = {}
  for (const [key, rawValue] of Object.entries(value)) {
    if (!/^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/.test(key)) {
      return null
    }
    if (key === 'hidden_fields' || key === 'editable_fields') {
      normalized[key] = normalizeFieldList(rawValue)
    } else {
      normalized[key] = rawValue
    }
  }

  return normalized
}

module.exports = {
  normalizeFieldConfig,
  normalizeFieldList
}
