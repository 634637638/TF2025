import { test } from 'node:test'
import assert from 'node:assert/strict'
import { auditAsyncSearchButtonUsage, auditBatchButtonSizes, auditButtonContract, auditButtonInlineStyles, auditButtonSizeDeclarations, auditCommandButtonSizes, auditOverlayDangerUsage, auditRefreshButtonUsage, auditTableButtonUsage, collectButtonClasses } from './lib/button-contract.mjs'
import { readFileSync } from 'node:fs'

const classes = collectButtonClasses([
  '<template><div class="button-group"><el-button class="selected-action-btn"><i class="button-icon"/></el-button><el-button class="custom-command shared"/><div class="shared"/></div></template>'
])

test('业务卡片不得通过静态或动态 class 复用危险覆盖工具，公共缩略图操作可用', () => {
  const source = `<template>
    <!-- <el-button class="tf-button--overlay-danger" /> -->
    <el-button class="product-remove tf-button--overlay-tool tf-button--overlay-danger" />
    <ElButton :class="['tf-button--overlay-danger']" />
    <MediaThumbnailActions :removable="canEdit" @remove="removeProduct" />
    <el-button type="danger">删除记录</el-button>
  </template>`
  assert.deepEqual(auditOverlayDangerUsage(source).map(finding => finding.line), [3, 4])
})

test('带加载状态的刷新按钮必须接入公共原图标旋转样式', () => {
  assert.deepEqual(auditRefreshButtonUsage('<template><el-button :loading="loading">刷新</el-button></template>').map(finding => finding.line), [1])
  assert.deepEqual(auditRefreshButtonUsage('<template><el-button class="tf-button--refresh" :loading="loading">刷新</el-button></template>'), [])
  assert.deepEqual(auditRefreshButtonUsage('<template><el-button :loading="loading">保存</el-button></template>'), [])
})

test('异步检索按钮必须复用公共搜索动作组件', () => {
  assert.deepEqual(auditAsyncSearchButtonUsage('<template><el-button :loading="loading">搜索</el-button></template>').map(finding => finding.line), [1])
  assert.deepEqual(auditAsyncSearchButtonUsage('<template><el-button :disabled="searching">查询</el-button></template>').map(finding => finding.line), [1])
  assert.deepEqual(auditAsyncSearchButtonUsage('<template><SearchActionButton :loading="loading">搜索</SearchActionButton></template>'), [])
})

test('业务按钮的静态和动态尺寸、旧尺寸类及操作组尺寸都必须回到公共默认', () => {
  const source = '<template><el-button size="small"/><el-button :size="mobile ? \'large\' : \'default\'"/><el-button v-bind:size="size"/><el-button-group size="small"/><el-button class="btn-sm"/><ElButton :class="[\'btn-lg\']"/><PublicPriceHeader action-size="small"/><ImportExportActions size="small"/><div class="batch-actions-buttons" :data-size="size"/></template>'
  expectFindings(source, 9)
})

function expectFindings(source, count, options) {
  assert.equal(auditButtonSizeDeclarations(source, options).length, count)
}

test('表单、标签、表格和分页尺寸不属于按钮声明，默认业务按钮保持有效', () => {
  expectFindings('<template><el-input size="small"/><el-select size="small"/><el-tag size="small"/><el-table size="small"/><Pagination size="small"/><el-button type="primary" :loading="loading"/><PublicPriceHeader :action-width="112"/></template>', 0)
})

test('只有标杆页显式标记的尺寸演示可保留声明，其他页面不能用标记绕过', () => {
  const source = '<template><el-button size="small" data-button-size-preview/><el-button size="large"/></template>'
  expectFindings(source, 2)
  expectFindings(source, 1, { allowPreview: true })
})

test('普通按钮默认、小号和大号均复用全局尺寸，缺失入口或硬编码会被拒绝', () => {
  const source = readFileSync(new URL('../src/styles/components/_buttons.scss', import.meta.url), 'utf8')
  assert.deepEqual(auditCommandButtonSizes(source), [])
  assert.equal(auditCommandButtonSizes('').length, 9)
  for (const declaration of [
    'height: var(--tf-button-height) !important',
    'height: var(--tf-button-height-small) !important',
    'height: var(--tf-button-height-large) !important',
    'padding-inline: var(--tf-button-padding-x) !important',
    'font-size: var(--tf-button-font-size-small) !important'
  ]) {
    assert.equal(auditCommandButtonSizes(source.replace(declaration, `${declaration.split(':')[0]}: 99px !important`)).length, 1)
  }
})

test('电脑端普通及页头按钮不声明 size 也复用公共小号，禁止恢复独立的大尺寸默认值', () => {
  const source = readFileSync(new URL('../src/styles/components/_buttons.scss', import.meta.url), 'utf8')
  for (const [property, token] of [
    ['--tf-button-height', '--tf-button-small-base-height'],
    ['--tf-button-padding-x', '--tf-button-small-base-padding-x'],
    ['--tf-button-font-size', '--tf-button-small-base-font-size'],
    ['--tf-toolbar-button-height', '--tf-button-small-base-height'],
    ['--tf-toolbar-button-padding-x', '--tf-button-small-base-padding-x'],
    ['--tf-toolbar-button-font-size', '--tf-button-small-base-font-size']
  ]) {
    assert.equal(auditCommandButtonSizes(source.replace(`${property}: var(${token});`, `${property}: 36px;`)).length, 1)
  }
})

