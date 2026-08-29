/**
 * Time utilities
 * - Normalize date inputs to Beijing datetime string: YYYY-MM-DD HH:mm:ss
 */

const BEIJING_OFFSET_HOURS = 8

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/
const DATETIME_RE = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/
const DATETIME_NO_SECONDS_RE = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/
const ISO_LOCAL_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/
const ISO_TZ_RE = /[zZ]$|[+-]\d{2}:\d{2}$/

function pad2(value) {
  return String(value).padStart(2, '0')
}

function formatBeijingDateTime(date) {
  const utcMs = date.getTime() + date.getTimezoneOffset() * 60 * 1000
  const beijingMs = utcMs + BEIJING_OFFSET_HOURS * 60 * 60 * 1000
  return new Date(beijingMs).toISOString().slice(0, 19).replace('T', ' ')
}

function getBeijingTimeString() {
  return formatBeijingDateTime(new Date())
}

function parseLocalDate(input) {
  if (input instanceof Date) {
    return new Date(input.getFullYear(), input.getMonth(), input.getDate())
  }

  if (typeof input === 'string') {
    const match = input.trim().match(/^(\d{4})-(\d{2})-(\d{2})/)
    if (match) {
      return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
    }
  }

  const parsed = new Date(input)
  if (isNaN(parsed.getTime())) {
    return null
  }

  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate())
}

function formatLocalDate(input) {
  if (typeof input === 'string') {
    const match = input.trim().match(/^(\d{4}-\d{2}-\d{2})/)
    if (match) {
      return match[1]
    }
  }

  const date = input instanceof Date ? input : new Date(input)
  if (isNaN(date.getTime())) {
    return ''
  }

  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
}

function addDaysToDateKey(input, days) {
  const date = parseLocalDate(input)
  if (!date) {
    return ''
  }

  date.setDate(date.getDate() + days)
  return formatLocalDate(date)
}

function getMonthDateRange(input) {
  const date = parseLocalDate(input)
  if (!date) {
    return null
  }

  const start = new Date(date.getFullYear(), date.getMonth(), 1)
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0)

  return {
    period_start: formatLocalDate(start),
    period_end: formatLocalDate(end)
  }
}

function getTimeMinutes(input) {
  if (input === undefined || input === null || input === '') {
    return null
  }

  if (input instanceof Date) {
    return input.getHours() * 60 + input.getMinutes()
  }

  if (typeof input === 'string') {
    const match = input.trim().match(/(?:^|\s|T)(\d{2}):(\d{2})(?::\d{2})?/)
    if (match) {
      return Number(match[1]) * 60 + Number(match[2])
    }
  }

  const parsed = new Date(input)
  if (isNaN(parsed.getTime())) {
    return null
  }

  return parsed.getHours() * 60 + parsed.getMinutes()
}

/**
 * Normalize date input to Beijing datetime string.
 * Accepts:
 * - YYYY-MM-DD
 * - YYYY-MM-DD HH:mm[:ss]
 * - YYYY-MM-DDTHH:mm[:ss]
 * - ISO with timezone (Z / +08:00)
 * - Date / timestamp
 */
function normalizeDateTime(input, defaultToNow = true) {
  if (input === undefined || input === null || input === '') {
    return defaultToNow ? getBeijingTimeString() : null
  }

  if (input instanceof Date) {
    return formatBeijingDateTime(input)
  }

  if (typeof input === 'number') {
    return formatBeijingDateTime(new Date(input))
  }

  if (typeof input === 'string') {
    const trimmed = input.trim()
    if (!trimmed) {
      return defaultToNow ? getBeijingTimeString() : null
    }

    if (DATE_ONLY_RE.test(trimmed)) {
      return `${trimmed} 00:00:00`
    }
    if (DATETIME_RE.test(trimmed)) {
      return trimmed
    }
    if (DATETIME_NO_SECONDS_RE.test(trimmed)) {
      return `${trimmed}:00`
    }
    if (ISO_LOCAL_RE.test(trimmed)) {
      const withSpace = trimmed.replace('T', ' ')
      return withSpace.length === 16 ? `${withSpace}:00` : withSpace
    }

    // ISO with timezone or other parseable formats
    if (ISO_TZ_RE.test(trimmed)) {
      const parsed = new Date(trimmed)
      if (!isNaN(parsed.getTime())) {
        return formatBeijingDateTime(parsed)
      }
    }

    const parsed = new Date(trimmed)
    if (!isNaN(parsed.getTime())) {
      return formatBeijingDateTime(parsed)
    }
  }

  return defaultToNow ? getBeijingTimeString() : null
}

module.exports = {
  getBeijingTimeString,
  normalizeDateTime,
  parseLocalDate,
  formatLocalDate,
  addDaysToDateKey,
  getMonthDateRange,
  getTimeMinutes
}
