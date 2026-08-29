import { readFileSync, readdirSync, statSync } from 'node:fs'
import { extname, join, relative, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const sourceRoot = join(root, 'src')
const publicComponent = join(sourceRoot, 'components/DataEmptyState.vue')
const findings = []

function walk(directory, files = []) {
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry)
    const stat = statSync(path)
    if (stat.isDirectory()) walk(path, files)
    else if (extname(path) === '.vue') files.push(path)
  }
  return files
}

function lineNumber(source, index) {
  return source.slice(0, index).split('\n').length
}

if (!readFileSync(publicComponent, 'utf8').includes('<el-empty')) {
  findings.push('src/components/DataEmptyState.vue 必须作为全站唯一的 Element Plus 空状态封装入口')
}

for (const file of walk(sourceRoot)) {
  const source = readFileSync(file, 'utf8')
  const relativeFile = relative(root, file)

  if (file !== publicComponent) {
    for (const match of source.matchAll(/<el-empty\b/gi)) {
      findings.push(`${relativeFile}:${lineNumber(source, match.index)} 禁止直接使用 el-empty，请改用公共 DataEmptyState`)
    }

    for (const match of source.matchAll(/\bclass=["'][^"']*\b(?:empty-state|empty-content|empty-cell-content|no-results|assignment-empty-state|optimization-empty-state|analytics-empty-state)\b[^"']*["']/gi)) {
      findings.push(`${relativeFile}:${lineNumber(source, match.index)} 禁止新增页面私有空状态结构，请改用公共 DataEmptyState`)
    }
  }

  for (const match of source.matchAll(/<DataEmptyState\b[^>]*\bstate=["']error["'][^>]*>/gi)) {
    if (!/\baction-text=|@action=/.test(match[0])) {
      findings.push(`${relativeFile}:${lineNumber(source, match.index)} 错误空状态必须提供重试操作`)
    }
  }
}

for (const component of ['components/PaginatedTable.vue', 'components/MobileTable.vue']) {
  const path = join(sourceRoot, component)
  const source = readFileSync(path, 'utf8')
  if (!/<DataEmptyState\b/.test(source)) {
    findings.push(`src/${component} 必须接入公共 DataEmptyState`)
  }
}

if (findings.length) {
  console.error(`空状态统一审计失败，共 ${findings.length} 处：`)
  for (const finding of findings) console.error(`- ${finding}`)
  process.exit(1)
}

console.log('空状态统一审计通过：业务页面均使用公共 DataEmptyState。')
