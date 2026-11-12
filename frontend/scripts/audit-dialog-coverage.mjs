#!/usr/bin/env node

// 只读统计与风险定位；现存风险必须如实报告，不把诊断命令当作统一完成门禁。
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { basename, dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse } from '@vue/compiler-sfc'
import ts from 'typescript'

const root = resolve(import.meta.dirname, '..')
const normalizeTag = value => value.replace(/-/g, '').toLowerCase()
const lineAt = (source, offset) => source.slice(0, offset).split('\n').length
const publicStyles = new Set([
  'src/styles/components/_dialog.scss', 'src/styles/components/_dialog-actions.scss',
  'src/styles/components/_buttons.scss', 'src/styles/_variables.scss',
  'src/components/styles/mobile-dialog/base.scss', 'src/components/styles/mobile-dialog/theme.scss'
])

function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const file = join(directory, entry.name)
    return entry.isDirectory() ? walk(file) : [file]
  }).sort()
}

function visit(node, callback) {
  callback(node)
  ts.forEachChild(node, child => visit(child, callback))
}

function property(node, key) {
  return node.properties.find(item => item.name?.getText().replace(/['"]/g, '') === key)?.initializer
}

/** 解析真实路由树，排除 redirect 和布局；保留同一文件对应的不同 URL。 */
export function readRoutes(source) {
  const ast = ts.createSourceFile('router.ts', source, ts.ScriptTarget.Latest, true)
  let routes
  visit(ast, node => {
    if (ts.isVariableDeclaration(node) && node.name.getText() === 'routes') routes = node.initializer
  })
  if (!routes || !ts.isArrayLiteralExpression(routes)) throw new Error('无法解析 routes 数组，禁止返回空统计')
  const result = { leaves: [], layouts: [] }
  function read(array, parent = '', layouts = []) {
    for (const node of array.elements) {
      if (!ts.isObjectLiteralExpression(node)) throw new Error('路由包含未支持的动态声明，请扩展解析器')
      const pathNode = property(node, 'path')
      if (!pathNode || !ts.isStringLiteral(pathNode)) throw new Error('路由路径必须可静态解析')
      const path = pathNode.text.startsWith('/') ? pathNode.text : `${parent}/${pathNode.text}`.replace(/\/+/g, '/')
      const component = property(node, 'component')
      let file
      if (component) visit(component, child => {
        if (ts.isCallExpression(child) && child.expression.kind === ts.SyntaxKind.ImportKeyword
          && ts.isStringLiteral(child.arguments[0])) file = child.arguments[0].text.replace(/^@\//, 'src/')
      })
      if (component && !file) throw new Error(`${path} 的路由组件无法解析`)
      const children = property(node, 'children')
      if (children && !ts.isArrayLiteralExpression(children)) throw new Error(`${path} 的子路由无法解析`)
      if (children) {
        if (file) result.layouts.push({ path, file })
        read(children, path, file ? [...layouts, file] : layouts)
      } else if (file) result.leaves.push({ path, file, layouts })
    }
  }
  read(routes)
  return result
}

/** Vue 编译器解析模板，避免注释、字符串示例和大小写写法影响组件数量。 */
export function readTemplate(source, filename = 'component.vue') {
  const { descriptor, errors } = parse(source, { filename })
  if (errors.length) throw new Error(`${filename}: ${errors.map(error => error.message || error).join('; ')}`)
  const dialogs = [], tags = new Set(), overlays = []
  const kinds = { mobiledialog: 'MobileDialog', eldialog: 'el-dialog', mediapreviewviewer: 'MediaPreviewViewer', elimageviewer: 'el-image-viewer' }
  function read(node, inDialog = false) {
    if (node.type === 1) {
      const tag = normalizeTag(node.tag)
      tags.add(tag)
      const attribute = name => node.props.find(prop => prop.type === 6 && prop.name === name)?.value?.content
      const line = node.loc.start.line
      if (kinds[tag]) dialogs.push({ kind: kinds[tag], line, title: attribute('title') || '动态标题/无静态标题' })
      const classes = attribute('class') || ''
      if (!inDialog && !kinds[tag] && (attribute('role') === 'dialog'
        || /(?:^|\s)[\w-]*(?:overlay|modal-mask|modal-backdrop|popup-mask)(?:\s|$)/.test(classes))) {
        overlays.push({ line, tag: node.tag, classes, role: attribute('role') })
      }
      inDialog ||= Boolean(kinds[tag])
    }
    for (const child of node.children || []) read(child, inDialog)
  }
  if (descriptor.template) read(descriptor.template.ast)
  return { descriptor, dialogs, tags, overlays }
}

/** 只定位显式浏览器原生弹框；导入的 confirm/prompt 不按名称误报。 */
export function readNativeCalls(source, filename) {
  const ast = ts.createSourceFile(filename, source, ts.ScriptTarget.Latest, true)
  const calls = []
  visit(ast, node => {
    if (!ts.isCallExpression(node)) return
    const expression = node.expression
    const owner = expression.expression
    const name = ts.isPropertyAccessExpression(expression) ? expression.name.text
      : ts.isElementAccessExpression(expression) && ts.isStringLiteral(expression.argumentExpression) ? expression.argumentExpression.text : undefined
    if (owner && ts.isIdentifier(owner) && ['window', 'globalThis', 'self'].includes(owner.text)
      && ['alert', 'confirm', 'prompt'].includes(name)) {
      calls.push({ line: lineAt(source, node.getStart(ast)), kind: `${owner.text}.${name}` })
    }
  })
  return calls
}

/** 服务弹窗按调用点单独统计，不与模板实例相加；支持导入及 Composable 解构别名。 */
export function readServiceCalls(source, filename) {
  const ast = ts.createSourceFile(filename, source, ts.ScriptTarget.Latest, true)
  const bindings = new Map(), factories = new Set(), receivers = new Set(), calls = []
  visit(ast, node => {
    if (!ts.isImportDeclaration(node) || !ts.isStringLiteral(node.moduleSpecifier)) return
    const path = node.moduleSpecifier.text
    const elements = node.importClause?.namedBindings
    if (!elements || !ts.isNamedImports(elements)) return
    for (const element of elements.elements) {
      const name = (element.propertyName || element.name).text
      if (/\/(?:message-box|useConfirm)$/.test(path) && ['confirmAction', 'alertAction', 'confirm'].includes(name)) bindings.set(element.name.text, name)
      if (/\/(?:useNotification|useConfirm|usePageView)$/.test(path) && ['useNotification', 'useConfirm', 'usePageView'].includes(name)) factories.add(element.name.text)
    }
  })
  visit(ast, node => {
    if (!ts.isVariableDeclaration(node) || !node.initializer || !ts.isCallExpression(node.initializer)
      || !ts.isIdentifier(node.initializer.expression) || !factories.has(node.initializer.expression.text)) return
    if (ts.isIdentifier(node.name)) receivers.add(node.name.text)
    if (ts.isObjectBindingPattern(node.name)) for (const element of node.name.elements) {
      const name = (element.propertyName || element.name).getText(ast)
      if (['confirm', 'alert', 'prompt'].includes(name)) bindings.set(element.name.getText(ast), name)
    }
  })
  visit(ast, node => {
    if (!ts.isCallExpression(node)) return
    const expression = node.expression
    const kind = ts.isIdentifier(expression) ? bindings.get(expression.text)
      : ts.isPropertyAccessExpression(expression) && ts.isIdentifier(expression.expression)
        && receivers.has(expression.expression.text) && ['confirm', 'alert', 'prompt'].includes(expression.name.text) ? expression.name.text : undefined
    if (kind) calls.push({ line: lineAt(source, node.getStart(ast)), kind })
  })
  return calls
}

function imports(source, filename) {
  const ast = ts.createSourceFile(filename, source, ts.ScriptTarget.Latest, true)
  const result = []
  visit(ast, node => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) result.push(node.moduleSpecifier.text)
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword
      && ts.isStringLiteral(node.arguments[0])) result.push(node.arguments[0].text)
  })
  return result
}

/** 这是覆盖候选，不根据源码命中断言 CSS 已生效或一定违规。 */
export function readStyleCandidates(source, offset = 0) {
  const result = []
  // 按括号栈读取嵌套 SCSS；父规则在子规则前后的声明也必须纳入，不能只扫描叶子块。
  const scopes = []
  let start = 0, quote = '', comment = '', parentheses = 0
  const clean = value => value.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '').trim()
  function declaration(end) {
    const match = clean(source.slice(start, end)).match(/^(--[\w-]+|[\w-]+)\s*:\s*([\s\S]+)$/)
    if (match && scopes.length) {
      const [, property, value] = match
      const selector = scopes.at(-1)
      const token = /^--(?:tf-dialog|dialog|mobile-dialog)-/.test(property)
      const chrome = /\.(?:el-dialog(?:__(?:header|body|footer|headerbtn|title))?|el-message-box(?:__[\w-]+)?|mobile-dialog-sheet-(?:panel|header|body|footer|close|title))\b/.test(selector)
      const visual = /^(?:(?:min-|max-)?(?:width|height)|padding(?:-[\w-]+)?|margin(?:-[\w-]+)?|border(?:-[\w-]+)?|background(?:-[\w-]+)?|box-shadow|font-size|top|right|bottom|left|transform|z-index)$/
      if (token || (chrome && visual.test(property))) result.push({ offset: offset + start, selector, property, value: value.trim() })
    }
  }
  for (let index = 0; index < source.length; index++) {
    const char = source[index], next = source[index + 1]
    if (comment) {
      if (comment === 'line' && char === '\n') comment = ''
      else if (comment === 'block' && char === '*' && next === '/') { comment = ''; index++ }
      continue
    }
    if (quote) { if (char === '\\') index++; else if (char === quote) quote = ''; continue }
    if (char === '/' && next === '/') { comment = 'line'; index++; continue }
    if (char === '/' && next === '*') { comment = 'block'; index++; continue }
    if (char === '"' || char === "'") { quote = char; continue }
    if (char === '(' || char === '[') parentheses++
    if (char === ')' || char === ']') parentheses--
    if (parentheses) continue
    if (char === '{') {
      const selector = clean(source.slice(start, index))
      const parent = scopes.at(-1) || ''
      scopes.push(selector.startsWith('@') ? parent : parent && selector.includes('&')
        ? selector.replaceAll('&', parent) : `${parent} ${selector}`.trim())
      start = index + 1
    } else if (char === ';') { declaration(index); start = index + 1 }
    else if (char === '}') { declaration(index); scopes.pop(); start = index + 1 }
  }
  return result
}

