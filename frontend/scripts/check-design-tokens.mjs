import fs from 'node:fs'
import path from 'node:path'

const frontendRoot = path.resolve(import.meta.dirname, '..')
const sourceRoot = path.join(frontendRoot, 'src')
const variablesPath = path.join(sourceRoot, 'styles/_variables.scss')
const baselinePath = path.join(import.meta.dirname, 'design-token-adoption-baseline.json')
const categories = {
  radius: /\bborder(?:-top-left|-top-right|-bottom-left|-bottom-right)?-radius\s*:\s*([^;{}]+)/gi,
  shadow: /\b(?:box|text)-shadow\s*:\s*([^;{}]+)/gi,
  typography: /\bfont-size\s*:\s*([^;{}]+)/gi,
  spacing: /\b(?:padding(?:-(?:top|right|bottom|left|inline|block)(?:-start|-end)?)?|margin(?:-(?:top|right|bottom|left|inline|block)(?:-start|-end)?)?|gap|row-gap|column-gap)\s*:\s*([^;{}]+)/gi,
  layering: /\bz-index\s*:\s*([^;{}]+)/gi
}
const requiredTokens = [
  '--tf-space-1', '--tf-space-2', '--tf-space-3', '--tf-space-4',
  '--tf-space-5', '--tf-space-6', '--tf-space-7', '--tf-space-8',
  '--tf-radius-control', '--tf-radius-card', '--tf-radius-panel',
  '--tf-radius-dialog', '--tf-radius-full', '--tf-shadow-card',
  '--tf-shadow-popover', '--tf-shadow-dialog', '--tf-shadow-floating',
  '--tf-font-caption', '--tf-font-body', '--tf-font-body-lg',
  '--tf-font-section', '--tf-font-title', '--tf-z-sidebar', '--tf-z-dropdown',
  '--tf-z-drawer-overlay', '--tf-z-drawer', '--tf-z-dialog-sheet', '--tf-z-dialog',
  '--tf-z-loading', '--tf-z-toast', '--tf-z-message', '--tf-z-lock', '--tf-z-viewer',
  '--tf-z-message-box', '--tf-z-popper', '--tf-z-permission-tooltip'
]
const requiredPublicReferences = {
  'src/styles/components/_buttons.scss': ['--tf-radius-control', '--tf-font-body', '--tf-space-3', '--tf-space-4'],
  'src/styles/components/_dialog-actions.scss': ['--tf-space-2', '--tf-space-4'],
  'src/styles/components/_dialog.scss': ['--tf-radius-dialog', '--tf-shadow-dialog', '--tf-font-section', '--tf-z-message-box', '--tf-z-popper'],
  'src/styles/components/_tabs.scss': ['--tf-radius-control', '--tf-font-body', '--tf-space-1', '--tf-space-4'],
  'src/styles/components/_pagination.scss': ['--tf-space-1', '--tf-space-2', '--tf-radius-control', '--tf-font-caption'],
  'src/components/ScreenLock.vue': ['--tf-z-lock'],
  'src/components/MobileDialog.vue': ['--tf-z-dialog-sheet'],
  'src/components/ResponsiveMenu.vue': ['--tf-z-drawer'],
  'src/components/mobile/MobileSlideMenu.vue': ['--tf-z-drawer-overlay'],
  'src/components/GlobalLoading.vue': ['--tf-z-loading'],
  'src/components/NotificationContainer.vue': ['--tf-z-toast'],
  'src/components/Toast.vue': ['--tf-z-toast'],
  'src/components/GlobalMessage.vue': ['--tf-z-message'],
  'src/components/MediaPreviewViewer.vue': ['--tf-z-viewer']
}
const findings = []
const variables = fs.readFileSync(variablesPath, 'utf8')

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

