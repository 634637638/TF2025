import { parse } from '@vue/compiler-sfc'
import ts from 'typescript'

const appearance = new Set([
  'height', 'min-height', 'max-height', 'font', 'font-size', 'font-weight', 'line-height',
  'padding', 'padding-inline', 'padding-block', 'padding-left', 'padding-right',
  'padding-top', 'padding-bottom', 'border-radius', 'background', 'background-color',
  'color', 'border', 'border-color', 'border-width', 'border-style', 'box-shadow'
])

/** 批量操作显式小号必须映射公共令牌，不能把页面规格变成第二套尺寸源。 */
export function auditBatchButtonSizes(source) {
  const body = source.match(/\.batch-actions-buttons\[data-size=['"]small['"]\]\s*\{([^}]*)\}/)?.[1]
  if (!body) return ['缺少批量操作 data-size="small" 公共入口']
  return ['height', 'padding-x', 'padding-y', 'font-size', 'icon-size'].flatMap(property => {
    const mapping = new RegExp(`--admin-data-table-action-${property}:\\s*var\\(--tf-button-batch-small-${property}\\)\\s*;`)
    return mapping.test(body) ? [] : [`批量操作小号 ${property} 必须映射公共按钮令牌`]
  })
}

function classNames(node) {
  return (node.props ?? []).flatMap(prop => prop.type === 6 && prop.name === 'class' && prop.value
    ? [prop.value.content]
    : prop.type === 7 && prop.name === 'bind' && prop.arg?.content === 'class' && prop.exp
      ? [...prop.exp.content.matchAll(/['"]([^'"]+)['"]/g)].map(match => match[1])
      : []).flatMap(value => value.split(/\s+/)).filter(Boolean)
}

/** 只识别实际按钮独占的 class，避免把按钮组、图标、单选按钮等误当作命令按钮。 */
export function collectButtonClasses(sources) {
  const buttons = new Set(['el-button'])
  const others = new Set()
  for (const source of sources) {
    const { descriptor, errors } = parse(source)
    if (errors.length) throw new Error(`无法解析 Vue 模板：${errors[0]}`)
    const visit = node => {
      if (node.type === 1) {
        for (const name of classNames(node)) {
          (node.tag === 'el-button' ? buttons : others).add(name)
        }
      }
      for (const child of node.children ?? []) visit(child)
    }
    if (descriptor.template?.ast) visit(descriptor.template.ast)
  }
  const exclusive = new Set([...buttons].filter(name => !others.has(name)))
  exclusive.add('el-button')
  return exclusive
}

/** 表格文字操作使用紧凑按钮；有实际图片内容的媒体缩略图保留专用规格。 */
export function auditTableButtonUsage(source) {
  const { descriptor } = parse(source)
  const findings = []
  const visit = (node, inColumn = false) => {
    const inside = inColumn || node.tag === 'el-table-column'
    if (inside && node.tag === 'el-button') {
      const names = classNames(node)
      if (names.includes('tf-button--content') && !names.includes('tf-button--media-tile')) {
        findings.push({ line: node.loc.start.line, message: '表格文字操作须使用 table-inline-action，禁止使用会撑高行的 tf-button--content' })
      }
    }
    for (const child of node.children ?? []) visit(child, inside)
  }
  if (descriptor.template?.ast) visit(descriptor.template.ast)
  return findings
}

function splitSelector(source, separator) {
  let depth = 0
  let start = 0
  const values = []
  for (let index = 0; index < source.length; index += 1) {
    if (source[index] === '(' || source[index] === '[') depth += 1
    if (source[index] === ')' || source[index] === ']') depth -= 1
    if (depth === 0 && separator(source[index])) {
      values.push(source.slice(start, index).trim())
      start = index + 1
    }
  }
  values.push(source.slice(start).trim())
  return values.filter(Boolean)
}

function expandSelectors(parents, header) {
  const children = splitSelector(header, character => character === ',')
  if (!parents.length) return children
  return parents.flatMap(parent => children.map(child => child.includes('&')
    ? child.replaceAll('&', parent)
    : `${parent} ${child}`))
}

function targetsButton(selector, classes) {
  const normalized = selector.replace(/:(?:deep|where|is)\(([^()]*)\)/g, '$1')
  const leaf = splitSelector(normalized, character => /[\s>+~]/.test(character)).at(-1) ?? ''
  if (leaf.includes('::')) return false
  const plain = leaf.replace(/:[\w-]+(?:\([^)]*\))?/g, '')
  return /^button\b/.test(plain)
    || [...plain.matchAll(/\.([\w-]+)/g)].some(match => classes.has(match[1]))
}

function isPrivateAppearance(property, value) {
  if (appearance.has(property)) return true
  // 满宽、自然宽与防溢出属于布局；固定按钮宽度归公共规格维护。
  if (['width', 'min-width', 'max-width'].includes(property)) {
    return !/^(?:auto|0(?:px)?|100%|none|max-content|min-content|fit-content)(?:\s*!important)?$/.test(value)
  }
  return /^--(?:tf-(?:button-|scanner-control-)|el-button-)/.test(property)
}

function maskComments(source) {
  let quote = ''
  let comment = ''
  let clean = ''
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index]
    const next = source[index + 1]
    if (comment) {
      if (comment === 'line' && character === '\n') comment = ''
      if (comment === 'block' && character === '*' && next === '/') {
        clean += '  '
        index += 1
        comment = ''
        continue
      }
      clean += character === '\n' ? '\n' : ' '
    } else if (quote) {
      clean += character
      if (character === '\\') { clean += next ?? ''; index += 1 }
      else if (character === quote) quote = ''
    } else if (character === '"' || character === "'") {
      quote = character
      clean += character
    } else if (character === '/' && (next === '/' || next === '*')) {
      comment = next === '/' ? 'line' : 'block'
      clean += '  '
      index += 1
    } else clean += character
  }
  return clean
}

