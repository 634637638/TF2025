import { readFileSync, readdirSync, statSync } from 'node:fs'
import { extname, join, relative, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const sourceRoot = join(root, 'src')
const findings = []
const sharedFormControlsPath = join(sourceRoot, 'styles/components/_form-controls.scss')
const sharedFormControls = readFileSync(sharedFormControlsPath, 'utf8')
const sharedFormControlsRelativePath = relative(root, sharedFormControlsPath)
const publicControlSizeFiles = new Set([
  sharedFormControlsRelativePath,
  'src/styles/components/_table.scss',
  'src/components/search/UnifiedSearchPanel.vue',
  'src/components/search/PublicSearchBox.vue'
])
const publicControlFocusFiles = new Set([
  sharedFormControlsRelativePath,
  'src/components/search/PublicSearchBox.vue'
])
let inputNumberCount = 0
let inputNumberControlsCount = 0
const sortOrderControlFiles = [
  'src/components/DraggableRow.vue',
  'src/views/brands/BrandsView.vue',
  'src/views/stores/StoresView.vue',
  'src/views/models/ModelsView.vue',
  'src/views/suppliers/SuppliersView.vue',
  'src/views/colors/ColorsView.vue',
  'src/views/memories/MemoriesView.vue'
]
const standardTextInputFiles = new Map([
  ['src/views/permissions/page/RoleFormDialog.vue', 2],
  ['src/views/permissions/page/ModuleManagementView.vue', 5],
  ['src/components/IconSelector.vue', 1],
  ['src/views/permissions/page/UserRoleAssignmentBody.vue', 1],
  ['src/views/salary/page/SalaryTemplateFormDialog.vue', 1],
  ['src/views/salary/page/SalaryEditPayoutDialog.vue', 2],
  ['src/views/salary/page/SalaryEmployeeTemplateDialog.vue', 1],
  ['src/views/sales/page/SalesBatchForm.vue', 3]
])

// Existing specialized native inputs are explicit per-file ceilings. Any new
// file using a plain text input must first be migrated or intentionally listed.
const exceptionBaseline = {
  'src/components/CitySelector.vue': { select: 0, date: 0, reason: '省市选择已迁移为级联联动 el-select' },
  'src/components/PublishToH5Modal.vue': { select: 0, date: 0, reason: 'H5 发布表单暂无原生日期控件' },
  'src/components/query/QueryEditModal.vue': { select: 0, date: 0, reason: '综合查询编辑暂无原生日期控件' },
  'src/components/query/QuickSaleModal.vue': { select: 0, date: 0, reason: '快速销售弹窗暂无原生日期控件' },
  'src/components/stock-in/StockInBasicInfoSection.vue': { select: 0, date: 0, reason: '入库基础信息暂无原生日期控件' },
  'src/components/wholesale/WholesalePartySection.vue': { select: 0, date: 0, reason: '同行批发暂无原生日期控件' },
  'src/views/analytics/page/TransferAnalytics.vue': { select: 0, date: 0, reason: '分析筛选暂无原生日期控件' },
  'src/views/attendance/AttendanceView.vue': { select: 0, date: 0, reason: '考勤暂无原生日期控件' },
  'src/views/customers/CustomersView.vue': { select: 0, date: 0, reason: '客户资料暂无原生日期控件' },
  'src/views/employees/EmployeesView.vue': { select: 0, date: 0, reason: '员工资料暂无原生日期控件' },
  'src/views/inventory/page/InventoryEditDialog.vue': { select: 0, date: 0, reason: '库存编辑暂无原生日期控件' },
  'src/views/payments/SupplierPhonePaymentsView.vue': { select: 0, date: 0, reason: '供应商付款暂无原生日期控件' },
  'src/views/permissions/page/ModuleManagementView.vue': { select: 0, date: 0, reason: '权限模块下拉已迁移为 el-select' },
  'src/views/preorders/page/PreorderFormModal.vue': { select: 0, date: 0, reason: '预订表单暂无原生日期控件' },
  'src/views/reminders/ReminderView.vue': { select: 0, date: 0, reason: '提醒表单暂无原生日期控件' },
  'src/views/rentals/RentalsView.vue': { select: 0, date: 0, reason: '租赁合同暂无原生日期控件' },
  'src/views/repairs/RepairsView.vue': { select: 0, date: 0, reason: '维修表单暂无原生日期控件' },
  'src/views/salary/page/SalaryAttendanceFormDialog.vue': { select: 0, date: 0, reason: '工资考勤下拉已迁移为 el-select' },
  'src/views/salary/page/SalaryEditPayoutDialog.vue': { select: 0, date: 0, reason: '工资发放下拉已迁移为 el-select' },
  'src/views/salary/page/SalaryEmployeeTemplateDialog.vue': { select: 0, date: 0, reason: '工资员工模板下拉已迁移为 el-select' },
  'src/views/salary/page/SalaryEmployeesTab.vue': { select: 0, date: 0, reason: '工资员工暂无原生日期控件' },
  'src/views/salary/page/SalaryMyRecordsTab.vue': { select: 0, date: 0, reason: '工资个人记录暂无原生日期控件' },
  'src/views/salary/page/SalaryPayoutTab.vue': { select: 0, date: 0, reason: '工资发放暂无原生日期控件' },
  'src/views/sales/page/SalesBatchForm.vue': { select: 0, date: 0, reason: '销售批量下拉和日期字段已迁移为 Element Plus 控件' },
  'src/views/sales/page/SalesCheckoutForm.vue': { select: 0, date: 0, reason: '销售结算暂无原生日期控件' },
  'src/views/sales/page/SalesEditPhoneDialog.vue': { select: 0, date: 0, reason: '销售编辑暂无原生日期控件' },
  'src/views/subsidy/SubsidyView.vue': { select: 0, date: 0, reason: '补贴暂无原生日期控件' },
  'src/views/subsidy/components/SubsidyEditDialog.vue': { select: 0, date: 0, reason: '补贴编辑暂无原生日期控件' }
}
const nativeTextExceptionBaseline = {}

if (!sharedFormControls.includes('.el-input-number .el-input-number__increase')
  || !sharedFormControls.includes('.el-textarea__inner')
  || !sharedFormControls.includes(".el-textarea__inner[rows='2']")
  || !sharedFormControls.includes('.tf-textarea .el-textarea__inner')
  || !sharedFormControls.includes('--tf-textarea-compact-height')
  || !sharedFormControls.includes('border-radius: var(--tf-radius-control)')) {
  findings.push('公共表单控件样式必须统一维护数字步进按钮和文本域手动拉伸行为')
}

function walk(directory, files = []) {
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry)
    const stat = statSync(path)
    if (stat.isDirectory()) walk(path, files)
    else if (extname(path) === '.vue') files.push(path)
  }
  return files
}

