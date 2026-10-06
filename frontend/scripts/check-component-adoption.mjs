#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'

const frontendRoot = path.resolve(new URL('..', import.meta.url).pathname)
const sourceRoot = path.join(frontendRoot, 'src')
const findings = []
const removedComponentNames = ['BaseButton', 'ConfirmDialog']

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
let elementButtonCount = 0
let elementButtonFiles = 0

for (const file of walk(sourceRoot)) {
  const source = fs.readFileSync(file, 'utf8')
  const fileName = relative(file)
  const nativeCount = (source.match(/<button\b/gi) || []).length
  const elementCount = (source.match(/<el-button\b/gi) || []).length

  if (nativeCount) {
    nativeButtonCount += nativeCount
    nativeButtonFiles += 1
    findings.push(`${fileName} 含 ${nativeCount} 个原生 <button>，所有按钮必须迁移为 el-button`)
  }
  if (elementCount) {
    elementButtonCount += elementCount
    elementButtonFiles += 1
  }

  for (const componentName of removedComponentNames) {
    if (new RegExp(`<${componentName}\\b`).test(source)) {
      findings.push(`${fileName} 使用已移除组件 ${componentName}，请改用 Element Plus 或现行公共组件`)
    }
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

console.log(`组件采用率审计通过：扫描所有 Vue 页面和公共组件，原生 <button>=${nativeButtonCount}（${nativeButtonFiles} 个文件），el-button=${elementButtonCount}（${elementButtonFiles} 个文件）。`)
console.log('原生按钮零容忍：业务、H5、公开页面和公共组件统一使用 Element Plus el-button。')
