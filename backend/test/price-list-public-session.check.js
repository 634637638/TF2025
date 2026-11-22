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