function collectLegacyDesignValues() {
  const values = Object.fromEntries(Object.keys(categories).map(category => [category, new Set()]))
  const fileCounts = {}
  const literalPattern = /(?:\d*\.)?\d+(?:px|rem|em|vw|vh|vmin|vmax|%)(?![\w-])/i

  for (const filePath of collectFiles(sourceRoot)) {
    const source = fs.readFileSync(filePath, 'utf8')
    const relativePath = path.relative(frontendRoot, filePath).split(path.sep).join('/')
    const counts = Object.fromEntries(Object.keys(categories).map(category => [category, 0]))

    for (const block of styleSources(filePath, source)) {
      const css = block.replace(/\/\*[\s\S]*?\*\//g, '')
      for (const [category, pattern] of Object.entries(categories)) {
        pattern.lastIndex = 0
        for (const match of css.matchAll(pattern)) {
          const value = match[1].trim().replace(/\s+/g, ' ')
          // A token name such as --tf-type-scale-0-75rem contains a unit-like
          // suffix but does not introduce a new design value. Keep numeric
          // fallbacks visible to the audit while ignoring custom-property names.
          const auditableValue = value.replace(/--[\w-]+/g, '')
          const hasLiteral = category === 'layering'
            ? /^-?\d+$/.test(value)
            : literalPattern.test(auditableValue)
          if (!hasLiteral) continue
          values[category].add(value)
          counts[category] += 1
        }
      }
    }

    if (Object.values(counts).some(count => count > 0)) fileCounts[relativePath] = counts
  }

  return {
    version: 1,
    generatedAt: new Date().toISOString().slice(0, 10),
    values: Object.fromEntries(Object.entries(values).map(([category, entries]) => [category, [...entries].sort()])),
    fileCounts
  }
}

const legacyDesignValues = collectLegacyDesignValues()
if (process.argv.includes('--write-baseline')) {
  fs.writeFileSync(baselinePath, `${JSON.stringify(legacyDesignValues, null, 2)}\n`)
  console.log(`视觉令牌存量基线已更新：${Object.keys(legacyDesignValues.fileCounts).length} 个文件`)
  process.exit(0)
}

if (!fs.existsSync(baselinePath)) {
  console.error('缺少 design-token-adoption-baseline.json，请检查文档和审计配置。')
  process.exit(1)
}

const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'))
for (const [category, values] of Object.entries(legacyDesignValues.values)) {
  const allowed = new Set(baseline.values?.[category] || [])
  for (const value of values) {
    if (!allowed.has(value)) findings.push(`${category} 新增硬编码设计值 "${value}"，请使用公共 CSS 令牌`)
  }
}

for (const [file, counts] of Object.entries(legacyDesignValues.fileCounts)) {
  const previous = baseline.fileCounts?.[file] || {}
  for (const [category, count] of Object.entries(counts)) {
    const max = previous[category] || 0
    if (count > max) findings.push(`${file} 的 ${category} 硬编码值从 ${max} 处增加到 ${count} 处，请改用令牌或减少存量`)
  }
}

for (const token of requiredTokens) {
  if (!new RegExp(`${token}\\s*:`).test(variables)) {
    findings.push(`_variables.scss 缺少公共令牌 ${token}`)
  }
}

for (const [relativePath, tokens] of Object.entries(requiredPublicReferences)) {
  const source = fs.readFileSync(path.join(frontendRoot, relativePath), 'utf8')
  for (const token of tokens) {
    if (!source.includes(`var(${token}`)) {
      findings.push(`${relativePath} 未使用公共令牌 ${token}`)
    }
  }
}

if (findings.length) {
  console.error(`视觉令牌审计失败，共 ${findings.length} 处：`)
  for (const finding of findings) console.error(`- ${finding}`)
  process.exit(1)
}

const legacyCounts = Object.values(legacyDesignValues.fileCounts).reduce((totals, file) => {
  for (const [category, count] of Object.entries(file)) totals[category] += count
  return totals
}, Object.fromEntries(Object.keys(categories).map(category => [category, 0])))
const baselineCounts = Object.values(baseline.fileCounts || {}).reduce((totals, file) => {
  for (const category of Object.keys(totals)) totals[category] += file[category] || 0
  return totals
}, Object.fromEntries(Object.keys(categories).map(category => [category, 0])))
const categorySummary = Object.keys(categories).map(category => {
  const delta = legacyCounts[category] - baselineCounts[category]
  const movement = delta < 0 ? `减少 ${Math.abs(delta)}` : delta > 0 ? `增加 ${delta}` : '无变化'
  return `${category}=${legacyCounts[category]}（${movement}）`
}).join(', ')
console.log(`视觉令牌审计通过：${requiredTokens.length} 个令牌已定义，${Object.keys(requiredPublicReferences).length} 个公共入口已接入；存量字面量 ${categorySummary}；相对登记快照的存量不得扩张。`)
