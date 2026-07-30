import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'

const frontendRoot = resolve(import.meta.dirname, '..')
const projectRoot = resolve(frontendRoot, '..')
const docsRoot = resolve(projectRoot, 'docs/frontend')
const manifestPath = resolve(docsRoot, 'standards-manifest.json')
const packagePath = resolve(frontendRoot, 'package.json')
const findings = []

if (!existsSync(manifestPath)) {
  console.error('规范覆盖审计失败：缺少 docs/frontend/standards-manifest.json')
  process.exit(1)
}

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
const packageJson = JSON.parse(readFileSync(packagePath, 'utf8'))
const entries = Array.isArray(manifest.standards) ? manifest.standards : []
if (manifest.authorityRoot !== 'docs/frontend') {
  findings.push('standards-manifest.json 的唯一权威规范目录必须是 docs/frontend')
}
for (const referenceRoot of manifest.referenceRoots || []) {
  if (!existsSync(resolve(projectRoot, referenceRoot))) {
    findings.push(`登记的历史/专题参考目录不存在：${referenceRoot}`)
  }
}
const registeredDocs = new Set(entries.map(entry => entry.document))
const discoveredDocs = readdirSync(docsRoot)
  .filter(name => /(?:standards?|standard|unified-page-structure)\.md$/i.test(name))

for (const document of discoveredDocs) {
  if (!registeredDocs.has(document)) {
    findings.push(`docs/frontend/${document} 是统一规范文档，但尚未登记对应审计`)
  }
}

const standardsCommand = String(packageJson.scripts?.['check:standards'] || '')
for (const entry of entries) {
  const documentPath = resolve(docsRoot, entry.document)
  if (!existsSync(documentPath)) findings.push(`规范文档不存在：docs/frontend/${entry.document}`)
  if (!Array.isArray(entry.checks) || entry.checks.length === 0) {
    findings.push(`docs/frontend/${entry.document} 没有配置审计命令`)
  }
  if (!Array.isArray(entry.publicSources) || entry.publicSources.length === 0) {
    findings.push(`docs/frontend/${entry.document} 没有登记公共实现入口`)
  }

  for (const check of entry.checks || []) {
    if (!packageJson.scripts?.[check]) {
      findings.push(`docs/frontend/${entry.document} 引用了不存在的 npm 审计命令 ${check}`)
      continue
    }
    if (check !== 'check:coverage' && !standardsCommand.includes(`npm run ${check}`)) {
      findings.push(`${check} 未接入 check:standards，无法在启动和构建前强制执行`)
    }
  }

  for (const source of entry.publicSources || []) {
    if (!existsSync(resolve(projectRoot, source))) {
      findings.push(`docs/frontend/${entry.document} 登记的公共入口不存在：${source}`)
    }
  }
}

if (!standardsCommand.startsWith('npm run check:coverage')) {
  findings.push('check:standards 必须首先运行 check:coverage，防止统一文档漏接审计')
}

if (findings.length) {
  console.error(`规范覆盖审计失败，共 ${findings.length} 处：`)
  for (const finding of [...new Set(findings)]) console.error(`- ${finding}`)
  process.exit(1)
}

console.log(`规范覆盖审计通过：${entries.length} 份统一规范均已登记审计命令和公共实现。`)
