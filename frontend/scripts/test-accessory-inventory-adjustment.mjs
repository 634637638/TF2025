#!/usr/bin/env node
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { mkdtemp, mkdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { createServer } from 'vite'
import vue from '@vitejs/plugin-vue'
import { mobileDetailEntry, mobileDetailMocks } from './lib/mobile-detail-browser-fixture.mjs'

const root = resolve(import.meta.dirname, '..')
const requireBackend = createRequire(resolve(root, '../backend/package.json'))
const { default: puppeteer } = requireBackend('puppeteer')
const temporary = await mkdtemp(join(tmpdir(), 'tf-inventory-adjustment-browser-'))
const mocks = mobileDetailMocks(root)
const screenshots = process.env.INVENTORY_ADJUSTMENT_SCREENSHOT_DIR
const entry = mobileDetailEntry + `
window.fixtureQuantity=4;
window.fixtureRead=async(url,options={})=>{
 if(url!=='/accessories/1/batches')throw Error('禁止未声明的业务读取');
 const rows=window.fixtureQuantity>0||options.params.include_zero?[{row_key:'event:91',accessory_id:1,store_id:2,
 store_name:'当前盘点门店',brand_name:'演示品牌',product_model:'MODEL-A',batch_no:'IN-20261115',supplier_name:'演示供应商',
 inventory_time:'2026-11-15 00:00:00',inventory_operator_name:'演示操作员',purchase_cost:'12.50',usage_type:'sale',
 serial_tracking:0,quantity:window.fixtureQuantity,source_status:'purchase'}]:[];
 return {success:true,data:{data:rows,pagination:{page:1,page_size:20,total:rows.length}}};
};
window.fixtureWrite=async(url,payload)=>{
 if(url!=='/accessories/1/inventory-adjustments'||payload.expected_quantity!==window.fixtureQuantity)throw Error('禁止未声明的业务写入');
 window.fixtureWrites.push(structuredClone({url,payload}));
 const previous=window.fixtureQuantity;window.fixtureQuantity=payload.counted_quantity;
 return {success:true,data:{adjustment_id:112,accessory_id:1,store_id:2,stock_in_id:7,previous_quantity:previous,
 counted_quantity:payload.counted_quantity,delta:payload.counted_quantity-previous,replayed:false}};
};
`
let server, browser
try {
  if (screenshots) await mkdir(screenshots, { recursive: true })
  server = await createServer({ root, configFile: false, envFile: false, cacheDir: join(temporary, 'vite'),
    resolve: { alias: { '@': resolve(root, 'src') } }, optimizeDeps: { noDiscovery: true, include: ['vue', 'pinia', 'vue-router', 'element-plus', '@element-plus/icons-vue', 'element-plus/es/components/focus-trap/index', 'dayjs', 'dayjs/plugin/customParseFormat', 'dayjs/plugin/timezone', 'dayjs/plugin/utc', 'dayjs/plugin/relativeTime', 'dayjs/locale/zh-cn', 'dompurify'] },
    plugins: [vue(), { name: 'isolated-inventory-adjustment', enforce: 'pre',
      resolveId(id) { if (id === '/__inventory-entry.js') return '\0inventory-entry' },
      load(id) { return id === '\0inventory-entry' ? entry : mocks.get(id) },
      configureServer(vite) { vite.middlewares.use((req, res, next) => {
        if (req.url === '/__inventory.html') {
          res.setHeader('Content-Type', 'text/html; charset=utf-8')
          res.end('<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="app"></div><script type="module" src="/__inventory-entry.js"></script></body></html>')
          return
        }
        if (req.method !== 'GET' || req.url?.startsWith('/api/')) { res.statusCode = 403; res.end('禁止真实业务请求'); return }
        next()
      }) }
    }], server: { host: '127.0.0.1', port: 0, hmr: false } })
  await server.listen()
  const origin = `http://127.0.0.1:${server.httpServer.address().port}`
  browser = await puppeteer.launch({ executablePath: process.env.CHROME_BIN || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true,
    userDataDir: join(temporary, 'chrome'), args: ['--no-sandbox'] })
  const page = await browser.newPage(), errors = [], results = []
  page.on('pageerror', error => errors.push(error.message))
  await page.setRequestInterception(true)
  page.on('request', request => {
    const url = new URL(request.url())
    if (['data:', 'blob:'].includes(url.protocol) || url.origin === origin && request.method() === 'GET' && !url.pathname.startsWith('/api/')) request.continue()
    else { errors.push('已阻止真实业务请求'); request.abort() }
  })
  await page.goto(`${origin}/__inventory.html`, { waitUntil: 'networkidle0' })
  await page.waitForFunction('window.fixtureReady === true')
  const click = async (selector, text) => {
    const handle = await page.evaluateHandle((selector, text) => [...document.querySelectorAll(selector)].find(el =>
      el.textContent.trim() === text && el.checkVisibility() && el.getBoundingClientRect().width > 0), selector, text)
    assert.ok(handle.asElement(), `未找到按钮：${text}`)
    await handle.asElement().click(); await handle.dispose()
  }
  for (const width of [320, 375, 768, 1440]) for (const theme of ['light', 'dark']) {
    await page.setViewport({ width, height: 932, isMobile: width < 768, hasTouch: true })
    await page.evaluate(async theme => {
      document.documentElement.dataset.theme = theme
      window.fixtureQuantity = 4; window.fixtureWrites = []
      await window.renderMobileCase('components/AccessoryBatchStock.vue')
    }, theme)
    await page.waitForSelector('.data-table .el-table__row')
    if (width < 768) {
      const cell = await page.$('.data-table .el-table__row td')
      await cell.tap(); await cell.tap(); await cell.dispose()
      await page.waitForSelector('[role="dialog"][aria-label="当前批次库存详情"]', { visible: true })
      await click('[role="dialog"] button', '盘点')
    } else await click('.data-table button', '盘点')
    await page.waitForSelector('[aria-label="盘点后实际数量"]', { visible: true })
    await page.evaluate(async () => { await document.fonts.ready; await Promise.all(document.getAnimations().filter(a => a.effect?.getTiming().iterations !== Infinity).map(a => a.finished.catch(() => {}))) })
    const layout = await page.evaluate(() => {
      const input = document.querySelector('[aria-label="盘点后实际数量"]')
      const dialog = input.closest('[role="dialog"]'), body = dialog.querySelector('.el-dialog__body'), rect = dialog.getBoundingClientRect()
      return { inside: rect.left >= -1 && rect.right <= innerWidth + 1, overflow: body.scrollWidth > body.clientWidth + 1,
        actions: [...dialog.querySelectorAll('.tf-dialog-actions button')].map(el => el.textContent.trim()) }
    })
    assert.equal(layout.inside, true); assert.equal(layout.overflow, false)
    assert.deepEqual(layout.actions, ['取消', '确认盘点'])
    if (screenshots && width === 375) await page.screenshot({ path: join(screenshots, `inventory-${theme}.png`) })
    const input = await page.$('input[aria-label="盘点后实际数量"], [aria-label="盘点后实际数量"] input')
    assert.ok(input, '数量必须使用可编辑的公共输入框')
    await input.focus(); await input.evaluate(el => el.select())
    await input.press('Backspace'); await input.type('0'); await input.press('Tab')
    assert.equal(await input.evaluate(el => el.value), '0')
    await page.type('textarea', '实物盘点为零')
    await click('[role="dialog"] button', '确认盘点')
    await page.waitForFunction('window.fixtureWrites.length === 1 && window.fixtureNotices.some(n=>n.kind==="success")')
    const payload = await page.evaluate(() => window.fixtureWrites[0].payload)
    assert.equal(payload.counted_quantity, 0); assert.equal(payload.expected_quantity, 4)
    assert.equal(payload.reason, '实物盘点为零'); assert.match(payload.request_key, /^[a-f0-9]{32}$/)
    results.push({ width, theme, inMemorySaved: true })
  }
  assert.deepEqual(errors, [])
  console.log(JSON.stringify({ cases: results.length, realBusinessWrites: false, results }))
} finally {
  await browser?.close(); await server?.close(); await rm(temporary, { recursive: true, force: true })
}
