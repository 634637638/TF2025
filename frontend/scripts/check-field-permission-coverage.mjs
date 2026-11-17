import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import { build } from 'esbuild'

const frontendRoot = resolve(import.meta.dirname, '..')
const projectRoot = resolve(frontendRoot, '..')
const registryPath = resolve(projectRoot, 'backend/scripts/config/field-contracts.json')
const moduleFieldsPath = resolve(frontendRoot, 'src/config/moduleFields.js')

const sourcesByModule = {
  query: ['src/views/query/QueryView.vue'],
  query_goods: ['src/views/query/page', 'src/components/accessory-field-permissions.ts', 'src/components/query/CheckoutOrderDialog.vue'],
  inventory: ['src/views/inventory'],
  sales: ['src/views/sales', 'src/views/sales/sales-field-permissions.ts', 'src/components/query/QuickSaleModal.vue'],
  brands: ['src/views/brands/BrandsView.vue'],
  models: ['src/views/models/ModelsView.vue'],
  colors: ['src/views/colors/ColorsView.vue'],
  memories: ['src/views/memories/MemoriesView.vue'],
  employees: ['src/views/employees/EmployeesView.vue'],
  suppliers: ['src/views/suppliers/SuppliersView.vue'],
  stores: ['src/views/stores/StoresView.vue'],
  customers: ['src/views/customers'],
  payments: ['src/views/payments'],
  permissions: ['src/views/permissions'],
  preorders: ['src/views/preorders'],
  shared: ['src/views/shared'],
  reminders: ['src/views/reminders'],
  accessories: [
    'src/views/accessories',
    'src/components/AccessoryDetailsModal.vue',
    'src/components/AccessoryStockInModal.vue',
    'src/views/query/page/QueryGoodsPanel.vue',
    'src/views/sales/page/SalesGoodsCheckoutDialog.vue',
    'src/views/sales/page/SalesGoodsLine.vue',
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
// 读取实际字段登记，覆盖由公共元数据派生的页面子范围。
const bundled = await build({ entryPoints: [moduleFieldsPath], bundle: true, write: false,
  format: 'esm', platform: 'node', alias: { '@': resolve(frontendRoot, 'src') } })
const { MODULE_FIELDS } = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`)

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

for (const [moduleName, definition] of Object.entries(MODULE_FIELDS)) {
  const fieldIds = definition.fields.map(field => field.id)
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
    if (MODULE_FIELDS[moduleName].fields.find(field => field.id === fieldId)?.editable &&
      !/isFieldEditable|canEdit[A-Za-z]*Field|canEditField/.test(source)) {
      findings.push(`${moduleName}: 可编辑字段没有字段级编辑判断 ${fieldId}`)
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

console.log(`字段权限覆盖审计通过：${Object.keys(MODULE_FIELDS).length} 个模块及字段范围均已登记页面源文件并接入字段显示判断；可编辑字段已检查编辑判断。`)
