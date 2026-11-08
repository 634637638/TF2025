'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const AnalyticsInventoryController = require('../src/controllers/analytics-inventory.controller')
const AnalyticsInventoryService = require('../src/services/analytics-inventory.service')
const AnalyticsInventoryRepository = require('../src/repositories/analytics-inventory.repository')

const response = () => ({
  status(code) { this.statusCode = code; return this },
  json(body) { this.body = body; return this }
})

test('low stock route preserves authentication, business-user middleware and inventory permission', () => {
  const route = fs.readFileSync(path.join(__dirname, '../src/routes/analytics.js'), 'utf8')
  assert.match(route, /router\.use\('\/inventory', requirePermission\('inventory:view'\)\)/)
  assert.match(route, /router\.get\('\/inventory\/low-stock', unifiedAuth, requireBusinessUser, analyticsInventoryController\.getLowStock\.bind\(analyticsInventoryController\)\)/)
})

test('inventory overview route retains middleware and delegates to the analytics controller', () => {
  const route = fs.readFileSync(path.join(__dirname, '../src/routes/analytics.js'), 'utf8')
  assert.match(route, /router\.use\('\/inventory', requirePermission\('inventory:view'\)\)/)
  assert.match(route, /router\.get\('\/inventory', unifiedAuth, requireBusinessUser, analyticsInventoryController\.getOverview\.bind\(analyticsInventoryController\)\)/)
})

test('inventory overview controller parses both filters and preserves response/error mapping', async () => {
  const calls = []
  const controller = new AnalyticsInventoryController({
    service: { async getOverview(options) { calls.push(options); return { total_products: 2, low_stock_items: 1 } } }
  })
  const result = response()
  await controller.getOverview({ query: { store_id: '4', supplier_id: '9' } }, result)
  assert.deepEqual(calls, [{ storeId: 4, supplierId: 9 }])
  assert.deepEqual(result.body.data, { total_products: 2, low_stock_items: 1 })

  const errors = []
  const failureController = new AnalyticsInventoryController({
    service: { async getOverview() { throw new Error('query failed') } },
    logger: { error(...args) { errors.push(args) } }
  })
  const failure = response()
  await failureController.getOverview({ query: {} }, failure)
  assert.equal(failure.statusCode, 500)
  assert.equal(failure.body.message, '服务器内部错误，请稍后重试')
  assert.equal(errors.length, 1)
})

test('inventory overview service preserves warning score, recommendations and category contracts', async () => {
  const service = new AnalyticsInventoryService({
    connected: () => true,
    repository: {
      async getModelStockWarnings(...args) {
        assert.deepEqual(args, [undefined, 500, { storeId: 3, supplierId: null }])
        return [{ stock_count: '0', warning_threshold: '4', avg_cost: '25' }]
      }
    },
    turnoverRepository: {
      async getOverviewData(options) {
        assert.deepEqual(options, { storeId: 3, supplierId: null })
        return {
          summary: { totalProducts: '10', availableProducts: '5', totalValue: '125.5' },
          brands: [{ brand_name: '品牌', totalItems: '5', totalValue: '100' }],
          turnover: { soldLast30Days: '2', availableNow: '4' },
          suppliers: [{ id: 8, name: '供应商', totalProducts: '4', totalValue: '90', availableProducts: '2' }]
        }
      }
    }
  })
  const result = await service.getOverview({ storeId: 3, supplierId: null })
  assert.equal(result.total_products, 10)
  assert.equal(result.total_value, 125.5)
  assert.equal(result.stock_turnover, 15)
  assert.equal(result.inventory_health.score, 80)
  assert.equal(result.inventory_health.issues[1].potential_loss, 100)
  assert.deepEqual(result.inventory_health.recommendations, ['及时补充库存不足的商品', '优先补货已售罄的热销型号', '定期进行库存盘点确保数据准确性'])
  assert.equal(result.category_analysis[0].turnover_rate, 12)
  assert.equal(result.supplier_analysis[0].quality_score, 50)
})

test('inventory overview repository binds optional filters in query order', async () => {
  const calls = []
  const repository = new AnalyticsInventoryRepository({
    database: () => ({
      async query(query, params) {
        calls.push({ query, params })
        return calls.length === 1 ? [[{}]] : calls.length === 4 ? [[{}]] : [[]]
      }
    })
  })
  await repository.getOverviewData({ storeId: 4, supplierId: 9 })
  assert.equal(calls.length, 4)
  assert.ok(calls.every(call => call.params.join(',') === '4,9'))
  assert.ok(calls.every(call => call.query.includes('store_id = ?') && call.query.includes('supplier_id = ?')))
})

test('low stock controller keeps bounded page_size, optional filters and response shape', async () => {
  const controller = new AnalyticsInventoryController({
    service: {
      async getLowStock(options) {
        assert.deepEqual(options, { limit: 500, storeId: 4, supplierId: null })
        return [{ id: '1-0-0-all-0', current_stock: 0, stock_status: 'out_of_stock' }]
      }
    }
  })
  const result = response()
  await controller.getLowStock({ query: { page_size: '900', store_id: '4', supplier_id: 'null' } }, result)

  assert.equal(result.statusCode, 200)
  assert.deepEqual(result.body.data, [{ id: '1-0-0-all-0', current_stock: 0, stock_status: 'out_of_stock' }])
  assert.equal(result.body.message, '获取低库存预警成功')
})

