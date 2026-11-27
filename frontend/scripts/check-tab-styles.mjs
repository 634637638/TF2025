import { readFileSync, readdirSync, statSync } from 'node:fs'
import { extname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { compileStyle, parse } from '@vue/compiler-sfc'
import { hasRuntimeModuleImport } from './lib/runtime-module-import.mjs'

const root = resolve(import.meta.dirname, '..')
const sourceRoot = join(root, 'src')
const globalTabStylePath = join(sourceRoot, 'styles/components/_tabs.scss')
const tabsBarSource = readFileSync(join(sourceRoot, 'components/TabsBar.vue'), 'utf8')
const tabScrollSource = readFileSync(join(sourceRoot, 'utils/page-tab-scroll.ts'), 'utf8')
const mainSource = readFileSync(join(sourceRoot, 'main.ts'), 'utf8')

const sourceExtensions = new Set(['.vue', '.css', '.scss'])
const railClasses = ['tf-page-tabs', 'tf-topbar-tabs', 'tf-compact-toolbar']
const protectedClasses = new Set([...railClasses, 'tab-navigation', 'tabs-container', 'tf-topbar-tab', 'tf-tab-content', 'tf-tab-panel', 'tab-content', 'tab-panel', 'tab-label', 'el-tabs'])
const tabClassPattern = /(?:^|[-_])(?:mode-tabs|tab-bar|tab-rail|tab-list|tablist|tabs-bar|tabs-rail|tabs-nav)$/
const scrollProperty = /^(?:overflow(?:-[\w-]+)?|overscroll-behavior(?:-[\w-]+)?|scrollbar[\w-]*|scroll-snap[\w-]*|touch-action|-ms-overflow-style)$/
const visualProperty = /^(?:--tf-tab[\w-]*|--tf-(?:button-compact[\w-]*|compact-group-padding)|(?:min-|max-)?(?:width|height)|padding[\w-]*|border[\w-]*|background[\w-]*|font[\w-]*|color|box-sizing|box-shadow|transform)$/
const tabRoleSelector = /\[role\s*=\s*["']?tab(?:list)?["']?\s*\]/

function walk(directory, files = []) {
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry)
    const stat = statSync(path)
    if (stat.isDirectory()) walk(path, files)
    else if (sourceExtensions.has(extname(path))) files.push(path)
  }
  return files
}

export function auditTabTemplate(template, aliases, findings) {
  let buttonNavigationLine
  let hasPageTabs = false
  let hasTabContent = false
  const unmarkedContent = []
  const visit = (node, inRail = false, inToolbar = false) => {
    if (node.type !== 1) {
      for (const child of node.children ?? []) visit(child, inRail, inToolbar)
      return
    }
    const attr = name => node.props.find(prop => prop.type === 6 && prop.name === name)?.value?.content
    const classes = (attr('class') ?? '').split(/\s+/).filter(Boolean)
    const pageTabs = classes.includes('tf-page-tabs')
    const publicRail = railClasses.some(name => classes.includes(name))
    const line = node.loc.start.line
    hasPageTabs ||= pageTabs
    hasTabContent ||= classes.includes('tf-tab-content')
    const tag = node.tag.replace(/-/g, '').toLowerCase()
    if ((tag === 'eltabs' || classes.includes('tab-navigation')) && !pageTabs) {
      findings.push({ line, message: '页面标签栏必须接入 tf-page-tabs' })
    }
    if (classes.includes('tab-navigation') && pageTabs) buttonNavigationLine ??= line
    if (tag === 'eltabpane' && !classes.includes('tf-tab-panel')) {
      findings.push({ line, message: 'el-tab-pane 必须接入 tf-tab-panel' })
    }
    if (inToolbar && tag === 'elbutton' && !classes.includes('tf-button--compact')) {
      findings.push({ line, message: '紧凑工具栏内的按钮必须接入 tf-button--compact' })
    }
    for (const name of ['tab-content', 'tab-panel']) {
      if (classes.includes(name) && !classes.includes(`tf-${name}`)) {
        unmarkedContent.push({ line, message: `${name} 必须接入 tf-${name}` })
      }
    }
    if ((attr('role') === 'tablist' || classes.some(name => tabClassPattern.test(name))) && !publicRail) {
      findings.push({ line, message: '标签栏必须接入 tf-page-tabs、tf-topbar-tabs 或 tf-compact-toolbar' })
    }
    if (attr('role') === 'tab' && !publicRail && !inRail) {
      findings.push({ line, message: '标签按钮必须放在公共标签栏内' })
    }
    if (publicRail || inRail && classes.includes('tabs-container') || classes.includes('tf-topbar-tab')) {
      for (const name of classes) aliases.add(name)
      const inlineStyle = node.props.some(prop => prop.name === 'style' ||
        prop.name === 'bind' && prop.arg?.content === 'style')
      const privateScroll = node.props.some(prop => prop.name === 'on' &&
        /^(wheel|mousewheel|scroll|touchstart|touchmove|touchend)$/.test(prop.arg?.content))
      if (inlineStyle || privateScroll) findings.push({ line, message: '标签栏样式和滚动事件必须由公共入口维护' })
    }
    for (const child of node.children) visit(child, publicRail || inRail, inToolbar || classes.includes('tf-compact-toolbar'))
  }
  if (template) visit(template)
  if (buttonNavigationLine && !hasTabContent) {
    findings.push({ line: buttonNavigationLine, message: '按钮型页面 TAB 必须提供 tf-tab-content 内容容器' })
  }
  if (hasPageTabs) findings.push(...unmarkedContent)
}

function parseRules(source, file) {
  // Sass 行注释不会进入浏览器样式，保留行号供审计定位。
  const css = source.replace(/^[ \t]*\/\/[^\n]*/gm, '')
  const { rawResult, errors } = compileStyle({ source: css, filename: file, id: '', trim: false })
  if (errors.length) throw new Error(`${file} 无法解析 TAB 样式：${errors[0]}`)
  return rawResult.root
}

export function auditPrivateTabStyles(source, file, aliases = new Set()) {
  const findings = []
  const targetsTab = selector => {
    const target = selector.replace(/:has\([^)]*\)/g, '').trim().split(/[\s>+~]+/).at(-1)
    const classes = [...target.matchAll(/\.([\w-]+)/g)].map(match => match[1])
    return tabRoleSelector.test(target) || classes.some(name => protectedClasses.has(name) || aliases.has(name) ||
      /^el-tabs__/.test(name) || /^tf-page-tabs--/.test(name))
  }
  // 大部分样式文件没有页签选择器，避免解析无关样式。
  if (!tabRoleSelector.test(source) && ![...protectedClasses, ...aliases, 'el-tabs__'].some(name => source.includes(`.${name}`))) return findings
  parseRules(source, file).walkRules(rule => {
    const targetsRail = rule.selectors.some(selector => {
      if (targetsTab(selector)) return true
      const scrollbar = selector.includes('::-webkit-scrollbar')
      const [target] = selector.split('::-webkit-scrollbar')
      if (scrollbar && targetsTab(target)) return true
      const segments = selector.trim().split(/[\s>+~]+/)
      if (segments.length === 2 && /^\.el-button\b/.test(segments[1]) && targetsTab(segments[0])) return true
      if (!segments.at(-1).startsWith('&')) return false
      for (let parent = rule.parent; parent; parent = parent.parent) {
        if (parent.type === 'rule') return parent.selectors.some(targetsTab)
      }
      return false
    })
    if (!targetsRail) return
    const scrollbar = rule.selector.includes('::-webkit-scrollbar')
    for (const declaration of rule.nodes.filter(node => node.type === 'decl')) {
      if (scrollbar || scrollProperty.test(declaration.prop) || visualProperty.test(declaration.prop)) {
        findings.push({ line: declaration.source.start.line, message: `页面不得覆盖全局 TAB 样式 (${declaration.prop})` })
      }
    }
  })
  return findings
}

