#!/usr/bin/env node
// 使用真实组件和浏览器测量 CSS 尺寸；不加载业务页面或访问云端接口。
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { createServer } from 'vite'
import vue from '@vitejs/plugin-vue'
import { compileStyleAsync, compileTemplate, parse } from '@vue/compiler-sfc'

const root = resolve(import.meta.dirname, '..')
const interactionsOnly = process.argv.includes('--interactions-only')
const safeAreaOnly = process.argv.includes('--safe-area-only')
const priceHeaderOnly = process.argv.includes('--price-header-only')
const mediaOnly = process.argv.includes('--media-only')
const focusedRun = interactionsOnly || safeAreaOnly || priceHeaderOnly || mediaOnly
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
function vueFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(item => {
    const path = join(directory, item.name)
    return item.isDirectory() ? vueFiles(path) : path.endsWith('.vue') ? [path] : []
  })
}
const shellSources = vueFiles(join(root, 'src')).map(file => file.slice(join(root, 'src').length + 1))
const shellCases = []
function scanDialogs(directory) {
  for (const item of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, item.name)
    if (item.isDirectory()) { scanDialogs(path); continue }
    if (!path.endsWith('.vue') || path.endsWith('/MobileDialog.vue')) continue
    const { descriptor } = parse(readFileSync(path, 'utf8'), { filename: path })
    function visit(node) {
      if (node.type === 1 && node.tag === 'MobileDialog') {
        const attr = name => node.props.find(prop => prop.type === 6 && prop.name === name)?.value?.content
        const dialogClass = attr('dialog-class') || ''
        if (dialogClass) shellCases.push({ dialogClass, ...(attr('width') ? { width: attr('width') } : {}), ...(attr('max-width') ? { maxWidth: attr('max-width') } : {}) })
      }
      for (const child of node.children || []) visit(child)
    }
    if (descriptor.template) visit(descriptor.template.ast)
  }
}
scanDialogs(join(root, 'src'))
// 使用销售/批发页实际的保存弹窗模板，隔离业务请求和真实个人资料。
const quoteSaveModules = new Map()
const quoteHeaderModules = new Map()
for (const [kind, file] of [['wholesale', 'PublicPriceQuery.vue'], ['sales', 'SalesPriceDisplay.vue']]) {
  const filename = join(root, 'src/views/price-list/page', file)
  const { descriptor } = parse(readFileSync(filename, 'utf8'), { filename })
  const header = descriptor.template.ast.children.find(node => node.type === 1)?.children.find(node => node.type === 1 && node.tag === 'PublicPriceHeader')
  assert.ok(header, `${file} 缺少公共报价页头`)
  const headerTemplate = compileTemplate({ source: header.loc.source, filename, id: `quote-header-${kind}` })
  assert.deepEqual(headerTemplate.errors, [], `${file} 页头编译失败`)
  quoteHeaderModules.set(`\0quote-header-${kind}`, `${headerTemplate.code}
import { reactive, computed } from 'vue';
import { useMobile } from '/src/composables/mobile.ts';
export default { render, setup() {
  const { isMobile } = useMobile();
  const fixture = reactive({ passwordVerified:false, verifiedUserName:'测试用户', searchKeyword:'',
    siteSettingsStore:{settings:{siteName:'测试报价'}}, loading:false, searchSubmitting:false,
    isGenerating:false, usedModelsLoading:false, showInStockOnly:false, showUsedPhonesOnly:false,
    allResults:[{}], displayedRows:[{}], searchResults:[{}], showNoticeDialog:false,
    handleSearchInput(){}, handleSearch(){}, handleClear(){}, downloadAsImage(){},
    toggleInStockFilter(){ fixture.showInStockOnly = !fixture.showInStockOnly; },
    toggleUsedPhonesFilter(){ fixture.showUsedPhonesOnly = !fixture.showUsedPhonesOnly; }
  });
  window.updatePriceHeader = values => Object.assign(fixture, values);
  return { ...Object.fromEntries(Object.keys(fixture).map(key => [key, computed({get:()=>fixture[key],set:value=>fixture[key]=value})])), isMobile };
} };`)
  const dialog = descriptor.template.ast.children.find(node => node.type === 1)?.children.find(node =>
    node.type === 1 && node.tag === 'MobileDialog' && node.props.some(prop => prop.type === 6 && prop.name === 'dialog-class' && prop.value?.content === 'ios-image-dialog'))
  assert.ok(dialog, `${file} 缺少公共图片保存弹窗`)
  const template = compileTemplate({ source: dialog.loc.source, filename, id: `quote-save-${kind}` })
  assert.deepEqual(template.errors, [], `${file} 保存弹窗编译失败`)
  quoteSaveModules.set(`\0quote-save-${kind}`, `${template.code}
import { ref } from 'vue';
export default { render, setup() {
  const showIOSImageModal = ref(true);
  return { showIOSImageModal, iosImageUrl: 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="300" height="1200"><rect width="300" height="1200" fill="white"/></svg>'),
    siteSettingsStore: { settings: { siteName: '测试报价' } }, isSharingImage: false,
    toggleIOSImageMode() {}, shareIOSImage() {}, closeIOSImageModal() { showIOSImageModal.value = false; } };
} };`)
}
const styleImports = []
for (const [fileIndex, file] of (priceHeaderOnly ? [] : shellSources).entries()) {
  const path = join(root, 'src', file)
  const { descriptor } = parse(readFileSync(path, 'utf8'), { filename: path })
  for (const [index, style] of descriptor.styles.entries()) {
    // Compile actual inline/external SFC styles, including :global/:deep and SCSS.
    const filename = style.src ? resolve(path, '..', style.src) : path
    const result = await compileStyleAsync({
      source: style.src ? readFileSync(filename, 'utf8') : style.content,
      filename, id: `data-v-shell-${fileIndex}-${index}`, scoped: style.scoped,
      preprocessLang: style.lang
    })
    assert.deepEqual(result.errors, [], `业务样式编译失败：${filename}`)
    styleImports.push(result.code)
  }
}
const entry = `
import { createApp, h, reactive, nextTick } from 'vue';
import { createPinia } from 'pinia';
import { ElDialog, ElButton, ElMessageBox, ElIcon, ElInput } from 'element-plus';
import { WarningFilled, Grid, Box, Download } from '@element-plus/icons-vue';
import PublicPriceHeader from '/src/components/base/PublicPriceHeader.vue';
import PublicSearchBox from '/src/components/search/PublicSearchBox.vue';
import WholesaleHeader from '/__quote-header-wholesale.js';
import SalesHeader from '/__quote-header-sales.js';
import MobileDialog from '/src/components/MobileDialog.vue';
import MediaPreviewViewer from '/src/components/MediaPreviewViewer.vue';
import QueryDetailContent from '/src/components/query/QueryDetailContent.vue';
import WholesaleSaveDialog from '/__quote-save-wholesale.js';
import SalesSaveDialog from '/__quote-save-sales.js';
import 'element-plus/dist/index.css';
import '/src/styles.scss';
import '/src/styles/components/_dialog.scss';
import '/src/styles/components/_dialog-actions.scss';
import '/__dialog-business-styles.js';
let app, state, stackState, mediaState, videoUrl;
const mediaItems = [[160,320],[320,160]].map(([width,height],index) => ({
  url:'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="'+width+'" height="'+height+'"><rect width="100%" height="100%" fill="'+(index?'purple':'orange')+'"/></svg>'),
  label:'测试长文件名'.repeat(20) + index
}));
window.renderMedia = async (options = {}) => {
  ElMessageBox.close(); app?.unmount(); await nextTick();
  mediaState = reactive({ modelValue:true, items:mediaItems, deletable:true, downloadable:true, ...options });
  app = createApp({render:() => h(MediaPreviewViewer, {...mediaState, 'onUpdate:modelValue':value => {mediaState.modelValue=value;}})});
  app.component('ElButton',ElButton); app.mount('#app'); await nextTick();
  await Promise.all([...document.querySelectorAll('.media-preview-content')].filter(item=>item.tagName==='IMG').map(image=>image.decode()));
};
window.renderVideoMedia = async () => {
  if (!videoUrl) {
    const canvas=document.createElement('canvas'); canvas.width=320; canvas.height=180;
    const context=canvas.getContext('2d'); context.fillStyle='orange'; context.fillRect(0,0,320,180);
    const stream=canvas.captureStream(0), recorder=new MediaRecorder(stream), chunks=[];
    const recorded=new Promise((resolve,reject)=>{
      recorder.ondataavailable=event=>chunks.push(event.data);
      recorder.onstop=()=>resolve(new Blob(chunks,{type:recorder.mimeType}));
      recorder.onerror=reject;
    });
    recorder.start();
    for(let frame=0;frame<10;frame++) {
      context.fillStyle=frame%2?'orange':'purple'; context.fillRect(0,0,320,180);
      stream.getVideoTracks()[0].requestFrame();
      await new Promise(resolve=>setTimeout(resolve,70));
    }
    recorder.stop();
    try { videoUrl=URL.createObjectURL(await recorded); } finally { stream.getTracks().forEach(track=>track.stop()); }
  }
  await window.renderMedia({items:[{url:videoUrl,type:'video',label:'本地生成的测试视频'},mediaItems[1]],autoPlayVideos:false});
  const video=document.querySelector('video');
  await new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(new Error('合成视频未加载')),5000);
    const ready=()=>{clearTimeout(timer);resolve();};
    video.addEventListener('loadedmetadata',ready,{once:true});
    video.addEventListener('error',()=>{clearTimeout(timer);reject(new Error('合成视频解码失败：'+video.error?.message));},{once:true});
    if(video.readyState>=1) ready();
  });
  await video.play(); video.pause();
};
window.mediaMetrics = () => {
  const box = element => { const r=element.getBoundingClientRect(); return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height}; };
  const close=document.querySelector('.media-preview-close'), stage=document.querySelector('.media-preview-stage'), content=document.querySelector('.media-preview-content');
  const closeBox=box(close);
  return {open:mediaState.modelValue, stage:box(stage), content:box(content), close:closeBox,
    closeOnTop:close.contains(document.elementFromPoint(closeBox.left+closeBox.width/2,closeBox.top+closeBox.height/2)),
    controls:[...document.querySelectorAll('.media-preview-toolbar button')].filter(button=>button.getClientRects().length>0).map(box),
    zoomButtons:[...document.querySelectorAll('.media-preview-zoom-actions button')].filter(button=>button.getClientRects().length>0).length,
    arrows:[...document.querySelectorAll('.media-preview-nav')].filter(element=>element.getClientRects().length>0).length,
    pageWidth:document.documentElement.scrollWidth, source:content.getAttribute('src'),
    fit:getComputedStyle(content).objectFit};
};
window.renderPriceHeader = async kind => {
  app?.unmount();
  app = createApp(kind === 'sales' ? SalesHeader : WholesaleHeader);
  app.use(createPinia());
  for (const [name, component] of Object.entries({PublicPriceHeader,PublicSearchBox,ElButton,ElIcon,ElInput,WarningFilled,Grid,Box,Download})) app.component(name,component);
  app.mount('#app'); await nextTick();
};
window.priceHeaderMetrics = () => {
  const group = document.querySelector('.price-header-actions'), background = document.querySelector('.notice-section');
  const box = element => { const r = element.getBoundingClientRect(); return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height}; };
  return { group:box(group), background:box(background), pageWidth:document.documentElement.scrollWidth,
    buttons:[...group.querySelectorAll('.el-button')].map(button => {
      const text = button.querySelector('.btn-text') || button.querySelector('.btn-content'), icon = button.querySelector('.btn-icon') || button.querySelector('.is-loading');
      const range = document.createRange(); range.selectNodeContents(text);
      const textBox = box(range), iconBox = icon ? box(icon) : null, css = getComputedStyle(button);
      return {box:box(button),text:textBox,label:text.textContent.trim(),icon:iconBox,padding:parseFloat(css.paddingLeft),
        clipped:[text, ...button.querySelectorAll('span')].some(element => element.scrollWidth > element.clientWidth + 1),
        iconVisible:iconBox && iconBox.width > 0 && iconBox.height > 0};
    }) };
};
window.renderQuoteSave = async kind => {
  app?.unmount();
  app = createApp(kind === 'sales' ? SalesSaveDialog : WholesaleSaveDialog);
  app.use(createPinia()); app.component('MobileDialog', MobileDialog); app.component('ElDialog', ElDialog); app.component('ElButton', ElButton);
  app.mount('#app'); await nextTick();
  await Promise.all([...document.querySelectorAll('.ios-save-image')].map(image => image.decode()));
};
window.safeAreaMetrics = () => {
  const panel = document.querySelector('.el-dialog');
  const footer = panel.querySelector('.el-dialog__footer'), actions = footer.querySelector('.tf-dialog-actions');
  const css = getComputedStyle(footer), box = element => { const r = element.getBoundingClientRect(); return { top:r.top, bottom:r.bottom, left:r.left, right:r.right, height:r.height }; };
  return { panel: box(panel), footer: box(footer), actions: box(actions),
    paddingTop: parseFloat(css.paddingTop), paddingBottom: parseFloat(css.paddingBottom),
    buttons: [...footer.querySelectorAll('.el-button')].map(box),
    bodyScrollHeight: panel.querySelector('.el-dialog__body').scrollHeight, bodyClientHeight: panel.querySelector('.el-dialog__body').clientHeight };
};
window.renderStack = async () => {
  ElMessageBox.close(); app?.unmount();
  await nextTick();
  for (let frame = 0; frame < 3; frame++) await new Promise(requestAnimationFrame);
  await Promise.all(document.getAnimations().filter(animation => animation.effect?.getComputedTiming().iterations !== Infinity).map(animation => animation.finished.catch(() => {})));
  stackState = reactive({ first: true, second: false, media: false });
  const dialog = key => h(MobileDialog, {
    modelValue: stackState[key], title: key, dialogClass: 'stack-' + key,
    'onUpdate:modelValue': value => { stackState[key] = value; }
  }, { default: () => h('input', { 'aria-label': key + ' input' }) });
  app = createApp({ render: () => h('div', [dialog('first'), dialog('second'), h(MediaPreviewViewer, {
    modelValue: stackState.media, items: [{ url: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==' }],
    'onUpdate:modelValue': value => { stackState.media = value; }
  })]) });
  app.use(createPinia()); app.component('ElDialog', ElDialog); app.component('ElButton', ElButton);
  app.mount('#app'); await nextTick();
};
window.updateStack = async values => { Object.assign(stackState, values); await nextTick(); };
window.stackMetrics = () => ({ ...stackState,
  locked: document.body.style.overflow === 'hidden',
  focus: document.activeElement?.closest('[role="dialog"]')?.getAttribute('aria-label'),
  restored: document.activeElement?.getAttribute('aria-label') === 'first input',
  visibleMessages: [...document.querySelectorAll('.el-message-box')].filter(element => element.getClientRects().length > 0).length,
  messageHasFocus: Boolean(document.activeElement?.closest('.el-message-box'))
});
window.openStackConfirm = () => { ElMessageBox.confirm('确认删除', '嵌套确认').catch(() => {}); };
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
  app = createApp({ render: () => h(MobileDialog, { ...state, 'onUpdate:modelValue': value => { state.modelValue = value; } }, { default: () => h('div', { style: { width: '100%', minHeight: '180px' } }, '弹窗宽度回归') }) });
  app.use(createPinia()); app.component('ElDialog', ElDialog); app.component('ElButton', ElButton);
  app.mount('#app'); await nextTick(); state.modelValue = true; await nextTick();
};
window.updateDialog = async props => { Object.assign(state, props); await nextTick(); };
window.dialogVisibility = () => ({
  open: state.modelValue,
  panels: [...document.querySelectorAll('.el-dialog')].filter(panel => panel.getClientRects().length > 0).length,
  overlays: [...document.querySelectorAll('.mobile-dialog-overlay')].filter(overlay => overlay.getClientRects().length > 0).length
});
window.dialogMetrics = () => {
  const panel = document.querySelector('.el-dialog, .el-message-box');
  const rect = panel.getBoundingClientRect();
  return { width: rect.width, left: rect.left, right: rect.right, sheet: panel.classList.contains('mobile-dialog-sheet-panel') };
};
window.shellMetrics = () => {
  const panel = document.querySelector('.el-dialog');
  const header = panel.querySelector('.el-dialog__header'), close = panel.querySelector('.el-dialog__headerbtn');
  const body = panel.querySelector('.el-dialog__body'), footer = panel.querySelector('.el-dialog__footer');
  const box = element => { const css = getComputedStyle(element), rect = element.getBoundingClientRect();
    return { width: rect.width, height: rect.height, top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right,
      padding: css.padding, radius: css.borderRadius, background: css.backgroundImage,
      font: css.fontSize, overflow: css.overflowY, scrollHeight: element.scrollHeight, clientHeight: element.clientHeight }; };
  return { panel: box(panel), header: box(header), close: box(close), body: box(body), footer: box(footer) };
};
`
const html = '<html><head><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body><div id="app"></div><script type="module" src="/__dialog-width.js"></script></body></html>'

