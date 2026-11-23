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
  film_service: { customer_id: 9, phone_id: 11, mode: 'free', quantity: 2 }, phones: [], customer_info: { name: '服务客户', phone: '13800138000' },
  sale_time: now, accessories: [],
  payment_info: { payment_method: 'cash', payment_amount: 0 }, ...overrides })
const code = expected => error => error.code === expected

function fixture({ qualifying = true, denied = [], ready = true, enabled = true, failAt } = {}) {
  const state = { stock: 20, points: 0, orders: [], items: [], payments: [], films: [] }, calls = []
  let currentTime = now
  let before
  const connection = { async execute(sql) { calls.push(sql); if (failAt === 'configure') throw new Error('configure-failed'); return [[]] },
    async beginTransaction() { before = structuredClone(state); calls.push('begin'); if (failAt === 'begin') throw new Error('begin-failed') },
    async commit() { if (failAt === 'commit') throw new Error('commit-failed'); calls.push('commit') },
    async rollback() { calls.push('rollback'); if (failAt === 'rollback') throw new Error('rollback-failed'); Object.assign(state, before) },
    destroy() { calls.push('destroy') } }
  const check = db => assert.equal(db, connection)
  const permissionCheck = async (_actor, key) => !key.startsWith('query:goods-') && !denied.includes(key)
  const withConnection = async run => { try { return await run(connection) } finally { calls.push('release') } }
  const filmRepository = { withConnection,
    async customer(db) { check(db); return { id: 9 } },
    async device(db, phoneId, customerId, options) { check(db); assert.equal(phoneId, 11); assert.equal(customerId, 9)
      calls.push(options?.lock ? 'device-lock' : 'device-read'); return qualifying ? { phone_id: 11, model_id: 13, model_name: 'iPhone 13', sale_id: 80 } : null },
    async matchingTemplates(db, modelId) { check(db); assert.equal(modelId, 13); calls.push('match'); return enabled ? [{ id: 4 }] : [] },
    async availableProducts(db, templateId, storeId) { check(db); assert.equal(templateId, 4); assert.equal(storeId, 2); return [{ id: 5, quantity: state.stock, serial_quantity: 0 }] },
    async compatible() { return true },
    async product(db) { check(db); return { id: 5, root_id: 4, status: 1, category_status: 1, category_name: '钢化膜', free_film: 0 } },
    async append(db, row) { check(db); if (failAt === 'film') throw new Error('film-failed')
      state.films.push({ ...row, id: state.films.length + 1 }); return state.films.length },
    async history(db, customerId, { phone_id: phoneId, sale_type: saleType, page, page_size: pageSize }) { check(db)
      const rows = state.films.filter(row => row.customer_id === customerId)
      const deviceRows = rows.filter(row => row.phone_id === phoneId)
      const isPaid = row => state.items.some(item => item.order_id === row.order_id && item.snapshot.sale_type === 'sale')
      const filtered = saleType === 'sale' ? rows.filter(isPaid) : saleType === 'gift' ? rows.filter(row => !isPaid(row)) : rows
      const paidCount = rows.filter(isPaid).length
      return { rows: filtered.slice((page - 1) * pageSize, page * pageSize), total: rows.length,
        free_count: rows.length - paidCount, paid_count: paidCount, filtered_total: filtered.length,
        total_quantity: rows.reduce((sum, row) => sum + row.quantity, 0),
        device_total: phoneId === null ? null : deviceRows.length,
        device_total_quantity: phoneId === null ? null : deviceRows.reduce((sum, row) => sum + row.quantity, 0),
        items: state.items.map(row => ({ order_id: row.order_id, quantity: row.quantity,
          total_amount: row.total_amount, name: row.snapshot.name, sale_type: row.snapshot.sale_type })) } }
  }
  const films = new FilmService({ repository: filmRepository, permissionCheck, now: () => currentTime,
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
    pointsLedger: { async ready() { return false } }, normalizeDate: value => value,
    prepareInvoice: async () => {}, createOrderNo: async () => 'SO-FILM-TEST' })
  return { checkout, films, state, connection, calls, repository, filmRepository, setNow(value) { currentTime = value } }
}

