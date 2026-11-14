'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const FilmService = require('../src/services/film-service.service')
const FilmRepository = require('../src/repositories/film-service.repository')
const Checkout = require('../src/services/sales-checkout.service')
const CheckoutController = require('../src/controllers/sales-checkout.controller')
const FilmController = require('../src/controllers/film-service.controller')
const AccessoryService = require('../src/services/accessory.service')
const AccessoryRepository = require('../src/repositories/accessory.repository')
const { normalizePointsConfig } = require('../src/utils/customer-points-rules')

const actor = { id: 7, name: '办理人', store_ids: [2] }
const now = '2026-11-14 10:00:00'
const body = (overrides = {}) => ({ request_key: 'a'.repeat(32), store_id: 2, operator_id: 7,
  film_service: { customer_id: 9 }, phones: [], customer_info: { name: '服务客户', phone: '13800138000' },
  sale_time: now, accessories: [{ key: 'film', accessory_id: 5, quantity: 2, unit_price: 0, sale_type: 'gift' }],
  payment_info: { payment_method: 'cash', payment_amount: 0 }, ...overrides })
const code = expected => error => error.code === expected

function fixture({ qualifying = true, denied = [], ready = true, enabled = true, failAt } = {}) {
  const state = { stock: 20, points: 0, orders: [], items: [], payments: [], films: [] }, calls = []
  let before
  const connection = { async execute(sql) { calls.push(sql); if (failAt === 'configure') throw new Error('configure-failed'); return [[]] },
    async beginTransaction() { before = structuredClone(state); calls.push('begin'); if (failAt === 'begin') throw new Error('begin-failed') },
    async commit() { if (failAt === 'commit') throw new Error('commit-failed'); calls.push('commit') },
    async rollback() { calls.push('rollback'); if (failAt === 'rollback') throw new Error('rollback-failed'); Object.assign(state, before) },
    destroy() { calls.push('destroy') } }
  const check = db => assert.equal(db, connection)
  const permissionCheck = async (_actor, key) => !denied.includes(key)
  const withConnection = async run => { try { return await run(connection) } finally { calls.push('release') } }
  const filmRepository = { withConnection,
    async customer(db) { check(db); return { id: 9 } },
    async qualification(db, customerId, time, options) { check(db); assert.equal(customerId, 9); assert.equal(time, now)
      calls.push(options?.lock ? 'qualification-lock' : 'qualification-read'); return qualifying ? { id: 80 } : null },
    async product(db) { check(db); return { film_enabled: enabled ? 1 : 0, category_status: 1 } },
    async append(db, row) { check(db); if (failAt === 'film') throw new Error('film-failed')
      state.films.push({ ...row, id: state.films.length + 1 }); return state.films.length },
    async history(db) { check(db); return { rows: state.films, total: state.films.length,
      total_quantity: state.films.reduce((sum, row) => sum + row.quantity, 0),
      items: state.items.map(row => ({ order_id: row.order_id, quantity: row.quantity,
        total_amount: row.total_amount, name: row.snapshot.name, sale_type: row.snapshot.sale_type })) } }
  }
  const films = new FilmService({ repository: filmRepository, permissionCheck, now: () => now,
    tableExists: async () => ready, columnExists: async () => ready })
  const repository = { withConnection,
    async findRequest(db, key) { check(db); return state.orders.find(row => row.request_key === key) },
    async validStore(db, id) { check(db); return id === 2 },
    async seller(db) { check(db); return { id: 7, name: '办理人', salary_template_id: 3,
      goods_commission_rule: { enabled: true, type: 'fixed', fixed_amount: 1, percentage: 0 } } },
    async lockCustomer(db) { check(db); return { id: 9, points: state.points } },
    async customerByPhone(db) { check(db); return { id: 9, points: state.points } },
    async phoneSnapshots(db, ids) { check(db); assert.deepEqual(ids, []); return [] },
    async createOrder(db, row) { check(db); state.orders.push({ ...row, id: state.orders.length + 1 }); return state.orders.length },
    async createItem(db, row) { check(db); state.items.push({ ...row, id: state.items.length + 1 }); return state.items.length },
    async createPayment(db, row) { check(db); state.payments.push({ ...row, id: 1 }); return 1 },
    async completeOrder(db, row) { check(db); if (failAt === 'complete') throw new Error('complete-failed')
      state.orders.find(order => order.id === row.id).checkout_result = structuredClone(row.result) }
  }
  const product = { id: 5, name: '原钢化膜', category_id: 1, category: '钢化膜', unit: '张' }
  const checkout = new Checkout({ repository, films, permissionCheck,
    phones: { async resolveCustomer(db) { check(db); return 9 } },
    accessories: { normalizeSerials: value => value || [], async lockSaleProduct() { return product },
      async issueSale(row, _actor, db, meta) { check(db); state.stock -= row.quantity
        return { sale_id: state.items.length + 1, sale_no: 'PS-film', total_price: meta.resolveTotalCents(product) / 100,
          purchase_cost: row.quantity, accessory: product, serial_numbers: [] } } },
    getPointsConfig: async () => normalizePointsConfig({ include_accessories: true, accessory_points_per_100: 100 }),
    creditPoints: async (db, _id, points) => { check(db); state.points += points },
    pointsLedger: { async ready() { return false } }, normalizeDate: value => value })
  return { checkout, films, state, connection, calls, repository, filmRepository }
}

