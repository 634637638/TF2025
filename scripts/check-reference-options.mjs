import fs from 'node:fs'
import path from 'node:path'

const projectRoot = path.resolve(new URL('..', import.meta.url).pathname)
const sourceRoots = [
  path.join(projectRoot, 'backend', 'src'),
  path.join(projectRoot, 'frontend', 'src')
]
const allowlistPath = path.join(projectRoot, 'config', 'reference-options-audit-allowlist.json')
const referenceNames = /(brand|model|color|memory|supplier|store|reference-options|query[\/_-]?options)/i
const suspiciousPatterns = [
  { label: '固定 SQL LIMIT', regex: /\bLIMIT\s+(50|100|200|500)\b/gi },
  { label: '固定 page_size', regex: /\bpage_size\s*[:=]\s*(50|100|200|500)\b/gi },
  { label: '前端固定 slice', regex: /\.slice\(\s*0\s*,\s*(50|100|200|500)\s*\)/g }
]

function collectFiles(root) {
  if (!fs.existsSync(root)) return []
  const result = []
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const absolutePath = path.join(root, entry.name)
    if (entry.isDirectory()) result.push(...collectFiles(absolutePath))
    else if (/\.(js|mjs|ts|vue)$/.test(entry.name)) result.push(absolutePath)
  }
  return result
}

const findings = []
for (const file of sourceRoots.flatMap(collectFiles)) {
  const source = fs.readFileSync(file, 'utf8')
  const lines = source.split(/\r?\n/)
  for (const pattern of suspiciousPatterns) {
    for (const match of source.matchAll(pattern.regex)) {
      const lineNumber = source.slice(0, match.index).split(/\r?\n/).length
      const line = lines[lineNumber - 1] || ''
      const context = source.slice(Math.max(0, match.index - 180), match.index + 180)
      if (!referenceNames.test(file) && !referenceNames.test(context)) continue
      findings.push({
        file: path.relative(projectRoot, file),
        line: lineNumber,
        label: pattern.label,
        text: line.trim()
      })
    }
  }
}

const allowlist = fs.existsSync(allowlistPath)
  ? JSON.parse(fs.readFileSync(allowlistPath, 'utf8'))
  : { entries: [] }
const allowlistEntries = Array.isArray(allowlist.entries) ? allowlist.entries : []
const matchesAllowlist = (finding, entry) => (
  finding.file === entry.file &&
  finding.line === entry.line &&
  finding.label === entry.label &&
  finding.text.includes(entry.text)
)
const allowedFindings = findings.filter(finding => allowlistEntries.some(entry => matchesAllowlist(finding, entry)))
const unresolvedFindings = findings.filter(finding => !allowlistEntries.some(entry => matchesAllowlist(finding, entry)))
const staleAllowlistEntries = allowlistEntries.filter(entry => !findings.some(finding => matchesAllowlist(finding, entry)))

if (allowedFindings.length > 0) {
  console.log(`公共选项固定数量审计：${allowedFindings.length} 处已按白名单人工确认（业务分页、字段长度或本地历史保护）。`)
}
if (unresolvedFindings.length > 0) {
  console.log(`公共选项固定数量审计发现 ${unresolvedFindings.length} 处未登记疑似项：`)
  for (const finding of unresolvedFindings) {
    console.log(`- ${finding.file}:${finding.line} ${finding.label}: ${finding.text}`)
  }
}
if (staleAllowlistEntries.length > 0) {
  console.log(`公共选项审计白名单存在 ${staleAllowlistEntries.length} 处漂移项（源码已变化，需要重新确认）：`)
  for (const entry of staleAllowlistEntries) {
    console.log(`- ${entry.file}:${entry.line} ${entry.label}: ${entry.text}`)
  }
}
if (unresolvedFindings.length === 0 && staleAllowlistEntries.length === 0) {
  console.log('公共选项固定数量审计通过：所有候选项均已人工确认或已移除。')
}

if (process.argv.includes('--strict') && (unresolvedFindings.length > 0 || staleAllowlistEntries.length > 0)) process.exitCode = 1
