'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const Service = require('../src/services/sales-aftersale.service')
const Controller = require('../src/controllers/sales-aftersale.controller')
const Repository = require('../src/repositories/sales-checkout.repository')
const { createGoodsCommission } = require('../src/utils/goods-commission')

const actor = { id: 7, store_ids: [1] }
const gift = (agreement = 20) => ({ item_id: 31, accessory_id: 50, accessory_sale_id: 61, quantity: 2,
  unit_price: '0.00', total_amount: '0.00', points_awarded: 0,
  snapshot: { name: '原单充电器', sale_type: 'gift', gift_return_unit_price: agreement, serial_numbers: ['SN001', 'SN002'],
    purchase_cost: 100, supplier_name: '内部资料不可返回' } })
const header = { order_id: 1, order_no: 'SO-ORIGINAL', store_id: 1, phone_item_id: 11, sale_id: 21,
  phone_id: 41, phone_quantity: 1, phone_amount: '1000.00', phone_points: 10 }
const sale = { item_id: 32, accessory_id: 51, accessory_sale_id: 62, quantity: 1,
  unit_price: '50.50', total_amount: '50.50', points_awarded: 0,
  snapshot: JSON.stringify({ name: '原单钢化膜', sale_type: 'sale', serial_numbers: [], gift_return_unit_price: null }) }

function fixture({ denied = [], rows = [{ ...header, ...gift() }, { ...header, ...sale }] } = {}) {
  const calls = []
  const permissions = []
  const repository = {
    async returnChecklist(orderId, saleId, scope) {
      calls.push({ orderId, saleId, scope })
      return orderId === 1 && saleId === 21 && (scope.allStores || scope.storeIds.includes(1)) ? structuredClone(rows.map(row => ({ return_history: [], ...row }))) : []
    },
    async phoneReturnSource(phoneId, scope) {
      return phoneId === 41 && scope.storeIds.includes(1) ? { phone_id: 41, sale_id: 21, order_id: 1, checkout_sale_id: 21 } : null
    }
  }
  return { service: new Service({ repository, permissionCheck: async (user, permission) => {
    assert.equal(user.id, 7); permissions.push(permission); return !denied.includes(permission)
  } }), calls, permissions }
}
const response = () => ({ status(code) { this.code = code; return this }, json(body) { this.body = body; return this } })

test('按原手机销售ID核对同单搭售/赠品，保留原单名称、SN、原价和原积分，不返回内部快照', async () => {
  const f = fixture(), result = await f.service.returnChecklist('1', '21', actor)
  assert.deepEqual(f.calls, [{ orderId: 1, saleId: 21, scope: { allStores: false, requestedStoreId: null, storeIds: [1] } }])
  assert.deepEqual(result.phone, { item_id: 11, sale_id: 21, phone_id: 41, total_amount: 1000, points_awarded: 10 })
  assert.equal(result.accessories.length, 2)
  assert.equal(result.accessories[0].name, '原单充电器')
  assert.equal(result.accessories[0].gift_return_unit_price, 20)
  assert.equal(result.accessories[0].gift_return_total, 40)
  assert.equal(result.accessories[0].gift_agreement_state, 'recorded')
  assert.deepEqual(result.accessories[0].serial_numbers, ['SN001', 'SN002'])
  assert.equal(result.accessories[1].total_amount, 50.5)
  assert.equal(result.accessories[1].gift_agreement_state, null)
  assert.equal(result.accessories[1].gift_return_total, null)
  for (const key of ['purchase_cost', 'supplier_name', 'snapshot', 'customer_phone', 'customer_name']) {
    assert.equal(JSON.stringify(result).includes(key), false)
  }
})

