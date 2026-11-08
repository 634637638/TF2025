#!/usr/bin/env node

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { extname, join, relative, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const sourceRoot = join(root, 'src')
const findings = []

const directDialogExceptions = {
  'src/components/ReminderHost.vue': '全局提醒宿主，需要锁定交互并由提醒服务控制生命周期',
  'src/views/H5-admin/page/SoldProductsView.vue': 'H5 管理素材预览工作台',
  'src/views/backup/BackupView.vue': '备份清理表单，保留 Element Plus 表单校验行为',
  'src/views/reminders/ReminderView.vue': '待办编辑与执行记录双弹窗',
  'src/views/shared/SharedView.vue': '经验分享编辑器与分类管理工作台',
  'src/views/subsidy/components/SubsidyPhotoManageDialog.vue': '国补照片管理主工作台；图片查看使用公共 MediaPreviewViewer'
}
const requiredMobileDialogFiles = [
  'src/views/query/QueryView.vue',
  'src/components/query/QueryDetailDialog.vue'
]
const requiredMediaPreviewFiles = [
  'src/views/subsidy/components/SubsidyApplyDialog.vue',
  'src/views/subsidy/components/SubsidyPhotoManageDialog.vue'
]
const sharedDefaultWidthFiles = [
  'src/views/subsidy/components/SubsidyApplyDialog.vue',
  'src/views/subsidy/components/SubsidyEditDialog.vue'
]
const mobileDialogPath = join(sourceRoot, 'components/MobileDialog.vue')

function walk(directory, files = []) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const filePath = join(directory, entry.name)
    if (entry.isDirectory()) walk(filePath, files)
    else if (extname(filePath) === '.vue') files.push(filePath)
  }
  return files
}

function lineNumber(source, index) {
  return source.slice(0, index).split('\n').length
}

for (const file of walk(sourceRoot)) {
  const source = readFileSync(file, 'utf8')
  const relativeFile = relative(root, file).split('\\').join('/')
  const matches = [...source.matchAll(/<el-dialog\b/gi)]

  if (!matches.length || relativeFile === 'src/components/MobileDialog.vue') continue

  if (!directDialogExceptions[relativeFile]) {
    findings.push(`${relativeFile}:${lineNumber(source, matches[0].index)} 直接使用 el-dialog，必须迁移到 MobileDialog 或登记专用例外`)
    continue
  }

  if (!/<el-dialog\b[^>]*(?:\bclass=|:class=)/i.test(source)) {
    findings.push(`${relativeFile}:${lineNumber(source, matches[0].index)} 直接 el-dialog 必须声明业务 class，确保可追踪公共样式边界`)
  }
}

for (const relativeFile of requiredMobileDialogFiles) {
  const source = readFileSync(join(root, relativeFile), 'utf8')
  if (!/<MobileDialog\b/.test(source)) {
    findings.push(`${relativeFile} 的查询弹窗必须接入 MobileDialog 全局响应式方案`)
  }
}

