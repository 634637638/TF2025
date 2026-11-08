'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const PhoneInventoryQueryController = require('../src/controllers/phone-inventory-query.controller')
const PhoneInventoryQueryService = require('../src/services/phone-inventory-query.service')
const PhoneInventoryQueryRepository = require('../src/repositories/phone-inventory-query.repository')

const makeResponse = () => ({})
const response = {
  success(res, data, message) {
    res.body = { success: true, data, message }
    return res
  },
  badRequest(res, message) {
    res.statusCode = 400
    res.body = { success: false, message }
    return res
  },
  notFound(res, message) {
    res.statusCode = 404
    res.body = { success: false, message }
    return res
  },
  serverError(res, message, error) {
    res.statusCode = 500
    res.body = { success: false, message, error }
    return res
  }
}

test('used-models controller trims and bounds keyword while retaining token middleware on route', async () => {
  const calls = []
  const controller = new PhoneInventoryQueryController({
    service: { async getUsedModels(keyword) { calls.push(keyword); return [{ brand_name: 'Apple' }] } },
    response,
    logger: { error() {} }
  })

  const tooLong = makeResponse()
  await controller.getUsedModels({ query: { keyword: 'x'.repeat(81) } }, tooLong)
  assert.equal(tooLong.statusCode, 400)
  assert.equal(calls.length, 0)

  const success = makeResponse()
  await controller.getUsedModels({ query: { keyword: '  iPhone  ' } }, success)
  assert.deepEqual(calls, ['iPhone'])
  assert.deepEqual(success.body, {
    success: true,
    data: [{ brand_name: 'Apple' }],
    message: '获取在库二手机型号成功'
  })

  const route = fs.readFileSync(path.join(__dirname, '../src/routes/phones.js'), 'utf8')
  assert.ok(route.includes("router.get('/used-models', requireInventoryQueryToken, phoneInventoryQueryController.getUsedModels.bind(phoneInventoryQueryController))"))
})

test('used-models service preserves nullable prices and uses the shared pricing service', async () => {
  const service = new PhoneInventoryQueryService({
    repository: {
      async getUsedModelRows(keyword) {
        assert.equal(keyword, 'phone')
        return [
          { stock_quantity: '3', inventory_price: '1000' },
          { stock_quantity: '1', inventory_price: null }
        ]
      }
    },
    pricing: {
      async getGlobalConfig() { return { used: { adjustment: 50 } } },
      calculateUsedInventoryPriceByConfig(price, config) { return Number(price) + config.used.adjustment }
    }
  })

  assert.deepEqual(await service.getUsedModels('phone'), [
    { stock_quantity: 3, inventory_price: 1000, display_inventory_price: 1050 },
    { stock_quantity: 1, inventory_price: null, display_inventory_price: null }
  ])
})

test('used-models repository binds keyword filters, keeps stock constraints and releases connection', async () => {
  let executed
  let released = false
  const repository = new PhoneInventoryQueryRepository(() => ({
    async getConnection() {
      return {
        async execute(sql, params) {
          executed = { sql, params }
          return [[{ brand_id: 1 }]]
        },
        release() { released = true }
      }
    }
  }))

  assert.deepEqual(await repository.getUsedModelRows('256 GB'), [{ brand_id: 1 }])
  assert.deepEqual(executed.params, ['%256 GB%', '%256 GB%', '%256 GB%', '%256 GB%'])
  assert.match(executed.sql, /p\.status = 'in_stock'/)
  assert.match(executed.sql, /p\.is_new = 0/)
  assert.match(executed.sql, /COALESCE\(p\.is_preordered, 0\) = 0/)
  assert.match(executed.sql, /GROUP BY[\s\S]*p\.purchase_cost/)
  assert.equal(released, true)
})

