'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const masking = require('../src/services/data-masking.service')
const log = require('../src/utils/log')
const Query = require('../src/controllers/query-goods.controller')
const Checkout = require('../src/controllers/sales-checkout.controller')
const Aftersale = require('../src/controllers/sales-aftersale.controller')
const Purchase = require('../src/controllers/accessory-purchase.controller')
const Accessory = require('../src/controllers/accessory.controller')
const Film = require('../src/controllers/film-service.controller')
const router = require('../src/routes/accessories')

const logger = { error() {}, warn() {} }
const response = () => ({ statusCode: 200, status(code) { this.statusCode = code; return this }, json(body) { this.body = body; return this } })
const request = () => ({ user: { id: 7 }, params: { id: '1', orderId: '1', itemId: '2', saleId: '3' }, query: {}, body: {
  store_id: 1, customer_info: { name: '客户', phone: '13800000000' },
  phones: [{ phone_id: 4, sale_price: 100 }], accessories: [{ accessory_id: 5, quantity: 1, unit_price: 10 }]
} })

/** 使用真实字段读取和解析；数据库替身不会租借云端连接。 */
function fieldSource({ fail, configs = [{ hidden_fields: [] }], roles = [1, 2] } = {}) {
  const reads = []
  const source = new masking.constructor({ logger, database() {
    if (fail === 'pool') throw new Error('internal-field-pool-failure')
    return { async execute(sql, params) {
      reads.push({ sql, params })
      if (fail === 'roles' || fail === 'config' && sql.includes('FROM role_field_permissions')) throw new Error('internal-field-read-failure')
      if (sql.includes('FROM user_roles')) return [roles.map(role_id => ({ role_id }))]
      assert.match(sql, /FROM role_field_permissions/)
      return [configs.map((field_config, i) => ({ role_id: roles[i], field_config }))]
    } }
  } })
  return { source, reads }
}

function useSource(t, options) {
  const fixture = fieldSource(options)
  t.mock.method(masking, 'getUserFieldPermissions', (...args) => fixture.source.getUserFieldPermissions(...args))
  t.mock.method(log, 'error', () => {})
  return fixture
}

function expectFailed(res) {
  assert.equal(res.statusCode, 500)
  assert.equal(res.body.success, false)
  assert.equal(res.body.data, undefined)
  assert.doesNotMatch(JSON.stringify(res.body), /internal-field|hidden_fields|role_field_permissions/)
}

for (const fail of ['pool', 'roles', 'config']) {
  test(`严格字段读取在${fail}故障时抛出，普通读取保留原兼容边界`, async () => {
    const f = fieldSource({ fail })
    await assert.rejects(f.source.getUserFieldPermissions(7, 'accessories_accessoriesview', { strict: true }), /internal-field/)
    if (fail === 'pool') await assert.rejects(f.source.getUserFieldPermissions(7, 'accessories_accessoriesview'), /internal-field/)
    else assert.deepEqual(await f.source.getUserFieldPermissions(7, 'accessories_accessoriesview'), { hiddenFields: [], readonlyFields: [] })
  })
}

test('严格读取拒绝损坏JSON、非对象配置和损坏字段列表，不跳过某个角色后放行', async () => {
  for (const invalid of ['{broken', '', null, 'null', '[]', 'false', '1', [], 1,
    { hidden_fields: 'cost' }, { hidden_fields: null }, { hidden_fields: [1] },
    { hidden_fields: [''] }, { hidden_fields: [' cost '] }, { editable_fields: {} }, { hiddenFields: ['cost'] }]) {
    const f = fieldSource({ configs: [{ hidden_fields: ['price_info.purchase_cost'] }, invalid] })
    await assert.rejects(f.source.getUserFieldPermissions(7, 'accessories_accessoriesview', { strict: true }))
  }
})

