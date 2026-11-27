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

test('iPhone aliases keep their confirmed external model codes', () => {
  assert.equal(matchProductName('iPhone 17')?.external_model, 'A3521')
  assert.equal(matchProductName('iPhone 17 Pro')?.external_model, 'A3524')
  assert.equal(matchProductName('iPhone 17 Pro Max')?.external_model, 'A3527')
  assert.equal(matchProductName('iPhone Air')?.external_model, 'A3518')
  assert.equal(matchProductName('iPhone 17E')?.external_model, 'A3635')
  assert.equal(matchProductName('iPhone Duo')?.external_model, 'A3721')
  assert.equal(matchProductName('18duo')?.external_model, 'A3721')
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
  assert.equal(priceListService.normalizeColor('夜空色'), '黑色')
  assert.equal(priceListService.normalizeColor('星光白色'), '白色')
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

test('external iPhone Duo rows retain A3721 and normalize Duo colors', async () => {
  const white = await priceListService.parseExternalProduct(
    '苹果 iPhone Duo (A3721)-1TB-同城-星光白色'
  )
  const black = await priceListService.parseExternalProduct(
    '苹果 iPhone Duo (A3721)-256GB-同城-夜空色'
  )

  assert.equal(white?.model, 'iPhone Duo')
  assert.equal(white?.modelCode, 'A3721')
  assert.equal(white?.memory, '1TB')
  assert.equal(white?.color, '星光白色')
  assert.equal(priceListService.normalizeColor(white?.color), '白色')
  assert.equal(black?.modelCode, 'A3721')
  assert.equal(black?.memory, '256GB')
  assert.equal(priceListService.normalizeColor(black?.color), '黑色')
})

test('external searches try confirmed model codes before display-name fallbacks', () => {
  assert.deepEqual(
    priceListService.getExternalModelSearchTerms('iphone17pro', 'iPhone17pro', '', 'A3524'),
    ['A3524', 'iPhone 17 Pro']
  )
  assert.deepEqual(
    priceListService.getExternalModelSearchTerms('iphone18promax', '18promax', '', 'A3718'),
    ['A3718', 'iPhone 18 Pro Max']
  )
})

test('iPhone Duo search covers external display-name aliases', () => {
  assert.deepEqual(
    priceListService.getExternalModelSearchTerms('iphone18duo', 'iPhone Duo', '', ''),
    ['iPhone Duo', 'iPhone 18 Duo', '18 Duo', '18duo']
  )
  assert.equal(
    priceListService.hasExternalModelInTable(
      '<tr><td>苹果 iPhone 18 Duo - 512GB</td><td>¥8999</td></tr>',
      '',
      'iphone18duo'
    ),
    true
  )
  assert.equal(priceListService.normalizeModelForMatch('18duo'), 'iphoneduo')
  assert.equal(priceListService.normalizeModelForMatch('iPhone Duo'), 'iphoneduo')
})

test('external model search does not combine a brand filter with model codes', () => {
  const searchUrl = new URL(priceListService.buildExternalModelSearchUrl('A3521', 'https://quotes.example.test/quoteList.action'))

  assert.equal(searchUrl.searchParams.get('arg_name'), 'A3521')
  assert.equal(searchUrl.searchParams.get('pp'), '')
  assert.equal(searchUrl.searchParams.get('km'), '')
  assert.equal(searchUrl.searchParams.get('isqh'), '0')
})

test('external empty tables are not treated as successful price results', () => {
  assert.equal(
    priceListService.hasExternalPriceRows('<tbody><tr><td>型号</td><td>价格</td></tr></tbody>'),
    false
  )
  assert.equal(
    priceListService.hasExternalPriceRows('<tbody><tr><td>苹果 iPhone 17 (A3521)</td><td>￥5650.00</td></tr></tbody>'),
    true
  )
})

test('external table detection rejects unrelated generic results', () => {
  assert.equal(priceListService.hasExternalModelInTable('<tr><td>iPhone 16 (A3288)</td></tr>', 'A3521', 'iphone17'), false)
  assert.equal(priceListService.hasExternalModelInTable('<tr><td>iPhone 17 (A3521)</td></tr>', 'A3521', 'iphone17'), true)
  assert.equal(priceListService.hasExternalModelInTable('<tr><td>iPhone 18 Pro Max-256GB</td></tr>', 'A3718', 'iphone18promax'), true)
})

test('price fetch retries once after a transient source failure', async () => {
  const originalFetch = priceListService.fetchPriceData
  const originalLogin = priceListService.loginToSource
  let fetchAttempts = 0
  let loginAttempts = 0

  priceListService.fetchPriceData = async () => {
    fetchAttempts += 1
    if (fetchAttempts === 1) throw new Error('temporary redirect')
    return '<table><tr><td>ok</td></tr></table>'
  }
  priceListService.loginToSource = async () => {
    loginAttempts += 1
    return true
  }

  try {
    const result = await priceListService.fetchPriceDataWithRetry(
      { id: 2, config_name: '新凯3333', source_type: 'account', login_url: '/login', login_username: 'tester' },
      { retryDelayMs: 0 }
    )

    assert.equal(result, '<table><tr><td>ok</td></tr></table>')
    assert.equal(fetchAttempts, 2)
    assert.equal(loginAttempts, 1)
  } finally {
    priceListService.fetchPriceData = originalFetch
    priceListService.loginToSource = originalLogin
  }
})