test('原商品提成按真实成本及销售员核验，内部工资/成本不进入手机退货公开清单', async () => {
  const row = { ...header, ...sale, purchase_cost: 20.25, sale_operator_id: 8, snapshot: JSON.parse(sale.snapshot) }
  row.snapshot.commission = createGoodsCommission({ employeeId: 8, salaryTemplateId: 4, quantity: 1,
    saleType: 'sale', paidCents: 5050, purchaseCostCents: 2025,
    rule: { enabled: true, type: 'fixed', fixed_amount: 2.5, percentage: 0 } })
  const result = await fixture({ rows: [row] }).service.returnChecklist(1, 21, actor)
  assert.equal(result.accessories[0].total_amount, 50.5)
  for (const field of ['commission', 'purchase_cost', 'salary_template_id', 'sale_operator_id', 'earned_cents']) {
    assert.equal(JSON.stringify(result).includes(field), false)
  }
  row.snapshot.commission.earned_cents++
  await assert.rejects(fixture({ rows: [row] }).service.returnChecklist(1, 21, actor), { code: 'GOODS_COMMISSION_CONFLICT' })
})

test('历史缺少约定金额保持未知；明确约定0元合法，不按商品现价或成本补算', async () => {
  for (const agreement of [undefined, null, 0, '0.00', '20.25']) {
    const row = { ...header, ...gift(agreement) }
    if (agreement === undefined) delete row.snapshot.gift_return_unit_price
    const result = await fixture({ rows: [row] }).service.returnChecklist(1, 21, actor)
    const expected = agreement === undefined || agreement === null ? null : Number(agreement)
    assert.equal(result.accessories[0].gift_return_unit_price, expected)
    assert.equal(result.accessories[0].gift_return_total, expected === null ? null : expected * 2)
    assert.equal(result.accessories[0].gift_agreement_state, expected === null ? 'not_recorded' : 'recorded')
  }
})

test('无手机核对权限在读取前拒绝，关联商品查看权限逐域校验；无搭售的手机单不要求商品查看权限', async () => {
  for (const permission of ['query:view', 'query:return-to-stock']) {
    const f = fixture({ denied: [permission] })
    await assert.rejects(f.service.returnChecklist(1, 21, actor), { statusCode: 403, code: 'PERMISSION_DENIED' })
    assert.equal(f.calls.length, 0)
  }
  const denied = fixture({ denied: ['accessories:view'] })
  await assert.rejects(denied.service.returnChecklist(1, 21, actor), { statusCode: 403 })
  const phoneOnly = fixture({ denied: ['accessories:view'], rows: [{ ...header, item_id: null }] })
  assert.deepEqual((await phoneOnly.service.returnChecklist(1, 21, actor)).accessories, [])
  assert.equal(phoneOnly.permissions.includes('accessories:view'), false)
})

test('跨店、错单、错手机销售ID和不存在记录统一不返回原单，非法标识不进入仓储', async () => {
  for (const [orderId, saleId, user] of [[2, 21, actor], [1, 22, actor], [1, 21, { ...actor, store_ids: [2] }], [1, 21, { id: 7 }]]) {
    await assert.rejects(fixture().service.returnChecklist(orderId, saleId, user), { statusCode: 404, code: 'NOT_FOUND' })
  }
  for (const id of [0, -1, '1 OR 1=1', '1.1', true, {}, 2147483648]) {
    const f = fixture()
    await assert.rejects(f.service.returnChecklist(id, 21, actor), { statusCode: 400 })
    assert.equal(f.calls.length, 0)
  }
  await assert.rejects(fixture().service.returnChecklist(1, 21, {}), { statusCode: 401 })
})

test('损坏或不一致的原单拒绝核对，不允许用当前商品、售价或无效积分补齐', async () => {
  const edits = [
    row => { row.snapshot = '{' }, row => { row.snapshot = [] },
    row => { row.quantity = 3 }, row => { row.quantity = 0 }, row => { row.unit_price = '0.01' },
    row => { row.snapshot.serial_numbers = ['SN001', 'SN001'] }, row => { row.snapshot.serial_numbers = [''] },
    row => { row.snapshot.serial_numbers = 'SN001' }, row => { row.snapshot.sale_type = 'unknown' },
    row => { row.snapshot.gift_return_unit_price = -1 }, row => { row.snapshot.gift_return_unit_price = '0.001' },
    row => { row.snapshot.gift_return_unit_price = 99999999.99 }, row => { row.points_awarded = 1 },
    row => { row.phone_quantity = 2 }, row => { row.phone_amount = 'NaN' }, row => { row.phone_points = null }
  ]
  for (const edit of edits) {
    const row = { ...header, ...gift() }; edit(row)
    await assert.rejects(fixture({ rows: [row] }).service.returnChecklist(1, 21, actor), { statusCode: 409, code: 'CHECKOUT_FACTS_CONFLICT' })
  }
  const ordinary = { ...header, ...sale, snapshot: { name: '商品', sale_type: 'sale', serial_numbers: [], gift_return_unit_price: 10 } }
  await assert.rejects(fixture({ rows: [ordinary] }).service.returnChecklist(1, 21, actor), { statusCode: 409 })
})