test('贴膜赠送使用提交时的服务端北京时间，忽略客户端日期且重试不重复', async () => {
  const f = fixture(), result = await f.checkout.checkout(body({ sale_time: '2020-01-01' }), actor)
  assert.equal(result.film_service_id, 1); assert.equal(result.paid_amount, 0); assert.equal(result.points_earned, 0)
  assert.equal(f.state.stock, 18); assert.equal(f.state.films.length, 1); assert.equal(f.state.films[0].quantity, 2)
  assert.equal(f.state.films[0].business_time, now); assert.equal(f.state.films[0].created_at, now)
  assert.equal(f.state.orders[0].time, now); assert.equal(f.state.items[0].time, now)
  assert.equal(f.state.films[0].qualification_sale_id, null); assert.equal(f.state.films[0].phone_id, 11); assert.equal(f.state.films[0].model_id, 13); assert.equal(f.state.films[0].store_id, 2)
  assert.equal(f.state.payments.length, 0); assert.equal(f.state.items[0].snapshot.commission.reason, 'gift')
  f.setNow('2026-11-14 10:00:05')
  assert.deepEqual(await f.checkout.checkout(body({ sale_time: '2020-01-01' }), actor), result)
  assert.equal(f.state.stock, 18); assert.equal(f.state.films.length, 1)
  const context = await f.films.context(actor, 9)
  assert.equal(context.service_count, 1); assert.equal(context.film_quantity, 2); assert.equal(context.data[0].items[0].sale_type, 'gift')
  assert.equal('qualification_sale_id' in context.data[0], false)
  assert.equal('created_by' in context.data[0], false)
  await assert.rejects(f.checkout.checkout(body({ store_id: 1 }), actor), code('STORE_SCOPE_DENIED'))
})

test('核验当前手机与客户真实关联，收费膜独立收款并积分提成，拒绝伪造关联及混售手机', async () => {
  const missing = fixture({ qualifying: false })
  await assert.rejects(missing.checkout.checkout(body(), actor), code('FILM_DEVICE_REQUIRED'))
  assert.equal(missing.state.stock, 20); assert.equal(missing.state.films.length, 0)
  const f = fixture()
  const paid = body({ sale_time: '2020-01-01 23:59:59', film_service: { customer_id: 9, phone_id: 11, mode: 'paid' },
    accessories: [{ key: 'paid', accessory_id: 5, quantity: 1, unit_price: 20, sale_type: 'sale' }],
    payment_info: { payment_method: 'cash', payment_amount: 20 } })
  const result = await f.checkout.checkout(paid, actor)
  assert.equal(result.paid_amount, 20); assert.equal(f.state.payments[0].amount, 20)
  assert.equal(f.state.payments[0].time, now); assert.equal(f.state.orders[0].time, now); assert.equal(f.state.items[0].time, now)
  assert.equal(f.state.films[0].phone_id, 11); assert.equal(f.state.films[0].qualification_sale_id, null)
  assert.equal(result.points_earned, 20); assert.equal(f.state.points, 20)
  assert.equal(f.state.items[0].snapshot.commission.earned_cents, 100)
  await assert.rejects(f.checkout.checkout(body({ request_key: 'b'.repeat(32), film_service: { customer_id: 10 } }), actor), code('FILM_SERVICE_INVALID'))
  await assert.rejects(f.checkout.checkout(body({ film_service: { customer_id: 9, eligible_for_free: true } }), actor), code('FILM_SERVICE_INVALID'))
  await assert.rejects(f.checkout.checkout(body({ request_key: 'c'.repeat(32), phones: [{ phone_id: 1, sale_price: 20 }], accessories: [
    { key: 'film', accessory_id: 5, quantity: 1, unit_price: 0, sale_type: 'gift', linked_phone_id: 1 }],
  payment_info: { payment_method: 'cash', payment_amount: 20 } }), actor), code('PERMISSION_DENIED'))
})

