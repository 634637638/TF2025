'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const InventoryController = require('../src/controllers/inventory.controller')

const createResponse = () => ({
  status(code) { this.statusCode = code; return this },
  json(body) { this.body = body; return this }
})

test('库存列表、统计路由保留统一认证和 inventory:view 权限并委托 controller', () => {
  const route = fs.readFileSync(path.join(__dirname, '../src/routes/inventory.js'), 'utf8')
  for (const [routePath, method] of [
    ['/', 'index'],
    ['/list', 'list'],
    ['/stats/overview', 'overview'],
    ['/stats', 'stats'],
    ['/:id', 'detail']
  ]) {
    assert.match(route, new RegExp(`router\\.get\\('${routePath.replaceAll('/', '\\/')}', unifiedAuth, requirePermission\\('inventory:view'\\), inventoryController\\.${method}\\.bind\\(inventoryController\\)\\)`))
  }
  assert.match(route, /router\.delete\('\/:id', unifiedAuth, requirePermission\('inventory:delete'\), inventoryController\.remove\.bind\(inventoryController\)\)/)
  assert.match(route, /router\.put\('\/:id', unifiedAuth, requirePermission\('inventory:edit'\), inventoryController\.update\.bind\(inventoryController\)\)/)
  assert.match(route, /sold: \['inventory:sell', 'system'\]/)
  assert.match(route, /peer_transfer: \['sales:wholesale', 'business'\]/)
  assert.match(route, /supplier_proxy: \['sales:proxy-transfer', 'business'\]/)
  assert.match(route, /router\.post\('\/quick-sale', unifiedAuth, requireQuickSalePermission, inventoryController\.quickSale\.bind\(inventoryController\)\)/)
  assert.doesNotMatch(route.slice(0, route.indexOf("router.get('/:id'")), /async\s*\(/)
})

test('快速出库成功时沿用单号、收款、积分和同一事务提交', async () => {
  const events = []
  const calls = []
  const controller = new InventoryController({
    database: () => ({
      async getConnection() {
        return {
          async execute(sql, params) {
            calls.push({ sql, params })
            if (sql.includes('FROM brands')) return [[{ id: 1 }]]
            if (sql.includes('FROM models')) return [[{ id: 2 }]]
            if (sql.includes('FROM colors')) return [[{ id: 3 }]]
            if (sql.includes('FROM memories')) return [[{ id: 4 }]]
            if (sql.includes('SELECT id FROM customers')) return [[{ id: 25 }]]
            if (sql.includes('UPDATE customers SET')) return [{ affectedRows: 1 }]
            if (sql.includes('WHERE p.imei = ?')) return [[]]
            if (sql === 'SELECT id FROM phones WHERE imei = ?') return [[]]
            if (sql.includes('INSERT INTO phones')) return [{ insertId: 81 }]
            if (sql.includes('INSERT INTO sales')) return [{ insertId: 91 }]
            if (sql.includes('UPDATE phones SET sale_id')) return [{ affectedRows: 1 }]
            if (sql.includes('INSERT INTO payment_records')) return [{ insertId: 101 }]
            throw new Error(`未预期的 SQL: ${sql}`)
          },
          async beginTransaction() { events.push('begin') },
          async commit() { events.push('commit') },
          async rollback() { events.push('rollback') },
          release() { events.push('release') }
        }
      }
    }),
    logger: { debug() {}, error() {} },
    validateImei: () => ({ valid: true, normalizedImei: '123456789012345', normalizedSerialNumber: 'SERIAL-81' }),
    normalizeDateTime: value => value,
    prepareInvoiceNumberTransaction: async () => events.push('prepare'),
    generateInvoiceNumber: async (type, _connection, date) => {
      assert.equal(type, 'retail')
      assert.equal(date, '2026-11-07 10:00:00')
      return '202611070001XS'
    },
    reconcileCustomerPointsForSale: async input => {
      assert.equal(input.saleId, 91)
      assert.equal(input.customerId, 25)
      assert.equal(input.saleType, 'retail')
      assert.equal(input.salePrice, 200)
      return { points: 20 }
    }
  })
  const response = createResponse()

  await controller.quickSale({
    user: { id: 7 },
    body: {
      brand_id: 1, model_id: 2, color_id: 3, memory_id: 4,
      is_new: 1, imei: 'imei-input', serial_number: 'SERIAL-81',
      supplier_id: 8, store_id: 9, purchase_cost: 100, sale_price: 200,
      customer_name: 'Customer', customer_phone: '13800000000', apple_id: ' apple@example.com ',
      inventory_time: '2026-11-07 09:00:00', sale_time: '2026-11-07 10:00:00',
      sale_operator_id: 10, payment_method: 'mobile', payment_channel: 'wechat', status: 'sold'
    }
  }, response)

  assert.equal(response.statusCode, 200, JSON.stringify(response.body))
  assert.equal(response.body.data.phone_id, 81)
  assert.equal(response.body.data.sale_id, 91)
  assert.equal(response.body.data.invoice_number, '202611070001XS')
  assert.equal(response.body.data.points_earned, 20)
  assert.equal(response.body.data.payment_channel, 'wechat')
  assert.ok(calls.some(({ sql, params }) => sql.includes('INSERT INTO phones') && params[1] === 7))
  assert.ok(calls.some(({ sql, params }) => sql.includes('INSERT INTO payment_records') && params[0] === 91))
  assert.deepEqual(events, ['prepare', 'begin', 'commit', 'release'])
})

test('快速出库输入拒绝和数据库失败都会回滚并释放连接', async () => {
  const run = async ({ body, failure }) => {
    const events = []
    const controller = new InventoryController({
      database: () => ({
        async getConnection() {
          return {
            async execute() {
              if (failure) throw Object.assign(new Error('database unavailable'), { code: 'ER_TEST_FAILURE' })
              return [[]]
            },
            async beginTransaction() { events.push('begin') },
            async rollback() { events.push('rollback') },
            async commit() { events.push('commit') },
            release() { events.push('release') }
          }
        }
      }),
      logger: { debug() {}, error() {} },
      validateImei: () => ({ valid: true, normalizedImei: '123456789012345', normalizedSerialNumber: 'SERIAL-1' }),
      prepareInvoiceNumberTransaction: async () => events.push('prepare')
    })
    const response = createResponse()
    await controller.quickSale({ user: { id: 7 }, body }, response)
    return { response, events }
  }

  const invalid = await run({ body: { status: 'sold' } })
  assert.equal(invalid.response.statusCode, 400)
  assert.match(invalid.response.body.message, /设备信息不完整/)
  assert.deepEqual(invalid.events, [])

  const databaseFailure = await run({
    failure: true,
    body: {
      brand_id: 1, model_id: 2, color_id: 3, memory_id: 4,
      imei: 'imei-input', serial_number: 'SERIAL-1', supplier_id: 8, store_id: 9,
      purchase_cost: 100, sale_price: 200, customer_phone: '13800000000',
      inventory_time: '2026-11-07 09:00:00', sale_time: '2026-11-07 10:00:00',
      sale_operator_id: 10, payment_method: 'cash'
    }
  })
  assert.equal(databaseFailure.response.statusCode, 500, JSON.stringify(databaseFailure.response.body))
  assert.deepEqual(databaseFailure.events, ['prepare', 'begin', 'rollback', 'release'])
})

test('库存根路径仍保留 301 列表重定向', () => {
  let redirect
  const controller = new InventoryController()
  controller.index({}, { redirect(status, location) { redirect = { status, location }; return this } })
  assert.deepEqual(redirect, { status: 301, location: '/list' })
})

test('库存列表保留筛选、分页响应字段及连接释放', async () => {
  const calls = []
  const events = []
  const controller = new InventoryController({
    connected: () => true,
    database: () => ({
      async getConnection() {
        return {
          async execute(sql, params) {
            calls.push({ sql, params })
            if (sql.includes('COUNT(*) AS total')) return [[{ total: 21 }]]
            return [[{
              id: 7, imei: '123456789012345', serial_number: 'SERIAL00001',
              model: 'Model', brand: 'Brand', color: 'Black', memory: '128GB',
              phone_condition: 'A', purchase_cost: '100', sale_price: '200',
              store_id: 2, supplier_id: 3, status: 'in_stock', is_new: 1,
              is_preordered: 0, inventory_time: '2026-11-01 08:00:00', sale_time: null,
              supplier_name: 'Supplier', store_name: 'Store', purchase_number: 'PO-1',
              inventory_operator_id: 4, inventory_operator_name: 'Operator',
              preorder_id: null, preorder_customer_id: null,
              preorder_customer_name: null, preorder_customer_phone: null,
              preorder_deposit_amount: null, preorder_total_price: null,
              preorder_actual_price: null, remarks: null
            }]]
          },
          release() { events.push('release') }
        }
      }
    }),
    logger: { debug() {}, error() {} }
  })
  const response = createResponse()

  await controller.list({ query: {
    page: '2', page_size: '10', store_id: '2', supplier_id: '3',
    status: 'available', date: '2026-11-01'
  } }, response)

  assert.equal(calls.length, 2)
  assert.deepEqual(calls[0].params, ['sold', 'peer_transfer', 'supplier_proxy', 2, 3, 'in_stock', '2026-11-01'])
  assert.match(calls[0].sql, /DATE\(p\.inventory_time\) = \?/)
  assert.match(calls[0].sql, /LIMIT 10 OFFSET 10/)
  assert.deepEqual(response.body.data.pagination, {
    page: 2, page_size: 10, total: 21, total_pages: 3, has_next: true, has_prev: true
  })
  assert.equal(response.body.data.data[0].condition, 'new')
  assert.equal(response.body.data.data[0].purchase_cost, 100)
  assert.equal(response.body.data.data[0].preorder_deposit_amount, null)
  assert.deepEqual(events, ['release'])
})

test('库存详情验证 ID、格式化预订状态并在所有查询路径释放连接', async () => {
  const events = []
  let rowCount = 1
  const controller = new InventoryController({
    database: () => ({
      async getConnection() {
        return {
          async execute(sql, params) {
            assert.match(sql, /LEFT JOIN users u ON p\.inventory_operator_id = u\.id/)
            assert.deepEqual(params, [12])
            return [rowCount ? [{
              id: 12, brand_id: 1, model_id: 2, color_id: 3, memory_id: 4,
              imei: '123456789012345', serial_number: 'SERIAL-12',
              purchase_cost: '100', sale_price: '200', supplier_id: 5, store_id: 6,
              inventory_time: '2026-11-01 08:00:00', sale_time: null,
              quality_grade: 'A', purchase_remarks: '备注', is_new: 1,
              status: 'in_stock', is_preordered: 1, brand: 'Brand', model: 'Model',
              color: 'Black', memory: '128GB', supplier_name: 'Supplier',
              store_name: 'Store', operator_name: 'Operator'
            }] : []]
          },
          release() { events.push('release') }
        }
      }
    }),
    logger: { debug() {}, error() {} }
  })

  const invalid = createResponse()
  await controller.detail({ params: { id: 'abc' } }, invalid)
  assert.equal(invalid.statusCode, 400)

  const success = createResponse()
  await controller.detail({ params: { id: '12' } }, success)
  assert.equal(success.body.data.status, 'reserved')
  assert.equal(success.body.data.condition, 'new')
  assert.equal(success.body.data.remarks, '备注')
  assert.equal(success.body.data.operator_name, 'Operator')
  assert.deepEqual(events, ['release'])

  rowCount = 0
  const missing = createResponse()
  await controller.detail({ params: { id: '12' } }, missing)
  assert.equal(missing.statusCode, 404)
  assert.deepEqual(events, ['release', 'release'])
})

test('库存删除拒绝无效、已交易、预订和有关联记录的设备并回滚', async () => {
  const runDelete = async ({ item, related = [0, 0, 0] }) => {
    const events = []
    let relationIndex = 0
    const controller = new InventoryController({
      database: () => ({
        async getConnection() {
          return {
            async beginTransaction() { events.push('begin') },
            async execute(sql) {
              if (sql.includes('FROM phones WHERE id')) return [[item].filter(Boolean)]
              if (sql.includes('FROM rentals')) return [[{ count: related[relationIndex++] }]]
              if (sql.includes('FROM sales')) return [[{ count: related[relationIndex++] }]]
              if (sql.includes('FROM repairs')) return [[{ count: related[relationIndex++] }]]
              if (sql.startsWith('DELETE FROM phones')) {
                events.push('delete')
                return [{ affectedRows: 1 }]
              }
              throw new Error(`未预期的 SQL: ${sql}`)
            },
            async rollback() { events.push('rollback') },
            async commit() { events.push('commit') },
            release() { events.push('release') }
          }
        }
      }),
      logger: { debug() {}, error() {} }
    })
    const response = createResponse()
    await controller.remove({ params: { id: '15' } }, response)
    return { events, response }
  }

  const reserved = await runDelete({ item: { id: 15, status: 'in_stock', is_preordered: 1, imei: 'imei' } })
  assert.equal(reserved.response.statusCode, 400)
  assert.match(reserved.response.body.message, /预订设备不能直接删除/)
  assert.deepEqual(reserved.events, ['begin', 'rollback', 'release'])

  const completed = await runDelete({ item: { id: 15, status: 'sold', is_preordered: 0, imei: 'imei' } })
  assert.equal(completed.response.statusCode, 400)
  assert.match(completed.response.body.message, /已完成交易/)
  assert.deepEqual(completed.events, ['begin', 'rollback', 'release'])

  const linked = await runDelete({
    item: { id: 15, status: 'in_stock', is_preordered: 0, imei: 'imei' },
    related: [0, 0, 2]
  })
  assert.equal(linked.response.statusCode, 400)
  assert.match(linked.response.body.message, /维修记录\(2条\)/)
  assert.deepEqual(linked.events, ['begin', 'rollback', 'release'])
})

test('库存删除成功提交并返回删除摘要，缺少记录时回滚', async () => {
  const events = []
  let found = true
  const controller = new InventoryController({
    database: () => ({
      async getConnection() {
        return {
          async beginTransaction() { events.push('begin') },
          async execute(sql) {
            if (sql.startsWith('DELETE FROM phones')) {
              events.push('delete')
              return [{ affectedRows: 1 }]
            }
            if (sql.includes('FROM phones WHERE id')) return [[...(found ? [{ id: 15, status: 'in_stock', is_preordered: 0, imei: 'imei-value' }] : [])]]
            if (sql.includes('FROM rentals') || sql.includes('FROM sales') || sql.includes('FROM repairs')) return [[{ count: 0 }]]
            throw new Error(`未预期的 SQL: ${sql}`)
          },
          async rollback() { events.push('rollback') },
          async commit() { events.push('commit') },
          release() { events.push('release') }
        }
      }
    }),
    logger: { debug() {}, error() {} }
  })
  const success = createResponse()
  await controller.remove({ params: { id: '15' } }, success)
  assert.equal(success.body.message, '商品删除成功')
  assert.deepEqual(success.body.data, { id: 15, deleted: true, item: { id: 15, imei: 'imei-value' } })
  assert.deepEqual(events, ['begin', 'delete', 'commit', 'release'])

  events.length = 0
  found = false
  const missing = createResponse()
  await controller.remove({ params: { id: '15' } }, missing)
  assert.equal(missing.statusCode, 404)
  assert.deepEqual(events, ['begin', 'rollback', 'release'])
})

test('库存更新保留统一权限、旧入库时间兼容、字段映射和事务提交', async () => {
  const events = []
  const calls = []
  const controller = new InventoryController({
    database: () => ({
      async getConnection() {
        return {
          async beginTransaction() { events.push('begin') },
          async execute(sql, params) {
            calls.push({ sql, params })
            if (sql.includes('SELECT id, imei, status, is_preordered')) return [[{ id: 15, imei: 'old-imei' }]]
            if (sql.includes('SELECT id FROM phones WHERE imei')) return [[]]
            if (sql.includes('FROM suppliers')) return [[{ id: 3 }]]
            if (sql.includes('FROM stores')) return [[]]
            if (sql.startsWith('UPDATE phones SET')) {
              events.push('update')
              return [{ affectedRows: 1 }]
            }
            if (sql.startsWith('SELECT id, imei, serial_number, purchase_cost')) return [[{
              id: 15, imei: 'new-imei', serial_number: 'SERIAL-15',
              purchase_cost: 100, quality_grade: 'A', inventory_time: '2026-11-07', sale_time: null
            }]]
            throw new Error(`未预期的 SQL: ${sql}`)
          },
          async rollback() { events.push('rollback') },
          async commit() { events.push('commit') },
          release() { events.push('release') }
        }
      }
    }),
    logger: { debug() {}, error() {} }
  })
  const response = createResponse()

  await controller.update({
    params: { id: '15' },
    body: {
      imei: 'new-imei', serial_number: 'SERIAL-15', price: 100,
      supplier_id: 3, store_id: 99, Inventorytime: '2026-11-07', is_new: 1
    }
  }, response)

  const updateCall = calls.find(call => call.sql.startsWith('UPDATE phones SET'))
  assert.match(updateCall.sql, /purchase_cost = \?, sale_price = \?, supplier_id = \?, inventory_time = \?, quality_grade = \?, is_new = \?/)
  assert.doesNotMatch(updateCall.sql, /store_id|brand_id|model_id|color_id|memory_id|status =/)
  assert.deepEqual(updateCall.params, ['new-imei', 'SERIAL-15', 100, 120, 3, '2026-11-07', 'A', 1, '15'])
  assert.deepEqual(response.body.data, {
    id: 15, imei: 'new-imei', serial_number: 'SERIAL-15', purchase_cost: 100,
    quality_grade: 'A', inventory_time: '2026-11-07', sale_time: null
  })
  assert.deepEqual(events, ['begin', 'update', 'commit', 'release'])
})

test('库存更新对无效 ID、重复 IMEI 和缺少设备分别响应并回滚', async () => {
  const createController = ({ existing = [{ id: 15, imei: 'old-imei' }], conflict = false } = {}) => {
    const events = []
    const controller = new InventoryController({
      database: () => ({
        async getConnection() {
          return {
            async beginTransaction() { events.push('begin') },
            async execute(sql) {
              if (sql.includes('SELECT id, imei, status, is_preordered')) return [existing]
              if (sql.includes('SELECT id FROM phones WHERE imei')) return [conflict ? [{ id: 99 }] : []]
              throw new Error(`未预期的 SQL: ${sql}`)
            },
            async rollback() { events.push('rollback') },
            async commit() { events.push('commit') },
            release() { events.push('release') }
          }
        }
      }),
      logger: { debug() {}, error() {} }
    })
    return { controller, events }
  }

  const invalidSetup = createController()
  const invalid = createResponse()
  await invalidSetup.controller.update({ params: { id: 'x' }, body: {} }, invalid)
  assert.equal(invalid.statusCode, 400)
  assert.deepEqual(invalidSetup.events, [])

  const conflictSetup = createController({ conflict: true })
  const conflict = createResponse()
  await conflictSetup.controller.update({ params: { id: '15' }, body: { imei: 'duplicate' } }, conflict)
  assert.equal(conflict.statusCode, 400)
  assert.match(conflict.body.message, /IMEI号已被其他商品使用/)
  assert.deepEqual(conflictSetup.events, ['begin', 'rollback', 'release'])

  const missingSetup = createController({ existing: [] })
  const missing = createResponse()
  await missingSetup.controller.update({ params: { id: '15' }, body: {} }, missing)
  assert.equal(missing.statusCode, 404)
  assert.deepEqual(missingSetup.events, ['begin', 'rollback', 'release'])
})

test('库存汇总统计和基础统计复用规范状态及筛选参数', async () => {
  const calls = []
  const controller = new InventoryController({
    connected: () => true,
    database: () => ({
      async execute(sql, params) {
        calls.push({ sql, params })
        if (sql.includes('AS total_value')) return [[{ total: '3', new_count: '2', used_count: '1', total_value: '450' }]]
        if (sql.includes('AS store_name')) return [[{ store_name: 'Store A', count: 3 }]]
        if (sql.includes('AS brand_name')) return [[{ brand_name: 'Brand A', count: 3 }]]
        if (sql.includes('AS inStock')) return [[{ inStock: 2 }]]
        if (sql.includes('AS sold')) return [[{ sold: 1 }]]
        if (sql.includes('AS totalValue')) return [[{ totalValue: '450' }]]
        return [[{ total: 3 }]]
      }
    }),
    logger: { error() {} }
  })
  const overview = createResponse()
  await controller.overview({ query: { store_id: '9', search: '128gb' } }, overview)
  assert.equal(calls.length, 3)
  assert.deepEqual(calls[0].params, ['sold', 'peer_transfer', 'supplier_proxy', 9, '%128GB%'])
  assert.equal(overview.body.data.by_store['Store A'], 3)
  assert.equal(overview.body.data.by_brand['Brand A'], 3)

  calls.length = 0
  const stats = createResponse()
  await controller.stats({ query: {} }, stats)
  assert.equal(calls.length, 4)
  assert.ok(calls.every(call => call.params.length === 3))
  assert.match(calls[0].sql, /COALESCE\(status, ''\) NOT IN/)
  assert.deepEqual(stats.body.data, { total: 3, inStock: 2, sold: 1, totalValue: 450 })
})
