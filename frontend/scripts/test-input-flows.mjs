#!/usr/bin/env node
// 隔离真实 H5 视图、公共金额和薪资弹窗；仅使用内存响应，不连接业务接口。
import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { createRequire } from 'node:module'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { createServer as createPortReservation } from 'node:net'
import { createServer } from 'vite'
import vue from '@vitejs/plugin-vue'
import { createQuoteFixtureModules } from './lib/quote-browser-fixtures.mjs'
import { overlayEntry } from './lib/overlay-browser-fixture.mjs'
import { deviceInputEntry } from './lib/device-input-browser-fixture.mjs'
import { salaryGoodsEntry } from './lib/salary-goods-browser-fixture.mjs'

const root = resolve(import.meta.dirname, '..')
const requireBackend = createRequire(resolve(root, '../backend/package.json'))
const { default: puppeteer } = requireBackend('puppeteer')
const exec = promisify(execFile)
const temporary = await mkdtemp(join(tmpdir(), 'tf-input-flows-'))
const ios = process.argv.includes('--ios')
const loadingOnly = process.argv.includes('--loading-only')
const overlays = process.argv.includes('--overlays') || loadingOnly
const deviceInputs = process.argv.includes('--device-inputs')
const salaryGoods = process.argv.includes('--salary-goods')
const { quoteSaveModules, quoteHeaderModules } = createQuoteFixtureModules(root)
let server, browser, bootedDevice, iosResult
const entry = `
import { createApp, h, ref, nextTick } from 'vue';
import { createRouter, createMemoryHistory, RouterView } from 'vue-router';
import { createPinia } from 'pinia';
import { ElButton, ElCheckbox, ElForm, ElFormItem, ElInput, ElTable, ElTableColumn, ElTag } from 'element-plus';
import Login from '/src/views/H5-mobile/page/LoginView.vue';
import Register from '/src/views/H5-mobile/page/RegisterView.vue';
import Query from '/src/views/H5-mobile/page/OrderQuery.vue';
import AmountInput from '/src/components/AmountInput.vue';
import SalaryPersonal from '/src/views/salary/page/SalarySalesDetailDialog.vue';
import SalaryEmployee from '/src/views/salary/page/SalaryEmployeeSalesDetailDialog.vue';
import { normalizeSafariPhoneViewportMeta, applyDeviceRootClass } from '/src/utils/device-detection.ts';
import 'element-plus/dist/index.css';
import '/src/styles.scss';
import '/src/styles/responsive.scss';
import '/src/styles/components/_dialog.scss';
import '/src/styles/components/_dialog-actions.scss';
normalizeSafariPhoneViewportMeta(); applyDeviceRootClass();
window.fixtureCalls = [];
const view = ref('route'), amount = ref(225), open = ref(false), mode = ref('personal');
const router = createRouter({ history: createMemoryHistory(), routes: [
  {path:'/login',component:Login}, {path:'/register',component:Register}, {path:'/query',component:Query},
  {path:'/m/my',component:{render:()=>h('p','已登录')}}, {path:'/m',component:Login}
] });
const row = {model_name:'很长的型号',model:'很长的型号',color_name:'蓝色',color:'蓝色',imei:'123456789012345',customer_name:"阿不都·O'Connor",sale_price:225.02,profit:-10,sale_time:'2026-11-13 10:00:00'};
const app = createApp({render:()=> view.value === 'route' ? h(RouterView) : view.value === 'amount'
  ? h(AmountInput,{modelValue:amount.value,'onUpdate:modelValue':v=>amount.value=v})
  : h(mode.value === 'personal' ? SalaryPersonal : SalaryEmployee, {
    modelValue:open.value,'onUpdate:modelValue':v=>open.value=v, canViewField:()=>true,
    details:[row],record:{paid_at:'2026-11-13',sales_count:1,commission_amount:10},employee:{name:'测试员工'},salaryMonth:'2026-11',
    summary:{total_count:1,total_profit:-10,total_sales:225.02},summaryTotalPrice:225.02,loading:false,
    tableWidth:900,dialogWidth:'800px',modelColumnWidth:160,imeiColumnWidth:160,customerColumnWidth:140,
    formatAmount:v=>String(v??0),formatSaleTime:v=>v||'-',formatPayoutTime:v=>v||'-',getSalesCount:()=>1
  }) });
app.use(createPinia()); app.use(router);
for (const component of [ElButton,ElCheckbox,ElForm,ElFormItem,ElInput,ElTable,ElTableColumn,ElTag]) app.component(component.name,component);
app.component('DataEmptyState',{render:()=>h('p','暂无数据')});
app.config.globalProperties.$getNumberColumnWidth=()=>60;
app.mount('#app');
const wait=()=>new Promise(resolve=>setTimeout(resolve,180));
const check=(ok,message)=>{if(!ok)throw new Error(message)};
const setInput=(input,value)=>{input.value=value;input.dispatchEvent(new Event('input',{bubbles:true}))};
const fill=async values=>{const inputs=[...document.querySelectorAll('input:not([type=checkbox])')];values.forEach((v,i)=>setInput(inputs[i],v));await nextTick()};
const click=async()=>{document.querySelector('.el-button').click();await wait()};
const layout=()=>{
  const card=document.querySelector('.auth-card');
  check(document.documentElement.scrollWidth<=document.documentElement.clientWidth+1,'页面横向溢出 '+JSON.stringify({width:innerWidth,client:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth,viewport:visualViewport?.width,scale:visualViewport?.scale,screen:screen.width}));
  if(card){const rect=card.getBoundingClientRect();check(rect.left>=0&&rect.right<=innerWidth+1,'认证卡片超出视口')}
};
window.runInputSmoke=async()=>{
  const results=[];
  for(const theme of ['light','dark']){
    document.documentElement.dataset.theme=theme;
    view.value='route';await router.push('/login');await wait();
    await fill(['138a00138000','  A<&123  ']);await click();
    check(!window.fixtureCalls.some(c=>c.kind==='login'),'非法登录发出请求');
    check(document.body.textContent.includes('请输入正确的手机号'),'登录错误不可见');layout();
    await fill(['+86 138-0013-8000','  A<&123  ']);await click();
    check(window.fixtureCalls.some(c=>c.kind==='login'&&c.value.phone==='13800138000'&&c.value.password==='  A<&123  '),'合法登录/原密码回退');
    await router.push('/register');await wait();await fill(['张三','13800138000','Abc123','Abc124']);await click();
    check(!window.fixtureCalls.some(c=>c.kind==='register'),'未同意或密码不一致仍注册');
    check(document.body.textContent.includes('两次输入的密码不一致'),'确认密码错误不可见');
    check(document.body.textContent.includes('请阅读并同意用户协议和隐私政策'),'协议错误不可见');layout();
    await fill(['张三','13800138000','Abc123','Abc123']);document.querySelector('input[type=checkbox]').click();await click();
    check(window.fixtureCalls.some(c=>c.kind==='register'),'合法注册未提交');
    await router.push('/query');await wait();await fill(['138001380001','   ']);await click();
    check(!window.fixtureCalls.some(c=>c.kind==='orders'),'非法身份查询了订单');
    check(document.body.textContent.includes('请输入姓名'),'查单错误不可见');layout();
    view.value='amount';await wait();const input=document.querySelector('input');
    for(const raw of ['1e3','1E3']){setInput(input,raw);await nextTick();check(amount.value===225,'科学计数改写金额')}
    for(const raw of ['12abc','12元','0x10','Infinity']){
      const event=new Event('paste',{bubbles:true,cancelable:true});Object.defineProperty(event,'clipboardData',{value:{getData:()=>raw}});input.dispatchEvent(event);check(event.defaultPrevented,'非法粘贴未拒绝');
    }
    for(const raw of ['225.0','225.02']){setInput(input,raw);await nextTick()}
    input.dispatchEvent(new Event('change',{bubbles:true}));input.dispatchEvent(new FocusEvent('blur',{bubbles:true}));await nextTick();
    check(amount.value===225.02,'合法逐字小数丢失');amount.value=225;
    for(const kind of ['personal','employee']){
      view.value='salary';mode.value=kind;open.value=true;await wait();
      const panel=[...document.querySelectorAll('.el-dialog')].find(el=>el.getClientRects().length);
      check(Boolean(panel),'薪资弹窗未打开');const rect=panel.getBoundingClientRect();check(rect.left>=-1&&rect.right<=innerWidth+1,'薪资弹窗超出视口 '+JSON.stringify({left:rect.left,right:rect.right,width:innerWidth,classes:panel.className}));
      const scroll=panel.querySelector('.salary-detail-table-wrap');check(scroll.scrollWidth>scroll.clientWidth,'宽表滚动失效 '+JSON.stringify({scroll:scroll.scrollWidth,client:scroll.clientWidth}));
      panel.querySelector('.el-dialog__headerbtn').click();await wait();check(!open.value,'薪资关闭事件失效');
    }
    results.push({theme,width:innerWidth,checks:'H5首次提交/错误/协议/密码、金额、薪资滚动与关闭'});
    window.fixtureCalls=[];
  }
  view.value='route';await router.push('/register');await wait();
  return {ok:true,results,userAgent:navigator.userAgent};
};
window.fixtureReady=true;
if(location.search.includes('autorun')) window.runInputSmoke().then(result=>fetch('/__input-result',{method:'POST',body:JSON.stringify(result)})).catch(error=>fetch('/__input-result',{method:'POST',body:JSON.stringify({ok:false,error:error.message+'\\n'+error.stack})}));
`

