#!/usr/bin/env node
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { createServer } from 'vite'
import vue from '@vitejs/plugin-vue'
import { accessoryCorrectionEntry, accessoryCorrectionMocks } from './lib/accessory-stock-correction-browser-fixture.mjs'

const root = resolve(import.meta.dirname, '..')
const requireBackend = createRequire(resolve(root, '../backend/package.json'))
const { default: puppeteer } = requireBackend('puppeteer')
const temporary = await mkdtemp(join(tmpdir(), 'tf-stock-correction-browser-'))
const mocks = accessoryCorrectionMocks(root)
const screenshotDirectory = process.env.ACCESSORY_CORRECTION_SCREENSHOT_DIR
const correctionsOnly = process.argv.includes('--corrections-only')
const templateColorsOnly = process.argv.includes('--template-colors-only')
const filtersOnly = process.argv.includes('--filters-only')
const modelSummaryOnly = process.argv.includes('--model-summary-only')
const templateSearchOnly = process.argv.includes('--template-search-only') || templateColorsOnly || filtersOnly || modelSummaryOnly || correctionsOnly
const pageActionsOnly = process.argv.includes('--page-actions-only')
let server, browser
try {
  if (screenshotDirectory) await mkdir(screenshotDirectory, { recursive: true })
  server = await createServer({ root, configFile: false, envFile: false, cacheDir: join(temporary, 'vite'),
    resolve: { alias: { '@': resolve(root, 'src') } },
    optimizeDeps: { noDiscovery: true, include: ['vue', 'pinia', 'vue-router', 'element-plus', '@element-plus/icons-vue', 'vuedraggable', 'element-plus/es/components/focus-trap/index', 'dompurify', 'dayjs', 'dayjs/plugin/customParseFormat', 'dayjs/plugin/timezone', 'dayjs/plugin/utc', 'dayjs/plugin/relativeTime', 'dayjs/locale/zh-cn'] },
    plugins: [vue(), { name: 'isolated-stock-correction', enforce: 'pre',
      resolveId(id) { if (id === '/__stock-entry.js') return '\0stock-entry' },
      load(id) { return id === '\0stock-entry' ? accessoryCorrectionEntry : mocks.get(id) },
      configureServer(vite) { vite.middlewares.use((req, res, next) => {
        if (req.url === '/__stock.html') { res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end('<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"></head><body><div id="app"></div><script type="module" src="/__stock-entry.js"></script></body></html>'); return }
        if (req.method !== 'GET' || req.url?.startsWith('/api/')) { res.statusCode = 403; res.end('隔离测试禁止业务请求'); return }
        next()
      }) }
    }], server: { host: '127.0.0.1', port: 0, hmr: false } })
  await server.listen()
  const origin = `http://127.0.0.1:${server.httpServer.address().port}`
  browser = await puppeteer.launch({ executablePath: process.env.CHROME_BIN || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, userDataDir: join(temporary, 'chrome'), args: ['--no-sandbox'] })
  const page = await browser.newPage(), errors = [], results = []
  const recordResult = result => {
    results.push(result)
    console.log(`通过：${result}`)
  }
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => {
    if (/ElInfiniteScroll|v-infinite-scroll/.test(message.text())) errors.push(message.text())
  })
  await page.setRequestInterception(true)
  page.on('request', request => {
    const url = new URL(request.url())
    if (['data:', 'blob:'].includes(url.protocol) || (url.origin === origin && request.method() === 'GET' && !url.pathname.startsWith('/api/'))) request.continue()
    else { errors.push(`阻断业务或外部请求 ${request.method()} ${url.pathname}`); request.abort() }
  })
  await page.goto(`${origin}/__stock.html`, { waitUntil: 'networkidle0' })
  await page.waitForFunction('window.fixtureReady === true')
  const clickButton = async (selector, text) => {
    await page.waitForFunction((selector, text) => [...document.querySelectorAll(selector)].some(el => {
      const rect = el.getBoundingClientRect()
      return el.textContent.trim() === text && rect.width > 0 && rect.height > 0 && el.checkVisibility()
    }), {}, selector, text)
    const button = await page.evaluateHandle((selector, text) => [...document.querySelectorAll(selector)].find(el => {
      const rect = el.getBoundingClientRect()
      return el.textContent.trim() === text && rect.width > 0 && rect.height > 0 && el.checkVisibility()
    }), selector, text)
    await button.click(); await button.dispose()
  }
  const dialogSelector = '.accessory-dialog'
  const settleLayout = () => page.evaluate(async () => {
    await document.fonts.ready
    let stableFrames = 0
    for (let frame = 0; frame < 12; frame++) {
      await new Promise(resolve => requestAnimationFrame(resolve))
      const animations = document.getAnimations().filter(animation =>
        animation.effect?.getTiming().iterations !== Infinity && (animation.pending || animation.playState === 'running'))
      stableFrames = animations.length ? 0 : stableFrames + 1
      await Promise.all(animations.map(animation => animation.finished.catch(() => {})))
      if (stableFrames >= 3) return
    }
    throw new Error('页面动画未稳定')
  })
  const openEditor = async (width, waitForForm = true) => {
    await page.waitForSelector('.data-table .el-table__row')
    if (width <= 767) {
      const cell = await page.$('.data-table .el-table__row td')
      await cell.tap(); await cell.tap(); await cell.dispose()
      await clickButton('.accessory-details-dialog button', '编辑')
    } else await clickButton('.data-table button', '编辑')
    if (!waitForForm) return
    await page.waitForSelector(`${dialogSelector} .accessory-form`, { visible: true })
    await settleLayout()
  }
  const assertLayout = async () => {
    const layout = await page.evaluate(selector => {
      const dialog = [...document.querySelectorAll(selector)].find(el => el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden')
      const rect = dialog?.getBoundingClientRect()
      const form = dialog?.querySelector('.accessory-form')
      return { dialogInside: Boolean(rect && rect.left >= -1 && rect.right <= innerWidth + 1),
        overflow: document.documentElement.scrollWidth > innerWidth + 1,
        formOverflow: Boolean(form && form.scrollWidth > form.clientWidth + 1),
        labels: [...dialog.querySelectorAll('.accessory-form .el-form-item__label')].map(el => el.textContent.trim()) }
    }, dialogSelector)
    assert.equal(layout.dialogInside, true); assert.equal(layout.overflow, false); assert.equal(layout.formOverflow, false)
    assert.deepEqual(layout.labels.slice(0, 14), ['供应商', '配件品牌', '商品名称', '店铺', '商品类型', '配件型号', '颜色', '条形码', '进价', '销售价', '入库总数', '入库员', '入库用途', 'SN管理'])
  }
  const assertPublicButtons = async () => {
    const failures = await page.evaluate(() => {
      const failures = []
      const tokenColor = (button, token) => {
        const probe = document.createElement('span')
        probe.style.color = `var(${token})`; probe.style.display = 'none'; button.append(probe)
        const color = getComputedStyle(probe).color; probe.remove(); return color
      }
      for (const button of document.querySelectorAll('.el-button')) {
        if (!button.checkVisibility()) continue
        const style = getComputedStyle(button), label = button.textContent.trim()
        const family = ['transfer', 'manage', 'refresh'].find(value => button.classList.contains(`tf-button--${value}`))
        if (family && !button.disabled) {
          const prefix = family === 'refresh' ? 'export' : family
          const hovered = button.matches(':hover, :focus')
          const background = tokenColor(button, `--tf-button-${prefix}${hovered ? '-hover' : ''}-bg`)
          if (style.backgroundColor !== background || style.color !== tokenColor(button, '--tf-button-on-color')) failures.push(`${label}未使用公共${family}颜色`)
        }
        if (button.closest('.tf-dialog-actions, .tf-dialog-toolbar')) {
          if (Math.abs(parseFloat(style.height) - parseFloat(style.getPropertyValue('--tf-dialog-action-height'))) > 1) failures.push(`${label}未使用公共弹窗按钮高度`)
        }
        if (button.getAttribute('role') === 'tab' && button.closest('.tf-page-tabs')) {
          if (Math.abs(parseFloat(style.height) - parseFloat(style.getPropertyValue('--tf-tabs-height'))) > 1) failures.push(`${label}未使用公共TAB高度`)
          if (button.getAttribute('aria-selected') === 'true' && style.backgroundColor !== tokenColor(button, '--tf-tab-active-bg')) failures.push(`${label}未使用公共TAB选中色`)
        }
      }
      for (const tab of document.querySelectorAll('.tf-page-tabs .el-tabs__item')) {
        if (!tab.checkVisibility()) continue
        const style = getComputedStyle(tab)
        if (Math.abs(parseFloat(style.height) - parseFloat(style.getPropertyValue('--tf-tabs-height'))) > 1) failures.push(`${tab.textContent}未使用公共TAB高度`)
        if (tab.classList.contains('is-active') && style.backgroundColor !== tokenColor(tab, '--tf-tab-active-bg')) failures.push(`${tab.textContent}未使用公共TAB选中色`)
      }
      return failures
    })
    assert.deepEqual(failures, [])
  }
  const assertEditorAppearance = async (expectedSections, expectedTitle = '入库') => {
    const layout = await page.evaluate(selector => {
      const dialog = [...document.querySelectorAll(selector)].find(el => el.checkVisibility())
      const body = dialog.querySelector('.el-dialog__body'), form = body.querySelector('.accessory-form')
      const sections = [...form.querySelectorAll(':scope > .tf-query-modal-section')]
      const first = sections[0].getBoundingClientRect(), last = sections.at(-1).getBoundingClientRect()
      const formRect = form.getBoundingClientRect(), bodyStyle = getComputedStyle(body)
      const preview = body.querySelector('.profile-correction-preview')
      return { title: dialog.querySelector('.el-dialog__title').textContent.trim(),
        padding: [bodyStyle.paddingTop, bodyStyle.paddingRight, bodyStyle.paddingBottom, bodyStyle.paddingLeft],
        edges: [first.left - formRect.left, formRect.right - first.right, first.top - formRect.top, formRect.bottom - last.bottom],
        gaps: sections.slice(1).map((section, index) => section.getBoundingClientRect().top - sections[index].getBoundingClientRect().bottom),
        headings: [...form.querySelectorAll('[role="heading"]')].map(heading => ({ text: heading.textContent.trim(), height: heading.getBoundingClientRect().height,
          color: getComputedStyle(heading).color })),
        labels: [...form.querySelectorAll('.el-form-item__label')].map(label => getComputedStyle(label).color),
        surfaces: sections.map(section => getComputedStyle(section).backgroundImage.match(/rgba?\([^)]+\)/g)),
        preview: preview ? { surface: getComputedStyle(preview).backgroundColor,
          colors: [...preview.querySelectorAll('span')].map(element => getComputedStyle(element).color) } : null,
        count: sections.length, formFits: form.scrollWidth <= form.clientWidth + 1,
        overflow: document.documentElement.scrollWidth > innerWidth + 1 }
    }, dialogSelector)
    assert.equal(layout.title, expectedTitle)
    assert.deepEqual(layout.padding, ['0px', '0px', '0px', '0px'])
    assert.equal(layout.edges.every(edge => Math.abs(edge) <= 1), true, JSON.stringify(layout))
    assert.equal(layout.gaps.every(gap => gap >= 12), true, JSON.stringify(layout))
    assert.equal(layout.headings.every(heading => heading.height > 0 && heading.height < 48), true, JSON.stringify(layout))
    assert.equal(layout.headings[0].text, '基本信息'); assert.equal(layout.headings.at(-1).text, '备注信息')
    assert.equal(layout.count, expectedSections); assert.equal(layout.formFits, true); assert.equal(layout.overflow, false)
    const luminance = color => {
      const [r, g, b] = color.match(/[\d.]+/g).slice(0, 3).map(channel => {
        const value = Number(channel) / 255
        return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
      })
      return r * 0.2126 + g * 0.7152 + b * 0.0722
    }
    for (const colors of layout.surfaces) for (const surface of colors) {
      const background = luminance(surface)
      for (const color of [...layout.headings.map(heading => heading.color), ...layout.labels]) {
        const text = luminance(color), contrast = (Math.max(background, text) + 0.05) / (Math.min(background, text) + 0.05)
        assert.ok(contrast >= 4.5, `分区文字对比度不足：${color} / ${surface} = ${contrast}`)
      }
    }
    if (layout.preview) for (const color of layout.preview.colors) {
      const background = luminance(layout.preview.surface), text = luminance(color)
      const contrast = (Math.max(background, text) + 0.05) / (Math.min(background, text) + 0.05)
      assert.ok(contrast >= 4.5, `档案对照文字对比度不足：${color} / ${layout.preview.surface} = ${contrast}`)
    }
    await assertPublicButtons()
  }
  if ((!templateSearchOnly || correctionsOnly) && !pageActionsOnly) {
    for (const width of [1440, 834, 390, 320]) for (const theme of ['light', 'dark']) {
      await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: theme }])
      await page.setViewport({ width, height: 932, isMobile: width < 768, hasTouch: true })
      await page.evaluate(async theme => {
        document.documentElement.dataset.theme = theme
        window.fixtureScenario = 'plain'; window.fixtureProfile = { purchase_cost: 0 }; window.fixtureHoldCorrection = true; window.fixtureWrites = []; window.fixtureReads = []
        await window.renderMobileCase('views/accessories/AccessoriesView.vue')
      }, theme)
      await openEditor(width, false)
      await page.waitForSelector(`${dialogSelector} .section-loading`, { visible: true })
      await settleLayout()
      const loading = await page.evaluate(selector => {
        const dialog = document.querySelector(selector), section = dialog.querySelector('.tf-query-modal-section')
        const loader = section.querySelector('.section-loading'), item = section.querySelector('.el-form-item')
        const label = item.querySelector('.el-form-item__label').getBoundingClientRect()
        const select = item.querySelector('.el-select').getBoundingClientRect()
        const rect = loader.getBoundingClientRect(), style = getComputedStyle(section)
        return { label: item.querySelector('.el-form-item__label').textContent.trim(),
          inline: label.right <= select.left + 1 && label.top < select.bottom && select.top < label.bottom,
          full: Math.abs(rect.width - (section.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight))) < 2,
          height: rect.height, form: Boolean(dialog.querySelector('.accessory-form')),
          overflow: document.documentElement.scrollWidth > innerWidth + 1 }
      }, dialogSelector)
      assert.equal(loading.label, '历史入库批次'); assert.equal(loading.inline, true)
      assert.equal(loading.full, true); assert.ok(loading.height >= 72 && loading.height < 132)
      assert.equal(loading.form, false); assert.equal(loading.overflow, false)
      if (screenshotDirectory) await page.screenshot({ path: join(screenshotDirectory, `stock-loading-${width}-${theme}.png`), fullPage: true })
      await page.evaluate(() => window.fixtureReleaseCorrection())
      await page.waitForSelector(`${dialogSelector} .accessory-form`, { visible: true })
      await settleLayout()
      assert.equal(await page.$(`${dialogSelector} .section-loading`), null)
      await assertLayout()
      await assertEditorAppearance(2, '编辑商品库存')
      if (screenshotDirectory) await page.screenshot({ path: join(screenshotDirectory, `stock-${width}-${theme}.png`), fullPage: true })
      const supplier = await page.evaluateHandle(selector => [...document.querySelectorAll(`${selector} .el-form-item`)]
        .find(el => el.querySelector('.el-form-item__label')?.textContent.trim() === '供应商').querySelector('.el-select'), dialogSelector)
      await supplier.click(); await supplier.dispose()
      await settleLayout()
      await clickButton('.el-select-dropdown__item', '更正供应商')
      const quantity = await page.evaluate(selector => {
        const cost = [...document.querySelectorAll(`${selector} .el-form-item`)].find(el => el.querySelector('.el-form-item__label')?.textContent.trim() === '进价').querySelector('input')
        cost.value = '12.5'; cost.dispatchEvent(new Event('input', { bubbles: true })); cost.dispatchEvent(new Event('change', { bubbles: true })); cost.blur()
        const item = [...document.querySelectorAll(`${selector} .el-form-item`)].find(el => el.querySelector('.el-form-item__label')?.textContent.trim() === '入库总数')
        const input = item.querySelector('input'); const before = input.value
        input.value = '5'; input.dispatchEvent(new Event('input', { bubbles: true })); input.dispatchEvent(new Event('change', { bubbles: true })); input.blur()
        return before
      }, dialogSelector)
      assert.equal(quantity, '50')
      await clickButton(`${dialogSelector} button`, '保存更正')
      await page.waitForFunction('window.fixtureWrites.length === 1', { timeout: 10000 }).catch(async error => {
        const reason = await page.evaluate(() => ({ notices: window.fixtureNotices, unknown: window.fixtureUnknown,
          validation: [...document.querySelectorAll('.accessory-dialog .el-form-item__error')].map(el => el.textContent),
          buttons: [...document.querySelectorAll('.accessory-dialog button')].filter(el => /保存|重试/.test(el.textContent)).map(el => ({ text: el.textContent.trim(), disabled: el.disabled })) }))
        throw new Error(`${width}px ${theme} 未提交更正：${JSON.stringify(reason)}`, { cause: error })
      })
      const payload = await page.evaluate(() => window.fixtureWrites[0].payload)
      assert.equal(payload.total_quantity, 5); assert.equal(Number(payload.purchase_cost), 12.5); assert.equal(payload.supplier_id, 2)
      assert.equal('name' in payload, false)
      await page.waitForFunction('window.fixtureNotices.some(notice => notice.kind === "success")')
      assert.deepEqual(await page.evaluate(() => window.fixtureUnknown), [])
      await page.waitForFunction(() => !document.querySelector('.accessory-dialog')?.checkVisibility())
      await page.waitForFunction(() => document.querySelector('.data-table').textContent.includes('¥12.5'))
      await page.evaluate(async () => { await window.renderMobileCase('views/accessories/AccessoriesView.vue') })
      await page.waitForFunction(() => document.querySelector('.data-table')?.textContent.includes('¥12.5'))
      recordResult(`${width}px ${theme} 批次同行、紧凑Loading、0→12.5及刷新回显`)
    }
    if (!correctionsOnly) {
      for (const width of [1440, 834, 390, 320]) for (const theme of ['light', 'dark']) {
        await page.setViewport({ width, height: 932, isMobile: width < 768, hasTouch: true })
        await page.evaluate(async theme => {
          document.documentElement.dataset.theme = theme
          window.fixtureWrites = []; window.fixtureReads = []
          await window.renderMobileCase('views/accessories/AccessoriesView.vue')
        }, theme)
        await page.waitForSelector('.data-table .el-table__row')
        if (width <= 767) {
          const cell = await page.$('.data-table .el-table__row td')
          await cell.tap(); await cell.tap(); await cell.dispose()
          await clickButton('.accessory-details-dialog button', '编辑档案')
        } else await clickButton('.data-table button', '编辑档案')
        await page.waitForSelector('.profile-correction-preview', { visible: true })
        await settleLayout()
        await assertEditorAppearance(2, '编辑商品档案')
        assert.equal(await page.$eval('.profile-correction-preview', el => el.scrollWidth <= el.clientWidth + 1), true)
        const brand = await page.evaluateHandle(selector => [...document.querySelectorAll(`${selector} .el-form-item`)]
          .find(el => el.querySelector('.el-form-item__label')?.textContent.trim() === '配件品牌').querySelector('.el-select'), dialogSelector)
        await brand.click(); await brand.dispose(); await settleLayout()
        await clickButton('.el-select-dropdown__item', '更正品牌')
        await page.waitForFunction(() => [...document.querySelectorAll('.profile-correction-preview__row')]
          .some(el => el.textContent.includes('演示品牌') && el.textContent.includes('更正品牌')))
        await settleLayout()
        await assertEditorAppearance(2, '编辑商品档案')
        if (screenshotDirectory) await page.screenshot({ path: join(screenshotDirectory, `profile-edit-${width}-${theme}.png`), fullPage: true })
        await clickButton(`${dialogSelector} button`, '保存档案')
        await page.waitForFunction('window.fixtureWrites.length === 1')
        const write = await page.evaluate(() => window.fixtureWrites[0])
        assert.equal(write.url, '/accessories/55'); assert.equal(write.payload.brand_id, 2)
        for (const key of ['purchase_cost', 'supplier_id', 'total_quantity', 'serial_numbers']) assert.equal(key in write.payload, false)
        assert.equal(await page.evaluate(() => window.fixtureReads.some(url => url.includes('/stock-in-options'))), false)
        assert.deepEqual(await page.evaluate(() => window.fixtureUnknown), [])
        recordResult(`${width}px ${theme} 商品档案更正及品牌对照`)
      }
      for (const width of [1440, 390]) {
        await page.setViewport({ width, height: 932, isMobile: width < 768, hasTouch: true })
        await page.evaluate(async () => {
          window.fixtureScenario = 'link'; window.fixtureProfile = {}; window.fixtureWrites = []; window.fixtureReads = []
          await window.renderMobileCase('views/accessories/AccessoriesView.vue')
        })
        await page.waitForSelector('.data-table .el-table__row')
        if (width < 768) {
          const cell = await page.$('.data-table .el-table__row td')
          await cell.tap(); await cell.tap(); await cell.dispose()
          await clickButton('.accessory-details-dialog button', '编辑档案')
        } else await clickButton('.data-table button', '编辑档案')
        await page.waitForSelector('.profile-correction-preview', { visible: true })
        const setInput = async (placeholder, value) => {
          const input = await page.$(`${dialogSelector} [placeholder="${placeholder}"]`)
          await input.focus(); await input.evaluate(el => el.select()); await input.press('Backspace'); await input.type(value); await input.dispose()
        }
        await setInput('请输入商品名称', '库存更正名称')
        await setInput('厂家型号，可不填', 'PROFILE-PD')
        await setInput('请输入备注信息（可选）', '共享备注')
        await clickButton(`${dialogSelector} button`, '保存档案')
        await page.waitForFunction('window.fixtureWrites.length === 1')
        await clickButton('[role="tab"]', '商品模板')
        await openEditor(width)
        await assertEditorAppearance(2, '编辑商品模板')
        assert.equal(await page.$eval(`${dialogSelector} [placeholder="请输入商品名称"]`, el => el.value), '库存更正名称')
        assert.equal(await page.$eval(`${dialogSelector} [placeholder="厂家型号，可不填"]`, el => el.value), 'PROFILE-PD')
        assert.equal(await page.$eval(`${dialogSelector} [placeholder="请输入备注信息（可选）"]`, el => el.value), '共享备注')
        await setInput('请输入商品名称', '模板更正名称')
        await setInput('厂家型号，可不填', 'TEMPLATE-PD')
        await setInput('请输入备注信息（可选）', '模板共享备注')
        await clickButton(`${dialogSelector} button`, '保存模板')
        await page.waitForFunction('window.fixtureWrites.length === 2')
        await clickButton('[role="tab"]', '商品库存')
        await page.waitForFunction(() => document.querySelector('.data-table').textContent.includes('模板更正名称'))
        assert.equal(await page.evaluate(() => window.fixtureProfile.product_model), 'TEMPLATE-PD')
        assert.equal(await page.evaluate(() => window.fixtureProfile.remarks), '模板共享备注')
        assert.deepEqual(await page.evaluate(() => window.fixtureUnknown), [])
        recordResult(`${width}px 库存档案与模板双向保存及回显`)
      }
      await page.evaluate(() => { window.fixtureProfile = {} })
      for (const width of [1440, 390]) {
        await page.setViewport({ width, height: 932, isMobile: width < 768, hasTouch: true })
        await page.evaluate(async () => { window.fixtureScenario = 'serial'; window.fixtureWrites = []; await window.renderMobileCase('views/accessories/AccessoriesView.vue') })
        await openEditor(width)
        await assertEditorAppearance(3, '编辑商品库存')
        assert.deepEqual(await page.$$eval(`${dialogSelector} [data-serial-row] input`, inputs => inputs.map(input => input.value)), ['SN-A', 'SN-B'])
        await clickButton(`${dialogSelector} button`, '移除')
        await clickButton(`${dialogSelector} button`, '保存更正')
        await page.waitForFunction('window.fixtureWrites.length === 1')
        const payload = await page.evaluate(() => window.fixtureWrites[0].payload)
        assert.equal(payload.serial_tracking, 1); assert.equal(payload.total_quantity, 1)
        assert.deepEqual(payload.serial_numbers, [{ serial_number: 'SN-B', store_id: 1 }])
        assert.deepEqual(await page.evaluate(() => window.fixtureUnknown), [])
        recordResult(`${width}px SN回填及逐件更正`)
      }
    }
  }
  if (modelSummaryOnly) for (const width of [1440, 768, 390, 320]) for (const theme of ['light', 'dark']) for (const title of ['商品库存', '商品模板']) {
    await page.setViewport({ width, height: 932, isMobile: width < 768, hasTouch: width < 768 })
    await page.evaluate(async theme => {
      document.documentElement.dataset.theme = theme
      window.fixtureScenario = 'model-summary'; window.fixtureWrites = []
      await window.renderMobileCase('views/accessories/AccessoriesView.vue')
    }, theme)
    await clickButton('button', title)
    await page.waitForFunction(() => document.querySelectorAll('.accessory-model-summary').length === 3)
    await settleLayout()
    assert.deepEqual(await page.$$eval('.accessory-model-summary', items => items.map(item => item.textContent.trim())), ['通用', '苹果 / 华为', '苹果'])
    for (const index of [1, 2]) {
      const targets = await page.$$('.accessory-model-summary')
      const target = targets[index]
      await target.evaluate(el => el.scrollIntoView({ block: 'center', inline: 'center' }))
      await settleLayout()
      if (width < 768) await target.tap()
      else { await page.mouse.move(0, 0); await target.hover() }
      await page.waitForFunction(index => [...document.querySelectorAll('[role="tooltip"]')].some(el => el.checkVisibility() && el.textContent.includes(index === 1 ? '华为 Mate 80' : '代际 40 Pro Max')), {}, index).catch(async error => {
        const context = await target.evaluate(el => {
          const rect = el.getBoundingClientRect()
          return { text: el.textContent, touch: 'ontouchend' in document, pointerEvents: getComputedStyle(el).pointerEvents,
            hovered: el.matches(':hover'), pointed: document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2)?.outerHTML,
            tips: [...document.querySelectorAll('[role="tooltip"]')].map(tip => ({ text: tip.textContent, visible: tip.checkVisibility() })) }
        })
        throw new Error(`${width}px ${theme} ${title}适配型号提示未显示：${JSON.stringify(context)}`, { cause: error })
      })
      await settleLayout()
      const layout = await page.evaluate(() => {
        const tip = [...document.querySelectorAll('[role="tooltip"]')].find(el => el.checkVisibility())
        const rect = tip.getBoundingClientRect()
        const scrolls = tip.scrollHeight > tip.clientHeight
        if (scrolls) tip.scrollTop = tip.scrollHeight
        return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom,
          overflow: document.documentElement.scrollWidth > innerWidth + 1, fits: tip.scrollWidth <= tip.clientWidth + 1,
          canScroll: !scrolls || tip.scrollTop > 0 }
      })
      assert.equal(layout.overflow, false); assert.equal(layout.fits, true)
      assert.equal(layout.canScroll, true)
      assert.ok(layout.left >= 0 && layout.right <= width + 1)
      assert.ok(layout.top >= 0 && layout.bottom <= 933)
      if (screenshotDirectory) await page.screenshot({ path: join(screenshotDirectory, `model-summary-${title}-${width}-${theme}-${index}.png`), fullPage: true })
      if (width < 768) await page.touchscreen.tap(width / 2, 1)
      else { await page.mouse.move(0, 0); await target.evaluate(el => el.blur()) }
      await page.waitForFunction(() => ![...document.querySelectorAll('[role="tooltip"]')].some(el => el.checkVisibility()))
      for (const handle of targets) await handle.dispose()
      await settleLayout()
    }
    assert.deepEqual(await page.evaluate(() => window.fixtureWrites), [])
    assert.deepEqual(await page.evaluate(() => window.fixtureUnknown), [])
    recordResult(`${width}px ${theme} ${title}适配品牌摘要、完整型号${width < 768 ? '触摸' : '悬停'}及长内容边界`)
  }
  // 真实商品下拉：远程检索、跨页、同名规格区分及手机完整换行，禁止提交业务。
  if (!pageActionsOnly && !templateColorsOnly && !filtersOnly && !modelSummaryOnly && !correctionsOnly) for (const width of [1440, 768, 390, 320]) for (const theme of ['light', 'dark']) {
    await page.setViewport({ width, height: 932, isMobile: width < 768, hasTouch: width < 768 })
    await page.evaluate(async theme => {
      document.documentElement.dataset.theme = theme
      window.fixtureScenario = 'template-search'; window.fixtureWrites = []; window.fixtureTemplateReads = []
      await window.renderMobileCase('views/accessories/AccessoriesView.vue')
    }, theme)
    await clickButton('button', '入库')
    await page.waitForSelector(`${dialogSelector} .accessory-form`, { visible: true })
    await settleLayout()
    await assertEditorAppearance(2)
    if (screenshotDirectory) await page.screenshot({ path: join(screenshotDirectory, `stock-in-${width}-${theme}.png`), fullPage: true })
    const selector = await page.evaluateHandle(dialogSelector => [...document.querySelectorAll(`${dialogSelector} .el-form-item`)]
      .find(el => el.querySelector('.el-form-item__label')?.textContent.trim() === '商品名称').querySelector('.el-select'), dialogSelector)
    await selector.click(); await selector.dispose()
    await page.waitForFunction('window.fixtureTemplateReads.length > 0')
    await page.waitForFunction(() => [...document.querySelectorAll('.tf2025-form-popper')].some(el => el.checkVisibility() && el.textContent.includes('已显示 20 / 121')))
    await settleLayout()
    await page.evaluate(() => {
      const popper = [...document.querySelectorAll('.tf2025-form-popper')].find(el => el.checkVisibility())
      const wrap = popper.querySelector('.el-select-dropdown__wrap')
      wrap.scrollTop = wrap.scrollHeight - wrap.clientHeight
      wrap.dispatchEvent(new Event('scroll'))
    })
    await page.waitForFunction(() => [...document.querySelectorAll('.tf2025-form-popper')].some(el => el.checkVisibility() && el.textContent.includes('已显示 40 / 121'))).catch(async error => {
      const context = await page.evaluate(() => ({ reads: window.fixtureTemplateReads,
        poppers: [...document.querySelectorAll('.tf2025-form-popper')].filter(el => el.checkVisibility()).map(el => {
          const wrap = el.querySelector('.el-select-dropdown__wrap')
          return { footer: el.querySelector('.el-select-dropdown__footer')?.textContent,
            top: wrap?.scrollTop, height: wrap?.clientHeight, contentHeight: wrap?.scrollHeight }
        }) }))
      throw new Error(`商品下拉触底未读取第二页：${JSON.stringify(context)}`, { cause: error })
    })
    const keyword = '充电头 20w-pro'
    const input = await page.evaluateHandle(dialogSelector => [...document.querySelectorAll(`${dialogSelector} .el-form-item`)]
      .find(el => el.querySelector('.el-form-item__label')?.textContent.trim() === '商品名称').querySelector('input'), dialogSelector)
    await input.focus(); await input.evaluate(el => el.select()); await input.press('Backspace'); await input.type(keyword); await input.dispose()
    await page.waitForFunction(keyword => window.fixtureTemplateReads.at(-1)?.search === keyword, {}, keyword)
    await page.waitForFunction(() => [...document.querySelectorAll('.tf2025-form-popper')].some(el => el.checkVisibility() && el.textContent.includes('已显示 1 / 1')))
    await settleLayout()
    await page.waitForFunction(() => [...document.querySelectorAll('.tf2025-form-popper')].some(el =>
      el.checkVisibility() && getComputedStyle(el).opacity === '1' && !el.className.includes('enter-')))
    const layout = await page.evaluate(() => {
      const popper = [...document.querySelectorAll('.tf2025-form-popper')].find(el => el.checkVisibility())
      const option = popper.querySelector('.el-select-dropdown__item'), rect = popper.getBoundingClientRect()
      const text = option.textContent
      return { inside: rect.left >= -1 && rect.right <= innerWidth + 1,
        optionFits: option.scrollWidth <= option.clientWidth + 1,
        noOverlap: [...option.querySelectorAll('strong,span')].every(el => el.getBoundingClientRect().bottom <= option.getBoundingClientRect().bottom + 1),
        text, options: popper.querySelectorAll('.el-select-dropdown__item').length,
        overflow: document.documentElement.scrollWidth > innerWidth + 1 }
    })
    assert.equal(layout.inside, true); assert.equal(layout.optionFits, true); assert.equal(layout.noOverlap, true)
    assert.equal(layout.overflow, false); assert.equal(layout.options, 1)
    for (const text of ['USB-C 20W-PRO', '白色', 'iPhone 17', '零售 ¥39/个', '默认SN管理']) assert.equal(layout.text.includes(text), true, text)
    if (screenshotDirectory) await page.screenshot({ path: join(screenshotDirectory, `template-search-${width}-${theme}.png`), fullPage: true })
    const option = await page.evaluateHandle(() => [...document.querySelectorAll('.tf2025-form-popper .el-select-dropdown__item')].find(el => el.checkVisibility()))
    await option.click(); await option.dispose()
    await page.waitForFunction(dialogSelector => document.querySelector(`${dialogSelector} [placeholder="厂家型号，可不填"]`)?.value === 'USB-C 20W-PRO', {}, dialogSelector)
    assert.equal(await page.evaluate(dialogSelector => document.querySelector(dialogSelector).textContent.includes('SN序列号录入（0 件）'), dialogSelector), true)
    await settleLayout()
    await assertEditorAppearance(3)
    assert.deepEqual(await page.evaluate(() => window.fixtureWrites), [])
    assert.deepEqual(await page.evaluate(() => window.fixtureUnknown), [])
    recordResult(`${width}px ${theme} 名称检索/分页/同名规格及SN回填`)
  }
  if (filtersOnly) for (const width of [1440, 768, 390, 320]) for (const theme of ['light', 'dark']) {
    await page.setViewport({ width, height: 932, isMobile: width < 768, hasTouch: width < 768 })
    await page.evaluate(async theme => {
      document.documentElement.dataset.theme = theme
      window.fixtureScenario = 'list-filters'; window.fixtureListReads = []; window.fixtureWrites = []
      await window.renderMobileCase('views/accessories/AccessoriesView.vue')
    }, theme)
    await page.waitForSelector('.unified-search-panel input[aria-label="商品名称"]')
    const fillFilter = async (label, value) => {
      const input = await page.$(`.unified-search-panel input[aria-label="${label}"]`)
      assert.ok(input, `缺少${label}筛选`)
      await input.click(); await input.type(value); await input.dispose()
    }
    const pickFilter = async (label, value) => {
      await settleLayout()
      await page.click(`.unified-search-panel [aria-label="${label}"]`)
      await settleLayout()
      try { await clickButton('.el-select-dropdown__item', value) }
      catch (error) {
        if (screenshotDirectory) await page.screenshot({ path: join(screenshotDirectory, `failed-filter-${width}-${theme}.png`), fullPage: true })
        const choices = await page.$$eval('.el-select-dropdown__item', items => items.filter(item => item.checkVisibility()).map(item => item.textContent.trim()))
        throw new Error(`${width}px ${theme} ${label}缺少${value}选项：${JSON.stringify(choices)}`, { cause: error })
      }
      await page.waitForFunction(label => document.querySelector(`.unified-search-panel [aria-label="${label}"]`)?.getAttribute('aria-expanded') === 'false', {}, label)
      await settleLayout()
    }
    for (const [mode, title] of [['inventory', '商品库存'], ['templates', '商品模板']]) {
      if (mode === 'templates') { await clickButton('[role="tab"]', title); await settleLayout() }
      const header = await page.$eval('.admin-table-panel .section-title', section => {
        const tabs = section.querySelector('[aria-label="商品管理模式"]')
        const bounds = section.getBoundingClientRect(), tabBounds = tabs.getBoundingClientRect()
        return {
          title: section.querySelector('.section-title__label').textContent.trim(),
          active: tabs.querySelector('[aria-selected="true"]').textContent.trim(),
          count: section.querySelector('.record-count').textContent.trim(),
          fits: tabBounds.left >= bounds.left - 1 && tabBounds.right <= bounds.right + 1 && tabs.scrollWidth <= tabs.clientWidth + 1
        }
      })
      assert.equal(header.title, `${title}列表`)
      assert.equal(header.active, title)
      assert.match(header.count, /^共 \d+ 条$/)
      assert.equal(header.fits, true)
      const headings = await page.$$eval('.el-table__header-wrapper th', items => items.map(item => item.textContent.trim()))
      assert.equal(headings.includes('商品名称'), true)
      if (mode === 'inventory') assert.equal(headings.includes('品牌'), true)
      const expanded = await page.$('.unified-search-panel__form.is-expanded')
      if (!expanded) await page.click('.unified-search-panel', { offset: { x: 4, y: 4 } })
      await settleLayout()
      await fillFilter('商品名称', '充电器')
      await fillFilter('适配型号', 'iPhone-17')
      await pickFilter('商品类型', '充电器'); await pickFilter('品牌', '演示品牌'); await pickFilter('颜色', '白色')
      await pickFilter('状态', '停用')
      await clickButton('.unified-search-panel button', '搜索')
      await page.waitForFunction(mode => {
        const query = window.fixtureListReads.at(-1)
        return query?.mode === mode && query.search === '充电器' && query.category === '充电器' && query.brand_id === 1 &&
          query.model_name === 'iPhone-17' && query.color_id === 1 && query.page === 1 && query.status === 0
      }, {}, mode)
      const layout = await page.evaluate(() => {
        const panel = document.querySelector('.unified-search-panel'), rect = panel.getBoundingClientRect()
        const status = panel.querySelector('[aria-label="状态"]').getBoundingClientRect()
        return { overflow: document.documentElement.scrollWidth > innerWidth + 1, panelFits: panel.scrollWidth <= panel.clientWidth + 1,
          statusFits: status.left >= 0 && status.right <= innerWidth + 1,
          controls: [...panel.querySelectorAll('.el-input, .el-select')].filter(el => el.checkVisibility()).map(el => {
            const item = el.getBoundingClientRect(); return item.left >= rect.left - 1 && item.right <= rect.right + 1
          }) }
      })
      assert.equal(layout.overflow, false); assert.equal(layout.panelFits, true); assert.equal(layout.statusFits, true); assert.equal(layout.controls.every(Boolean), true)
      if (screenshotDirectory) await page.screenshot({ path: join(screenshotDirectory, `filters-${mode}-${width}-${theme}.png`), fullPage: true })
      await clickButton('.unified-search-panel button', '重置')
      await page.waitForFunction(mode => {
        const query = window.fixtureListReads.at(-1)
        return query?.mode === mode && query.page === 1 && query.status === (mode === 'inventory' ? 1 : 'all') &&
          ['search','category','brand_id','model_name','color_id'].every(key => query[key] === undefined)
      }, {}, mode)
      recordResult(`${width}px ${theme} ${title}五项筛选/独立状态/重置及公共响应式布局`)
    }
    assert.deepEqual(await page.evaluate(() => window.fixtureWrites), [])
    assert.deepEqual(await page.evaluate(() => window.fixtureUnknown), [])
  }
  // 一个模板多颜色：实际组件完成逐色条码填写及具体颜色入库，写入只在内存中模拟。
  if (!pageActionsOnly && (!templateSearchOnly || templateColorsOnly)) for (const width of [1440, 768, 390, 320]) for (const theme of ['light', 'dark']) {
    await page.setViewport({ width, height: 932, isMobile: width < 768, hasTouch: width < 768 })
    await page.evaluate(async theme => {
      document.documentElement.dataset.theme = theme
      window.fixtureScenario = 'template-colors'; window.fixtureWrites = []
      window.fixtureProfile = {}; window.fixtureColorTemplate = structuredClone(window.fixtureInitialColorTemplate)
      window.fixtureOptions.colors = [{ id: 1, name: '白色' }, { id: 2, name: '黑色' }]
      await window.renderMobileCase('views/accessories/AccessoriesView.vue')
    }, theme)
    const pick = async (label, option, multiple = false) => {
      await settleLayout()
      const selector = `${dialogSelector} [aria-label="${label}"]`
      await page.waitForFunction(selector => [...document.querySelectorAll(selector)].some(el=>el.checkVisibility()), {}, selector)
      const expanded = await page.$$eval(selector, inputs => inputs.find(input => input.checkVisibility())?.getAttribute('aria-expanded') === 'true')
      if (!expanded) {
        const select = (await page.evaluateHandle(selector => {
          return [...document.querySelectorAll(selector)].find(input => input.checkVisibility())
        }, selector)).asElement()
        assert.ok(select, `缺少选择器 ${label}；${JSON.stringify(await page.evaluate(selector => ({
          dialogs: [...document.querySelectorAll(selector)].filter(el=>el.checkVisibility()).map(el=>({ title:el.querySelector('.el-dialog__title')?.textContent,
            labels:[...el.querySelectorAll('.el-form-item__label')].map(label=>label.textContent.trim()) })),notices:window.fixtureNotices,unknown:window.fixtureUnknown
        }),dialogSelector))}`)
        await select.click(); await select.dispose()
      }
      await page.waitForFunction(selector => [...document.querySelectorAll(selector)].some(input => input.checkVisibility() && input.getAttribute('aria-expanded') === 'true'), {}, selector)
      await settleLayout()
      await clickButton('.el-select-dropdown__item', option).catch(async error => {
        const choices = await page.$$eval('.el-select-dropdown__item', items => items.filter(item => item.checkVisibility()).map(item => item.textContent.trim()))
        throw new Error(`${label}缺少候选 ${option}；当前可见候选：${JSON.stringify(choices)}`, { cause: error })
      })
      if (multiple) {
        const title = (await page.evaluateHandle(selector => [...document.querySelectorAll(`${selector} .el-dialog__title`)].find(title => title.checkVisibility()), dialogSelector)).asElement()
        assert.ok(title, '缺少可见弹窗标题')
        await title.click(); await title.dispose()
      }
      await page.waitForFunction(selector => [...document.querySelectorAll(selector)].some(input => input.checkVisibility() && input.getAttribute('aria-expanded') === 'false'), {}, selector)
      await settleLayout()
    }
    const fill = async (selector, value) => {
      await page.waitForSelector(`${dialogSelector} ${selector}`, { visible: true })
      const input = (await page.evaluateHandle(selector => [...document.querySelectorAll(selector)].find(input => input.checkVisibility()), `${dialogSelector} ${selector}`)).asElement()
      assert.ok(input, selector); await input.click()
      const length = await input.evaluate(input => input.value.length)
      for (let index = 0; index < length; index++) await input.press('ArrowRight')
      for (let index = 0; index < length; index++) await input.press('Backspace')
      assert.equal(await input.evaluate(input => input.value), '', `未能清空输入 ${selector}`)
      await input.type(value); await input.dispose()
    }
    const pickField = async (label, value) => {
      await settleLayout()
      const select = await page.evaluateHandle(({ dialogSelector, label }) => [...document.querySelectorAll(`${dialogSelector} .el-form-item`)]
        .find(el => el.querySelector('.el-form-item__label')?.textContent.trim() === label).querySelector('.el-select'), { dialogSelector, label })
      await select.click(); await select.dispose(); await clickButton('.el-select-dropdown__item', value)
    }
    const chooseColorTemplate = async () => {
      const name = await page.$(`${dialogSelector} [aria-label="按商品名称选择模板"]`)
      await name.click(); await name.dispose()
      await page.waitForFunction(() => [...document.querySelectorAll('.tf2025-form-popper')].some(el => el.checkVisibility() && getComputedStyle(el).opacity === '1' && el.textContent.includes('多色充电器')))
      await settleLayout()
      const option = await page.evaluateHandle(() => [...document.querySelectorAll('.tf2025-form-popper .el-select-dropdown__item')].find(el => el.checkVisibility() && el.textContent.includes('多色充电器')))
      await option.click(); await option.dispose()
    }
    await clickButton('button', '商品模版')
    await page.waitForSelector(`${dialogSelector} .accessory-form`, { visible: true })
    await fill('input[placeholder="请输入商品名称"]', '多色充电器')
    await pick('模板颜色（多选）', '白色', true)
    assert.equal(await page.$(`${dialogSelector} [aria-label="颜色与条形码"]`), null)
    await fill('input[aria-label="条形码"]', 'COLOR-W')
    await pick('模板颜色（多选）', '黑色', true)
    assert.equal(await page.$eval(`${dialogSelector} [aria-label="白色条形码"]`, input => input.value), 'COLOR-W')
    await fill('input[aria-label="白色条形码"]', 'COLOR-W')
    await fill('input[aria-label="黑色条形码"]', 'COLOR-B')
    // 其他公共资料通过真实下拉选择。
    for (const [label, value] of [['商品类型', '充电器'], ['单位', '个']]) {
      await pickField(label, value)
    }
    await settleLayout(); await assertEditorAppearance(2, '商品模板')
    assert.equal(await page.$(`${dialogSelector} [aria-label="用于贴膜"]`), null)
    const freeFilmSwitch = `${dialogSelector} [aria-label="免费专用"][role="switch"]`
    assert.equal(await page.$eval(freeFilmSwitch, el => el.getAttribute('aria-checked')), 'false')
    await page.click(`${dialogSelector} .el-switch:has([aria-label="免费专用"])`)
    assert.equal(await page.$eval(freeFilmSwitch, el => el.getAttribute('aria-checked')), 'true')
    const freeFilmFits = await page.$eval(freeFilmSwitch, el => {
      const control = el.closest('.el-switch').getBoundingClientRect(), item = el.closest('.el-form-item').getBoundingClientRect()
      return control.left >= item.left && control.right <= item.right && control.right <= innerWidth
    })
    assert.equal(freeFilmFits, true, '免费专用开关应使用公共表单布局且不溢出')
    const fits = await page.$$eval(`${dialogSelector} [aria-label="颜色与条形码"] input`, inputs => inputs.every(input => {
      const rect = input.getBoundingClientRect(); return input.clientWidth >= 110 && rect.left >= 0 && rect.right <= innerWidth
    }))
    assert.equal(fits, true)
    const tagsFit = await page.$eval(`${dialogSelector} [aria-label="模板颜色（多选）"]`, input => {
      const select = input.closest('.el-select'), rect = select.getBoundingClientRect()
      return [...select.querySelectorAll('.el-tag')].every(tag => tag.getBoundingClientRect().bottom <= rect.bottom + 1)
    })
    assert.equal(tagsFit, true, '多选颜色标签不得遮挡下一行字段')
    if (screenshotDirectory) await page.screenshot({ path: join(screenshotDirectory, `template-colors-${width}-${theme}.png`), fullPage: true })
    await clickButton(`${dialogSelector} button`, '创建模板')
    await page.waitForFunction('window.fixtureWrites.length === 1')
    assert.deepEqual(await page.evaluate(() => window.fixtureWrites[0].payload.color_variants), [{ color_id: 1, barcode: 'COLOR-W' }, { color_id: 2, barcode: 'COLOR-B' }])
    assert.equal(await page.evaluate(() => window.fixtureWrites[0].payload.free_film), 1)
    assert.equal(await page.evaluate(() => 'film_enabled' in window.fixtureWrites[0].payload), false)
    await page.waitForFunction(selector => ![...document.querySelectorAll(selector)].some(el => el.checkVisibility()), {}, dialogSelector)
    await clickButton('button', '入库')
    await page.waitForSelector(`${dialogSelector} .accessory-form`, { visible: true })
    await chooseColorTemplate()
    await page.waitForSelector(`${dialogSelector} [aria-label="按颜色填写入库数量"]`, { visible: true })
    assert.equal(await page.$eval(`${dialogSelector} [aria-label="按颜色填写入库数量"]`, el => el.textContent.includes('COLOR-W') && el.textContent.includes('COLOR-B')), true)
    await fill('input[aria-label="白色入库数量"]', '10')
    await fill('input[aria-label="黑色入库数量"]', '20')
    await fill('input[aria-label="入库进价"]', '5')
    await fill('input[placeholder="请选择入库时间"]', '2026-11-14 15:30:25')
    const formHeading = await page.$(`${dialogSelector} .tf-query-modal-section-title`)
    await formHeading.click(); await formHeading.dispose()
    await settleLayout(); await assertEditorAppearance(3)
    assert.equal(await page.$eval(`${dialogSelector} [aria-label="颜色入库合计"]`, el => el.textContent.includes('30个') && el.textContent.includes('¥150')), true)
    const quantityFits = await page.$$eval(`${dialogSelector} .color-stock-item input`, inputs => inputs.every(input => {
      const rect = input.getBoundingClientRect(); return rect.width >= 90 && rect.left >= 0 && rect.right <= innerWidth
    }))
    assert.equal(quantityFits, true, '逐色数量须在窄屏完整可编辑')
    assert.equal(await page.$eval(`${dialogSelector} [aria-label="按商品名称选择模板"]`, select => select.closest('.el-select').textContent.includes('多色充电器')), true)
    if (screenshotDirectory) await page.screenshot({ path: join(screenshotDirectory, `template-stock-colors-${width}-${theme}.png`), fullPage: true })
    await pickField('供应商', '原供应商')
    await pickField('配件品牌', '演示品牌')
    await clickButton(`${dialogSelector} button`, '确认入库')
    await page.waitForFunction('window.fixtureWrites.length === 2')
    const purchase = await page.evaluate(() => window.fixtureWrites[1])
    assert.equal(purchase.url, '/accessories/stock-in')
    assert.deepEqual(purchase.payload.entries.map(row => [row.accessory_id,row.color_id,row.barcode,row.total_quantity,row.purchase_cost,row.supplier_id,row.brand_id,row.store_id]),
      [[201,1,'COLOR-W',10,5,1,1,1],[202,2,'COLOR-B',20,5,1,1,1]])
    assert.deepEqual(purchase.payload.entries.map(row=>row.inventory_time),['2026-11-14 15:30:25','2026-11-14 15:30:25'])
    assert.equal(purchase.payload.entries.every(row=>!Object.hasOwn(row,'color_variants')&&!Object.hasOwn(row,'request_key')),true)
    await page.waitForFunction(selector => ![...document.querySelectorAll(selector)].some(el => el.checkVisibility()), {}, dialogSelector)
    assert.deepEqual(await page.evaluate(() => window.fixtureUnknown), [])
    recordResult(`${width}px ${theme} 多颜色条码创建及逐色数量共价入库`)

    await clickButton('button', '入库')
    await page.waitForSelector(`${dialogSelector} .accessory-form`, { visible: true })
    await chooseColorTemplate()
    await page.waitForSelector(`${dialogSelector} [aria-label="按颜色填写入库数量"]`, { visible: true })
    await pickField('供应商', '原供应商')
    const snSwitch = await page.evaluateHandle(selector => document.querySelector(`${selector} [aria-label="SN管理"]`).closest('.el-switch'), dialogSelector)
    await snSwitch.click(); await snSwitch.dispose()
    await fill('textarea[aria-label="白色SN"]', '00WHITE-1\n00WHITE-2')
    await fill('textarea[aria-label="黑色SN"]', '00WHITE-1')
    assert.equal(await page.$eval(`${dialogSelector} [aria-label="按颜色填写入库数量"]`, el => el.textContent.includes('重复SN')), true)
    assert.equal(await page.$$eval(`${dialogSelector} button`, buttons=>buttons.find(button=>button.textContent.trim()==='确认入库').disabled),true)
    await fill('textarea[aria-label="黑色SN"]', '00BLACK-1')
    await settleLayout(); await assertEditorAppearance(3)
    if (screenshotDirectory) await page.screenshot({ path: join(screenshotDirectory, `template-stock-color-sn-${width}-${theme}.png`), fullPage: true })
    await page.evaluate(()=>{window.fixtureStockFailure=true})
    await clickButton(`${dialogSelector} button`, '确认入库')
    await page.waitForFunction('window.fixtureWrites.length === 3')
    await page.waitForFunction(selector=>[...document.querySelectorAll(`${selector} button`)].some(button=>button.textContent.trim()==='重试原入库'&&!button.disabled),{},dialogSelector)
    await clickButton(`${dialogSelector} button`, '取消')
    await page.waitForFunction(selector => ![...document.querySelectorAll(selector)].some(el => el.checkVisibility()), {}, dialogSelector)
    await clickButton('button', '入库')
    await page.waitForFunction(selector=>[...document.querySelectorAll(`${selector} button`)].some(button=>button.textContent.trim()==='重试原入库'&&!button.disabled),{},dialogSelector)
    await clickButton(`${dialogSelector} button`, '重试原入库')
    await page.waitForFunction('window.fixtureWrites.length === 4')
    const retries=await page.evaluate(()=>window.fixtureWrites.slice(2))
    assert.deepEqual(retries[0].payload,retries[1].payload)
    assert.deepEqual(retries[0].payload.entries.map(row=>[row.accessory_id,row.total_quantity,row.serial_numbers.map(serial=>serial.serial_number)]),
      [[201,2,['00WHITE-1','00WHITE-2']],[202,1,['00BLACK-1']]])
    await page.waitForFunction(selector => ![...document.querySelectorAll(selector)].some(el => el.checkVisibility()), {}, dialogSelector)
    recordResult(`${width}px ${theme} 逐色SN计数及中断后原组重试`)

    await page.evaluate(async () => {
      window.fixtureScenario = 'template-color-edit'; window.fixtureWrites = []
      window.fixtureProfile = { name: '旧白色充电器', barcode: 'OLD-W' }
      window.fixtureOptions.colors.push({ id: 3, name: '蓝色' })
      await window.renderMobileCase('views/accessories/AccessoriesView.vue')
    })
    await clickButton('[role="tab"]', '商品模板'); await openEditor(width)
    await pick('模板颜色（多选）', '黑色', true)
    assert.equal(await page.$eval(`${dialogSelector} [aria-label="白色条形码"]`, input => input.value), 'OLD-W')
    await fill('input[aria-label="黑色条形码"]', 'NEW-B')
    if (screenshotDirectory) await page.screenshot({ path: join(screenshotDirectory, `template-legacy-colors-${width}-${theme}.png`), fullPage: true })
    await clickButton(`${dialogSelector} button`, '保存模板')
    await page.waitForFunction('window.fixtureWrites.length === 1')
    const legacy = await page.evaluate(() => window.fixtureWrites[0])
    assert.equal(legacy.url, '/accessories/55')
    assert.deepEqual(legacy.payload.color_variants, [{ color_id: 1, barcode: 'OLD-W' }, { color_id: 2, barcode: 'NEW-B' }])
    assert.equal(Object.hasOwn(legacy.payload, 'color_id'), false); assert.equal(Object.hasOwn(legacy.payload, 'barcode'), false)
    await page.waitForFunction(selector => ![...document.querySelectorAll(selector)].some(el => el.checkVisibility()), {}, dialogSelector)
    recordResult(`${width}px ${theme} 旧模板编辑追加颜色并保留原条码`)

    await clickButton('[role="tab"]', '商品库存')
    const openProfileEditor = async () => {
      await page.waitForSelector('.data-table .el-table__row')
      if (width < 768) {
        const cell = await page.$('.data-table .el-table__row td')
        await cell.tap(); await cell.tap(); await cell.dispose()
        await clickButton('.accessory-details-dialog button', '编辑档案')
      } else await clickButton('.data-table button', '编辑档案')
      await page.waitForSelector(`${dialogSelector} .accessory-form`, { visible: true }); await settleLayout()
    }
    await openProfileEditor()
    assert.equal(await page.$eval(`${dialogSelector} [aria-label="黑色条形码"]`, input => input.value), 'NEW-B')
    await pick('模板颜色（多选）', '蓝色', true)
    await fill('input[aria-label="黑色条形码"]', 'BLACK-EDITED')
    await fill('input[aria-label="蓝色条形码"]', 'BLUE-NEW')
    if (screenshotDirectory) await page.screenshot({ path: join(screenshotDirectory, `template-profile-colors-${width}-${theme}.png`), fullPage: true })
    await clickButton(`${dialogSelector} button`, '保存档案')
    await page.waitForFunction('window.fixtureWrites.length === 2')
    const profile = await page.evaluate(() => window.fixtureWrites[1])
    assert.equal(profile.url, '/accessories/55'); assert.equal(profile.payload.brand_id, 1)
    assert.deepEqual(profile.payload.color_variants, [{ color_id: 1, barcode: 'OLD-W' }, { color_id: 2, barcode: 'BLACK-EDITED' }, { color_id: 3, barcode: 'BLUE-NEW' }])
    assert.equal(Object.hasOwn(profile.payload, 'color_id'), false); assert.equal(Object.hasOwn(profile.payload, 'barcode'), false)
    await page.waitForFunction(selector => ![...document.querySelectorAll(selector)].some(el => el.checkVisibility()), {}, dialogSelector)
    await openProfileEditor()
    assert.equal(await page.$eval(`${dialogSelector} [aria-label="黑色条形码"]`, input => input.value), 'BLACK-EDITED')
    assert.equal(await page.$eval(`${dialogSelector} [aria-label="蓝色条形码"]`, input => input.value), 'BLUE-NEW')
    await clickButton(`${dialogSelector} button`, '取消')
    await page.waitForFunction(selector => ![...document.querySelectorAll(selector)].some(el => el.checkVisibility()), {}, dialogSelector)
    assert.deepEqual(await page.evaluate(() => window.fixtureUnknown), [])
    recordResult(`${width}px ${theme} 商品档案多色维护及再次打开回显`)

    await page.evaluate(async () => {
      window.fixtureScenario = 'template-colors'; window.fixtureWrites = []; window.fixtureProfile = {}
      window.fixtureColorTemplate = structuredClone(window.fixtureInitialColorTemplate)
      window.fixtureColorTemplate.color_variants = window.fixtureColorTemplate.color_variants.slice(0, 1)
      await window.renderMobileCase('views/accessories/AccessoriesView.vue')
    })
    await clickButton('button', '入库')
    await page.waitForSelector(`${dialogSelector} .accessory-form`, { visible: true })
    await chooseColorTemplate()
    await page.waitForSelector(`${dialogSelector} input[aria-label="商品条形码"]`, { visible: true })
    assert.equal(await page.$(`${dialogSelector} [aria-label="按颜色填写入库数量"]`), null)
    assert.equal(await page.$eval(`${dialogSelector} input[aria-label="商品条形码"]`, input => input.value === 'COLOR-W' && input.readOnly), true)
    await fill('input[aria-label="入库总数"]', '6')
    await pickField('供应商', '原供应商')
    await settleLayout(); await assertEditorAppearance(2)
    if (screenshotDirectory) await page.screenshot({ path: join(screenshotDirectory, `template-single-color-${width}-${theme}.png`), fullPage: true })
    await clickButton(`${dialogSelector} button`, '确认入库')
    await page.waitForFunction('window.fixtureWrites.length === 1')
    const singleColor = await page.evaluate(() => window.fixtureWrites[0].payload)
    assert.equal(singleColor.accessory_id, 201); assert.equal(singleColor.color_id, 1)
    assert.equal(singleColor.barcode, 'COLOR-W'); assert.equal(singleColor.total_quantity, 6)
    assert.equal(Object.hasOwn(singleColor, 'entries'), false)
    await page.waitForFunction(selector => ![...document.querySelectorAll(selector)].some(el => el.checkVisibility()), {}, dialogSelector)
    assert.deepEqual(await page.evaluate(() => window.fixtureUnknown), [])
    recordResult(`${width}px ${theme} 单颜色上方数量与条码及对应颜色采购`)
  }
  // 模板编辑同步公共分区；历史失败仍显示原业务原因且不能保存。
  if (!templateSearchOnly && !pageActionsOnly) {
    for (const width of [1440, 834, 390, 320]) for (const theme of ['light', 'dark']) {
      await page.setViewport({ width, height: 932, isMobile: width < 768, hasTouch: true })
      await page.evaluate(async theme => {
        document.documentElement.dataset.theme = theme
        await window.renderMobileCase('views/accessories/AccessoriesView.vue')
      }, theme)
      await clickButton('[role="tab"]', '商品模板')
      await openEditor(width)
      await assertEditorAppearance(2, '编辑商品模板')
      if (screenshotDirectory) await page.screenshot({ path: join(screenshotDirectory, `template-edit-${width}-${theme}.png`), fullPage: true })
      await clickButton(`${dialogSelector} button`, '取消')
      assert.deepEqual(await page.evaluate(() => window.fixtureUnknown), [])
      recordResult(`${width}px ${theme} 模板编辑公共分区及按钮`)
    }
    await page.setViewport({ width: 1440, height: 932, isMobile: false, hasTouch: false })
    await page.evaluate(() => window.renderMobileCase('views/accessories/AccessoriesView.vue'))
    await clickButton('[role="tab"]', '商品模板')
    await clickButton('.data-table button', '编辑')
    await page.waitForFunction(() => [...document.querySelectorAll('.accessory-dialog')].some(el => el.textContent.includes('编辑商品模板')))
    assert.equal(await page.evaluate(() => [...document.querySelectorAll('.accessory-dialog .el-form-item__label')].some(el => el.textContent.trim() === '原入库批次')), false)
    await page.evaluate(async () => { window.fixtureScenario = 'legacy'; await window.renderMobileCase('views/accessories/AccessoriesView.vue') })
    await clickButton('.data-table button', '编辑')
    await page.waitForFunction(() => [...document.querySelectorAll('.accessory-dialog .el-alert')].some(el => el.textContent.includes('历史入库缺少原资料快照')))
    assert.equal(await page.evaluate(() => [...document.querySelectorAll('.accessory-dialog button')].find(el => el.textContent.trim() === '保存更正')?.disabled), true)
    assert.deepEqual(await page.evaluate(() => window.fixtureUnknown), [])
  }
  if (!templateSearchOnly) for (const width of [1440, 834, 390, 320]) for (const theme of ['light', 'dark']) {
    let phase = '详情及划拨'
    try {
      await page.setViewport({ width, height: 932, isMobile: width < 768, hasTouch: true })
      await page.evaluate(async theme => {
        document.documentElement.dataset.theme = theme
        window.fixtureScenario = 'plain'; window.fixtureWrites = []; window.fixtureReads = []
        await window.renderMobileCase('views/accessories/AccessoriesView.vue')
      }, theme)
      await page.waitForSelector('.data-table .el-table__row')
      await assertPublicButtons()
      if (width <= 767) {
        const cell = await page.$('.data-table .el-table__row td')
        await cell.tap(); await cell.tap(); await cell.dispose()
      } else await clickButton('.data-table button', '详情')
      await page.waitForFunction(() => [...document.querySelectorAll('.accessory-details-dialog button')].some(el => el.checkVisibility()))
      await settleLayout()
      await assertPublicButtons()
      await clickButton('.accessory-details-dialog button', '划拨')
      await page.waitForFunction(() => [...document.querySelectorAll('.el-dialog__title')].some(el => el.checkVisibility() && el.textContent.trim() === '划拨'))
      await settleLayout(); await assertPublicButtons()
      if (screenshotDirectory) await page.screenshot({ path: join(screenshotDirectory, `transfer-${width}-${theme}.png`), fullPage: true })
      await clickButton('.tf-dialog-actions button', '取消')
      await settleLayout()
      phase = '设置页挂载'
      await page.evaluate(() => window.renderMobileCase('views/accessories/AccessoryCatalogView.vue'))
      await page.waitForFunction(() => document.querySelector('.catalog-content')?.textContent.includes('充电器'))
      for (const [tab, create, title] of [['商品类型', '新增类型', '商品类型'], ['计量单位', '新增单位', '计量单位']]) {
        phase = `${tab}切换`
        await clickButton('[role="tab"]', tab); await settleLayout(); await assertPublicButtons()
        phase = create
        await clickButton('.catalog-toolbar button', create)
        await page.waitForFunction(title => [...document.querySelectorAll('.el-dialog__title')].some(el => el.checkVisibility() && el.textContent.trim() === `新增${title}`), {}, title)
        await settleLayout(); await assertPublicButtons()
        await clickButton('.tf-dialog-actions button', '取消')
        await settleLayout()
        phase = `编辑${title}`
        if (width <= 767) {
          const cell = await page.evaluateHandle(() => [...document.querySelectorAll('.data-table .el-table__row td')].find(el => el.checkVisibility()))
          await cell.tap(); await cell.tap(); await cell.dispose()
          await clickButton('.tf-dialog-actions button', '编辑')
        } else await clickButton('.data-table button', '编辑')
        await page.waitForFunction(title => [...document.querySelectorAll('.el-dialog__title')].some(el => el.checkVisibility() && el.textContent.trim() === `编辑${title}`), {}, title)
        await settleLayout(); await assertPublicButtons()
        if (screenshotDirectory) await page.screenshot({ path: join(screenshotDirectory, `catalog-${title}-${width}-${theme}.png`), fullPage: true })
        await clickButton('.tf-dialog-actions button', '取消')
        await settleLayout()
      }
      await clickButton('[role="tab"]', '仓库设置'); await settleLayout(); await assertPublicButtons()
      assert.deepEqual(await page.evaluate(() => window.fixtureWrites), [])
      assert.deepEqual(await page.evaluate(() => window.fixtureUnknown), [])
      recordResult(`${width}px ${theme} 详情/划拨/设置TAB及新增编辑按钮`)
    } catch (error) {
      if (screenshotDirectory) await page.screenshot({ path: join(screenshotDirectory, `failed-actions-${width}-${theme}.png`), fullPage: true })
      throw new Error(`${width}px ${theme} ${phase}：${error.message}`, { cause: error })
    }
  }
  assert.deepEqual(errors, [])
  console.log(JSON.stringify({ passed: results.length + (templateSearchOnly || pageActionsOnly ? 0 : 2), results,
    templateEdit: templateSearchOnly || pageActionsOnly ? 'not run' : 'passed', legacyGuard: templateSearchOnly || pageActionsOnly ? 'not run' : 'passed', realApiRequests: 0, runtimeErrors: errors.length }))
} finally {
  await browser?.close()
  await server?.close()
  await rm(temporary, { recursive: true, force: true })
}
