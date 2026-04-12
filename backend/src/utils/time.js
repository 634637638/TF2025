/**
 * Time utilities
 * - Normalize date inputs to Beijing datetime string: YYYY-MM-DD HH:mm:ss
 */

const BEIJING_OFFSET_HOURS = 8;

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;
const DATETIME_RE = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;
const DATETIME_NO_SECONDS_RE = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/;
const ISO_LOCAL_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/;
const ISO_TZ_RE = /[zZ]$|[+-]\d{2}:\d{2}$/;

function formatBeijingDateTime(date) {
  const utcMs = date.getTime() + date.getTimezoneOffset() * 60 * 1000;
  const beijingMs = utcMs + BEIJING_OFFSET_HOURS * 60 * 60 * 1000;
  return new Date(beijingMs).toISOString().slice(0, 19).replace('T', ' ');
}

function getBeijingTimeString() {
  return formatBeijingDateTime(new Date());
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
    return defaultToNow ? getBeijingTimeString() : null;
  }

  if (input instanceof Date) {
    return formatBeijingDateTime(input);
  }

  if (typeof input === 'number') {
    return formatBeijingDateTime(new Date(input));
  }

  if (typeof input === 'string') {
    const trimmed = input.trim();
    if (!trimmed) {
      return defaultToNow ? getBeijingTimeString() : null;
    }

    if (DATE_ONLY_RE.test(trimmed)) {
      return `${trimmed} 00:00:00`;
    }
    if (DATETIME_RE.test(trimmed)) {
      return trimmed;
    }
    if (DATETIME_NO_SECONDS_RE.test(trimmed)) {
      return `${trimmed}:00`;
    }
    if (ISO_LOCAL_RE.test(trimmed)) {
      const withSpace = trimmed.replace('T', ' ');
      return withSpace.length === 16 ? `${withSpace}:00` : withSpace;
    }

    // ISO with timezone or other parseable formats
    if (ISO_TZ_RE.test(trimmed)) {
      const parsed = new Date(trimmed);
      if (!isNaN(parsed.getTime())) {
        return formatBeijingDateTime(parsed);
      }
    }

    const parsed = new Date(trimmed);
    if (!isNaN(parsed.getTime())) {
      return formatBeijingDateTime(parsed);
    }
  }

  return defaultToNow ? getBeijingTimeString() : null;
}

module.exports = {
  getBeijingTimeString,
  normalizeDateTime
};
