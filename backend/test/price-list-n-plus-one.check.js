const test = require('node:test')
const assert = require('node:assert/strict')

const priceListService = require('../src/services/price-list.service')

test('未匹配价格保存只批量读取一次型号表', async () => {
  const originalDb = priceListService.db
  const originalCheckExists = priceListService.checkPriceListExistsWithMode
  const modelQueries = []
  const checkedModels = []

  priceListService.db = {
    query: async sql => {
      modelQueries.push(sql)
      return [[{ name: '17promax' }, { name: 'galaxys24' }]]
    }
  }
  priceListService.checkPriceListExistsWithMode = async priceData => {
    checkedModels.push(priceData.model_number)
    return { exists: false, id: null, is_collect: 1 }
  }

  const externalPrices = new Map([
    ['apple-iphone17promax', [{ color: '黑色', memory: '256GB', price: 8000, isLocal: true }]],
    ['samsung-galaxys24', [{ color: '黑色', memory: '256GB', price: 5000 }]]
  ])

  try {
    const result = await priceListService.saveUnmatchedExternalPrices(externalPrices, '2026-11-04 12:00:00', [])

    assert.equal(modelQueries.length, 1)
    assert.match(modelQueries[0], /SELECT name FROM models/)
    assert.deepEqual(checkedModels, ['17promax', 'galaxys24'])
    assert.deepEqual(result, { created: 0, updated: 0, skipped: 2, failed: 0 })
  } finally {
    priceListService.db = originalDb
    priceListService.checkPriceListExistsWithMode = originalCheckExists
  }
})

test('自动补全用一次组合查询代替逐库存查询', async () => {
  const originalDb = priceListService.db
  const originalUpsert = priceListService.upsertPriceItem
  const queries = []
  const createdItems = []

  priceListService.db = {
    query: async sql => {
      queries.push(sql)
      if (/FROM phones p/.test(sql)) {
        return [[
          { brand_name: '苹果', model_number: '17promax', color_name: '黑色', memory: '256GB' },
          { brand_name: '苹果', model_number: '17promax', color_name: null, memory: '512GB' }
        ]]
      }
      if (/FROM price_list p/.test(sql)) {
        return [[
          { brand_name: '苹果', model_number: '17promax', color_name: '黑色', memory: '256GB' }
        ]]
      }
      throw new Error(`未预期的查询: ${sql}`)
    }
  }
  priceListService.upsertPriceItem = async priceData => {
    createdItems.push(priceData)
    return { success: true }
  }

  try {
    const result = await priceListService.autoCompleteMissingMemorySpecs()

    assert.equal(queries.length, 2)
    assert.equal(createdItems.length, 1)
    assert.equal(createdItems[0].color_name, null)
    assert.equal(createdItems[0].memory, '512GB')
    assert.deepEqual(result, { total: 2, success: 1, failed: 0 })
  } finally {
    priceListService.db = originalDb
    priceListService.upsertPriceItem = originalUpsert
  }
})

test('价目表组合键区分 null、空字符串和分隔符内容', () => {
  const nullKey = priceListService.buildPriceCombinationKey({
    brand_name: '苹果', model_number: '17-promax', color_name: null, memory: '256GB'
  })
  const emptyKey = priceListService.buildPriceCombinationKey({
    brand_name: '苹果', model_number: '17-promax', color_name: '', memory: '256GB'
  })

  assert.notEqual(nullKey, emptyKey)
  assert.equal(nullKey, priceListService.buildPriceCombinationKey({
    brand_name: '苹果', model_number: '17-promax', color_name: null, memory: '256GB'
  }))
})
