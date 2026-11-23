import assert from 'node:assert/strict'
import { clickVisible, clickButton, checkBoundaries } from './sales-checkout-browser-fixture.mjs'

async function dialogFor(page, title) {
  await page.waitForFunction(title => [...document.querySelectorAll('.mobile-dialog-sheet-panel, .el-dialog')]
    .some(element => element.checkVisibility() && element.querySelector('.el-dialog__title')?.textContent === title), {}, title)
  for (const dialog of await page.$$('.mobile-dialog-sheet-panel, .el-dialog')) {
    if (await dialog.isVisible() && await dialog.$eval('.el-dialog__title', element => element.textContent) === title) return dialog
  }
  assert.fail(`未找到可见弹窗：${title}`)
}

async function closeDialog(page, dialog, title) {
  await clickVisible(await dialog.$('button[aria-label="关闭"], button[aria-label="Close this dialog"]'))
  await page.waitForFunction(title => [...document.querySelectorAll('.mobile-dialog-sheet-panel, .el-dialog')]
    .every(element => !element.checkVisibility() || element.querySelector('.el-dialog__title')?.textContent !== title), {}, title)
}

async function openRecord(page) {
  const mobileRecord = await page.$('[data-mobile-record]')
  if (mobileRecord && await page.evaluate(() => innerWidth <= 1024)) {
    const record = await mobileRecord
    assert.equal(await record.$('button'), null, '手机及平板记录不保留行内操作')
    const field = await record.$('.el-descriptions__content')
    await field.scrollIntoView()
    await field.tap()
    assert.equal(await page.evaluate(() => [...document.querySelectorAll('.record-detail-dialog')].some(element => element.checkVisibility())), false, '单击不能打开记录详情')
    await field.tap()
    return dialogFor(page, '客户商品记录详情')
  }
  const row = await page.waitForSelector('.el-table__body tbody tr', { visible: true })
  await clickVisible(await row.$('.actions-column button'))
  return dialogFor(page, '客户商品记录详情')
}

export async function verifyCustomerGoodsHistory(page, capture = async () => {}) {
  await checkBoundaries(page)
  const rendered = await page.evaluate(() => ({ text: document.body.textContent,
    clipped: [...document.querySelectorAll('.el-descriptions__content')].filter(element => {
      const rect = element.getBoundingClientRect()
      return rect.width && (rect.left < 0 || rect.right > innerWidth + 1 || element.scrollWidth > element.clientWidth + 2)
    }).map(element => element.textContent) }))
  for (const value of ['客户原商品长名称完整显示0', '购买', '赠送', '¥35']) assert.ok(rendered.text.includes(value), value)
  assert.deepEqual(rendered.clipped, [], '商品历史字段完整且不横向裁切')
  const detail = await openRecord(page)
  if (detail) {
    const layout = await detail.evaluate(element => {
      const fields = [...element.querySelectorAll('.tf-record-details__field')]
      const find = label => fields.find(field => field.querySelector('dt')?.textContent === label)
      const short = find('商品类型').getBoundingClientRect(), wide = find('原销售备注').getBoundingClientRect()
      return { short: short.width, wide: wide.width, text: element.textContent,
        footer: element.querySelector('.el-dialog__footer')?.textContent.trim() }
    })
    assert.ok(layout.wide > layout.short * 1.8, '长备注整行、短字段两列')
    assert.ok(layout.text.includes('已退数量') && layout.text.includes('未退数量'), '已退与未退数量在记录明细中成对展示')
    assert.ok(layout.text.includes('原备注'.repeat(25)), '长备注完整展示')
    assert.equal(layout.footer, '整单明细')
    await checkBoundaries(page)
    await capture()
    await closeDialog(page, detail, '客户商品记录详情')
    assert.ok(await openRecord(page), '关闭后允许再次双击打开')
    await closeDialog(page, await dialogFor(page, '客户商品记录详情'), '客户商品记录详情')
  } else await capture()
  await clickVisible(await page.$('.tf-pagination__btn--next'))
  await page.waitForFunction(() => document.body.textContent.includes('末页商品'))
  assert.equal(await page.evaluate(() => document.body.textContent.includes('客户原商品长名称完整显示0')), false)
  const last = await openRecord(page)
  await clickVisible(last ? await last.$('.el-dialog__footer button') : await (await page.$('[data-mobile-record]')).$('button'))
  await page.waitForFunction(() => document.body.textContent.includes('原赠膜'))
  assert.equal(await page.evaluate(() => [...document.querySelectorAll('.record-detail-dialog')]
    .some(element => element.checkVisibility() && element.querySelector('.el-dialog__title')?.textContent === '客户商品记录详情')), false, '进入整单前关闭记录详情')
  await checkBoundaries(page)
  await page.evaluate(() => { window.access.goods = false })
  await page.waitForFunction(() => !document.body.textContent.includes('原赠膜') && !document.body.textContent.includes('末页商品'))
  await page.evaluate(() => { window.fail = true; window.access.goods = true })
  await page.waitForFunction(() => document.body.textContent.includes('隔离读取失败'))
  await page.evaluate(() => { window.fail = false })
  await clickButton(page, '重试')
  await page.waitForFunction(() => document.body.textContent.includes('客户原商品长名称完整显示0'))
}

export async function verifyCustomerFilmHistory(page, capture = async () => {}) {
  await clickButton(page, '贴膜记录')
  let dialog = await dialogFor(page, '客户贴膜')
  assert.equal(await dialog.$('.el-dialog__footer'), null, '纯客户历史没有当前设备，不保留办理动作')
  await page.waitForFunction(() => document.body.textContent.includes('跨店贴膜记录0'))
  await checkBoundaries(page)
  await capture()
  await page.evaluate(() => { window.access.create = window.access.gift = false })
  assert.equal(await dialog.$('.el-dialog__footer'), null, '只读贴膜历史不保留空footer或纯关闭按钮')
  await page.evaluate(() => { window.fail = true })
  await dialog.$eval('.film-history-list', element => { element.scrollTop=element.scrollHeight })
  await page.waitForFunction(() => document.body.textContent.includes('加载失败'))
  assert.equal(await page.evaluate(() => document.body.textContent.includes('跨店贴膜记录0')), true, '追加失败保留已加载历史')
  await page.evaluate(() => { window.fail = false })
  await clickVisible(await dialog.$('.film-history-list__status button'))
  await page.waitForFunction(() => document.body.textContent.includes('跨店贴膜记录10'))
  await dialog.$eval('.film-history-list', element => { element.scrollTop=element.scrollHeight })
  await page.waitForFunction(() => document.body.textContent.includes('跨店贴膜记录20'))
  await checkBoundaries(page)
  await closeDialog(page, dialog, '客户贴膜')
  await clickButton(page, '贴膜记录')
  dialog = await dialogFor(page, '客户贴膜')
  await page.waitForFunction(() => document.body.textContent.includes('跨店贴膜记录0'))
  assert.equal(await dialog.$('.el-dialog__footer'), null)
  await page.evaluate(() => { window.access.film = false })
  await page.waitForFunction(() => !document.body.textContent.includes('跨店贴膜记录0'))
  assert.equal(await page.evaluate(() => document.body.textContent.includes('跨店贴膜记录0')), false, '撤权清理服务记录')
  assert.equal(await dialog.$('.el-dialog__footer'), null)
}
