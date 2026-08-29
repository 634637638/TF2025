import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const frontendRoot = resolve(import.meta.dirname, '..')
const projectRoot = resolve(frontendRoot, '..')
const contractPath = resolve(projectRoot, 'config/field-contracts.json')
const findings = []

if (!existsSync(contractPath)) {
  console.error('字段一致性审计失败：缺少 config/field-contracts.json')
  process.exit(1)
}

const registry = JSON.parse(readFileSync(contractPath, 'utf8'))
const contracts = registry.contracts || {}
const sourceFiles = registry.auditSources || {}
const legacyBoundarySources = registry.legacyBoundarySources || {}
let legacyFieldCount = 0
let legacyBoundaryCount = 0
let legacyReferenceCount = 0
let retiredFieldCount = 0
const legacyByModule = []

for (const [name, contract] of Object.entries(contracts)) {
  const canonical = contract.canonical || []
  const legacy = contract.legacy || []
  const retired = contract.retired || []
  const contractFields = [...canonical, ...(contract.responseFields || [])]
  legacyFieldCount += legacy.length
  retiredFieldCount += retired.length
  if (legacy.length) legacyByModule.push(`${name}=${legacy.length}`)
  if (!canonical.length) findings.push(`${name}: canonical 字段不能为空`)
  for (const field of contractFields) {
    if (!/^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/.test(field)) {
      findings.push(`${name}: 规范/响应字段必须使用 snake_case：${field}`)
    }
  }
  if (new Set(canonical).size !== canonical.length) findings.push(`${name}: canonical 字段重复登记`)
  if (new Set(legacy).size !== legacy.length) findings.push(`${name}: legacy 字段重复登记`)
  if (new Set(retired).size !== retired.length) findings.push(`${name}: retired 字段重复登记`)
  const overlap = canonical.filter((field) => legacy.includes(field))
  if (overlap.length) findings.push(`${name}: 字段同时登记为 canonical 和 legacy：${overlap.join(', ')}`)
  const retiredOverlap = [...canonical, ...legacy].filter((field) => retired.includes(field))
  if (retiredOverlap.length) findings.push(`${name}: retired 字段与 canonical/legacy 交叉：${retiredOverlap.join(', ')}`)
  if (!sourceFiles[name]?.length) findings.push(`${name}: 未登记审计源文件`)
  if (sourceFiles[name] && new Set(sourceFiles[name]).size !== sourceFiles[name].length) {
    findings.push(`${name}: 审计源文件重复登记`)
  }
  for (const boundaryPath of legacyBoundarySources[name] || []) {
    legacyBoundaryCount += 1
    if (!sourceFiles[name]?.includes(boundaryPath)) {
      findings.push(`${name}: 兼容边界文件未登记为审计源 ${boundaryPath}`)
    }
  }
}

for (const [name, contract] of Object.entries(contracts)) {
  const moduleSources = sourceFiles[name] || []
  const sourceText = []
  for (const relativePath of moduleSources) {
    const absolutePath = resolve(projectRoot, relativePath)
    if (!existsSync(absolutePath)) {
      findings.push(`${name}: 字段契约登记的文件不存在 ${relativePath}`)
      continue
    }
    const source = readFileSync(absolutePath, 'utf8')
    sourceText.push(source)
    const isLegacyBoundary = (legacyBoundarySources[name] || []).includes(relativePath)
    for (const legacyField of [...(contract.legacy || []), ...(contract.retired || [])]) {
      const references = source.match(new RegExp(`\\b${legacyField.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}\\b`, 'g')) || []
      legacyReferenceCount += references.length
      if (isLegacyBoundary) continue
      const pattern = new RegExp(`(?:req\\.(?:body|query)|allowedFields|fieldMapping|\\binterface\\s+|\\btype\\s+)[^\\n]{0,180}\\b${legacyField}\\b`)
      if (pattern.test(source)) {
        findings.push(`${relativePath}: CRUD/API 仍出现旧字段 ${legacyField}`)
      }
    }
  }
  if (sourceText.length && !(contract.canonical || []).some((field) =>
    new RegExp(`\\b${field.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&')}\\b`).test(sourceText.join('\\n'))
  )) {
    findings.push(`${name}: 已登记源文件中未发现任何 canonical 字段`)
  }
  for (const responseField of contract.responseFields || []) {
    if (sourceText.length && !new RegExp(`\\b${responseField.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&')}\\b`).test(sourceText.join('\\n'))) {
      findings.push(`${name}: 响应字段未在登记源文件中出现 ${responseField}`)
    }
  }
}

if (findings.length) {
  console.error(`字段一致性审计失败，共 ${findings.length} 处：`)
  for (const finding of [...new Set(findings)]) console.error(`- ${finding}`)
  process.exit(1)
}

console.log(`字段一致性审计通过：登记的 CRUD 入口未使用旧字段；当前登记 ${legacyFieldCount} 个兼容字段、${retiredFieldCount} 个已退役字段、${legacyBoundaryCount} 个兼容边界、审计源旧字段引用 ${legacyReferenceCount} 处。`)
if (legacyByModule.length) console.log(`兼容字段分布：${legacyByModule.join('，')}`)
