'use strict'
const test = require('node:test')
const assert = require('node:assert/strict')
const AccessoryService = require('../src/services/accessory.service')
const AccessoryRepository = require('../src/repositories/accessory.repository')
const AccessoryController = require('../src/controllers/accessory.controller')
const actor = { id: 7, store_ids: [1, 2] }

test('销售候选要求有效授权门店和严格分页，非法请求不查询数据库', async () => {
  const calls = []
  const service = new AccessoryService({ repository: { async getSaleOptions(input) { calls.push(input); return { data: [], pagination: { total: 0 } } } } })
  await service.getSaleOptions(actor, { store_id: '2', page: '6', page_size: '20', search: '  充电宝  ' }, ['name'])
  assert.deepEqual(calls[0], { storeId: 2, page: 6, pageSize: 20, search: '充电宝', searchFields: ['name'] })
  for (const query of [{}, { store_id: true }, { store_id: ['1'] }, { store_id: 1, page: true }, { store_id: 1, page_size: 101 }, { store_id: 1, search: ['name'] }, { store_id: 1, search: 'a'.repeat(101) }, { store_id: 1, all: true }]) {
    await assert.rejects(service.getSaleOptions(actor, query), { statusCode: 400 })
  }
  await assert.rejects(service.getSaleOptions(actor, { store_id: 3 }), { statusCode: 403 })
  await assert.rejects(service.getSaleOptions({ id: 7 }, { store_id: 1 }), { statusCode: 403 })
  await assert.rejects(service.getSaleOptions(null, { store_id: 1 }))
  assert.equal(calls.length, 1)
})

test('候选计数与分页同条件，实际品牌商品保留独立ID，SN只查同店在库且参数绑定', async () => {
  const repository = new AccessoryRepository(), calls = []
  repository.queryRows = async (sql, params) => {
    calls.push({ sql, params })
    return calls.length === 1 ? [{ total: 125 }] : [{ id: 56, name: '充电宝', brand_name: '品牌乙', quantity: 3, serial_quantity: 1 }]
  }
  const result = await repository.getSaleOptions({ storeId: 2, search: "x' OR 1=1", searchFields: ['name', 'serial_number'], page: 6, pageSize: 20 })
  assert.equal(result.data[0].id, 56)
  assert.deepEqual(result.pagination, { page: 6, page_size: 20, total: 125 })
  for (const { sql, params } of calls) {
    assert.equal(params[0], 2)
    assert.equal(sql.includes("x' OR 1=1"), false)
    assert.match(sql, /sn.store_id = st.store_id/)
    assert.match(sql, /sn.status = 'in_stock'/)
    assert.match(sql, /st.quantity > 0/)
    assert.match(sql, /LEFT JOIN accessories t/)
  }
  assert.deepEqual(calls[0].params, calls[1].params)
  assert.match(calls[1].sql, /LIMIT 20 OFFSET 100/)
  assert.doesNotMatch(calls[1].sql, /purchase_cost|supplier_name|customer_phone/)
})

test('贴膜候选严格筛选启用类型，缺结构明确拒绝，普通销售不要求贴膜字段', async () => {
  const calls = []
  const service = new AccessoryService({ repository: { async getSaleOptions(input) { calls.push(input); return {} } } })
  await service.getSaleOptions(actor, { store_id: 2, film_only: 'true' })
  assert.equal(calls[0].filmOnly, true)
  await service.getSaleOptions(actor, { store_id: 2, film_only: false })
  assert.equal(calls[1].filmOnly, undefined)
  for (const film_only of [1, '1', [], {}, null]) await assert.rejects(service.getSaleOptions(actor, { store_id: 2, film_only }), { statusCode: 400 })
  const repository = new AccessoryRepository({ columnExists: async () => true }), sqls = []
  repository.queryRows = async sql => { sqls.push(sql); return sqls.length === 1 ? [{ total: 0 }] : [] }
  await repository.getSaleOptions({ ...calls[0], searchFields: ['name'] })
  assert.equal(sqls.length, 2)
  for (const sql of sqls) {
    assert.match(sql, /fc.status = 1 AND fc.film_enabled = 1/)
    assert.match(sql, /IF\(a.template_id IS NULL, a.category_id, t.category_id\)/)
    assert.match(sql, /st.store_id = \?/)
  }
  repository.columnExists = async () => false
  await assert.rejects(repository.getSaleOptions(calls[0]), { statusCode: 409, code: 'FILM_SERVICE_NOT_READY' })
  sqls.length = 0
  await repository.getSaleOptions({ ...calls[1], searchFields: ['name'] })
  assert.equal(sqls.length, 2)
  assert.doesNotMatch(sqls.join('\n'), /film_enabled/)
})

test('隐藏字段不参与关键词匹配，候选价格、SN及品牌统一脱敏', async () => {
  let input
  const controller = new AccessoryController({
    service: { async getSaleOptions(user, query, fields) { input = { user, query, fields }; return { data: [{ id: 56, name: '充电宝', barcode: '123', brand_name: '品牌乙', sale_price: 50, quantity: 5, serial_quantity: 1 }], pagination: { total: 125 } } } },
    masking: { async getUserFieldPermissions() { return { hiddenFields: ['basic_info.barcode', 'basic_info.serial_number', 'price_info.sale_price', 'basic_info.brand_name'] } }, filterSensitiveFields: rows => rows }
  })
  const res = { status(code) { this.code = code; return this }, json(body) { this.body = body; return this } }
  await controller.saleOptions({ user: actor, query: { store_id: 1, search: '123' } }, res)
  assert.deepEqual(input.fields, ['name', 'product_model'])
  assert.equal(res.body.data.data[0].barcode, null)
  assert.equal(res.body.data.data[0].brand_name, null)
  assert.equal(res.body.data.data[0].serial_quantity, null)
  assert.equal(res.body.data.data[0].sale_price, null)
  assert.equal(res.body.data.pagination.total, 125)
})

test('必要名称、门店或数量字段隐藏时禁止读取销售候选', async () => {
  for (const field of ['basic_info.name', 'stock_info.distribution', 'stock_info.total_quantity']) {
    const controller = new AccessoryController({ service: { getSaleOptions() { assert.fail('不可查询隐藏字段') } },
      masking: { async getUserFieldPermissions() { return { hiddenFields: [field] } } } })
    const res = { status(code) { this.code = code; return this }, json(body) { this.body = body; return this } }
    await controller.saleOptions({ user: actor, query: { store_id: 1 } }, res)
    assert.equal(res.code, 403)
    assert.equal(res.body.code, 'FIELD_PERMISSION_DENIED')
  }
})

test('贴膜筛选不能用于反推已隐藏商品类型，普通候选仍沿用原字段边界', async () => {
  let called = false
  const controller = new AccessoryController({ service: { async getSaleOptions() { called = true; return { data: [], pagination: { total: 0 } } } },
    masking: { async getUserFieldPermissions() { return { hiddenFields: ['basic_info.category'] } }, filterSensitiveFields: rows => rows } })
  const res = { status(code) { this.code = code; return this }, json(body) { this.body = body; return this } }
  await controller.saleOptions({ user: actor, query: { store_id: 1, film_only: 'true' } }, res)
  assert.equal(res.code, 403)
  assert.equal(called, false)
  await controller.saleOptions({ user: actor, query: { store_id: 1 } }, res)
  assert.equal(called, true)
})
