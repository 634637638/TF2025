#!/usr/bin/env node
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { createServer } from 'vite'
import vue from '@vitejs/plugin-vue'
import { mobileDetailEntry, mobileDetailMocks } from './lib/mobile-detail-browser-fixture.mjs'

const root = resolve(import.meta.dirname, '..')
const requireBackend = createRequire(resolve(root, '../backend/package.json'))
const { default: puppeteer } = requireBackend('puppeteer')
const temporary = await mkdtemp(join(tmpdir(), 'tf-mobile-records-'))
const mocks = mobileDetailMocks(root)
const screenshotDirectory = process.env.MOBILE_DETAIL_SCREENSHOT_DIR
let server, browser
const cases = [
  { file: 'views/H5-admin/page/banners.vue', selector: '[data-mobile-record]', edit: '编辑' },
  { file: 'views/H5-admin/page/home-sections.vue', selector: '[data-mobile-record]', edit: '编辑' },
  { file: 'views/H5-admin/page/home-sections.vue', selector: '[data-section-product]', parentAction: '管理商品', expectedAction: '移除商品' },
  { file: 'views/H5-admin/page/home-sections.vue', selector: '[data-available-product]', parentAction: '管理商品', expectedAction: '添加商品' },
  { file: 'views/H5-admin/page/templates.vue', selector: '[data-mobile-record]', edit: '编辑' },
  { file: 'views/H5-admin/page/SoldProductsView.vue', selector: '[data-mobile-record]' },
  { file: 'views/guide/GuideManagementView.vue', selector: '.announcement-row', edit: '编辑' },
  { file: 'views/guide/GuideManagementView.vue', selector: '.category-admin-card__header', edit: '编辑' },
  { file: 'views/guide/GuideManagementView.vue', selector: '.link-admin-row', edit: '编辑' },
  { file: 'views/shared/SharedView.vue', selector: '.shared-post', edit: '编辑' },
  { file: 'views/system/page/AnnouncementManagementCard.vue', selector: '[data-mobile-record]', edit: '编辑' },
  { file: 'views/system/page/GitManagement.vue', selector: '[data-mobile-record]' },
  { file: 'views/system/SystemView.vue', selector: '.price-contact-card .el-table__body tr.el-table__row', tabButton: '报价信息', edit: '编辑' },
  { file: 'views/system/SystemView.vue', selector: '.password-list-section .el-table__body tr.el-table__row', tabButton: '报价信息', edit: '编辑' },
  { file: 'components/ErrorManagement/ErrorDashboardSimple.vue', selector: '.common-errors-card .el-table__body tr.el-table__row' },
  { file: 'components/ErrorManagement/ErrorDashboardSimple.vue', selector: '.error-list-card .el-table__body tr.el-table__row' },
  ...['AccessorySerialPanel', 'AccessoryStockLocations', 'AccessoryTransferHistory'].map(name => ({ file: `components/${name}.vue`, selector: '.el-table__body tr.el-table__row', readonly: true })),
  { file: 'views/sales/page/SalesGridView.vue', selector: '.device-card', expectedAction: '出库' },
  { file: 'views/sales/page/SalesGridView.vue', selector: '.device-card', readonly: true },
  { file: 'views/data-optimization/page/DataCheckTab.vue', selector: '.duplicate-item', setupButton: '综合检查', edit: '编辑' },
  ...['phones', 'accessories', 'purchases'].map(tab => ({ file: 'components/ComprehensiveWarnings.vue', selector: '.el-table__body tr.el-table__row', tab }))
]
try {
  if (screenshotDirectory) await mkdir(screenshotDirectory, { recursive: true })
  server = await createServer({ root, configFile: false, envFile: false, cacheDir: join(temporary, 'vite'),
    resolve: { alias: { '@': resolve(root, 'src') } },
    optimizeDeps: { noDiscovery: true, include: ['vue', 'pinia', 'vue-router', 'element-plus', '@element-plus/icons-vue', 'vuedraggable', 'element-plus/es/components/focus-trap/index', 'dompurify', 'dayjs', 'dayjs/plugin/customParseFormat', 'dayjs/plugin/timezone', 'dayjs/plugin/utc', 'dayjs/plugin/relativeTime', 'dayjs/locale/zh-cn'] },
    plugins: [vue(), { name: 'isolated-mobile-records', enforce: 'pre',
      resolveId(id) { if (id === '/__mobile-entry.js') return '\0mobile-entry' },
      load(id) { return id === '\0mobile-entry' ? mobileDetailEntry : mocks.get(id) },
      configureServer(vite) { vite.middlewares.use((req, res, next) => {
        if (req.url === '/__mobile.html') { res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end('<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"></head><body><div id="app"></div><script type="module" src="/__mobile-entry.js"></script></body></html>'); return }
        if (req.method !== 'GET' || req.url?.startsWith('/api/')) { res.statusCode = 403; res.end('隔离测试禁止业务请求'); return }
        next()
      }) }
    }], server: { host: '127.0.0.1', port: 0, hmr: false } })
  await server.listen()
  const origin = `http://127.0.0.1:${server.httpServer.address().port}`
  browser = await puppeteer.launch({ executablePath: process.env.CHROME_BIN || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, userDataDir: join(temporary, 'chrome'), args: ['--no-sandbox'] })
  const page = await browser.newPage(), errors = [], results = []
  page.on('pageerror', error => errors.push(error.message))
  await page.setRequestInterception(true)
  page.on('request', request => {
    const url = new URL(request.url())
    if (['data:', 'blob:'].includes(url.protocol) || (url.origin === origin && request.method() === 'GET' && !url.pathname.startsWith('/api/'))) request.continue()
    else { errors.push(`阻断非夹具请求 ${request.method()} ${url.pathname}`); request.abort() }
  })
  await page.setViewport({ width: 375, height: 932, isMobile: true, hasTouch: true })
  await page.goto(`${origin}/__mobile.html`, { waitUntil: 'networkidle0' })
  await page.waitForFunction('window.fixtureReady === true')
  for (const width of [375, 430, 767]) for (const theme of ['light', 'dark']) {
    await page.setViewport({ width, height: 932, isMobile: true, hasTouch: true })
    await page.evaluate(theme => { document.documentElement.dataset.theme = theme }, theme)
    for (const item of cases) {
      const label = `${item.file} ${item.tab || item.selector} ${width} ${theme}`
      try {
        await page.evaluate(item => window.renderMobileCase(item.file, Boolean(item.readonly)), item)
        if (item.setupButton) await page.evaluate(text => [...document.querySelectorAll('button')].find(el => el.textContent.trim() === text).click(), item.setupButton)
        if (item.tabButton) await page.evaluate(text => [...document.querySelectorAll('.tab-navigation button')].find(el => el.textContent.trim() === text).click(), item.tabButton)
        if (item.tab) {
          const index = ['phones', 'accessories', 'sales', 'purchases'].indexOf(item.tab)
          await page.evaluate(index => document.querySelectorAll('.overview-card')[index].click(), index)
        }
        if (item.parentAction) {
          await page.waitForSelector('.sections-list [data-mobile-record]')
          const parent = await page.$('.sections-list [data-mobile-record]')
          await parent.tap(); await parent.tap()
          await page.waitForFunction(text => [...document.querySelectorAll('.el-dialog__footer button')].some(el => el.textContent.trim() === text), {}, item.parentAction)
          await page.evaluate(text => [...document.querySelectorAll('.el-dialog__footer button')].find(el => el.textContent.trim() === text).click(), item.parentAction)
        }
        await page.waitForFunction(selector => [...document.querySelectorAll(selector)].some(element => element.getClientRects().length), {}, item.selector)
        const baseline = item.parentAction ? 1 : 0
        await page.waitForFunction(count => [...document.querySelectorAll('.el-dialog')].filter(el => el.getClientRects().length).length === count, {}, baseline)
        const record = await page.$$(item.selector)
        let target
        for (const candidate of record) if (await candidate.isVisible()) { target = candidate; break }
        assert.ok(target, '没有可见记录')
        assert.equal(await target.evaluate(element => [...element.querySelectorAll('button,.el-switch')].filter(el => el.getClientRects().length).length), 0, '手机记录内不能保留业务操作按钮')
        await target.scrollIntoView()
        await target.tap()
        assert.equal(await page.evaluate(() => [...document.querySelectorAll('.el-dialog')].filter(el => el.getClientRects().length).length), baseline, '单击不应打开详情')
        // 真实触摸事件；单击后再轻触两次，公共去重负责抑制兼容事件。
        await target.tap()
        await page.waitForFunction(count => [...document.querySelectorAll('.el-dialog')].filter(el => el.getClientRects().length).length > count, {}, baseline)
        await page.waitForFunction(() => !document.querySelector('.mobile-dialog-sheet-fade-enter-active, .mobile-dialog-sheet-fade-leave-active, .dialog-fade-enter-active, .dialog-fade-leave-active'))
        const metrics = await page.evaluate(() => {
          const panel = [...document.querySelectorAll('.el-dialog')].filter(el => el.getClientRects().length).at(-1)
          const rect = panel.getBoundingClientRect(), details = panel.querySelector('.tf-record-details')
          return { left: rect.left, right: rect.right, width: innerWidth, scroll: document.documentElement.scrollWidth,
            columns: details ? getComputedStyle(details).gridTemplateColumns.split(' ').length : null,
            actions: [...panel.querySelectorAll('.el-dialog__footer button')].filter(el => el.getClientRects().length).map(el => el.textContent.trim()) }
        })
        assert.ok(metrics.left >= -1 && metrics.right <= width + 1 && metrics.scroll <= width + 1, '详情或页面横向溢出')
        if (metrics.columns) assert.equal(metrics.columns, 2, '短字段必须保持两列')
        assert.ok(!metrics.actions.includes('关闭'), '只读详情不能有纯关闭按钮')
        if (item.readonly) assert.equal(metrics.actions.length, 0, '无操作权限不得有空操作区')
        if (item.expectedAction) assert.ok(metrics.actions.includes(item.expectedAction), '子列表缺少底部操作')
        if (screenshotDirectory && width === 375 && theme === 'light' && (item.parentAction || item.file.endsWith('/SystemView.vue'))) {
          await page.screenshot({ path: join(screenshotDirectory, `${item.file.replace(/\W+/g, '-')}-${item.selector.replace(/\W+/g, '-')}.png`), fullPage: true })
        }
        if (item.edit) {
          assert.ok(metrics.actions.includes(item.edit), '缺少详情底部编辑')
          await page.evaluate(text => {
            const panel = [...document.querySelectorAll('.el-dialog')].filter(el => el.getClientRects().length).at(-1)
            ;[...panel.querySelectorAll('.el-dialog__footer button')].find(el => el.textContent.trim() === text).click()
          }, item.edit)
          await page.waitForFunction(() => {
            const visible = [...document.querySelectorAll('.el-dialog')].filter(el => el.getClientRects().length)
            return visible.length === 1 && Boolean(visible[0].querySelector('input,textarea')) && !visible[0].classList.contains('record-detail-dialog')
          })
          await page.waitForFunction(() => !document.querySelector('.mobile-dialog-sheet-fade-enter-active, .mobile-dialog-sheet-fade-leave-active, .dialog-fade-enter-active, .dialog-fade-leave-active'))
          const edit = await page.evaluate(() => {
            const panel = [...document.querySelectorAll('.el-dialog')].filter(el => el.getClientRects().length).at(-1)
            const rect = panel.getBoundingClientRect()
            return { left:rect.left,right:rect.right,grids:[...panel.querySelectorAll('.tf-form-grid,.tf-form-row')].map(el=>({ columns:getComputedStyle(el).gridTemplateColumns,display:getComputedStyle(el).display })),footer:Boolean(panel.querySelector('.el-dialog__footer')) }
          })
          assert.ok(edit.left >= -1 && edit.right <= width + 1 && edit.footer, '编辑弹窗溢出或缺少底部按钮')
          assert.ok(edit.grids.some(grid => grid.display === 'grid' && grid.columns.split(' ').length === 2), `编辑未采用公共两列字段布局 ${JSON.stringify(edit.grids)}`)
          if (screenshotDirectory && width === 375 && theme === 'light' && item.file.endsWith('/templates.vue')) {
            await page.screenshot({ path: join(screenshotDirectory, 'templates-edit.png'), fullPage: true })
          }
        }
        assert.deepEqual(await page.evaluate(() => window.fixtureWrites), [], '不允许业务写入')
        assert.deepEqual(await page.evaluate(() => window.fixtureUnknown), [], '样本缺少读取契约')
        assert.deepEqual(await page.evaluate(() => window.fixtureNotices.filter(item => item.kind === 'error')), [], '页面发生错误提示')
        assert.deepEqual(errors, [], '浏览器运行异常')
        results.push(label)
      } catch (error) { throw new Error(`${label}: ${error.message}; 页面异常 ${errors.join('; ')}`, { cause: error }) }
    }
    console.log(`手机详情及编辑浏览器通过：${width}px / ${theme}，${cases.length} 个页面或子列表`)
  }
  console.log(`隔离浏览器验证完成：${results.length} 组；真实Vue/Element/公共CSS，未登录、未连接数据库、无业务写入。`)
} finally {
  await browser?.close()
  await server?.close()
  await rm(temporary, { recursive: true, force: true })
}