test('贴膜必须获独立动作授权，模板标记和结构缺失均在出库前拒绝', async () => {
  for (const permission of ['query:film', 'query:view']) {
    const f = fixture({ denied: [permission] })
    await assert.rejects(f.checkout.checkout(body(), actor), code('PERMISSION_DENIED'))
    assert.equal(f.state.stock, 20); assert.equal(f.state.orders.length, 0)
  }
  for (const [options, expected] of [[{ enabled: false }, 'FILM_TEMPLATE_REQUIRED'], [{ ready: false }, 'FILM_SERVICE_NOT_READY']]) {
    const f = fixture(options)
    await assert.rejects(f.checkout.checkout(body(), actor), code(expected))
    assert.equal(f.state.stock, 20); assert.equal(f.state.orders.length, 0)
  }
})

test('贴膜动作独立授权收费和赠送，普通商品出库仍须单独授权', async () => {
  for (const saleType of ['sale', 'gift']) {
    const amount = saleType === 'sale' ? 20 : 0
    const input = body({ film_service: { customer_id: 9, phone_id: 11, mode: 'paid' },
      accessories: [{ key: 'film', accessory_id: 5, quantity: 1, unit_price: amount, sale_type: saleType }],
      payment_info: { payment_method: 'cash', payment_amount: amount } })
    const f = fixture({ enabled: false })
    const result = await f.checkout.checkout(input, actor)
    assert.equal(result.paid_amount, amount)
    assert.equal(f.state.stock, 19)
    assert.equal(f.state.films.length, 1)
    assert.equal(f.state.items[0].snapshot.sale_type, saleType)
    const denied = fixture({ enabled: false, denied: [saleType === 'sale' ? 'accessories:sell' : 'accessories:gift'] })
    if (saleType === 'gift') {
      await assert.rejects(denied.checkout.checkout(input, actor), code('PERMISSION_DENIED'))
      assert.equal(denied.state.stock, 20)
      assert.equal(denied.state.orders.length, 0)
    } else {
      await denied.checkout.checkout(input, actor)
      assert.equal(denied.state.stock, 19)
    }
    await assert.rejects(denied.checkout.checkout({ ...input, request_key: 'd'.repeat(32), film_service: undefined }, actor), code('PERMISSION_DENIED'))
    assert.equal(denied.state.stock, saleType === 'sale' ? 19 : 20)
    assert.equal(denied.state.orders.length, saleType === 'sale' ? 1 : 0)
  }
})