const mobileDialogSource = readFileSync(mobileDialogPath, 'utf8')
if (!/width:\s*['"]var\(--tf-dialog-width\)['"]/.test(mobileDialogSource)) {
  findings.push('MobileDialog 的默认宽度必须读取 --tf-dialog-width，不得在组件中重复维护默认像素值')
}
for (const relativeFile of sharedDefaultWidthFiles) {
  const source = readFileSync(join(root, relativeFile), 'utf8')
  const dialogTag = source.match(/<MobileDialog\b[^>]*>/)?.[0]
  if (!dialogTag || /\b(?:width|max-width|maxWidth)\s*=/.test(dialogTag)) {
    findings.push(`${relativeFile} 的普通新增/编辑弹窗必须复用公共默认宽度，不得保留页面独立加宽`)
  }
}
const subsidyPageSource = readFileSync(join(sourceRoot, 'views/subsidy/SubsidyView.vue'), 'utf8')
if (/subsidy-dialog-wide|\.mobile-dialog-sheet-(?:panel|overlay)\s*\.subsidy-/.test(subsidyPageSource)) {
  findings.push('国补页面不得恢复私有加宽弹窗或按业务 class 覆盖手机弹窗外壳尺寸')
}
const dialogStyleSource = readFileSync(join(sourceRoot, 'styles/components/_dialog.scss'), 'utf8')
const variableSource = readFileSync(join(sourceRoot, 'styles/_variables.scss'), 'utf8')
if (!/--tf-z-message-box:\s*calc\(var\(--tf-z-viewer\)\s*\+\s*1\)/.test(variableSource)
  || !/\.el-overlay\.is-message-box\s*,\s*\.el-overlay-message-box\s*\{\s*z-index:\s*var\(--tf-z-message-box\)/.test(dialogStyleSource)) {
  findings.push('公共 MessageBox 根遮罩和内容必须使用高于媒体查看器的层级，避免预览中的删除确认被遮挡')
}
for (const relativeFile of requiredMediaPreviewFiles) {
  const source = readFileSync(join(root, relativeFile), 'utf8')
  if (!/<MediaPreviewViewer\b/.test(source)
    || /class=["'][^"']*\bphoto-viewer-dialog\b/.test(source)
    || /\.photo-nav-btn\s*\{/.test(source)) {
    findings.push(`${relativeFile} 的照片查看必须使用 MediaPreviewViewer，不得恢复私有查看器或导航按钮尺寸`)
  }
}
if (/class="mobile-dialog-footer"/.test(mobileDialogSource)) {
  findings.push('src/components/MobileDialog.vue 自定义 footer 不得自动包裹 .mobile-dialog-footer；底部只能保留一个 .el-dialog__footer 外壳')
}

// P0-B: 弹窗宽度档位必须由 _dialog.scss 统一定义，页面只能引用档位 class。
const dialogWidthTiers = [
  ['crud-dialog-sm', '500'],
  ['crud-dialog-md', '600'],
  ['crud-dialog-md-lg', '700'],
  ['crud-dialog-lg', '800'],
]
for (const [cls, px] of dialogWidthTiers) {
  const tierRule = new RegExp(`\\.${cls}\\s*\\{[^}]*--el-dialog-width:\\s*${px}px[^}]*--dialog-max-width:\\s*${px}px`, 's')
  if (!tierRule.test(dialogStyleSource)) {
    findings.push(`styles/components/_dialog.scss 必须定义 .${cls} 同时设置 --el-dialog-width 与 --dialog-max-width 为 ${px}px，弹窗档位宽度只能在公共样式维护`)
  }
}

// 已归一的表单/详情弹窗必须引用档位 class，且不得再声明页面级 --dialog-max-width 补丁。
const tierNormalizedDialogFiles = [
  'src/views/attendance/AttendanceView.vue',
  'src/views/customers/CustomersView.vue',
  'src/views/employees/EmployeesView.vue',
  'src/components/PublishToH5Modal.vue',
]
for (const relativeFile of tierNormalizedDialogFiles) {
  const source = readFileSync(join(root, relativeFile), 'utf8')
  if (!/\bcrud-dialog-(?:sm|md|md-lg|lg)\b/.test(source)) {
    findings.push(`${relativeFile} 的标准弹窗宽度必须使用 crud-dialog-* 档位 class`)
  }
  if (/--dialog-max-width\s*:/.test(source)) {
    findings.push(`${relativeFile} 不得再声明页面级 --dialog-max-width，档位宽度由 _dialog.scss 统一管理`)
  }
}

// salary 常规表单/详情弹窗必须归一到就近档位并移除独立 width；宽表/自适应弹窗保留自身宽度。
const salaryNormalizedDialogs = {
  'src/views/salary/page/SalaryEmployeeTemplateDialog.vue': 'crud-dialog-sm',
  'src/views/salary/page/SalarySettleDialog.vue': 'crud-dialog-sm',
  'src/views/salary/page/SalaryAttendanceFormDialog.vue': 'crud-dialog-md-lg',
  'src/views/salary/page/SalaryDetailDialog.vue': 'crud-dialog-md-lg',
  'src/views/salary/page/SalaryTemplateFormDialog.vue': 'crud-dialog-lg',
}
for (const [relativeFile, tier] of Object.entries(salaryNormalizedDialogs)) {
  const source = readFileSync(join(root, relativeFile), 'utf8')
  const dialogTag = source.match(/<MobileDialog\b[^>]*>/)?.[0] || ''
  if (!dialogTag.includes(tier)) {
    findings.push(`${relativeFile} 必须使用 ${tier} 档位 class 归一弹窗宽度`)
  }
  if (/\bwidth\s*=/.test(dialogTag)) {
    findings.push(`${relativeFile} 归一档位后不得保留页面独立 width`)
  }
}
if (!/@pointerdown="handleOverlayPointerDown"/.test(mobileDialogSource)
  || !/@pointerup="handleOverlayPointerUp"/.test(mobileDialogSource)
  || !/@pointercancel="resetOverlayPointer"/.test(mobileDialogSource)
  || !/const shouldClose = overlayClickReady && props\.closeOnClickModal/.test(mobileDialogSource)) {
  findings.push('src/components/MobileDialog.vue 手机遮罩关闭必须校验完整按下/抬起，防止双击穿透或正文拖动导致误关闭')
}

if (findings.length) {
  console.error(`弹窗采用率审计失败，共 ${findings.length} 处：`)
  for (const finding of findings) console.error(`- ${finding}`)
  process.exit(1)
}

console.log(`弹窗采用率审计通过：直接 el-dialog 专用边界 ${Object.keys(directDialogExceptions).length} 个文件；查询页使用 MobileDialog，国补图片查看使用 MediaPreviewViewer，预览删除确认层级已校验。`)