/** 行内样式只允许可审计的布局声明；动态对象也不能覆盖公共按钮规格。 */
export function auditButtonInlineStyles(source) {
  const { descriptor } = parse(source)
  const findings = []
  const visit = node => {
    if (node.type === 1 && node.tag === 'el-button') {
      for (const prop of node.props) {
        const report = property => findings.push({ property, line: prop.loc.start.line })
        if (prop.type === 6 && prop.name === 'style' && prop.value) {
          for (const declaration of prop.value.content.split(';')) {
            const separator = declaration.indexOf(':')
            if (separator < 0) continue
            const property = declaration.slice(0, separator).trim()
            if (isPrivateAppearance(property, declaration.slice(separator + 1).trim())) report(property)
          }
        } else if (prop.type === 7 && prop.name === 'bind' && prop.arg?.content === 'style' && prop.exp) {
          const file = ts.createSourceFile('button-style.ts', `(${prop.exp.content})`, ts.ScriptTarget.Latest, true)
          const inspect = expression => {
            if (ts.isParenthesizedExpression(expression)) inspect(expression.expression)
            else if (ts.isArrayLiteralExpression(expression)) expression.elements.forEach(inspect)
            else if (ts.isConditionalExpression(expression)) { inspect(expression.whenTrue); inspect(expression.whenFalse) }
            else if (ts.isObjectLiteralExpression(expression)) {
              for (const item of expression.properties) {
                if (!ts.isPropertyAssignment(item) || ts.isComputedPropertyName(item.name)) { report('动态样式'); continue }
                const property = item.name.text.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`)
                const value = ts.isStringLiteral(item.initializer) ? item.initializer.text : item.initializer.getText(file)
                if (isPrivateAppearance(property, value)) report(property)
              }
            } else report('动态样式')
          }
          const statement = file.statements[0]
          if (statement && ts.isExpressionStatement(statement)) inspect(statement.expression)
          else report('动态样式')
        }
      }
    }
    for (const child of node.children ?? []) visit(child)
  }
  if (descriptor.template?.ast) visit(descriptor.template.ast)
  return findings
}

/** 支持嵌套 SCSS、媒体查询和 :deep；返回精确声明位置，便于报告与迁移核对。 */
export function auditButtonContract(source, classes) {
  const clean = maskComments(source)
  const stack = []
  const findings = []
  let start = 0
  let quote = ''
  for (let index = 0; index < clean.length; index += 1) {
    const character = clean[index]
    if (quote) {
      if (character === quote && clean[index - 1] !== '\\') quote = ''
      continue
    }
    if (character === '"' || character === "'") { quote = character; continue }
    if (character === '{') {
      const header = clean.slice(start, index).split(';').at(-1).trim()
      const parents = stack.at(-1)?.selectors ?? []
      const selectors = header.startsWith('@') ? parents : expandSelectors(parents, header)
      stack.push({ selectors, start: index + 1, open: index })
      start = index + 1
    } else if (character === '}' && stack.length) {
      const block = stack.pop()
      let depth = 0
      let topLevel = ''
      for (const value of clean.slice(block.start, index)) {
        if (value === '{') depth += 1
        topLevel += depth === 0 ? value : ' '
        if (value === '}') depth -= 1
      }
      const selectors = block.selectors.filter(selector => targetsButton(selector, classes))
      if (selectors.length) {
        const pattern = /(?:^|(?<=[;}]))\s*([\w-]+)\s*:\s*([^;{}]+);?/g
        for (const match of topLevel.matchAll(pattern)) {
          if (!isPrivateAppearance(match[1], match[2].trim())) continue
          const declarationStart = block.start + match.index + match[0].indexOf(match[1])
          findings.push({
            selectors,
            property: match[1],
            value: match[2].trim(),
            line: source.slice(0, declarationStart).split('\n').length,
            start: declarationStart,
            end: block.start + match.index + match[0].length
          })
        }
      }
      start = index + 1
    }
  }
  return findings
}
