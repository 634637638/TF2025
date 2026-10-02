import { readFileSync, readdirSync, statSync } from 'node:fs'
import { extname, join, relative, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const sourceRoot = join(root, 'src')
const findings = []
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
const nativeTextExceptionBaseline = {
  'src/views/H5-mobile/page/MobileHome.vue': { count: 3, reason: 'H5 首页型号、颜色、内存筛选依赖移动端选择器交互' },
  'src/views/H5-mobile/page/MyOrders.vue': { count: 1, reason: 'H5 订单查询姓名输入保留顾客端轻量表单行为' },
  'src/views/auth/LoginViewSimple.vue': { count: 1, reason: '登录页使用专用认证布局与浏览器用户名自动填充' },
  'src/views/subsidy/components/SubsidyApplyDialog.vue': { count: 6, reason: '补贴申请的 IMEI、证件、姓名和电话字段保留实时归一化及专用紧凑布局' }
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

function countControls(source) {
  return {
    select: (source.match(/<select\b/gi) || []).length,
    date: (source.match(/<input\b(?:(?!>)[\s\S])*\btype\s*=\s*["'](?:date|datetime-local|month|time)["'](?:(?!>)[\s\S])*>/gi) || []).length,
    sortOrderNative: (source.match(/<input\b(?=[^>]*\bclass\s*=\s*["'][^"']*\bsort-order-(?:input|control)\b)(?=[^>]*\btype\s*=\s*["']number["'])[^>]*>/gi) || []).length,
    sortOrderComponent: (source.match(/<el-input-number\b(?=[^>]*\bclass\s*=\s*["'][^"']*\bsort-order-control\b)[^>]*>/gi) || []).length,
    nativeText: (source.match(/<input\b(?=[^>]*\btype\s*=\s*["']text["'])[^>]*>/gi) || []).length
  }
}

let nativeSelectCount = 0
let nativeDateCount = 0
let nativeTextCount = 0

for (const file of walk(sourceRoot)) {
  const relativeFile = relative(root, file)
  const source = readFileSync(file, 'utf8')
  const counts = countControls(source)
  nativeSelectCount += counts.select
  nativeDateCount += counts.date
  nativeTextCount += counts.nativeText
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
  const standardInputs = (source.match(/<el-input(?!-number)\b/g) || []).length
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

console.log(`表单控件统一审计通过：运行时代码原生文本=${nativeTextCount}（专用例外 ${Object.keys(nativeTextExceptionBaseline).length} 个文件）、select=${nativeSelectCount}、日期控件=${nativeDateCount}；${Object.keys(exceptionBaseline).length} 个文件保留回归观察登记。`)