test('免费贴膜跨购买门店，出库仍限授权服务店；一笔服务与耗膜数量分别记录且重试不重复', async () => {
  const f = fixture(), result = await f.checkout.checkout(body(), actor)
  assert.equal(result.film_service_id, 1); assert.equal(result.paid_amount, 0); assert.equal(result.points_earned, 0)
  assert.equal(f.state.stock, 18); assert.equal(f.state.films.length, 1); assert.equal(f.state.films[0].quantity, 2)
  assert.equal(f.state.films[0].qualification_sale_id, 80); assert.equal(f.state.films[0].store_id, 2)
  assert.equal(f.state.payments.length, 0); assert.equal(f.state.items[0].snapshot.commission.reason, 'gift')
  assert.deepEqual(await f.checkout.checkout(body(), actor), result)
  assert.equal(f.state.stock, 18); assert.equal(f.state.films.length, 1)
  const context = await f.films.context(actor, 9)
  assert.equal(context.service_count, 1); assert.equal(context.film_quantity, 2); assert.equal(context.data[0].items[0].sale_type, 'gift')
  assert.equal('qualification_sale_id' in context.data[0], false)
  assert.equal('created_by' in context.data[0], false)
  await assert.rejects(f.checkout.checkout(body({ store_id: 1 }), actor), code('STORE_SCOPE_DENIED'))
})

test('无有效手机购买记录不能免费；付费膜仍通过商品结算收款，不能伪造资格或同单现买手机', async () => {
  const f = fixture({ qualifying: false })
  await assert.rejects(f.checkout.checkout(body(), actor), code('FILM_QUALIFICATION_REQUIRED'))
  assert.equal(f.state.stock, 20); assert.equal(f.state.films.length, 0)
  const paid = body({ accessories: [{ key: 'paid', accessory_id: 5, quantity: 1, unit_price: 20, sale_type: 'sale' }],
    payment_info: { payment_method: 'cash', payment_amount: 20 } })
  const result = await f.checkout.checkout(paid, actor)
  assert.equal(result.paid_amount, 20); assert.equal(f.state.payments[0].amount, 20)
  assert.equal(f.state.films[0].qualification_sale_id, null)
  assert.equal(result.points_earned, 20); assert.equal(f.state.points, 20)
  assert.equal(f.state.items[0].snapshot.commission.earned_cents, 100)
  await assert.rejects(f.checkout.checkout(body({ request_key: 'b'.repeat(32), film_service: { customer_id: 10 } }), actor), code('FILM_SERVICE_INVALID'))
  await assert.rejects(f.checkout.checkout(body({ film_service: { customer_id: 9, eligible_for_free: true } }), actor), code('FILM_SERVICE_INVALID'))
  await assert.rejects(f.checkout.checkout(body({ request_key: 'c'.repeat(32), phones: [{ phone_id: 1, sale_price: 20 }], accessories: [
    { key: 'film', accessory_id: 5, quantity: 1, unit_price: 0, sale_type: 'gift', linked_phone_id: 1 }],
  payment_info: { payment_method: 'cash', payment_amount: 20 } }), actor), code('FILM_SERVICE_INVALID'))
})

