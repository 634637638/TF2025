'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const { DatabaseSync } = require('node:sqlite')
const { getActiveSaleSql, getLatestActiveSaleIdSql } = require('../src/utils/sale-status')
const { clearSchemaInspectorCache } = require('../src/utils/schema-inspector')
const SalesPhoneRepository = require('../src/repositories/sales-phone.repository')
const PhoneUpdateRepository = require('../src/repositories/phone-update.repository')
const QueryRepository = require('../src/repositories/query.repository')
const InventoryRepository = require('../src/repositories/inventory.repository')
const PhoneInventoryQueryRepository = require('../src/repositories/phone-inventory-query.repository')
const SalesCheckoutRepository = require('../src/repositories/sales-checkout.repository')
const SalesAftersaleService = require('../src/services/sales-aftersale.service')
const RepairLookupRepository = require('../src/repositories/repair-lookup.repository')
const SubsidyPhoneSearchRepository = require('../src/repositories/subsidy-phone-search.repository')
const CustomerRepository = require('../src/repositories/customer.repository')
const SegmentsRepository = require('../src/repositories/analytics-customer-segments.repository')
const HighValueRepository = require('../src/repositories/analytics-high-value-customers.repository')
const DetailRepository = require('../src/repositories/analytics-customer-detail.repository')
const SalesAvailablePhonesService = require('../src/services/sales-available-phones.service')
const SalesAvailablePhonesRepository = require('../src/repositories/sales-available-phones.repository')
const ShopPublicService = require('../src/services/shop-public.service')

