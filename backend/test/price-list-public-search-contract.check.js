const test = require('node:test')
const assert = require('node:assert/strict')
const priceListService = require('../src/services/price-list.service')

async function captureSearch(methodName, keyword) {
  const originalDb = priceListService.db
  const originalWholesaleFilter = priceListService.buildLatestPublishedWholesaleFilters
  const originalRetailFilter = priceListService.buildLatestPublishedRetailFilters
  const originalWholesaleMarkup = priceListService.applyWholesaleDisplayMarkup
  const originalRetailMarkup = priceListService.applyRetailDisplayMarkup
  let capturedQuery = ''
  let capturedParams = []

  priceListService.db = {
    query: async (query, params = []) => {
      capturedQuery = query
      capturedParams = params
      return [[]]
    }
  }
  priceListService.buildLatestPublishedWholesaleFilters = () => '1 = 1'
  priceListService.buildLatestPublishedRetailFilters = () => '1 = 1'
  priceListService.applyWholesaleDisplayMarkup = async rows => rows
  priceListService.applyRetailDisplayMarkup = async rows => rows

  try {
    const result = await priceListService[methodName](keyword)
    assert.equal(result.success, true)
    return { query: capturedQuery, params: capturedParams }
  } finally {
    priceListService.db = originalDb
    priceListService.buildLatestPublishedWholesaleFilters = originalWholesaleFilter
    priceListService.buildLatestPublishedRetailFilters = originalRetailFilter
    priceListService.applyWholesaleDisplayMarkup = originalWholesaleMarkup
    priceListService.applyRetailDisplayMarkup = originalRetailMarkup
  }
}

for (const methodName of ['searchPrices', 'searchSalesPrices']) {
  test(`${methodName} numeric model search does not match digits inside external model codes`, async () => {
    const result = await captureSearch(methodName, '18')

    assert.doesNotMatch(result.query, /p\.external_model LIKE \?/)
    assert.deepEqual(result.params, ['%18%', '18'])
  })

  test(`${methodName} keeps external model code search for alphanumeric keywords`, async () => {
    const result = await captureSearch(methodName, 'A3518')

    assert.match(result.query, /p\.external_model LIKE \?/)
    assert.deepEqual(result.params, ['%A3518%', 'A3518', '%A3518%'])
  })
}
