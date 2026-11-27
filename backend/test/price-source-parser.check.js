'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const { spawnSync } = require('node:child_process')
const path = require('node:path')
const cheerio = require('cheerio')
const PriceSourceParser = require('../src/services/price-source-parser.service')

const parser = new PriceSourceParser({ htmlParser: cheerio })

test('外部搜索按代码、历史名称、标准名称顺序去重，保留Duo补搜别名', () => {
  assert.deepEqual(parser.getExternalModelSearchTerms('iphone17pro', 'iPhone17pro', ' A3524 ', 'A3524'),
    ['A3524', 'iPhone 17 Pro'])
  assert.deepEqual(parser.getExternalModelSearchTerms('iphone18duo', 'iPhone Duo', '', ''),
    ['iPhone Duo', 'iPhone 18 Duo', '18 Duo', '18duo'])
  assert.deepEqual(parser.getExternalModelSearchTerms('ipadair8', 'iPad Air8 13寸', '旧名称', ''),
    ['旧名称', 'iPad Air8 13寸'])
  assert.deepEqual(parser.getExternalModelSearchTerms('', '', '', ''), [])
})

test('外部结果按原代码或去除标签后的型号判断，空值及无关结果不通过', () => {
  assert.equal(parser.hasExternalModelInTable('<tr><td>苹果 A3524</td></tr>', 'a3524', 'iphone17pro'), true)
  assert.equal(parser.hasExternalModelInTable('<td>iPhone <b>18 Pro Max</b></td>', '', 'iphone18promax'), true)
  assert.equal(parser.hasExternalModelInTable('<td>iPhone Duo</td>', '', 'iphone18duo'), true)
  assert.equal(parser.hasExternalModelInTable('<td>iPhone 16 A3288</td>', 'A3524', 'iphone17pro'), false)
  assert.equal(parser.hasExternalModelInTable('<td>登录后查看</td>', '', ''), false)
  assert.equal(parser.hasExternalModelInTable(null, 'A3524', 'iphone17pro'), false)
})

test('可采集结果必须有多列商品行和人民币金额，空表及表头不算报价', () => {
  for (const amount of ['￥0', '¥ 5888.50']) {
    assert.equal(parser.hasExternalPriceRows(`<tbody><tr><td>商品</td><td>${amount}</td></tr></tbody>`), true)
  }
  for (const html of [null, '', '<tr><th>商品</th><th>￥100</th></tr>',
    '<tr><td>商品</td><td>暂无报价</td></tr>', '<tr><td>￥100</td></tr>']) {
    assert.equal(parser.hasExternalPriceRows(html), false)
  }
})

test('HTML解析能力缺失时保持无可用报价的回退，不抛错或访问其他资源', () => {
  const unavailable = new PriceSourceParser({ htmlParser: null })
  assert.equal(unavailable.hasExternalPriceRows('<tr><td>商品</td><td>￥100</td></tr>'), false)
  assert.deepEqual(unavailable.getExternalModelSearchTerms('iphone17', '', '', 'A3521'), ['A3521', 'iPhone 17'])
})

test('价目解析分支加载失败时日志可用，其他依赖正常时保留降级', () => {
  const entry = path.resolve(__dirname, '../src/services/price-list.service.js')
  const child = spawnSync(process.execPath, ['-e', `
    const assert = require('node:assert/strict')
    const Module = require('node:module')
    const originalLoad = Module._load
    Module._load = function (request, parent, isMain) {
      // 只隔离价目服务的可选加载；HTTP登录服务仍使用它自己的必需依赖。
      if (request === 'cheerio' && parent?.filename === ${JSON.stringify(entry)}) {
        const error = new Error('模拟可选HTML解析库缺失')
        error.code = 'MODULE_NOT_FOUND'
        throw error
      }
      return originalLoad.call(this, request, parent, isMain)
    }
    const service = require(${JSON.stringify(entry)})
    assert.equal(service.hasExternalPriceRows('<tr><td>商品</td><td>￥100</td></tr>'), false)
    assert.deepEqual(service.getExternalModelSearchTerms('iphone17', '', '', 'A3521'), ['A3521', 'iPhone 17'])
  `], {
    cwd: path.resolve(__dirname, '..'),
    env: { ...process.env, ENV_FILE: 'test/missing-unit-env', RUN_DB_TESTS: 'false' },
    encoding: 'utf8'
  })
  assert.ifError(child.error)
  assert.equal(child.status, 0, child.stderr || child.stdout)
})

test('型号检索沿用本次来源的地址及参数，并替换关键词和品牌', () => {
  const term = 'iPad Air8 13寸 + A&B #1'
  const source = 'https://quotes.example.test/catalog/quoteList.action?gsdm=1&pp=苹果&network=同城&arg_name=旧关键词#results'
  const url = new URL(parser.buildExternalModelSearchUrl(term, source))
  assert.equal(url.origin, 'https://quotes.example.test')
  assert.equal(url.pathname, '/catalog/quoteList.action')
  assert.equal(url.searchParams.get('gsdm'), '1')
  assert.equal(url.searchParams.get('network'), '同城')
  assert.equal(url.searchParams.get('arg_name'), term)
  assert.equal(url.searchParams.get('pp'), '')
  assert.equal(url.searchParams.get('isqh'), '0')
  assert.equal(url.hash, '')
  const otherSource = 'https://other.example.test/quoteList.action?gsdm=2&isqh=1'
  const ipadUrl = new URL(parser.buildExternalModelSearchUrl('iPad', otherSource, '苹果'))
  assert.equal(ipadUrl.origin, 'https://other.example.test')
  assert.equal(ipadUrl.searchParams.get('gsdm'), '2')
  assert.equal(ipadUrl.searchParams.get('isqh'), '1')
  assert.equal(ipadUrl.searchParams.get('pp'), '苹果')
})
