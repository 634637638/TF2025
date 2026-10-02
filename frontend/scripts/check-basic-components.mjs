import fs from 'node:fs'
import path from 'node:path'

const frontendRoot = path.resolve(import.meta.dirname, '..')
const sourceRoot = path.join(frontendRoot, 'src')
const baselinePath = path.join(import.meta.dirname, 'basic-control-adoption-baseline.json')
const findings = []
const current = {}

function collectVueFiles(directory, files = []) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const filePath = path.join(directory, entry.name)
    if (entry.isDirectory()) collectVueFiles(filePath, files)
    else if (entry.name.endsWith('.vue')) files.push(filePath)
  }
  return files
}

for (const filePath of collectVueFiles(sourceRoot)) {
  const file = path.relative(frontendRoot, filePath).split(path.sep).join('/')
  const source = fs.readFileSync(filePath, 'utf8')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
  const counts = {
    radio: [...source.matchAll(/<input\b(?=[^>]*\btype\s*=\s*["']radio["'])[^>]*>/gi)].length,
    checkbox: [...source.matchAll(/<input\b(?=[^>]*\btype\s*=\s*["']checkbox["'])[^>]*>/gi)].length,
    range: [...source.matchAll(/<input\b(?=[^>]*\btype\s*=\s*["']range["'])[^>]*>/gi)].length
  }
  if (Object.values(counts).some(Boolean)) current[file] = counts
}

if (process.argv.includes('--write-baseline')) {
  fs.writeFileSync(baselinePath, `${JSON.stringify({ version: 1, files: current }, null, 2)}\n`)
  console.log(`原生选择控件基线已写入：${Object.keys(current).length} 个文件`)
  process.exit(0)
}

if (!fs.existsSync(baselinePath)) {
  console.error('缺少 basic-control-adoption-baseline.json，请先审核原生单选/复选/滑块存量。')
  process.exit(1)
}

const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'))
for (const [file, counts] of Object.entries(current)) {
  const allowed = baseline.files?.[file]
  if (!allowed) {
    findings.push(`${file} 新增原生单选/复选/滑块；后台表单优先使用 Element Plus 控件`)
    continue
  }
  for (const [type, count] of Object.entries(counts)) {
    if (count > (allowed[type] || 0)) findings.push(`${file} 原生 ${type} 从 ${allowed[type] || 0} 增加到 ${count}`)
  }
}

const nativeTotal = Object.values(current).reduce((total, counts) => total + Object.values(counts).reduce((sum, count) => sum + count, 0), 0)
if (findings.length) {
  console.error(`基础控件审计失败，共 ${findings.length} 项：`)
  for (const finding of findings) console.error(`- ${finding}`)
  process.exit(1)
}

console.log(`基础控件审计通过：原生 radio/checkbox/range 存量 ${nativeTotal} 个，仅禁止新增；标准入口为 Element Plus。`)