test('严格读取合并有效角色配置，显式空配置或没有配置不等于读取故障', async () => {
  const f = fieldSource({ configs: [JSON.stringify({ hidden_fields: ['price_info.purchase_cost'] }),
    { hidden_fields: ['price_info.purchase_cost', 'customer_info.customer_phone'], editable_fields: [] }] })
  assert.deepEqual(await f.source.getUserFieldPermissions(7, 'accessories_accessoriesview', { strict: true }), {
    hiddenFields: ['price_info.purchase_cost', 'customer_info.customer_phone'], readonlyFields: []
  })
  assert.deepEqual(f.reads[0].params, [7])
  assert.deepEqual(f.reads[1].params, [1, 2, 'accessories_accessoriesview'])
  for (const options of [{ configs: [{}] }, { configs: [] }, { roles: [] }]) {
    assert.deepEqual(await fieldSource(options).source.getUserFieldPermissions(7, 'accessories_accessoriesview', { strict: true }), {
      hiddenFields: [], readonlyFields: []
    })
  }
})

test('严格解析故障不把损坏配置正文写入日志或抛给HTTP层', async () => {
  const f = fieldSource({ configs: ['{private-config-body'] }), logs = []
  f.source.logger = { error(...args) { logs.push(args) }, warn(...args) { logs.push(args) } }
  await assert.rejects(f.source.getUserFieldPermissions(7, 'accessories_accessoriesview', { strict: true }), {
    message: '字段权限配置无效'
  })
  assert.equal(logs.length, 1)
  assert.doesNotMatch(logs.flat().map(value => value instanceof Error ? value.stack : JSON.stringify(value)).join('\n'), /private-config-body/)
})

for (const mode of ['list', 'detail', 'phoneReceipt', 'aftersales']) {
  test(`商品查询${mode}字段读取故障不读取原单或返回明细`, async t => {
    useSource(t, { fail: 'config' })
    let calls = 0
    const controller = new Query({ service: { async [mode]() { calls++; return { purchase_cost: 100 } } }, logger })
    const res = response()
    await controller[mode](request(), res)
    expectFailed(res)
    assert.equal(calls, 0)
  })
}

for (const mode of ['checkout', 'quote']) {
  for (const deniedModule of ['sales_salesview', 'accessories_accessoriesview']) {
    test(`共同结算${mode}的${deniedModule}字段故障在试算及写入前拒绝`, async t => {
      const failed = fieldSource({ fail: 'config' }), healthy = fieldSource()
      t.mock.method(masking, 'getUserFieldPermissions', (id, module, options) =>
        (module === deniedModule ? failed : healthy).source.getUserFieldPermissions(id, module, options))
      let calls = 0
      const controller = new Checkout({ service: { async [mode]() { calls++; return { order_id: 1 } } }, logger })
      const res = response()
      await controller[mode](request(), res)
      expectFailed(res)
      assert.equal(calls, 0)
    })
  }
}

for (const mode of ['goodsReturnContext', 'quoteGoodsReturn', 'submitGoodsReturn',
  'goodsExchangeContext', 'quoteGoodsExchange', 'submitGoodsExchange', 'quotePhoneReturn', 'submitPhoneReturn']) {
  test(`${mode}遇到损坏字段配置不试算、不返库、不收退款`, async t => {
    useSource(t, { configs: ['{broken'] })
    const unexpected = async () => assert.fail('不得调用售后业务')
    const service = { context: unexpected, quote: unexpected, submit: unexpected }
    const controller = new Aftersale({ goodsReturns: service, goodsExchanges: service, phoneReturns: service, logger })
    const res = response()
    await controller[mode](request(), res)
    expectFailed(res)
  })
}

test('手机售后可读不代表关联商品可读，商品字段故障仍不执行联合退货', async t => {
  const failed = fieldSource({ fail: 'roles' }), healthy = fieldSource()
  t.mock.method(masking, 'getUserFieldPermissions', (id, module, options) =>
    (module === 'accessories_accessoriesview' ? failed : healthy).source.getUserFieldPermissions(id, module, options))
  const controller = new Aftersale({ phoneReturns: { async submit() { assert.fail('不可执行联合售后') } }, logger })
  const res = response()
  await controller.submitPhoneReturn(request(), res)
  expectFailed(res)
})

