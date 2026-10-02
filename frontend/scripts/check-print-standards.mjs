import fs from 'node:fs'
import path from 'node:path'

const frontendRoot = path.resolve(import.meta.dirname, '..')
const sourceRoot = path.join(frontendRoot, 'src')
const printStylesPath = path.join(sourceRoot, 'styles/components/_print.scss')
const findings = []
const printExceptions = {
  'src/views/brands/BrandsView.vue': { count: 1, reason: '品牌目录的专用纸张排版' },
  'src/components/StockInDetailModal.vue': { count: 2, reason: '独立打印入库单窗口及详情打印视图' },
  'src/views/rentals/RentalsView.vue': { count: 1, reason: '生成后独立打开的租赁合同 HTML' }
}

function collectFiles(directory, files = []) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const filePath = path.join(directory, entry.name)
    if (entry.isDirectory()) collectFiles(filePath, files)
    else if (/\.(?:vue|css|scss)$/.test(entry.name)) files.push(filePath)
  }
  return files
}

const globalPrintStyles = fs.readFileSync(printStylesPath, 'utf8')
for (const selector of ['.no-print', '.print-only', '.print-break-before', '.print-break-after', '.print-avoid-break']) {
  if (!globalPrintStyles.includes(selector)) findings.push(`公共打印样式缺少 ${selector}`)
}
if (!/prefers-reduced-motion/.test(globalPrintStyles) && !fs.readFileSync(path.join(sourceRoot, 'styles/responsive.scss'), 'utf8').includes('prefers-reduced-motion')) {
  findings.push('全局样式需保留减少动态效果支持')
}

const observedExceptions = new Map()
for (const filePath of collectFiles(sourceRoot)) {
  const source = fs.readFileSync(filePath, 'utf8')
  const count = [...source.matchAll(/@media\s+print\b/gi)].length
  if (!count) continue
  const relativeFile = path.relative(frontendRoot, filePath).split(path.sep).join('/')
  if (relativeFile === 'src/styles/components/_print.scss') continue
  const exception = printExceptions[relativeFile]
  if (!exception) {
    findings.push(`${relativeFile} 含有局部 @media print；请使用公共打印工具类，专用打印文档须先登记原因`)
    continue
  }
  observedExceptions.set(relativeFile, count)
  if (count !== exception.count) findings.push(`${relativeFile} 局部打印规则 ${count} 处，登记上限为 ${exception.count} 处`)
}

for (const [file, exception] of Object.entries(printExceptions)) {
  if (!observedExceptions.has(file)) findings.push(`${file} 的打印例外已不再使用，请清理登记`)
  if (!exception.reason.trim()) findings.push(`${file} 的打印例外缺少原因`)
}

if (findings.length) {
  console.error(`打印样式审计失败，共 ${findings.length} 项：`)
  for (const finding of findings) console.error(`- ${finding}`)
  process.exit(1)
}

console.log(`打印样式审计通过：公共打印工具已加载；业务专用打印例外 ${observedExceptions.size} 个文件。`)