/** 仅内存 SQL 行为验证，不连接业务库；移除 SQLite 不支持的行锁后缀，不验证 MySQL 锁语义。 */
function fixture(t) {
  const db = new DatabaseSync(':memory:')
  t.after(() => { db.close(); clearSchemaInspectorCache() })
  clearSchemaInspectorCache()
  const schema = {
    phones: 'id INTEGER PRIMARY KEY, imei, serial_number, status, store_id, brand_id, model_id, color_id, memory_id, supplier_id, inventory_operator_id, sale_operator_id, purchase_cost, sale_price, sale_time, inventory_time, is_new, is_preordered, quality_grade, remarks, purchase_number',
    sales: 'id INTEGER PRIMARY KEY, phone_id, customer_id, operator_id, store_id, status, sale_type, sale_price, purchase_cost, sale_time, created_at, remarks, invoice_number, payment_method, payment_channel, points_awarded',
    customers: 'id INTEGER PRIMARY KEY, name, phone, apple_id, email, customer_type, vip_level, gender, city, province, balance, points, status, remarks, created_at, updated_at, member_number, wechat, qq, id_card, address, last_purchase_date',
    brands: 'id INTEGER PRIMARY KEY, name', models: 'id INTEGER PRIMARY KEY, brand_id, name',
    colors: 'id INTEGER PRIMARY KEY, name', memories: 'id INTEGER PRIMARY KEY, size',
    suppliers: 'id INTEGER PRIMARY KEY, name, contact, phone',
    stores: 'id INTEGER PRIMARY KEY, name, location, phone', users: 'id INTEGER PRIMARY KEY, name, username, status, salary_template_id',
    salary_templates: 'id INTEGER PRIMARY KEY, commission_type, commission_fixed, commission_new_fixed, commission_used_fixed, commission_percentage',
    attendance_records: 'employee_id, record_date, leave_days, leave_type, leave_reason, record_type, status',
    price_list: 'brand_id, model_id, color_id, memory_id, status, wholesale_price, retail_price',
    H5_images: 'phone_id', payment_records: 'id, order_id, customer_id, payment_status, payment_channel',
    sales_orders: 'id INTEGER PRIMARY KEY, request_key, order_status, order_no, store_id, customer_id',
    sales_order_items: 'id INTEGER PRIMARY KEY, order_id, phone_id, sale_id, item_type, linked_phone_sale_id, accessory_id, accessory_sale_id, quantity, unit_price, total_amount, purchase_cost, points_awarded, snapshot',
    accessory_sales: 'id INTEGER PRIMARY KEY, operator_id',
    national_subsidies: 'phone_id, apply_status, subsidy_amount'
  }
  for (const [table, columns] of Object.entries(schema)) db.exec(`CREATE TABLE ${table} (${columns})`)
  db.function('regexp', (pattern, value) => value === null ? 0 : Number(new RegExp(pattern).test(value)))
  db.function('CONCAT', { varargs: true }, (...args) => args.some(value => value === null) ? null : args.join(''))
  db.function('CONCAT_WS', { varargs: true }, (separator, ...args) => args.filter(value => value !== null).join(separator))
  db.function('FIELD', { varargs: true }, (value, ...values) => values.indexOf(value) + 1)
  db.function('NOW', () => '2026-11-13 12:00:00')
  db.function('CURDATE', () => '2026-11-13')
  db.function('DATEDIFF', (later, earlier) => earlier === null || later === null ? null :
    Math.floor((Date.parse(`${later.slice(0, 10)}T00:00:00Z`) - Date.parse(`${earlier.slice(0, 10)}T00:00:00Z`)) / 86400000))
  db.function('DATE_FORMAT', (value, format) => value === null ? null : format === '%Y-%m-01' ? `${value.slice(0, 7)}-01` : value.slice(0, 7))
  const calls = []
  const execute = async (sql, params = []) => {
    calls.push({ sql, params })
    if (sql.includes('information_schema.')) return [[{ exists: 1 }]]
    const rows = db.prepare(sql.replace(/\s+FOR UPDATE\s*$/i, '')).all(...params)
    return [rows.map(row => ({ ...row }))]
  }
  const connection = { execute, query: execute, release() {} }
  const database = { execute, query: execute, async getConnection() { return connection } }
  function insert(table, row) {
    const keys = Object.keys(row)
    db.prepare(`INSERT INTO ${table} (${keys.join(',')}) VALUES (${keys.map(() => '?').join(',')})`).run(...Object.values(row))
  }
  insert('phones', { id: 1, imei: 'PHONE1', serial_number: 'SERIAL1', status: 'in_stock', store_id: 2, is_preordered: 0, is_new: 1 })
  insert('phones', { id: 2, imei: 'PHONE2', status: 'sold', store_id: 2, is_new: 1 })
  insert('customers', { id: 7, name: '原客户', phone: 'CUSTOMER7', status: 1 })
  insert('customers', { id: 8, name: '新客户', phone: 'CUSTOMER8', status: 1 })
  insert('stores', { id: 1, name: '原门店' }); insert('stores', { id: 2, name: '接收门店' })
  insert('sales', { id: 11, phone_id: 1, customer_id: 7, operator_id: 70, store_id: 1, status: 'cancelled', sale_type: 'retail', sale_price: 1000, sale_time: '2026-11-01 10:00:00', created_at: '2026-11-01 10:00:00' })
  insert('sales', { id: 21, phone_id: 2, customer_id: 7, operator_id: 70, store_id: 1, status: 'cancelled', sale_price: 2000, created_at: '2026-11-12 10:00:00' })
  insert('sales', { id: 22, phone_id: 2, customer_id: 8, operator_id: 80, store_id: 2, status: 'completed', sale_type: 'retail', sale_price: 1500, sale_time: '2026-11-10 10:00:00', created_at: '2026-11-11 10:00:00' })
  insert('sales_orders', { id: 91, request_key: 'original', order_status: 'completed', store_id: 1, customer_id: 7 })
  insert('sales_order_items', { id: 101, order_id: 91, phone_id: 1, sale_id: 11, item_type: 'phone', quantity: 1, total_amount: 1000, points_awarded: 0 })
  return { db, calls, connection, database, insert }
}