for (const failure of ['film', 'complete', 'commit']) test(`贴膜${failure}失败时服务、库存、商品单和收款同事务回滚`, async () => {
  const f = fixture({ failAt: failure })
  await assert.rejects(f.checkout.checkout(body({ film_service: { customer_id: 9, phone_id: 11, mode: 'paid' }, accessories: [{ key: 'paid', accessory_id: 5, quantity: 1, unit_price: 20, sale_type: 'sale' }],
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
  await assert.rejects(f.checkout.checkout(body({ film_service: { customer_id: 9, phone_id: 11, mode: 'free', quantity: 1 } }), actor), code('CHECKOUT_REQUEST_CONFLICT'))
  assert.equal(f.state.stock, 18)
})

test('手机号隐藏时贴膜结算使用客户关联，不要求前端提交手机号', async () => {
  let writes = 0
  const controller = new CheckoutController({ service: { async checkout() { writes++ } }, queryAccess: { async getPermissions() { return { hiddenFields: [] } } }, filmAccess: {
    async getPermissions() { return { hiddenFields: ['customer_info.customer_phone'] } }
  } })
  const response = () => ({ status(value) { this.statusCode = value; return this }, json(value) { this.body = value; return this } })
  const res = response()
  await controller.checkout({ user: actor, body: body() }, res)
  assert.equal(res.statusCode, undefined); assert.equal(writes, 1)
  const f = fixture(); await f.checkout.checkout(body(), actor)
  const masked = new FilmController({ service: f.films, queryAccess: { async getPermissions() { return { hiddenFields: [] } } } })
  masked.access.masking = { async getUserFieldPermissions(_user, module, options) {
    assert.equal(module, 'accessories_accessoriesview'); assert.equal(options.strict, true)
    return { hiddenFields: ['stock_info.total_quantity', 'price_info.total_price', 'stock_info.distribution'] }
  }, filterSensitiveFields: rows => rows }
  const result = response()
  await masked.context({ user: actor, params: { customerId: 9 }, query: { phone_id: 11 } }, result)
  assert.equal(result.body.data.data[0].store_id, null)
  assert.equal(result.body.data.data[0].items[0].total_amount, null)
  assert.equal(result.body.data.film_quantity, null)
  assert.equal(result.body.data.device_film_quantity, null)
  assert.equal(result.body.data.device_service_count, 1)
  assert.equal(result.body.data.data[0].items[0].quantity, null)
  assert.equal(result.body.data.service_count, 1)
  assert.equal('qualification_sale_id' in result.body.data.data[0], false)
  assert.equal('created_by' in result.body.data.data[0], false)
})

test('用途字段隐藏时拒绝按收费或免费筛选，不能通过列表结果推断用途', async () => {
  let calls = 0
  const controller = new FilmController({ service: { async context() { calls++; return { data: [] } } }, access: {
    async getPermissions() { return { hiddenFields: ['basic_info.usage_type'] } }, maskPayload: data => data
  } })
  for (const saleType of ['sale', 'gift']) {
    const res = { status(value) { this.statusCode = value; return this }, json(value) { this.body = value; return this } }
    await controller.context({ user: actor, params: { customerId: 9 }, query: { sale_type: saleType } }, res)
    assert.equal(res.statusCode, 403); assert.equal(res.body.code, 'FIELD_PERMISSION_DENIED')
  }
  assert.equal(calls, 0)
})

test('设备核验按当前手机和客户关联，不限制原门店或旧零售状态，参数化并持锁', async () => {
  const queries = [], repo = new FilmRepository(), db = { async execute(sql, params) { queries.push({ sql, params }); return [[{ phone_id: 11, model_id: 13 }]] } }
  await repo.device(db, 11, 9, { lock: true })
  assert.deepEqual(queries[0].params, [9, 11]); assert.match(queries[0].sql, /s.phone_id = p.id AND s.customer_id = \?/)
  assert.match(queries[0].sql, /FOR UPDATE$/); assert.doesNotMatch(queries[0].sql, /store_id|s.status|sale_type/)
})

test('商品类型和单位不能设置贴膜标记，省略标记仍沿用公共目录写入', async () => {
  const writes = [], repository = new AccessoryRepository({ columnExists: async () => true })
  repository.executePrepared = async (sql, values) => { writes.push({ sql, values }); return [{ affectedRows: 1, insertId: 8 }] }
  const service = new AccessoryService({ repository })
  for (const kind of ['category', 'unit']) for (const flag of [0, 1, true, false, 'true', null]) {
    await assert.rejects(service.saveProductCatalogItem(kind, 1, { name: '膜', film_enabled: flag }), code('VALIDATION_ERROR'))
  }
  assert.deepEqual(writes, [])
  await service.saveProductCatalogItem('category', 1, { name: '钢化膜' })
  assert.doesNotMatch(writes[0].sql, /film_enabled/)
})

test('试算后手机客户关联变化仍重新校验，贴膜忽略客户端未来日期', async () => {
  const f = fixture()
  await f.checkout.quote(body(), actor)
  f.filmRepository.device = async () => null
  await assert.rejects(f.checkout.checkout(body(), actor), code('FILM_DEVICE_REQUIRED'))
  assert.equal(f.state.stock, 20); assert.deepEqual(f.state.films, [])
  const future = fixture()
  await future.checkout.checkout(body({ sale_time: '2026-11-15 10:00:00' }), actor)
  assert.equal(future.state.films[0].business_time, now)
  assert.equal(future.state.stock, 18)
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

test('旧环境目录只读兼容，类型明确拒绝旧贴膜标记；模板显式设置缺迁移时返回409', async () => {
  const calls = [], repo = new AccessoryRepository({ columnExists: async () => false })
  repo.queryRows = async sql => { calls.push(sql); return [] }
  assert.equal((await repo.getProductCatalog()).film_ready, false)
  assert.doesNotMatch(calls[0], /film_enabled/)
  repo.executePrepared = async (sql, values) => { calls.push({ sql, values }); return [{ insertId: 8, affectedRows: 1 }] }
  await assert.rejects(repo.saveCatalogItem('category', null, { name: '膜', film_enabled: false }), code('VALIDATION_ERROR'))
  await assert.rejects(repo.lockFilmConfiguration({}, { free_film: 1 }), code('FILM_SERVICE_NOT_READY'))
  await assert.rejects(repo.createAccessory({ name: '膜', free_film: 1 }), code('FILM_SERVICE_NOT_READY'))
  assert.equal(await repo.lockFilmConfiguration({}, {}), false)
  await repo.saveCatalogItem('category', 1, { name: '膜', status: 1, sort_order: 0, description: null })
  assert.doesNotMatch(calls[2].sql, /film_enabled/)
})

test('免费成交后模板停用或库存变化，原请求只重放原回执，不重新选择耗材', async () => {
  const f = fixture(), result = await f.checkout.checkout(body(), actor)
  f.filmRepository.matchingTemplates = async () => { assert.fail('已完成请求不应重新匹配') }
  f.filmRepository.device = async () => { assert.fail('已完成请求不重算当前手机档案') }
  assert.deepEqual(await f.checkout.checkout(body(), actor), result)
  assert.equal(f.state.films.length, 1); assert.equal(f.state.stock, 18)
})

test('贴膜赠送不累计积分提成，普通收费出库仍必须有销售权限', async () => {
  const f = fixture({ denied: ['accessories:sell'] })
  const gift = body({ film_service: { customer_id: 9, phone_id: 11, mode: 'paid' },
    accessories: [{ key: 'gift', accessory_id: 5, quantity: 1, unit_price: 0, sale_type: 'gift' }] })
  const result = await f.checkout.checkout(gift, actor)
  assert.equal(result.paid_amount, 0); assert.equal(result.points_earned, 0)
  assert.equal(f.state.stock, 19); assert.equal(f.state.items[0].snapshot.commission.reason, 'gift')
  await assert.rejects(f.checkout.checkout({ ...gift, film_service: undefined, request_key: 'c'.repeat(32),
    accessories: [{ key: 'paid', accessory_id: 5, quantity: 1, unit_price: 20, sale_type: 'sale' }],
    payment_info: { payment_method: 'cash', payment_amount: 20 } }, actor), code('PERMISSION_DENIED'))
})

test('贴膜DTO严格校验本次手机、方式及整数耗量，拒绝旧客户端及伪造服务快照', () => {
  const { films } = fixture()
  const base = { customer_id: 9, phone_id: 11, mode: 'free', quantity: 1 }
  for (const value of [null, [], { customer_id: 9 }, { ...base, phone_id: true }, { ...base, mode: 'gift' },
    ...[0, -1, 1.5, 1001, true, []].map(quantity => ({ ...base, quantity })),
    { ...base, template_id: 1 }, { ...base, model_id: 13 }, { ...base, eligible_for_free: true }, { ...base, mode: 'paid' }]) {
    assert.throws(() => films.normalize(value), code('FILM_SERVICE_INVALID'))
  }
  assert.deepEqual(films.normalize(base), base)
  assert.deepEqual(films.normalize({ customer_id: 9, phone_id: 11, mode: 'paid' }), { customer_id: 9, phone_id: 11, mode: 'paid' })
})

test('手机型号或客户姓名隐藏时当前设备贴膜查询与提交拒绝，手机号隐藏仍可用客户关联', async () => {
  const response = () => ({ status(value) { this.statusCode = value; return this }, json(value) { this.body = value; return this } })
  for (const field of ['basic_info.model', 'customer_info.customer_name']) {
    const queryAccess = { async getPermissions() { return { hiddenFields: [field] } } }
    const context = new FilmController({ queryAccess,
      access: { async getPermissions() { return { hiddenFields: [] } } },
      service: { async context() { assert.fail('不能读取隐藏关联') } } })
    const read = response()
    await context.context({ user: actor, params: { customerId: 9 }, query: { phone_id: 11 } }, read)
    assert.equal(read.statusCode, 403)
    const checkout = new CheckoutController({ queryAccess, service: { async checkout() { assert.fail('不能写入隐藏关联') } } })
    const write = response()
    await checkout.checkout({ user: actor, body: body() }, write)
    assert.equal(write.statusCode, 403); assert.equal(write.body.code, 'FIELD_PERMISSION_DENIED')
  }
  let reads = 0, writes = 0
  const queryAccess = { async getPermissions() { return { hiddenFields: ['customer_info.customer_phone'] } } }
  const context = new FilmController({ queryAccess,
    access: { async getPermissions() { return { hiddenFields: [] } }, maskPayload: value => value },
    service: { async context() { reads++; return { data: [] } } } })
  const read = response()
  await context.context({ user: actor, params: { customerId: 9 }, query: { phone_id: 11 } }, read)
  assert.equal(read.statusCode, undefined); assert.equal(reads, 1)
  const checkout = new CheckoutController({ queryAccess, filmAccess: { async getPermissions() { return { hiddenFields: [] } } }, service: { async checkout() { writes++; return {} } } })
  const write = response()
  await checkout.checkout({ user: actor, body: body({ customer_info: { name: '服务客户', phone: '' } }) }, write)
  assert.equal(write.statusCode, undefined); assert.equal(writes, 1)
})


test('仅有贴膜授权可办理免费且不可冒用其他办理人', async () => {
  const f = fixture({ denied: ['accessories:view', 'accessories:sell', 'accessories:gift'] })
  const result = await f.checkout.checkout(body(), actor)
  assert.equal(result.film_service_id, 1)
  await assert.rejects(f.checkout.checkout(body({ operator_id: 8, request_key: 'e'.repeat(32) }), actor), code('PERMISSION_DENIED'))
  assert.equal(f.state.stock, 18)
})

test('贴膜候选由真实设备确定型号，拒绝伪造筛选并不返回采购成本', async () => {
  const f = fixture(), calls = []
  f.films.products = { async getSaleOptions(user, query, fields, cost) {
    calls.push({ user, query, fields, cost })
    return { data: [{ id: 5, name: '膜', quantity: 10, purchase_cost: 99, internal: true }], pagination: { total: 1 } }
  } }
  const query = { phone_id: 11, store_id: 2, search: '', page: 1, page_size: 20, free_only: true }
  const result = await f.films.productOptions(actor, 9, query, ['name'])
  assert.deepEqual(result.data, [{ id: 5, name: '膜', quantity: 10 }])
  assert.equal(calls[0].query.film_model_id, 13)
  assert.equal(calls[0].query.film_only, true)
  assert.equal(calls[0].cost, false)
  await assert.rejects(f.films.productOptions(actor, 9, { ...query, film_model_id: 99 }), code('FILM_SERVICE_INVALID'))
  f.films.repository.device = async () => null
  await assert.rejects(f.films.productOptions(actor, 10, query), code('FILM_DEVICE_REQUIRED'))
  assert.equal(calls.length, 1)
})


test('贴膜专用提交和试算不接受普通结算载荷，不能借贴膜路由取得普通出库', async () => {
  let calls = 0
  const controller = new CheckoutController({ service: { async checkout() { calls++ }, async quote() { calls++ } } })
  for (const method of ['filmQuote', 'filmCheckout']) {
    const res = { status(value) { this.statusCode = value; return this }, json(value) { this.body = value; return this } }
    await controller[method]({ user: actor, body: { phones: [], accessories: [{ accessory_id: 5 }] } }, res)
    assert.equal(res.statusCode, 400)
    assert.equal(res.body.code, 'FILM_SERVICE_INVALID')
  }
  assert.equal(calls, 0)
})

test('贴膜候选遵守字段权限且权限读取失败时不调用业务服务', async () => {
  let calls = 0
  const controller = new FilmController({ service: { async productOptions() { calls++; return {} } },
    access: { async getPermissions() { return { hiddenFields: ['customer_info.customer_phone'] } }, maskPayload: value => value },
    queryAccess: { async getPermissions() { return { hiddenFields: [] } } }, logger: { error() {} } })
  const response = () => ({ status(value) { this.statusCode = value; return this }, json(value) { this.body = value; return this } })
  const req = { user: actor, params: { customerId: 9 }, query: { phone_id: 11, store_id: 2 } }
  const denied = response()
  await controller.products(req, denied)
  assert.equal(denied.statusCode, undefined); assert.equal(calls, 1)
  controller.access.getPermissions = async () => { throw new Error('unavailable') }
  const failed = response()
  await controller.products(req, failed)
  assert.equal(failed.statusCode, 500)
  assert.equal(calls, 1)
})
