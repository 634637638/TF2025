'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const axios = require('axios')
const priceListService = require('../src/services/price-list.service')

test('公开源会话跟随同域跳转并在后续请求中保留最新Cookie', async () => {
  const originalGet = axios.get
  const requests = []
  const responses = [
    {
      status: 302,
      headers: {
        'set-cookie': ['JSESSIONID=first; Path=/; HttpOnly'],
        location: 'http://quotes.example.test/goShopping.action?r=1'
      }
    },
    {
      status: 302,
      headers: {
        'set-cookie': ['JSESSIONID=second; Path=/; HttpOnly'],
        location: 'http://quotes.example.test/quoteList.action'
      }
    },
    { status: 200, headers: {} }
  ]

  axios.get = async (url, options) => {
    requests.push({ url, options })
    return responses.shift()
  }

  try {
    const cookie = await priceListService.createPublicSourceSession(
      'https://quotes.example.test/quoteList.action',
      { 'User-Agent': 'test-agent' }
    )

    assert.equal(cookie, 'JSESSIONID=second')
    assert.deepEqual(requests.map(request => request.url), [
      'https://quotes.example.test/',
      'https://quotes.example.test/goShopping.action?r=1',
      'https://quotes.example.test/quoteList.action'
    ])
    assert.equal(requests[1].options.headers.Cookie, 'JSESSIONID=first')
    assert.equal(requests[2].options.headers.Cookie, 'JSESSIONID=second')
    assert.equal(requests[0].options.maxRedirects, 0)
  } finally {
    axios.get = originalGet
  }
})

test('公开源会话拒绝跳转到其他主机', async () => {
  const originalGet = axios.get
  let requestCount = 0
  axios.get = async () => {
    requestCount += 1
    return { status: 302, headers: { location: 'https://other.example.test/' } }
  }

  try {
    await assert.rejects(
      priceListService.createPublicSourceSession(
        'https://quotes.example.test/quoteList.action',
        { 'User-Agent': 'test-agent' }
      ),
      /非本站地址/
    )
    assert.equal(requestCount, 1)
  } finally {
    axios.get = originalGet
  }
})

test('手机代码及名称、iPad、AirPods 补搜均使用当前来源地址及参数', async t => {
  const service = new priceListService.constructor()
  const requests = []
  const modelFilters = []
  service.db = {
    async query(sql, params) {
      if (sql.includes('FROM phones')) {
        return [['iPhone 17', 'iPad Air8', 'AirPods 4', 'MacBook Air', 'MacBook Pro']
          .map(model_number => ({ model_number }))]
      }
      assert.match(sql, /FROM price_list/)
      modelFilters.push({ sql, params })
      return [[]]
    }
  }
  t.mock.method(axios, 'head', async () => ({ status: 200 }))
  t.mock.method(axios, 'get', async address => {
    const url = new URL(address)
    requests.push(url)
    const term = url.searchParams.get('arg_name')
    const row = term === 'A3521'
      ? '<tr><th>型号</th><th>价格</th></tr>'
      : '<tr><td>iPhone 17 A3521</td><td>¥5000</td></tr>'
    return { status: 200, data: `<table>${row}</table>` }
  })

  for (const config of [
    { id: 1, is_default: 1, source_url: 'https://a.example.test/catalog/quoteList.action?gsdm=11&network=同城' },
    { id: 2, is_default: 0, source_url: 'https://b.example.test/quoteList.action?gsdm=22&network=全国' }
  ]) {
    requests.length = 0
    await service.fetchPriceData(config)
    assert.deepEqual(requests.slice(1).map(url => url.searchParams.get('arg_name')), ['iPad', 'pods', 'A3521', 'iPhone 17'])
    const source = new URL(config.source_url)
    for (const url of requests) {
      assert.equal(url.origin, source.origin)
      assert.equal(url.pathname, source.pathname)
      assert.equal(url.searchParams.get('gsdm'), source.searchParams.get('gsdm'))
      assert.equal(url.searchParams.get('network'), source.searchParams.get('network'))
    }
  }
  assert.deepEqual(modelFilters.map(filter => filter.params), [[1], [2]])
  assert.match(modelFilters[0].sql, /p\.source_config_id IS NULL/)
  assert.doesNotMatch(modelFilters[1].sql, /p\.source_config_id IS NULL/)
})

test('原价变化和未变化时，同步都保留商品绑定并记录实际来源', async t => {
  const service = new priceListService.constructor()
  t.mock.method(service, 'calculateRetailPrice', async () => ({ retailPrice: null }))
  t.mock.method(service, 'recordPriceHistory', async () => {})
  const savedPrices = []
  t.mock.method(service, 'saveSourcePrice', async price => { savedPrices.push(price) })
  const updates = []
  service.db = {
    async query(sql, params) {
      if (/SELECT id FROM (brands|models|colors|memories)/.test(sql)) return [[{ id: 1 }]]
      if (sql.includes('SELECT id, retail_price')) return [[{ id: 7, wholesale_price: 5000, is_collect: 1, source_config_id: null }]]
      if (/UPDATE price_list/.test(sql)) {
        updates.push({ sql, params })
        return [{ affectedRows: 1 }]
      }
      assert.fail('出现预期外的数据库请求')
    }
  }

  const syncTime = '2026-01-01 10:00:00'
  for (const [sourceConfigId, wholesalePrice] of [[1, 5000], [2, 5100]]) {
    const result = await service.upsertPriceItem({
      brand_name: '苹果',
      model_number: 'iPhone 17',
      color_name: '黑色',
      memory: '256GB',
      wholesale_price: wholesalePrice
    }, syncTime, { sourceConfigId })
    assert.equal(result.success, true, result.message)
  }
  assert.equal(updates.length, 2)
  for (const { sql, params } of updates) {
    assert.doesNotMatch(sql, /source_config_id\s*=/)
    assert.match(sql, /last_sync_time\s*=\s*\?/)
    assert.ok(params.includes(syncTime))
  }
  assert.deepEqual(savedPrices.map(({ priceListId, sourceConfigId, wholesalePrice }) =>
    [priceListId, sourceConfigId, wholesalePrice]), [[7, 1, 5000], [7, 2, 5100]])
})