function walkStyleFiles(directory, files = []) {
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry)
    const stat = statSync(path)
    if (stat.isDirectory()) walkStyleFiles(path, files)
    else if (['.css', '.scss', '.vue'].includes(extname(path))) files.push(path)
  }
  return files
}

function findPrivateControlRadius(source) {
  const matches = []
  const blockPattern = /([^{}]+)\{([^{}]*)\}/gs
  let match
  while ((match = blockPattern.exec(source))) {
    const selector = match[1].trim().replace(/\s+/g, ' ')
    const body = match[2]
    if (/(?:el-input__wrapper|el-select__wrapper|el-date-editor|el-input-number|el-textarea__inner)/.test(selector)
      && /border-radius\s*:/.test(body)) {
      matches.push((body.match(/border-radius\s*:[^;]+/g) || []).join(', '))
    }
  }
  return matches
}

function findPrivateControlHeight(source) {
  const matches = []
  const blockPattern = /([^{}]+)\{([^{}]*)\}/gs
  let match
  while ((match = blockPattern.exec(source))) {
    const selector = match[1].trim().replace(/\s+/g, ' ')
    const body = match[2]
    const heightDeclarations = body.match(/(?<![\w-])(?:min-)?height\s*:[^;]+/g) || []
    const privateHeightDeclarations = heightDeclarations.filter(declaration => !/:\s*(?:100%|auto|0(?:px)?)(?:\s*!important)?\s*$/i.test(declaration.trim()))
    if (/(?:el-input__wrapper|el-select__wrapper|el-date-editor|el-input-number|el-textarea__inner)/.test(selector)
      && privateHeightDeclarations.length > 0) {
      matches.push(privateHeightDeclarations.join(', '))
    }
  }
  return matches
}