test('有效销售兼容历史空状态及待完成，排除取消和未知值；别名不是 SQL 输入通道', t => {
  const f = fixture(t)
  for (const [index, status] of [null, 'pending', 'completed', 'cancelled', 'unknown'].entries()) {
    f.insert('sales', { id: 100 + index, phone_id: 3, status })
  }
  const rows = f.db.prepare(`SELECT id FROM sales s WHERE s.phone_id = 3 AND ${getActiveSaleSql()} ORDER BY id`).all()
  assert.deepEqual(rows.map(row => row.id), [100, 101, 102])
  for (const alias of ['s; DELETE FROM sales', 's.status', 's --', '`s`']) {
    assert.throws(() => getActiveSaleSql(alias))
    assert.throws(() => getLatestActiveSaleIdSql(alias))
    assert.throws(() => getLatestActiveSaleIdSql('p', alias))
  }
})

test('当前销售以递增 ID 唯一确定，相同或倒置创建时间不产生重复行', t => {
  const f = fixture(t)
  f.db.exec("UPDATE sales SET status = 'completed' WHERE id = 21")
  let result = f.db.prepare(`SELECT p.id, s.id AS sale_id FROM phones p LEFT JOIN sales s ON s.id = (${getLatestActiveSaleIdSql()}) ORDER BY p.id`).all()
  assert.deepEqual(result.map(row => [row.id, row.sale_id]), [[1, null], [2, 22]])
  f.db.exec('UPDATE sales SET created_at = NULL')
  result = f.db.prepare(`SELECT (${getLatestActiveSaleIdSql()}) AS sale_id FROM phones p WHERE p.id = 2`).get()
  assert.equal(result.sale_id, 22)
})

test('最新销售取消后不复活更早的完成记录，返库查询、校验及候选保持一致', async t => {
  const f = fixture(t)
  f.db.exec("UPDATE sales SET status = 'completed' WHERE id = 21; UPDATE sales SET status = 'cancelled' WHERE id = 22; UPDATE phones SET status = 'in_stock' WHERE id = 2")
  const query = new QueryRepository()
  query.getConnection = () => f.database
  const result = await query.getComprehensivePhoneQuery({ phone_id: 2, status: 'in_stock', store_ids: [2] })
  assert.equal(result.pagination.total, 1)
  assert.equal(result.data[0].sale_id, null); assert.equal(result.data[0].customer_id, null)
  assert.equal(result.data[0].store_id, 2)
  assert.deepEqual((await query.lockLatestSaleForReturn(f.connection, 2))[0], [])
  assert.equal(await new PhoneUpdateRepository().findLatestSaleByPhone(f.connection, 2), null)
  assert.deepEqual(await new SalesPhoneRepository().findDuplicateSales(f.connection, [2], 7), [])
  assert.equal(await new InventoryRepository().hasCustomerPhoneDuplicate(f.connection, { imei: 'PHONE2', customerId: 7 }), false)
  const details = await new PhoneInventoryQueryRepository(() => f.database).getPhoneDetails(2)
  assert.equal(details[0].customer_id, null)
  const repairs = await new RepairLookupRepository({ getDatabase: () => f.database }).searchDevices('PHONE2')
  assert.equal(repairs[0].customer_id, null)
  const subsidy = await new SubsidyPhoneSearchRepository({ getDb: () => f.database }).findRelatedData([2])
  assert.deepEqual(subsidy.latestSales, [])
  const service = new SalesAvailablePhonesService({ repository: new SalesAvailablePhonesRepository({ getDb: () => f.database }) })
  const filters = await service.buildFilters({ sale_status: 'available' })
  const rows = f.db.prepare(`SELECT p.id FROM phones p WHERE ${filters.whereConditions.join(' AND ')}`).all(...filters.queryParams)
  assert.ok(rows.some(row => row.id === 2))
})

test('退回后同客户可再次购买；真实未取消的重复购买仍被阻止，编辑不读取已取消原销售', async t => {
  const f = fixture(t), sales = new SalesPhoneRepository(), updates = new PhoneUpdateRepository()
  assert.deepEqual(await sales.findDuplicateSales(f.connection, [1], 7), [])
  const inventory = new InventoryRepository()
  assert.equal(await inventory.hasCustomerPhoneDuplicate(f.connection, { imei: 'PHONE1', customerId: 7 }), false)
  assert.equal(await updates.findLatestSaleByPhone(f.connection, 1), null)
  assert.equal((await updates.findLatestSaleByPhone(f.connection, 2)).id, 22)
  for (const status of [null, 'pending', 'completed']) {
    f.db.prepare('UPDATE sales SET status = ? WHERE id = 11').run(status)
    assert.equal((await sales.findDuplicateSales(f.connection, [1], 7)).length, 1)
    assert.equal(await inventory.hasCustomerPhoneDuplicate(f.connection, { imei: 'PHONE1', customerId: 7 }), true)
  }
})

