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
  ['components/PriceMarkupConfig.vue', { count: 1, reason: '配置弹窗需保留表单字段并在加载期间覆盖内容' }],
  ['views/models/ModelsView.vue', { count: 1, reason: '有现存行时显示静默刷新遮罩；空表改由 TableLoadingRow 呈现' }],
  ['views/preorders/page/MatchPreorderModal.vue', { count: 1, reason: '有候选设备时保留刷新遮罩；空表改由 TableLoadingRow 呈现' }]
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

const standardsLoadingRequirements = [
  [/global-loading-standard\.md/, '规范与审计标杆页必须登记全局 Loading 规范预览'],
  [/runPreviewLoading/, '规范与审计标杆页全局 Loading 必须提供可点击演示入口'],
  [/loadingStore\.startLoading\(/, '规范与审计标杆页演示必须调用统一 Loading Store'],
  [/演示 Loading/, '规范与审计标杆页必须显示“演示 Loading”按钮']
]
for (const [pattern, message] of standardsLoadingRequirements) {
  if (!pattern.test(standardsViewSource)) violations.push(`views/standards/StandardsAuditView.vue ${message}`)
}

for (const file of files) {
  const source = await readFile(file, 'utf8')
  const filePath = relative(sourceRoot, file)
  const { descriptor, errors } = parse(source, { filename: file })
  if (errors.length > 0) {
    violations.push(`${filePath} Vue SFC 解析失败，无法可靠审计 loading 模板`)
    continue
  }
  const template = descriptor.template?.content || ''
  const templateStartLine = descriptor.template?.loc.start.line || 1
  const styleBlocks = descriptor.styles.map(style => style.content)

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

if (violations.length > 0) {
  console.error(`Loading 检查失败，共 ${violations.length} 处：`)
  violations.forEach((violation) => console.error(`- ${violation}`))
  process.exit(1)
}

console.log(`Loading 检查通过：GlobalLoading=1；TableLoadingRow=${tableLoadingRowCount}；SectionLoading=${sectionLoadingCount}；InlineLoading=${inlineLoadingCount}；v-loading 例外=${loadingDirectiveCount}；el-button InlineLoading 例外=${buttonInlineLoadingCount}（登记 ${buttonInlineLoadingExceptions.size} 个文件）。`)
