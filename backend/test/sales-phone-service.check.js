'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const SalesPhoneService = require('../src/services/sales-phone.service')
const paymentOptions = require('../src/config/payment-methods.json')
const InventoryService = require('../src/services/inventory.service')

function fixture({ failAt, cost = '80.00' } = {}) {
  const events = []
  const initial = () => ({ sales: [], payments: [], points: [], sold: [], customers: [] })
  let state = initial(), snapshot, failure = failAt
  const connection = {
    async beginTransaction() { events.push('begin'); snapshot = structuredClone(state) },
    async commit() { events.push('commit') },
    async rollback() { events.push('rollback'); state = snapshot },
    async execute() { assert.fail('服务不得直接执行SQL或关闭外键检查') }
  }
  const check = executor => assert.equal(executor, connection)
  const repository = {
    async withConnection(operation) {
      try { return await operation(connection) }
      finally { events.push('release') }
    },
    async findCustomerByPhone(executor) { check(executor); return { id: 9 } },
    async updateCustomer(executor, values) { check(executor); state.customers.push(values) },
    async findPhonesForSale(executor, ids) {
      check(executor)
      return ids.filter(id => [12, 13].includes(id)).map(id => ({ id, status: state.sold.includes(id) ? 'sold' : 'in_stock',
        purchase_cost: cost, is_new: id === 12 ? 1 : 0, is_preordered: 0, supplier_id: 4, remarks: 'existing' }))
    },
    async findDuplicateSales(executor) { check(executor); return [] },
    async createSale(executor, values) { check(executor); state.sales.push(values); return 20 + state.sales.length },
    async createPayment(executor, values) {
      check(executor)
      if (failure === 'payment' && state.payments.length === 1) throw new Error('payment-failed')
      state.payments.push(values); return 30 + state.payments.length
    },
    async markPhoneSold(executor, values) {
      check(executor)
      if (failure === 'stock' && state.sold.length === 1) return { affectedRows: 0 }
      assert.equal(values.remarks, state.sales.find(row => row.phoneId === values.phoneId).remarks)
      state.sold.push(values.phoneId); return { affectedRows: 1 }
    }
  }
  const service = new SalesPhoneService({
    repository, normalizeDate: value => value === 'invalid' ? null : value || '2026-11-13 12:00:00',
    prepareInvoiceTransaction: async executor => check(executor),
    generateInvoice: async (type, executor) => { check(executor); assert.equal(type, 'retail'); return `INV-${state.sales.length + 1}` },
    inspectColumn: async () => true, getPointsConfig: async executor => { check(executor); return {} },
    reconcilePoints: async values => {
      check(values.executor)
      if (failure === 'points' && state.points.length === 1) throw new Error('points-failed')
      state.points.push({ ...values, executor: undefined }); return { points: 2, eligibleAmount: values.salePrice }
    }
  })
  return { service, events, state: () => state, retry() { failure = null }, initial }
}

const request = {
  phone_id: 12, sale_price: 100, sale_time: '2026-11-13 12:00:00',
  customer_info: { name: '测试客户', phone: '13800138000' }, payment_info: { payment_method: 'cash' }
}
const batch = { ...request, phones: [{ phone_id: 12, sale_price: '100.10' }, { phone_id: '13', sale_price: '200.20' }] }
const sell = (f, body = request) => f.service.sell({ body, userId: 7 })

test('单台销售同事务提交真实销售ID收款与积分，全程保持外键检查', async () => {
  const f = fixture(), result = await sell(f)
  assert.equal(result.status, 200)
  assert.equal(result.body.data.sale_id, 21)
  assert.equal(result.body.data.payment_id, 31)
  assert.deepEqual(result.body.data.payment_ids, [31])
  assert.equal(result.body.data.points_earned, 2)
  assert.equal(f.state().payments[0].orderId, 21)
  assert.equal(f.state().customers[0].appleId, null)
  assert.deepEqual(f.events, ['begin', 'commit', 'release'])
})