test('返库后的综合查询及统计按接收门店授权，旧客户和原门店不会残留', async t => {
  const f = fixture(t), repo = new QueryRepository()
  repo.getConnection = () => f.database
  const current = await repo.getComprehensivePhoneQuery({ phone_id: 1, store_ids: [2], status: 'in_stock' })
  assert.equal(current.pagination.total, 1)
  assert.equal(current.data[0].customer_id, null)
  assert.equal(current.data[0].sale_id, null)
  assert.equal(current.data[0].store_id, 2)
  const original = await repo.getComprehensivePhoneQuery({ phone_id: 1, store_ids: [1], status: 'in_stock' })
  assert.equal(original.pagination.total, 0)
  const stats = await repo.getQueryStatistics({ store_ids: [2], status: 'in_stock' })
  assert.equal(stats.total_phones, 1)
  assert.equal(stats.in_stock_count, 1)
})

test('综合查询仅按当前销售员匹配，只有人员筛选时分页及统计也可执行', async t => {
  const f = fixture(t), repo = new QueryRepository()
  repo.getConnection = () => f.database
  for (const status of [undefined, 'sold']) {
    assert.equal((await repo.getComprehensivePhoneQuery({ sale_operator_id: 70, status })).pagination.total, 0)
    const found = await repo.getComprehensivePhoneQuery({ sale_operator_id: 80, status })
    assert.equal(found.pagination.total, 1); assert.equal(found.data[0].sale_id, 22)
    assert.equal((await repo.getQueryStatistics({ sale_operator_id: 80, status })).sold_count, 1)
  }
})

test('手机库存详情、维修检索和补贴检索统一排除旧客户，最新销售只有一条', async t => {
  const f = fixture(t), inventory = new PhoneInventoryQueryRepository(() => f.database)
  const detail = (await inventory.getPhoneDetails(1))[0]
  assert.equal(detail.customer_id, null); assert.equal(detail.sale_store_id, null)
  const list = await inventory.listInventoryPhones({}, { page: 1, page_size: 20 })
  assert.equal(list.phones.find(row => row.id === 1).customer_id, null)
  const repairs = new RepairLookupRepository({ getDatabase: () => f.database })
  assert.equal((await repairs.searchDevices('PHONE1'))[0].customer_id, null)
  assert.equal((await repairs.searchDevices('PHONE2'))[0].customer_id, 8)
  const subsidy = await new SubsidyPhoneSearchRepository({ getDb: () => f.database }).findRelatedData([1, 2])
  assert.deepEqual(subsidy.latestSales.map(row => [row.phone_id, row.customer_name]), [[2, '新客户']])
})

