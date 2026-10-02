#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'

const frontendRoot = path.resolve(new URL('..', import.meta.url).pathname)
const sourceRoot = path.join(frontendRoot, 'src')
const findings = []
const removedComponentNames = ['BaseButton', 'ConfirmDialog']

const nativeButtonExceptions = {
  'src/components/AccessoryDetailsModal.vue': { count: 1, status: 'retain', reviewReason: '移动详情弹窗专用关闭控件；编辑操作已迁移为 el-button' },
  'src/components/IconPicker.vue': { count: 2, status: 'retain', reviewReason: '分页专用控件；图标删除命令已迁移为 el-button' },
  'src/components/IconSelector.vue': { count: 1, status: 'retain', reviewReason: '图标分类筛选项保留原生选择行为；选择、清除和确认命令已迁移为 el-button' },
  'src/components/InventoryResultDialog.vue': { count: 1, status: 'retain', reviewReason: '移动端结果弹窗专用关闭控件' },
  'src/components/MediaPreviewViewer.vue': { count: 3, status: 'retain', reviewReason: '预览导航和关闭保留专用语义；素材删除命令已迁移为 el-button' },
  'src/components/MobileDialog.vue': { count: 1, status: 'retain', reviewReason: '公共弹窗内部专用关闭控件' },
  'src/components/NotificationContainer.vue': { count: 1, status: 'retain', reviewReason: '通知条内部无文案关闭控件' },
  'src/components/Pagination.vue': { count: 3, status: 'retain', reviewReason: '公共分页组件需自定义页码键盘和紧凑布局' },
  'src/components/ProfessionalScanner.vue': { count: 6, status: 'retain', reviewReason: '扫描器硬件、相机和捕获流程专用控制' },
  'src/components/ResponsiveLayout.vue': { count: 3, status: 'retain', reviewReason: '布局返回、菜单和浮动快捷操作依赖响应式定位' },
  'src/components/ResponsiveMenu.vue': { count: 1, status: 'retain', reviewReason: '移动抽屉导航开关，保留原生菜单语义' },
  'src/components/ScreenLock.vue': { count: 2, status: 'retain', reviewReason: '密码显隐和解锁表单专用控件' },
  'src/components/TabsBar.vue': { count: 1, status: 'retain', reviewReason: '标签页关闭操作需维持标签导航交互' },
  'src/components/Toast.vue': { count: 1, status: 'retain', reviewReason: '通知内部无文案关闭控件' },
  'src/components/common/CustomerNameLockInput.vue': { count: 2, status: 'retain', reviewReason: '客户姓名锁定状态机中的保存和更换操作' },
  'src/components/common/CustomerSearchDropdown.vue': { count: 2, status: 'retain', reviewReason: '下拉结果需保持 button/option 键盘和鼠标选择行为' },
  'src/components/mobile/MobileSlideMenu.vue': { count: 1, status: 'retain', reviewReason: '移动菜单树展开控制' },
  'src/components/query/QueryDetailDialog.vue': { count: 1, status: 'retain', reviewReason: '移动详情弹窗专用关闭控件' },
  'src/views/H5-admin/page/templates.vue': { count: 3, status: 'retain', reviewReason: 'H5 模板和图片工作台卡片选择、排序及素材操作' },
  'src/views/H5-mobile/page/Cart.vue': { count: 1, status: 'retain', reviewReason: 'H5 购物车移动端卡片操作' },
  'src/views/H5-mobile/page/MobileHome.vue': { count: 12, status: 'retain', reviewReason: 'H5 商品检索的自定义下拉选项和移动端操作' },
  'src/views/auth/LoginViewSimple.vue': { count: 1, status: 'retain', reviewReason: '登录表单原生 submit 语义及专用样式' },
  'src/views/menu/MenuManagementView.vue': { count: 1, status: 'retain', reviewReason: '菜单树节点展开/折叠控件' },
  'src/views/permissions/page/RoleFieldPermissionDialog.vue': { count: 1, status: 'retain', reviewReason: '权限分组导航项，不是通用命令按钮' },
  'src/views/permissions/page/RolePermissionsPage.vue': { count: 4, status: 'retain', reviewReason: '权限矩阵专用切换控件，需保持 checked/disabled 状态语义' },
  'src/views/permissions/page/RolesPage.vue': { count: 1, status: 'retain', reviewReason: '角色启停状态操作，当前按钮需承载状态和权限提示' },
  'src/views/permissions/page/UserRoleAssignmentBody.vue': { count: 1, status: 'retain', reviewReason: '已选角色标签的移除交互；搜索清除已迁移为 el-button' },
  'src/views/price-list/page/PublicPriceQuery.vue': { count: 4, status: 'retain', reviewReason: '公开报价页品牌化搜索、筛选和图片导出控制' },
  'src/views/price-list/page/SalesPriceDisplay.vue': { count: 2, status: 'retain', reviewReason: '销售报价页专用搜索和图片导出控制' },
  'src/views/price-list/page/SyncLogView.vue': { count: 1, status: 'retain', reviewReason: '移动端同步日志整行选择控件' },
  'src/views/reminders/ReminderView.vue': { count: 1, status: 'retain', reviewReason: '提醒卡片标题作为打开详情的整行交互入口' },
  'src/views/repairs/RepairsView.vue': { count: 2, status: 'retain', reviewReason: '维修照片/视频缩略图预览入口' },
  'src/views/subsidy/components/SubsidyListSection.vue': { count: 1, status: 'retain', reviewReason: '国补移动卡片照片查看/管理的专用入口' }
}

