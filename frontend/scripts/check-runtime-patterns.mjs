import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { relative, resolve } from 'node:path'

const frontendRoot = resolve(import.meta.dirname, '..')
const projectRoot = resolve(frontendRoot, '..')
const sourceRoot = resolve(frontendRoot, 'src')
const configPath = resolve(projectRoot, 'config/runtime-pattern-audit.json')
const findings = []

const walk = (directory) => readdirSync(directory).flatMap((name) => {
  const path = resolve(directory, name)
  return statSync(path).isDirectory() ? walk(path) : /\.(?:vue|ts)$/.test(path) ? [path] : []
})

if (!existsSync(configPath)) {
  console.error('运行时模式审计失败：缺少 config/runtime-pattern-audit.json')
  process.exit(1)
}

const config = JSON.parse(readFileSync(configPath, 'utf8'))
const allowedVHtmlProducers = new Set(config.allowedVHtmlProducers || [])
const permanentIntervals = new Set(config.permanentIntervalFiles || [])
const sourceFiles = walk(sourceRoot)

for (const file of sourceFiles) {
  const source = readFileSync(file, 'utf8')
  const fileName = relative(projectRoot, file)

  for (const match of source.matchAll(/v-html\s*=\s*"([^"]+)"/g)) {
    const expression = match[1].trim()
    const producer = expression.match(/^([A-Za-z_$][\w$]*)/)?.[1]
    if (!producer || !allowedVHtmlProducers.has(producer)) {
      findings.push(`${fileName}: v-html 来源 ${expression} 未登记净化函数`)
    }
  }

  if (source.includes('setInterval')) {
    const hasCleanup = /clearInterval\s*\(|onUnmounted\s*\(|onScopeDispose\s*\(/.test(source)
    if (!hasCleanup && !permanentIntervals.has(fileName)) {
      findings.push(`${fileName}: setInterval 缺少 clearInterval 或生命周期清理`)
    }
  }
}

for (const producer of allowedVHtmlProducers) {
  if (!sourceFiles.some(file => readFileSync(file, 'utf8').includes(`v-html="${producer}`))) {
    findings.push(`已登记的 v-html 净化来源未被使用：${producer}`)
  }
}

for (const fileName of permanentIntervals) {
  const path = resolve(projectRoot, fileName)
  if (!existsSync(path) || !readFileSync(path, 'utf8').includes('setInterval')) {
    findings.push(`永久定时器登记无效：${fileName}`)
  }
}

if (findings.length) {
  console.error(`运行时模式审计失败，共 ${new Set(findings).size} 处：`)
  for (const finding of new Set(findings)) console.error(`- ${finding}`)
  process.exit(1)
}

console.log(`运行时模式审计通过：已检查 ${sourceFiles.length} 个 Vue/TypeScript 文件。`)
