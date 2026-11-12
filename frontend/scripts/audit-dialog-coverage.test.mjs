import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { readRoutes, readTemplate, readNativeCalls, readServiceCalls, readStyleCandidates, isPrivateDialogChrome, collectCoverage, verifyInventory } from './audit-dialog-coverage.mjs'

test('路由统计排除重定向和布局，保留复用文件的不同 URL', () => {
  const routes = readRoutes(`const routes = [
    { path: '/', component: () => import('@/views/Layout.vue'), children: [
      { path: '', redirect: '/one' },
      { path: 'one', component: () => import('@/views/Detail.vue') },
      { path: 'two', component: () => import('@/views/Detail.vue') }
    ] },
    { path: '/login', component: () => import('@/views/Login.vue') }
  ]`)
  assert.equal(routes.layouts.length, 1)
  assert.deepEqual(routes.leaves.map(route => route.path), ['/one', '/two', '/login'])
  assert.deepEqual(routes.leaves[0].layouts, ['src/views/Layout.vue'])
  assert.equal(routes.leaves[0].file, routes.leaves[1].file)
})

test('无法静态解析的路由明确失败，不能漏算后返回成功', () => {
  assert.throws(() => readRoutes('const routes = getRoutes()'), /无法解析/)
  assert.throws(() => readRoutes('const routes = [...extra]'), /未支持/)
})

test('模板统计忽略注释，识别 kebab-case，并保留实例而非仅按文件计数', () => {
  const result = readTemplate(`<template>
    <!-- <MobileDialog /> -->
    <MobileDialog title="编辑"><div class="content-overlay" /></MobileDialog>
    <mobile-dialog title="详情" />
    <el-dialog />
    <MediaPreviewViewer />
    <el-image-viewer />
    <div role="dialog" class="custom-mask" />
  </template>`)
  assert.deepEqual(result.dialogs.map(dialog => dialog.kind), ['MobileDialog', 'MobileDialog', 'el-dialog', 'MediaPreviewViewer', 'el-image-viewer'])
  assert.equal(result.dialogs[0].line, 3)
  assert.equal(result.overlays.length, 1)
  assert.equal(result.overlays[0].classes, 'custom-mask')
})

test('模板位置保留 SFC 中的真实行号', () => {
  const result = readTemplate('<script setup>const visible = true</script>\n\n<template>\n<MobileDialog />\n</template>')
  assert.equal(result.dialogs[0].line, 4)
})

test('原生弹框定位使用 AST，避免把注释或公共 prompt 函数误报为浏览器弹框', () => {
  const calls = readNativeCalls(`// window.prompt('示例')
    import { prompt } from './public';
    prompt('公共入口');
    const text = "window.alert('示例')";
    window.prompt('姓名');
    globalThis['confirm']('确认');
  `, 'example.ts')
  assert.deepEqual(calls, [{ line: 5, kind: 'window.prompt' }, { line: 6, kind: 'globalThis.confirm' }])
})

test('覆盖候选只定位公共弹窗属性和令牌，不把业务内容网格作为外壳覆盖', () => {
  const styles = readStyleCandidates(`
    .business-grid { display: grid; padding: var(--tf-space-4); }
    .business-dialog .el-dialog { border-radius: 24px !important; }
    @media (max-width: 767px) { .business-dialog { --tf-dialog-body-padding-block: 8px; } }
  `)
  assert.deepEqual(styles.map(style => style.property), ['border-radius', '--tf-dialog-body-padding-block'])
})

test('服务弹框识别公共导入、解构别名及对象调用，排除原生 prompt 和同名无关函数', () => {
  const calls = readServiceCalls(`
    import { confirmAction as ask } from '@/utils/message-box';
    import { useNotification as useFeedback } from '@/composables/useNotification';
    const { prompt: input } = useFeedback();
    const notice = useFeedback();
    ask('删除'); input('原因'); notice.alert('提示');
    window.prompt('原生'); unrelated.confirm('无关');
  `, 'example.ts')
  assert.deepEqual(calls.map(call => call.kind), ['confirmAction', 'prompt', 'alert'])
})

test('嵌套样式的父级声明、后置声明和断点不能绕过公共外壳检查', () => {
  const styles = readStyleCandidates(`
    // 父级令牌不能被子规则吞掉
    .ios-image-dialog {
      --tf-dialog-body-padding-inline: 20px;
      .image-wrapper { padding: 8px; }
      --tf-dialog-body-padding-block: 12px;
      @media (max-width: 767px) { .el-dialog__body { padding: 6px; } }
    }
    .note .el-message-box__message { max-height: 60vh; }
    .dialog .el-dialog__header { font-size: 18px; }
  `)
  assert.deepEqual(styles.filter(isPrivateDialogChrome).map(item => item.property), [
    '--tf-dialog-body-padding-inline', '--tf-dialog-body-padding-block', 'padding', 'font-size'
  ])
  assert.equal(styles.find(item => item.selector.includes('.el-message-box__message')).property, 'max-height')
})

test('真实覆盖图包含全部叶子路由和 Vue 单元，公共 MobileDialog 内部实现不重复计为业务弹窗', () => {
  const report = collectCoverage()
  assert.ok(report.pages.length > 0)
  assert.equal(report.summary.vueFiles, report.units.length)
  assert.equal(report.summary.leafRoutes, report.pages.length)
  assert.equal(report.summary['el-dialog'], report.dialogs.filter(dialog => dialog.kind === 'el-dialog').length)
  assert.ok(!report.dialogs.some(dialog => dialog.file === 'src/components/MobileDialog.vue'))
  for (const page of report.pages) assert.ok(page.dependencies.includes(page.file), page.path)
  const inventory = report.pages.find(page => page.path === '/inventory')
  assert.ok(inventory.dependencies.includes('src/components/StockInModal.vue'), '异步加载的子弹窗必须进入路由覆盖图')
  const ledger = readFileSync(new URL('../../docs/frontend/page-audit-inventory.md', import.meta.url), 'utf8')
  verifyInventory(report.summary, ledger)
  assert.throws(() => verifyInventory({ ...report.summary, leafRoutes: report.summary.leafRoutes + 1 }, ledger), /页面台账 实际叶子路由/)
})