test('当前退货来源按真实销售 ID 关联共同单，历史共同单继续保护永久删除', async t => {
  const f = fixture(t), repo = new SalesCheckoutRepository({ database: () => f.database })
  assert.equal(await repo.currentPhoneOrder(f.connection, 1), null)
  assert.equal(await repo.phoneOrder(f.connection, 1), 91)
  f.insert('sales', { id: 12, phone_id: 1, customer_id: 8, store_id: 2, status: 'completed', sale_type: 'retail' })
  f.db.exec("UPDATE phones SET status = 'sold' WHERE id = 1")
  const scope = { allStores: false, storeIds: [2] }
  assert.deepEqual(await repo.phoneReturnSource(1, scope), { phone_id: 1, sale_id: 12, order_id: null, checkout_sale_id: null })
  assert.equal(await repo.phoneReturnSource(1, { allStores: false, storeIds: [1] }), null)
  assert.equal(await repo.currentPhoneOrder(f.connection, 1), null)
  f.insert('sales_orders', { id: 92, request_key: 'new', order_status: 'completed', store_id: 2, customer_id: 8 })
  f.insert('sales_order_items', { id: 102, order_id: 92, phone_id: 1, sale_id: 12, item_type: 'phone', quantity: 1, total_amount: 500, points_awarded: 0 })
  assert.equal((await repo.phoneReturnSource(1, scope)).order_id, 92)
  assert.equal(await repo.currentPhoneOrder(f.connection, 1), 92)
  const service = new SalesAftersaleService({ repository: repo, permissionCheck: async () => true })
  assert.equal((await service.phoneReturnChecklist(1, { id: 80, store_ids: [2] })).mode, 'checkout')
  // 错位共同明细必须继续触发保护，不能因附加 phone_id/type 不符而变成独立单。
  f.db.exec("UPDATE sales_order_items SET phone_id = 999, item_type = 'accessory' WHERE id = 102")
  assert.equal((await repo.phoneReturnSource(1, scope)).order_id, 92)
  assert.equal(await repo.currentPhoneOrder(f.connection, 1), 92)
  assert.equal(await repo.phoneOrder(f.connection, 1), 92)
  await assert.rejects(service.phoneReturnChecklist(1, { id: 80, store_ids: [2] }), { statusCode: 404 })
  assert.deepEqual(await repo.returnChecklist(91, 11, { allStores: true }), [])
})

test('客户有效消费和价值分组排除已取消金额，购买历史仍保留原销售事实', async t => {
  const f = fixture(t), repo = new CustomerRepository()
  repo.getConnection = () => f.database
  const result = await repo.listCustomers({ page: 1, page_size: 20, filters: {} })
  const original = result.customers.find(row => row.id === 7)
  const current = result.customers.find(row => row.id === 8)
  assert.equal(original.purchase_count, 0); assert.equal(original.total_spent, 0)
  assert.equal(original.last_purchase_date, null)
  assert.equal(current.purchase_count, 1); assert.equal(current.total_spent, 1500)
  assert.equal(current.last_purchase_date, '2026-11-10 10:00:00')
  const sorted = await repo.listCustomers({ page: 1, page_size: 20, sort_by: 'last_purchase_date', sort_order: 'desc', filters: {} })
  assert.deepEqual(sorted.customers.map(row => row.id), [8, 7])
  assert.equal((await repo.getStatistics()).active_customers, 1)
  const history = await repo.getCustomerPurchases(7, { page_size: 20, offset: 0 })
  assert.deepEqual(history.purchases.map(row => [row.sale_id, row.sale_price]).sort(), [[11, 1000], [21, 2000]])
  const segments = await new SegmentsRepository({ database: () => f.database }).getSegments(null)
  assert.equal(segments.reduce((sum, row) => sum + row.count, 0), 2)
  assert.equal(segments.reduce((sum, row) => sum + row.totalRevenue, 0), 1500)
  const valuable = await new HighValueRepository({ database: () => f.database }).list({ pageSize: 20, offset: 0, storeId: null })
  assert.equal(valuable.total, 1)
  assert.equal(valuable.customers[0].id, 8)
  assert.equal(valuable.customers[0].total_amount, 1500)
  const details = new DetailRepository({ database: () => f.database })
  assert.deepEqual(await details.getTrend(7, null), [])
  assert.deepEqual(await details.getTrend(8, null), [{ period: '2026-11', amount: 1500 }])
  assert.deepEqual(await details.getPreferences(7, null), [])
})