test('longest-inventory controller preserves token route, validation order and response contract', async () => {
  const calls = []
  const controller = new PhoneInventoryQueryController({
    service: { async getLongestInventory(filters) { calls.push(filters); return [{ id: 4, inventory_days: 12 }] } },
    response,
    logger: { debug() {}, error() {} }
  })
  const route = fs.readFileSync(path.join(__dirname, '../src/routes/phones.js'), 'utf8')
  assert.ok(route.includes("router.get('/longest-inventory', requireInventoryQueryToken, phoneInventoryQueryController.getLongestInventory.bind(phoneInventoryQueryController))"))

  const invalidStatus = makeResponse()
  await controller.getLongestInventory({ query: { is_new: '2' } }, invalidStatus)
  assert.equal(invalidStatus.statusCode, 400)
  assert.match(invalidStatus.body.message, /is_new/)

  const missingSpecs = makeResponse()
  await controller.getLongestInventory({ query: { brand_id: '1', model_id: '2', color_id: '3' } }, missingSpecs)
  assert.equal(missingSpecs.statusCode, 400)
  assert.match(missingSpecs.body.message, /memory_id/)

  const invalidPrice = makeResponse()
  await controller.getLongestInventory({ query: { brand_id: '1', model_id: '2', color_id: '3', memory_id: '4', purchase_cost: '-1' } }, invalidPrice)
  assert.equal(invalidPrice.statusCode, 400)
  assert.match(invalidPrice.body.message, /purchase_cost/)

  const success = makeResponse()
  await controller.getLongestInventory({ query: { brand_id: '1', model_id: '2', color_id: '3', memory_id: '4', store_id: '5', is_new: '0', purchase_cost: 'null' } }, success)
  assert.deepEqual(calls, [{
    brand_id: 1,
    model_id: 2,
    color_id: 3,
    memory_id: 4,
    store_id: 5,
    is_new: 0,
    purchase_cost: null,
    purchase_cost_is_null: true
  }])
  assert.deepEqual(success.body, {
    success: true,
    data: { total: 1, data: [{ id: 4, inventory_days: 12 }] },
    message: '查询在库最久商品成功'
  })
})

test('longest-inventory service calculates inventory days and repository binds filters and releases connection', async () => {
  const today = new Date('2026-11-07T12:00:00.000Z')
  const inventoryTime = new Date(today.getTime() - 12 * 24 * 60 * 60 * 1000)
  const service = new PhoneInventoryQueryService({
    now: () => today,
    repository: {
      async getLongestInventoryRows(filters) {
        assert.equal(filters.purchase_cost_is_null, true)
        return [{ id: 7, inventory_time: inventoryTime, inventory_date: '2026-10-26' }]
      }
    }
  })
  const [item] = await service.getLongestInventory({ purchase_cost_is_null: true })
  assert.equal(item.id, 7)
  assert.equal(item.inventory_days, 12)
  assert.equal(item.inventory_date, '2026-10-26')

  let executed
  let released = false
  const repository = new PhoneInventoryQueryRepository(() => ({
    async getConnection() {
      return {
        async execute(sql, params) {
          executed = { sql, params }
          return [[{ id: 7 }]]
        },
        release() { released = true }
      }
    }
  }))
  const rows = await repository.getLongestInventoryRows({
    is_new: 0,
    purchase_cost: null,
    purchase_cost_is_null: true,
    brand_id: 1,
    model_id: 2,
    color_id: 3,
    memory_id: 4,
    store_id: 5
  })
  assert.deepEqual(rows, [{ id: 7 }])
  assert.deepEqual(executed.params, [0, 1, 2, 3, 4, 5])
  assert.match(executed.sql, /p\.purchase_cost IS NULL/)
  assert.match(executed.sql, /p\.status = "in_stock"/)
  assert.match(executed.sql, /ORDER BY p\.inventory_time ASC/)
  assert.equal(released, true)
})

