import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { resolve } from 'node:path'

const frontendRoot = resolve(import.meta.dirname, '..')
const projectRoot = resolve(frontendRoot, '..')
const registryPath = resolve(projectRoot, 'config/field-contracts.json')
const moduleFieldsPath = resolve(frontendRoot, 'src/config/moduleFields.js')

const sourcesByModule = {
  query: ['src/views/query/QueryView.vue'],
  inventory: ['src/views/inventory'],
  sales: ['src/views/sales', 'src/views/sales/sales-field-permissions.ts'],
  brands: ['src/views/brands/BrandsView.vue'],
  models: ['src/views/models/ModelsView.vue'],
  colors: ['src/views/colors/ColorsView.vue'],
  memories: ['src/views/memories/MemoriesView.vue'],
  employees: ['src/views/employees/EmployeesView.vue'],
  suppliers: ['src/views/suppliers/SuppliersView.vue'],
  stores: ['src/views/stores/StoresView.vue'],
  customers: ['src/views/customers/CustomersView.vue'],
  payments: ['src/views/payments/SupplierPhonePaymentsView.vue'],
  permissions: ['src/views/permissions'],
  preorders: ['src/views/preorders'],
  shared: ['src/views/shared'],
  reminders: ['src/views/reminders'],
  accessories: [
    'src/views/accessories',
    'src/components/AccessoryDetailsModal.vue',
    'src/components/AccessoryStockInModal.vue',
    'src/components/accessory-field-permissions.ts'
  ],
  rentals: ['src/views/rentals'],
  repairs: ['src/views/repairs'],
  menu: ['src/views/menu'],
  price_list: ['src/views/price-list'],
  marketing: ['src/views/marketing/MarketingManagementView.vue', 'src/views/marketing/MarketingView.vue'],
  system: [
    'src/views/system/SystemView.vue',
    'src/views/system/page/Returngoods.vue',
    'src/views/system/phone-warning-config/PhoneWarningConfigView.vue'
  ],
  backup: ['src/views/backup/BackupView.vue'],
  returngoods: ['src/views/system/page/Returngoods.vue'],
  phone_warning_config: ['src/views/system/phone-warning-config/PhoneWarningConfigView.vue'],
  system_gitmanagement: ['src/views/system/page/GitManagement.vue'],
  analytics: ['src/views/analytics'],
  dashboard: ['src/views/dashboard/DashboardView.vue'],
  data_optimization: ['src/views/data-optimization'],
  h5_admin_ordersview: ['src/views/H5-admin/page/orders.vue'],
  h5_admin_soldproductsview: ['src/views/H5-admin/page/SoldProductsView.vue'],
  h5_admin_bannersview: ['src/views/H5-admin/page/banners.vue'],
  h5_admin_configview: ['src/views/H5-admin/page/config.vue'],
  h5_admin_home_sectionsview: ['src/views/H5-admin/page/home-sections.vue'],
  h5_admin_templatesview: ['src/views/H5-admin/page/templates.vue'],
  salary: ['src/views/salary', 'src/views/salary/salary-field-permissions.ts'],
  attendance: ['src/views/attendance/AttendanceView.vue'],
  subsidy: ['src/views/subsidy']
}

const findings = []

if (!existsSync(registryPath) || !existsSync(moduleFieldsPath)) {
  console.error('字段权限覆盖审计失败：缺少字段登记文件')
  process.exit(1)
}

const registry = JSON.parse(readFileSync(registryPath, 'utf8'))
const contracts = registry.contracts || {}
const moduleFieldsSource = readFileSync(moduleFieldsPath, 'utf8')

const collectModuleSourceFiles = (relativePaths) => {
  const files = []
  const visit = (absolutePath, displayPath) => {
    if (!existsSync(absolutePath)) {
      findings.push(`字段权限源文件不存在：${displayPath}`)
      return
    }
    if (!statSync(absolutePath).isDirectory()) {
      const source = readFileSync(absolutePath, { encoding: 'utf8' })
      if (source) files.push({ path: displayPath, source })
      return
    }
    for (const entry of readdirSync(absolutePath)) visit(resolve(absolutePath, entry), `${displayPath}/${entry}`)
  }
  for (const relativePath of relativePaths) visit(resolve(frontendRoot, relativePath), relativePath)
  return files.filter(({ path }) => /\.(vue|ts|js)$/.test(path))
}

const moduleStarts = [...moduleFieldsSource.matchAll(/^  ([A-Za-z0-9_-]+): \{/gm)]
for (let index = 0; index < moduleStarts.length; index += 1) {
  const moduleName = moduleStarts[index][1]
  const start = moduleStarts[index].index
  const end = index + 1 < moduleStarts.length ? moduleStarts[index + 1].index : moduleFieldsSource.length
  const moduleSource = moduleFieldsSource.slice(start, end)
  const fieldIds = [...moduleSource.matchAll(/id:\s*['"]([^'"]+)/g)].map(match => match[1])
  const sourceFiles = collectModuleSourceFiles(sourcesByModule[moduleName] || [])

  if (!sourceFiles.length) {
    findings.push(`${moduleName}: 未登记页面字段权限源文件`)
    continue
  }

  const source = sourceFiles.map(file => file.source).join('\n')
  if (!/fieldPermissions|useFieldPermissions|canView[A-Za-z]*Field|canViewField/.test(source)) {
    findings.push(`${moduleName}: 页面未调用字段权限判断`)
  }

  for (const fieldId of fieldIds) {
    const candidates = [fieldId, fieldId.replace(/\./g, '_'), fieldId.split('.').pop()]
    if (!candidates.some(candidate => source.includes(candidate))) {
      findings.push(`${moduleName}: 字段未在页面或字段权限适配器中使用 ${fieldId}`)
    }
  }
}

for (const [contractName, contract] of Object.entries(contracts)) {
  const permissionModule = contract.fieldPermissionModule
  if (permissionModule && !sourcesByModule[permissionModule]) {
    findings.push(`${contractName}: fieldPermissionModule 未登记页面源文件 ${permissionModule}`)
  }
}

if (findings.length) {
  console.error(`字段权限覆盖审计失败，共 ${findings.length} 处：`)
  for (const finding of [...new Set(findings)]) console.error(`- ${finding}`)
  process.exit(1)
}

console.log(`字段权限覆盖审计通过：${moduleStarts.length} 个模块均已登记页面源文件并接入字段显示判断。`)