test('low stock service checks connectivity and maps warning rows to dashboard items', async () => {
  const disconnected = new AnalyticsInventoryService({ connected: () => false, repository: {} })
  await assert.rejects(disconnected.getLowStock({}), { statusCode: 500, message: '数据库连接失败' })

  const service = new AnalyticsInventoryService({
    connected: () => true,
    repository: {
      async getModelStockWarnings(...args) {
        assert.deepEqual(args, [undefined, 25, { storeId: 4, supplierId: 9 }])
        return [{
          model_id: 2, color_id: 3, memory_id: 4, warning_condition: 'used', brand_name: '品牌',
          model_name: '型号', color_name: null, memory_name: '256G', condition_label: '二手',
          stock_count: '2', warning_threshold: '3', avg_cost: '10.5'
        }]
      }
    }
  })

  assert.deepEqual(await service.getLowStock({ limit: 25, storeId: 4, supplierId: 9 }), [{
    id: '2-3-4-used-0', brand: '品牌', model: '型号 256G · 二手', color: '默认', current_stock: 2,
    reorder_point: 3, unit_cost: 10.5, total_value: 21, last_sale_time: null, stock_status: 'low_stock'
  }])
})

test('inventory turnover route preserves authentication and delegates to its controller', () => {
  const route = fs.readFileSync(path.join(__dirname, '../src/routes/analytics.js'), 'utf8')
  assert.match(route, /router\.use\('\/inventory', requirePermission\('inventory:view'\)\)/)
  assert.match(route, /router\.get\('\/inventory\/turnover', unifiedAuth, requireBusinessUser, analyticsInventoryController\.getTurnover\.bind\(analyticsInventoryController\)\)/)
})

test('supplier stats route preserves authentication and delegates to its controller', () => {
  const route = fs.readFileSync(path.join(__dirname, '../src/routes/analytics.js'), 'utf8')
  assert.match(route, /router\.get\('\/inventory\/supplier-stats', unifiedAuth, requireBusinessUser, analyticsInventoryController\.getSupplierStats\.bind\(analyticsInventoryController\)\)/)
})

test('inventory value route preserves authentication and delegates to its controller', () => {
  const route = fs.readFileSync(path.join(__dirname, '../src/routes/analytics.js'), 'utf8')
  assert.match(route, /router\.get\('\/inventory\/value', unifiedAuth, requireBusinessUser, analyticsInventoryController\.getValue\.bind\(analyticsInventoryController\)\)/)
})

test('recent sold route preserves authentication and delegates to its controller', () => {
  const route = fs.readFileSync(path.join(__dirname, '../src/routes/analytics.js'), 'utf8')
  assert.match(route, /router\.get\('\/inventory\/recent-sold', unifiedAuth, requireBusinessUser, analyticsInventoryController\.getRecentSold\.bind\(analyticsInventoryController\)\)/)
})

test('inventory turnover controller normalizes filters and preserves response payload', async () => {
  const controller = new AnalyticsInventoryController({
    service: {
      async getTurnover(options) {
        assert.deepEqual(options, { period: '90d', storeId: 3, supplierId: null })
        return [{ date: '2026-11-01', actual_turnover: 0.25, target_turnover: 0.08 }]
      }
    }
  })
  const result = response()
  await controller.getTurnover({ query: { period: '90d', store_id: '3', supplier_id: 'null' } }, result)

  assert.equal(result.statusCode, 200)
  assert.deepEqual(result.body.data, [{ date: '2026-11-01', actual_turnover: 0.25, target_turnover: 0.08 }])
})

test('inventory turnover service selects the requested range and avoids division by zero', async () => {
  const calls = []
  const service = new AnalyticsInventoryService({
    connected: () => true,
    turnoverRepository: {
      async getTurnoverData(options) {
        calls.push(options)
        return { sales: [{ date: '2026-11-01', soldCount: '4' }], availableCount: '0' }
      }
    }
  })

  assert.deepEqual(await service.getTurnover({ period: '180d', storeId: 2, supplierId: 7 }), [
    { date: '2026-11-01', actual_turnover: 0, target_turnover: 0.08 }
  ])
  assert.deepEqual(calls, [{ days: 180, storeId: 2, supplierId: 7 }])
})

test('inventory turnover repository binds range and optional filters to both queries', async () => {
  const calls = []
  const repository = new AnalyticsInventoryRepository({
    database: () => ({
      async query(query, params) {
        calls.push({ query, params })
        return calls.length === 1
          ? [[{ date: '2026-11-01', soldCount: '2' }]]
          : [[{ availableCount: '8' }]]
      }
    })
  })

  const result = await repository.getTurnoverData({ days: 90, storeId: 4, supplierId: 9 })

  assert.deepEqual(result, { sales: [{ date: '2026-11-01', soldCount: '2' }], availableCount: '8' })
  assert.deepEqual(calls.map(call => call.params), [[90, 4, 9], [4, 9]])
  assert.ok(calls.every(call => call.query.includes('store_id = ?') && call.query.includes('supplier_id = ?')))
})

