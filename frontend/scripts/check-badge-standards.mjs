import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { auditNumberColumns, auditNumberStyles } from './lib/table-number-contract.mjs'

const frontendRoot = resolve(import.meta.dirname, '..')
const sourceRoot = join(frontendRoot, 'src')
const publicBadgePath = join(sourceRoot, 'styles/components/_badges.scss')
const legacyGlobalPath = join(sourceRoot, 'styles/global.css')
const findings = []

function walk(directory, files = []) {
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry)
    const stat = statSync(path)
    if (stat.isDirectory()) walk(path, files)
    else if (/\.(?:vue|css|scss)$/.test(entry)) files.push(path)
  }
  return files
}

function lineNumber(source, index) {
  return source.slice(0, index).split('\n').length
}

function styleSources(filePath, source) {
  if (!filePath.endsWith('.vue')) return [{ source, offset: 0 }]
  return [...source.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)]
    .map(match => ({ source: match[1], offset: match.index + match[0].indexOf(match[1]) }))
}

const publicBadgeSource = readFileSync(publicBadgePath, 'utf8')
if (!/\[class\*=['"]badge['"]\]/.test(publicBadgeSource)) {
  findings.push('公共徽章样式必须覆盖带 badge 语义 class 的页面徽章')
}
if (!/:hover\s*\{[\s\S]*?border-color:\s*currentColor/.test(publicBadgeSource)) {
  findings.push('公共徽章样式必须使用 border-color: currentColor 提供统一 hover 外包围线')
}
if (!/transition:\s*var\(--tf-badge-transition\)/.test(publicBadgeSource)) {
  findings.push('公共徽章样式必须使用 --tf-badge-transition，页面不得单独维护过渡')
}

const legacyGlobalSource = readFileSync(legacyGlobalPath, 'utf8')
if (/\.status-badge\s*\{/.test(legacyGlobalSource)) {
  findings.push('styles/global.css 不得保留 .status-badge，状态徽章唯一公共入口是 styles/components/_badges.scss')
}

let auditedFiles = 0
let auditedBadgeReferences = 0
let auditedTemplates = 0
for (const filePath of walk(sourceRoot)) {
  const relativeFile = relative(frontendRoot, filePath).split('\\').join('/')
  if (relativeFile === 'src/styles/components/_badges.scss') continue
  const source = readFileSync(filePath, 'utf8')
  if (filePath.endsWith('.vue')) {
    auditedTemplates += 1
    for (const finding of auditNumberColumns(source)) {
      findings.push(`${relativeFile}:${finding.line} ${finding.message}`)
    }
  }
  let hasBadgeReference = false

  for (const { source: styleSource, offset } of styleSources(filePath, source)) {
    if (relativeFile !== 'src/styles/admin-layout.css') {
      for (const message of auditNumberStyles(styleSource)) findings.push(`${relativeFile} ${message}`)
    }
    for (const rule of styleSource.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      const selector = rule[1].trim()
      const declarations = rule[2]
      // tf-button--* 是 _buttons.scss 拥有的按钮语义（如图标删除角标 tf-button--icon-badge），
      // 其 hover 配色与显现由按钮公共入口和页面容器负责，不属于徽章域，故跳过避免命名重叠误判。
      if (!/(?:badge|tag)/i.test(selector) || /tf-button--/i.test(selector)) continue
      hasBadgeReference = true

      const isHoverRule = /:hover\b/i.test(selector)
      const hasPrivateTransition = /\btransition(?:-property|-duration)?\s*:/i.test(declarations)
      if (isHoverRule || hasPrivateTransition) {
        const line = lineNumber(source, offset + rule.index)
        findings.push(`${relativeFile}:${line} 徽章 hover/过渡必须由 _badges.scss 统一控制，页面不得声明 ${selector.replace(/\s+/g, ' ')}`)
      }
    }
  }

  if (hasBadgeReference) {
    auditedFiles += 1
    auditedBadgeReferences += (source.match(/(?:badge|tag)/gi) || []).length
  }
}

if (findings.length) {
  console.error(`徽章统一审计失败，共 ${findings.length} 处：`)
  for (const finding of [...new Set(findings)]) console.error(`- ${finding}`)
  process.exit(1)
}

console.log(`徽章统一审计通过：已扫描 ${auditedTemplates} 个页面/组件模板，以及 ${auditedFiles} 个含徽章样式文件、${auditedBadgeReferences} 个徽章语义引用；序号/排名/只读排序/ID、表格外编号、公共列宽与交互均已收口。`)