function findPrivateControlFocus(source) {
  const matches = []
  const blockPattern = /([^{}]+)\{([^{}]*)\}/gs
  let match
  while ((match = blockPattern.exec(source))) {
    const selector = match[1].trim().replace(/\s+/g, ' ')
    const body = match[2]
    if (/(?:el-input__wrapper|el-select__wrapper|el-date-editor|el-input-number|el-textarea__inner)/.test(selector)
      && /(?:focus|is-focus|is-focused)/.test(selector)
      && /(?:box-shadow|border-color|outline|background)/.test(body)) {
      matches.push((body.match(/(?:box-shadow|border-color|outline|background)\s*:[^;]+/g) || []).join(', '))
    }
  }
  return matches
}

function countControls(source) {
  return {
    select: (source.match(/<select\b/gi) || []).length,
    date: (source.match(/<input\b(?:(?!>)[\s\S])*\btype\s*=\s*["'](?:date|datetime-local|month|time)["'](?:(?!>)[\s\S])*>/gi) || []).length,
    number: (source.match(/<input\b(?:(?!>)[\s\S])*\btype\s*=\s*["']number["'](?:(?!>)[\s\S])*>/gi) || []).length,
    sortOrderNative: (source.match(/<input\b(?=[^>]*\bclass\s*=\s*["'][^"']*\bsort-order-(?:input|control)\b)(?=[^>]*\btype\s*=\s*["']number["'])[^>]*>/gi) || []).length,
    sortOrderComponent: (source.match(/<el-input-number\b(?=[^>]*\bclass\s*=\s*["'][^"']*\bsort-order-control\b)[^>]*>/gi) || []).length,
    nativeText: (source.match(/<input\b(?=[^>]*\btype\s*=\s*["']text["'])[^>]*>/gi) || []).length
  }
}

function countNativeTextareas(source) {
  // 只匹配模板中的原生标签；脚本为剪贴板临时创建的 textarea 不属于业务控件。
  return (source.match(/<textarea\b/gi) || []).length
}

function textareaComponentTags(source) {
  return source
    .split(/<el-input(?!-)\b/gi)
    .slice(1)
    .map(part => part.slice(0, part.indexOf('/>') >= 0 ? part.indexOf('/>') + 2 : part.indexOf('>') + 1))
    .filter(tag => /\btype\s*=\s*["']textarea["']/.test(tag)
      || /:type\s*=\s*["'][^>]*textarea/.test(tag))
}

function countStandardTextInputs(source) {
  const inputTags = source
    .split(/<el-input(?!-)\b/gi)
    .slice(1)
    .map(part => part.slice(0, part.indexOf('/>') >= 0 ? part.indexOf('/>') + 2 : part.indexOf('>') + 1))
  return inputTags.filter(tag => !/\btype\s*=\s*["']textarea["']/.test(tag)).length
}

let nativeSelectCount = 0
let nativeDateCount = 0
let nativeNumberCount = 0
let nativeTextCount = 0

for (const file of walk(sourceRoot)) {
  const relativeFile = relative(root, file)
  const source = readFileSync(file, 'utf8')
  inputNumberCount += (source.match(/<el-input-number\b/g) || []).length
  inputNumberControlsCount += (source.match(/:controls=["']false["']/g) || []).length
  const counts = countControls(source)
  const nativeTextareas = countNativeTextareas(source)
  const textareaTags = textareaComponentTags(source)
  nativeSelectCount += counts.select
  nativeDateCount += counts.date
  nativeNumberCount += counts.number
  nativeTextCount += counts.nativeText
  if (nativeTextareas > 0) {
    findings.push(`${relativeFile} 仍使用 ${nativeTextareas} 个原生 textarea，必须迁移到 el-input type="textarea"`)
  }
  if (textareaTags.some(tag => !/(?:\:)?rows\s*=\s*["'][^"']+["']/.test(tag))) {
    findings.push(`${relativeFile} 的多行 el-input 必须声明固定 rows，禁止依赖自动高度`)
  }
  if (textareaTags.some(tag => !/(?:\bclass|:class)\s*=\s*["'][^>]*\btf-textarea\b/.test(tag))) {
    findings.push(`${relativeFile} 的多行 el-input 必须使用 tf-textarea 语义 class，统一接入文本域公共行为`)
  }
  if (counts.sortOrderNative > 0) {
    findings.push(`${relativeFile} 排序字段仍使用原生 number input，必须迁移到 el-input-number`)
  }
  if (counts.nativeText > 0) {
    const textBaseline = nativeTextExceptionBaseline[relativeFile]
    if (!textBaseline) {
      findings.push(`${relativeFile} 新增原生文本 input，必须迁移到 el-input 或登记明确的专用交互例外`)
    } else if (counts.nativeText > textBaseline.count) {
      findings.push(`${relativeFile} 原生文本 input 数量从 ${textBaseline.count} 增加到 ${counts.nativeText}，不得扩大文本控件例外`)
    }
  }
  if (counts.number > 0) {
    findings.push(`${relativeFile} 仍使用 ${counts.number} 个原生 number input，必须迁移到 el-input-number`)
  }
  if (/\bautosize\b|resize\s*=\s*["'](?:none|horizontal|both)["']|resize\s*:\s*(?:none|horizontal|both)\b|\bcontrols-position\s*=/.test(source)) {
    findings.push(`${relativeFile} 多行文本只能垂直手动拉伸，不得使用 autosize、横向/双向/禁止 resize 或 controls-position`)
  }
  const hasNativeControls = counts.select > 0 || counts.date > 0
  if (!hasNativeControls) continue

  const baseline = exceptionBaseline[relativeFile]
  if (!baseline) {
    findings.push(`${relativeFile} 新增原生 select/日期控件，必须迁移到标准控件或登记明确例外`)
    continue
  }

  if (counts.select > baseline.select) {
    findings.push(`${relativeFile} 原生 select 数量从 ${baseline.select} 增加到 ${counts.select}，不得继续扩大兼容债务`)
  }
  if (counts.date > baseline.date) {
    findings.push(`${relativeFile} 原生日期控件数量从 ${baseline.date} 增加到 ${counts.date}，不得继续扩大兼容债务`)
  }
}

for (const file of walkStyleFiles(sourceRoot)) {
  const relativeFile = relative(root, file)
  const source = readFileSync(file, 'utf8')
  if (relativeFile !== sharedFormControlsRelativePath) {
    const privateControlRadii = findPrivateControlRadius(source)
    if (privateControlRadii.length > 0) {
      findings.push(`${relativeFile} 含有页面/组件私有表单控件圆角（${privateControlRadii.join('；')}），必须移除并交由 _form-controls.scss 统一维护`)
    }
  }
  if (!publicControlSizeFiles.has(relativeFile)) {
    const privateControlHeights = findPrivateControlHeight(source)
    if (privateControlHeights.length > 0) {
      findings.push(`${relativeFile} 含有页面/组件私有表单控件高度（${privateControlHeights.join('；')}），必须移除并交由公共控件入口统一维护`)
    }
  }
  if (!publicControlFocusFiles.has(relativeFile)) {
    const privateControlFocus = findPrivateControlFocus(source)
    if (privateControlFocus.length > 0) {
      findings.push(`${relativeFile} 含有页面/组件私有表单控件聚焦样式（${privateControlFocus.join('；')}），必须移除并交由 _form-controls.scss 统一维护`)
    }
  }
  if (/\bautosize\b|resize\s*=\s*["'](?:none|horizontal|both)["']|resize\s*:\s*(?:none|horizontal|both)\b/.test(source)) {
    findings.push(`${relativeFile} 多行文本只能垂直手动拉伸，不得使用 autosize、横向/双向/禁止 resize`)
  }
  if (!relativeFile.endsWith('styles/components/_form-controls.scss')
    && !relativeFile.endsWith('styles/global.css')
    && !relativeFile.endsWith('styles/responsive.scss')) {
    const textareaSelectorIndex = source.search(/(?:el-textarea__inner|textarea\.form-control)/)
    if (textareaSelectorIndex >= 0) {
      const blockEnd = source.indexOf('}', textareaSelectorIndex)
      const textareaStyleWindow = source.slice(
        textareaSelectorIndex,
        blockEnd >= 0 ? blockEnd : textareaSelectorIndex + 500
      )
      if (/(?:^|\n)\s*(?:min-)?height\s*:/.test(textareaStyleWindow)) {
        findings.push(`${relativeFile} 不得为文本域维护页面私有 height/min-height，rows=2 高度由全局令牌统一`)
      }
    }
  }
}

if (inputNumberControlsCount !== inputNumberCount) {
  findings.push(`所有 el-input-number 必须显式设置 :controls="false"（当前 ${inputNumberControlsCount}/${inputNumberCount}）`)
}

for (const file of sortOrderControlFiles) {
  const source = readFileSync(join(root, file), 'utf8')
  const counts = countControls(source)
  if (counts.sortOrderComponent !== 1) {
    findings.push(`${file} 必须保留一个统一的排序 el-input-number，当前 ${counts.sortOrderComponent} 个`)
  }
}

for (const [file, expected] of standardTextInputFiles) {
  const source = readFileSync(join(root, file), 'utf8')
  const counts = countControls(source)
  const standardInputs = countStandardTextInputs(source)
  if (counts.nativeText > 0 || standardInputs !== expected) {
    findings.push(`${file} 普通文本字段必须使用 ${expected} 个 el-input，当前原生文本输入=${counts.nativeText}、el-input=${standardInputs}`)
  }
}

for (const [file, baseline] of Object.entries(exceptionBaseline)) {
  const fullPath = join(root, file)
  if (!statSync(fullPath, { throwIfNoEntry: false })) {
    findings.push(`表单控件例外登记指向不存在的文件：${file}`)
    continue
  }
  if (!baseline.reason) findings.push(`${file} 的原生控件例外必须记录迁移原因`)
}

for (const [file, baseline] of Object.entries(nativeTextExceptionBaseline)) {
  const fullPath = join(root, file)
  if (!statSync(fullPath, { throwIfNoEntry: false })) {
    findings.push(`原生文本输入例外登记指向不存在的文件：${file}`)
    continue
  }
  const counts = countControls(readFileSync(fullPath, 'utf8'))
  if (!baseline.reason) findings.push(`${file} 的原生文本输入例外必须记录专用交互原因`)
  if (counts.nativeText !== baseline.count) {
    findings.push(`${file} 原生文本输入例外登记为 ${baseline.count}，实际 ${counts.nativeText}`)
  }
}

if (findings.length) {
  console.error(`表单控件统一审计失败，共 ${findings.length} 处：`)
  for (const finding of findings) console.error(`- ${finding}`)
  process.exit(1)
}

console.log(`表单控件统一审计通过：运行时代码原生文本=${nativeTextCount}、number=${nativeNumberCount}、select=${nativeSelectCount}、日期控件=${nativeDateCount}；${Object.keys(exceptionBaseline).length} 个文件保留回归观察登记。`)
