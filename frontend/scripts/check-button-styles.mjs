import { readFileSync, readdirSync, statSync } from 'node:fs'
import { extname, join, relative, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const sourceRoot = join(root, 'src')
const checkedExtensions = new Set(['.vue', '.scss', '.css'])
const allowedFiles = new Set([
  'src/styles/components/_buttons.scss',
  'src/styles/components/_table.scss',
  'src/styles/components/_dialog-actions.scss',
  'src/styles/components/_tabs.scss'
])

const semanticSelector = /\.(?:el-button--(?:primary|success|warning|danger|info)|btn-(?:primary|secondary|success|warning|danger|info|default|light|dark|edit|delete|view|permission|field-permission|role|manage|pin|outline-(?:primary|secondary|success|warning|danger|info)))\b/
const unifiedContext = /\.(?:action-buttons|mobile-row-actions|mobile-inline-actions|table-actions|tf-table-actions|card-actions|batch-actions-buttons|tf-dialog-actions|mobile-dialog-footer|default-footer|dialog-footer|modal-footer|image-modal-footer|confirm-footer|icon-picker-footer|photo-preview-footer|photo-viewer-footer|quick-sale-footer|publish-to-h5-footer|receipt-footer|record-footer|scanner-footer|mobile-footer|inventory-mobile-footer|payment-dialog-footer|sale-dialog-footer|apply-dialog-footer|detail-modal-footer|return-dialog-footer|edit-dialog-footer|scanner-dialog-footer|wholesale-modal-footer|footer-actions|user-role-footer-actions)\b/
const buttonSelector = /(?:\.el-button|\.btn(?:\b|[-_])|button\b)/
const legacyButtonSelector = /(?:^|[\s>+~,])(?:button)?\.(?:btn|btn-(?:sm|md|lg|action|edit|delete|view|permission|field-permission|role|manage|pin))(?=[\s:.#>+~,{]|$)/
const visualProperties = new Set([
  'background', 'background-color', 'border', 'border-color', 'border-radius',
  'box-shadow', 'color', 'font-size', 'font-weight', 'height', 'line-height',
  'max-height', 'max-width', 'min-height', 'min-width', 'padding',
  'padding-block', 'padding-bottom', 'padding-inline', 'padding-left',
  'padding-right', 'padding-top', 'transform', 'width'
])
const colorProperties = new Set(['background', 'background-color', 'border', 'border-color', 'box-shadow', 'color'])

function walk(directory, files = []) {
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry)
    const stat = statSync(path)
    if (stat.isDirectory()) walk(path, files)
    else if (checkedExtensions.has(extname(path))) files.push(path)
  }
  return files
}

function styleSections(file, source) {
  if (!file.endsWith('.vue')) return [{ source, lineOffset: 0 }]
  return [...source.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map(match => ({
    source: match[1],
    lineOffset: source.slice(0, match.index).split('\n').length - 1
  }))
}

function lineNumber(source, index) {
  return source.slice(0, index).split('\n').length
}

function declarations(body) {
  let depth = 0
  let topLevel = ''
  for (const character of body) {
    if (character === '{') {
      depth += 1
      topLevel += ' '
    } else if (character === '}') {
      depth = Math.max(0, depth - 1)
      topLevel += ' '
    } else {
      topLevel += depth === 0 ? character : ' '
    }
  }
  const result = []
  const pattern = /(?:^|[;{}])\s*([\w-]+)\s*:\s*([^;{}]+)/g
  let match
  while ((match = pattern.exec(topLevel))) result.push({ property: match[1].toLowerCase(), value: match[2].trim() })
  return result
}

function auditSection(relativeFile, source, lineOffset) {
  const findings = []
  const stack = []
  let tokenStart = 0

  const reportLine = index => lineOffset + lineNumber(source, index)

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index]
    if (character === '{') {
      const header = source.slice(tokenStart, index)
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/[^\n]*/g, '')
        .trim()
      stack.push({ header, start: index + 1, line: reportLine(index) })
      tokenStart = index + 1
      continue
    }
    if (character !== '}' || stack.length === 0) continue

    const block = stack.pop()
    const body = source.slice(block.start, index)
    const selectorPath = [...stack.map(item => item.header), block.header].join(' ')
    const props = declarations(body)

    if (semanticSelector.test(selectorPath)) {
      const forbidden = props.filter(item => colorProperties.has(item.property))
      if (forbidden.length) {
        findings.push(`${relativeFile}:${block.line} 语义按钮颜色必须由 _buttons.scss 控制 (${forbidden.map(item => item.property).join(', ')})`)
      }
    }

    if (unifiedContext.test(selectorPath) && buttonSelector.test(selectorPath)) {
      const forbidden = props.filter(item => visualProperties.has(item.property))
      if (forbidden.length) {
        findings.push(`${relativeFile}:${block.line} 统一操作区按钮不得覆盖视觉尺寸 (${forbidden.map(item => item.property).join(', ')})`)
      }
    }

    if (legacyButtonSelector.test(selectorPath)) {
      const forbidden = props.filter(item => visualProperties.has(item.property))
      if (forbidden.length) {
        findings.push(`${relativeFile}:${block.line} 旧版按钮视觉必须由全局规则控制 (${forbidden.map(item => item.property).join(', ')})`)
      }
    }

    tokenStart = index + 1
  }

  return findings
}

function auditFile(file) {
  const rawSource = readFileSync(file, 'utf8')
  const relativeFile = relative(root, file)
  if (allowedFiles.has(relativeFile)) return []
  return styleSections(file, rawSource).flatMap(section => auditSection(relativeFile, section.source, section.lineOffset))
}

const findings = walk(sourceRoot).flatMap(auditFile)

if (findings.length) {
  console.error(`按钮统一审计失败，共 ${findings.length} 处：`)
  for (const finding of findings) console.error(`- ${finding}`)
  process.exit(1)
}

console.log('按钮统一审计通过：未发现页面级语义颜色或统一操作区尺寸覆盖。')