export function auditPublicTabScroll(source) {
  const required = [
    '.tf-page-tabs.tab-navigation',
    '.tf-page-tabs.el-tabs > .el-tabs__header .el-tabs__nav-scroll',
    '.tf-topbar-tabs .tabs-container',
    '.tf-compact-toolbar'
  ]
  const expected = new Map([
    ['overflow-x', 'auto'], ['overflow-y', 'hidden'],
    ['overscroll-behavior-x', 'none'], ['scrollbar-width', 'none']
  ])
  const rules = parseRules(source, '_tabs.scss')
  const sections = required.map(selector => {
    const rule = rules.nodes.find(node => node.type === 'rule' && node.selectors.includes(selector))
    const properties = new Map(rule?.nodes.filter(node => node.type === 'decl').map(node => [node.prop, node.value]))
    const webkit = rule?.nodes.find(node => node.type === 'rule' && node.selector === '&::-webkit-scrollbar')
    const hidden = webkit?.nodes.some(node => node.type === 'decl' && node.prop === 'display' && node.value === 'none')
    return [...expected].every(([property, value]) => properties.get(property) === value) && hidden
      ? null
      : `${selector} 必须保留原生横滑、隐藏滚动条并关闭横向回弹`
  })
  const bottomScrollers = ['html:has(.admin-container, .tf-page-tabs)', '.admin-container .content-area']
  for (const selector of bottomScrollers) {
    const rule = rules.nodes.find(node => node.type === 'rule' && node.selectors.includes(selector))
    if (!rule?.nodes.some(node => node.type === 'decl' && node.prop === 'overscroll-behavior-y' && node.value === 'none')) {
      sections.push(`${selector} 必须关闭页面底部回弹`)
    }
  }
  return sections.filter(Boolean)
}

