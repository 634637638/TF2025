'use strict'

const SENSITIVE_KEY_PATTERN = /token|authorization|password|secret|cookie|session(?:id)?|id_?card|private_?key|payment_?secret|api_?key/i
const SENSITIVE_VALUE_PATTERN = /(bearer\s+)[\w.-]+|([?&](?:token|access_token|refresh_token|signature|download_token|file_token|password|secret|api_key|private_key|payment_secret)=)[^&\s]+/gi
const SENSITIVE_QUERY_KEYS = new Set([
  'token', 'access_token', 'refresh_token', 'signature', 'download_token',
  'file_token', 'password', 'secret', 'api_key', 'private_key', 'payment_secret'
])

const truncate = (value, maxLength = 32_000) => String(value ?? '').slice(0, maxLength)

const redactString = (value, maxLength = 32_000) => truncate(value, maxLength).replace(
  SENSITIVE_VALUE_PATTERN,
  (_match, bearerPrefix, queryPrefix) => `${bearerPrefix || queryPrefix || ''}[REDACTED]`
)

const redactValue = (value, depth = 0) => {
  if (depth > 5) return '[TRUNCATED]'
  if (value instanceof Error) {
    return {
      name: value.name,
      message: redactString(value.message, 2000),
      code: value.code,
      stack: value.stack ? redactString(value.stack, 16_000) : undefined
    }
  }
  if (typeof value === 'string') return redactString(value)
  if (Array.isArray(value)) return value.slice(0, 100).map(item => redactValue(item, depth + 1))
  if (!value || typeof value !== 'object') return value

  return Object.fromEntries(Object.entries(value).slice(0, 100).map(([key, entry]) => [
    key,
    SENSITIVE_KEY_PATTERN.test(key) ? '[REDACTED]' : redactValue(entry, depth + 1)
  ]))
}

const redactUrl = (requestUrl = '') => {
  try {
    const url = new URL(requestUrl, 'http://localhost')
    for (const key of [...url.searchParams.keys()]) {
      if (SENSITIVE_QUERY_KEYS.has(key.toLowerCase())) {
        url.searchParams.set(key, '[REDACTED]')
      }
    }
    return `${url.pathname}${url.search}`
  } catch {
    return redactString(requestUrl, 4096)
  }
}

const serializeRedactedJson = (value, maxLength = 32_000) => {
  if (value === undefined || value === null) return null
  const serialized = JSON.stringify(redactValue(value))
  return serialized.length <= maxLength
    ? serialized
    : JSON.stringify({ truncated: true, preview: serialized.slice(0, maxLength) })
}

const summarizeSqlParams = params => {
  const values = Array.isArray(params) ? params : []
  return {
    count: values.length,
    types: values.slice(0, 50).map(value => value === null ? 'null' : typeof value)
  }
}

module.exports = {
  SENSITIVE_KEY_PATTERN,
  redactString,
  redactValue,
  redactUrl,
  serializeRedactedJson,
  summarizeSqlParams
}
