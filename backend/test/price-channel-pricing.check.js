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
  wholesale: { enabled: true, adjustment: 30 },
  used: { adjustment: 50 }
})

test('销售渠道只使用全局销售规则', () => {
  assert.equal(pricingService.calculateSalesPriceByConfig(5800, config), 6000)
  assert.equal(pricingService.calculateSalesPriceByConfig(7000, config), 7200)
})

test('批发渠道只使用批发规则', () => {
  assert.equal(pricingService.calculateWholesalePriceByConfig(5800, config), 5830)
})

const sourceConfig = pricingService.normalizeGlobalConfig({
  wholesale: { enabled: true, adjustment: 10, sourceAdjustments: { 1: 50, 2: -50, 3: 0 } }
})
for (const [mode, amount, expectedA, expectedB] of [
  ['inherit', 0, 5050, 4950], ['original', 0, 5000, 5000],
  ['adjustment', 30, 5030, 5030], ['adjustment', -30, 4970, 4970],
  ['extra', 20, 5070, 4970], ['extra', -20, 5030, 4930]
]) {
  test(`批发规格 ${mode} 金额 ${amount} 按指定基准计算，来源A/B互不混算`, () => {
    const rule = { wholesale_rule_mode: mode, wholesale_rule_adjustment: amount }
    assert.equal(pricingService.calculateWholesalePriceByConfig(5000, sourceConfig, 1, rule), expectedA)
    assert.equal(pricingService.calculateWholesalePriceByConfig(5000, sourceConfig, 2, rule), expectedB)
    assert.equal(pricingService.calculateSalesPriceByConfig(5000, sourceConfig), 5250)
    assert.equal(pricingService.calculateH5PriceByTemplate(5000, { price_markup: 100 }), 5100)
  })
}

test('未指定来源使用全局规则，显式来源零金额不回退；规则不能产生负报价', () => {
  assert.equal(pricingService.calculateWholesalePriceByConfig(5000, sourceConfig), 5010)
  assert.equal(pricingService.calculateWholesalePriceByConfig(5000, sourceConfig, 3), 5000)
  assert.equal(pricingService.calculateWholesalePriceByConfig(5000, sourceConfig, 1, { wholesale_rule_mode: 'extra', wholesale_rule_adjustment: -6000 }), 0)
  assert.equal(pricingService.calculateWholesalePriceByConfig(null, sourceConfig, 1, { wholesale_rule_mode: 'adjustment', wholesale_rule_adjustment: 30 }), null)
})

test('批发总规则关闭时，独立规则仍有效，额外金额以采集价为基准', () => {
  const disabled = pricingService.normalizeGlobalConfig({ wholesale: { enabled: false, adjustment: 50 } })
  assert.equal(pricingService.calculateWholesalePriceByConfig(5000, disabled, 1), 5000)
  assert.equal(pricingService.calculateWholesalePriceByConfig(5000, disabled, 1, { wholesale_rule_mode: 'extra', wholesale_rule_adjustment: 20 }), 5020)
  assert.equal(pricingService.calculateWholesalePriceByConfig(5000, disabled, 1, { wholesale_rule_mode: 'adjustment', wholesale_rule_adjustment: -30 }), 4970)
})

test('批发全部、品牌和搜索接口统一保留规格规则与有效默认来源', async t => {
  const service = require('../src/services/price-list.service')
  t.mock.method(service, 'getGlobalMarkupConfig', async () => sourceConfig)
  const originalDb = service.db
  const queries = []
  service.db = { query: async sql => {
    queries.push(sql)
    return [[{ wholesale_price: '5000', source_config_id: null, pricing_source_config_id: 2, wholesale_rule_mode: 'extra', wholesale_rule_adjustment: '20' }]]
  } }
  try {
    for (const [method, argument] of [['getAllPrices'], ['getPricesByBrand', '品牌'], ['searchPrices', '型号']]) {
      const result = await service[method](argument)
      assert.equal(result.success, true)
      assert.equal(result.data[0].display_wholesale_price, 4970)
      assert.equal(result.data[0].wholesale_price, '5000')
    }
    for (const sql of queries) {
      assert.match(sql, /p\.wholesale_rule_mode/)
      assert.match(sql, /p\.wholesale_rule_adjustment/)
      assert.match(sql, /pricing_source_config_id/)
    }
  } finally { service.db = originalDb }
})

test('二手机渠道按原始入库价独立加价', () => {
  assert.equal(pricingService.calculateUsedInventoryPriceByConfig(3000, config), 3050)
  assert.equal(pricingService.calculateWholesalePriceByConfig(3000, config), 3030)
})

test('H5 渠道只使用模板规则', () => {
  const template = { price_markup: 200, price_markup_type: 'fixed' }
  assert.equal(pricingService.calculateH5PriceByTemplate(5800, template), 6000)
  assert.equal(pricingService.calculateH5PriceByTemplate(5800, { price_markup: 10, price_markup_type: 'percentage' }), 6380)
})

test('价目表页面保留后端计算的渠道展示价', () => {
  const view = fs.readFileSync(path.join(__dirname, '../../frontend/src/views/price-list/PriceListView.vue'), 'utf8')
  // 这里只检查页面接入正式归一化入口；渠道价格的输入输出由 Vitest 行为测试覆盖。
  assert.match(view, /import\s*\{\s*normalizePriceListRow\s*\}\s*from\s*['"]\.\/price-list-row['"]/)
  assert.match(view, /\.map\(normalizePriceListRow\)/)
})
