'use strict'

function normalizeDatabaseIdentifier(value, label = '标识符') {
  const normalized = String(value || '').trim()
  if (!/^[A-Za-z_][A-Za-z0-9_$]{0,63}$/.test(normalized)) {
    throw Object.assign(new Error(`${label}不合法`), { statusCode: 400 })
  }
  return normalized
}

module.exports = { normalizeDatabaseIdentifier }
