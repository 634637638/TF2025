const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const pricingService = require('../src/services/pricing.service')

const config = pricingService.normalizeGlobalConfig({
  mode: 'fixed',
  lowFixed: 200,
  highFixed: 200,
  threshold: 6000,
  enabled: true,
  wholesale: { enabled: true, adjustment: 30 }
})

test('销售渠道只使用全局销售规则', () => {
  assert.equal(pricingService.calculateSalesPriceByConfig(5800, config), 6000)
  assert.equal(pricingService.calculateSalesPriceByConfig(7000, config), 7200)
})

test('批发渠道只使用批发规则', () => {
  assert.equal(pricingService.calculateWholesalePriceByConfig(5800, config), 5830)
})

test('H5 渠道只使用模板规则', () => {
  const template = { price_markup: 200, price_markup_type: 'fixed' }
  assert.equal(pricingService.calculateH5PriceByTemplate(5800, template), 6000)
  assert.equal(pricingService.calculateH5PriceByTemplate(5800, { price_markup: 10, price_markup_type: 'percentage' }), 6380)
})

test('价目表页面保留后端计算的渠道展示价', () => {
  const view = fs.readFileSync(path.join(__dirname, '../../frontend/src/views/price-list/PriceListView.vue'), 'utf8')
  const mappingStart = view.indexOf('const formattedList = list.map')
  const mappingEnd = view.indexOf('priceList.value = formattedList', mappingStart)
  const mapping = view.slice(mappingStart, mappingEnd)

  assert.ok(mappingStart >= 0 && mappingEnd > mappingStart)
  assert.match(mapping, /sales_display_price:\s*item\.sales_display_price/)
  assert.match(mapping, /wholesale_display_price:\s*item\.wholesale_display_price/)
})
