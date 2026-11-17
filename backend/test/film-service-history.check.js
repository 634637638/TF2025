'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const { DatabaseSync } = require('node:sqlite')
const FilmService = require('../src/services/film-service.service')
const FilmRepository = require('../src/repositories/film-service.repository')

const now = '2026-11-14 10:00:00'
const actor = { id: 7, store_ids: [2] }

/** 实际查询的内存行验证；SQLite移除行锁后缀，不验证MySQL隔离及锁语义。 */
function fixture(t) {
  const db = new DatabaseSync(':memory:')
  t.after(() => db.close())
  const schema = {
    customers: 'id INTEGER PRIMARY KEY',
    phones: 'id INTEGER PRIMARY KEY, model_id', models: 'id INTEGER PRIMARY KEY, name',
    sales: 'id INTEGER PRIMARY KEY, phone_id, customer_id, sale_type, status, sale_time, store_id',
    stores: 'id INTEGER PRIMARY KEY, name', users: 'id INTEGER PRIMARY KEY, name',
    sales_orders: 'id INTEGER PRIMARY KEY, order_no',
    sales_order_items: 'id INTEGER PRIMARY KEY, order_id, item_type, quantity, total_amount, snapshot',
    customer_film_services: 'id INTEGER PRIMARY KEY, order_id UNIQUE, customer_id, qualification_sale_id, store_id, operator_id, created_by, quantity, business_time, created_at, phone_id, model_id, phone_snapshot'
  }
  for (const [name, columns] of Object.entries(schema)) db.exec(`CREATE TABLE ${name} (${columns})`)
  // SQLite的JSON_EXTRACT已返回字符串标量；无需MySQL额外的字符串去引号步骤。
  db.function('JSON_UNQUOTE', value => value)
  const calls = []
  let active = false, leases = 0
  const connection = {
    async execute(sql, params = []) {
      calls.push({ sql, params })
      if (sql === 'SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY') return [[]]
      assert.match(sql, /^SELECT\b/)
      const rows = db.prepare(sql.replace(/\s+FOR UPDATE\s*$/i, '')).all(...params)
      return [rows.map(row => ({ ...row }))]
    },
    async beginTransaction() { db.exec('BEGIN'); active = true },
    async rollback() { db.exec('ROLLBACK'); active = false },
    release() { assert.equal(active, false) },
    destroy() { if (active) db.exec('ROLLBACK'); active = false }
  }
  const repository = new FilmRepository()
  repository.getConnection = () => ({ async getConnection() { leases++; return connection } })
  const service = new FilmService({ repository, permissionCheck: async () => true,
    tableExists: async () => true, columnExists: async () => true, now: () => now })
  function insert(table, row) {
    const fields = Object.keys(row)
    db.prepare(`INSERT INTO ${table} (${fields.join(',')}) VALUES (${fields.map(() => '?').join(',')})`).run(...Object.values(row))
  }
  insert('models', { id: 13, name: 'iPhone 13' }); insert('phones', { id: 11, model_id: 13 })
  insert('customers', { id: 9 }); insert('customers', { id: 10 })
  insert('stores', { id: 1, name: '购买店' }); insert('stores', { id: 2, name: '服务店' })
  insert('users', { id: 7, name: '贴膜员工' })
  const sale = (id, extra = {}) => insert('sales', { id, phone_id: 11, customer_id: 9, store_id: 1,
    sale_type: 'retail', status: 'completed', sale_time: '2026-11-01 09:00:00', ...extra })
  function film(id, { customerId = 9, storeId = 2, quantities = [1], phoneId = null } = {}) {
    insert('sales_orders', { id, order_no: `SO-film-${id}` })
    insert('customer_film_services', { id, order_id: id, customer_id: customerId, qualification_sale_id: null,
      store_id: storeId, operator_id: 7, created_by: 7, quantity: quantities.reduce((sum, value) => sum + value, 0),
      business_time: now, created_at: now, phone_id: phoneId })
    quantities.forEach((quantity, index) => insert('sales_order_items', { id: id * 10 + index, order_id: id,
      item_type: 'accessory', quantity, total_amount: index ? 0 : quantity * 20,
      snapshot: JSON.stringify({ name: index ? '原免费膜' : '原收费膜', sale_type: index ? 'gift' : 'sale',
        supplier_name: '内部采购资料', purchase_cost: 3 }) }))
  }
  return { db, service, repository, connection, calls, sale, film, insert, get leases() { return leases } }
}

