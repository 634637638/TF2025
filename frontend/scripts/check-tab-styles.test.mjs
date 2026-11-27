import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { parse } from '@vue/compiler-sfc'
import { auditPrivateTabStyles, auditPublicTabScroll, auditTabTemplate } from './check-tab-styles.mjs'

function inspectTemplate(html) {
  const aliases = new Set()
  const findings = []
  const { descriptor } = parse(`<template>${html}</template>`)
  auditTabTemplate(descriptor.template.ast, aliases, findings)
  return { aliases, findings }
}

test('页面标签、按钮型标签和混合操作工具栏接入公共结构', () => {
  const { findings } = inspectTemplate(`
    <el-tabs class="tf-page-tabs"><el-tab-pane class="tf-tab-panel" /></el-tabs>
    <div role="tablist" class="tab-navigation tf-page-tabs"><el-button role="tab" /></div>
    <div class="tf-tab-content" />
    <div class="sales-mode-tabs tf-compact-toolbar" role="group"><el-button class="tf-button--compact" /></div>`)
  assert.deepEqual(findings, [])
})

test('漏接公共标签栏、私有滚轮及行内样式会报错', () => {
  for (const markup of [
    '<div class="sales-mode-tabs"><el-button>图文</el-button></div>',
    '<div role="tablist"><el-button role="tab">图文</el-button></div>',
    '<ElTabs><ElTabPane /></ElTabs>',
    '<div class="tf-compact-toolbar" @wheel="scroll" />',
    '<div class="tf-compact-toolbar"><el-button>图文</el-button></div>',
    '<div class="tf-compact-toolbar" :style="{ scrollbarWidth: width }" />'
  ]) assert.ok(inspectTemplate(markup).findings.length > 0, markup)
})

test('独立 CSS 和嵌套 SCSS 不能重新定义标签栏滚动及按钮大小', () => {
  const { aliases } = inspectTemplate('<div class="sales-mode-tabs tf-compact-toolbar" />')
  const violations = [
    ['page.css', '.sales-mode-tabs { scrollbar-width: thin }', 'scrollbar-width'],
    ['page.scss', '.sales-mode-tabs { &::-webkit-scrollbar { display: block } }', 'display'],
    ['page.scss', '.settings { :deep(.el-tabs__nav-wrap) { overflow-x: auto } }', 'overflow-x'],
    ['page.css', '.tf-topbar-tabs .tabs-container { overscroll-behavior-inline: auto }', 'overscroll-behavior-inline'],
    ['page.css', '[role="tablist"] { scrollbar-width: auto }', 'scrollbar-width'],
    ['page.css', '.tf-compact-toolbar > .el-button { height: 40px }', 'height']
  ]
  for (const [file, style, property] of violations) {
    assert.ok(auditPrivateTabStyles(style, file, aliases).some(item => item.message.includes(property)), style)
  }
  const allowedLayout = '.title:has(> .tf-page-tabs) { flex-wrap: wrap } .sales-mode-tabs > .result-list { overflow: auto }'
  assert.deepEqual(auditPrivateTabStyles(allowedLayout, 'page.css', aliases), [])
})

test('公共标签栏的滚动条、横向回弹和文档底部回弹规则缺一即失败', () => {
  const stylesheet = readFileSync(new URL('../src/styles/components/_tabs.scss', import.meta.url), 'utf8')
  assert.deepEqual(auditPublicTabScroll(stylesheet), [])
  for (const [from, to] of [
    ['scrollbar-width: none', 'scrollbar-width: thin'],
    ['overscroll-behavior-x: none', 'overscroll-behavior-x: auto'],
    ['overflow-x: auto', 'overflow-x: hidden'],
    ['&::-webkit-scrollbar', '&::-webkit-scrollbar-thumb'],
    ['overscroll-behavior-y: none', 'overscroll-behavior-y: auto']
  ]) {
    assert.ok(auditPublicTabScroll(stylesheet.replace(from, to)).length > 0, from)
  }
})