test('独立贴膜权限不替代赠送/销售权限，类型标记和结构缺失均在出库前拒绝', async () => {
  for (const permission of ['query:film', 'query:view', 'accessories:view', 'accessories:gift']) {
    const f = fixture({ denied: [permission] })
    await assert.rejects(f.checkout.checkout(body(), actor), code('PERMISSION_DENIED'))
    assert.equal(f.state.stock, 20); assert.equal(f.state.orders.length, 0)
  }
  for (const [options, expected] of [[{ enabled: false }, 'FILM_PRODUCT_REQUIRED'], [{ ready: false }, 'FILM_SERVICE_NOT_READY']]) {
    const f = fixture(options)
    await assert.rejects(f.checkout.checkout(body(), actor), code(expected))
    assert.equal(f.state.stock, 20); assert.equal(f.state.orders.length, 0)
  }
})

for (const failure of ['film', 'complete', 'commit']) test(`贴膜${failure}失败时服务、库存、商品单和收款同事务回滚`, async () => {
  const f = fixture({ failAt: failure })
  await assert.rejects(f.checkout.checkout(body({ accessories: [{ key: 'paid', accessory_id: 5, quantity: 1, unit_price: 20, sale_type: 'sale' }],
    payment_info: { payment_method: 'cash', payment_amount: 20 } }), actor), new RegExp(`${failure}-failed`))
  assert.equal(f.state.stock, 20)
  for (const key of ['orders', 'items', 'payments', 'films']) assert.deepEqual(f.state[key], [])
  assert.deepEqual(f.calls.slice(-2), ['rollback', 'release'])
})

test('报价只读，正式确认重核资格；同请求改客户或商品不能串用原服务', async () => {
  const f = fixture()
  await f.checkout.quote(body(), actor)
  assert.equal(f.state.stock, 20); assert.deepEqual(f.state.films, [])
  await f.checkout.checkout(body(), actor)
  await assert.rejects(f.checkout.checkout(body({ accessories: [{ key: 'film', accessory_id: 5, quantity: 1, unit_price: 0, sale_type: 'gift' }] }), actor), code('CHECKOUT_REQUEST_CONFLICT'))
  assert.equal(f.state.stock, 18)
})

test('无SN时仍遵守严格贴膜字段权限，查询递归遮蔽数量、费用及门店且不返回资格来源', async () => {
  let writes = 0
  const controller = new CheckoutController({ service: { async checkout() { writes++ } }, filmAccess: {
    async getPermissions() { return { hiddenFields: ['customer_info.customer_phone'] } }
  } })
  const response = () => ({ status(value) { this.statusCode = value; return this }, json(value) { this.body = value; return this } })
  const res = response()
  await controller.checkout({ user: actor, body: body() }, res)
  assert.equal(res.statusCode, 403); assert.equal(writes, 0)
  const f = fixture(); await f.checkout.checkout(body(), actor)
  const masked = new FilmController({ service: f.films })
  masked.access.masking = { async getUserFieldPermissions(_user, module, options) {
    assert.equal(module, 'accessories_accessoriesview'); assert.equal(options.strict, true)
    return { hiddenFields: ['stock_info.total_quantity', 'price_info.total_price', 'stock_info.distribution'] }
  }, filterSensitiveFields: rows => rows }
  const result = response()
  await masked.context({ user: actor, params: { customerId: 9 }, query: {} }, result)
  assert.equal(result.body.data.data[0].store_id, null)
  assert.equal(result.body.data.data[0].items[0].total_amount, null)
  assert.equal(result.body.data.film_quantity, null)
  assert.equal(result.body.data.data[0].items[0].quantity, null)
  assert.equal(result.body.data.service_count, 1)
  assert.equal('qualification_sale_id' in result.body.data.data[0], false)
  assert.equal('created_by' in result.body.data.data[0], false)
})