function run() {
  const findings = []
  const globalTabStyle = readFileSync(globalTabStylePath, 'utf8')
  const requiredGlobalTokens = [
    '--tf-tab-bg:',
    '--tf-tab-border:',
    '--tf-tab-hover-border:',
    '--tf-tab-active-border:'
  ]

  for (const message of auditPublicTabScroll(globalTabStyle)) {
    findings.push(`src/styles/components/_tabs.scss ${message}`)
  }

  for (const token of requiredGlobalTokens) {
    if (!globalTabStyle.includes(token)) {
      findings.push(`src/styles/components/_tabs.scss:1 全局 TAB 缺少状态令牌 ${token}`)
    }
  }

  if (!/\.tf-page-tabs\.tab-navigation\s+\.el-button\s*\{[\s\S]*?border:\s*1px\s+solid\s+var\(--tf-tab-border\)\s*!important/.test(globalTabStyle)) {
    findings.push('src/styles/components/_tabs.scss:1 按钮型 TAB 未使用全局独立边框')
  }

  if (!/\.tf-page-tabs\.el-tabs[\s\S]*?\.el-tabs__item\s*\{[\s\S]*?border:\s*1px\s+solid\s+var\(--tf-tab-border\)\s*!important/.test(globalTabStyle)) {
    findings.push('src/styles/components/_tabs.scss:1 Element Plus TAB 未使用全局独立边框')
  }

  if (!/\.el-tabs__nav-prev,[\s\S]*?\.el-tabs__nav-next\s*\{\s*display:\s*none\s*;/.test(globalTabStyle)) {
    findings.push('src/styles/components/_tabs.scss TAB 不得显示左右切换箭头')
  }
  for (const selector of ['.tf-page-tabs.tab-navigation', '.tf-page-tabs.el-tabs', '.tf-page-tabs.el-tabs > .el-tabs__header']) {
    const start = globalTabStyle.indexOf(`${selector} {`)
    const body = globalTabStyle.slice(start, globalTabStyle.indexOf('}', start))
    if (start < 0 || !/min-width:\s*0\s*;/.test(body) || !/max-width:\s*100%\s*;/.test(body) || !/box-sizing:\s*border-box\s*;/.test(body)) {
      findings.push(`src/styles/components/_tabs.scss ${selector} 必须限制在父容器可用宽度内并允许收缩`)
    }
  }
  if (!/\.el-tabs__nav\s*\{[^}]*transform:\s*none\s*!important/.test(globalTabStyle)) {
    findings.push('src/styles/components/_tabs.scss 原生 TAB 滚动不得叠加框架位移')
  }
  for (const fragment of ['initPageTabScroll', 'scrollLeft', 'MutationObserver', "addEventListener('wheel'", '.tf-compact-toolbar']) {
    if (!tabScrollSource.includes(fragment)) findings.push(`src/utils/page-tab-scroll.ts 缺少统一滚动行为：${fragment}`)
  }
  if (!hasRuntimeModuleImport(mainSource, '@/utils/page-tab-scroll') || !/initPageTabScroll\(\)/.test(mainSource)) {
    findings.push('src/main.ts 必须初始化全局 TAB 原生滚动')
  }

  for (const fragment of ['tf-topbar-tabs', 'tf-topbar-tab', 'is-active']) {
    if (!tabsBarSource.includes(fragment)) findings.push(`src/components/TabsBar.vue 页头 TAB 缺少统一接入标记：${fragment}`)
  }
  for (const fragment of ['--tf-tab-bg:', '--tf-tab-active-bg:', '--tf-tab-hover-bg:']) {
    if (!globalTabStyle.includes(fragment)) findings.push(`src/styles/components/_tabs.scss 页头 TAB 缺少公共状态令牌：${fragment}`)
  }

  const files = walk(sourceRoot).map(file => ({ file, source: readFileSync(file, 'utf8') }))
  const aliases = new Set()
  const styleSources = []
  for (const { file, source } of files) {
    const relativeFile = relative(root, file)
    if (!file.endsWith('.vue')) {
      if (file !== globalTabStylePath) styleSources.push({ file: relativeFile, source, offset: 0 })
      continue
    }
    const { descriptor } = parse(source, { filename: file })
    const templateFindings = []
    auditTabTemplate(descriptor.template?.ast, aliases, templateFindings)
    for (const { line, message } of templateFindings) findings.push(`${relativeFile}:${line} ${message}`)
    for (const style of descriptor.styles) {
      if (!style.src) styleSources.push({ file: relativeFile, source: style.content, offset: style.loc.start.line - 1 })
    }
  }

  for (const style of styleSources) {
    for (const { line, message } of auditPrivateTabStyles(style.source, style.file, aliases)) {
      findings.push(`${style.file}:${style.offset + line} ${message}`)
    }
  }

  if (findings.length) {
    console.error(`TAB 统一审计失败，共 ${findings.length} 处：`)
    for (const finding of findings) console.error(`- ${finding}`)
    process.exit(1)
  }

  console.log('TAB 统一审计通过：标签导航接入公共样式，未发现私有滚动条、回弹或尺寸覆盖。')
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) run()
