import { readdir, readFile } from 'node:fs/promises'
import { extname, join, relative } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { parse } from '@vue/compiler-sfc'

const sourceRoot = fileURLToPath(new URL('../src/', import.meta.url))
const standardsViewSource = await readFile(join(sourceRoot, 'views/standards/StandardsAuditView.vue'), 'utf8')
const elementButtonPattern = /<el-button\b(?:(?!<el-button\b|<\/el-button>)[\s\S])*?<\/el-button>/gi
const spinnerPattern = /<InlineLoading\b|fa-spinner|fa-spin|loading-spinner|\bis-loading\b/i
const buttonInlineLoadingExceptions = new Map(Object.entries({
  'views/data-optimization/page/DataCheckTab.vue': 1,
  'views/data-optimization/page/DataImportTab.vue': 2,
  'views/employees/EmployeesView.vue': 3,
  'views/menu/MenuManagementView.vue': 2,
  'views/permissions/page/ModuleFieldPermissionDialog.vue': 1,
  'views/permissions/page/ModuleManagementView.vue': 3,
  'views/permissions/page/RoleFieldPermissionDialog.vue': 1,
  'views/permissions/page/RoleFormDialog.vue': 1,
  'views/permissions/page/StoreBindingDialog.vue': 1,
  'views/permissions/page/UserRoleAssignmentDialog.vue': 1,
  'views/salary/page/SalaryAttendanceFormDialog.vue': 1,
  'views/salary/page/SalaryEditPayoutDialog.vue': 1,
  'views/salary/page/SalarySettleDialog.vue': 1,
  'views/salary/page/SalaryTemplateFormDialog.vue': 1,
  'views/subsidy/SubsidyView.vue': 1,
  'views/subsidy/components/SubsidyApplyDialog.vue': 3,
  'views/subsidy/components/SubsidyEditDialog.vue': 1,
  'views/system/page/Returngoods.vue': 1
}))
const loadingDirectiveExceptions = new Map([
  ['components/PriceMarkupConfig.vue', { count: 1, reason: '配置弹窗需保留表单字段并在加载期间覆盖内容' }]
])
const globalLoadingTriggerExceptions = new Map([
  ['views/standards/StandardsAuditView.vue', { count: 1, reason: '规范页演示必须调用统一全局 Loading Store' }],
  ['views/data-optimization/page/DataCheckTab.vue', { count: 5, reason: '数据清理、批量合并和删除是明确的全局长操作；与表格查询属于不同操作，不能共用同一 Loading 反馈' }]
])
const asyncLoadingDelegationExceptions = new Map([
  ['components/ReminderHost.vue', '后台轮询提醒属于静默探测，弹窗只在有新提醒时出现，不应覆盖当前页面'],
  ['views/analytics/page/ProfitAnalytics.vue', '分析子页由 AnalyticsView 统一传入 loading，并由父级搜索区域承载反馈'],
  ['views/salary/SalaryView.vue', '工资页由各 Tab 和详情弹窗分别承载模板、员工、发放、考勤和销售明细 Loading']
])
const buttonExceptionReason = '遗留操作按钮内部仍使用 InlineLoading；迁移为 el-button :loading 后下调此数量'

const collectVueFiles = async (directory) => {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = await Promise.all(entries.map(async (entry) => {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) return collectVueFiles(path)
    return extname(entry.name) === '.vue' ? [path] : []
  }))
  return files.flat()
}

const getLineNumber = (source, index) => source.slice(0, index).split('\n').length
const countMatches = (source, pattern) => [...source.matchAll(pattern)].length
const files = await collectVueFiles(sourceRoot)
const violations = []
let tableLoadingRowCount = 0
let sectionLoadingCount = 0
let inlineLoadingCount = 0
let buttonInlineLoadingCount = 0
let loadingDirectiveCount = 0
let tableDirectiveCount = 0
let pageFileCount = 0
let componentFileCount = 0
let appFileCount = 0
const pageAuditRecords = []