test('按当前手机客户关系确认权益，跨店及旧退货状态不阻止，纯客户历史不提供办理资格', async t => {
  const f = fixture(t)
  f.sale(1)
  assert.equal((await f.service.context(actor, 9)).eligible_for_free, false)
  const context = await f.service.context(actor, 9, { phone_id: 11 })
  assert.equal(context.eligible_for_free, true)
  assert.deepEqual(context.device, { phone_id: 11, model_id: 13, model_name: 'iPhone 13' })
  f.db.exec("UPDATE sales SET status = 'cancelled'")
  assert.equal((await f.service.context(actor, 9, { phone_id: 11 })).eligible_for_free, true)
  assert.equal(f.leases, 3)
})

test('错客户、无真实手机和无型号关系不能办理，客户历史仍可独立读取', async t => {
  const f = fixture(t)
  f.sale(1, { customer_id: 10 })
  await assert.rejects(f.service.context(actor, 9, { phone_id: 11 }), { code: 'FILM_DEVICE_REQUIRED' })
  await assert.rejects(f.service.context(actor, 10, { phone_id: 99 }), { code: 'FILM_DEVICE_REQUIRED' })
  assert.equal((await f.service.context(actor, 10, { phone_id: 11 })).eligible_for_free, true)
  f.db.exec('UPDATE phones SET model_id = NULL')
  await assert.rejects(f.service.context(actor, 10, { phone_id: 11 }), { code: 'FILM_DEVICE_REQUIRED' })
  assert.equal((await f.service.context(actor, 10)).service_count, 0)
})

test('一次贴膜多件耗材仍计一次，跨店历史保留原成交资料且不泄漏内部字段', async t => {
  const f = fixture(t)
  f.sale(1)
  f.film(1, { storeId: 1, quantities: [2, 1] })
  f.film(2, { storeId: 2, quantities: [1] })
  f.film(3, { customerId: 10, quantities: [50] })
  f.insert('sales_order_items', { id: 99, order_id: 1, item_type: 'phone', quantity: 1, total_amount: 9999,
    snapshot: JSON.stringify({ name: '原手机', sale_type: 'retail' }) })
  const context = await f.service.context(actor, 9)
  assert.equal(context.service_count, 2)
  assert.equal(context.film_quantity, 4)
  assert.deepEqual(context.data.map(row => [row.id, row.store_name, row.quantity]), [[2, '服务店', 1], [1, '购买店', 3]])
  assert.deepEqual(context.data[1].items, [
    { name: '原收费膜', sale_type: 'sale', quantity: 2, total_amount: 40 },
    { name: '原免费膜', sale_type: 'gift', quantity: 1, total_amount: 0 }
  ])
  for (const hidden of ['qualification_sale_id', 'created_by', 'supplier_name', 'purchase_cost', 'snapshot']) {
    assert.equal(JSON.stringify(context).includes(`"${hidden}"`), false)
  }
  f.db.exec("UPDATE sales SET status = 'cancelled'")
  const afterReturn = await f.service.context(actor, 9)
  assert.equal(afterReturn.eligible_for_free, false)
  assert.equal(afterReturn.service_count, 2)
  assert.equal(afterReturn.film_quantity, 4)
  assert.equal(f.calls.every(({ sql }) => !/^(?:INSERT|UPDATE|DELETE)\b/.test(sql)), true)
})

test('贴膜分页仅返回当前客户该页商品，次数与用膜总量保持全量口径；空页不读取商品', async t => {
  const f = fixture(t)
  for (let id = 1; id <= 21; id++) f.film(id, { storeId: id % 2 ? 1 : 2, quantities: [2] })
  f.film(22, { customerId: 10, quantities: [99] })
  const result = await f.service.context(actor, 9, { page: 2, page_size: 20 })
  assert.equal(result.service_count, 21)
  assert.equal(result.film_quantity, 42)
  assert.deepEqual(result.pagination, { page: 2, page_size: 20, total: 21, total_pages: 2, has_next: false, has_prev: true })
  assert.deepEqual(result.data.map(row => [row.id, row.items.length]), [[1, 1]])
  assert.equal(result.data[0].items[0].total_amount, 40)
  const empty = await f.service.context(actor, 9, { page: 3, page_size: 20 })
  assert.deepEqual(empty.data, [])
  assert.equal(empty.service_count, 21)
  assert.equal(f.calls.at(-1).sql.includes('FROM customer_film_services f'), true)
})