function walk(directory, files = []) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const filePath = path.join(directory, entry.name)
    if (entry.isDirectory()) walk(filePath, files)
    else if (entry.name.endsWith('.vue')) files.push(filePath)
  }
  return files
}

function relative(filePath) {
  return path.relative(frontendRoot, filePath).split(path.sep).join('/')
}

let nativeButtonCount = 0
let nativeButtonFiles = 0

for (const file of walk(sourceRoot)) {
  const source = fs.readFileSync(file, 'utf8')
  const count = (source.match(/<button\b/gi) || []).length
  if (!count) continue

  const fileName = relative(file)
  nativeButtonCount += count
  nativeButtonFiles += 1
  if (!nativeButtonExceptions[fileName]) {
    findings.push(`${fileName} 含 ${count} 个原生 button，必须迁移为 el-button 或登记专用控件例外`)
  } else if (count > nativeButtonExceptions[fileName].count) {
    findings.push(`${fileName} 原生 button 数量从登记的 ${nativeButtonExceptions[fileName].count} 个增加到 ${count} 个；新增通用命令请使用 el-button，专用交互需先复核登记`)
  }

  for (const componentName of removedComponentNames) {
    if (new RegExp(`<${componentName}\\b`).test(source)) {
      findings.push(`${fileName} 使用已移除组件 ${componentName}，请改用 Element Plus 或现行公共组件`)
    }
  }
}

for (const [fileName, exception] of Object.entries(nativeButtonExceptions)) {
  if (!exception.reviewReason || !Number.isInteger(exception.count) || !['retain', 'candidate', 'mixed'].includes(exception.status)) {
    findings.push(`${fileName} 的原生 button 例外必须登记数量基线、复核状态和理由`)
  }
  if (!fs.existsSync(path.join(frontendRoot, fileName))) {
    findings.push(`原生 button 例外登记指向不存在的文件：${fileName}`)
  }
}

for (const file of [
  'src/components/DataEmptyState.vue',
  'src/components/search/UnifiedSearchPanel.vue',
  'src/components/Pagination.vue',
  'src/components/MobileDialog.vue',
  'src/components/InlineLoading.vue'
]) {
  if (!fs.existsSync(path.join(frontendRoot, file))) {
    findings.push(`缺少统一组件入口：${file}`)
  }
}

for (const componentName of removedComponentNames) {
  const file = path.join(sourceRoot, `${componentName}.vue`)
  if (fs.existsSync(file)) {
    findings.push(`${file} 是已退役组件，不能重新加入；请使用现行公共实现`)
  }
}

if (findings.length) {
  console.error(`组件采用率审计失败，共 ${findings.length} 处：`)
  for (const finding of findings) console.error(`- ${finding}`)
  process.exit(1)
}

const reviewCounts = Object.values(nativeButtonExceptions).reduce((counts, exception) => {
  counts[exception.status] += 1
  return counts
}, { retain: 0, candidate: 0, mixed: 0 })

console.log(`组件采用率审计通过：${nativeButtonFiles} 个文件、${nativeButtonCount} 个原生 button 均已登记；例外状态：保留 ${reviewCounts.retain}、待迁移 ${reviewCounts.candidate}、混合 ${reviewCounts.mixed}。`)
console.log('后台通用列表新增搜索、分页、弹窗、加载和空状态必须优先使用对应公共入口。')