test('资格只核对客户有效零售且截至服务日期，不要求原门店；仓储参数化并持锁', async () => {
  const queries = [], repo = new FilmRepository(), db = { async execute(sql, params) { queries.push({ sql, params }); return [[{ id: 80 }]] } }
  await repo.qualification(db, 9, now, { lock: true })
  assert.deepEqual(queries[0].params, [9, now]); assert.match(queries[0].sql, /sale_type = 'retail'/)
  assert.match(queries[0].sql, /pending.*completed/); assert.match(queries[0].sql, /FOR UPDATE$/)
  assert.doesNotMatch(queries[0].sql, /store_id|JOIN phones/)
})

test('类型标记严格布尔、旧客户端省略保留原值、单位不能冒充贴膜类型', async () => {
  const writes = [], repository = new AccessoryRepository({ columnExists: async () => true })
  repository.executePrepared = async (sql, values) => { writes.push({ sql, values }); return [{ affectedRows: 1, insertId: 8 }] }
  const service = new AccessoryService({ repository })
  for (const flag of [1, 'true', null]) await assert.rejects(service.saveProductCatalogItem('category', 1, { name: '膜', film_enabled: flag }), code('VALIDATION_ERROR'))
  await assert.rejects(service.saveProductCatalogItem('unit', 1, { name: '张', film_enabled: true }), code('VALIDATION_ERROR'))
  await service.saveProductCatalogItem('category', 1, { name: '膜', film_enabled: true })
  assert.match(writes[0].sql, /film_enabled = \?/); assert.equal(writes[0].values.at(-2), 1)
  await service.saveProductCatalogItem('category', 1, { name: '钢化膜' })
  assert.doesNotMatch(writes[1].sql, /film_enabled/)
})

test('试算后购买记录失效，正式办理重新拒绝免费；未来日期不能提前耗膜', async () => {
  const f = fixture()
  await f.checkout.quote(body(), actor)
  f.filmRepository.qualification = async () => null
  await assert.rejects(f.checkout.checkout(body(), actor), code('FILM_QUALIFICATION_REQUIRED'))
  assert.equal(f.state.stock, 20); assert.deepEqual(f.state.films, [])
  const future = fixture()
  await assert.rejects(future.checkout.checkout(body({ sale_time: '2026-11-15 10:00:00' }), actor), code('FILM_SERVICE_INVALID'))
  assert.equal(future.state.stock, 20); assert.deepEqual(future.state.orders, [])
})

test('贴膜历史只给指定客户的最小服务快照，分页/权限/客户/结构故障均失败关闭并释放连接', async () => {
  const f = fixture()
  for (const query of [{ page: 0 }, { page: true }, { page_size: 101 }, { page_size: '2x' }, { store_id: 2 }, null, []]) {
    await assert.rejects(f.films.context(actor, 9, query), code('FILM_SERVICE_INVALID'))
  }
  assert.equal(f.calls.length, 0)
  await assert.rejects(fixture({ denied: ['query:film'] }).films.context(actor, 9), code('PERMISSION_DENIED'))
  await assert.rejects(fixture({ ready: false }).films.context(actor, 9), code('FILM_SERVICE_NOT_READY'))
  f.filmRepository.customer = async () => null
  await assert.rejects(f.films.context(actor, 9), code('NOT_FOUND'))
  assert.deepEqual(f.calls.slice(-2), ['rollback', 'release'])
  f.filmRepository.customer = async () => ({ id: 9 })
  f.filmRepository.history = async () => { throw new Error('history-failed') }
  await assert.rejects(f.films.context(actor, 9), /history-failed/)
  assert.deepEqual(f.calls.slice(-2), ['rollback', 'release'])
})

