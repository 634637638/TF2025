import { readFileSync, readdirSync, statSync } from 'node:fs'
import { extname, join, relative, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const sourceRoot = join(root, 'src')
const adminLayoutSource = readFileSync(join(sourceRoot, 'styles/admin-layout.css'), 'utf8')
const tableStyleSource = readFileSync(join(sourceRoot, 'styles/components/_table.scss'), 'utf8')
const tableLayoutSource = readFileSync(join(sourceRoot, 'utils/table-layout.ts'), 'utf8')
const messageBoxSource = readFileSync(join(sourceRoot, 'utils/message-box.ts'), 'utf8')
const buttonStyleSource = readFileSync(join(sourceRoot, 'styles/components/_buttons.scss'), 'utf8')
const checkedExtensions = new Set(['.vue', '.scss', '.css'])
const publicLayoutFiles = new Set([
  'src/styles/admin-layout.css',
  'src/styles/components/_table.scss',
  'src/styles/components/_dialog-actions.scss',
  'src/styles/components/_tabs.scss'
])
const colorSourceFile = 'src/styles/components/_buttons.scss'

const semanticSelector = /\.(?:el-button--(?:primary|success|warning|danger|info)|btn-(?:primary|secondary|success|warning|danger|info|default|light|dark|edit|delete|view|permission|field-permission|role|manage|pin|outline-(?:primary|secondary|success|warning|danger|info)))\b/
const unifiedContext = /\.(?:action-buttons|mobile-row-actions|mobile-inline-actions|table-actions|tf-table-actions|card-actions|batch-actions-buttons|tf-dialog-actions|mobile-dialog-footer|default-footer|dialog-footer|modal-footer|image-modal-footer|confirm-footer|icon-picker-footer|photo-preview-footer|photo-viewer-footer|quick-sale-footer|publish-to-h5-footer|receipt-footer|record-footer|scanner-footer|mobile-footer|inventory-mobile-footer|payment-dialog-footer|sale-dialog-footer|apply-dialog-footer|detail-modal-footer|return-dialog-footer|edit-dialog-footer|scanner-dialog-footer|wholesale-modal-footer|footer-actions|user-role-footer-actions)\b/
const tableActionContainer = /\.(?:action-buttons|mobile-row-actions|mobile-inline-actions|table-actions|tf-table-actions)(?:\)|:[\w-]+(?:\([^)]*\))?)*\s*$/
const buttonSelector = /(?:\.el-button|\.btn(?:\b|[-_])|button\b)/
const allButtonSelector = /(?:^|[\s>+~,(])(?:button\b|\.el-button\b|\.[\w-]*(?:btn|button)[\w-]*\b)/i
const legacyButtonSelector = /(?:^|[\s>+~,])(?:button)?\.(?:btn|btn-(?:sm|md|lg|action|edit|delete|view|permission|field-permission|role|manage|pin))(?=[\s:.#>+~,{]|$)/
const visualProperties = new Set([
  'background', 'background-color', 'border', 'border-color', 'border-radius',
  'box-shadow', 'color', 'font-size', 'font-weight', 'height', 'line-height',
  'max-height', 'max-width', 'min-height', 'min-width', 'padding',
  'padding-block', 'padding-bottom', 'padding-inline', 'padding-left',
  'padding-right', 'padding-top', 'transform', 'width'
])
const colorProperties = new Set(['background', 'background-color', 'border', 'border-color', 'box-shadow', 'color', 'fill', 'stroke'])
const literalColorPattern = /(?:#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(|\bwhite\b|\bblack\b)/i

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
  const isPublicLayout = publicLayoutFiles.has(relativeFile)
  const isColorSource = relativeFile === colorSourceFile
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

    if (!isColorSource && allButtonSelector.test(selectorPath)) {
      const privateColors = props.filter(item => (
        colorProperties.has(item.property) &&
        literalColorPattern.test(item.value) &&
        !/^var\(/i.test(item.value)
      ))
      if (privateColors.length) {
        findings.push(`${relativeFile}:${block.line} 按钮颜色必须读取 _buttons.scss 公共变量 (${privateColors.map(item => item.property).join(', ')})`)
      }
    }

    if (!isPublicLayout && !isColorSource && semanticSelector.test(selectorPath)) {
      const forbidden = props.filter(item => colorProperties.has(item.property))
      if (forbidden.length) {
        findings.push(`${relativeFile}:${block.line} 语义按钮颜色必须由 _buttons.scss 控制 (${forbidden.map(item => item.property).join(', ')})`)
      }
    }

    if (!isPublicLayout && !isColorSource && unifiedContext.test(selectorPath) && buttonSelector.test(selectorPath)) {
      const forbidden = props.filter(item => visualProperties.has(item.property))
      if (forbidden.length) {
        findings.push(`${relativeFile}:${block.line} 统一操作区按钮不得覆盖视觉尺寸 (${forbidden.map(item => item.property).join(', ')})`)
      }
    }

    if (!isPublicLayout && !isColorSource && unifiedContext.test(selectorPath)) {
      const wrapping = props.filter(item => item.property === 'flex-wrap' && /^wrap(?:-reverse)?(?:\s*!important)?$/i.test(item.value))
      if (wrapping.length) {
        findings.push(`${relativeFile}:${block.line} 统一操作按钮必须保持一行，业务页面不得覆盖 flex-wrap`)
      }

      const spacing = tableActionContainer.test(block.header)
        ? props.filter(item => ['gap', 'row-gap', 'column-gap'].includes(item.property))
        : []
      if (spacing.length) {
        findings.push(`${relativeFile}:${block.line} 统一操作按钮间距只能由公共样式控制，业务页面不得重复定义 (${spacing.map(item => item.property).join(', ')})`)
      }
    }

    if (!isPublicLayout && !isColorSource && legacyButtonSelector.test(selectorPath)) {
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
  const findings = styleSections(file, rawSource).flatMap(section => auditSection(relativeFile, section.source, section.lineOffset))

  for (const match of rawSource.matchAll(/<(?:el-button|button)\b[^>]*(?:\bstyle|:style|v-bind:style)\s*=[^>]*(?:color|background|border|box-shadow)\s*:[^>]*(?:#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(|\bwhite\b|\bblack\b)[^>]*>/gi)) {
    findings.push(`${relativeFile}:${lineNumber(rawSource, match.index)} 按钮行内样式不得定义颜色，必须使用公共语义类型`)
  }

  return findings
}

const findings = walk(sourceRoot).flatMap(auditFile)

if (!/--admin-data-table-action-gap:\s*8px/i.test(adminLayoutSource)) {
  findings.push('src/styles/admin-layout.css PC 表格操作按钮间距必须统一为 8px')
}
if (!/--admin-data-table-action-edge-space:\s*16px/i.test(adminLayoutSource)) {
  findings.push('src/styles/admin-layout.css PC 操作列左右安全间距必须统一为 16px')
}
if (!/gap:\s*var\(--admin-data-table-action-gap,\s*8px\)\s*!important/i.test(tableStyleSource)) {
  findings.push('src/styles/components/_table.scss 公共操作按钮容器必须强制读取全局按钮间距')
}
if (!/body\s+:is\([^)]*\.action-buttons[^)]*\)\s+\.el-button\.el-button\.el-button/i.test(tableStyleSource)) {
  findings.push('src/styles/components/_table.scss 表格操作按钮选择器优先级必须高于普通按钮基线，确保内边距与列宽计算一致')
}
if (!/padding-inline:\s*var\(--admin-data-table-action-edge-space,\s*16px\)\s*!important/i.test(tableStyleSource)) {
  findings.push('src/styles/components/_table.scss 公共操作列必须读取左右安全间距变量')
}
if (!/\.el-button\.table-action i\s*\{[\s\S]*?margin-inline:\s*0\s*!important/i.test(tableStyleSource)) {
  findings.push('src/styles/components/_table.scss 公共操作按钮图标必须清除页面历史外边距')
}
if (!/buttonGap\s*=\s*8[\s\S]*?horizontalPadding\s*=\s*32/i.test(tableLayoutSource)) {
  findings.push('src/utils/table-layout.ts 操作列宽度计算必须与 8px 按钮间距、左右各 16px 安全间距同步')
}
if (!/--tf-button-primary-soft-bg:\s*#eff6ff/i.test(buttonStyleSource)) {
  findings.push('src/styles/components/_buttons.scss 必须集中定义实心、浅色和工具按钮语义颜色')
}
if (!/\.el-button\.is-circle:not\(\.is-text\):not\(\.is-link\)\s*\{[\s\S]*?width:\s*var\(--tf-button-height\)\s*!important[\s\S]*?height:\s*var\(--tf-button-height\)\s*!important[\s\S]*?border-radius:\s*50%\s*!important/i.test(buttonStyleSource)) {
  findings.push('src/styles/components/_buttons.scss 圆形图标按钮必须使用全局按钮高度作为等宽直径')
}
if (!/\.el-button\.el-button--small\.is-circle:not\(\.is-text\):not\(\.is-link\)\s*\{[\s\S]*?width:\s*var\(--tf-button-height-small\)\s*!important[\s\S]*?height:\s*var\(--tf-button-height-small\)\s*!important/i.test(buttonStyleSource)) {
  findings.push('src/styles/components/_buttons.scss 小号圆形图标按钮必须跟随全局小按钮尺寸')
}
if (/--admin-action-[\w-]+:\s*(?:#[0-9a-f]{3,8}\b|rgba?\(|hsla?\()/i.test(adminLayoutSource)) {
  findings.push('src/styles/admin-layout.css 表格操作颜色不得维护第二套色值，必须引用 --tf-button-* 公共变量')
}
if (!/if\s*\(\/退出登录\|退出\/\.test\(source\)\)[\s\S]*?customClass:\s*\['message-box-unified',\s*'message-box-danger'\]/i.test(messageBoxSource)) {
  findings.push('src/utils/message-box.ts 退出登录确认框必须使用 danger 危险语义')
}

if (findings.length) {
  console.error(`按钮统一审计失败，共 ${findings.length} 处：`)
  for (const finding of findings) console.error(`- ${finding}`)
  process.exit(1)
}

console.log('按钮统一审计通过：页面按钮颜色全部读取公共语义变量，未发现私有色值或统一操作区覆盖。')
