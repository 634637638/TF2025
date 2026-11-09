#!/usr/bin/env node
// 使用真实组件和浏览器测量 CSS 尺寸；不加载业务页面或访问云端接口。
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { createServer } from 'vite'
import vue from '@vitejs/plugin-vue'

const root = resolve(import.meta.dirname, '..')
const chrome = process.env.CHROME_BIN || [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome'
].find(existsSync)
assert.ok(chrome, '请安装 Chrome/Chromium 或设置 CHROME_BIN，浏览器验证不能以跳过代替通过')
const profile = await mkdtemp(join(tmpdir(), 'tf-dialog-width-'))
let browser, socket, server
const pending = new Map()
const runtimeErrors = []
let requestId = 0
const entry = `
import { createApp, h, reactive, nextTick } from 'vue';
import { createPinia } from 'pinia';
import { ElDialog, ElButton, ElMessageBox } from 'element-plus';
import MobileDialog from '/src/components/MobileDialog.vue';
import QueryDetailContent from '/src/components/query/QueryDetailContent.vue';
import 'element-plus/dist/index.css';
import '/src/styles.scss';
import '/src/styles/components/_dialog.scss';
import '/src/styles/components/_dialog-actions.scss';
let app, state;
const actionButtons = count => Array.from({ length: count }, (_, index) => h(ElButton, { size: ['small', 'default', 'large'][index % 3], type: ['primary', 'danger', 'warning'][index % 3] }, () => ['取消', '保存更改', '退库', '关闭'][index]));
window.renderActions = async (kind, count = 3) => {
  ElMessageBox.close();
  app?.unmount();
  const pinia = createPinia();
  const content = kind === 'query'
    ? () => h(QueryDetailContent, { detailItem: { 基本信息: {} }, canEdit: true, canDelete: count >= 2, canReturnToStock: count >= 3 })
    : () => h('div', { class: kind === 'toolbar' ? 'tf-dialog-toolbar' : 'tf-dialog-actions dialog-footer' }, actionButtons(count));
  app = createApp({ render: () => kind === 'messagebox' ? h('div') : kind === 'query' || kind === 'toolbar'
    ? h(MobileDialog, { modelValue: true, title: '设备销售信息', showDefaultFooter: false }, { default: content })
    : kind === 'default'
      ? h(MobileDialog, { modelValue: true, title: '公共默认底部' })
      : h(ElDialog, { modelValue: true, title: '公共操作区', width: '90%' }, { default: () => '正文', footer: kind === 'raw' ? () => actionButtons(count) : content }) });
  app.use(pinia); app.component('ElDialog', ElDialog); app.component('ElButton', ElButton);
  app.mount('#app'); await nextTick();
  if (kind === 'messagebox') {
    ElMessageBox({ title: '删除确认', message: '公共确认框尺寸回归', showCancelButton: true }, app._context).catch(() => {});
    await nextTick();
  }
};
window.actionMetrics = () => {
  const container = document.querySelector('.tf-dialog-actions, .tf-dialog-toolbar, .mobile-dialog-footer, .default-footer, .el-dialog__footer, .el-message-box__btns');
  const buttons = [...container.querySelectorAll('.el-button')];
  const parent = buttons[0].parentElement, parentRect = parent.getBoundingClientRect(), parentCss = getComputedStyle(parent);
  const contentLeft = parentRect.left + parseFloat(parentCss.borderLeftWidth) + parseFloat(parentCss.paddingLeft);
  const contentRight = parentRect.right - parseFloat(parentCss.borderRightWidth) - parseFloat(parentCss.paddingRight);
  return { contentLeft, contentRight, gap: parseFloat(parentCss.gap), buttons: buttons.map(button => {
    const rect = button.getBoundingClientRect(), css = getComputedStyle(button);
    return { width: rect.width, height: rect.height, top: rect.top, left: rect.left, right: rect.right,
      minWidth: parseFloat(css.minWidth), font: parseFloat(css.fontSize), radius: parseFloat(css.borderRadius), padding: parseFloat(css.paddingLeft) };
  }) };
};
window.renderDialog = async (props) => {
  app?.unmount();
  state = reactive({ modelValue: false, title: '客户详情', ...props });
  app = createApp({ render: () => h(MobileDialog, state, { default: () => h('div', { style: { width: '100%', minHeight: '180px' } }, '弹窗宽度回归') }) });
  app.use(createPinia()); app.component('ElDialog', ElDialog); app.component('ElButton', ElButton);
  app.mount('#app'); await nextTick(); state.modelValue = true; await nextTick();
};
window.updateDialog = async props => { Object.assign(state, props); await nextTick(); };
window.dialogMetrics = () => {
  const panel = document.querySelector('.el-dialog, .el-message-box');
  const rect = panel.getBoundingClientRect();
  return { width: rect.width, left: rect.left, right: rect.right, sheet: panel.classList.contains('mobile-dialog-sheet-panel') };
};
`
const html = '<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="app"></div><script type="module" src="/__dialog-width.js"></script></body></html>'

