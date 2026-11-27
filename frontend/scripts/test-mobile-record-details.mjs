#!/usr/bin/env node
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { createServer } from 'vite'
import vue from '@vitejs/plugin-vue'
import { mobileDetailEntry, mobileDetailMocks, attendanceDetailEntry, attendanceDetailFixture } from './lib/mobile-detail-browser-fixture.mjs'

const root = resolve(import.meta.dirname, '..')
const requireBackend = createRequire(resolve(root, '../backend/package.json'))
const { default: puppeteer } = requireBackend('puppeteer')
const temporary = await mkdtemp(join(tmpdir(), 'tf-mobile-records-'))
const mocks = mobileDetailMocks(root)
const screenshotDirectory = process.env.MOBILE_DETAIL_SCREENSHOT_DIR
let server, browser
const returngoodsOnly = process.argv.includes('--returngoods-only')
const attendanceOnly = process.argv.includes('--attendance-only')
const homeSectionsOnly = process.argv.includes('--home-sections-only')
const cases = [
  ...[1, 2].map(index => ({ file: 'views/system/page/Returngoods.vue', selector: `.el-table__body tr.el-table__row:nth-child(${index})`, receiptReadonly: true, text: index === 1 ? '整单退款' : '整单补款' })),
  { file: 'views/system/page/Returngoods.vue', selector: '.el-table__body tr.el-table__row:nth-child(3)', edit: '编辑' },
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
const activeCases = cases.filter(item => (
  (!returngoodsOnly || item.file.endsWith('/Returngoods.vue'))
  && (!homeSectionsOnly || item.parentAction && item.file.endsWith('/home-sections.vue'))
))

async function checkHomeProductThumbnails(page, height) {
  const selector = '[data-section-product] .product-card-thumbnail img'
  await page.waitForFunction(selector => {
    const images = [...document.querySelectorAll(selector)]
    return images.length === 2 && images.every(image => image.complete && image.naturalWidth > 0)
  }, {}, selector)
  const thumbnails = await page.$$eval(selector, images => images.map(image => {
    const frame = image.parentElement.getBoundingClientRect()
    const card = image.closest('[data-section-product]').getBoundingClientRect()
    const box = image.getBoundingClientRect()
    return {
      sourceSize: [image.naturalWidth, image.naturalHeight],
      frameHeight: image.parentElement.clientHeight,
      fit: getComputedStyle(image).objectFit,
      insideFrame: box.left >= frame.left - 1 && box.right <= frame.right + 1
        && box.top >= frame.top - 1 && box.bottom <= frame.bottom + 1,
      insideCard: frame.left >= card.left - 1 && frame.right <= card.right + 1
        && frame.top >= card.top - 1 && frame.bottom <= card.bottom + 1,
      draggable: image.draggable
    }
  }))
  assert.deepEqual(thumbnails.map(item => item.sourceSize), [[1800, 2400], [3200, 1800]])
  for (const { sourceSize, ...layout } of thumbnails) {
    assert.deepEqual(layout, { frameHeight: height, fit: 'contain', insideFrame: true, insideCard: true, draggable: false }, `${height}px 缩略图容纳 ${sourceSize.join('×')} 原图`)
  }
}

try {
  if (screenshotDirectory) await mkdir(screenshotDirectory, { recursive: true })
  server = await createServer({ root, configFile: false, envFile: false, cacheDir: join(temporary, 'vite'),
    resolve: { alias: { '@': resolve(root, 'src') } },
    optimizeDeps: { noDiscovery: true, include: ['vue', 'pinia', 'vue-router', 'element-plus', '@element-plus/icons-vue', 'vuedraggable', 'element-plus/es/components/focus-trap/index', 'dompurify', 'dayjs', 'dayjs/plugin/customParseFormat', 'dayjs/plugin/timezone', 'dayjs/plugin/utc', 'dayjs/plugin/relativeTime', 'dayjs/locale/zh-cn'] },
    plugins: [vue(), { name: 'isolated-mobile-records', enforce: 'pre',
      resolveId(id) {
        if (id === '/__mobile-entry.js') return '\0mobile-entry'
        if (attendanceOnly && id === '/__attendance-detail.vue') return join(root, '__attendance-detail.vue')
      },
      load(id) {
        if (id === '\0mobile-entry') return attendanceOnly ? attendanceDetailEntry : mobileDetailEntry
        if (attendanceOnly && id === join(root, '__attendance-detail.vue')) return attendanceDetailFixture(root)
        return mocks.get(id)
      },
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
  if (attendanceOnly) {
    for (const width of [320, 390, 767, 768, 1024, 1440]) for (const theme of ['light', 'dark']) {
      await page.setViewport({ width, height: 932, isMobile: width < 768, hasTouch: width < 768 })
      await page.evaluate(theme => { document.documentElement.dataset.theme = theme }, theme)
      for (const type of ['leave', 'monthly_leave', 'overtime']) {
        await page.evaluate(type => window.renderAttendanceDetail({ record: { record_type: type, monthly_leave_days: '1', overtime_hours: '2' } }), type)
        await page.waitForFunction(() => !document.querySelector('.mobile-dialog-sheet-fade-enter-active,.dialog-fade-enter-active'))
        const metrics = await page.evaluate(() => {
          const panel = document.querySelector('.attendance-detail-dialog'), body = panel.querySelector('.el-dialog__body')
          const descriptions = panel.querySelector('.el-descriptions'), table = descriptions.querySelector('table')
          const cell = table.querySelector('td,th'), firstLabels = [...table.querySelector('tr').children]
          return { panel: { left: panel.getBoundingClientRect().left, right: panel.getBoundingClientRect().right },
            bodyWidth: body.clientWidth, bodyScroll: body.scrollWidth, tableWidth: table.getBoundingClientRect().width,
            width: descriptions.getBoundingClientRect().width, border: parseFloat(getComputedStyle(cell).borderTopWidth), padding: parseFloat(getComputedStyle(cell).paddingLeft),
            labels: [...table.querySelectorAll('.el-descriptions__label')].map(node => node.textContent.trim()),
            tags: [...table.querySelectorAll('.el-tag')].map(node => ({ text: node.textContent.trim(), height: node.getBoundingClientRect().height, color: getComputedStyle(node).color, html: node.outerHTML })),
            columns: firstLabels.length, widths: firstLabels.map(node => node.getBoundingClientRect().width),
            footer: Boolean(panel.querySelector('.el-dialog__footer')) }
        })
        const label = `考勤详情 ${width}px/${theme}/${type}`
        assert.ok(metrics.panel.left >= -1 && metrics.panel.right <= width + 1 && metrics.bodyScroll <= metrics.bodyWidth + 1, `${label} 不得横向溢出`)
        assert.ok(Math.abs(metrics.tableWidth - metrics.width) <= 1 && metrics.border > 0 && metrics.padding > 0, `${label} 描述表须自带全宽、边框和单元格间距，不能依赖其他页面加载 CSS`)
        assert.equal(metrics.columns, 2, `${label} 短字段须两列`)
        assert.ok(metrics.tags.every(tag => tag.text && tag.height > 0 && tag.height <= 40), `${label} 类型与状态标签应完整紧凑显示 ${JSON.stringify(metrics.tags)}`)
        assert.ok(metrics.widths.every(value => value >= metrics.width * 0.3), `${label} 字段不可挤在左侧`)
        for (const [field, expected] of [['请假天数', 'leave'], ['休假天数', 'monthly_leave'], ['加班时长', 'overtime']]) {
          assert.equal(metrics.labels.includes(field), type === expected, `${label} 只能展示本类型的时长字段`)
        }
        assert.equal(metrics.footer, false, `${label} 已通过的只读记录不留空 footer`)
        results.push(label)
      }
      await page.evaluate(() => window.renderAttendanceDetail({ tab: 'my', hidden: ['attendance_myattendanceview:leave_type', 'attendance_myattendanceview:reason'], record: { employee_name: '员工长姓名'.repeat(8), approval_note: '长审批备注'.repeat(40) } }))
      const hidden = await page.evaluate(() => {
        const body = document.querySelector('.attendance-detail-dialog .el-dialog__body')
        return { text: body.textContent, labels: [...body.querySelectorAll('.el-descriptions__label')].map(node => node.textContent.trim()), width: body.clientWidth, scroll: body.scrollWidth }
      })
      assert.ok(!hidden.labels.includes('请假类型') && !hidden.labels.includes('原因') && !hidden.text.includes('有事'), '本人字段权限应使用本人模块，不泄漏隐藏内容')
      assert.ok(hidden.scroll <= hidden.width + 1, '长姓名和审批备注不得撑破弹窗')
      if (screenshotDirectory && [390, 1440].includes(width) && theme === 'light') {
        await page.evaluate(() => window.renderAttendanceDetail())
        await page.screenshot({ path: join(screenshotDirectory, `attendance-detail-${width}.png`), fullPage: true })
      }
    }
    assert.deepEqual(errors, [], '考勤详情浏览器运行异常')
    console.log(`考勤查看浏览器通过：${results.length} 组类型/视口/主题，含长内容和本人字段隐藏；真实详情模板、公共组件及按需CSS，未登录、无业务请求。`)
  }
  for (const width of (attendanceOnly ? [] : returngoodsOnly ? [375, 430, 767, 768, 1440] : [375, 430, 767])) for (const theme of ['light', 'dark']) {
    await page.setViewport({ width, height: 932, isMobile: width < 768, hasTouch: width < 768 })

    await page.evaluate(theme => { document.documentElement.dataset.theme = theme }, theme)
    for (const item of activeCases) {
      const label = `${item.file} ${item.tab || item.selector} ${width} ${theme}`
      try {
        if (item.file.endsWith('/Returngoods.vue')) {
          // 每种凭据用独立页面状态，避免上一用例尚未关闭的编辑弹层影响本组。
          await page.goto(`${origin}/__mobile.html`, { waitUntil: 'networkidle0' })
          await page.waitForFunction('window.fixtureReady === true')
          await page.evaluate(theme => { document.documentElement.dataset.theme = theme }, theme)
        }
        await page.evaluate(item => {
          // 保留当前挂载任务，避免 CDP 等待期间 Promise 被垃圾回收。
          window.fixtureRenderPromise = window.renderMobileCase(item.file, Boolean(item.readonly))
          return window.fixtureRenderPromise
        }, item)
        if (item.setupButton) await page.evaluate(text => [...document.querySelectorAll('button')].find(el => el.textContent.trim() === text).click(), item.setupButton)
        if (item.tabButton) await page.evaluate(text => [...document.querySelectorAll('.tab-navigation button')].find(el => el.textContent.trim() === text).click(), item.tabButton)
        if (item.tab) {
          const index = ['phones', 'accessories', 'sales', 'purchases'].indexOf(item.tab)
          await page.evaluate(index => document.querySelectorAll('[aria-label="综合预警统计"] > .stat-card')[index].click(), index)
        }
        if (item.parentAction) {
          await page.waitForSelector('.sections-list [data-mobile-record]')
          const parent = await page.$('.sections-list [data-mobile-record]')
          await parent.tap(); await parent.tap()
          await page.waitForFunction(text => [...document.querySelectorAll('.el-dialog__footer button')].some(el => el.textContent.trim() === text), {}, item.parentAction)
          await page.evaluate(text => [...document.querySelectorAll('.el-dialog__footer button')].find(el => el.textContent.trim() === text).click(), item.parentAction)
        }
        if (homeSectionsOnly && item.selector === '[data-section-product]') {
          await checkHomeProductThumbnails(page, 72)
          assert.equal(await page.$('[data-section-product] .tf-media-thumbnail-drag-handle'), null)
        }
        await page.waitForFunction(selector => [...document.querySelectorAll(selector)].some(element => element.getClientRects().length), {}, item.selector)
        const baseline = item.parentAction ? 1 : 0
        await page.waitForFunction(count => [...document.querySelectorAll('.el-dialog')].filter(el => el.getClientRects().length).length === count, {}, baseline)
        const record = await page.$$(item.selector)
        let target
        for (const candidate of record) if (await candidate.isVisible()) { target = candidate; break }
        assert.ok(target, '没有可见记录')
        if (returngoodsOnly && width >= 768) {
          const actions = await target.evaluate(element => [...element.querySelectorAll('button')].filter(button => button.getClientRects().length).map(button => button.textContent.trim()))
          if (item.receiptReadonly) {
            assert.deepEqual(actions, [], '联合退货凭据在桌面也不能编辑删除')
            assert.ok((await target.evaluate(element => element.textContent)).includes(item.text), '桌面须区分整单退款/补款')
          } else assert.deepEqual(actions, ['编辑', '删除'], '旧退库日志保留授权动作')
          assert.deepEqual(await page.evaluate(() => window.fixtureWrites), [])
          assert.deepEqual(await page.evaluate(() => window.fixtureUnknown), [])
          assert.deepEqual(await page.evaluate(() => window.fixtureNotices.filter(item => item.kind === 'error')), [])
          assert.deepEqual(errors, [])
          results.push(label)
          continue
        }
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
        if (item.readonly || item.receiptReadonly) assert.equal(metrics.actions.length, 0, '只读记录不得有编辑删除入口')
        if (item.text) assert.ok(await page.evaluate(text => [...document.querySelectorAll('.el-dialog')].filter(el => el.getClientRects().length).at(-1).textContent.includes(text), item.text), '手机详情缺少整单结算口径')
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
    console.log(`手机详情及编辑浏览器通过：${width}px / ${theme}，${activeCases.length} 个页面或子列表`)
  }
  if (homeSectionsOnly) {
    for (const width of [768, 1024, 1440]) for (const theme of ['light', 'dark']) {
      await page.setViewport({ width, height: 932, isMobile: false, hasTouch: false })
      await page.evaluate(async theme => {
        document.documentElement.dataset.theme = theme
        window.fixtureRenderPromise = window.renderMobileCase('views/H5-admin/page/home-sections.vue')
        await window.fixtureRenderPromise
      }, theme)
      await page.waitForFunction(() => [...document.querySelectorAll('.section-card button')].some(button => button.textContent.trim() === '管理'))
      await page.evaluate(() => [...document.querySelectorAll('.section-card button')].find(button => button.textContent.trim() === '管理').click())
      const removeSelector = '[data-section-product] .tf-media-thumbnail-actions button[aria-label="移除商品"]'
      await page.waitForSelector(removeSelector, { visible: true })
      await page.waitForFunction(() => !document.querySelector('.dialog-fade-enter-active, .mobile-dialog-sheet-fade-enter-active'))
      await checkHomeProductThumbnails(page, 80)
      const metrics = await page.$eval(removeSelector, button => {
        const row = button.parentElement
        const photo = row.parentElement.getBoundingClientRect()
        const handle = row.querySelector('.tf-media-thumbnail-drag-handle')
        const grip = handle.getBoundingClientRect()
        const action = button.getBoundingClientRect()
        return {
          width: action.width, height: action.height,
          gripWidth: grip.width, gripHeight: grip.height,
          aligned: Math.abs(grip.top - action.top) < 1 && grip.right < action.left,
          topRight: Math.abs(action.top - photo.top - 4) < 1 && Math.abs(photo.right - action.right - 4) < 1,
          icon: getComputedStyle(button.querySelector('.fa-trash-alt')).fontSize,
          reachable: [button, handle].every(control => {
            const box = control.getBoundingClientRect()
            return control.contains(document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2))
          })
        }
      })
      const { width: buttonWidth, height, gripWidth, gripHeight, ...appearance } = metrics
      const label = `${width}px/${theme} 推荐商品操作`
      assert.ok([buttonWidth, height, gripWidth, gripHeight].every(value => Math.abs(value - 28) < 0.1), `${label} 两个操作均为 28px`)
      assert.deepEqual(appearance, { aligned: true, topRight: true, icon: '13px', reachable: true }, label)
      await page.click(removeSelector)
      await page.waitForSelector('.el-message-box', { visible: true })
      await page.evaluate(() => [...document.querySelectorAll('.el-message-box button')].find(button => button.textContent.trim() === '取消').click())
      await page.waitForSelector('.el-message-box', { hidden: true })
      assert.ok(await page.$(removeSelector), '取消后商品保留')
      if (width === 1440 && theme === 'light') {
        await page.evaluate(() => { window.fixtureProductSort = [] })
        const cards = await page.$$('[data-section-product]')
        const handle = await cards[1].$('.tf-media-thumbnail-drag-handle')
        const start = await handle.clickablePoint()
        const target = await cards[0].boundingBox()
        await page.mouse.move(start.x, start.y)
        await page.mouse.down()
        await page.mouse.move(start.x - 8, start.y, { steps: 4 })
        await page.waitForSelector('.sortable-ghost', { timeout: 5000 })
        await page.mouse.move(target.x + target.width / 4, target.y + target.height / 2, { steps: 12 })
        await page.mouse.up()
        await page.waitForFunction(() => window.fixtureProductSort.length === 2, { timeout: 5000 })
        assert.deepEqual(await page.evaluate(() => window.fixtureProductSort), [
          ['/home/sections/1/products/2/sort', { sort_order: 0 }],
          ['/home/sections/1/products/1/sort', { sort_order: 1 }]
        ], '从拖动手柄开始排序，沿用原排序请求')
      }
      assert.deepEqual(await page.evaluate(() => window.fixtureWrites), [])
      assert.deepEqual(errors, [])
      results.push(`推荐商品 ${width}px/${theme}`)
    }
  }
  console.log(`隔离浏览器验证完成：${results.length} 组；真实Vue/Element/公共CSS，未登录、未连接数据库、无业务写入。`)
} finally {
  await browser?.close()
  await server?.close()
  await rm(temporary, { recursive: true, force: true })
}
