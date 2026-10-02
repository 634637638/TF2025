import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'
import { parse as parseSfc } from '@vue/compiler-sfc'
import { fileURLToPath } from 'node:url'

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const sourceRoot = path.join(frontendRoot, 'src')
const findings = []
const dateFormatPattern = /(?:^|[^\w$])(?:Y{2,4}|M{1,4}|D{1,4}|H{1,2}|m{1,2})(?:[^\w$]|$)/
const dateOnlyFieldPattern = /^(?:record_date|start_date|end_date|attendance_date)$/

const walk = (directory) => {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const filePath = path.join(directory, entry.name)
    if (entry.isDirectory()) walk(filePath)
    else if (/\.(?:ts|tsx|js|jsx|vue)$/.test(entry.name)) inspect(filePath)
  }
}

const lineNumber = (source, offset) => source.slice(0, offset).split(/\r?\n/).length

function getScriptUnits(filePath, source) {
  if (!filePath.endsWith('.vue')) {
    const scriptKind = filePath.endsWith('.tsx') ? ts.ScriptKind.TSX : filePath.endsWith('.jsx') ? ts.ScriptKind.JSX : undefined
    return [{ content: source, offset: 0, scriptKind }]
  }

  const { descriptor, errors } = parseSfc(source, { filename: filePath })
  if (errors.length) {
    findings.push(`${path.relative(path.resolve(frontendRoot, '..'), filePath)}: Vue SFC 无法解析，时间审计未能检查`)
    return []
  }

  return [descriptor.script, descriptor.scriptSetup]
    .filter(Boolean)
    .map(block => ({
      content: block.content,
      offset: source.indexOf(block.content),
      scriptKind: ts.ScriptKind.TS
    }))
}

function inspectTemplate(filePath, source) {
  if (!filePath.endsWith('.vue')) return

  const { descriptor, errors } = parseSfc(source, { filename: filePath })
  if (errors.length || !descriptor.template) return

  const template = descriptor.template.content
  const templateOffset = source.indexOf(template)
  const attributePattern = /(?:^|\s)(:?)(format|value-format)\s*=\s*(["'])(.*?)\3/g
  let match

  while ((match = attributePattern.exec(template))) {
    const [, binding, attribute, , value] = match
    if (!dateFormatPattern.test(value)) continue
    const relativePath = path.relative(path.resolve(frontendRoot, '..'), filePath)
    const kind = binding ? '绑定表达式内的日期格式字面量' : '硬编码日期格式'
    findings.push(`${relativePath}:${lineNumber(source, templateOffset + match.index)} 模板 ${attribute} 存在${kind} "${value}"，请引用 TIME_FORMATS`)
  }
}

function inspect(filePath) {
  if (filePath.endsWith(path.join('src', 'utils', 'time.ts'))) return

  const relativePath = path.relative(path.resolve(frontendRoot, '..'), filePath)
  const source = fs.readFileSync(filePath, 'utf8')
  inspectTemplate(filePath, source)
  for (const unit of getScriptUnits(filePath, source)) {
    const scriptKind = unit.scriptKind || (filePath.endsWith('.ts') ? ts.ScriptKind.TS : ts.ScriptKind.JS)
    const sourceFile = ts.createSourceFile(filePath, unit.content, ts.ScriptTarget.Latest, true, scriptKind)

    const report = (node, message) => {
      findings.push(`${relativePath}:${lineNumber(source, unit.offset + node.getStart(sourceFile))} ${message}`)
    }

    const visit = (node) => {
      if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
        const method = node.expression.name.text
        const receiver = node.expression.expression

        if (method === 'format') {
          const firstArgument = node.arguments[0]
          const secondArgument = node.arguments[1]
          const receiverName = receiver.getText(sourceFile)

          if (firstArgument && ts.isStringLiteralLike(firstArgument) && dateFormatPattern.test(firstArgument.text)) {
            report(node, `直接使用日期格式 "${firstArgument.text}"，请登记到 TIME_FORMATS 并通过公共时间工具使用`)
          }

          if (receiverName === 'TimeUtil' && secondArgument && ts.isStringLiteralLike(secondArgument) && dateFormatPattern.test(secondArgument.text)) {
            report(node, `TimeUtil.format() 使用未登记格式 "${secondArgument.text}"，请改用 TIME_FORMATS 或补充公共格式`)
          }
        }

        if (method === 'toLocaleDateString') {
          report(node, '使用浏览器本地化日期 API，请改用 TimeUtil 或 format.ts')
        }

        if (method === 'toISOString' && receiver.getText(sourceFile) !== 'TimeUtil') {
          report(node, '直接调用 toISOString()，请改用 TimeUtil.toISOString() 并区分业务日期与机器时间')
        }
      }

      if (ts.isNewExpression(node) && node.expression.getText(sourceFile) === 'Date' && node.arguments?.length) {
        const argument = node.arguments[0]
        const dateField = ts.isPropertyAccessExpression(argument) ? argument.name.text : ''
        const isDateRangeValue = ts.isElementAccessExpression(argument)
          && /range|dates|period/i.test(argument.expression.getText(sourceFile))

        if (dateOnlyFieldPattern.test(dateField) || isDateRangeValue) {
          report(node, `日期-only 业务值通过原生 Date 构造 (${argument.getText(sourceFile)})，请改用 TimeUtil 解析和日历运算`)
        }
      }

      ts.forEachChild(node, visit)
    }

    visit(sourceFile)
  }
}

walk(sourceRoot)

if (findings.length > 0) {
  console.error(`时间工具审计失败，共 ${findings.length} 处：`)
  for (const finding of findings) console.error(`- ${finding}`)
  process.exit(1)
}

console.log('时间工具审计通过：业务格式、日期-only 字段和 ISO 转换均使用公共时间入口。')
