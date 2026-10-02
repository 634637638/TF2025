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
  'src/views/subsidy/components/SubsidyApplyDialog.vue': '国补照片预览工作台',
  'src/views/subsidy/components/SubsidyPhotoManageDialog.vue': '国补照片管理与预览工作台'
}
const requiredMobileDialogFiles = [
  'src/views/query/QueryView.vue',
  'src/components/query/QueryDetailDialog.vue'
]

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

if (findings.length) {
  console.error(`弹窗采用率审计失败，共 ${findings.length} 处：`)
  for (const finding of findings) console.error(`- ${finding}`)
  process.exit(1)
}

console.log(`弹窗采用率审计通过：直接 el-dialog 专用边界 ${Object.keys(directDialogExceptions).length} 个文件；查询页弹窗已强制接入 MobileDialog。`)
