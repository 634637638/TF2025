'use strict'

const fs = require('node:fs')
const path = require('node:path')

const LOG_DIR = path.resolve(__dirname, '../logs')
const LOG_NAME_PATTERN = /^combined-(\d{4}-\d{2}-\d{2})\.log$/
const TEST_MIGRATION_IDS = new Set(['example-migration', 'brand-models-migration'])

const parseDeprecatedLogLine = line => {
  let entry
  try {
    entry = JSON.parse(line)
  } catch {
    return null
  }

  if (entry.level !== 'warn' || typeof entry.message !== 'string') return null
  const marker = '兼容接口仍被调用'
  const markerIndex = entry.message.indexOf(marker)
  if (markerIndex < 0) return null

  const objectStart = entry.message.indexOf('{', markerIndex + marker.length)
  if (objectStart < 0) return null

  try {
    const details = JSON.parse(entry.message.slice(objectStart))
    if (typeof details.migration_id !== 'string' || TEST_MIGRATION_IDS.has(details.migration_id)) return null
    return { migration_id: details.migration_id }
  } catch {
    return null
  }
}

const summarizeLogFiles = files => {
  const counts = new Map()
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
      if (!event) continue
      matchedLines += 1
      counts.set(event.migration_id, (counts.get(event.migration_id) || 0) + 1)
    }
  }

  const sortedDates = dates.sort()
  return {
    from: sortedDates[0] || null,
    through: sortedDates[sortedDates.length - 1] || null,
    scannedLines,
    matchedLines,
    counts: [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]))
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
  console.log('注意：无访问记录不等于可以删除；需覆盖完整发布观察期，且 combined 日志默认仅保留 14 天。')
}

if (require.main === module) run()

module.exports = { parseDeprecatedLogLine, summarizeLogFiles }