test('sold-timeline and identifier search controller preserve permissions, exact-first behavior and responses', async () => {
  const calls = []
  const controller = new PhoneInventoryQueryController({
    service: {
      async getSoldTimeline() { return [{ id: 1 }] },
      async searchByIdentifier(keyword) {
        calls.push(keyword)
        return keyword === 'exact' ? { exact: { id: 2 }, fuzzy: [] } : { exact: null, fuzzy: [{ id: 3 }] }
      }
    },
    response,
    logger: { error() {} }
  })

  const sold = makeResponse()
  await controller.getSoldTimeline({}, sold)
  assert.deepEqual(sold.body.data, [{ id: 1 }])
  assert.equal(sold.body.message, '获取已销售手机时间线数据成功')

  const missing = makeResponse()
  await controller.searchByIdentifier({ query: {} }, missing)
  assert.equal(missing.statusCode, 400)
  assert.equal(calls.length, 0)

  const exact = makeResponse()
  await controller.searchByIdentifier({ query: { keyword: ' exact ' } }, exact)
  assert.deepEqual(exact.body.data, { id: 2, match_type: 'exact' })
  assert.equal(exact.body.message, '查询成功')

  const fuzzy = makeResponse()
  await controller.searchByIdentifier({ query: { keyword: ' fuzzy ' } }, fuzzy)
  assert.deepEqual(fuzzy.body.data, [{ id: 3, match_type: 'fuzzy' }])
  assert.equal(fuzzy.body.message, '找到 1 个相似商品')
  assert.deepEqual(calls, ['exact', 'fuzzy'])

  const route = fs.readFileSync(path.join(__dirname, '../src/routes/phones.js'), 'utf8')
  assert.ok(route.includes("router.get('/sold-timeline', unifiedAuth, requirePermission('system:edit'), phoneInventoryQueryController.getSoldTimeline.bind(phoneInventoryQueryController))"))
  assert.ok(route.includes("router.get('/search-by-identifier', unifiedAuth, requirePermission('query:view'), phoneInventoryQueryController.searchByIdentifier.bind(phoneInventoryQueryController))"))
  assert.ok(route.indexOf("router.get('/search-by-identifier'") < route.indexOf("router.get('/:id'"))
})

test('phone inventory list controller delegates the authenticated inventory route and preserves response data', async () => {
  const query = { page: '2', page_size: '5', search: '123456789012345' }
  const result = { phones: [{ id: 9, purchase_cost: null, condition: 'used' }], pagination: { page: 2, page_size: 5 } }
  const controller = new PhoneInventoryQueryController({
    service: { async listInventoryPhones(value) { assert.equal(value, query); return result } },
    response,
    logger: { error() {} }
  })
  const responseValue = makeResponse()
  await controller.listInventoryPhones({ query }, responseValue)
  assert.equal(responseValue.body.success, true)
  assert.deepEqual(responseValue.body.data, result)

  const route = fs.readFileSync(path.join(__dirname, '../src/routes/phones.js'), 'utf8')
  assert.ok(route.includes("router.get('/', unifiedAuth, requirePermission('inventory:view'), phoneInventoryQueryController.listInventoryPhones.bind(phoneInventoryQueryController))"))
})

test('phone inventory list service bounds pagination and maps nullable values and condition', async () => {
  const calls = []
  const service = new PhoneInventoryQueryService({
    repository: {
      async listInventoryPhones(query, pagination) {
        calls.push({ query, pagination })
        return {
          phones: [{ id: 9, purchase_cost: undefined, sale_price: '0', inventory_time: '', sale_time: null, is_new: 1 }],
          total: 11
        }
      }
    }
  })

  const result = await service.listInventoryPhones({ page: '-2', page_size: '99999' })
  assert.deepEqual(calls, [{
    query: { page: '-2', page_size: '99999' },
    pagination: { page: 1, page_size: 10000 }
  }])
  assert.deepEqual(result, {
    phones: [{ id: 9, purchase_cost: null, sale_price: '0', inventory_time: null, sale_time: null, is_new: 1, condition: 'new' }],
    pagination: { page: 1, page_size: 10000, total: 11, total_pages: 1, has_next: false, has_prev: false }
  })
})