/** 公共外壳与令牌只能由公共入口维护；正文内提示的换行/滚动属于业务内容。 */
export function isPrivateDialogChrome(candidate) {
  if (/^--(?:tf-dialog|dialog|mobile-dialog)-/.test(candidate.property)) return true
  return candidate.selector.replace(/:(?:deep|global)\(([^()]*)\)/g, '$1').split(',').some(selector => {
    const target = selector.trim().split(/\s+|\s*[>+~]\s*/).at(-1)
    return /\.(?:el-dialog(?:__(?:header|body|footer|headerbtn|title|close))?|el-message-box(?:__(?:header|content|btns|headerbtn|title|close))?|mobile-dialog-sheet-(?:panel|header|body|footer|close|title))(?:[.#:][\w()-]+)*$/.test(target)
  })
}

export function collectCoverage(projectRoot = root) {
  const files = walk(join(projectRoot, 'src'))
  const nameOf = file => relative(projectRoot, file).split('\\').join('/')
  const vueFiles = files.filter(file => file.endsWith('.vue'))
  const components = new Map()
  for (const file of vueFiles.filter(file => nameOf(file).startsWith('src/components/'))) {
    const key = normalizeTag(basename(file, '.vue'))
    components.set(key, [...(components.get(key) || []), nameOf(file)])
  }
  const units = new Map(), styles = [], nativeCalls = [], serviceCalls = []
  for (const file of files.filter(file => /\.(vue|ts|js|scss|css)$/.test(file) && !file.endsWith('.d.ts'))) {
    const source = readFileSync(file, 'utf8'), name = nameOf(file)
    const template = file.endsWith('.vue') ? readTemplate(source, name) : undefined
    const scripts = template ? [template.descriptor.script, template.descriptor.scriptSetup].filter(Boolean)
      : /\.(ts|js)$/.test(file) ? [{ content: source, loc: { start: { line: 1 } } }] : []
    const dependencies = new Set()
    for (const script of scripts) {
      for (const call of readNativeCalls(script.content, name)) nativeCalls.push({ file: name, ...call, line: call.line + script.loc.start.line - 1 })
      for (const call of readServiceCalls(script.content, name)) {
        serviceCalls.push({ file: name, ...call, line: call.line + script.loc.start.line - 1 })
      }
      for (const specifier of imports(script.content, name).filter(value => value.endsWith('.vue'))) {
        const target = specifier.startsWith('@/') ? resolve(projectRoot, 'src', specifier.slice(2)) : resolve(dirname(file), specifier)
        if (!existsSync(target)) throw new Error(`${name} 引用不存在的组件 ${specifier}`)
        dependencies.add(nameOf(target))
      }
    }
    if (template) {
      for (const tag of template.tags) {
        const matches = components.get(tag) || []
        if (matches.length === 1 && matches[0] !== name) dependencies.add(matches[0])
      }
      units.set(name, { file: name, dialogs: template.dialogs, overlays: template.overlays, dependencies: [...dependencies] })
    }
    if (!publicStyles.has(name)) {
      const sources = template ? template.descriptor.styles.map(style => ({ source: style.content, offset: style.loc.start.offset }))
        : /\.(scss|css)$/.test(file) ? [{ source, offset: 0 }] : []
      for (const style of sources) {
        for (const candidate of readStyleCandidates(style.source, style.offset)) {
          styles.push({ file: name, line: lineAt(source, candidate.offset), selector: candidate.selector, property: candidate.property, value: candidate.value })
        }
      }
    }
  }
  const routes = readRoutes(readFileSync(join(projectRoot, 'src/router/index.ts'), 'utf8'))
  function reachable(start) {
    const seen = new Set()
    function read(file) {
      if (seen.has(file)) return
      if (!units.has(file)) throw new Error(`依赖图缺少 Vue 文件 ${file}`)
      seen.add(file)
      for (const dependency of units.get(file).dependencies) read(dependency)
    }
    read(start)
    return [...seen].sort()
  }
  const businessDialogs = [...units.values()].flatMap(unit => unit.file === 'src/components/MobileDialog.vue'
    ? [] : unit.dialogs.map(dialog => ({ file: unit.file, ...dialog })))
  const summarize = dialogs => Object.fromEntries(['MobileDialog', 'el-dialog', 'MediaPreviewViewer', 'el-image-viewer'].map(kind => [kind, dialogs.filter(dialog => dialog.kind === kind).length]))
  const pages = routes.leaves.map(route => {
    const dependencies = reachable(route.file)
    return { ...route, dependencies, counts: summarize(businessDialogs.filter(dialog => dependencies.includes(dialog.file))) }
  })
  const viewCount = vueFiles.filter(file => nameOf(file).startsWith('src/views/')).length
  const componentCount = vueFiles.filter(file => nameOf(file).startsWith('src/components/')).length
  return {
    summary: { leafRoutes: pages.length, routeEntries: pages.length + routes.layouts.length, layouts: routes.layouts.length,
      viewFiles: viewCount, componentFiles: componentCount, vueFiles: vueFiles.length,
      dialogFiles: new Set(businessDialogs.map(dialog => dialog.file)).size,
      ...summarize(businessDialogs), nativeCalls: nativeCalls.length, serviceCalls: serviceCalls.length,
      styleCandidateFiles: new Set(styles.map(style => style.file)).size, styleCandidates: styles.length },
    pages, layouts: routes.layouts.map(layout => ({ ...layout, counts: summarize(businessDialogs.filter(dialog => reachable(layout.file).includes(dialog.file))) })),
    dialogs: businessDialogs, nativeCalls, serviceCalls, styles,
    unassignedDialogFiles: [...new Set(businessDialogs.map(dialog => dialog.file))]
      .filter(file => ![...routes.leaves, ...routes.layouts, { file: 'src/App.vue' }].some(entry => reachable(entry.file).includes(file))),
    overlays: [...units.values()].flatMap(unit => unit.overlays.map(overlay => ({ file: unit.file, ...overlay }))),
    units: [...units.values()]
  }
}

/** 与既有台账的统计口径对齐，不通过固定一个新数字建立第二套基线。 */
export function verifyInventory(summary, markdown) {
  const fields = {
    '懒加载路由入口': 'routeEntries', '实际叶子路由': 'leafRoutes',
    '页面源文件': 'viewFiles', '公共组件源文件': 'componentFiles'
  }
  for (const [label, key] of Object.entries(fields)) {
    const row = markdown.split('\n').find(line => line.startsWith(`| ${label} |`))
    const recorded = row && Number(row.split('|').at(-2).trim())
    if (recorded !== summary[key]) throw new Error(`页面台账 ${label} 登记 ${recorded ?? '缺失'}，源码实测 ${summary[key]}；请同步台账，不得忽略差异`)
  }
}

function main() {
  const report = collectCoverage()
  verifyInventory(report.summary, readFileSync(join(root, '../docs/frontend/page-audit-inventory.md'), 'utf8'))
  if (process.argv.includes('--json')) console.log(JSON.stringify(report, null, 2))
  else if (process.argv.includes('--markdown')) {
    console.log('| 路由 | MobileDialog（含子单元） | 直接 el-dialog | 公共媒体预览 | 原生图片查看 |')
    console.log('| --- | ---: | ---: | ---: | ---: |')
    for (const page of report.pages) console.log(`| \`${page.path}\` | ${Object.values(page.counts).join(' | ')} |`)
  } else {
    console.log('全量模态框只读统计：', JSON.stringify(report.summary))
    for (const call of report.nativeCalls) console.log(`原生弹框：${call.file}:${call.line} ${call.kind}`)
    for (const file of new Set(report.styles.map(style => style.file))) console.log(`待核对覆盖：${file}（${report.styles.filter(style => style.file === file).length} 项）`)
    console.log('统计完成；局部覆盖为候选，命令成功不代表全站合规、浏览器或真机验收通过。使用 --json 查看逐实例、依赖和覆盖位置；--markdown 输出路由矩阵。')
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main()