test('退货核对已读取原单后关联商品字段故障，整份响应不得携带原单数据', async t => {
  const failed = fieldSource({ fail: 'config' }), healthy = fieldSource()
  t.mock.method(masking, 'getUserFieldPermissions', (id, module, options) =>
    (module === 'accessories_accessoriesview' ? failed : healthy).source.getUserFieldPermissions(id, module, options))
  const controller = new Aftersale({ service: { async returnChecklist() {
    return { mode: 'checkout', phone: { total_amount: 100 }, accessories: [{ name: '内部原单', total_amount: 10 }] }
  } }, logger })
  const res = response()
  await controller.returnChecklist(request(), res)
  expectFailed(res)
  assert.doesNotMatch(JSON.stringify(res.body), /内部原单|total_amount/)
})

for (const mode of ['list', 'history', 'pay', 'cancel']) {
  test(`商品采购${mode}字段故障不读取采购或登记付款`, async t => {
    useSource(t, { fail: 'config' })
    const unexpected = async () => assert.fail('不可调用采购业务')
    const controller = new Purchase({ service: { list: unexpected, history: unexpected, record: unexpected } })
    const res = response()
    await controller[mode](request(), res)
    expectFailed(res)
  })
}

for (const mode of ['list', 'saleOptions', 'entryOptions']) {
  test(`配件${mode}字段故障不读取候选或库存`, async t => {
    useSource(t, { fail: 'config' })
    const unexpected = async () => assert.fail('不可调用配件业务')
    const controller = new Accessory({ service: { getAccessories: unexpected, getSaleOptions: unexpected, getEntryOptions: unexpected }, logger })
    const res = response()
    await controller[mode](request(), res)
    expectFailed(res)
  })
}

test('配件受保护路由字段故障交给统一错误中间件，阻止采购、调拨和资料写入', async t => {
  useSource(t, { fail: 'config' })
  for (const [method, path] of [['post', '/stock-in'], ['post', '/transfer'], ['post', '/'], ['put', '/:id'],
    ['get', '/serials/:serialNumber'], ['get', '/barcode/:barcode'],
    ['get', '/settings'], ['put', '/settings'], ['get', '/stock-in/records'], ['get', '/stock/list']]) {
    const route = router.stack.find(layer => layer.route?.path === path && layer.route.methods[method]).route
    const handler = route.stack[2].handle
    let failure
    const res = response()
    await handler(request(), res, error => { failure = error })
    assert.match(failure?.message || '', /internal-field/)
    assert.equal(res.body, undefined)
  }
})

test('配件写入及回执沿用本请求已验证字段配置，不在提交后再次读取权限', async t => {
  const fields = fieldSource({ configs: [{ hidden_fields: ['price_info.total_amount'] }] })
  let permissionReads = 0
  t.mock.method(masking, 'getUserFieldPermissions', (...args) => {
    assert.equal(++permissionReads, 1, '同一请求不能在提交后重新读取字段权限')
    return fields.source.getUserFieldPermissions(...args)
  })
  const controller = new Accessory({ service: { async stockIn() {
    return { success: true, data: { stock_in_id: 5, total_amount: 30 }, message: '入库成功' }
  } }, logger })
  const req = request(), res = response()
  const route = router.stack.find(layer => layer.route?.path === '/stock-in').route
  let allowed = false
  await route.stack[2].handle(req, res, error => { assert.ifError(error); allowed = true })
  assert.equal(allowed, true)
  await controller.stockIn(req, res)
  assert.equal(permissionReads, 1)
  assert.equal(res.body.success, true)
  assert.equal(res.body.data.stock_in_id, 5)
  assert.equal(res.body.data.total_amount, null)
})

test('贴膜服务已使用严格字段读取，损坏配置同样禁止读取客户历史', async t => {
  useSource(t, { configs: [{ hidden_fields: 'customer_info.customer_phone' }] })
  const controller = new Film({ service: { async context() { assert.fail('不可读取贴膜历史') } }, logger })
  const res = response()
  await controller.context(request(), res)
  expectFailed(res)
})