test('批量逐台记零售及收款关联，分金额守恒，数字字符串ID可用且重复提交不再出库', async () => {
  const f = fixture(), result = await sell(f, batch)
  assert.equal(result.status, 200)
  assert.equal(result.body.data.total_amount, 300.3)
  assert.deepEqual(result.body.data.payment_ids, [31, 32])
  assert.deepEqual(f.state().payments.map(row => [row.orderId, row.amount]), [[21, 100.1], [22, 200.2]])
  assert.equal(f.state().payments.reduce((sum, row) => sum + Math.round(row.amount * 100), 0), 30030)
  assert.ok(f.state().sales.every(row => row.saleType === 'retail'))
  assert.deepEqual(f.state().points.map(row => [row.saleId, row.saleType, row.isNew]), [[21, 'retail', 1], [22, 'retail', 0]])
  const before = structuredClone(f.state())
  assert.equal((await sell(f, batch)).status, 400)
  assert.deepEqual(f.state(), before)
})

for (const failAt of ['payment', 'stock', 'points']) test(`批量第二条${failAt}失败时整单回滚，重试不留下重复单据`, async () => {
  const f = fixture({ failAt })
  if (failAt === 'stock') assert.equal((await sell(f, batch)).status, 400)
  else await assert.rejects(sell(f, batch), new RegExp(`${failAt}-failed`))
  assert.deepEqual(f.state(), f.initial())
  assert.deepEqual(f.events, ['begin', 'rollback', 'release'])
  f.retry()
  assert.equal((await sell(f, batch)).status, 200)
  assert.equal(f.state().payments.length, 2)
  assert.equal(f.state().points.length, 2)
})

test('缺失设备与重复数字/字符串ID均拒绝，不创建销售或收款', async () => {
  for (const phones of [[], [null], [{ phone_id: 0, sale_price: 1 }], [{ phone_id: 99, sale_price: 1 }],
    [{ phone_id: 12, sale_price: 1 }, { phone_id: '12', sale_price: 2 }]]) {
    const f = fixture(), result = await sell(f, { ...request, phones })
    assert.ok([400, 404].includes(result.status))
    assert.deepEqual(f.state(), f.initial())
  }
})

test('拒绝非法精度、负数、非数字、溢出及收款不符，均在连接前校验', async () => {
  for (const sale_price of [true, null, '', '10x', '1.001', 0, -1, '100000000', Infinity, NaN]) {
    const f = fixture()
    assert.equal((await sell(f, { ...request, sale_price })).status, 400)
    assert.deepEqual(f.events, [])
  }
  for (const patch of [
    { purchase_cost: -1 }, { purchase_cost: '3.141' }, { supplier_id: '4x' }, { operator_id: false },
    { payment_info: { payment_method: 'cash', payment_amount: 0 } },
    { payment_info: { payment_method: 'cash', payment_status: 'pending' } },
    { payment_info: { payment_method: 'cash', payment_time: 'invalid' } },
    { phones: [{ phone_id: 12, sale_price: 60000000 }, { phone_id: 13, sale_price: 60000000 }] }
  ]) {
    const f = fixture()
    assert.equal((await sell(f, { ...request, ...patch })).status, 400)
    assert.deepEqual(f.events, [])
  }
})

test('零售入口不能提交批发或划拨以绕过专项权限；现有batch与旧batch_item请求归零售', async () => {
  for (const sale_type of ['wholesale', 'supplier_proxy', 'peer_transfer']) {
    const f = fixture()
    assert.equal((await sell(f, { ...request, sale_type })).status, 400)
    assert.deepEqual(f.events, [])
  }
  for (const sale_type of ['batch', 'batch_item']) {
    const f = fixture()
    assert.equal((await sell(f, { ...batch, sale_type })).status, 200)
    assert.ok(f.state().sales.every(row => row.saleType === 'retail'))
  }
})

