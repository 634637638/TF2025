import { readFileSync, readdirSync, statSync } from 'node:fs'
import { extname, join, relative, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const viewsRoot = join(root, 'src/views')
const adminLayoutSource = readFileSync(join(root, 'src/styles/admin-layout.css'), 'utf8')
const tableStyleSource = readFileSync(join(root, 'src/styles/components/_table.scss'), 'utf8')
const mainSource = readFileSync(join(root, 'src/main.ts'), 'utf8')
const tableDragSource = readFileSync(join(root, 'src/utils/admin-table-drag-scroll.ts'), 'utf8')

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

const requiredTableVariables = [
  'admin-data-table-radius',
  'admin-data-table-bg',
  'admin-data-table-container-border',
  'admin-data-table-header-bg',
  'admin-data-table-header-color',
  'admin-data-table-header-padding-y',
  'admin-data-table-header-padding-x',
  'admin-data-table-header-height',
  'admin-data-table-header-font-size',
  'admin-data-table-header-font-weight',
  'admin-data-table-cell-padding-y',
  'admin-data-table-cell-padding-x',
  'admin-data-table-row-height',
  'admin-data-table-cell-font-size',
  'admin-data-table-cell-font-weight',
  'admin-data-table-cell-color',
  'admin-data-table-cell-border',
  'admin-data-table-row-even-bg',
  'admin-data-table-row-hover-bg',
  'admin-data-table-row-selected-bg',
  'admin-data-table-row-selected-hover-bg',
  'admin-data-table-line-height'
]

for (const variable of requiredTableVariables) {
  if (!new RegExp(`--${variable}\\s*:`).test(adminLayoutSource)) {
    findings.push(`src/styles/admin-layout.css 缺少公共表格变量 --${variable}，颜色、字体、尺寸和状态不得脱离全局控制`)
  }
}

const publicStyleRequirements = [
  [/background:\s*var\(--admin-data-table-header-bg\)\s*!important/i, '公共表头背景必须读取 --admin-data-table-header-bg'],
  [/color:\s*var\(--admin-data-table-header-color\)\s*!important/i, '公共表头文字颜色必须读取 --admin-data-table-header-color'],
  [/font-size:\s*var\(--admin-data-table-header-font-size\)\s*!important/i, '公共表头字体必须读取 --admin-data-table-header-font-size'],
  [/height:\s*var\(--admin-data-table-header-height\)\s*!important/i, '公共表头高度必须读取 --admin-data-table-header-height'],
  [/font-size:\s*var\(--admin-data-table-cell-font-size\)\s*!important/i, '公共单元格字体必须读取 --admin-data-table-cell-font-size'],
  [/height:\s*var\(--admin-data-table-row-height\)\s*!important/i, '公共行高必须读取 --admin-data-table-row-height'],
  [/background:\s*var\(--admin-data-table-row-hover-bg\)\s*!important/i, '公共悬停颜色必须读取 --admin-data-table-row-hover-bg'],
  [/background:\s*var\(--admin-data-table-row-selected-bg\)\s*!important/i, '公共选中颜色必须读取 --admin-data-table-row-selected-bg']
]

for (const [pattern, message] of publicStyleRequirements) {
  if (!pattern.test(adminLayoutSource)) findings.push(`src/styles/admin-layout.css ${message}`)
}

const tableStructureRequirements = [
  [/\.data-table\s+\.el-table__body-wrapper[\s\S]*?white-space:\s*normal\s*!important/i, '统一表格必须提供普通字段完整换行兜底'],
  [/\.complete-text-column[\s\S]*?white-space:\s*nowrap\s*!important/i, '完整文本列必须保持单行并由内容宽度工具计算'],
  [/\.ellipsis-text-column[\s\S]*?text-overflow:\s*ellipsis\s*!important/i, '长文本省略例外必须使用明确的 ellipsis-text-column'],
  [/\.data-table\s+\.el-table__header-wrapper,[\s\S]*?\.admin-data-table\s+\.el-table__footer-wrapper[\s\S]*?overflow-x:\s*hidden\s*!important/i, '统一表头和汇总行必须允许通过 scrollLeft 与表体同步'],
  [/\.data-table\s+\.el-scrollbar__wrap[\s\S]*?overflow-x:\s*auto\s*!important/i, '统一表格必须保留 Element 内部横向滚动层'],
  [/\.el-scrollbar__bar\.is-horizontal[\s\S]*?display:\s*none\s*!important/i, '统一表格必须隐藏视觉横向滚动条']
]

for (const [pattern, message] of tableStructureRequirements) {
  if (!pattern.test(tableStyleSource)) findings.push(`src/styles/components/_table.scss ${message}`)
}

if (!/import\s*\{\s*initAdminTableDragScroll\s*\}\s*from\s*['"]@\/utils\/admin-table-drag-scroll['"]/.test(mainSource)) {
  findings.push('src/main.ts 必须导入全局 initAdminTableDragScroll，保证 PC 超宽表格可用鼠标拖动')
}
if (!/\binitAdminTableDragScroll\s*\(\s*\)/.test(mainSource)) {
  findings.push('src/main.ts 必须在应用初始化时调用 initAdminTableDragScroll')
}

const dragScrollRequirements = [
  [/TABLE_SELECTOR\s*=\s*['"]\.data-table, \.admin-data-table['"]/, '拖动功能必须覆盖 data-table 和 admin-data-table'],
  [/scrollWidth\s*>\s*scroller\.clientWidth/, '无超宽内容时不得错误启动拖动'],
  [/table\.querySelectorAll<HTMLElement>\(SCROLLER_SELECTOR\)/, '表头和表体非交互区域必须共同定位 Element 内部实际滚动层'],
  [/\.el-table__header-wrapper, \.el-table__footer-wrapper/, '横向移动必须同步表头和汇总行'],
  [/addEventListener\(['"]scroll['"]/, '原生触摸和触控板滚动必须同步表头'],
  [/addEventListener\(['"]pointerdown['"]/, 'PC 必须支持鼠标按住拖动'],
  [/event\.pointerType\s*!==\s*['"]mouse['"]/, '鼠标拖动不得拦截手机原生触摸']
]

for (const [pattern, message] of dragScrollRequirements) {
  if (!pattern.test(tableDragSource)) findings.push(`src/utils/admin-table-drag-scroll.ts ${message}`)
}

const teleportedTableRequirements = [
  [/:is\(\.data-table\.el-table, \.devices-table\.el-table, \.admin-data-table\.el-table\)\s*\{[\s\S]*?min-width:\s*100%\s*!important[\s\S]*?max-width:\s*100%\s*!important/i, '统一 Element 表格根节点必须限制在容器宽度内，禁止外层形成第二个横向滚动层'],
  [/:is\(\.data-table\.el-table, \.devices-table\.el-table, \.admin-data-table\.el-table\)\.compact-fit-table\s*\{[\s\S]*?min-width:\s*100%\s*!important/i, 'compact-fit-table 必须直接由统一表格 class 覆盖为 min-width: 100%，禁止继承 1200px 形成外层横向滚动'],
  [/:is\(\.data-table\.el-table, \.devices-table\.el-table, \.admin-data-table\.el-table\)\s+\.el-table__header th\s*\{[\s\S]*?background:\s*var\(--admin-data-table-header-bg\)\s*!important/i, '统一表头样式不得依赖 .admin-page，Teleport 弹窗必须与页面表格一致'],
  [/:is\(\.data-table\.el-table, \.devices-table\.el-table, \.admin-data-table\.el-table\)\s+\.el-table__body td\s*\{[\s\S]*?height:\s*var\(--admin-data-table-row-height\)\s*!important/i, '统一单元格样式不得依赖 .admin-page，Teleport 弹窗必须继承公共行高和字体']
]

for (const [pattern, message] of teleportedTableRequirements) {
  if (!pattern.test(adminLayoutSource)) findings.push(`src/styles/admin-layout.css ${message}`)
}

if (!/:is\(\.data-table\.el-table, \.devices-table\.el-table, \.admin-data-table\.el-table\)\s+td\.actions-column \.cell\s*\{[\s\S]*?padding-inline:\s*var\(--admin-data-table-action-edge-space/i.test(tableStyleSource)) {
  findings.push('src/styles/components/_table.scss 弹窗操作列必须直接由统一表格 class 命中，不得依赖 .admin-page 祖先')
}

for (const file of walk(viewsRoot)) {
  const source = readFileSync(file, 'utf8')
  const relativeFile = relative(root, file)
  const usesCompactFitTable = /<el-table(?=\s|>)[^>]*\bclass=["'][^"']*\bcompact-fit-table\b/i.test(source)
  const isPublicDisplayView = /class=["'][^"']*\bpublic-price-query\b/i.test(source)

  for (const style of source.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)) {
    const styleSource = style[1]

    for (const customVariable of styleSource.matchAll(/--admin-data-table-[\w-]+\s*:/gi)) {
      const line = lineNumber(source, style.index + customVariable.index)
      findings.push(`${relativeFile}:${line} 页面不得重定义 --admin-data-table-*；表格颜色、字体、行高、间距和宽度策略只能由公共方案控制`)
    }

    for (const rule of styleSource.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      const selector = rule[1]
      const declarations = rule[2]
      const line = lineNumber(source, style.index + rule.index)

      if (usesCompactFitTable && /\.table-responsive\b/.test(selector)) {
        findings.push(`${relativeFile}:${line} compact-fit-table 页面不得覆盖公共 .table-responsive，横向移动只能由 Element 内部滚动层负责`)
      }

      if (/\.actions-column\b/.test(selector)) {
        findings.push(`${relativeFile}:${line} 业务页面不得覆盖公共 .actions-column，列布局只能由全局表格样式控制`)
      }

      if (isPublicDisplayView) continue

      const targetsUnifiedTable = /\.(?:data-table|admin-data-table|devices-table|el-table|el-scrollbar__(?:wrap|bar))(?:\b|(?=[.:]))/i.test(selector)
      const targetsPublicStructure = /(?:el-table__(?:header|body|footer|cell|inner-wrapper|row)|el-scrollbar__(?:wrap|bar)|\b(?:thead|tbody|th|td|tr)\b)/i.test(selector)
      const isAllowedBusinessStructure = /(?:mobile-action-row|mobile-expand-column|el-table__expand(?:ed-cell|-column|-icon)|detail-icon)/i.test(selector)
      const changesPublicVisual = /(?:^|;)\s*(?:--el-table-[\w-]+|background(?:-color)?|color|font(?:-size|-weight|-family)?|height|min-height|padding(?:-(?:top|right|bottom|left|inline|block))?|border(?:-(?:color|width|style|radius|top|right|bottom|left))?|text-align|line-height|letter-spacing|overflow-x|overflow-y|scrollbar-width|table-layout)\s*:/im.test(declarations)

      if (targetsUnifiedTable && targetsPublicStructure && changesPublicVisual && !isAllowedBusinessStructure) {
        findings.push(`${relativeFile}:${line} 页面不得覆盖统一表格的颜色、字体、行高、间距、边框或滚动结构；请修改公共变量或使用业务字段 class`)
      }
    }
  }

  for (const match of source.matchAll(/<el-table(?=\s|>)[^>]*>/gi)) {
    const tag = match[0]
    const line = lineNumber(source, match.index)
    if (!/\bclass=["'][^"']*\b(?:data-table|admin-data-table)\b/i.test(tag)) {
      findings.push(`${relativeFile}:${line} Element 表格必须接入公共 data-table/admin-data-table 样式`)
    }

    if (/\bclass=["'][^"']*\bcompact-fit-table\b/i.test(tag)) {
      const tableEnd = source.indexOf('</el-table>', match.index)
      const tableSource = tableEnd === -1 ? tag : source.slice(match.index, tableEnd)
      const columns = [...tableSource.matchAll(/<el-table-column\b(?:[^>"']|"[^"]*"|'[^']*')*>/gi)].map(column => column[0])

      if (!/:fit=["']true["']/i.test(tag)) {
        findings.push(`${relativeFile}:${line} compact-fit-table 必须使用 :fit="true"，由普通列按最小宽度共同分配剩余空间`)
      }

      let hasAdaptiveContentColumn = false
      for (const column of columns) {
        const isSpecialColumn = /\b(?:type=["'](?:selection|expand|index)["']|label=["']操作["'])/i.test(column)
        if (!isSpecialColumn && /\b:?min-width=/i.test(column)) hasAdaptiveContentColumn = true
      }

      if (!hasAdaptiveContentColumn) {
        findings.push(`${relativeFile}:${line} compact-fit-table 至少一个普通字段必须使用 min-width，确保整表铺满且剩余空间由字段共同分配`)
      }
    }
  }

  for (const match of source.matchAll(/<el-table-column\b[^>]*\bshow-overflow-tooltip\b[^>]*>/gi)) {
    const tag = match[0]
    const line = lineNumber(source, match.index)
    if (!/\bclass-name=["'][^"']*\bellipsis-text-column\b/i.test(tag)) {
      findings.push(`${relativeFile}:${line} 普通字段不得用 show-overflow-tooltip 截断；请使用 complete-text-column 或 wrapped-text-column 完整展示`)
    }
  }

  for (const match of source.matchAll(/<el-table-column\b[^>]*\blabel=["']操作["'][^>]*>/gi)) {
    const tag = match[0]
    const line = lineNumber(source, match.index)
    const compact = /\bclass-name=["'][^"']*\bcompact-action-column\b/i.test(tag)
    const dynamicWidth = /:width=["'](?:[^"']*ActionColumnWidth|[^"']*\$?get(?:Adaptive)?ActionColumnMin?Width\s*\()[^"']*["']/i.test(tag)
    const columnEnd = source.indexOf('</el-table-column>', match.index)
    const columnSource = columnEnd === -1 ? tag : source.slice(match.index, columnEnd)

    if (/@click(?!\.stop)(?:\.[\w-]+)*=/i.test(columnSource)) {
      findings.push(`${relativeFile}:${line} 操作按钮必须使用 @click.stop，避免触发行点击或手机连续点击展开`)
    }

    if (compact) continue

    if (!/\bclass=["'][^"']*\b(?:action-buttons|table-actions|tf-table-actions)\b/i.test(columnSource)) {
      findings.push(`${relativeFile}:${line} 主列表操作按钮必须放入公共 action-buttons/table-actions 容器`)
    }
    let hasLongStaticButtonLabel = false
    for (const button of columnSource.matchAll(/<el-button\b[^>]*>([\s\S]*?)<\/el-button>/gi)) {
      const visibleText = button[1]
        .replace(/<[^>]+>/g, ' ')
        .replace(/\{\{[\s\S]*?\}\}/g, '动态文字')
        .replace(/\s+/g, '')
      if (!visibleText) {
        findings.push(`${relativeFile}:${line} PC 主列表操作按钮必须显示中文文字；纯图标仅允许 compact-action-column`)
      }

      const staticText = button[1]
        .replace(/<[^>]+>/g, ' ')
        .replace(/\{\{[\s\S]*?\}\}/g, ' ')
        .replace(/\s+/g, '')
      if (/[\u3400-\u9fff]{3,}/u.test(staticText)) hasLongStaticButtonLabel = true
    }

    if (!/\bclass-name=["'][^"']*\bactions-column\b/i.test(tag)) {
      findings.push(`${relativeFile}:${line} 主列表操作列必须使用 class-name="actions-column"`)
    }
    if (!dynamicWidth) {
      findings.push(`${relativeFile}:${line} 主列表操作列必须用公共宽度函数，或绑定名称以 ActionColumnWidth 结尾的响应式结果`)
    }
    if (hasLongStaticButtonLabel && /\$getActionColumnWidth\(\s*(?!\[)/i.test(tag)) {
      findings.push(`${relativeFile}:${line} 三字以上操作按钮必须向 $getActionColumnWidth 传入文字数组，不能只按按钮数量计算`)
    }
    if (/\bfixed(?:=["'][^"']*["'])?/i.test(tag)) {
      findings.push(`${relativeFile}:${line} 操作列不得 fixed，必须和表头内容处于同一同步滚动层`)
    }
    if (/\b(?:min-width|width)=["']\d+/i.test(tag)) {
      findings.push(`${relativeFile}:${line} 操作列不得写死数字 width/min-width`)
    }
  }
}

if (findings.length) {
  console.error(`表格布局统一审计失败，共 ${findings.length} 处：`)
  for (const finding of findings) console.error(`- ${finding}`)
  process.exit(1)
}

console.log('表格布局统一审计通过：表格已接入公共样式，内容完整展示，操作列使用公共自适应规则。')
