'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const FilmService = require('../src/services/film-service.service')
const SalesPhoneService = require('../src/services/sales-phone.service')
const { normalizeBusinessDateTime } = require('../src/utils/time')

test('自动贴膜按手机型号和销售门店匹配唯一免费膜，并忽略SN库存', async () => {
  const repository = {
    async matchingTemplates(_connection, modelId) { return modelId === 2 ? [{ id: 10 }] : [] },
    async availableProducts(_connection, templateId) {
      assert.equal(templateId, 10)
      return [{ id: 11, quantity: 3, serial_quantity: 1 }]
    }
  }
  const service = new FilmService({ repository, tableExists: async () => true, columnExists: async () => true })
  const rows = await service.prepareAutomaticForSale({}, [{ id: 20, model_id: 2 }], 1)
  assert.deepEqual(rows, [{ key: 'auto-film:20', accessory_id: 11, quantity: 1, unit_price: 0, sale_type: 'gift',
    linked_phone_id: 20, serial_numbers: [], redeem_points: 0, gift_return_unit_price: null, auto_film: true }])
})

test('缺少唯一赠膜模板、可用商品或服务结构时拒绝自动贴膜', async () => {
  const service = new FilmService({
    repository: {
      async matchingTemplates(_connection, modelId) { return modelId === 2 ? [{ id: 10 }] : [] },
      async availableProducts(_connection, _templateId, storeId) {
        assert.equal(storeId, 1)
        return []
      }
    },
    tableExists: async () => true,
    columnExists: async () => true
  })
  await assert.rejects(service.prepareAutomaticForSale({}, [{ id: 20, model_id: 3 }], 1), { code: 'FILM_TEMPLATE_REQUIRED' })
  await assert.rejects(service.prepareAutomaticForSale({}, [{ id: 20, model_id: 2 }], 1), { code: 'FILM_STOCK_INSUFFICIENT' })

  const ambiguous = new FilmService({
    repository: { async matchingTemplates() { return [{ id: 10 }, { id: 11 }] } },
    tableExists: async () => true,
    columnExists: async () => true
  })
  await assert.rejects(ambiguous.prepareAutomaticForSale({}, [{ id: 20, model_id: 2 }], 1), { code: 'FILM_TEMPLATE_REQUIRED' })

  const notReady = new FilmService({
    tableExists: async () => false,
    columnExists: async () => false
  })
  await assert.rejects(notReady.prepareAutomaticForSale({}, [{ id: 20, model_id: 2 }], 1), { code: 'FILM_SERVICE_NOT_READY' })
})

test('批量销售按普通库存预留赠膜，库存不能覆盖整批时拒绝部分出库', async () => {
  const service = new FilmService({
    repository: {
      async matchingTemplates() { return [{ id: 10 }] },
      async availableProducts() { return [{ id: 11, quantity: 1, serial_quantity: 0 }] }
    },
    tableExists: async () => true,
    columnExists: async () => true
  })
  await assert.rejects(service.prepareAutomaticForSale({}, [{ id: 20, model_id: 2 }, { id: 21, model_id: 2 }], 1),
    { code: 'FILM_STOCK_INSUFFICIENT' })
})

