#!/usr/bin/env node
// 真实公共控件与版本数据的浏览器回归；不启动业务应用、不读取环境文件、不访问数据库。
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { mkdtemp, mkdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve, join } from 'node:path'
import { createServer } from 'vite'
import vue from '@vitejs/plugin-vue'

const root = resolve(import.meta.dirname, '..')
const requireBackend = createRequire(resolve(root, '../backend/package.json'))
const { default: puppeteer } = requireBackend('puppeteer')
const RegionService = requireBackend('./src/services/region.service')
const regions = new RegionService()
const temporary = await mkdtemp(join(tmpdir(), 'tf-region-browser-'))
const evidenceIndex = process.argv.indexOf('--evidence-dir')
const evidence = evidenceIndex >= 0 ? process.argv[evidenceIndex + 1] : null
if (evidenceIndex >= 0 && (!evidence || evidence.startsWith('--'))) throw new Error('--evidence-dir 必须提供目录')
const entry = `
import { createApp, h, reactive } from 'vue';
import ElementPlus from 'element-plus';
import AddressFields from '/src/views/customers/page/CustomerAddressFields.vue';
import InlineLoading from '/src/components/InlineLoading.vue';
import 'element-plus/dist/index.css';
import '/src/styles.scss';
import '/src/styles/responsive.scss';
const state=reactive({ready:true, location:{province:'11',city:'北京市',district:'东城区',town:'东华门街道',village:'多福巷社区居委会'},detail:'历史门牌 1号'});
window.fixtureRequests=[];window.fixtureState=state;
const app=createApp({render:()=>h('main',{class:'admin-content'},[h('form',{onSubmit:e=>e.preventDefault()},[h(AddressFields,{
  location:state.location,detail:state.detail,limit:200,ready:state.ready,canView:()=>true,canEdit:()=>true,
  onChange:value=>state.location=value,'onUpdate:detail':value=>state.detail=value
})])])});
app.use(ElementPlus);app.component('InlineLoading',InlineLoading);app.mount('#app');window.fixtureReady=true;
`
let server, browser
try {
  server = await createServer({ root, configFile: false, envFile: false, cacheDir: join(temporary, 'vite'),
    optimizeDeps: { noDiscovery: true, include: ['vue', 'element-plus', '@element-plus/icons-vue', 'element-plus/es/components/focus-trap/index',
      'dayjs', 'dayjs/plugin/customParseFormat', 'dayjs/plugin/timezone', 'dayjs/plugin/utc', 'dayjs/plugin/relativeTime', 'dayjs/locale/zh-cn'] },
    resolve: { alias: { '@': resolve(root, 'src') } }, plugins: [vue(), {
      name: 'isolated-region-browser', enforce: 'pre',
      resolveId(id) { if (id === '/__region-entry.js') return '\0region-entry' },
      load(id) {
        if (id === '\0region-entry') return entry
        if (id === resolve(root, 'src/utils/unified-api.ts')) return `export const unifiedApi={get:async(url,config)=>{
          if(url!=='/regions')throw new Error('隔离测试禁止业务请求');
          window.fixtureRequests.push(config.params.parent);
          const response=await fetch('/__region-data?parent='+encodeURIComponent(config.params.parent),{signal:config.signal});
          const body=await response.json();if(!response.ok)throw new Error('地区加载失败');return body;
        }};`
      },
      configureServer(host) {
        host.middlewares.use(async (req, res, next) => {
          if (req.url?.startsWith('/__region-data?')) {
            try {
              const data = await regions.children(new URL(req.url, 'http://fixture').searchParams.get('parent'))
              res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ success: true, data }))
            } catch { res.statusCode = 400; res.end('{}') }
          } else if (req.url === '/__region.html') {
            res.setHeader('Content-Type', 'text/html; charset=utf-8')
            res.end('<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><div id="app"></div><script type="module" src="/__region-entry.js"></script></body></html>')
          } else next()
        })
      }
    }], server: { host: '127.0.0.1', port: 0, hmr: false } })
  await server.listen()
  const address = server.httpServer.address()
  const origin = `http://127.0.0.1:${address.port}`
  browser = await puppeteer.launch({ executablePath: process.env.CHROME_BIN || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true, userDataDir: join(temporary, 'chrome'), args: ['--no-sandbox'] })
  const page = await browser.newPage(), errors = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('dialog', async dialog => { errors.push('不应有重复确认框'); await dialog.dismiss() })
  await page.setRequestInterception(true)
  page.on('request', request => {
    const url = new URL(request.url())
    if (url.origin === origin || ['data:', 'blob:'].includes(url.protocol)) void request.continue()
    else { errors.push('隔离测试出现非本机请求'); void request.abort() }
  })
  if (evidence) await mkdir(evidence, { recursive: true })
  for (const width of [375, 430, 768, 1024, 1440]) {
    await page.setViewport({ width, height: 932 })
    for (const theme of ['light', 'dark']) {
      await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: theme }])
      await page.goto(`${origin}/__region.html`, { waitUntil: 'networkidle0' })
      await page.waitForFunction(() => window.fixtureReady && window.fixtureRequests.includes('110101001'))
      await page.evaluate(value => {
        document.documentElement.dataset.theme = value
        document.documentElement.classList.remove('theme-light', 'theme-dark')
        document.documentElement.classList.add(`theme-${value}`)
      }, theme)
      assert.equal(await page.$$eval('.el-select', elements => elements.length), 5)
      const layout = await page.evaluate(() => ({
        viewport: innerWidth, width: document.documentElement.scrollWidth,
        background: getComputedStyle(document.body).backgroundColor,
        labelColor: getComputedStyle(document.querySelector('.city-selector label')).color,
        controls: [...document.querySelectorAll('.el-select')].map(element => { const r = element.getBoundingClientRect(); return { left: r.left, right: r.right, width: r.width } }),
        content: document.body.innerText
      }))
      assert.ok(layout.width <= layout.viewport + 1, `页面横向溢出 ${width}/${theme}`)
      assert.ok(layout.controls.every(control => control.width > 0 && control.left >= -1 && control.right <= width + 1))
      assert.ok(layout.content.includes('2023-06-30'))
      assert.ok(layout.content.includes('多福巷社区居委会'))
      assert.equal(await page.evaluate(() => matchMedia('(prefers-color-scheme: dark)').matches), theme === 'dark')
      assert.notEqual(layout.labelColor, layout.background, '地区标签必须与背景可区分')
      if (evidence && [375, 1440].includes(width)) await page.screenshot({ path: join(evidence, `regions-${width}-${theme}.png`) })
      const selects = await page.$$('.el-select__wrapper')
      await selects[2].click()
      const options = await page.$$('.el-select-dropdown__item')
      let target
      for (const option of options) if ((await option.evaluate(element => element.textContent.trim())) === '西城区') { target = option; break }
      assert.ok(target, '县区下拉缺少实际版本数据')
      await target.click()
      await page.waitForFunction(() => window.fixtureState.location.district === '西城区' && window.fixtureState.location.town === '' && window.fixtureState.location.village === '')
      assert.equal(await page.$eval('textarea', input => input.value), '历史门牌 1号')
      await page.evaluate(() => { window.fixtureState.ready = false })
      await page.waitForFunction(() => document.querySelectorAll('.el-select').length === 3)
      assert.ok((await page.$eval('body', element => element.innerText)).includes('五级地址尚未启用'))
      assert.deepEqual(errors, [])
      console.log(`地区公共控件 Chromium ${width}px / ${theme}：五级、旧值、切换清空、迁移前兼容、布局通过`)
    }
  }
} finally {
  await browser?.close()
  await server?.close()
  await rm(temporary, { recursive: true, force: true })
}
