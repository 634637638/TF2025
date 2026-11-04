import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'
import { fileURLToPath } from 'node:url'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const frontendDir = path.resolve(scriptDir, '..')
const workspaceDir = path.resolve(frontendDir, '..')
const sourceRoot = path.join(frontendDir, 'src')
const baseline = JSON.parse(fs.readFileSync(path.join(scriptDir, 'typescript-debt-baseline.json'), 'utf8'))
const ignoredFiles = new Set([
  'frontend/src/auto-imports.d.ts',
  'frontend/src/components.d.ts'
])

const normalize = filePath => path.relative(workspaceDir, filePath).split(path.sep).join('/')

const getSource = filePath => {
  const source = fs.readFileSync(filePath, 'utf8')
  if (!filePath.endsWith('.vue')) return source
  return [...source.matchAll(/<script(?:\s+setup)?(?:\s+lang=['"]ts['"])?[^>]*>([\s\S]*?)<\/script>/g)]
    .map(match => match[1])
    .join('\n')
}

const files = []
const walk = directory => {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name)
    if (entry.isDirectory()) walk(entryPath)
    else if (/\.(?:ts|tsx|vue)$/.test(entry.name) && !ignoredFiles.has(normalize(entryPath))) files.push(entryPath)
  }
}
walk(sourceRoot)

const anyByFile = {}
const exportsByName = new Map()

for (const filePath of files) {
  const relativePath = normalize(filePath)
  const sourceFile = ts.createSourceFile(
    filePath,
    getSource(filePath),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  )

  let anyCount = 0
  const visit = node => {
    if (node.kind === ts.SyntaxKind.AnyKeyword) anyCount += 1
    ts.forEachChild(node, visit)
  }
  visit(sourceFile)
  if (anyCount) anyByFile[relativePath] = anyCount

  for (const statement of sourceFile.statements) {
    const isTypeDeclaration = ts.isInterfaceDeclaration(statement)
      || ts.isTypeAliasDeclaration(statement)
      || ts.isEnumDeclaration(statement)
    if (!isTypeDeclaration || !statement.name) continue
    if (!statement.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword)) continue
    const name = statement.name.text
    if (!exportsByName.has(name)) exportsByName.set(name, new Set())
    exportsByName.get(name).add(relativePath)
  }
}

const failures = []
for (const [filePath, count] of Object.entries(anyByFile)) {
  const allowed = baseline.anyByFile[filePath] || 0
  if (count > allowed) failures.push(`${filePath} 显式 any 增加：${count} > ${allowed}`)
}

const totalAny = Object.values(anyByFile).reduce((total, count) => total + count, 0)
const viewsAny = Object.entries(anyByFile)
  .filter(([filePath]) => filePath.startsWith('frontend/src/views/'))
  .reduce((total, [, count]) => total + count, 0)
if (totalAny > baseline.totalAny) failures.push(`前端显式 any 总数增加：${totalAny} > ${baseline.totalAny}`)
if (viewsAny > baseline.viewsAny) failures.push(`views 显式 any 总数增加：${viewsAny} > ${baseline.viewsAny}`)

const currentDuplicates = new Map(
  [...exportsByName]
    .filter(([, exportFiles]) => exportFiles.size > 1)
    .map(([name, exportFiles]) => [name, [...exportFiles].sort()])
)

for (const [name, exportFiles] of currentDuplicates) {
  const allowedFiles = new Set(baseline.duplicateExports[name] || [])
  if (!allowedFiles.size) {
    failures.push(`新增重复导出类型 ${name}: ${exportFiles.join(', ')}`)
    continue
  }
  const unexpectedFiles = exportFiles.filter(filePath => !allowedFiles.has(filePath))
  if (unexpectedFiles.length) failures.push(`重复类型 ${name} 新增定义：${unexpectedFiles.join(', ')}`)
}

if (failures.length) {
  console.error('TypeScript 债务门禁失败：')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

const reducedAny = baseline.totalAny - totalAny
const reducedDuplicates = Object.keys(baseline.duplicateExports).length - currentDuplicates.size
console.log(`TypeScript 债务门禁通过：any=${totalAny}（减少 ${reducedAny}），views any=${viewsAny}，重复导出名称=${currentDuplicates.size}（减少 ${reducedDuplicates}）。`)