test('supplier stats controller parses optional filters and preserves response fields', async () => {
  const controller = new AnalyticsInventoryController({
    service: {
      async getSupplierStats(options) {
        assert.deepEqual(options, { storeId: null, supplierId: 8 })
        return { supplier_count: 3 }
      }
    }
  })
  const result = response()
  await controller.getSupplierStats({ query: { store_id: 'null', supplier_id: '8' } }, result)

  assert.equal(result.statusCode, 200)
  assert.deepEqual(result.body.data, { supplier_count: 3 })
})

test('supplier stats repository binds optional filters and service normalizes the result', async () => {
  let call
  const repository = new AnalyticsInventoryRepository({
    database: () => ({
      async query(query, params) {
        call = { query, params }
        return [[{ supplierCount: '3' }]]
      }
    })
  })
  assert.equal(await repository.getSupplierCount({ storeId: 4, supplierId: null }), '3')
  assert.deepEqual(call.params, [4])
  assert.match(call.query, /AND p\.store_id = \?/)
  assert.doesNotMatch(call.query, /AND p\.supplier_id = \?$/m)

  const service = new AnalyticsInventoryService({
    connected: () => true,
    turnoverRepository: { async getSupplierCount() { return '3' } }
  })
  assert.deepEqual(await service.getSupplierStats({ storeId: null, supplierId: 8 }), { supplier_count: 3 })
})

test('inventory value controller normalizes store scope and preserves response shape', async () => {
  const controller = new AnalyticsInventoryController({
    service: {
      async getValue(options) {
        assert.deepEqual(options, { storeId: 5 })
        return { total_value: 25, breakdown: { available: { count: 1, value: 25 }, sold: { count: 0, value: 0 }, reserved: { count: 0, value: 0 } } }
      }
    }
  })
  const result = response()
  await controller.getValue({ query: { store_id: '5' } }, result)
  assert.equal(result.statusCode, 200)
  assert.equal(result.body.data.total_value, 25)
})

test('inventory value repository binds store scope and service normalizes database numerics', async () => {
  let params
  const repository = new AnalyticsInventoryRepository({
    database: () => ({
      async query(query, values) {
        params = values
        assert.match(query, /WHERE store_id = \?/)
        return [[{
          totalValue: '125.5', availableCount: '2', availableValue: '80',
          soldCount: '1', soldValue: '45.5', reservedCount: '0', reservedValue: '0'
        }]]
      }
    })
  })
  const data = await repository.getInventoryValue(6)
  assert.deepEqual(params, [6])

  const service = new AnalyticsInventoryService({
    connected: () => true,
    turnoverRepository: { async getInventoryValue() { return data } }
  })
  assert.deepEqual(await service.getValue({ storeId: 6 }), {
    total_value: 125.5,
    breakdown: {
      available: { count: 2, value: 80 },
      sold: { count: 1, value: 45.5 },
      reserved: { count: 0, value: 0 }
    }
  })
})

test('recent sold controller bounds page_size and preserves filters', async () => {
  const controller = new AnalyticsInventoryController({
    service: {
      async getRecentSold(options) {
        assert.deepEqual(options, { limit: 100, storeId: 3, supplierId: null })
        return [{ brand: '品牌', model: '型号', color: '蓝色', sale_price: 20, sale_time: '2026/11/07 10:00:00', store: '门店' }]
      }
    }
  })
  const result = response()
  await controller.getRecentSold({ query: { page_size: '999', store_id: '3', supplier_id: 'null' } }, result)
  assert.equal(result.statusCode, 200)
  assert.equal(result.body.data[0].sale_price, 20)
})

test('recent sold service maps nullable labels and repository binds filters and limit', async () => {
  let call
  const repository = new AnalyticsInventoryRepository({
    database: () => ({
      async query(query, params) {
        call = { query, params }
        return [[{ brand: null, model: '型号', color: null, salePrice: '25.5', saleDate: new Date('2026-11-07T02:00:00Z'), store: null }]]
      }
    })
  })
  const rows = await repository.getRecentSold({ limit: 20, storeId: 4, supplierId: 8 })
  assert.equal(rows.length, 1)
  assert.deepEqual(call.params, [4, 8, 20])
  assert.match(call.query, /AND p\.store_id = \?/)
  assert.match(call.query, /AND p\.supplier_id = \?/)
  assert.match(call.query, /LIMIT \?/)

  const service = new AnalyticsInventoryService({
    connected: () => true,
    turnoverRepository: { async getRecentSold() { return rows } }
  })
  assert.deepEqual(await service.getRecentSold({ limit: 20, storeId: 4, supplierId: 8 }), [{
    brand: '未知', model: '型号', color: '未知', sale_price: 25.5,
    sale_time: new Date(rows[0].saleDate).toLocaleString('zh-CN'), store: '未知'
  }])
})
