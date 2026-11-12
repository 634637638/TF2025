#!/usr/bin/env node

import { readFileSync, readdirSync } from 'node:fs'
import { extname, join, relative, resolve } from 'node:path'
import { parse } from '@vue/compiler-sfc'
import { collectCoverage, isPrivateDialogChrome } from './audit-dialog-coverage.mjs'

const root = resolve(import.meta.dirname, '..')
const sourceRoot = join(root, 'src')
const findings = []

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

function walk(directory, files = [], extensions = new Set(['.vue'])) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const filePath = join(directory, entry.name)
    if (entry.isDirectory()) walk(filePath, files, extensions)
    else if (extensions.has(extname(filePath))) files.push(filePath)
  }
  return files
}

function lineNumber(source, index) {
  return source.slice(0, index).split('\n').length
}

function checkClosePolicy(template, file) {
  const normalizeTag = tag => tag.replace(/-/g, '').toLowerCase()
  const descendants = node => (node.children || []).flatMap(child =>
    child.type === 1 && normalizeTag(child.tag) === 'mobiledialog' ? [] : [child, ...descendants(child)])
  const plainText = node => node.type === 2 ? node.content : (node.children || []).map(plainText).join('').trim()
  const visit = node => {
    if (node.type === 1 && normalizeTag(node.tag) === 'mobiledialog') {
      const content = descendants(node)
      const hasDraft = content.some(child => child.type === 1 && (
        ['form', 'elform'].includes(normalizeTag(child.tag))
        || ['button', 'elbutton'].includes(normalizeTag(child.tag)) && plainText(child) === '保存'
      ))
      const close = node.props.find(prop => prop.type === 7 && prop.name === 'bind' && prop.arg?.content === 'close-on-click-modal')
      const title = node.props.find(prop => prop.type === 6 && prop.name === 'title')?.value?.content
        || node.props.find(prop => prop.type === 7 && prop.arg?.content === 'title')?.exp?.content || ''
      if (hasDraft && (!close?.exp?.content.trim() || close.exp.content.trim() === 'true')) {
        findings.push(`${file}:${node.loc.start.line} 创建/编辑及待提交表单必须禁用遮罩关闭，复用 :close-on-click-modal="false"`)
      } else if (!hasDraft && /详情|明细|历史|记录|预览/.test(title) && close?.exp?.content.trim() === 'false') {
        findings.push(`${file}:${node.loc.start.line} 查看类弹窗必须允许遮罩关闭，复用公共默认关闭规则`)
      }
    }
    for (const child of node.children || []) visit(child)
  }
  if (template) visit(template)
}

for (const file of walk(sourceRoot)) {
  const source = readFileSync(file, 'utf8')
  const relativeFile = relative(root, file).split('\\').join('/')
  const matches = [...source.matchAll(/<el-dialog\b/gi)]
  if (relativeFile !== 'src/components/MobileDialog.vue') {
    const { descriptor } = parse(source, { filename: file })
    checkClosePolicy(descriptor.template?.ast, relativeFile)
  }

  for (const tag of source.matchAll(/<MobileDialog\b[^>]*>/g)) {
    if (/\s(?::width|v-bind:width|width)\s*=\s*(?:"\s*(?:'\s*)?90%\s*'?\s*"|'\s*(?:"\s*)?90%\s*"?\s*')/.test(tag[0])) {
      findings.push(`${relativeFile}:${lineNumber(source, tag.index)} 弹窗不得使用 90% 宽度，手机边距必须复用公共规则；桌面尺寸使用公共档位或明确业务宽度`)
    }
  }

  if (!matches.length || relativeFile === 'src/components/MobileDialog.vue') continue

  findings.push(`${relativeFile}:${lineNumber(source, matches[0].index)} 直接使用 el-dialog，必须迁移到 MobileDialog`)
}

for (const relativeFile of requiredMobileDialogFiles) {
  const source = readFileSync(join(root, relativeFile), 'utf8')
  if (!/<MobileDialog\b/.test(source)) {
    findings.push(`${relativeFile} 的查询弹窗必须接入 MobileDialog 全局响应式方案`)
  }
}

