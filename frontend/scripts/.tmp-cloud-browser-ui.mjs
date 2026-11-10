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
import {createApp,h,reactive,nextTick} from 'vue';
import {createPinia} from 'pinia';
import ElementPlus from 'element-plus';
import Dialog from '/src/views/backup/CloudBackupSettingsDialog.vue';
import MobileDialog from '/src/components/MobileDialog.vue';
import SectionLoading from '/src/components/SectionLoading.vue';
import DataEmptyState from '/src/components/DataEmptyState.vue';
import 'element-plus/dist/index.css';
import '/src/styles.scss';
import '/src/styles/responsive.scss';
import '/src/styles/admin-layout.css';
import '/src/styles/components/_dialog.scss';
import '/src/styles/components/_dialog-actions.scss';
const state=reactive({open:false});
const app=createApp({render:()=>h(Dialog,{modelValue:state.open,'onUpdate:modelValue':v=>state.open=v})});
app.use(createPinia());app.use(ElementPlus);
app.component('MobileDialog',MobileDialog);app.component('SectionLoading',SectionLoading);app.component('DataEmptyState',DataEmptyState);
app.directive('permission',{});app.directive('tf-loading',{});
app.config.globalProperties.$getActionColumnWidth=()=>200;
app.mount('#app');window.renderDialog=async()=>{state.open=true;await nextTick();};
window.closeCloud=async()=>{state.open=false;await nextTick();};
window.clickText=async text=>{[...document.querySelectorAll('button,[role=tab]')].find(x=>x.textContent.trim()===text).click();await nextTick();};
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
        if (id.startsWith('\0cloud-')) return id
        if (id === '/__dialog-width.js') return '\0dialog-width-entry'
      },
      load(id) {
        if (id === '\0dialog-width-entry') return entry
        if(id==='\0cloud-permissions')return "import {ref} from 'vue';export const usePagePermissions=()=>({canDelete:ref(true),requirePermission:()=>true});";
        if(id==='\0cloud-notification')return "export const useNotification=()=>({success:()=>{},error:()=>{}});";
        if(id==='\0cloud-api')return `const settings={enabled:false,hasToken:true,folderId:'folder',folderName:'业务备份',driveId:'drive',lastError:''};export const backupCloudApi={settings:async()=>({success:true,data:settings}),connect:async()=>({success:true,data:{settings,drives:[{id:'drive',name:'默认云盘'}],defaultDriveId:'drive'}}),files:async p=>({success:true,data:{folder:p.trash?null:{driveId:p.driveId,folderId:p.folderId,folderName:p.folderId==='root'?'根目录':'业务备份'},nextMarker:'',items:p.trash?[]:[{id:'folder',type:'folder',name:'业务备份',size:0},{id:'file',type:'file',name:'备份文件名称测试.zip',size:1024}]}})};`;

      },
      configureServer(vite) {
        vite.middlewares.use((req, res, next) => {
          if (req.url === '/__dialog-width') { res.setHeader('Content-Type', 'text/html'); res.end(html) } else next()
        })
      }
    }],
    resolve: { alias: [
      // 仅隔离字段权限依赖；真实详情组件不访问认证和云端接口。
      { find: '@/composables/usePagePermissions', replacement: '\0cloud-permissions' },
      { find: '@/composables/useNotification', replacement: '\0cloud-notification' },
      { find: '@/api/backup', replacement: '\0cloud-api' },
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

  for(const width of [360,375,430,768,1024,1440]) {
    await send('Emulation.setDeviceMetricsOverride',{width,height:900,screenWidth:width,screenHeight:900,deviceScaleFactor:1,mobile:width<768});
    for(const theme of ['light','dark']) {
      await evaluate(`document.documentElement.classList.toggle('dark',${theme==='dark'});window.renderDialog()`);
      await delay(400);
      for(const step of ['settings','files','trash','folder','chosen']) {
        if(step==='chosen')await evaluate("window.clickText('使用此目录')");
        if(step==='files')await evaluate("window.clickText('浏览云盘 / 选择目录')");
        if(step==='trash')await evaluate("window.clickText('回收站')");
        if(step==='folder'){await evaluate("window.clickText('云盘文件')");await delay(100);await evaluate("window.clickText('打开目录')");}
        await delay(250);
        await evaluate('(async()=>{await Promise.all(document.getAnimations().map(x=>x.finished.catch(()=>{})))})()');
        const metric=await evaluate(`(()=>{const p=[...document.querySelectorAll('.el-dialog')].find(x=>x.getBoundingClientRect().width>0);const r=p.getBoundingClientRect();const body=p.querySelector('.el-dialog__body');return {left:r.left,right:r.right,overflow:body.scrollWidth>body.clientWidth+1,buttons:[...p.querySelectorAll('.el-dialog__footer button')].map(x=>{const b=x.getBoundingClientRect();return {left:b.left,right:b.right,top:b.top}}),token:p.querySelector('input[type=password]')?.value}})()`);
        assert.ok(metric.left>=-1&&metric.right<=width+1,JSON.stringify({width,step,metric}));
        assert.equal(metric.overflow,false,JSON.stringify({width,step,metric}));
        assert.ok(metric.buttons.every(x=>x.left>=metric.left&&x.right<=metric.right&&Math.abs(x.top-metric.buttons[0].top)<1));
        if(step==='settings'||step==='chosen')assert.equal(metric.token,'');
        if(step==='chosen'){const t=await evaluate('document.body.textContent');assert.ok(t.includes('当前备份目录：业务备份'));assert.ok(!t.includes('Drive ID'));}
        if(theme==='light'&&step==='files'&&[375,1440].includes(width)) {
          const shot=await send('Page.captureScreenshot',{format:'png'});const {writeFile}=await import('node:fs/promises');await writeFile(`/tmp/tf-cloud-browser-${width}.png`,Buffer.from(shot.data,'base64'));
        }
      }
      await evaluate('window.closeCloud()');await delay(500);
    }
  }
  assert.deepEqual(runtimeErrors,[]);
  console.log('云盘设置、文件列表、回收站、子目录：6种视口及明暗主题均无横向溢出，底部按钮同排且凭据不回显。');

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