function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++requestId
    const timeout = setTimeout(() => { pending.delete(id); reject(new Error(`CDP 超时：${method}`)) }, 30000)
    pending.set(id, { resolve, reject, timeout })
    socket.send(JSON.stringify({ id, method, params }))
  })
}
async function evaluate(expression) {
  const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
  assert.ok(!result.exceptionDetails, JSON.stringify(result.exceptionDetails))
  return result.result.value
}
async function measure() {
  // 等待实际组件过渡完成，避免把 scale 动画中的边界当成最终尺寸。
  await evaluate(`(async () => {
    for (let frame = 0; frame < 3; frame++) await new Promise(requestAnimationFrame);
    await Promise.all(document.getAnimations().map(animation => animation.finished.catch(() => {})));
  })()`)
  return evaluate('window.dialogMetrics()')
}
function checkWidth(metrics, expected, label, viewport) {
  assert.ok(Math.abs(metrics.width - expected) < 1, `${label}: 期望 ${expected}px，实际 ${metrics.width}px`)
  assert.ok(metrics.left >= -1 && metrics.right <= viewport + 1, `${label}: 弹窗越出视口`)
  assert.equal(metrics.sheet, viewport <= 1024, `${label}: 响应式分支错误`)
}

try {
  server = await createServer({
    configFile: false, envFile: false, root, logLevel: 'error',
    // 隔离测试预构建，避免覆盖正在运行的开发服务器依赖缓存。
    cacheDir: join(profile, 'vite-cache'),
    plugins: [vue(), {
      name: 'dialog-width-regression',
      resolveId(id) {
        if (id === '\0dialog-field-permissions') return id
        if (id === '/__dialog-width.js') return '\0dialog-width-entry'
      },
      load(id) {
        if (id === '\0dialog-width-entry') return entry
        if (id === '\0dialog-field-permissions') return 'export const fieldPermissions = { isFieldVisible: () => false };'
      },
      configureServer(vite) {
        vite.middlewares.use((req, res, next) => {
          if (req.url === '/__dialog-width') { res.setHeader('Content-Type', 'text/html'); res.end(html) } else next()
        })
      }
    }],
    resolve: { alias: [
      // 仅隔离字段权限依赖；真实详情组件不访问认证和云端接口。
      { find: '@/composables/useFieldPermissions', replacement: '\0dialog-field-permissions' },
      { find: '@', replacement: join(root, 'src') }
    ] },
    server: { host: '127.0.0.1', port: 0 }
  })
  await server.listen()
  const port = server.httpServer.address().port
  browser = spawn(chrome, ['--headless=new', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
  browser.on('error', error => runtimeErrors.push(error.message))
  let debugPort
  for (let i = 0; i < 100; i++) {
    try { debugPort = Number((await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]); break } catch { await delay(100) }
  }
  assert.ok(debugPort, `Chrome 未启动：${runtimeErrors.join('; ')}`)
  const target = await (await fetch(`http://127.0.0.1:${debugPort}/json/new?about:blank`, { method: 'PUT' })).json()
  socket = new WebSocket(target.webSocketDebuggerUrl)
  await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }) })
  socket.addEventListener('message', event => {
    const msg = JSON.parse(event.data)
    if (msg.method === 'Runtime.exceptionThrown') runtimeErrors.push(msg.params.exceptionDetails.exception?.description || msg.params.exceptionDetails.text)
    const request = pending.get(msg.id)
    if (request) {
      clearTimeout(request.timeout); pending.delete(msg.id)
      if (msg.error) request.reject(new Error(JSON.stringify(msg.error)))
      else request.resolve(msg.result)
    }
  })
  await send('Page.enable'); await send('Runtime.enable')
  await send('Page.navigate', { url: `http://127.0.0.1:${port}/__dialog-width` })
  let ready = false
  for (let i = 0; i < 300; i++) { if (runtimeErrors.length) break; if (await evaluate('typeof window.renderDialog === "function"')) { ready = true; break } await delay(100) }
  assert.ok(ready, `组件未加载：${runtimeErrors.join('; ')}`)

  let checks = 0
  for (const viewport of process.argv.includes('--actions-only') ? [] : [360, 375, 390, 430, 768, 1024, 1440, 1920]) {
    await send('Emulation.setDeviceMetricsOverride', { width: viewport, height: 900, screenWidth: viewport, screenHeight: 900, deviceScaleFactor: 1, mobile: viewport < 768 })
    const cap = viewport < 768 ? viewport - 8 : viewport <= 1024 ? viewport * 0.8 : viewport - 32
    const cases = [
      ['默认880', {}, viewport < 768 ? cap : Math.min(880, cap)],
      ['页面尺寸优先于默认', { width: 760 }, Math.min(760, cap)],
      ...[['sm', 500], ['md', 600], ['md-lg', 700], ['lg', 800]].map(([tier, size]) => [`档位${tier}`, { dialogClass: `crud-dialog-${tier}` }, viewport < 768 ? cap : Math.min(size, cap)]),
      ['显式优先于档位', { dialogClass: 'crud-dialog-lg', width: 900 }, Math.min(900, cap)],
      ['显式宽度受上限约束', { width: '900px', maxWidth: '700px', dialogClass: 'crud-dialog-lg' }, Math.min(700, cap)],
      ['较大上限不扩宽', { width: 500, maxWidth: 900 }, Math.min(500, cap)],
      ['仅设置上限', { maxWidth: 500 }, Math.min(500, cap)],
      ['手机较小宽度', { width: 280 }, 280],
      ['手机较小上限', { maxWidth: 280 }, 280],
      ['库存入库宽工作台', { width: 1240 }, Math.min(1240, cap)]
    ]
    for (const theme of ['light', 'dark']) {
      await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: theme }] })
      await evaluate(`document.documentElement.dataset.theme = ${JSON.stringify(theme)}`)
      for (const [name, props, expected] of cases) {
        await evaluate(`window.renderDialog(${JSON.stringify(props)})`)
        checkWidth(await measure(), expected, `${viewport}/${theme}/${name}`, viewport); checks++
      }
    }
    await evaluate('window.renderDialog({dialogClass:"crud-dialog-lg",width:900,maxWidth:700})')
    await evaluate('window.updateDialog({width:undefined,maxWidth:undefined})')
    checkWidth(await measure(), viewport < 768 ? cap : Math.min(800, cap), '移除显式尺寸恢复档位', viewport); checks++
    await evaluate('window.renderDialog({width:"fit-content",maxWidth:"960px"})')
    const intrinsic = await measure()
    assert.ok(intrinsic.width > 0 && intrinsic.width <= Math.min(960, cap) + 1, '内容自适应宽度应有效且不越界'); checks++
    await evaluate('window.renderDialog({width:"90%"})')
    const percent = await measure()
    assert.ok(percent.width > 0 && percent.width <= cap + 1, '百分比宽度应有效且不越界'); checks++
    if (viewport >= 1440) {
      checkWidth(percent, 880, '综合查询90%素材管理受公共880上限约束', viewport)
      for (const width of ['90vw', '90dvw', 'calc(100vw - 32px)']) {
        await evaluate(`window.renderDialog(${JSON.stringify({ width })})`)
        checkWidth(await measure(), 880, `${width}自适应宽度受公共上限约束`, viewport); checks++
      }
      await evaluate('window.renderDialog({width:"90%",maxWidth:1240})')
      checkWidth(await measure(), 1240, '工作台明确声明上限允许加宽', viewport); checks++
      await evaluate('window.updateDialog({maxWidth:undefined})')
      checkWidth(await measure(), 880, '移除上限恢复公共边界', viewport); checks++
    }
  }
  if (!process.argv.includes('--actions-only')) {
    await evaluate('window.renderDialog({width:1240})')
    for (const [viewport, expected] of [[390, 382], [768, 614.4], [1440, 1240]]) {
      await send('Emulation.setDeviceMetricsOverride', { width: viewport, height: 900, screenWidth: viewport, screenHeight: 900, deviceScaleFactor: 1, mobile: viewport < 768 })
      // 打开期间组件保留布局分支，尺寸仍应随屏幕变化。
      const metrics = await measure()
      assert.ok(Math.abs(metrics.width - expected) < 1, `打开期间调整视口至 ${viewport}px 应自动适配，实际 ${metrics.width}px`)
      assert.ok(metrics.left >= -1 && metrics.right <= viewport + 1, '调整视口后不可越界')
      checks++
    }
  }
  let actionChecks = 0
  for (const viewport of [360, 375, 390, 430, 767, 768, 1024, 1440]) {
    await send('Emulation.setDeviceMetricsOverride', { width: viewport, height: 900, deviceScaleFactor: 1, mobile: viewport < 768 })
    for (const theme of ['light', 'dark']) {
      await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: theme }, { name: 'prefers-reduced-motion', value: 'reduce' }] })
      await evaluate(`document.documentElement.dataset.theme = ${JSON.stringify(theme)}`)
      const expectedHeight = viewport <= 767 ? Math.min(32, Math.max(30, viewport * 0.0854)) : viewport <= 1024 ? 40 : 32
      for (const kind of ['query', 'default', 'custom', 'raw', 'toolbar', 'messagebox']) {
        for (const count of kind === 'query' ? [1, 2, 3] : ['default', 'messagebox'].includes(kind) ? [2] : [1, 2, 3, 4]) {
          await evaluate(`window.renderActions(${JSON.stringify(kind)}, ${count})`); await measure()
          const { contentLeft, contentRight, gap, buttons } = await evaluate('window.actionMetrics()')
          assert.equal(buttons.length, count, `${kind} 按钮数量`)
          assert.equal(gap, viewport <= 767 ? 6 : viewport <= 1024 ? 8 : 4, `${viewport}/${kind} 公共间距`)
          for (const button of buttons) {
            assert.ok(Math.abs(button.height - expectedHeight) < 0.1, `${viewport}/${kind} 高度: ${button.height}`)
            assert.equal(button.radius, 6, `${viewport}/${kind} 圆角`)
            assert.ok(button.left >= 0 && button.right <= viewport, `${viewport}/${kind} 不可溢出`)
            if (viewport <= 767) {
              assert.equal(button.font, 12, `${kind} 手机字号`)
              assert.ok(Math.abs(button.padding - Math.min(8, Math.max(6, viewport * 0.0214))) < 0.1, `${kind} 手机内边距`)
            }
            if (kind !== 'toolbar' && viewport <= 1024) {
              assert.ok(Math.abs(button.top - buttons[0].top) < 0.1, `${kind} 保持单行`)
            }
          }
          if (kind !== 'toolbar' && viewport <= 1024) {
            const available = contentRight - contentLeft
            const expectedWidth = Math.min(150, (available - gap * (count - 1)) / count)
            for (const button of buttons) {
              assert.equal(button.minWidth, 0, `${viewport}/${kind} 不得继承桌面最小宽度`)
              assert.ok(Math.abs(button.width - expectedWidth) < 1, `${viewport}/${kind}/${count} 应等分且限制按钮宽度，实际 ${button.width}px；期望 ${expectedWidth}px`)
            }
            const leftSpace = buttons[0].left - contentLeft
            const rightSpace = contentRight - buttons.at(-1).right
            assert.ok(Math.abs(leftSpace - rightSpace) < 1, `${viewport}/${kind}/${count} 按钮组应居中`)
          }
          actionChecks++
        }
      }
    }
  }
  console.log(`弹窗按钮浏览器回归通过：${actionChecks} 组，真实综合查询组件、默认/自定义/原生 footer、确认框和正文工具栏，1～4 个按钮、等宽/150px上限/居中、尺寸别名和明暗主题。`)
  assert.deepEqual(runtimeErrors, [])
  if (checks) console.log(`弹窗宽度浏览器回归通过：${checks} 项，8 种视口、明暗主题、4 个档位、显式宽度/上限、动态回退和自适应内容。`)
} finally {
  for (const request of pending.values()) clearTimeout(request.timeout)
  socket?.close()
  if (browser && browser.exitCode === null) {
    browser.kill('SIGTERM')
    await new Promise(resolve => {
      const timeout = setTimeout(resolve, 3000)
      browser.once('exit', () => { clearTimeout(timeout); resolve() })
    })
    if (browser.exitCode === null && browser.signalCode === null) browser.kill('SIGKILL')
  }
  await server?.close()
  await rm(profile, { recursive: true, force: true })
}