const mobileDialogSource = readFileSync(mobileDialogPath, 'utf8')
if (!/closeOnClickModal:\s*true/.test(mobileDialogSource)) {
  findings.push('MobileDialog 默认必须允许查看类弹窗点击遮罩关闭，编辑类由业务显式关闭此行为')
}
if (/\bwidth:\s*['"](?:var\(--tf-dialog-width\)|\d+(?:px|%|vw))['"]/.test(mobileDialogSource)) {
  findings.push('MobileDialog 不得把默认宽度注入 props；未传 width 时必须由全局 CSS 选择档位或默认值')
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
const headerRule = dialogStyleSource.match(/\.el-dialog__header\s*,\s*\.el-message-box__header\s*\{([^}]+)\}/)?.[1] || ''
if (!/--tf-dialog-header-height:\s*50px\s*;/.test(dialogStyleSource)
  || !/\bheight:\s*var\(--tf-dialog-header-height\)/.test(headerRule)
  || !/\bmin-height:\s*var\(--tf-dialog-header-height\)/.test(headerRule)
  || !/\bpadding:\s*0\s+var\(--tf-dialog-header-padding-x\)/.test(headerRule)) {
  findings.push('弹窗标题栏必须由 _dialog.scss 唯一定义为 50px，所有设备共用高度和零上下内边距')
}
for (const file of walk(sourceRoot, [], new Set(['.vue', '.scss', '.css']))) {
  const relativeFile = relative(root, file).split('\\').join('/')
  if (relativeFile === 'src/styles/components/_dialog.scss') continue
  const source = readFileSync(file, 'utf8')
  for (const match of source.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (/\.(?:el-dialog__header|el-message-box__header|mobile-dialog-sheet-header)\b/.test(match[1])
      && /(?:^|;)\s*(?:height|min-height|max-height|padding(?:-top|-bottom|-block(?:-start|-end)?)?)\s*:/.test(match[2])) {
      findings.push(`${relativeFile}:${lineNumber(source, match.index)} 标题栏高度和上下间距必须复用 _dialog.scss，不得在组件或页面重复覆盖`)
    }
    if (/\.mobile-dialog-sheet-close\b/.test(match[1])
      && /(?:^|;)\s*top\s*:/.test(match[2])) {
      findings.push(`${relativeFile}:${lineNumber(source, match.index)} 关闭按钮顶部偏移必须复用全局标题栏居中规则`)
    }
  }
  if (/--tf-dialog-(?:header-height|header-padding-y|sheet-header-min-height|close-top)\s*:/.test(source)) {
    findings.push(`${relativeFile} 不得重复定义公共标题栏高度、上下间距或关闭按钮顶部令牌`)
  }
}
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
  ['crud-dialog-lg', '800']
]
for (const [cls, px] of dialogWidthTiers) {
  const tierRule = new RegExp(`\\.${cls}\\s*\\{[^}]*--tf-dialog-tier-width:\\s*${px}px[^}]*--el-dialog-width:\\s*var\\(--tf-dialog-tier-width\\)[^}]*--dialog-max-width:\\s*var\\(--tf-dialog-tier-width\\)`, 's')
  if (!tierRule.test(dialogStyleSource)) {
    findings.push(`styles/components/_dialog.scss 必须定义 .${cls} 的唯一档位值 ${px}px，并让 Element Plus 宽度及上限引用该令牌`)
  }
}

// 已归一的表单/详情弹窗必须引用档位 class，且不得再声明页面级 --dialog-max-width 补丁。
const tierNormalizedDialogFiles = [
  'src/views/attendance/AttendanceView.vue',
  'src/views/customers/CustomersView.vue',
  'src/views/employees/EmployeesView.vue',
  'src/components/PublishToH5Modal.vue'
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
  'src/views/salary/page/SalaryTemplateFormDialog.vue': 'crud-dialog-lg'
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

const coverage = collectCoverage()
for (const candidate of coverage.styles.filter(isPrivateDialogChrome)) {
  findings.push(`${candidate.file}:${candidate.line} ${candidate.property} 必须由公共弹窗入口维护，不得覆盖外壳或令牌`)
}
for (const call of coverage.nativeCalls) findings.push(`${call.file}:${call.line} ${call.kind} 必须复用公共通知服务`)
for (const dialog of coverage.dialogs.filter(dialog => dialog.kind === 'el-image-viewer')) {
  findings.push(`${dialog.file}:${dialog.line} 图片查看必须使用 MediaPreviewViewer`)
}

if (findings.length) {
  console.error(`弹窗采用率审计失败，共 ${findings.length} 处：`)
  for (const finding of findings) console.error(`- ${finding}`)
  process.exit(1)
}

console.log('弹窗采用率审计通过：业务直接 el-dialog、原生弹框及私有外壳覆盖均为 0；媒体查看统一使用 MediaPreviewViewer，预览删除确认层级已校验。')