test('phone inventory list repository binds filter and pagination values and releases its connection', async () => {
  const queries = []
  let released = false
  const repository = new PhoneInventoryQueryRepository(() => ({
    async getConnection() {
      return {
        async execute(sql, params) {
          queries.push({ sql, params })
          return queries.length === 1 ? [[{ total: 1 }]] : [[{ id: 9, is_new: 0 }]]
        },
        release() { released = true }
      }
    }
  }))

  const result = await repository.listInventoryPhones({
    brand_id: '2',
    store_id: '4',
    status: 'available',
    condition: 'used',
    date: '2026-11-01,2026-11-07',
    search: '123456789012345'
  }, { page: 2, page_size: 5 })

  assert.deepEqual(result, { phones: [{ id: 9, is_new: 0 }], total: 1 })
  assert.deepEqual(queries[0].params, [2, 4, 'in_stock', 0, '2026-11-01', '2026-11-07', '123456789012345'])
  assert.match(queries[0].sql, /COALESCE\(p\.is_preordered, 0\) = 1/)
  assert.match(queries[0].sql, /THEN 'in_stock'/)
  assert.match(queries[0].sql, /p\.inventory_time BETWEEN \? AND \?/)
  assert.match(queries[0].sql, /p\.imei = \?/)
  assert.deepEqual(queries[1].params, [...queries[0].params, 5, 5])
  assert.match(queries[1].sql, /latest_sale/)
  assert.match(queries[1].sql, /LIMIT \? OFFSET \?/)
  assert.equal(released, true)
})