test('销售候选可用性兼容历史 NULL，客户与人员筛选只读取当前有效销售', async t => {
  const f = fixture(t), service = new SalesAvailablePhonesService({ repository: new SalesAvailablePhonesRepository({ getDb: () => f.database }) })
  // 允许直接验证 WHERE 条件的行结果；不连接实际库存池或创建销售。
  for (const status of ['cancelled', null, 'pending', 'completed']) {
    f.db.prepare('UPDATE sales SET status = ? WHERE id = 11').run(status)
    const filters = await service.buildFilters({ sale_status: 'available' })
    const rows = f.db.prepare(`SELECT p.id FROM phones p WHERE ${filters.whereConditions.join(' AND ')}`).all(...filters.queryParams)
    assert.deepEqual(rows.map(row => row.id), status === 'cancelled' ? [1] : [])
  }
  f.db.exec("UPDATE sales SET status = 'cancelled' WHERE id = 11; UPDATE sales SET status = 'completed' WHERE id = 21; UPDATE phones SET status = 'in_stock' WHERE id = 2")
  for (const [customerId, operatorId, expected] of [[7, 70, []], [8, 80, [2]]]) {
    const filters = await service.buildFilters({ customer_id: customerId, salesman_id: operatorId })
    const rows = f.db.prepare(`SELECT p.id FROM phones p WHERE ${filters.whereConditions.join(' AND ')}`).all(...filters.queryParams)
    assert.deepEqual(rows.map(row => row.id), expected)
  }
})

test('工资待计算销售和明细不因同创建时间重复计数；返库后不再统计，但不改已发工资', async t => {
  const f = fixture(t)
  const databaseModule = require('../src/config/database')
  t.mock.method(databaseModule, 'getDatabase', () => f.database)
  const modulePaths = ['../src/services/salary-calculator.service', '../src/services/salary-record.service'].map(name => require.resolve(name))
  const cached = modulePaths.map(name => require.cache[name])
  modulePaths.forEach(name => { delete require.cache[name] })
  t.after(() => modulePaths.forEach((name, index) => {
    if (cached[index]) require.cache[name] = cached[index]
    else delete require.cache[name]
  }))
  const calculator = require(modulePaths[0]), records = require(modulePaths[1])
  f.insert('users', { id: 80, name: '销售员', username: 'seller', status: 1, salary_template_id: 1 })
  f.insert('salary_templates', { id: 1, commission_type: 'fixed', commission_new_fixed: 10 })
  f.db.exec("UPDATE phones SET sale_operator_id = 80, sale_time = '2026-11-10 10:00:00', sale_price = 1500, purchase_cost = 1000 WHERE id = 2; UPDATE sales SET created_at = '2026-11-10 10:00:00'; UPDATE sales SET status = 'completed', sale_type = 'wholesale' WHERE id = 21")
  const args = [80, '2026-11-01', '2026-11-30']
  const calculated = await calculator._getSalesData(...args)
  assert.equal(calculated.count, 1)
  assert.equal(calculated.revenue, 1500)
  assert.equal(calculated.details[0].customer_name, '新客户')
  assert.equal((await records.getEmployeesSalesData(args[1], args[2]))[80].sales_count, 1)
  const details = await records.getEmployeeSalesDetails(...args)
  assert.equal(details.length, 1); assert.equal(details[0].customer_name, '新客户')
  f.db.exec("UPDATE phones SET status = 'in_stock', sale_operator_id = NULL, sale_price = NULL, sale_time = NULL WHERE id = 2; UPDATE sales SET status = 'cancelled' WHERE phone_id = 2")
  assert.equal((await calculator._getSalesData(...args)).count, 0)
  assert.deepEqual(await records.getEmployeesSalesData(args[1], args[2]), {})
  assert.deepEqual(await records.getEmployeeSalesDetails(...args), [])
  assert.equal(f.calls.some(({ sql }) => /UPDATE|INSERT|DELETE/.test(sql)), false)
})

test('H5 原销售历史保留取消记录和原成交价，不受设备返库清空或再次调价影响', async t => {
  const f = fixture(t), service = new ShopPublicService({ database: { getDatabase: () => f.database } })
  f.db.exec("UPDATE phones SET sale_price = 9999, sale_time = '2026-12-01 10:00:00'")
  const result = await service.getSalesByCustomerId(7, { page: 1, page_size: 20 })
  assert.equal(result.total, 2)
  assert.deepEqual(result.data.map(row => [row.id, row.sale_price]).sort(), [[11, 1000], [21, 2000]])
  assert.equal(result.data.find(row => row.id === 11).sale_time, '2026-11-01 10:00:00')
  assert.equal(result.data.find(row => row.id === 21).sale_time, null)
})