function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++requestId
    const timeout = setTimeout(() => { pending.delete(id); reject(new Error(`CDP 超时：${method} ${params.expression?.slice(0, 120) || ''}`)) }, 30000)
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
    await Promise.all(document.getAnimations().filter(animation => animation.effect?.getComputedTiming().iterations !== Infinity).map(animation => animation.finished.catch(() => {})));
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
    // 与实际入口及公共 FocusTrap 一起预构建，保证嵌套弹层共享同一焦点栈。
    optimizeDeps: { include: ['element-plus', 'element-plus/es/components/focus-trap/index'] },
    plugins: [vue(), {
      name: 'dialog-width-regression',
      resolveId(id) {
        if (/^\/__quote-header-(wholesale|sales)\.js$/.test(id)) return `\0quote-header-${id.includes('wholesale') ? 'wholesale' : 'sales'}`
        if (/^\/__quote-save-(wholesale|sales)\.js$/.test(id)) return `\0quote-save-${id.includes('wholesale') ? 'wholesale' : 'sales'}`
        if (id === '\0dialog-field-permissions') return id
        if (id === '/__dialog-width.js') return '\0dialog-width-entry'
        if (id === '/__dialog-business-styles.js') return '\0dialog-business-styles'
      },
      load(id) {
        if (quoteHeaderModules.has(id)) return quoteHeaderModules.get(id)
        if (quoteSaveModules.has(id)) return quoteSaveModules.get(id)
        if (id === '\0dialog-width-entry') return entry
        if (id === '\0dialog-business-styles') return `const style = document.createElement('style'); style.textContent = ${JSON.stringify(styleImports.join('\n'))}; document.head.append(style);`
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
    server: { host: '127.0.0.1', port: 0, hmr: false }
  })
  await server.listen()
  const port = server.httpServer.address().port
  browser = spawn(chrome, ['--headless=new', '--no-first-run', '--no-default-browser-check', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
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
  await send('Page.bringToFront')
  await send('Page.navigate', { url: `http://127.0.0.1:${port}/__dialog-width` })
  let ready = false
  for (let i = 0; i < 300; i++) { if (runtimeErrors.length) break; if (await evaluate('typeof window.renderDialog === "function"')) { ready = true; break } await delay(100) }
  assert.ok(ready, `组件未加载：${runtimeErrors.join('; ')}`)

  if (mediaOnly || !focusedRun) {
    let mediaChecks=0
    for (const [width,height,mobile] of [[320,740,true],[375,812,true],[430,932,true],[667,375,true],[844,390,true],[768,1024,false],[1440,900,false]]) {
      await send('Emulation.setDeviceMetricsOverride',{ width,height,screenWidth:width,screenHeight:height,deviceScaleFactor:1,mobile })
      await send('Emulation.setTouchEmulationEnabled',{ enabled:mobile })
      const fullscreen=width<=767 || mobile
      for (const theme of ['light','dark']) {
        await evaluate(`document.documentElement.dataset.theme='${theme}'`)
        for (const insets of [{ top:0,bottom:0,left:0,right:0 },width>height?{ top:0,bottom:21,left:44,right:44 }:{ top:47,bottom:34,left:0,right:0 }]) {
          await send('Emulation.setSafeAreaInsetsOverride',{ insets })
          for (const initialIndex of [0,1]) {
            await evaluate(`window.renderMedia({initialIndex:${initialIndex}})`); await delay(220)
            const metrics=await evaluate('window.mediaMetrics()')
            const label=`${width}x${height}/${theme}/${JSON.stringify(insets)}/${initialIndex}`
            assert.equal(metrics.arrows,fullscreen?0:2,`${label}/手机无左右按钮，桌面保留切换`)
            assert.equal(metrics.zoomButtons,fullscreen?0:3,`${label}/手机使用手势缩放，顶部不保留缩放按钮`)
            if (fullscreen) {
              assert.deepEqual(metrics.stage,{ left:0,right:width,top:0,bottom:height,width,height },`${label}/舞台铺满可视区域`)
              assert.equal(metrics.content.width,width,`${label}/图片铺满可用宽度`)
              assert.equal(metrics.content.height,height,`${label}/图片铺满可用高度`)
              assert.equal(metrics.fit,'contain',`${label}/保持比例完整展示`)
            }
            assert.ok(metrics.closeOnTop,`${label}/关闭按钮可点击`)
            assert.ok(metrics.pageWidth<=width,`${label}/无页面横溢`)
            for (const control of metrics.controls) {
              assert.ok(control.left>=insets.left && control.right<=width-insets.right,`${label}/工具横向避开安全区`)
              assert.ok(control.top>=insets.top && control.bottom<=height-insets.bottom,`${label}/工具纵向避开安全区`)
            }
            // 放大后的图片仍在工具栏下方；使用真实点击验证关闭及滚动解锁。
            if (mobile) {
              const y=Math.round(height*0.65), center=Math.round(width/2)
              await send('Input.dispatchTouchEvent',{ type:'touchStart',touchPoints:[{ x:center-30,y },{ x:center+30,y }] })
              await send('Input.dispatchTouchEvent',{ type:'touchMove',touchPoints:[{ x:center-70,y },{ x:center+70,y }] })
              await send('Input.dispatchTouchEvent',{ type:'touchEnd',touchPoints:[] })
              assert.ok(await evaluate("!document.querySelector('img').style.transform.includes('scale(1)')"),`${label}/双指缩放有效`)
            } else {
              await evaluate("document.querySelector('.media-preview-stage').dispatchEvent(new MouseEvent('dblclick',{bubbles:true}))")
            }
            assert.ok((await evaluate('window.mediaMetrics()')).closeOnTop,`${label}/放大不遮挡关闭`)
            const { close }=await evaluate('window.mediaMetrics()')
            await send('Input.dispatchMouseEvent',{ type:'mousePressed',x:close.left+close.width/2,y:close.top+close.height/2,button:'left',clickCount:1 })
            await send('Input.dispatchMouseEvent',{ type:'mouseReleased',x:close.left+close.width/2,y:close.top+close.height/2,button:'left',clickCount:1 })
            await delay(220)
            assert.equal(await evaluate("document.querySelector('.media-preview-overlay')"),null,`${label}/实际点击关闭`)
            assert.equal(await evaluate('document.body.style.overflow'),'',`${label}/关闭解锁`)
            mediaChecks++
          }
        }
      }
      await evaluate('window.renderMedia({deletable:false,downloadable:false})'); await delay(220)
      const standard=await evaluate('window.mediaMetrics()')
      assert.equal(standard.controls.length,fullscreen?1:4,`${width}/普通预览手机只保留关闭，PC保留缩放`)
      assert.ok(standard.closeOnTop,`${width}/普通预览关闭可点击`)
      if (mobile) {
        await evaluate('window.renderMedia()'); await delay(220)
        const source=await evaluate('window.mediaMetrics().source')
        const y=Math.round(height*0.65)
        for (const [type,x] of [['touchStart',width*0.8],['touchMove',width*0.5],['touchMove',width*0.2],['touchEnd',0]]) {
          await send('Input.dispatchTouchEvent',{ type,touchPoints:type==='touchEnd'?[]:[{ x:Math.round(x),y }],modifiers:0 })
        }
        assert.notEqual(await evaluate('window.mediaMetrics().source'),source,`${width}/真实触摸滑动切换`)
        await evaluate('window.renderVideoMedia()'); await delay(220)
        const video=await evaluate('window.mediaMetrics()')
        assert.ok(video.content.bottom<=height-(width>height?21:34),`${width}/视频原生控件避开底部安全区`)
        for (const [type,x] of [['touchStart',width*0.7],['touchMove',width*0.5],['touchMove',width*0.3],['touchEnd',0]]) {
          await send('Input.dispatchTouchEvent',{ type,touchPoints:type==='touchEnd'?[]:[{ x:Math.round(x),y:Math.round(video.content.bottom-20) }],modifiers:0 })
        }
        assert.equal(await evaluate('window.mediaMetrics().source'),video.source,`${width}/拖动原生视频控件不翻页`)
        for (const [type,x] of [['touchStart',width*0.8],['touchMove',width*0.5],['touchMove',width*0.2],['touchEnd',0]]) {
          await send('Input.dispatchTouchEvent',{ type,touchPoints:type==='touchEnd'?[]:[{ x:Math.round(x),y }],modifiers:0 })
        }
        assert.notEqual(await evaluate('window.mediaMetrics().source'),video.source,`${width}/真实视频主体滑动可切换到图片`)
      }
    }
    await send('Emulation.setSafeAreaInsetsOverride',{ insets:{ top:0,bottom:0,left:0,right:0 } })
    await send('Emulation.setTouchEmulationEnabled',{ enabled:false })
    console.log(`媒体预览浏览器回归通过：${mediaChecks} 组，手机满屏/无侧栏、横竖图、长文件名、明暗主题、四边安全区、缩放后真实点击关闭及触摸滑动；桌面保留左右切换。`)
  }

  if (priceHeaderOnly || !focusedRun) {
    let headerChecks = 0
    for (const viewport of [320,360,375,390,430,667,768,1024,1440]) {
      await send('Emulation.setDeviceMetricsOverride', { width:viewport,height:900,screenWidth:viewport,screenHeight:900,deviceScaleFactor:1,mobile:viewport < 768 })
      for (const theme of ['light','dark']) {
        await evaluate(`document.documentElement.dataset.theme = '${theme}'`)
        for (const kind of ['wholesale','sales']) {
          await evaluate(`window.renderPriceHeader('${kind}')`)
          for (const values of [{ passwordVerified:false },{ passwordVerified:true },{ showInStockOnly:true },{ usedModelsLoading:true },{ usedModelsLoading:false,isGenerating:true }]) {
            await evaluate(`window.updatePriceHeader(${JSON.stringify(values)})`); await delay(50)
            const metrics = await evaluate('window.priceHeaderMetrics()')
            const label = `${viewport}/${theme}/${kind}/${JSON.stringify(values)}`
            assert.equal(metrics.buttons.length, kind === 'sales' ? 1 : values.passwordVerified === false ? 2 : 4, `${label}/按钮数`)
            assert.ok(metrics.pageWidth <= viewport, `${label}/页面不能溢出`)
            const rows = new Map()
            for (const button of metrics.buttons) {
              assert.ok(button.box.left >= metrics.background.left && button.box.right <= metrics.background.right, `${label}/按钮完整展示`)
              assert.ok(!button.clipped && button.text.left >= button.box.left + button.padding - 1 && button.text.right <= button.box.right - button.padding + 1, `${label}/文字完整展示：${JSON.stringify(button)}`)
              assert.ok(button.iconVisible, `${label}/必须保留图标或 Loading 图标`)
              assert.ok(button.text.left >= button.icon.right - 1 && button.text.left - button.icon.right <= 7, `${label}/图文间距`)
              const contentCenter = (button.icon.left + button.text.right) / 2
              assert.ok(Math.abs(contentCenter - (button.box.left + button.box.right) / 2) < 2, `${label}/图文居中`)
              const row = rows.get(button.box.top) || []; row.push(button.box); rows.set(button.box.top,row)
            }
            for (const row of rows.values()) assert.ok(Math.abs((row[0].left + row.at(-1).right) / 2 - (metrics.background.left + metrics.background.right) / 2) < 2, `${label}/按钮组居中`)
            headerChecks++
          }
        }
      }
    }
    console.log(`报价页头浏览器回归通过：${headerChecks} 组，销售/批发真实模板、验证前后、筛选/Loading、图标与文字完整、图文间距和整组居中。`)
  }

  let checks = 0
  for (const viewport of focusedRun || process.argv.includes('--actions-only') ? [] : [360, 375, 390, 430, 768, 1024, 1440, 1920]) {
    await send('Emulation.setDeviceMetricsOverride', { width: viewport, height: 900, screenWidth: viewport, screenHeight: 900, deviceScaleFactor: 1, mobile: viewport < 768 })
    const cap = viewport < 768 ? viewport - 8 : viewport <= 1024 ? viewport * 0.8 : viewport - 32
    const cases = [
      ['默认800', {}, viewport < 768 ? cap : Math.min(800, cap)],
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
      checkWidth(percent, 800, '综合查询90%素材管理受公共800上限约束', viewport)
      for (const width of ['90vw', '90dvw', 'calc(100vw - 32px)']) {
        await evaluate(`window.renderDialog(${JSON.stringify({ width })})`)
        checkWidth(await measure(), 800, `${width}自适应宽度受公共上限约束`, viewport); checks++
      }
      await evaluate('window.renderDialog({width:"90%",maxWidth:1240})')
      checkWidth(await measure(), 1240, '工作台明确声明上限允许加宽', viewport); checks++
      await evaluate('window.updateDialog({maxWidth:undefined})')
      checkWidth(await measure(), 800, '移除上限恢复公共边界', viewport); checks++
    }
  }
  if (!focusedRun && !process.argv.includes('--actions-only')) {
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
  let shellChecks = 0
  for (const viewport of focusedRun ? [] : [375, 430, 768, 1024, 1440]) {
    await send('Emulation.setDeviceMetricsOverride', { width: viewport, height: 900, screenWidth: viewport, screenHeight: 900, deviceScaleFactor: 1, mobile: viewport < 768 })
    for (const theme of ['light', 'dark']) {
      await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: theme }, { name: 'prefers-reduced-motion', value: 'reduce' }] })
      await evaluate(`document.documentElement.dataset.theme = ${JSON.stringify(theme)}`)
      await evaluate('window.renderDialog({})'); await measure()
      const baseline = await evaluate('window.shellMetrics()')
      for (const props of shellCases) {
        await evaluate(`window.renderDialog(${JSON.stringify(props)})`); await measure()
        const actual = await evaluate('window.shellMetrics()')
        const label = `${viewport}/${theme}/${props.dialogClass}`
        if (viewport < 768 && !props.width && !props.maxWidth) {
          assert.ok(Math.abs(actual.panel.width - (viewport - 8)) < 1, `${label}/手机必须使用公共左右边距，不得留下百分比宽度空白`)
          assert.ok(actual.panel.left >= -1 && actual.panel.right <= viewport + 1, `${label}/手机外壳不越出视口`)
        }
        for (const element of ['header', 'close', 'footer']) {
          for (const property of ['height', 'padding', 'radius', 'background', 'font']) assert.equal(actual[element][property], baseline[element][property], `${label}/${element}/${property}`)
        }
        assert.equal(actual.panel.radius, baseline.panel.radius, `${label}/公共圆角`)
        assert.ok(Math.abs((actual.header.right - actual.close.right) - (baseline.header.right - baseline.close.right)) < 1, `${label}/关闭右距`)
        assert.ok(Math.abs(actual.close.top - actual.header.top - (50 - actual.close.height) / 2) < 1, `${label}/关闭按钮上下居中`)
        assert.equal(actual.body.padding, props.dialogClass.includes('tf-dialog-body-flush') ? '0px' : baseline.body.padding, `${label}/公共正文间距`)
        assert.ok(actual.panel.top >= -1 && actual.panel.bottom <= 901, `${label}/纵向安全边界`)
        await evaluate('document.querySelector(\'.el-dialog__body\').firstElementChild.style.minHeight = \'1800px\''); await measure()
        const long = await evaluate('window.shellMetrics()')
        assert.ok(long.body.scrollHeight > long.body.clientHeight && ['auto', 'scroll'].includes(long.body.overflow), `${label}/长内容可滚动`)
        assert.ok(long.panel.top >= -1 && long.panel.bottom <= 901, `${label}/长内容不越界`)
        shellChecks++
      }
    }
  }
  if (shellChecks) console.log(`业务弹窗外壳浏览器回归通过：${shellChecks} 组；加载 ${shellSources.length} 个真实 SFC 的样式，按源码中的业务 class/width 检查标题、关闭、正文/footer、边界及长内容滚动。此检查不替代业务整页或真机验收。`)
  let actionChecks = 0
  for (const viewport of focusedRun ? [] : [360, 375, 390, 430, 767, 768, 1024, 1440]) {
    await send('Emulation.setDeviceMetricsOverride', { width: viewport, height: 900, screenWidth: viewport, screenHeight: 900, deviceScaleFactor: 1, mobile: viewport < 768 })
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
  if (actionChecks) console.log(`弹窗按钮浏览器回归通过：${actionChecks} 组，真实综合查询组件、默认/自定义/原生 footer、确认框和正文工具栏，1～4 个按钮、等宽/150px上限/居中、尺寸别名和明暗主题。`)
  if (!interactionsOnly && !priceHeaderOnly && !mediaOnly) {
    let safeAreaChecks = 0
    for (const [width, height] of [[375, 812], [430, 932], [667, 375], [812, 375], [768, 1024]]) {
      await send('Emulation.setDeviceMetricsOverride', { width, height, screenWidth: width, screenHeight: height, deviceScaleFactor: 1, mobile: width < 768 })
      for (const theme of ['light', 'dark']) {
        await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] })
        await evaluate(`document.documentElement.dataset.theme = ${JSON.stringify(theme)}`)
        const baseline = new Map()
        for (const [mode, insets] of [
          ['browser', { top: 0, bottom: 0, left: 0, right: 0 }],
          ['standalone', width > height ? { top: 0, bottom: 21, left: 44, right: 44 } : { top: 47, bottom: 34, left: 0, right: 0 }]
        ]) {
          await send('Emulation.setSafeAreaInsetsOverride', { insets })
          await evaluate(`document.documentElement.classList.toggle('device-standalone', ${mode === 'standalone'})`)
          let previous
          for (const kind of ['wholesale', 'sales']) {
            await evaluate(`window.renderQuoteSave(${JSON.stringify(kind)})`); await measure()
            const actual = await evaluate('window.safeAreaMetrics()')
            const label = `${width}x${height}/${theme}/${mode}/${kind}`
            assert.equal(actual.paddingTop, width <= 479 ? 10 : width <= 767 ? 12 : 16, `${label}/公共上间距`)
            assert.equal(actual.paddingBottom, width <= 479 ? 10 : width <= 767 ? 12 : 20, `${label}/安全区不得叠加到悬浮 footer 内`)
            assert.equal(actual.buttons.length, 3, `${label}/三个保存操作`)
            for (const button of actual.buttons) {
              assert.ok(button.top >= insets.top && button.bottom <= height - insets.bottom, `${label}/按钮避开安全区`)
              assert.ok(button.left >= insets.left && button.right <= width - insets.right, `${label}/横屏左右安全区`)
            }
            assert.ok(actual.panel.top >= insets.top - 1 && actual.panel.bottom <= height - insets.bottom + 1, `${label}/外壳避开上下安全区`)
            assert.ok(actual.panel.left >= insets.left - 1 && actual.panel.right <= width - insets.right + 1, `${label}/外壳避开左右安全区`)
            assert.ok(actual.bodyScrollHeight > actual.bodyClientHeight, `${label}/长图正文可滚动`)
            const layout = { top: actual.paddingTop, bottom: actual.paddingBottom, height: actual.footer.height, buttons: actual.buttons.map(button => button.height) }
            if (mode === 'browser') baseline.set(kind, layout)
            else assert.deepEqual(layout, baseline.get(kind), `${label}/书签与浏览器 footer 一致`)
            if (previous) assert.deepEqual(layout, previous, `${label}/销售与批发一致`)
            previous = layout
            safeAreaChecks++
          }
          await evaluate("window.renderDialog({dialogClass:'tf-dialog-workspace crud-dialog-lg tf-dialog-body-flush'})"); await measure()
          const workspace = await evaluate('window.shellMetrics()')
          assert.ok(workspace.panel.top >= insets.top - 1 && workspace.panel.bottom <= height - insets.bottom + 1, `${width}/${mode}/工作台按安全区收缩`)
          assert.ok(workspace.footer.bottom <= height - insets.bottom + 1, `${width}/${mode}/工作台操作区可见`)
        }
      }
    }
    await send('Emulation.setSafeAreaInsetsOverride', { insets: { top: 0, bottom: 0, left: 0, right: 0 } })
    await evaluate("document.documentElement.classList.remove('device-standalone')")
    console.log(`报价保存安全区浏览器回归通过：${safeAreaChecks} 组，销售/批发真实模板、普通浏览器/主屏幕安全区、明暗主题、竖屏/横屏；不替代 iOS 真机验收。`)
  }
  if (!safeAreaOnly && !priceHeaderOnly && !mediaOnly) {
    for (const viewport of [1440, 1024, 768, 375]) {
      await send('Emulation.setDeviceMetricsOverride', { width: viewport, height: 900, screenWidth: viewport, screenHeight: 900, deviceScaleFactor: 1, mobile: false })
      for (const modal of [true, false]) {
        await evaluate(`window.renderDialog({modal:${modal},showDefaultFooter:false})`); await delay(400)
        assert.equal((await evaluate('window.dialogVisibility()')).panels, 1, `${viewport}/${modal}/打开只显示一个弹窗`)
        await evaluate("document.querySelector('.el-dialog__headerbtn').click()")
        await delay(400)
        assert.deepEqual(await evaluate('window.dialogVisibility()'), { open: false, panels: 0, overlays: 0 }, `${viewport}/${modal}/关闭后不得残留或重现`)
        await evaluate('window.updateDialog({modelValue:true})'); await delay(400)
        assert.equal((await evaluate('window.dialogVisibility()')).panels, 1, `${viewport}/${modal}/仍可主动重新打开`)
        await evaluate('window.updateDialog({modelValue:false})'); await delay(400)
        assert.deepEqual(await evaluate('window.dialogVisibility()'), { open: false, panels: 0, overlays: 0 }, `${viewport}/${modal}/业务关闭后不得残留`)
      }
    }
  }
  const press = async (key, code, virtualKey, shift = false) => {
    await send('Input.dispatchKeyEvent', { type: 'keyDown', key, code, windowsVirtualKeyCode: virtualKey, nativeVirtualKeyCode: virtualKey, modifiers: shift ? 8 : 0 })
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode: virtualKey, nativeVirtualKeyCode: virtualKey, modifiers: shift ? 8 : 0 })
    await evaluate('(async () => { for (let frame = 0; frame < 3; frame++) await new Promise(requestAnimationFrame); await Promise.all(document.getAnimations().filter(animation => animation.effect?.getComputedTiming().iterations !== Infinity).map(animation => animation.finished.catch(() => {}))); })()')
  }
  const waitFor = async (expression, label) => {
    for (let attempt = 0; attempt < 100; attempt++) {
      if (await evaluate(expression)) return
      await delay(100)
    }
    assert.fail(`${label}：${JSON.stringify(await evaluate('window.stackMetrics()'))}`)
  }
  for (const viewport of safeAreaOnly || priceHeaderOnly || mediaOnly ? [] : [768, 375, 1440]) {
    await send('Emulation.setDeviceMetricsOverride', { width: viewport, height: 900, screenWidth: viewport, screenHeight: 900, deviceScaleFactor: 1, mobile: viewport < 768 })
    await evaluate('window.renderStack()'); await delay(400)
    await evaluate('document.querySelector(\'.stack-first input\').focus()')
    await evaluate('window.updateStack({second:true})'); await delay(400)
    await evaluate('[...document.querySelectorAll(\'.stack-second button\')].at(-1).focus()')
    await press('Tab', 'Tab', 9)
    assert.equal((await evaluate('window.stackMetrics()')).focus, 'second', `${viewport}/Tab 焦点环绕`)
    await press('Tab', 'Tab', 9, true)
    assert.equal((await evaluate('window.stackMetrics()')).focus, 'second', `${viewport}/Shift+Tab 焦点环绕`)
    await evaluate('window.updateStack({media:true})'); await delay(400)
    await press('Escape', 'Escape', 27)
    let metrics = await evaluate('window.stackMetrics()')
    assert.ok(!metrics.media && metrics.second && metrics.first && metrics.locked, `${viewport}/Escape 只关闭媒体层`)
    await evaluate('window.openStackConfirm()'); await delay(400)
    await waitFor('window.stackMetrics().visibleMessages === 1', `${viewport}/确认框打开`)
    await waitFor('window.stackMetrics().messageHasFocus', `${viewport}/确认框获得焦点`)
    await press('Escape', 'Escape', 27)
    await waitFor('window.stackMetrics().visibleMessages === 0', `${viewport}/确认框关闭`)
    metrics = await evaluate('window.stackMetrics()')
    assert.ok(metrics.second && metrics.first && metrics.locked, `${viewport}/确认框不穿透关闭底层`)
    await press('Escape', 'Escape', 27)
    await waitFor('!window.stackMetrics().second', `${viewport}/次层 Escape 关闭`)
    metrics = await evaluate('window.stackMetrics()')
    assert.ok(!metrics.second && metrics.first && metrics.locked && metrics.restored, `${viewport}/关闭次层后保留滚动锁并恢复焦点：${JSON.stringify(metrics)}`)
    await evaluate('window.updateStack({first:false})'); await delay(400)
    assert.equal((await evaluate('window.stackMetrics()')).locked, false, `${viewport}/最终关闭恢复滚动`)
  }
  if (!safeAreaOnly && !priceHeaderOnly && !mediaOnly) {
    console.log('弹窗关闭浏览器回归通过：375/768/1024/1440px，有/无遮罩，标题关闭、主动重开、业务关闭后均无可见残留。')
    console.log('嵌套弹窗浏览器回归通过：375/768/1440px，Tab/Shift+Tab、媒体和确认框 Escape、焦点恢复及最终滚动解锁。')
  }
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
