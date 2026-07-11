const TRUE_VALUES = new Set(['1', 'true', 'active', 'enabled', 'enable', 'yes', 'on'])
const FALSE_VALUES = new Set(['0', 'false', 'inactive', 'disabled', 'disable', 'no', 'off'])

const parseStatusFilter = (value) => {
  if (value === undefined || value === null || value === '') {
    return null
  }

  if (typeof value === 'boolean') {
    return value ? 1 : 0
  }

  if (typeof value === 'number') {
    return Number(value) === 1 ? 1 : 0
  }

  const normalized = String(value).trim().toLowerCase()
  if (TRUE_VALUES.has(normalized)) {
    return 1
  }

  if (FALSE_VALUES.has(normalized)) {
    return 0
  }

  const parsed = Number(normalized)
  return Number.isFinite(parsed) && parsed === 1 ? 1 : 0
}

const parseBooleanFilter = (value) => {
  const parsed = parseStatusFilter(value)
  return parsed === null ? null : parsed === 1
}

module.exports = {
  parseStatusFilter,
  parseBooleanFilter
}
