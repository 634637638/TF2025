'use strict'

const fs = require('node:fs')
const path = require('node:path')

const LOG_DIR = path.resolve(__dirname, '../logs')
const LOG_NAME_PATTERN = /^combined-(\d{4}-\d{2}-\d{2})\.log$/
const TEST_MIGRATION_IDS = new Set(['example-migration', 'brand-models-migration'])
const TEST_COMPATIBILITY_IDS = new Set(['example-compatibility'])

const parseAuditLogLine = (line, { level, marker, idField, excludedIds }) => {
  let entry
  try {
    entry = JSON.parse(line)
  } catch {
    return null
  }

  if (entry.level !== level || typeof entry.message !== 'string') return null
  const markerIndex = entry.message.indexOf(marker)
  if (markerIndex < 0) return null

  const objectStart = entry.message.indexOf('{', markerIndex + marker.length)
  if (objectStart < 0) return null

  try {
    const details = JSON.parse(entry.message.slice(objectStart))
    const id = details[idField]
    if (typeof id !== 'string' || excludedIds.has(id)) return null
    return { [idField]: id }
  } catch {
    return null
  }
}

const parseDeprecatedLogLine = line => parseAuditLogLine(line, {
  level: 'warn',
  marker: '兼容接口仍被调用',
  idField: 'migration_id',
  excludedIds: TEST_MIGRATION_IDS
})

const parseCompatibilityLogLine = line => parseAuditLogLine(line, {
  level: 'info',
  marker: '兼容接口访问',
  idField: 'compatibility_id',
  excludedIds: TEST_COMPATIBILITY_IDS
})

const summarizeLogFiles = files => {
  const counts = new Map()
  const compatibilityCounts = new Map()
  let scannedLines = 0
  let matchedLines = 0
  const dates = []

  for (const file of files) {
    const dateMatch = path.basename(file).match(LOG_NAME_PATTERN)
    if (dateMatch) dates.push(dateMatch[1])

    let contents
    try {
      contents = fs.readFileSync(file, 'utf8')
    } catch {
      continue
    }

    for (const line of contents.split(/\r?\n/)) {
      if (!line) continue
      scannedLines += 1
      const event = parseDeprecatedLogLine(line)
      if (event) {
        matchedLines += 1
        counts.set(event.migration_id, (counts.get(event.migration_id) || 0) + 1)
        continue
      }
      const compatibilityEvent = parseCompatibilityLogLine(line)
      if (!compatibilityEvent) continue
      compatibilityCounts.set(compatibilityEvent.compatibility_id, (compatibilityCounts.get(compatibilityEvent.compatibility_id) || 0) + 1)
    }
  }

  const sortedDates = dates.sort()
  return {
    from: sortedDates[0] || null,
    through: sortedDates[sortedDates.length - 1] || null,
    scannedLines,
    matchedLines,
    counts: [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0])),
    compatibilityCounts: [...compatibilityCounts.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }
}

const run = () => {
  const files = fs.existsSync(LOG_DIR)
    ? fs.readdirSync(LOG_DIR)
      .filter(name => LOG_NAME_PATTERN.test(name))
      .map(name => path.join(LOG_DIR, name))
      .sort()
    : []

  if (files.length === 0) {
    console.error(`未找到 ${LOG_DIR} 下的 combined-YYYY-MM-DD.log 日志`)
    process.exitCode = 1
    return
  }

  const summary = summarizeLogFiles(files)
  console.log(`弃用接口日志范围：${summary.from} 至 ${summary.through}（${files.length} 个 combined 日志文件）`)
  console.log(`扫描 ${summary.scannedLines} 行，识别弃用访问 ${summary.matchedLines} 次`)
  for (const [migrationId, count] of summary.counts) {
    console.log(`${migrationId}\t${count}`)
  }
  const compatibilityTotal = summary.compatibilityCounts.reduce((total, [, count]) => total + count, 0)
  console.log(`兼容接口访问 ${compatibilityTotal} 次`)
  for (const [compatibilityId, count] of summary.compatibilityCounts) {
    console.log(`${compatibilityId}\t${count}`)
  }
  console.log('注意：无访问记录不等于可以删除；需覆盖完整发布观察期，且 combined 日志默认仅保留 14 天。')
}

if (require.main === module) run()

module.exports = { parseDeprecatedLogLine, parseCompatibilityLogLine, summarizeLogFiles }
