import fs from 'node:fs'
import path from 'node:path'

const frontendRoot = path.resolve(import.meta.dirname, '..')
const sourceRoot = path.join(frontendRoot, 'src')
const baselinePath = path.join(import.meta.dirname, 'responsive-breakpoint-baseline.json')
const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'))
const canonical = new Set(baseline.canonicalValues)
const findings = []
const counts = new Map()

function walk(directory, files = []) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const filePath = path.join(directory, entry.name)
    if (entry.isDirectory()) walk(filePath, files)
    else if (/\.(?:vue|scss|css)$/.test(entry.name)) files.push(filePath)
  }
  return files
}

function collect(source) {
  for (const media of source.matchAll(/@media[^{}]*\{/gi)) {
    const prelude = media[0]
    for (const match of prelude.matchAll(/(?:min|max)-width\s*:\s*(\d+)px/gi)) {
      const value = Number(match[1])
      counts.set(value, (counts.get(value) || 0) + 1)
    }
  }
}

for (const filePath of walk(sourceRoot)) collect(fs.readFileSync(filePath, 'utf8'))

let legacyQueries = 0
for (const [value, count] of [...counts.entries()].sort((left, right) => left[0] - right[0])) {
  if (canonical.has(value)) continue
  legacyQueries += count
  const baselineCount = Number(baseline.legacyValues[String(value)] || 0)
  if (baselineCount === 0) {
    findings.push(`新增未登记响应式断点 ${value}px，共 ${count} 处`)
  } else if (count > baselineCount) {
    findings.push(`历史响应式断点 ${value}px 从 ${baselineCount} 处增加到 ${count} 处`)
  }
}

const breakpointSource = fs.readFileSync(path.join(sourceRoot, 'config', 'breakpoints.ts'), 'utf8')
const expectedConfig = {
  MIN: 375,
  SMALL_MOBILE_MAX: 479,
  MOBILE_MAX: 767,
  TABLET_MIN: 768,
  TABLET_MAX: 1024,
  DESKTOP_MIN: 1025,
  WIDE_MIN: 1200,
  ULTRA_WIDE_MIN: 1440
}
for (const [name, value] of Object.entries(expectedConfig)) {
  const pattern = new RegExp(`${name}\\s*:\\s*${value}\\b`)
  if (!pattern.test(breakpointSource)) findings.push(`breakpoints.ts 的 ${name} 必须保持 ${value}px`)
}

if (legacyQueries > baseline.maxLegacyQueries) {
  findings.push(`历史响应式断点总数 ${legacyQueries} > 基线 ${baseline.maxLegacyQueries}`)
}

if (findings.length) {
  console.error(`响应式断点审计失败，共 ${findings.length} 处：`)
  for (const finding of findings) console.error(`- ${finding}`)
  process.exit(1)
}

console.log(`响应式断点审计通过：规范断点 ${[...canonical].join('/')}px；历史断点 ${legacyQueries} 处，未新增断点。`)