test('贴膜记录按收费/免费筛选整单，混合收费与赠送归入收费并返回全量分类数量', async t => {
  const f = fixture(t)
  f.film(1, { quantities: [1] })
  f.db.prepare('UPDATE sales_order_items SET snapshot = ? WHERE order_id = ?').run(JSON.stringify({ name: '纯免费膜', sale_type: 'gift' }), 1)
  f.film(2, { quantities: [1] })
  f.film(3, { quantities: [1, 1] })

  const all = await f.service.context(actor, 9, { page: 1, page_size: 10, sale_type: 'all' })
  assert.equal(all.service_count, 3)
  assert.equal(all.free_count, 1)
  assert.equal(all.paid_count, 2)
  assert.equal(all.pagination.total, 3)

  const free = await f.service.context(actor, 9, { page: 1, page_size: 10, sale_type: 'gift' })
  assert.deepEqual(free.data.map(row => row.id), [1])
  assert.equal(free.service_count, 3)
  assert.equal(free.pagination.total, 1)
  assert.equal(free.free_count, 1)
  assert.equal(free.paid_count, 2)

  const paid = await f.service.context(actor, 9, { page: 1, page_size: 10, sale_type: 'sale' })
  assert.deepEqual(paid.data.map(row => row.id), [3, 2])
  assert.equal(paid.pagination.total, 2)
  await assert.rejects(f.service.context(actor, 9, { sale_type: 'unknown' }), { code: 'FILM_SERVICE_INVALID' })
})

test('本机按客户及实物设备统计，区分同型号手机，跨店累计且不猜测旧记录归属', async t => {
  const f = fixture(t)
  f.insert('phones', { id: 12, model_id: 13 })
  f.insert('models', { id: 14, name: 'iPhone 14' })
  f.insert('phones', { id: 13, model_id: 14 })
  f.sale(1); f.sale(2, { phone_id: 12 }); f.sale(3, { phone_id: 13 })
  f.film(1, { phoneId: 11, storeId: 1, quantities: [2, 1] })
  f.film(2, { phoneId: 11, storeId: 2, quantities: [1] })
  f.film(3, { phoneId: 12, quantities: [5] })
  f.film(4, { phoneId: 13, quantities: [2] })
  f.film(5, { quantities: [3] })
  f.film(6, { phoneId: 11, customerId: 10, quantities: [99] })
  for (const page of [1, 2, 9]) {
    const context = await f.service.context(actor, 9, { phone_id: 11, page, page_size: 2 })
    assert.equal(context.device_service_count, 2)
    assert.equal(context.device_film_quantity, 4)
    assert.equal(context.service_count, 5)
    assert.equal(context.film_quantity, 14)
    assert.equal(context.pagination.total, 5)
    if (page === 9) assert.deepEqual(context.data, [])
  }
  const sameModel = await f.service.context(actor, 9, { phone_id: 12 })
  assert.equal(sameModel.device_service_count, 1)
  assert.equal(sameModel.device_film_quantity, 5)
  const customerOnly = await f.service.context(actor, 9)
  assert.equal(customerOnly.device_service_count, null)
  assert.equal(customerOnly.device_film_quantity, null)
  assert.equal(customerOnly.service_count, 5)
  assert.equal(customerOnly.film_quantity, 14)
})

test('客户与设备无贴膜记录时返回真实零；其他设备有记录也不计入本机', async t => {
  const f = fixture(t)
  f.sale(1)
  const empty = await f.service.context(actor, 9, { phone_id: 11 })
  assert.equal(empty.device_service_count, 0)
  assert.equal(empty.device_film_quantity, 0)
  assert.equal(empty.service_count, 0)
  assert.equal(empty.film_quantity, 0)
  f.film(1, { phoneId: 12, quantities: [2] })
  const other = await f.service.context(actor, 9, { phone_id: 11 })
  assert.equal(other.device_service_count, 0)
  assert.equal(other.device_film_quantity, 0)
  assert.equal(other.service_count, 1)
  assert.equal(other.film_quantity, 2)
})
