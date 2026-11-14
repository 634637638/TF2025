import { test } from 'node:test'
import assert from 'node:assert/strict'
import { inspectMobileRecordDetails } from './lib/mobile-record-detail-contract.mjs'
const inspect = (template, script = '', purposes = []) => inspectMobileRecordDetails(`<template>${template}</template><script setup>${script}</script>`, 'test.vue', purposes)
test('公共入口、逐实例关联用途和显式输入允许，真正数据展开保留', () => {
  assert.equal(inspect('<el-table v-table-double-tap="options" :data="pageRows" />').findings.length, 0)
  assert.equal(inspect('<MobileDialog><el-table :data="history" /></MobileDialog>', '', [{ data: 'history', purpose: 'related-details' }]).findings.length, 0)
  assert.equal(inspect('<el-table :data="drafts" />', '', [{ data: 'drafts', purpose: 'data-entry' }]).findings.length, 0)
  assert.equal(inspect('<el-table v-table-double-tap="options"><el-table-column type="expand"><el-table :data="row.children" /><el-button>操作</el-button></el-table-column></el-table>', '', [{ data: 'row.children', purpose: 'related-details' }]).findings.length, 0)
})
test('弹窗和公共组件不再宽泛豁免，仅桌面表按真实可见条件识别', () => {
  assert.ok(inspect('<MobileDialog><el-table :data="history" /></MobileDialog>').findings.length)
  assert.ok(inspectMobileRecordDetails('<template><el-table :data="records" /></template>', 'src/components/BusinessList.vue').findings.length)
  assert.equal(inspect('<div v-if="!isMobile"><el-table :data="records" /></div>').findings.length, 0)
  assert.ok(inspect('<div v-if="isMobile"><el-table :data="records" /></div>').findings.length)
})
test('显式记录卡片只能置于公共宿主，兼容宿主自身即记录的形式', () => {
  assert.equal(inspect('<div v-table-double-tap="options"><article data-mobile-record /></div>').findings.length, 0)
  assert.equal(inspect('<article v-table-double-tap="options" data-mobile-record />').findings.length, 0)
  assert.ok(inspect('<article data-mobile-record />').findings.length)
})
test('缺少公共入口、按钮型展开、旧行操作和旧时间窗不能回退', () => {
  for (const template of ['<el-table :data="records" />', '<el-table v-table-double-tap="options"><el-table-column type="expand"><el-button>编辑</el-button></el-table-column></el-table>', '<div class="mobile-row-actions"><el-button>编辑</el-button></div>']) assert.ok(inspect(template).findings.length)
  assert.ok(inspect('<div />', 'const detector = useMobileRowDoubleTap()').findings.length)
})
test('描述列表只能通过公共响应式入口，公共组件内部保留 Element Plus 原件', () => {
  assert.equal(inspect('<RecordDescriptions><el-descriptions-item label="名称">记录</el-descriptions-item></RecordDescriptions>').findings.length, 0)
  assert.ok(inspect('<el-descriptions :column="2" />').findings.length)
  assert.equal(inspectMobileRecordDetails('<template><el-descriptions /></template>', 'src/components/RecordDescriptions.vue').findings.length, 0)
})