test('批量操作小号声明复用公共令牌，缺失或私有尺寸映射会被拒绝', () => {
  const source = readFileSync(new URL('../src/styles/components/_table.scss', import.meta.url), 'utf8')
  assert.deepEqual(auditBatchButtonSizes(source), [])
  assert.equal(auditBatchButtonSizes('').length, 1)
  assert.equal(auditBatchButtonSizes(source.replace('var(--tf-button-batch-small-height)', '28px')).length, 1)
  const template = '<template><div class="batch-actions-buttons" :data-size="isMobile ? \'small\' : undefined"><el-button>清空选择</el-button></div></template>'
  assert.deepEqual(auditButtonInlineStyles(template), [])
  assert.equal(auditButtonInlineStyles(template.replace('<el-button>', '<el-button style="height: 28px">')).length, 1)
})

test('公共报价页头显式参数允许使用，私有按钮尺寸仍被拒绝', () => {
  const source = '<template><PublicPriceHeader :action-width="80" action-size="small"><template #actions><el-button class="quote-action tf-button--export">保存图片</el-button></template></PublicPriceHeader></template>'
  assert.deepEqual(auditButtonInlineStyles(source), [])
  const buttons = collectButtonClasses([source])
  assert.equal(auditButtonContract('.quote-action { width: 80px; }', buttons).length, 1)
})

test('表格文字按钮不能使用多行内容规格，静态和动态 class 均纳入检查', () => {
  for (const attribute of ['class="tf-button--content"', ':class="[\'tf-button--content\', active && \'selected\']"']) {
    const findings = auditTableButtonUsage(`<template><el-table><el-table-column><template #default><div><el-button ${attribute}>事项</el-button></div></template></el-table-column></el-table></template>`)
    assert.equal(findings.length, 1)
    assert.match(findings[0].message, /table-inline-action/)
  }
})

test('表格紧凑按钮、媒体缩略图和表格外内容选项保留各自用途', () => {
  assert.deepEqual(auditTableButtonUsage('<template><el-button class="tf-button--content">分组</el-button><el-table><el-table-column><el-button class="table-inline-action">事项</el-button><el-button class="tf-button--content tf-button--media-tile"><img src="/preview.png"/></el-button></el-table-column></el-table></template>'), [])
})

test('识别任意命名的实际按钮，排除布局和图标', () => {
  assert(classes.has('custom-command'))
  assert(!classes.has('button-group'))
  assert(!classes.has('button-icon'))
  assert(!classes.has('shared'))
})

test('PC 与手机的私有按钮外观均会报错', () => {
  const findings = auditButtonContract('.selected-action-btn { height: 60px; min-width: 120px; } @media (max-width: 767px) { .custom-command { font-size: 20px; padding: 18px; } }', classes)
  assert.deepEqual(findings.map(item => item.property), ['height', 'min-width', 'font-size', 'padding'])
})

test('嵌套 SCSS、状态与 deep 选择器不能绕过检查', () => {
  const findings = auditButtonContract('.panel { :deep(.el-button) { height: 40px; &:hover { background: var(--tf-button-primary-bg); } } }', classes)
  assert.deepEqual(findings.map(item => item.property).sort(), ['background', 'height'])
})

test('布局、图标、伪元素、输入控件和自然宽度不误报', () => {
  const style = '.button-group { padding: 20px; } .selected-action-btn { flex-shrink: 0; width: 100%; max-width: 100%; min-width: 0; } .selected-action-btn i { font-size: 12px; } .selected-action-btn::after { width: 8px; } .el-checkbox-button__inner { padding: 8px; }'
  assert.deepEqual(auditButtonContract(style, classes), [])
})

test('声明位置只包含违规内容，保留注释、布局和嵌套图标', () => {
  const source = '.custom-command { /* height: 9px; */ height: 60px; flex: 1; i { font-size: 12px; } }'
  const findings = auditButtonContract(source, classes)
  assert.equal(findings.length, 1)
  assert.equal(source.slice(findings[0].start, findings[0].end), 'height: 60px;')
})

test('行内共享按钮变量也属于私有覆盖', () => {
  const findings = auditButtonContract('.custom-command { --tf-button-height: 60px; --el-button-bg-color: red; }', classes)
  assert.equal(findings.length, 2)
})

test('动态 class 字符串中的实际按钮也受公共规格约束', () => {
  const dynamic = collectButtonClasses(['<template><el-button :class="[\'custom\', { \'selected\': active }]"/></template>'])
  assert(dynamic.has('custom'))
  assert(dynamic.has('selected'))
  assert.equal(auditButtonContract('.custom { font: inherit; padding: 20px; }', dynamic).length, 2)
})

test('注释不会吞掉 URL 后面的按钮声明', () => {
  const findings = auditButtonContract('.custom-command { background: url("https://example.test/a.png"); height: 60px; /* padding: 99px; */\n // color: red;\n padding: 12px; }', classes)
  assert.deepEqual(findings.map(item => item.property), ['background', 'height', 'padding'])
})

test('行内静态、动态对象和条件样式不能覆盖外观', () => {
  const source = '<template><el-button style="height: 60px; margin-left: 8px"/><el-button :style="{ paddingInline: \'20px\', width: \'100%\' }"/><el-button :style="ready ? { color: token } : { height: \'40px\' }"/><el-button :style="privateStyle"/></template>'
  assert.deepEqual(auditButtonInlineStyles(source).map(item => item.property), ['height', 'padding-inline', 'color', 'height', '动态样式'])
})

test('按钮行内布局合法，内部图标的样式不误报', () => {
  assert.deepEqual(auditButtonInlineStyles('<template><el-button style="width: 100%; position: absolute; top: 8px"><i style="font-size: 12px"/></el-button><el-button :style="[{ minWidth: 0 }, { marginLeft: \'8px\' }]"/></template>'), [])
})