test('仓储使用单台真实销售关联及授权门店，保留替换订单候选供服务核验，只读且不查当前商品', async () => {
  const calls = [], connection = { async execute(sql, params) { calls.push({ sql, params }); return [[]] } }
  const repository = new Repository()
  repository.withConnection = operation => operation(connection)
  await repository.returnChecklist(1, 21, { allStores: false, storeIds: [2, 3] })
  const { sql, params } = calls[0]
  assert.deepEqual(params, [21, 1, 2, 3])
  assert.match(sql, /pi\.order_id = o\.id/)
  assert.match(sql, /i\.linked_phone_sale_id = pi\.sale_id/)
  assert.match(sql, /i\.order_id AS goods_order_id/)
  assert.doesNotMatch(sql, /\bi\.order_id = o\.id/)
  assert.match(sql, /o\.store_id IN \(\?, \?\)/)
  assert.match(sql, /p\.status = 'sold'/)
  assert.match(sql, /s\.sale_type = 'retail'/)
  assert.match(sql, /s\.id = \(SELECT CASE WHEN[\s\S]*current_sale\.status IS NULL[\s\S]*ORDER BY current_sale\.id DESC LIMIT 1/)
  assert.doesNotMatch(sql, /\b(UPDATE|INSERT|DELETE|FOR UPDATE)\b|JOIN accessories\b|customer_phone/)
  await repository.returnChecklist(1, 21, { allStores: false, storeIds: [] })
  assert.match(calls[1].sql, /1 = 0/)
})

test('真实公共字段脱敏同时隐藏价格衍生金额、积分、赠品约定状态、数量或SN，不回传原始快照', async () => {
  for (const [module, field, phoneKeys, goodsKeys] of [
    ['query_queryview', 'basic_info.sale_price', ['total_amount', 'points_awarded'], []],
    ['accessories_accessoriesview', 'price_info.unit_price', [], ['unit_price', 'total_amount', 'points_awarded', 'gift_return_unit_price', 'gift_return_total', 'gift_agreement_state']],
    ['accessories_accessoriesview', 'stock_info.total_quantity', [], ['quantity', 'total_amount', 'points_awarded', 'gift_return_total']],
    ['accessories_accessoriesview', 'basic_info.serial_number', [], ['serial_numbers']],
    ['accessories_accessoriesview', 'basic_info.name', [], ['name', 'accessory_id']]
  ]) {
    const masking = { async getUserFieldPermissions(id, key) { assert.equal(id, 7); return { hiddenFields: key === module ? [field] : [] } }, filterSensitiveFields: rows => rows }
    const controller = new Controller({ service: fixture().service, masking })
    const res = response()
    await controller.returnChecklist({ user: actor, params: { orderId: 1, saleId: 21 } }, res)
    assert.equal(res.body.success, true)
    for (const key of phoneKeys) assert.equal(res.body.data.phone[key], null)
    for (const row of res.body.data.accessories) for (const key of goodsKeys) assert.equal(row[key], null)
  }
})

test('隐藏门店不得通过共同单头反推商品位置，鉴权错误和内部错误返回统一结构', async () => {
  for (const [module, field] of [['query_queryview', 'store_info.store_name'], ['accessories_accessoriesview', 'stock_info.distribution']]) {
    const controller = new Controller({ service: fixture().service, masking: {
      async getUserFieldPermissions(id, key) { return { hiddenFields: key === module ? [field] : [] } }, filterSensitiveFields: rows => rows
    } })
    const res = response()
    await controller.returnChecklist({ user: actor, params: { orderId: 1, saleId: 21 } }, res)
    assert.equal(res.code, 403)
    assert.equal(res.body.code, 'FIELD_PERMISSION_DENIED')
    assert.equal(res.body.data, undefined)
  }
  for (const error of [Object.assign(new Error('拒绝访问'), { statusCode: 403, code: 'PERMISSION_DENIED' }), new Error('内部SQL不可返回')]) {
    const controller = new Controller({ service: { async returnChecklist() { throw error } }, phoneAccess: { async getPermissions() { return {} } }, logger: { error() {} } })
    const res = response()
    await controller.returnChecklist({ user: actor, params: {}, requestId: 'request-example' }, res)
    assert.equal(res.code, error.statusCode || 500)
    assert.equal(res.body.code, error.code || 'INTERNAL_ERROR')
    assert.equal(JSON.stringify(res.body).includes('内部SQL'), false)
  }
})

const redeemedRow = () => ({ ...header, ...sale, quantity: 3, unit_price: 150, total_amount: 449.99,
  snapshot: { name: '原单商品', sale_type: 'sale', serial_numbers: [], points_used: 1, deduction_cents: 1,
    gross_cents: 45000, points_per_yuan: 100, points_units: [
      { quantity: 1, points_used: 1, deduction_cents: 1, payable_cents: 14999, points_awarded: 0 },
      { quantity: 2, points_used: 0, deduction_cents: 0, payable_cents: 15000, points_awarded: 0 }
    ] } })

test('只读核对使用原单抵扣及分摊事实，含全额抵扣0现金商品，不按当前配置重算', async () => {
  const row = redeemedRow()
  const result = await fixture({ rows: [row] }).service.returnChecklist(1, 21, actor)
  assert.equal(result.accessories[0].gross_amount, 450)
  assert.equal(result.accessories[0].total_amount, 449.99)
  assert.equal(result.accessories[0].points_used, 1)
  assert.equal(result.accessories[0].deduction_amount, 0.01)
  row.quantity = 1; row.unit_price = 150; row.total_amount = 0
  Object.assign(row.snapshot, { points_used: 1500, deduction_cents: 15000, gross_cents: 15000, points_per_yuan: 10,
    points_units: [{ quantity: 1, points_used: 1500, deduction_cents: 15000, payable_cents: 0, points_awarded: 0 }] })
  const full = await fixture({ rows: [row] }).service.returnChecklist(1, 21, actor)
  assert.equal(full.accessories[0].sale_type, 'sale')
  assert.equal(full.accessories[0].total_amount, 0)
  assert.equal(full.accessories[0].deduction_amount, 150)
})

test('原抵扣或逐件分摊损坏时拒绝，不能当作0抵扣或按原单价乘数量猜测', async () => {
  for (const edit of [row => { row.snapshot.points_used = null }, row => { row.snapshot.points_used = '1' },
    row => { row.snapshot.deduction_cents = 2 }, row => { row.snapshot.gross_cents = 1 },
    row => { row.snapshot.points_per_yuan = 200 }, row => { row.points_awarded = 1 },
    row => { delete row.snapshot.points_units }, row => { row.snapshot.points_units = [] },
    row => { row.snapshot.points_units[1].points_awarded = 1 }, row => { row.snapshot.points_units[0].quantity = 2 },
    row => { row.snapshot.points_units[1].deduction_cents = 1 }, row => { row.snapshot.points_units[0].points_used = 2 },
    row => { row.snapshot.points_units[0].payable_cents = 15000 }, row => { row.snapshot.points_units = [null] }]) {
    const row = redeemedRow(); edit(row)
    await assert.rejects(fixture({ rows: [row] }).service.returnChecklist(1, 21, actor), { code: 'CHECKOUT_FACTS_CONFLICT' })
  }
})

test('抵扣积分、抵扣金额与原价服从数量和价格字段脱敏，不从衍生字段绕过', async () => {
  for (const field of ['stock_info.total_quantity', 'price_info.unit_price', 'price_info.total_price']) {
    const controller = new Controller({ service: fixture({ rows: [redeemedRow()] }).service,
      masking: { async getUserFieldPermissions(id, key) { return { hiddenFields: key === 'accessories_accessoriesview' ? [field] : [] } }, filterSensitiveFields: rows => rows } })
    const res = response()
    await controller.returnChecklist({ user: actor, params: { orderId: 1, saleId: 21 } }, res)
    for (const key of ['points_used', 'deduction_amount', 'gross_amount', 'total_amount']) assert.equal(res.body.data.accessories[0][key], null)
  }
})

test('手机核对扣除已独立退回商品，SN与剩余赠品约定金额只按原件计算', async () => {
  const row = { ...header, ...gift(), return_history: [
    { quantity: 1, fact_snapshot: { unit_ranges: [[1, 2]], serial_numbers: ['SN002'] } }
  ] }
  let item = (await fixture({ rows: [row] }).service.returnChecklist(1, 21, actor)).accessories[0]
  assert.equal(item.quantity, 2); assert.equal(item.returned_quantity, 1); assert.equal(item.remaining_quantity, 1)
  assert.equal(item.gift_return_total, 40); assert.equal(item.remaining_gift_return_total, 20)
  assert.deepEqual(item.available_serial_numbers, ['SN001'])
  row.return_history.push({ quantity: 1, fact_snapshot: { unit_ranges: [[0, 1]], serial_numbers: ['SN001'] } })
  delete row.snapshot.gift_return_unit_price
  item = (await fixture({ rows: [row] }).service.returnChecklist(1, 21, actor)).accessories[0]
  assert.equal(item.remaining_quantity, 0); assert.equal(item.remaining_gift_return_total, 0)
  assert.equal(item.gift_return_total, null); assert.deepEqual(item.available_serial_numbers, [])
  const ordinary = { ...header, ...sale, quantity: 2, total_amount: 101,
    return_history: [{ quantity: 1, fact_snapshot: { unit_ranges: [[0, 1]], serial_numbers: [] } }] }
  item = (await fixture({ rows: [ordinary] }).service.returnChecklist(1, 21, actor)).accessories[0]
  assert.equal(item.remaining_quantity, 1); assert.equal(item.remaining_gift_return_total, null)
})

test('已退历史缺失、超退、重复区间或SN错配拒绝核对，不能冒充尚未退回', async () => {
  for (const history of [null, [{ quantity: 1, fact_snapshot: '{bad' }],
    [{ quantity: 1, fact_snapshot: { unit_ranges: [[1, 2]], serial_numbers: ['SN001'] } }],
    [{ quantity: 2, fact_snapshot: { unit_ranges: [[0, 2]], serial_numbers: ['SN001', 'SN001'] } }],
    Array.from({ length: 2 }, () => ({ quantity: 1, fact_snapshot: { unit_ranges: [[0, 1]], serial_numbers: ['SN001'] } }))]) {
    await assert.rejects(fixture({ rows: [{ ...header, ...gift(), return_history: history }] }).service.returnChecklist(1, 21, actor), { statusCode: 409 })
  }
})

test('按手机入口区分旧单及共同单，错位原单、无权限与缺结构均不降级为旧退库', async () => {
  const f = fixture()
  const common = await f.service.phoneReturnChecklist(41, actor)
  assert.equal(common.mode, 'checkout'); assert.equal(common.phone.sale_id, 21)
  f.service.repository.phoneReturnSource = async () => ({ phone_id: 41, sale_id: 21, order_id: null })
  assert.deepEqual(await f.service.phoneReturnChecklist(41, actor), { mode: 'standalone', phone_id: 41, sale_id: 21 })
  f.service.repository.phoneReturnSource = async () => ({ phone_id: 41, sale_id: 22, order_id: 1, checkout_sale_id: 21 })
  await assert.rejects(f.service.phoneReturnChecklist(41, actor), { code: 'CHECKOUT_FACTS_CONFLICT' })
  await assert.rejects(fixture().service.phoneReturnChecklist(41, { id: 7, store_ids: [2] }), { statusCode: 404 })
  await assert.rejects(fixture({ denied: ['query:return-to-stock'] }).service.phoneReturnChecklist(41, actor), { statusCode: 403 })
  for (const code of ['ER_NO_SUCH_TABLE', 'ER_BAD_FIELD_ERROR']) {
    f.service.repository.phoneReturnSource = async () => { throw Object.assign(new Error('数据库内部信息'), { code }) }
    await assert.rejects(f.service.phoneReturnChecklist(41, actor), { code: 'CHECKOUT_RETURN_NOT_READY' })
    f.service.repository.returnChecklist = f.service.repository.phoneReturnSource
    await assert.rejects(f.service.returnChecklist(1, 21, actor), { code: 'CHECKOUT_RETURN_NOT_READY' })
  }
})

test('仓储一次读取同台所有商品售后，不按历史办理门店截断、不锁定或写入记录', async () => {
  const calls = [], repository = new Repository()
  repository.withConnection = operation => operation({ async execute(sql, params) {
    calls.push({ sql, params })
    return calls.length === 1 ? [[{ ...header, ...gift() }, { ...header, ...sale }]] : [[
      { original_item_id: 31, quantity: 1, fact_snapshot: { unit_ranges: [[0, 1]], serial_numbers: ['SN001'] } }
    ]]
  } })
  const rows = await repository.returnChecklist(1, 21, { allStores: false, storeIds: [1] })
  assert.equal(calls.length, 2); assert.deepEqual(calls[1].params, [31, 32])
  assert.doesNotMatch(calls[1].sql, /store_id|FOR UPDATE|INSERT|DELETE|UPDATE/)
  assert.equal(rows[0].return_history.length, 1); assert.deepEqual(rows[1].return_history, [])
})

test('手机定位限定当前销售和双方授权门店，保留历史共同单保护', async () => {
  let query
  const repository = new Repository()
  repository.withConnection = operation => operation({ async execute(sql, params) { query = { sql, params }; return [[]] } })
  assert.equal(await repository.phoneReturnSource(41, { allStores: false, storeIds: [1] }), null)
  assert.deepEqual(query.params, [41, 1, 1])
  assert.match(query.sql, /p\.store_id IN/); assert.match(query.sql, /s\.store_id IN/)
  assert.match(query.sql, /ORDER BY current_sale\.id DESC LIMIT 1/)
  assert.match(query.sql, /LEFT JOIN sales_order_items i ON i\.sale_id = s\.id/)
  assert.doesNotMatch(query.sql, /FOR UPDATE|INSERT|DELETE|UPDATE/)
})

test('新增已退、剩余、未退SN及剩余赠品金额沿用公共字段权限，手机入口同样脱敏', async () => {
  for (const [field, keys] of [
    ['basic_info.usage_type', ['sale_type', 'gift_return_unit_price', 'gift_return_total', 'remaining_gift_return_total', 'gift_agreement_state']],
    ['stock_info.total_quantity', ['quantity', 'returned_quantity', 'remaining_quantity', 'remaining_gift_return_total']],
    ['basic_info.serial_number', ['serial_numbers', 'available_serial_numbers']],
    ['price_info.unit_price', ['remaining_gift_return_total']], ['price_info.total_price', ['remaining_gift_return_total']]
  ]) {
    const controller = new Controller({ service: fixture().service, masking: {
      async getUserFieldPermissions(id, key) { return { hiddenFields: key === 'accessories_accessoriesview' ? [field] : [] } }, filterSensitiveFields: rows => rows
    } })
    const res = response()
    await controller.returnChecklist({ user: actor, params: { phoneId: 41 } }, res)
    assert.equal(res.body.success, true); assert.equal(res.body.data.mode, 'checkout')
    for (const item of res.body.data.accessories) for (const key of keys) assert.equal(item[key], null)
  }
})