test('自动贴膜每台销售手机各消耗一张，并关联独立手机共同订单', async () => {
  const state = { sold: [], films: [], filmServices: [], accessorySales: [], orders: [], items: [], payments: [] }
  const connection = {
    async beginTransaction() {}, async commit() {}, async rollback() {
      state.sold = []; state.films = []; state.filmServices = []; state.accessorySales = []; state.orders = []; state.items = []; state.payments = []
    }
  }
  const repository = {
    async withConnection(run) { return run(connection) },
    async findCustomerByPhone() { return { id: 9, name: '测试客户' } },
    async findPhonesForSale(_db, ids) { return ids.map(id => ({ id, store_id: 1, status: 'in_stock', purchase_cost: 80, is_new: id === 12 ? 1 : 0, model_id: 2, is_preordered: 0, supplier_id: 4, remarks: null })) },
    async findDuplicateSales() { return [] },
    async createSale(_db, row) { state.films.push({ type: 'phone', row }); return 20 + state.films.filter(item => item.type === 'phone').length },
    async createPayment(_db, row) { state.payments.push({ ...row, id: 31 + state.payments.length }); return 30 + state.payments.length },
    async markPhoneSold(_db, row) { state.sold.push(row.phoneId); return { affectedRows: 1 } }
  }
  const films = { async prepareAutomaticForSale(_db, phones, storeId) {
    assert.equal(storeId, 1)
    return phones.map(phone => ({ key: `auto-film:${phone.id}`, accessory_id: 11, quantity: 1, unit_price: 0, sale_type: 'gift', linked_phone_id: phone.id }))
  }, async appendAutomatic(_db, values) { state.filmServices.push(values) } }
  const accessories = { async issueSale(row, _actor, _connection, context) {
    state.accessorySales.push({ ...row, time: context.time })
    return { sale_id: state.accessorySales.length + 100, sale_no: `PS-${state.accessorySales.length}`,
      sale_type: 'gift', serial_numbers: [], quantity: row.quantity, unit_price: 0, total_price: 0, purchase_cost: 5,
      accessory: { id: row.accessory_id, name: '赠品贴膜', category_id: 1, category: '贴膜', brand_id: 2,
        brand_name: '品牌', product_model: null, barcode: null, template_id: 3, model_id: null, model_ids: null,
        compatible_model_names: null, color_id: null, color_name: null, unit: '张', unit_id: 1 } }
  } }
  const checkoutRepository = {
    async phoneSnapshots(_db, ids) { return ids.map(id => ({ id, store_id: 1, imei: `IMEI-${id}`, serial_number: null,
      brand_id: 1, model_id: 2, color_id: null, memory_id: 1, supplier_id: 4, is_new: id === 12 ? 1 : 0,
      brand_name: '品牌', model_name: '手机', color_name: null, memory_name: '256GB' })) },
    async sales(_db, ids) { return ids.map((id, index) => ({ id, phone_id: [12, 13][index], sale_price: [100, 200][index],
      purchase_cost: 80, invoice_number: `INV-${index}`, points_awarded: 0 })) },
    async createOrder(_db, row) { state.orders.push({ ...row, id: 1 }); return 1 },
    async createItem(_db, row) { state.items.push(row); return state.items.length },
    async linkPayments(_db, ids, orderId) { for (const row of state.payments) if (ids.includes(row.id)) row.sales_order_id = orderId },
    async completeOrder(_db, row) { Object.assign(state.orders[0], row, { order_status: 'completed' }) }
  }
  const service = new SalesPhoneService({ repository, checkoutRepository, autoFilm: true, films, accessories,
    customerAccess: { async require() {} }, normalizeDate: value => value || '2026-11-17 12:00:00',
    normalizeBusinessTime: value => normalizeBusinessDateTime(value, () => '2026-11-20 09:08:07'),
    prepareInvoiceTransaction: async () => {}, generateInvoice: async () => 'INV-1', generateOrderNumber: async () => 'SO-TEST', inspectColumn: async () => true,
    getPointsConfig: async () => ({}), reconcilePoints: async () => ({ points: 0, eligibleAmount: 100 }) })
  const result = await service.sell({ body: { store_id: 1, phones: [{ phone_id: 12, sale_price: 100 }, { phone_id: 13, sale_price: 200 }],
    customer_info: { name: '测试客户', phone: '13800138000' }, sale_time: '2026-11-17',
    payment_info: { payment_method: 'cash', payment_amount: 300 } }, userId: 7, actor: { id: 7, store_ids: [1] } })
  assert.equal(result.status, 200)
  assert.deepEqual(state.accessorySales.map(row => row.time), ['2026-11-17 09:08:07', '2026-11-17 09:08:07'])
  assert.deepEqual(state.accessorySales.map(row => [row.accessory_id, row.linked_phone_id, row.quantity, row.sale_type]),
    [[11, 12, 1, 'gift'], [11, 13, 1, 'gift']])
  assert.deepEqual(state.items.map(row => [row.type, row.sale_id ?? row.accessory_sale_id, row.linked_phone_sale_id ?? null]),
    [['phone', 21, null], ['phone', 22, null], ['accessory', 101, 21], ['accessory', 102, 22]])
  assert.deepEqual(state.filmServices.map(row => [row.orderId, row.saleId, row.request.linked_phone_id, row.issuedQuantity]), [[1, 21, 12, 1], [1, 22, 13, 1]])
  assert.deepEqual(state.payments.map(row => row.sales_order_id), [1, 1])
  assert.equal(state.orders[0].order_status, 'completed')
})

test('自动赠膜无法准备时手机销售整体回滚，不保留手机及收款', async () => {
  const state = { sales: 0, accessorySales: 0 }
  const connection = { async beginTransaction() {}, async commit() {}, async rollback() { state.sales = 0 } }
  const service = new SalesPhoneService({
    autoFilm: true,
    films: { async prepareAutomaticForSale() { throw Object.assign(new Error('自动赠膜库存不足'), { statusCode: 409, code: 'FILM_STOCK_INSUFFICIENT' }) } },
    accessories: { async issueSale() { state.accessorySales++ } },
    checkoutRepository: {
      async phoneSnapshots() { return [{ id: 12, store_id: 1, imei: 'IMEI-12', serial_number: null,
        brand_id: 1, model_id: 2, color_id: null, memory_id: 1, supplier_id: null, is_new: 1,
        brand_name: '品牌', model_name: '手机', color_name: null, memory_name: '256GB' }] },
      async sales() { return [{ id: 20, phone_id: 12, sale_price: 100, purchase_cost: 80, invoice_number: 'INV-1', points_awarded: 0 }] },
      async createOrder() { return 1 }, async createItem() {}, async linkPayments() {}, async completeOrder() {}
    },
    repository: {
      async withConnection(run) { return run(connection) }, async findCustomerByPhone() { return { id: 9, name: '测试客户' } },
      async findPhonesForSale() { return [{ id: 12, store_id: 1, status: 'in_stock', purchase_cost: 80, is_new: 1, model_id: 2, is_preordered: 0 }] },
      async findDuplicateSales() { return [] }, async createSale() { state.sales++; return 20 }, async createPayment() { return 30 },
      async markPhoneSold() { return { affectedRows: 1 } }
    }, customerAccess: { async require() {} }, normalizeDate: value => value, prepareInvoiceTransaction: async () => {},
    generateInvoice: async () => 'INV-1', generateOrderNumber: async () => 'SO-TEST', inspectColumn: async () => true,
    getPointsConfig: async () => ({}), reconcilePoints: async () => ({ points: 0, eligibleAmount: 100 })
  })
  await assert.rejects(service.sell({ body: { store_id: 1, phone_id: 12, sale_price: 100, sale_time: '2026-11-17 12:00:00',
    customer_info: { name: '测试客户', phone: '13800138000' }, payment_info: { payment_method: 'cash' } }, userId: 7, actor: { id: 7, store_ids: [1] } }),
    { code: 'FILM_STOCK_INSUFFICIENT' })
  assert.equal(state.sales, 0)
  assert.equal(state.accessorySales, 0)
})