try {
  // Vite 将 port=0 回退至默认端口；先取得独立端口，防止 Safari 重用旧页面状态。
  const reservation = createPortReservation()
  await new Promise((resolve, reject) => { reservation.once('error', reject); reservation.listen(0, '127.0.0.1', resolve) })
  const reservedPort = reservation.address().port
  await new Promise((resolve, reject) => reservation.close(error => error ? reject(error) : resolve()))
  server = await createServer({ root, configFile: false, envFile: false, cacheDir: join(temporary, 'vite'),
    optimizeDeps: { noDiscovery: true, include: ['vue', 'pinia', 'vue-router', 'element-plus', '@element-plus/icons-vue', 'element-plus/es/components/focus-trap/index', 'dompurify', 'dayjs', 'dayjs/plugin/customParseFormat', 'dayjs/plugin/timezone', 'dayjs/plugin/utc', 'dayjs/plugin/relativeTime', 'dayjs/locale/zh-cn'] },
    resolve: { alias: { '@': resolve(root, 'src') } },
    plugins: [vue(), {
      name: 'isolated-input-fixture', enforce: 'pre',
      resolveId(id) {
        if (id === '/__input-entry.js') return '\0input-entry'
        if (/^\/__quote-header-(wholesale|sales)\.js$/.test(id)) return `\0quote-header-${id.includes('wholesale') ? 'wholesale' : 'sales'}`
        if (/^\/__quote-save-(wholesale|sales)\.js$/.test(id)) return `\0quote-save-${id.includes('wholesale') ? 'wholesale' : 'sales'}`
      },
      load(id) {
        if (id === '\0input-entry') return salaryGoods ? salaryGoodsEntry : deviceInputs ? deviceInputEntry : overlays ? `window.fixtureLoadingOnly=${loadingOnly};\n${overlayEntry}` : entry
        if (quoteHeaderModules.has(id)) return quoteHeaderModules.get(id)
        if (quoteSaveModules.has(id)) return quoteSaveModules.get(id)
        if (id === resolve(root, 'src/composables/index.ts')) return 'export {useForm,ValidationRules} from \'/src/composables/forms/useForm.ts\';import {ref} from \'vue\';export const useLoadingState=()=>({loading:ref(false)});'
        if (id === resolve(root, 'src/composables/useNotification.ts') && !overlays) return deviceInputs
          ? 'const notify=kind=>message=>window.fixtureNotices.push({kind,message});export const useNotification=()=>({success:notify("success"),warning:notify("warning"),error:notify("error")});'
          : 'export const useNotification=()=>({success(){},warning(){},error(){}});'
        if (deviceInputs && id === resolve(root, 'src/utils/unified-api.ts')) return 'export const unifiedApi={put:async(url,value)=>{window.fixtureCalls.push({url,value});return {success:true}}};'
        if (deviceInputs && id === resolve(root, 'src/composables/useBrandModels.ts')) return 'import {ref} from "vue";export const useBrandModels=()=>({brands:ref([]),brandModels:{},colors:ref([]),memories:ref([]),loadBrands:async()=>{},loadModelsForBrand:async()=>{},loadColors:async()=>{},loadMemories:async()=>{}});'
        if (id === resolve(root, 'src/api/auth.ts')) return 'const respond=kind=>async value=>{window.fixtureCalls.push({kind,value});return {token:\'mock-session\',user:{}}};export const login=respond(\'login\'),register=respond(\'register\'),getUserOrders=async()=>({data:[],total:0});export const tokenManager={isAuthenticated:()=>false,setToken(){}},userManager={getUser:()=>null,setUser(){},clearAuth(){}};'
        if (id === resolve(root, 'src/api/shop-public.ts')) return 'export const getPublicConfig=async()=>({success:true,data:{}}),getOrdersByPhone=async value=>{window.fixtureCalls.push({kind:\'orders\',value});return {data:[],total:0}};'
      },
      configureServer(vite) {
        vite.middlewares.use((req, res, next) => {
          if (req.url?.startsWith('/__input.html')) { res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end('<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"></head><body><div id="app"></div><script type="module" src="/__input-entry.js"></script></body></html>'); return }
          if (req.url === '/__input-result' && req.method === 'POST') {
            let body = ''; req.on('data', chunk => { body += chunk }); req.on('end', () => { iosResult = JSON.parse(body); res.end('ok') }); return
          }
          next()
        })
      }
    }], server: { host: '127.0.0.1', port: reservedPort, strictPort: true, hmr: false } })
  await server.listen()
  const port = server.httpServer.address().port
  const url = `http://127.0.0.1:${port}/__input.html`
  if (ios) {
    const devices = JSON.parse((await exec('xcrun', ['simctl', 'list', 'devices', 'available', '--json'])).stdout)
    const device = Object.values(devices.devices).flat().find(item => item.name.includes('iPhone') && item.state === 'Booted')
      || Object.values(devices.devices).flat().find(item => item.name === 'iPhone 14')
    assert.ok(device, '未找到可用 iPhone 模拟器')
    await exec('open', ['-a', 'Simulator'])
    if (device.state !== 'Booted') { await exec('xcrun', ['simctl', 'boot', device.udid]); bootedDevice = device.udid }
    await exec('xcrun', ['simctl', 'bootstatus', device.udid, '-b'], { timeout: 180000 }).catch(() => { throw new Error('iPhone 模拟器启动超时；尚未进入业务页面，不能记为 WebKit 验收通过') })
    await exec('xcrun', ['simctl', 'openurl', device.udid, `${url}?autorun=1&run=${Date.now()}`])
    for (let attempt = 0; attempt < 90 && !iosResult; attempt++) await new Promise(resolve => setTimeout(resolve, 1000))
    assert.ok(iosResult, 'iOS 模拟器未返回结果')
    assert.equal(iosResult.ok, true, iosResult.error)
    console.log(`iOS 模拟器 WebKit ${overlays ? '公共覆盖层与报价模板' : '输入与布局'}回归通过：`, JSON.stringify(iosResult))
  } else {
    browser = await puppeteer.launch({ executablePath: process.env.CHROME_BIN || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, userDataDir: join(temporary, 'chrome'), args: ['--no-sandbox'] })
    const page = await browser.newPage()
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    page.on('console', message => { if (message.type() === 'error') errors.push(`console: ${message.text()}`) })
    page.on('requestfailed', request => errors.push(`request: ${request.url()} ${request.failure()?.errorText || ''}`))
    await page.setRequestInterception(true)
    page.on('request', request => { const target = new URL(request.url()); target.hostname === '127.0.0.1' || ['data:', 'blob:'].includes(target.protocol) ? request.continue() : request.abort() })
    for (const width of salaryGoods ? [375, 430, 767, 768, 1024, 1440] : [375, 430, 768, 1024, 1440]) {
      await page.setViewport({ width, height: 932 })
      await page.goto(url, { waitUntil: 'networkidle0' })
      await page.waitForFunction('window.fixtureReady === true').catch(error => { throw new Error(`${error.message}; 页面异常: ${errors.join('; ')}`) })
      const result = await page.evaluate(() => window.runInputSmoke())
      assert.equal(result.ok, true)
      console.log(`Chromium ${overlays ? '公共覆盖层与报价模板' : '输入与布局'}回归通过：`, JSON.stringify(result.results))
      if (overlays && !loadingOnly) {
        await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'dark' }])
        const labels = await page.evaluate(() => window.runFormLabelSmoke())
        assert.equal(labels.ok && labels.systemDark, true)
        await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'light' }])
        console.log(`Chromium 系统暗色与明暗主题表单标签通过：${width}px`)
      }
    }
    assert.deepEqual(errors, [])
  }
} finally {
  await browser?.close()
  if (bootedDevice) await exec('xcrun', ['simctl', 'shutdown', bootedDevice]).catch(() => {})
  await server?.close()
  await rm(temporary, { recursive: true, force: true })
}
