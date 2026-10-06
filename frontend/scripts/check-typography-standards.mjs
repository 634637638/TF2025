import fs from 'node:fs'
import path from 'node:path'

const frontendRoot = path.resolve(import.meta.dirname, '..')
const sourceRoot = path.join(frontendRoot, 'src')
const variablesPath = path.join(sourceRoot, 'styles/_variables.scss')
const findings = []

const requiredTokens = [
  '--tf-font-page-title', '--tf-font-section-title', '--tf-font-dialog-title',
  '--tf-font-body', '--tf-font-body-lg', '--tf-font-label', '--tf-font-caption',
  '--tf-font-small', '--tf-font-micro',
  '--tf-font-button', '--tf-font-table-header', '--tf-font-table-body',
  '--tf-font-table-compact', '--tf-font-table-narrow', '--tf-font-stat-value',
  '--tf-font-stat-label', '--tf-font-family-sans', '--tf-line-height-body',
  '--tf-line-height-compact'
]

function collectFiles(directory, files = []) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const filePath = path.join(directory, entry.name)
    if (entry.isDirectory()) collectFiles(filePath, files)
    else if (/\.(?:vue|css|scss)$/.test(entry.name)) files.push(filePath)
  }
  return files
}

function styleSources(filePath, source) {
  if (!filePath.endsWith('.vue')) return [source]
  const blocks = [...source.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map(match => match[1])
  for (const match of source.matchAll(/\bstyle=["']([^"']*)["']/gi)) blocks.push(match[1])
  return blocks
}

const variables = fs.readFileSync(variablesPath, 'utf8')
for (const token of requiredTokens) {
  if (!new RegExp(`${token}\\s*:`).test(variables)) {
    findings.push(`缺少公共文字令牌 ${token}`)
  }
}

const scanned = []
for (const filePath of collectFiles(sourceRoot)) {
  if (filePath === variablesPath) continue
  const source = fs.readFileSync(filePath, 'utf8')
  const relativePath = path.relative(frontendRoot, filePath).split(path.sep).join('/')
  let directCount = 0
  let fallbackCount = 0

  for (const block of styleSources(filePath, source)) {
    const css = block.replace(/\/\*[\s\S]*?\*\//g, '')
    for (const match of css.matchAll(/font-size\s*:\s*([^;{}]+)/gi)) {
      const value = match[1].trim()
      if (/^(?:var\([^)]*\)|inherit|initial|unset|revert|revert-layer)$/i.test(value)) {
        if (/var\([^)]*,\s*(?:-?(?:\d+\.?\d*|\.\d+)(?:px|rem|em|vw|vh|vmin|vmax)|clamp\()/i.test(value)) fallbackCount += 1
        continue
      }
      if (/(?:px|rem|em|vw|vh|vmin|vmax)\b/i.test(value)) directCount += 1
    }
  }

  if (directCount || fallbackCount) {
    scanned.push({ file: relativePath, directCount, fallbackCount })
    if (directCount) findings.push(`${relativePath} 存在 ${directCount} 处直接字号，请改用 --tf-font-* 或 --tf-type-scale-*`)
    if (fallbackCount) findings.push(`${relativePath} 存在 ${fallbackCount} 处带硬编码字号 fallback，请改用公共文字令牌`)
  }
}

if (findings.length) {
  console.error(`全局文字规范审计失败，共 ${findings.length} 处：`)
  for (const finding of findings) console.error(`- ${finding}`)
  process.exit(1)
}

const viewCount = collectFiles(path.join(sourceRoot, 'views')).filter(file => file.endsWith('.vue')).length
const componentCount = collectFiles(path.join(sourceRoot, 'components')).filter(file => file.endsWith('.vue')).length
console.log(`全局文字规范审计通过：${requiredTokens.length} 个公共令牌已定义；已扫描 ${viewCount} 个页面单元、${componentCount} 个公共组件；未发现页面私有字号或硬编码 fallback。`)
