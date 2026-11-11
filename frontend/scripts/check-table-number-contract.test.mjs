import assert from 'node:assert/strict'
import { test } from 'node:test'
import { auditNumberColumns, auditNumberStyles } from './lib/table-number-contract.mjs'

const view = column => `<template><el-table>${column}</el-table></template>`

test('分页、倒序及真实 ID 均可复用公共样式，不约束取值公式', () => {
  for (const [label, expression] of [['序号', 'getIndex($index)'], ['序号', 'total - $index'], ['ID', 'row.id']]) {
    assert.deepEqual(auditNumberColumns(view(`<el-table-column label="${label}" :width="$getNumberColumnWidth(values)"><template #default="{ row, $index }"><span class="table-number-badge">{{ ${expression} }}</span></template></el-table-column>`)), [])
  }
})

test('纯数字序号、原生 index 及未接入的 ID 列均被拒绝', () => {
  for (const column of ['<el-table-column type="index" label="序号" />', '<el-table-column type="index" label="#" />', '<el-table-column prop="id" label="ID" />', '<el-table-column label="序号"><template #default>1</template></el-table-column>']) {
    assert.ok(auditNumberColumns(view(column)).length)
  }
})

test('排名和只读排序不能绕过公共数字展示', () => {
  for (const label of ['排名', '排序']) {
    assert.ok(auditNumberColumns(view(`<el-table-column type="index" label="${label}"/>`)).length)
    assert.deepEqual(auditNumberColumns(view(`<el-table-column label="${label}" :width="$getNumberColumnWidth(values)"><template #default="{ $index }"><span class="table-number-badge">{{ $index + 1 }}</span></template></el-table-column>`)), [])
  }
})

test('可编辑排序控件和设备序列号保留各自语义', () => {
  assert.deepEqual(auditNumberColumns(view('<el-table-column label="排序"><template #default="{ row }"><el-input-number v-model="row.sort_order"/></template></el-table-column><el-table-column prop="serial_number" label="序列号"/>')), [])
})

test('表格外的独立编号与排序值同样纳入审计', () => {
  for (const expression of ['index + 1', 'idx + 1', 'items.indexOf(phone) + 1', 'row.sort_order', 'item.sort_order || index + 1']) {
    assert.ok(auditNumberColumns(view(`<div>{{ ${expression} }}</div>`)).length)
    assert.deepEqual(auditNumberColumns(view(`<span class="table-number-badge">{{ ${expression} }}</span>`)), [])
  }
})

test('公共徽章内的条件模板、图片替代文字和连续编号说明不误报', () => {
  assert.deepEqual(auditNumberColumns(view('<span class="table-number-badge"><template v-if="visible">{{ index + 1 }}</template></span><img :alt="`图片 ${index + 1}`"><p>{{ index + 1 }}. {{ note }}</p>')), [])
})

test('使用公共徽章但仍固定列宽时拒绝接入', () => {
  assert.ok(auditNumberColumns(view('<el-table-column label="序号" width="50"><template #default><span class="table-number-badge">99999</span></template></el-table-column>')).length)
})

test('旧徽章名称被拒绝，Font Awesome 图标不误报', () => {
  assert.ok(auditNumberColumns(view('<span class="id-badge">1</span>')).length)
  assert.deepEqual(auditNumberColumns(view('<i class="fas fa-id-badge"/>')), [])
})

test('私有尺寸、颜色、响应式覆盖及嵌套样式被拒绝', () => {
  for (const css of ['.table-number-badge { color: red; }', '.dialog { .index-badge { width: 24px; } }', '@media (max-width: 767px) { .id-badge { padding: 0; } }', '.ranking-index { border-radius: 50%; }', '.priority-rank { color: red; }', '.page { --admin-data-table-number-radius: 50%; }']) {
    assert.ok(auditNumberStyles(css).length)
  }
})

test('业务样式及注释不误报', () => {
  assert.deepEqual(auditNumberStyles('/* .id-badge { color: red; } */ .spec-badge { color: var(--el-color-primary); }'), [])
})