test('贴膜历史共用单连接只读RR快照，正常及业务失败释放，配置/启动/回滚失败销毁后释放', async () => {
  const normal = fixture()
  await normal.films.context(actor, 9)
  assert.equal(normal.calls[0], 'SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY')
  assert.deepEqual(normal.calls.slice(-2), ['rollback', 'release'])
  assert.equal(normal.calls.includes('destroy'), false)
  for (const stage of ['configure', 'begin', 'rollback']) {
    const f = fixture({ failAt: stage })
    await assert.rejects(f.films.context(actor, 9), new RegExp(`${stage}-failed`))
    assert.deepEqual(f.calls.slice(-2), ['destroy', 'release'])
    assert.equal(f.calls.filter(value => value === 'rollback').length, stage === 'rollback' ? 1 : 0)
    assert.deepEqual(f.state.films, [])
  }
})

test('客户姓名或手机号字段隐藏时贴膜定向历史在服务查询前拒绝，不能借次数或资格反查客户', async () => {
  for (const field of ['customer_info.customer_name', 'customer_info.customer_phone']) {
    let called = false
    const controller = new FilmController({ service: { async context() { called = true } } })
    controller.access.masking = { async getUserFieldPermissions() { return { hiddenFields: [field] } } }
    const res = { status(value) { this.statusCode = value; return this }, json(value) { this.body = value; return this } }
    await controller.context({ user: actor, params: { customerId: 9 }, query: {} }, res)
    assert.equal(called, false); assert.equal(res.statusCode, 403)
    assert.equal(res.body.code, 'FIELD_PERMISSION_DENIED'); assert.equal('data' in res.body, false)
  }
})

test('隐藏数量或用途时连同收费金额遮蔽，防止由半份财务数据反推；权限读取故障不进服务', async () => {
  for (const hidden of ['stock_info.total_quantity', 'basic_info.usage_type', 'price_info.unit_price', 'price_info.total_price']) {
    const controller = new FilmController({ service: { async context() { return { data: [
      { quantity: 2, items: [{ quantity: 2, sale_type: 'sale', total_amount: 40 }] }] } } } })
    controller.access.masking = { async getUserFieldPermissions() { return { hiddenFields: [hidden] } }, filterSensitiveFields: rows => rows }
    const res = { json(value) { this.body = value; return this } }
    await controller.context({ user: actor, params: { customerId: 9 }, query: {} }, res)
    assert.equal(res.body.data.data[0].items[0].total_amount, null)
  }
  let called = false
  const controller = new FilmController({ service: { async context() { called = true } },
    access: { async getPermissions() { throw new Error('permission-unavailable') } }, logger: { error() {} } })
  const res = { status(value) { this.statusCode = value; return this }, json(value) { this.body = value; return this } }
  await controller.context({ user: actor, params: { customerId: 9 }, query: {} }, res)
  assert.equal(res.statusCode, 500); assert.equal(called, false)
  assert.equal(JSON.stringify(res.body).includes('permission-unavailable'), false)
})

test('旧环境目录读取兼容缺列，显式写标记返回409，省略则沿用旧写入；新增与关闭均参数化', async () => {
  const calls = [], repo = new AccessoryRepository({ columnExists: async () => false })
  repo.queryRows = async sql => { calls.push(sql); return [] }
  assert.equal((await repo.getProductCatalog()).film_ready, false)
  assert.match(calls[0], /NULL AS film_enabled/)
  repo.executePrepared = async (sql, values) => { calls.push({ sql, values }); return [{ insertId: 8, affectedRows: 1 }] }
  await assert.rejects(repo.saveCatalogItem('category', null, { name: '膜', film_enabled: false }), code('FILM_SERVICE_NOT_READY'))
  assert.equal(calls.length, 2)
  await repo.saveCatalogItem('category', 1, { name: '膜', status: 1, sort_order: 0, description: null })
  assert.doesNotMatch(calls[2].sql, /film_enabled/)
  repo.columnExists = async () => true
  await repo.saveCatalogItem('category', null, { name: '膜', status: 1, sort_order: 0, description: null, film_enabled: true })
  assert.match(calls[3].sql, /film_enabled/); assert.equal(calls[3].values.at(-1), 1)
  await repo.saveCatalogItem('category', 1, { name: '膜', status: 1, sort_order: 0, description: null, film_enabled: false })
  assert.equal(calls[4].values.at(-2), 0)
})
