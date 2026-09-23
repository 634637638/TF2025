const test = require('node:test')
const assert = require('node:assert/strict')

const priceListService = require('../src/services/price-list.service')
const { matchProductName } = require('../src/config/product-name-mapping')

test('iPhone 18 aliases map to the correct local models', () => {
  assert.deepEqual(matchProductName('苹果 iPhone 18 Pro Max (A3718)'), {
    brand: '苹果',
    model: '18promax',
    external_model: 'A3718',
    category: 'phone'
  })
  assert.deepEqual(matchProductName('苹果 iPhone 18 Pro (A3715)'), {
    brand: '苹果',
    model: 'iPhone18 Pro',
    external_model: 'A3715',
    category: 'phone'
  })
  assert.equal(matchProductName('18pro')?.model, 'iPhone18 Pro')
  assert.equal(matchProductName('iPhone 18 Duo')?.model, 'iPhone Duo')
  assert.equal(matchProductName('18duo')?.model, 'iPhone Duo')
})

test('iPhone 17 aliases keep their confirmed external model codes', () => {
  assert.equal(matchProductName('iPhone 17')?.external_model, 'A3521')
  assert.equal(matchProductName('iPhone 17 Pro')?.external_model, 'A3524')
  assert.equal(matchProductName('iPhone 17 Pro Max')?.external_model, 'A3527')
  assert.equal(matchProductName('iPhone Air')?.external_model, 'A3518')
  assert.equal(matchProductName('iPhone 17E')?.external_model, 'A3635')
})

test('iPhone 18 colors normalize to local color names', () => {
  assert.equal(priceListService.normalizeColor('勃艮第酒红色'), '红色')
  assert.equal(priceListService.normalizeColor('冰川蓝色'), '蓝色')
  assert.equal(priceListService.normalizeColor('银色'), '白色')
  assert.equal(priceListService.normalizeColor('草绿色'), '绿色')
  assert.equal(priceListService.normalizeColor('深绿色'), '绿色')
  assert.equal(priceListService.normalizeColor('浅绿色'), '绿色')
  assert.equal(priceListService.normalizeColor('灰色'), '黑色')
  assert.equal(priceListService.normalizeColor('天空灰'), '黑色')
  assert.equal(priceListService.normalizeColor('深空灰'), '黑色')
  assert.equal(priceListService.normalizeColor('酒红'), '红色')
  assert.equal(priceListService.normalizeColor('大红色'), '红色')
})

test('external iPhone 18 Pro rows retain their own model code', async () => {
  const parsed = await priceListService.parseExternalProduct(
    '苹果 iPhone 18 Pro (A3715)-512GB-同城-冰川蓝色'
  )

  assert.equal(parsed?.model, 'iPhone18 Pro')
  assert.equal(parsed?.modelCode, 'A3715')
  assert.equal(parsed?.memory, '512GB')
  assert.equal(parsed?.color, '冰川蓝色')
  assert.equal(parsed?.isLocal, true)
})

test('new iPhone shorthand models still require same-city prices', () => {
  assert.equal(priceListService.requiresSameCityOnly({ brand_name: '苹果', model_number: '18promax' }), true)
  assert.equal(priceListService.requiresSameCityOnly({ brand_name: '苹果', model_number: '18pro' }), true)
  assert.equal(priceListService.requiresSameCityOnly({ brand_name: '苹果', model_number: '18duo' }), true)
})

test('external iPhone 18 Pro Max rows retain model, color and memory details', async () => {
  const parsed = await priceListService.parseExternalProduct(
    '苹果 iPhone 18 Pro Max (A3718)-512GB-同城-勃艮第酒红色'
  )

  assert.equal(parsed?.model, '18promax')
  assert.equal(parsed?.modelCode, 'A3718')
  assert.equal(parsed?.memory, '512GB')
  assert.equal(parsed?.color, '勃艮第酒红色')
  assert.equal(parsed?.isLocal, true)
})
