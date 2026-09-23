import { readFileSync, readdirSync, statSync } from 'node:fs'
import { extname, join, relative, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const sourceRoot = join(root, 'src')
const mainSource = readFileSync(join(root, 'src/main.ts'), 'utf8')
const stylesSource = readFileSync(join(root, 'src/styles.scss'), 'utf8')
const paginationSource = readFileSync(join(root, 'src/components/Pagination.vue'), 'utf8')
const searchSource = readFileSync(join(root, 'src/components/search/UnifiedSearchPanel.vue'), 'utf8')
const dateRangeSource = readFileSync(join(root, 'src/components/DateRangePicker.vue'), 'utf8')
const customerNameLockSource = readFileSync(join(root, 'src/components/common/CustomerNameLockInput.vue'), 'utf8')
const dialogStyleSource = readFileSync(join(root, 'src/styles/components/_dialog.scss'), 'utf8')
const dialogActionsSource = readFileSync(join(root, 'src/styles/components/_dialog-actions.scss'), 'utf8')
const paginationStyleSource = readFileSync(join(root, 'src/styles/components/_pagination.scss'), 'utf8')

function walk(directory, files = []) {
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry)
    const stat = statSync(path)
    if (stat.isDirectory()) walk(path, files)
    else if (extname(path) === '.vue') files.push(path)
  }
  return files
}

function lineNumber(source, index) {
  return source.slice(0, index).split('\n').length
}

const findings = []
const requireToken = (source, token, file, message) => {
  if (!source.includes(token)) findings.push(`${file} ${message}`)
}

requireToken(mainSource, "import './styles/components/_dialog.scss'", 'src/main.ts', '必须全局加载统一 Dialog 样式')
requireToken(mainSource, "import './styles/components/_dialog-actions.scss'", 'src/main.ts', '必须全局加载统一 Dialog footer 样式')
requireToken(stylesSource, "@use './styles/components/_pagination.scss' as *;", 'src/styles.scss', '必须全局加载统一分页样式')
requireToken(paginationSource, 'class="tf-pagination"', 'src/components/Pagination.vue', '公共分页组件必须保留 tf-pagination 根节点')
requireToken(searchSource, 'class="unified-search-panel"', 'src/components/search/UnifiedSearchPanel.vue', '公共搜索组件必须保留 unified-search-panel 根节点')
requireToken(searchSource, '.filter-item--date-range', 'src/components/search/UnifiedSearchPanel.vue', '公共搜索组件必须统一维护日期范围筛选宽度')
requireToken(dateRangeSource, 'placement="bottom-start"', 'src/components/DateRangePicker.vue', '公共日期范围组件必须从输入框下方展开')
requireToken(customerNameLockSource, 'class="customer-name-lock-input"', 'src/components/common/CustomerNameLockInput.vue', '公共客户姓名组件必须保留 customer-name-lock-input 根节点')
requireToken(customerNameLockSource, 'title="更换客户"', 'src/components/common/CustomerNameLockInput.vue', '客户姓名锁定与更换客户必须保持独立操作')
requireToken(dialogStyleSource, '--tf-dialog-body-padding-inline', 'src/styles/components/_dialog.scss', 'Dialog 正文间距必须由公共变量控制')
requireToken(dialogStyleSource, '.mobile-dialog-sheet-body', 'src/styles/components/_dialog.scss', 'MobileDialog 滚动容器必须接入公共 Dialog 样式')
requireToken(dialogStyleSource, '.el-dialog__body::-webkit-scrollbar', 'src/styles/components/_dialog.scss', 'Dialog 必须隐藏可见滚动条并保留滚动能力')
requireToken(dialogActionsSource, '.tf-dialog-actions', 'src/styles/components/_dialog-actions.scss', 'Dialog footer 必须提供 tf-dialog-actions 公共布局')
requireToken(paginationStyleSource, '.pagination-wrapper', 'src/styles/components/_pagination.scss', '分页外层兼容布局必须由公共样式控制')

