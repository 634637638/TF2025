'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const FilmService = require('../src/services/film-service.service')
const SalesPhoneService = require('../src/services/sales-phone.service')

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

test('自动贴膜不可用时跳过，不阻断手机销售', async () => {
  const service = new FilmService({
    repository: {
      async matchingTemplates(_connection, modelId) { return modelId === 2 ? [{ id: 10 }] : [] },
      async availableProducts() { return [] }
    },
    tableExists: async () => true,
    columnExists: async () => true
  })
  assert.deepEqual(await service.prepareAutomaticForSale({}, [{ id: 20, model_id: 3 }], 1), [])
  assert.deepEqual(await service.prepareAutomaticForSale({}, [{ id: 20, model_id: 2 }], 1), [])

  const notReady = new FilmService({
    tableExists: async () => false,
    columnExists: async () => false
  })
  assert.deepEqual(await notReady.prepareAutomaticForSale({}, [{ id: 20, model_id: 2 }], 1), [])
})

test('批量销售时自动贴膜按普通库存数量预留，不重复扣同一张膜', async () => {
  const service = new FilmService({
    repository: {
      async matchingTemplates() { return [{ id: 10 }] },
      async availableProducts() { return [{ id: 11, quantity: 1, serial_quantity: 0 }] }
    },
    tableExists: async () => true,
    columnExists: async () => true
  })
  const rows = await service.prepareAutomaticForSale({}, [{ id: 20, model_id: 2 }, { id: 21, model_id: 2 }], 1)
  assert.deepEqual(rows.map(row => row.linked_phone_id), [20])
})

test('自动贴膜每台销售手机各消耗一张，且不要求人工赠送权限', async () => {
  const state = { sold: [], films: [], accessorySales: [] }
  const connection = {
    async beginTransaction() {}, async commit() {}, async rollback() { state.sold = []; state.films = []; state.accessorySales = [] }
  }
  const repository = {
    async withConnection(run) { return run(connection) },
    async findCustomerByPhone() { return { id: 9, name: '测试客户' } },
    async findPhonesForSale(_db, ids) { return ids.map(id => ({ id, store_id: 1, status: 'in_stock', purchase_cost: 80, is_new: id === 12 ? 1 : 0, model_id: 2, is_preordered: 0, supplier_id: 4, remarks: null })) },
    async findDuplicateSales() { return [] },
    async createSale(_db, row) { state.films.push({ type: 'phone', row }); return 20 + state.films.filter(item => item.type === 'phone').length },
    async createPayment() { return 31 },
    async markPhoneSold(_db, row) { state.sold.push(row.phoneId); return { affectedRows: 1 } }
  }
  const films = { async prepareAutomaticForSale(_db, phones, storeId) {
    assert.equal(storeId, 1)
    return phones.map(phone => ({ key: `auto-film:${phone.id}`, accessory_id: 11, quantity: 1, unit_price: 0, sale_type: 'gift', linked_phone_id: phone.id }))
  } }
  const accessories = { async issueSale(row) { state.accessorySales.push(row) } }
  const service = new SalesPhoneService({ repository, autoFilm: true, films, accessories,
    customerAccess: { async require() {} }, normalizeDate: value => value || '2026-11-17 12:00:00',
    prepareInvoiceTransaction: async () => {}, generateInvoice: async () => 'INV-1', inspectColumn: async () => true,
    getPointsConfig: async () => ({}), reconcilePoints: async () => ({ points: 0, eligibleAmount: 100 }) })
  const result = await service.sell({ body: { store_id: 1, phones: [{ phone_id: 12, sale_price: 100 }, { phone_id: 13, sale_price: 200 }],
    customer_info: { name: '测试客户', phone: '13800138000' }, sale_time: '2026-11-17 12:00:00',
    payment_info: { payment_method: 'cash', payment_amount: 300 } }, userId: 7, actor: { id: 7, store_ids: [1] } })
  assert.equal(result.status, 200)
  assert.deepEqual(state.accessorySales.map(row => [row.accessory_id, row.linked_phone_id, row.quantity, row.sale_type]),
    [[11, 12, 1, 'gift'], [11, 13, 1, 'gift']])
})

test('自动贴膜无可用库存时手机销售仍完成且不创建配件出库', async () => {
  const state = { sales: 0, accessorySales: 0 }
  const connection = { async beginTransaction() {}, async commit() {}, async rollback() {} }
  const service = new SalesPhoneService({
    autoFilm: true,
    films: { async prepareAutomaticForSale() { return [] } },
    accessories: { async issueSale() { state.accessorySales++ } },
    repository: {
      async withConnection(run) { return run(connection) }, async findCustomerByPhone() { return { id: 9, name: '测试客户' } },
      async findPhonesForSale() { return [{ id: 12, store_id: 1, status: 'in_stock', purchase_cost: 80, is_new: 1, model_id: 2, is_preordered: 0 }] },
      async findDuplicateSales() { return [] }, async createSale() { state.sales++; return 20 }, async createPayment() { return 30 },
      async markPhoneSold() { return { affectedRows: 1 } }
    }, customerAccess: { async require() {} }, normalizeDate: value => value, prepareInvoiceTransaction: async () => {},
    generateInvoice: async () => 'INV-1', inspectColumn: async () => true, getPointsConfig: async () => ({}), reconcilePoints: async () => ({ points: 0, eligibleAmount: 100 })
  })
  const result = await service.sell({ body: { store_id: 1, phone_id: 12, sale_price: 100, sale_time: '2026-11-17 12:00:00',
    customer_info: { name: '测试客户', phone: '13800138000' }, payment_info: { payment_method: 'cash' } }, userId: 7, actor: { id: 7, store_ids: [1] } })
  assert.equal(result.status, 200)
  assert.equal(state.sales, 1)
  assert.equal(state.accessorySales, 0)
})