const standardsLoadingRequirements = [
  [/global-loading-standard\.md/, '规范与审计标杆页必须登记全局 Loading 规范预览'],
  [/runPreviewLoading/, '规范与审计标杆页全局 Loading 必须提供可点击演示入口'],
  [/loadingStore\.startLoading\(/, '规范与审计标杆页演示必须调用统一 Loading Store'],
  [/演示 Loading/, '规范与审计标杆页必须显示“演示 Loading”按钮']
]
for (const [pattern, message] of standardsLoadingRequirements) {
  if (!pattern.test(standardsViewSource)) violations.push(`views/standards/StandardsAuditView.vue ${message}`)
}

const loadingStoreSource = await readFile(join(sourceRoot, 'stores/loading.ts'), 'utf8')
const globalLoadingSource = await readFile(join(sourceRoot, 'components/GlobalLoading.vue'), 'utf8')
const refreshDataSource = await readFile(join(sourceRoot, 'composables/useRefreshData.ts'), 'utf8')
const unifiedApiSource = await readFile(join(sourceRoot, 'utils/unified-api.ts'), 'utf8')
for (const [source, token, message] of [
  [loadingStoreSource, 'isGlobalVisible', 'Loading Store 必须提供全局/局部互斥可见状态'],
  [loadingStoreSource, 'if (hasLocalLoading.value) return', '局部 Loading 期间不得启动全屏 Loading'],
  [globalLoadingSource, 'loadingStore.isGlobalVisible', 'GlobalLoading 必须读取互斥可见状态'],
  [globalLoadingSource, '() => loadingStore.isGlobalVisible', 'GlobalLoading 必须按互斥后的可见状态启动延迟显示'],
  [await readFile(join(sourceRoot, 'directives/index.ts'), 'utf8'), '_tfLoadingInitialPending', '表格指令必须区分首次加载和后续刷新'],
  [await readFile(join(sourceRoot, 'components/TableLoadingRow.vue'), 'utf8'), "'加载中...' ? '加载数据中...'", '表格兜底文案必须统一为“加载数据中...”'],
  [unifiedApiSource, 'requestConfig.showLoading === undefined', '统一 API 必须默认启用首次请求的全局 Loading，showLoading: false 才允许静默'],
  [refreshDataSource, 'loadingStore.startLocalLoading()', '公共刷新入口必须登记局部 Loading']
]) {
  if (!source.includes(token)) violations.push(message)
}

for (const file of files) {
  const source = await readFile(file, 'utf8')
  const filePath = relative(sourceRoot, file)
  if (filePath.startsWith('views/')) pageFileCount += 1
  else if (filePath.startsWith('components/')) componentFileCount += 1
  else if (filePath === 'App.vue') appFileCount += 1
  const { descriptor, errors } = parse(source, { filename: file })
  if (errors.length > 0) {
    violations.push(`${filePath} Vue SFC 解析失败，无法可靠审计 loading 模板`)
    continue
  }
  const template = descriptor.template?.content || ''
  const templateStartLine = descriptor.template?.loc.start.line || 1
  const styleBlocks = descriptor.styles.map(style => style.content)
  const hasTableMarkup = /<el-table\b|<table\b/i.test(template)
  const hasTableDirective = /\bv-tf-loading(?:\s*=|(?=[\s/>]))/.test(template)
  const hasTableFallback = /<TableLoadingRow\b/.test(template)
  const hasSectionLoading = /<SectionLoading\b/.test(template)
  const hasInlineLoading = /<InlineLoading\b/.test(template)
  const hasElementLoading = /\bv-loading(?:\s*=|(?=[\s/>]))/.test(template)
  const hasButtonLoading = /<el-button\b[\s\S]*?:loading\s*=/.test(template)
  const hasAsyncRequest = /\b(?:unifiedApi|publicApi|axios|api)\.(?:get|post|put|patch|delete)\s*\(|\bfetch\s*\(/.test(source)
  const globalLoadingTriggerCount = countMatches(source, /\b(?:globalLoading|loadingStore|useLoadingStore\(\))\.startLoading\s*\(/g)
  const hasLocalLoading = hasTableDirective || hasTableFallback || hasSectionLoading || hasInlineLoading || hasElementLoading || hasButtonLoading

  pageAuditRecords.push({
    filePath,
    scope: filePath.startsWith('views/') ? '页面/功能单元' : filePath.startsWith('components/') ? '公共组件' : '应用入口',
    hasTableMarkup,
    hasTableDirective,
    hasTableFallback,
    hasSectionLoading,
    hasInlineLoading,
    hasElementLoading,
    hasButtonLoading,
    hasAsyncRequest,
    hasLocalLoading,
    globalLoadingTriggerCount
  })

  if (hasTableDirective) tableDirectiveCount += 1
  if (globalLoadingTriggerCount > 0 && filePath !== 'App.vue') {
    const exception = globalLoadingTriggerExceptions.get(filePath)
    if (!exception) {
      violations.push(`${filePath} 直接触发全局 Loading；页面查询必须使用公共局部 Loading，明确长操作需登记例外`)
    } else if (globalLoadingTriggerCount > exception.count) {
      violations.push(`${filePath} 全局 Loading 触发从 ${exception.count} 增加到 ${globalLoadingTriggerCount}，不得扩大已登记例外`)
    }
  }
  if (hasTableDirective && globalLoadingTriggerCount > 0 && !globalLoadingTriggerExceptions.has(filePath)) {
    violations.push(`${filePath} 同时存在表格局部 Loading 和未登记全局 Loading 触发，必须按操作场景拆分并登记`)
  }
  if (hasAsyncRequest && !hasLocalLoading && !asyncLoadingDelegationExceptions.has(filePath)) {
    violations.push(`${filePath} 包含异步请求但没有公共 Loading 或父级承载登记`)
  }

  const globalLoadingMounts = countMatches(template, /<GlobalLoading\b/g)
  if (globalLoadingMounts > 0 && (filePath !== 'App.vue' || globalLoadingMounts !== 1)) {
    violations.push(`${filePath} GlobalLoading 只能在 App.vue 挂载一次，当前 ${globalLoadingMounts} 次`)
  }
  if (filePath === 'App.vue' && globalLoadingMounts !== 1) {
    violations.push(`App.vue 必须且只能挂载一次 GlobalLoading，当前 ${globalLoadingMounts} 次`)
  }

  tableLoadingRowCount += countMatches(template, /<TableLoadingRow\b/g)
  sectionLoadingCount += countMatches(template, /<SectionLoading\b/g)
  inlineLoadingCount += countMatches(template, /<InlineLoading\b/g)

  for (const match of template.matchAll(elementButtonPattern)) {
    if (!spinnerPattern.test(match[0])) continue
    buttonInlineLoadingCount += 1
    if (/:loading\s*=/.test(match[0])) {
      violations.push(`${filePath}:${getLineNumber(template, match.index) + templateStartLine - 1} el-button 同时启用了内置 loading 和第二个 spinner`)
    }
  }

  const buttonExceptionCount = [...template.matchAll(elementButtonPattern)]
    .filter(match => spinnerPattern.test(match[0])).length
  const buttonExceptionLimit = buttonInlineLoadingExceptions.get(filePath)
  if (buttonExceptionCount > 0 && buttonExceptionLimit === undefined) {
    violations.push(`${filePath} 新增 el-button 内联 spinner，改用 :loading 或登记迁移例外`)
  } else if (buttonExceptionCount > (buttonExceptionLimit || 0)) {
    violations.push(`${filePath} el-button 内联 spinner 从 ${buttonExceptionLimit} 增加到 ${buttonExceptionCount}`)
  }

  const directiveCount = countMatches(template, /\bv-loading(?:\s*=|(?=[\s/>]))/g)
  loadingDirectiveCount += directiveCount
  if (directiveCount > 0) {
    const exception = loadingDirectiveExceptions.get(filePath)
    if (!exception) {
      violations.push(`${filePath} 新增 v-loading，优先改用 TableLoadingRow/SectionLoading 或登记原因`)
    } else if (directiveCount > exception.count) {
      violations.push(`${filePath} v-loading 从 ${exception.count} 增加到 ${directiveCount}，不得扩大局部遮罩例外`)
    }
  }

  const loadingServiceCount = countMatches(source, /\bElLoading\.service\s*\(/g)
  if (loadingServiceCount > 0) {
    violations.push(`${filePath} 使用 ElLoading.service ${loadingServiceCount} 次；全屏加载应使用 useLoadingStore，局部加载应使用公共组件`)
  }

  if (/\b(?:fa-spinner|fa-spin)\b|class=["'][^"']*\bloading-spinner\b/i.test(template)) {
    violations.push(`${filePath} 模板中存在手写 spinner，请使用 InlineLoading、TableLoadingRow 或 SectionLoading`)
  }

  for (const style of styleBlocks) {
    const css = style.replace(/\/\*[\s\S]*?\*\//g, '')
    const spinner = /\.loading-spinner\b/g
    if (spinner.test(css)) violations.push(`${filePath} 禁止新增自绘 .loading-spinner 样式`)
  }
}

for (const requiredFile of ['components/PaginatedTable.vue', 'components/MobileTable.vue']) {
  const source = await readFile(join(sourceRoot, requiredFile), 'utf8')
  if (!/<TableLoadingRow\b/.test(source)) {
    violations.push(`${requiredFile} 必须使用公共 TableLoadingRow 作为表格加载入口`)
  }
}

for (const [filePath, limit] of buttonInlineLoadingExceptions) {
  const fullPath = join(sourceRoot, filePath)
  try {
    const source = await readFile(fullPath, 'utf8')
    const { descriptor, errors } = parse(source, { filename: fullPath })
    if (errors.length > 0) throw new Error('无法解析 Vue SFC')
    const template = descriptor.template?.content || ''
    const count = [...template.matchAll(elementButtonPattern)].filter(match => spinnerPattern.test(match[0])).length
    if (count > limit) violations.push(`${filePath} 按钮 loading 例外登记为 ${limit}，实际 ${count}`)
    if (count === 0) violations.push(`${filePath} 按钮 loading 例外已无实际用量，请删除过期登记`)
    if (!buttonExceptionReason) violations.push(`${filePath} 按钮 loading 例外必须记录迁移原因`)
  } catch {
    violations.push(`按钮 loading 例外登记指向不存在的文件：${filePath}`)
  }
}

for (const [filePath, exception] of loadingDirectiveExceptions) {
  if (!exception.reason) violations.push(`${filePath} 的 v-loading 例外必须记录原因`)
  try {
    const source = await readFile(join(sourceRoot, filePath), 'utf8')
    const { descriptor, errors } = parse(source, { filename: filePath })
    if (errors.length > 0) throw new Error('无法解析 Vue SFC')
    const count = countMatches(descriptor.template?.content || '', /\bv-loading(?:\s*=|(?=[\s/>]))/g)
    if (count === 0) violations.push(`${filePath} v-loading 例外已无实际用量，请删除过期登记`)
  } catch {
    violations.push(`v-loading 例外登记指向不存在或无法解析的文件：${filePath}`)
  }
}

for (const [filePath, exception] of globalLoadingTriggerExceptions) {
  if (!exception.reason) violations.push(`${filePath} 的全局 Loading 例外必须记录原因`)
  try {
    const source = await readFile(join(sourceRoot, filePath), 'utf8')
    const count = countMatches(source, /\b(?:globalLoading|loadingStore|useLoadingStore\(\))\.startLoading\s*\(/g)
    if (count === 0) violations.push(`${filePath} 全局 Loading 例外已无实际用量，请删除过期登记`)
    else if (count !== exception.count) violations.push(`${filePath} 全局 Loading 例外登记为 ${exception.count}，实际 ${count}`)
  } catch {
    violations.push(`全局 Loading 例外登记指向不存在的文件：${filePath}`)
  }
}

for (const [filePath, reason] of asyncLoadingDelegationExceptions) {
  if (!reason) violations.push(`${filePath} 的异步 Loading 委托例外必须记录原因`)
  try {
    const source = await readFile(join(sourceRoot, filePath), 'utf8')
    const hasAsyncRequest = /\b(?:unifiedApi|publicApi|axios|api)\.(?:get|post|put|patch|delete)\s*\(|\bfetch\s*\(/.test(source)
    if (!hasAsyncRequest) violations.push(`${filePath} 异步 Loading 委托例外已无实际异步请求，请删除登记`)
  } catch {
    violations.push(`异步 Loading 委托例外登记指向不存在的文件：${filePath}`)
  }
}

if (violations.length > 0) {
  console.error(`Loading 检查失败，共 ${violations.length} 处：`)
  violations.forEach((violation) => console.error(`- ${violation}`))
  process.exit(1)
}

const tableMarkupFileCount = pageAuditRecords.filter(record => record.hasTableMarkup).length
const localLoadingFileCount = pageAuditRecords.filter(record => (
  record.hasTableDirective || record.hasTableFallback || record.hasSectionLoading || record.hasInlineLoading || record.hasElementLoading
)).length
const asyncRequestFileCount = pageAuditRecords.filter(record => record.hasAsyncRequest).length
console.log(`Loading 页面台账审计通过：逐项扫描页面/功能单元 ${pageFileCount} 个、公共组件 ${componentFileCount} 个、应用入口 ${appFileCount} 个；异步请求文件 ${asyncRequestFileCount} 个，表格/列表文件 ${tableMarkupFileCount} 个，使用局部 Loading 的文件 ${localLoadingFileCount} 个；统一 API 默认覆盖未显式关闭的首次请求；GlobalLoading=1；v-tf-loading=${tableDirectiveCount}；TableLoadingRow=${tableLoadingRowCount}；SectionLoading=${sectionLoadingCount}；InlineLoading=${inlineLoadingCount}；v-loading 例外=${loadingDirectiveCount}；全局长操作例外=${globalLoadingTriggerExceptions.size} 个。`)
console.log(`Loading 使用分层：首次 API 请求/页面切换使用 GlobalLoading；表格刷新使用 v-tf-loading；空表兜底使用 TableLoadingRow；区块使用 SectionLoading；按钮和短区域使用 InlineLoading；同一次操作不得叠加可见 Loading。`)