for (const file of walk(sourceRoot)) {
  const source = readFileSync(file, 'utf8')
  const relativeFile = relative(root, file)
  // Views may keep route-level pages and page-internal sections in separate
  // directories. Only the latter should not be required to render the app
  // shell themselves.
  const isViewComponent = relativeFile.startsWith('src/views/') && (
    relativeFile.includes('/components/') ||
    relativeFile.includes('/page/')
  )
  const isPublicImplementation = [
    'src/components/Pagination.vue',
    'src/components/search/UnifiedSearchPanel.vue',
    'src/components/DateRangePicker.vue',
    'src/components/common/CustomerNameLockInput.vue'
  ].includes(relativeFile)

  if (source.includes('<CustomerSearchDropdown') && source.includes('customer_name') && !source.includes('<CustomerNameLockInput')) {
    findings.push(`${relativeFile}:1 使用客户检索并展示客户姓名时必须接入 CustomerNameLockInput`)
  }

  if (relativeFile !== 'src/components/common/CustomerNameLockInput.vue' && /customer-lock-button|customer-name-group/.test(source)) {
    findings.push(`${relativeFile}:1 不得复制客户姓名锁控件，必须使用 CustomerNameLockInput`)
  }

  if (relativeFile.startsWith('src/views/') && /(?:GlobalSearch|CustomSearch)/.test(source)) {
    findings.push(`${relativeFile}:1 后台列表不得使用已废弃的 GlobalSearch/CustomSearch，必须接入 UnifiedSearchPanel`)
  }

  for (const panel of source.matchAll(/<UnifiedSearchPanel\b[^>]*>([\s\S]*?)<\/UnifiedSearchPanel>/gi)) {
    const panelSource = panel[1]
    const panelStart = panel.index + panel[0].indexOf(panelSource)

    for (const rangePicker of panelSource.matchAll(/<DateRangePicker\b/gi)) {
      const beforePicker = panelSource.slice(0, rangePicker.index)
      const parentStart = beforePicker.lastIndexOf('<div')
      const parentEnd = parentStart >= 0 ? beforePicker.indexOf('>', parentStart) : -1
      const parentTag = parentEnd >= 0 ? beforePicker.slice(parentStart, parentEnd + 1) : ''
      if (!/class=["'][^"']*\bfilter-item--date-range\b/i.test(parentTag)) {
        findings.push(`${relativeFile}:${lineNumber(source, panelStart + rangePicker.index)} DateRangePicker 的筛选项必须声明 filter-item--date-range`)
      }
    }

    for (const nativeRange of panelSource.matchAll(/<el-date-picker\b[^>]*\btype=["'](?:daterange|datetimerange|monthrange|dates)["']/gi)) {
      findings.push(`${relativeFile}:${lineNumber(source, panelStart + nativeRange.index)} 日期范围筛选必须使用公共 DateRangePicker`)
    }
  }

  if (!relativeFile.endsWith('components/Pagination.vue')) {
    for (const match of source.matchAll(/<el-pagination\b/gi)) {
      findings.push(`${relativeFile}:${lineNumber(source, match.index)} 页面不得直接使用 el-pagination，必须使用公共 Pagination 组件`)
    }
  }

  for (const footer of source.matchAll(/<template\s+#footer\b[^>]*>([\s\S]*?)<\/template>/gi)) {
    if (!/<el-button\b/i.test(footer[1])) continue
    if (/^\s*<el-button\b/i.test(footer[1])) continue
    if (/class=["'][^"']*(?:\btf-dialog-actions\b|\b[\w-]*(?:dialog|modal)-footer\b|\bfooter-actions\b|\bdefault-footer\b|\bconfirm-footer\b)[^"']*["']/i.test(footer[1])) continue
    findings.push(`${relativeFile}:${lineNumber(source, footer.index)} 弹窗 footer 按钮必须放入 tf-dialog-actions；历史 *-dialog-footer/*-modal-footer 仅作兼容`)
  }

  if (relativeFile.startsWith('src/views/') && !isViewComponent && !relativeFile.startsWith('src/views/H5-') && /<PageHeader\b/i.test(source)) {
    if (!/class=["'][^"']*\badmin-page\b/i.test(source)) {
      findings.push(`${relativeFile}:1 使用 PageHeader 的后台页面根节点必须接入 admin-page`)
    }
    if (!/class=["'][^"']*\badmin-page-content\b/i.test(source)) {
      findings.push(`${relativeFile}:1 使用 PageHeader 的后台页面必须提供 admin-page-content 内容容器`)
    }
  }

  for (const style of source.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)) {
    if (isPublicImplementation) continue
    const styleSource = style[1]
    const forbiddenPublicSelector = /\.(?:unified-search-panel(?:__[\w-]+)?|tf-pagination(?:__[\w-]+)?|el-pagination|tf-dialog-actions)\b/g
    for (const match of styleSource.matchAll(forbiddenPublicSelector)) {
      const absoluteIndex = style.index + style[0].indexOf(styleSource) + match.index
      findings.push(`${relativeFile}:${lineNumber(source, absoluteIndex)} 页面不得覆盖公共 UI 结构 ${match[0]}，请修改对应全局实现`)
    }
  }
}

if (findings.length) {
  console.error(`统一 UI 结构审计失败，共 ${findings.length} 处：`)
  for (const finding of findings) console.error(`- ${finding}`)
  process.exit(1)
}

console.log('统一 UI 结构审计通过：Dialog、搜索、分页和后台页面结构均接入公共方案。')
