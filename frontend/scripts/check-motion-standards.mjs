import fs from 'node:fs'
import path from 'node:path'

const frontendRoot = path.resolve(import.meta.dirname, '..')
const sourceRoot = path.join(frontendRoot, 'src')
const variablesPath = path.join(sourceRoot, 'styles/_variables.scss')
const baselinePath = path.join(import.meta.dirname, 'motion-adoption-baseline.json')
const requiredTokens = [
  '--tf-motion-fast', '--tf-motion-standard', '--tf-motion-enter', '--tf-motion-slow',
  '--tf-motion-ease-standard', '--tf-motion-ease-emphasized'
]
const requiredReferences = [
  'src/styles/components/_dialog.scss',
  'src/components/MobileDialog.vue',
  'src/components/NotificationContainer.vue'
]
const findings = []

function collectFiles(directory, files = []) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const filePath = path.join(directory, entry.name)
    if (entry.isDirectory()) collectFiles(filePath, files)
    else if (/\.(?:vue|css|scss)$/.test(entry.name)) files.push(filePath)
  }
  return files
}

function getStyleSources(filePath, source) {
  if (!filePath.endsWith('.vue')) return [source]
  return [...source.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map(match => match[1])
}

const variables = fs.readFileSync(variablesPath, 'utf8')
for (const token of requiredTokens) {
  if (!new RegExp(`${token}\\s*:`).test(variables)) findings.push(`_variables.scss 缺少公共动效令牌 ${token}`)
}

const responsiveStyles = fs.readFileSync(path.join(sourceRoot, 'styles/responsive.scss'), 'utf8')
if (!/@media\s*\(prefers-reduced-motion:\s*reduce\)/.test(responsiveStyles)) {
  findings.push('responsive.scss 缺少 prefers-reduced-motion 全局降动画规则')
}

for (const relativeFile of requiredReferences) {
  const source = fs.readFileSync(path.join(sourceRoot, relativeFile.replace(/^src\//, '')), 'utf8')
  if (!source.includes('var(--tf-motion-')) findings.push(`${relativeFile} 未读取公共动效令牌`)
}

const counts = {}
for (const filePath of collectFiles(sourceRoot)) {
  const source = fs.readFileSync(filePath, 'utf8')
  const relativeFile = path.relative(frontendRoot, filePath).split(path.sep).join('/')
  let count = 0

  for (const style of getStyleSources(filePath, source)) {
    const css = style.replace(/\/\*[\s\S]*?\*\//g, '')
    const declarations = /\b(?:transition(?:-duration|-delay)?|animation(?:-duration|-delay)?)\s*:\s*([^;{}]+)/gi
    for (const match of css.matchAll(declarations)) {
      const value = match[1].replace(/var\([^)]*\)/g, '')
      if (/\b\d*\.?\d+\s*(?:ms|s)\b/i.test(value)) count += 1
    }
  }

  if (count) counts[relativeFile] = count
}

if (process.argv.includes('--write-baseline')) {
  fs.writeFileSync(baselinePath, `${JSON.stringify({ version: 1, files: counts }, null, 2)}\n`)
  console.log(`动效硬编码基线已写入：${Object.keys(counts).length} 个文件`)
  process.exit(0)
}

if (!fs.existsSync(baselinePath)) {
  console.error('缺少 motion-adoption-baseline.json，请先审核并登记现有动效债务。')
  process.exit(1)
}

const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'))
for (const [file, count] of Object.entries(counts)) {
  const allowed = baseline.files?.[file] || 0
  if (count > allowed) findings.push(`${file} 新增硬编码动效 ${count - allowed} 处，请使用公共动效令牌`)
}

if (findings.length) {
  console.error(`动效规范审计失败，共 ${findings.length} 项：`)
  for (const finding of findings) console.error(`- ${finding}`)
  process.exit(1)
}

const legacyCount = Object.values(counts).reduce((total, count) => total + count, 0)
const baselineCount = Object.values(baseline.files || {}).reduce((total, count) => total + count, 0)
const movement = legacyCount < baselineCount
  ? `较登记快照减少 ${baselineCount - legacyCount} 处`
  : legacyCount > baselineCount
    ? `较登记快照增加 ${legacyCount - baselineCount} 处`
    : '与登记快照持平'
console.log(`动效规范审计通过：公共令牌和减少动态偏好已接入；历史硬编码动效 ${legacyCount} 处（${movement}），仅禁止新增。`)