test('兼容现有页面小数相加的二进制误差，收款及合计仍精确到分', async () => {
  const f = fixture()
  const result = await sell(f, { ...batch,
    phones: [{ phone_id: 12, sale_price: 0.1 }, { phone_id: 13, sale_price: 0.2 }],
    payment_info: { payment_method: 'cash', payment_amount: 0.1 + 0.2 }
  })
  assert.equal(result.status, 200)
  assert.equal(result.body.data.total_amount, 0.3)
  assert.deepEqual(f.state().payments.map(row => row.amount), [0.1, 0.2])
})

test('批量只用一个备注：有值或留空均统一保存，未提交字段时才保留原备注', async () => {
  for (const remarks of ['整批公共备注', '']) {
    const f = fixture()
    assert.equal((await sell(f, { ...batch, remarks })).status, 200)
    assert.deepEqual(f.state().sales.map(row => row.remarks), [remarks || null, remarks || null])
  }
  const f = fixture()
  assert.equal((await sell(f, batch)).status, 200)
  assert.deepEqual(f.state().sales.map(row => row.remarks), ['existing', 'existing'])
})

test('实际存量成本无效时拒绝猜测，事务回滚', async () => {
  const f = fixture({ cost: 'broken' })
  assert.equal((await sell(f)).status, 409)
  assert.deepEqual(f.state(), f.initial())
})

test('销售按公共配置验证方式及渠道，逐笔收款和销售一致，省略金额按明细合计', async () => {
  for (const method of paymentOptions.sale) {
    for (const channel of paymentOptions.channels[method.value] || [{ value: null }]) {
      const f = fixture()
      const result = await sell(f, { ...batch, payment_info: { payment_method: method.value, payment_channel: channel.value, payment_amount: '300.30' } })
      assert.equal(result.status, 200)
      assert.ok(f.state().payments.every(row => row.paymentMethod === method.value && row.paymentChannel === channel.value))
      assert.ok(f.state().sales.every(row => row.paymentMethod === method.value && row.paymentChannel === channel.value))
    }
  }
  for (const [method, channel] of [['cash', 'wechat'], ['mobile', null], ['bank_card', 'wechat'], ['wechat', null]]) {
    const f = fixture()
    assert.equal((await sell(f, { ...request, payment_info: { payment_method: method, payment_channel: channel } })).status, 400)
    assert.deepEqual(f.events, [])
  }
})

test('公共配置新增渠道后，销售及快速出库无需修改白名单', async t => {
  const channels = paymentOptions.channels.mobile, original = [...channels]
  t.after(() => channels.splice(0, channels.length, ...original))
  channels.push({ label: '测试渠道', value: 'test_channel' })
  const f = fixture()
  assert.equal((await sell(f, { ...request, payment_info: { payment_method: 'mobile', payment_channel: 'test_channel' } })).status, 200)
  const reached = new Error('validated-before-transaction')
  const service = new InventoryService({
    repository: { withConnection: async () => { throw reached } },
    validateImei: () => ({ valid: true, normalizedImei: '123456789012345', normalizedSerialNumber: 'TEST-SN' })
  })
  const body = { brand_id: 1, model_id: 2, color_id: 3, memory_id: 4, supplier_id: 5, store_id: 6,
    imei: '123456789012345', serial_number: 'TEST-SN', sale_operator_id: 7, sale_price: 100, purchase_cost: 80,
    customer_phone: '13800138000', payment_method: 'mobile', payment_channel: 'test_channel' }
  await assert.rejects(service.quickSale(body, { id: 7 }), error => error === reached)
  await assert.rejects(service.quickSale({ ...body, payment_channel: 'unknown' }, { id: 7 }), /请选择有效的支付渠道/)
  await assert.rejects(service.quickSale({ ...body, payment_method: 'cash' }, { id: 7 }), /请选择有效的支付渠道/)
})