test('phone deletion route preserves its permission set and delegates without changing unscoped service behavior', async () => {
  let deletedId
  const controller = new PhoneInventoryQueryController({
    deleteService: {
      async deletePhoneRecord(id) {
        deletedId = id
        return { data: { success: true, deletedRecords: { sales: 2, phone: 1 } } }
      }
    },
    response,
    logger: { error() {} }
  })
  const result = makeResponse()
  await controller.deleteInventoryPhone({ params: { id: '27' } }, result)
  assert.equal(deletedId, 27)
  assert.deepEqual(result.body.data, { success: true, deletedRecords: { sales: 2, phone: 1 } })
  assert.equal(result.body.message, '手机删除成功')

  const route = fs.readFileSync(path.join(__dirname, '../src/routes/phones.js'), 'utf8')
  assert.match(route, /requireAnyPermission\(\['phones:delete', 'sales:delete', 'sales-editphoneview:delete', 'query:delete', 'inventory:delete'\]\),\s*phoneInventoryQueryController\.deleteInventoryPhone\.bind/)
  assert.doesNotMatch(route, /router\.delete\([\s\S]{0,260}?async\s*\(req, res\)\s*=>/)
})

test('phone query repository retains sold timeline fields and releases its connection', async () => {
  let executed
  let released = false
  const repository = new PhoneInventoryQueryRepository(() => ({
    async getConnection() {
      return {
        async execute(sql, params) {
          executed = { sql, params }
          return [[{ id: 5, sale_time: '2026-11-01' }]]
        },
        release() { released = true }
      }
    }
  }))

  assert.deepEqual(await repository.getSoldTimeline(), [{ id: 5, sale_time: '2026-11-01' }])
  assert.deepEqual(executed.params, [])
  assert.match(executed.sql, /ROW_NUMBER\(\) OVER \(PARTITION BY s\.phone_id ORDER BY s\.created_at DESC\)/)
  assert.match(executed.sql, /WHERE p\.status = 'sold'/)
  assert.match(executed.sql, /ORDER BY latest_sale\.sale_time DESC/)
  assert.equal(released, true)
})

test('identifier search repository binds exact and fuzzy values, stops on exact match and always releases', async () => {
  const exactCalls = []
  let exactReleased = false
  const exactRepository = new PhoneInventoryQueryRepository(() => ({
    async getConnection() {
      return {
        async execute(sql, params) {
          exactCalls.push({ sql, params })
          return [[{ id: 2, imei: '123456789012345' }]]
        },
        release() { exactReleased = true }
      }
    }
  }))
  assert.deepEqual(await exactRepository.searchByIdentifier('123456789012345'), {
    exact: { id: 2, imei: '123456789012345' },
    fuzzy: []
  })
  assert.equal(exactCalls.length, 1)
  assert.deepEqual(exactCalls[0].params, ['123456789012345', '123456789012345'])
  assert.match(exactCalls[0].sql, /p\.imei = \? OR p\.serial_number = \?/)
  assert.equal(exactReleased, true)

  const fuzzyCalls = []
  let fuzzyReleased = false
  const fuzzyRepository = new PhoneInventoryQueryRepository(() => ({
    async getConnection() {
      return {
        async execute(sql, params) {
          fuzzyCalls.push({ sql, params })
          return fuzzyCalls.length === 1 ? [[]] : [[{ id: 3 }]]
        },
        release() { fuzzyReleased = true }
      }
    }
  }))
  assert.deepEqual(await fuzzyRepository.searchByIdentifier('ABC'), { exact: null, fuzzy: [{ id: 3 }] })
  assert.deepEqual(fuzzyCalls[1].params, ['%ABC%', '%ABC%', 'ABC', 'ABC', 'ABC%', 'ABC%'])
  assert.match(fuzzyCalls[1].sql, /LIMIT 10/)
  assert.equal(fuzzyReleased, true)
})

test('phone detail controller preserves not-found, nullable fields, sale-store preference and permission route', async () => {
  const controller = new PhoneInventoryQueryController({
    service: {
      async getPhoneDetails(id) {
        assert.equal(id, '17')
        return [{
          id: 17,
          is_new: '1',
          inventory_time: null,
          sale_time: '2026-11-01 10:00:00',
          purchase_cost: null,
          sale_price: '0',
          sale_store_id: 9,
          sale_store_name: '销售门店',
          inventory_store_id: 4,
          inventory_store_name: '库存门店'
        }]
      }
    },
    response,
    logger: { error() {} }
  })
  const res = makeResponse()
  await controller.getPhoneDetails({ params: { id: '17' } }, res)
  assert.deepEqual(res.body.data, {
    id: 17,
    is_new: '1',
    inventory_time: null,
    sale_time: '2026-11-01 10:00:00',
    condition: 'new',
    purchase_cost: null,
    sale_price: '0',
    sale_store_id: 9,
    sale_store_name: '销售门店',
    inventory_store_id: 4,
    inventory_store_name: '库存门店',
    store_id: 9,
    store_name: '销售门店'
  })

  const missing = new PhoneInventoryQueryController({
    service: { async getPhoneDetails() { return [] } },
    response,
    logger: { error() {} }
  })
  const notFound = makeResponse()
  await missing.getPhoneDetails({ params: { id: '404' } }, notFound)
  assert.equal(notFound.statusCode, 404)
  assert.equal(notFound.body.message, '手机不存在')

  const route = fs.readFileSync(path.join(__dirname, '../src/routes/phones.js'), 'utf8')
  assert.ok(route.includes("router.get('/:id', unifiedAuth, requirePermission('sales:view'), phoneInventoryQueryController.getPhoneDetails.bind(phoneInventoryQueryController))"))
})

test('phone detail repository keeps sales and inventory joins and releases connection', async () => {
  let executed
  let released = false
  const repository = new PhoneInventoryQueryRepository(() => ({
    async getConnection() {
      return {
        async execute(sql, params) {
          executed = { sql, params }
          return [[{ id: 17, customer_apple_id: 'a@example.com' }]]
        },
        release() { released = true }
      }
    }
  }))
  assert.deepEqual(await repository.getPhoneDetails('17'), [{ id: 17, customer_apple_id: 'a@example.com' }])
  assert.deepEqual(executed.params, ['17'])
  assert.match(executed.sql, /latest_sale\.store_id as sale_store_id/)
  assert.match(executed.sql, /latest_sale\.customer_id/)
  assert.match(executed.sql, /COALESCE\(latest_sale\.operator_id, p\.sale_operator_id\)/)
  assert.match(executed.sql, /WHERE p\.id = \?/)
  assert.equal(released, true)
})
