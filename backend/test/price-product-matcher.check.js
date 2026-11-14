'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const PriceProductMatcher = require('../src/services/price-product-matcher.service')

test('价目纯匹配读取唯一实时配置，不复制颜色状态，候选排序不修改输入', () => {
  const config = { standardColors: ['绿色', '黑色'], colorMapping: { 兼容绿: '绿色' } }
  const matcher = new PriceProductMatcher(() => config)
  assert.equal(matcher.normalizeColor('兼容绿'), '绿色')
  assert.equal(matcher.normalizeColor('草绿色'), '绿色')
  config.standardColors = ['草绿色', '黑色']
  assert.equal(matcher.normalizeColor('草绿色'), '草绿色')
  const candidates = Object.freeze([Object.freeze({ isLocal: false, memory: '1TB' }), Object.freeze({ isLocal: true, color: '绿色' })])
  assert.deepEqual(matcher.getEligiblePriceCandidates(candidates, { brand_name: '苹果', model_number: '18promax' }), [candidates[1]])
  assert.deepEqual(matcher.getEligiblePriceCandidates(candidates, { brand_name: '苹果', model_number: '15' }), [candidates[1], candidates[0]])
  assert.equal(candidates[0].isLocal, false)
  assert.equal(matcher.extractMemoryFromText('12GB+256GB'), '256GB')
  assert.equal(matcher.normalizeModelForMatch('iPad Air8 13英寸'), 'ipadair813寸')
})
