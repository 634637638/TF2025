'use strict'
const test = require('node:test')
const assert = require('node:assert/strict')
const AccessoryService = require('../src/services/accessory.service')
const AccessoryRepository = require('../src/repositories/accessory.repository')
const AccessoryController = require('../src/controllers/accessory.controller')
const actor = { id: 7, store_ids: [1, 2] }

test('附加商品候选区分普通实物与同店在库SN，SN仅按可见SN检索并准确分页', async () => {
  const repository = new AccessoryRepository(), calls = []
  repository.queryRows = async (sql, params) => { calls.push({ sql, params }); return /SELECT COUNT\(\*\) AS total/.test(sql) ? [{ total: 1 }] : [{ id: 2, serial_number: 'SN001', quantity: 1, serial_quantity: 1 }] }
  await repository.getSaleOptions({ storeId: 1, search: 'SN001', searchFields: ['name', 'serial_number'], page: 1, pageSize: 20, searchMode: 'serial' })
  for (const call of calls) {
    assert.match(call.sql, /picked_sn.store_id = st.store_id AND picked_sn.status = 'in_stock'/)
    assert.match(call.sql, /picked_sn.serial_number LIKE \?/)
    assert.deepEqual(call.params, [1, '%SN001%'])
  }
  assert.match(calls[1].sql, /picked_sn.serial_number/)
  calls.length = 0
  await repository.getSaleOptions({ storeId: 1, search: '', searchFields: ['name'], page: 1, pageSize: 20, searchMode: 'regular' })
  assert.match(calls[0].sql, /st.quantity > \(SELECT COUNT/)
  assert.match(calls[1].sql, /st.quantity - \(SELECT COUNT/)
  assert.doesNotMatch(calls[1].sql, /picked_sn/)
})

test('SN字段隐藏时拒绝SN候选，不用命中结果泄漏SN存在性', async () => {
  const controller = new AccessoryController({ service: { getSaleOptions() { throw new Error('不得读取') } }, masking: { async getUserFieldPermissions() { return { hiddenFields: ['basic_info.serial_number'] } } } })
  const res = { status(code) { this.code = code; return this }, json(body) { this.body = body; return this } }
  await controller.saleOptions({ user: actor, query: { store_id: 1, search_mode: 'serial', search: 'SN001' } }, res)
  assert.equal(res.code, 403)
  assert.equal(res.body.code, 'FIELD_PERMISSION_DENIED')
})

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

test('收费贴膜候选筛选膜类并允许免费专用，普通销售口径不变', async () => {
  const calls = []
  const service = new AccessoryService({ repository: { async getSaleOptions(input) { calls.push(input); return {} }, async filmReady() { return true } } })
  await service.getSaleOptions(actor, { store_id: 2, film_only: 'true' })
  assert.equal(calls[0].filmOnly, true)
  await service.getSaleOptions(actor, { store_id: 2, film_only: true, film_free_only: false, film_model_id: 13 })
  assert.equal(calls[1].filmFreeOnly, false)
  await service.getSaleOptions(actor, { store_id: 2, film_only: true, film_free_only: true, film_model_id: 13 })
  assert.equal(calls[2].filmFreeOnly, true)
  await service.getSaleOptions(actor, { store_id: 2, film_only: false })
  assert.equal(calls[3].filmOnly, undefined)
  for (const film_only of [1, '1', [], {}, null]) await assert.rejects(service.getSaleOptions(actor, { store_id: 2, film_only }), { statusCode: 400 })
  const repository = new AccessoryRepository({ columnExists: async () => true }), sqls = []
  repository.queryRows = async sql => { sqls.push(sql); return sqls.length === 1 ? [{ total: 0 }] : [] }
  await repository.getSaleOptions({ ...calls[0], searchFields: ['name'] })
  assert.equal(sqls.length, 2)
  for (const sql of sqls) {
    assert.doesNotMatch(sql, /film_enabled|free_film/)
    assert.match(sql, /IF\(a.template_id IS NULL, a.status, t.status\)/)
    assert.match(sql, /IF\(a.template_id IS NULL, a.category_id, t.category_id\)/)
    assert.match(sql, /fc.status = 1/)
    assert.match(sql, /st.store_id = \?/)
  }
  repository.columnExists = async () => false
  sqls.length = 0
  await repository.getSaleOptions({ ...calls[0], searchFields: ['name'] })
  assert.equal(sqls.length, 2)
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
  assert.deepEqual(input.fields, ['name', 'category', 'product_model'])
  assert.equal(res.body.data.data[0].barcode, null)
  assert.equal(res.body.data.data[0].brand_name, null)
  assert.equal(res.body.data.data[0].serial_quantity, null)
  assert.equal(res.body.data.data[0].sale_price, null)
  assert.equal(res.body.data.pagination.total, 125)
})

test('商品进价只在价格字段可见时随销售候选返回', async () => {
  let includePurchaseCost = false
  const controller = new AccessoryController({
    service: { async getSaleOptions(user, query, fields, includeCost) {
      includePurchaseCost = includeCost
      return { data: [{ id: 56, name: '充电宝', purchase_cost: 20, sale_price: 30, quantity: 1, serial_quantity: 0 }], pagination: { total: 1 } }
    } },
    masking: { async getUserFieldPermissions() { return { hiddenFields: [] } }, filterSensitiveFields: rows => rows }
  })
  const res = { status() { return this }, json(body) { this.body = body; return this } }
  await controller.saleOptions({ user: actor, query: { store_id: 1 } }, res)
  assert.equal(includePurchaseCost, true)
  assert.equal(res.body.data.data[0].purchase_cost, 20)
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

test('收银精确模式只匹配完整条码或SN，不混用名称、型号及LIKE，计数与分页一致', async () => {
  const repository = new AccessoryRepository(), calls = []
  repository.queryRows = async (sql, params) => { calls.push({ sql, params }); return /SELECT COUNT/.test(sql) && !/ AS quantity/.test(sql) ? [{ total: 2 }] : [] }
  for (const searchMode of ['regular', 'serial']) {
    calls.length = 0
    await repository.getSaleOptions({ storeId: 1, search: '0012_%', searchFields: ['name', 'barcode', 'serial_number'], page: 1, pageSize: 20, searchMode, exactMatch: true })
    assert.equal(calls.length, 2)
    for (const { sql, params } of calls) {
      assert.match(sql, searchMode === 'regular' ? /t\.barcode\) = \?/ : /picked_sn.serial_number = \?/)
      assert.doesNotMatch(sql, /LIKE/)
      assert.deepEqual(params, [1, '0012_%'])
    }
  }
  calls.length = 0
  await repository.getSaleOptions({ storeId: 1, search: '0012', searchFields: ['name'], page: 1, pageSize: 20, searchMode: 'regular', exactMatch: true })
  assert.match(calls[0].sql, /1 = 0/)
  assert.deepEqual(calls[0].params, [1])
})

test('精确模式严格验证编码、模式及授权门店，拒绝非法参数后不查询', async () => {
  const calls = []
  const service = new AccessoryService({ repository: { async getSaleOptions(input) { calls.push(input); return {} } } })
  await service.getSaleOptions(actor, { store_id: 1, search: ' 0012 ', search_mode: 'regular', match_mode: 'exact' })
  assert.equal(calls[0].exactMatch, true)
  assert.equal(calls[0].search, '0012')
  for (const query of [
    { search: '', search_mode: 'regular', match_mode: 'exact' },
    { search: '0012', match_mode: 'exact' },
    { search: '0012', search_mode: 'regular', match_mode: true },
    { search: '0012', search_mode: 'regular', match_mode: 'approximate' }
  ]) await assert.rejects(service.getSaleOptions(actor, { store_id: 1, ...query }), { statusCode: 400 })
  assert.equal(calls.length, 1)
})

test('商品类型检索复用模板类型名称，类型隐藏后不参与关键词匹配', async () => {
  const repository = new AccessoryRepository(), calls = []
  repository.queryRows = async (sql, params) => { calls.push({ sql, params }); return /SELECT COUNT/.test(sql) && !/ AS quantity/.test(sql) ? [{ total: 0 }] : [] }
  await repository.getSaleOptions({ storeId: 1, search: '钢化膜', searchFields: ['category'], page: 1, pageSize: 20, searchMode: 'regular' })
  assert.match(calls[0].sql, /COALESCE\(sale_category.name,.*t.category\)\) LIKE \?/)
  assert.deepEqual(calls[0].params, [1, '%钢化膜%'])
  let fields
  const controller = new AccessoryController({ service: { async getSaleOptions(user, query, searchFields) { fields = searchFields; return { data: [], pagination: { total: 0 } } } }, masking: { async getUserFieldPermissions() { return { hiddenFields: ['basic_info.category'] } }, filterSensitiveFields: rows => rows } })
  const res = { status() { return this }, json(body) { this.body = body; return this } }
  await controller.saleOptions({ user: actor, query: { store_id: 1, search: '钢化膜' } }, res)
  assert.equal(fields.includes('category'), false)
  assert.equal(res.body.success, true)
})
