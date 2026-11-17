'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const Service = require('../src/services/salary-goods.service')
const Repository = require('../src/repositories/salary-goods.repository')
const { createGoodsCommission } = require('../src/utils/goods-commission')
const { planGoodsReturn } = require('../src/utils/checkout-goods-return')

const through = '2026-11-30 23:59:59'
const rule = { enabled: true, type: 'percentage', fixed_amount: 2.5, percentage: 33.33 }
const item = (patch = {}) => {
  const row = { item_id: 50, order_id: 10, accessory_id: 5, accessory_sale_id: 20, quantity: 3,
    unit_price: '20.00', total_amount: '60.00', purchase_cost: '30.00', points_awarded: 0,
    item_time: '2026-10-20 12:00:00', order_no: 'SO-original', store_id: 1, customer_id: 9,
    order_operator_id: 8, order_time: '2026-10-20 12:00:00', recorded_at: '2026-10-20 12:01:00',
    source_sale_id: 20, sale_accessory_id: 5, sale_customer_id: 9, sale_store_id: 1, sale_quantity: 3,
    sale_unit_price: '20.00', sale_total_price: '60.00', sale_purchase_cost: '30.00', sale_type: 'sale',
    sale_operator_id: 8, sale_time: '2026-10-20 12:00:00', ...patch }
  row.snapshot = { name: '原单充电器', sale_type: row.sale_type, serial_numbers: ['SN1', 'SN2', 'SN3'], points_used: 0,
    commission: createGoodsCommission({ employeeId: row.sale_operator_id, salaryTemplateId: 4, quantity: row.quantity,
      saleType: row.sale_type, paidCents: Number(row.total_amount) * 100, purchaseCostCents: row.purchase_cost === null ? null : Number(row.purchase_cost) * 100,
      pointsUsed: 0, rule }) }
  return row
}
const returned = (row, history, sn, returnId = 100, patch = {}) => {
  const plan = planGoodsReturn(row, history, sn.length, sn)
  return { aftersale_item_id: returnId, original_item_id: row.item_id, aftersale_id: returnId + 200,
    source_aftersale_id: returnId + 200, operation_type: 'goods_return', quantity: sn.length,
    fact_snapshot: { unit_ranges: plan.unit_ranges, serial_numbers: sn, commission_return: plan.commission_return },
    business_time: '2026-11-10 10:00:00', recorded_at: '2026-11-10 10:00:01', ...patch }
}
const fixture = (items = [item()], history = [], batchSize = 2) => {
  const queries = [], calls = []
  let state = { items, history }, snapshot, failure
  const connection = {
    async execute(sql, params = []) {
      const text = sql.replace(/\s+/g, ' ').trim()
      queries.push({ sql: text, params }); calls.push('query')
      if (text.startsWith('SET TRANSACTION')) {
        if (failure === 'configure') throw new Error('configure-failed')
        return [{}]
      }
      if (failure === 'query') throw new Error('query-failed')
      if (/FROM sales_order_items/.test(text)) {
        assert.match(text, /o\.request_key IS NOT NULL AND o\.order_status = 'completed'/)
        assert.match(text, /LEFT JOIN accessory_sales/)
        assert.match(text, /s\.operator_id = \? OR JSON_UNQUOTE\(JSON_EXTRACT\(i\.snapshot, '\$\.commission\.employee_id'\)\) = \?/)
        assert.match(text, /ORDER BY i\.id LIMIT \?$/)
        const [employeeId, employeeText, businessCutoff, recordedCutoff, afterId, size] = params
        assert.equal(employeeText, String(employeeId))
        return [structuredClone((snapshot || state).items.filter(row =>
          (Number(row.sale_operator_id) === employeeId || row.snapshot?.commission?.employee_id === employeeId) &&
          row.item_time <= businessCutoff && row.recorded_at <= recordedCutoff && row.item_id > afterId).slice(0, size))]
      }
      assert.match(text, /FROM sales_aftersale_items i LEFT JOIN sales_aftersales/)
      return [structuredClone((snapshot || state).history.filter(row => params.includes(row.original_item_id)))]
    },
    async beginTransaction() {
      calls.push('begin')
      if (failure === 'begin') throw new Error('begin-failed')
      snapshot = structuredClone(state)
    },
    async rollback() { calls.push('rollback'); snapshot = undefined; if (failure === 'rollback') throw new Error('rollback-failed') },
    destroy() { calls.push('destroy'); snapshot = undefined },
    release() { calls.push('release') }
  }
  const repository = new Repository({ database: () => ({ async getConnection() { calls.push('acquire'); return connection } }) })
  return { connection, repository, service: new Service({ repository, batchSize, tableExists: async () => true, columnExists: async () => true }), queries, calls,
    fail(value) { failure = value }, change(next) { state = next } }
}

test('原单商品提成按实际销售员和冻结规则汇总，SN分次跨月退回严格守恒', async () => {
  const row = item(), first = returned(row, [], ['SN3']), second = returned(row, [first], ['SN1', 'SN2'], 101)
  const f = fixture([row], [first, second]), result = await f.service.preview('8', through)
  assert.equal(result.employee_id, 8)
  assert.equal(result.earned_cents, 1000); assert.equal(result.reversal_cents, 1000); assert.equal(result.net_cents, 0)
  assert.deepEqual(result.entries.map(entry => entry.amount_cents), [1000, -334, -666])
  assert.deepEqual(result.entries.map(entry => entry.source_key), ['goods_sale:50', 'goods_return:100', 'goods_return:101'])
  assert.equal(result.entries[1].original_source_key, 'goods_sale:50')
  assert.equal(result.entries[1].order_id, 10); assert.equal(result.entries[1].aftersale_id, 300)
  assert.equal(result.entries[0].salary_template_id, 4)
  assert.ok(result.entries.every(entry => /^[a-f0-9]{64}$/.test(entry.source_hash)))
  assert.equal(result.entries[0].business_time, '2026-10-20 12:00:00')
  assert.equal(result.entries[1].business_time, '2026-11-10 10:00:00')
  assert.equal(f.queries.some(query => /salary_templates|FROM users|FROM accessories|UPDATE|INSERT|DELETE/.test(query.sql)), false)
  assert.deepEqual(f.calls.slice(-2), ['rollback', 'release'])
})

test('单连接只读RR快照读取所有分页，不能只统计首屏；重复读取来源键及哈希稳定', async () => {
  const rows = Array.from({ length: 5 }, (_, index) => item({ item_id: 50 + index }))
  const f = fixture(rows), first = await f.service.preview(8, through), second = await f.service.preview(8, through)
  assert.equal(first.entries.length, 5); assert.equal(first.earned_cents, 5000)
  assert.deepEqual(second, first)
  const reads = f.queries.filter(query => /FROM sales_order_items/.test(query.sql))
  assert.deepEqual(reads.slice(0, 4).map(query => query.params[4]), [0, 51, 53, 54])
  assert.match(f.queries[0].sql, /^SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY$/)
  assert.equal(f.calls.filter(call => call === 'acquire').length, 2)
  assert.equal(f.calls.filter(call => call === 'rollback').length, 2)
})

test('读取过程中提交的新售后不能混入当前快照，下次读取才取得完整新事实', async () => {
  const row = item(), history = returned(row, [], ['SN1'])
  const f = fixture([row])
  const original = f.repository.items.bind(f.repository)
  f.repository.items = async (...args) => {
    const result = await original(...args)
    f.change({ items: [row], history: [history] })
    return result
  }
  assert.equal((await f.service.preview(8, through)).reversal_cents, 0)
  assert.equal((await f.service.preview(8, through)).reversal_cents, 333)
})

test('业务时间和记录时间分开保留，截止点不提前读取尚未记录或未来业务的冲回', async () => {
  const row = item(), first = returned(row, [], ['SN3'], 100,
    { business_time: '2026-10-31 23:59:59', recorded_at: '2026-11-01 00:00:01' })
  const future = returned(row, [first], ['SN1'], 101, { business_time: '2026-12-01 00:00:00', recorded_at: '2026-11-20 12:00:00' })
  const f = fixture([row], [first, future])
  assert.equal((await f.service.preview(8, '2026-10-31 23:59:59')).entries.length, 1)
  const result = await f.service.preview(8, through)
  assert.equal(result.entries.length, 2); assert.equal(result.reversal_cents, 334)
  assert.equal(result.entries[1].business_time, '2026-10-31 23:59:59')
  assert.equal(result.entries[1].recorded_at, '2026-11-01 00:00:01')
  assert.equal((await f.service.preview(8, '2026-12-01 00:00:00')).reversal_cents, 667)
})

test('手机联合退货及换货冲回原销售员，新换入商品保留自己的销售员和规则', async () => {
  const old = item(), replacement = item({ item_id: 60, order_id: 11, sale_operator_id: 9, order_operator_id: 9,
    item_time: '2026-11-12 12:00:00', order_time: '2026-11-12 12:00:00', sale_time: '2026-11-12 12:00:00', recorded_at: '2026-11-12 12:00:01' })
  const first = returned(old, [], ['SN1'], 100, { operation_type: 'phone_return' })
  const second = returned(old, [first], ['SN2'], 101, { operation_type: 'goods_exchange' })
  const f = fixture([old, replacement], [first, second])
  const original = await f.service.preview(8, through), next = await f.service.preview(9, through)
  assert.equal(original.reversal_cents, 666); assert.equal(original.entries.length, 3)
  assert.equal(next.entries.length, 1); assert.equal(next.entries[0].employee_id, 9); assert.equal(next.earned_cents, 1000)
})

test('赠品、未知成本、亏损及关闭配置保持零原因，不借当前模板追发', async () => {
  for (const [patch, reason] of [
    [{ unit_price: 0, sale_unit_price: 0, total_amount: 0, sale_total_price: 0, sale_type: 'gift' }, 'gift'],
    [{ purchase_cost: null, sale_purchase_cost: null }, 'unknown_cost'],
    [{ purchase_cost: 80, sale_purchase_cost: 80 }, 'loss']
  ]) {
    const row = item(patch), result = await fixture([row]).service.preview(8, through)
    assert.equal(result.entries[0].amount_cents, 0); assert.equal(result.entries[0].reason, reason)
  }
  const row = item()
  row.snapshot.commission = createGoodsCommission({ employeeId: 8, salaryTemplateId: 4, quantity: 3,
    saleType: 'sale', paidCents: 6000, purchaseCostCents: 3000, rule: { ...rule, enabled: false } })
  const f = fixture([row]), result = await f.service.preview(8, through)
  assert.equal(result.net_cents, 0); assert.equal(result.entries[0].reason, 'disabled')
})

test('部分积分抵扣整行无提成，退回也不扣工资，客户积分优惠不混进工资', async () => {
  const row = item({ total_amount: 59, sale_total_price: 59 })
  Object.assign(row.snapshot, { points_used: 100, deduction_cents: 100, gross_cents: 6000, points_per_yuan: 100,
    points_units: [{ quantity: 1, points_used: 100, deduction_cents: 100, payable_cents: 1900, points_awarded: 0 },
      { quantity: 2, points_used: 0, deduction_cents: 0, payable_cents: 2000, points_awarded: 0 }],
    commission: createGoodsCommission({ employeeId: 8, salaryTemplateId: 4, quantity: 3, saleType: 'sale',
      paidCents: 5900, purchaseCostCents: 3000, pointsUsed: 100, rule }) })
  const history = returned(row, [], ['SN1'])
  const result = await fixture([row], [history]).service.preview(8, through)
  assert.equal(result.net_cents, 0); assert.equal(result.entries[0].reason, 'points_used')
  assert.equal(result.entries[1].amount_cents, 0)
  assert.equal(JSON.stringify(result).includes('points_units'), false)
})

test('旧无提成快照不补造，有孤立冲回或损坏配置明确拒绝', async () => {
  const row = item(), reversal = returned(row, [], ['SN1'])
  delete row.snapshot.commission
  const result = await fixture([row]).service.preview(8, through)
  assert.equal(result.legacy_item_count, 1); assert.deepEqual(result.entries, [])
  await assert.rejects(fixture([row], [reversal]).service.preview(8, through), { code: 'SALARY_GOODS_CONFLICT' })
  for (const value of [null, {}, { ...item().snapshot.commission, earned_cents: 1001 }]) {
    const broken = item(); broken.snapshot.commission = value
    await assert.rejects(fixture([broken]).service.preview(8, through), { code: 'GOODS_COMMISSION_CONFLICT' })
  }
})

test('旧普通件按原连续数量核对，未退赠品0件扣款不产生工资扣除', async () => {
  const row = item(); row.snapshot.serial_numbers = []
  const plan = planGoodsReturn(row, [], 2, [])
  const history = { ...returned(item(), [], ['SN1']), quantity: 2,
    fact_snapshot: { unit_ranges: plan.unit_ranges, serial_numbers: [], commission_return: plan.commission_return } }
  assert.equal((await fixture([row], [history]).service.preview(8, through)).reversal_cents, 666)
  const gift = item({ sale_type: 'gift', unit_price: 0, sale_unit_price: 0, total_amount: 0, sale_total_price: 0 })
  gift.snapshot.gift_return_unit_price = 20
  const empty = planGoodsReturn(gift, [], 0, [])
  const charge = { ...history, quantity: 0, fact_snapshot: { kind: 'gift_charge', unit_ranges: [], serial_numbers: [],
    commission_return: empty.commission_return, gift_charge: { quantity: 3, unit_cents: 2000, amount_cents: 6000, serial_numbers: ['SN1', 'SN2', 'SN3'] } } }
  const result = await fixture([gift], [charge]).service.preview(8, through)
  assert.equal(result.net_cents, 0); assert.equal(result.entries[1].quantity, 0); assert.equal(result.entries[1].amount_cents, 0)
})

test('销售员、订单、采购成本及真实销售关联不符均拒绝，不将损坏行当零忽略', async () => {
  for (const patch of [{ order_operator_id: 9 }, { sale_operator_id: 9 }, { source_sale_id: null }, { source_sale_id: 21 },
    { sale_accessory_id: 6 }, { sale_store_id: 2 }, { sale_customer_id: 8 }, { sale_quantity: 2 },
    { sale_type: 'gift' }, { sale_unit_price: 21 }, { sale_total_price: 59 }, { sale_purchase_cost: 29 },
    { order_time: '2026-10-21 12:00:00' }, { sale_time: '2026-10-20 12:00:01' }]) {
    const row = item(); Object.assign(row, patch)
    await assert.rejects(fixture([row]).service.preview(8, through), { statusCode: 409 })
  }
})

test('重复售后、缺失头、重叠SN或冲回篡改阻止继续汇总，即使后续事件在截止点之外', async () => {
  const row = item(), first = returned(row, [], ['SN1'])
  for (const history of [[first, first], [{ ...first, source_aftersale_id: null }], [{ ...first, original_item_id: 99 }],
    [{ ...first, operation_type: 'delete' }], [first, { ...first, aftersale_item_id: 101 }]]) {
    const f = fixture([row], history)
    if (history[0].original_item_id === 99) f.repository.returns = async () => history
    await assert.rejects(f.service.preview(8, through), { statusCode: 409 })
    assert.deepEqual(f.calls.slice(-2), ['rollback', 'release'])
  }
  first.recorded_at = '2026-12-01 00:00:01'
  first.fact_snapshot.commission_return.reversal_cents++
  await assert.rejects(fixture([row], [first]).service.preview(8, through), { code: 'GOODS_COMMISSION_CONFLICT' })
})

test('MySQL JSON文本及键重排不改变来源摘要；真实金额变化不能沿用原摘要', async () => {
  const row = item(), first = returned(row, [], ['SN3']), f = fixture([row], [first])
  const original = await f.service.preview(8, through)
  row.snapshot.commission = Object.fromEntries(Object.entries(row.snapshot.commission).reverse())
  row.snapshot.commission.rule = Object.fromEntries(Object.entries(row.snapshot.commission.rule).reverse())
  row.snapshot = JSON.stringify(row.snapshot)
  first.fact_snapshot = JSON.stringify(Object.fromEntries(Object.entries(first.fact_snapshot).reverse()))
  assert.deepEqual(await f.service.preview(8, through), original)
  const next = item(); next.snapshot.commission.rule.fixed_amount = 3
  const changed = await fixture([next]).service.preview(8, through)
  assert.notEqual(changed.entries[0].source_hash, original.entries[0].source_hash)
  const differentSerial = item(); differentSerial.snapshot.serial_numbers[0] = 'SN-other'
  assert.notEqual((await fixture([differentSerial]).service.preview(8, through)).entries[0].source_hash, original.entries[0].source_hash)
})

test('非法员工、真实日期、截止点或批次参数在借连接前拒绝，SQL输入全部绑定', async () => {
  const f = fixture()
  for (const employee of [0, true, '8 OR 1', 1.1, {}, null]) await assert.rejects(f.service.preview(employee, through), { statusCode: 400 })
  for (const cutoff of [null, '2026-02-30 00:00:00', '2026-11-30 24:00:00', '2026-11-30', '2026-11-30 23:59:59 OR 1']) {
    await assert.rejects(f.service.preview(8, cutoff), { statusCode: 400 })
  }
  assert.deepEqual(f.calls, [])
  for (const batchSize of [0, 1001, '2', true]) assert.throws(() => new Service({ batchSize }), { statusCode: 400 })
  await f.service.preview(8, through)
  assert.deepEqual(f.queries[1].params, [8, '8', through, through, 0, 2])
})

test('数据库字符串时间和UTC Date均经北京时间核对，坏时间及倒置记录时间不能掩盖', async () => {
  const row = item()
  row.sale_time = new Date('2026-10-20T04:00:00Z')
  assert.equal((await fixture([row]).service.preview(8, through)).entries[0].business_time, '2026-10-20 12:00:00')
  for (const bad of ['2026-02-30 12:00:00', 'bad', new Date(NaN), '2026-11-30 24:00:00']) {
    const changed = item(); changed.sale_time = bad
    await assert.rejects(fixture([changed]).service.preview(8, through), { statusCode: 409 })
  }
  const original = item(), history = returned(original, [], ['SN1'], 100, { recorded_at: '2026-10-19 00:00:00' })
  await assert.rejects(fixture([original], [history]).service.preview(8, through), { code: 'SALARY_GOODS_CONFLICT' })
})

test('提成预览配置、启动或回滚失败销毁连接，普通读取失败回滚后释放', async () => {
  for (const name of ['configure', 'query', 'begin', 'rollback']) {
    const f = fixture(); f.fail(name)
    await assert.rejects(f.service.preview(8, through), new RegExp(`${name}-failed`))
    assert.equal(f.calls.at(-1), 'release')
    assert.equal(f.calls.filter(call => call === 'rollback').length, ['query', 'rollback'].includes(name) ? 1 : 0)
    assert.equal(f.calls.includes('destroy'), name !== 'query')
    if (name !== 'query') assert.deepEqual(f.calls.slice(-2), ['destroy', 'release'])
  }
  const f = fixture(); f.repository.items = async () => { throw new Error('read-failed') }
  await assert.rejects(f.service.preview(8, through), /read-failed/)
  assert.deepEqual(f.calls.slice(-2), ['rollback', 'release'])
  assert.equal(f.calls.includes('destroy'), false)
})

test('前置表或真实录入时间字段未就绪返回409，不伪造时间、不读业务记录也不执行DDL', async () => {
  for (const missing of ['sales_orders', 'sales_order_items', 'sales_aftersales', 'sales_aftersale_items']) {
    const f = fixture()
    f.service.tableExists = async (table, connection) => { assert.equal(connection, f.connection); return table !== missing }
    await assert.rejects(f.service.preview(8, through), { code: 'SALARY_GOODS_NOT_READY', statusCode: 409 })
    assert.equal(f.queries.length, 1)
    assert.deepEqual(f.calls.slice(-2), ['rollback', 'release'])
  }
  const f = fixture()
  f.service.columnExists = async (table, column, connection) => {
    assert.equal(connection, f.connection); assert.equal(column, 'created_at'); return table !== 'sales_orders'
  }
  await assert.rejects(f.service.preview(8, through), { code: 'SALARY_GOODS_NOT_READY' })
  assert.equal(f.queries.length, 1)
})

test('共同明细及售后BIGINT来源超过32位仍精确核对，超过安全整数拒绝', async () => {
  const row = item({ item_id: 2147483648, order_id: 2147483649, accessory_id: 2147483650, sale_accessory_id: 2147483650,
    accessory_sale_id: 2147483651, source_sale_id: 2147483651 })
  const history = returned(row, [], ['SN1'], 2147483652)
  const result = await fixture([row], [history]).service.preview(8, through)
  assert.equal(result.entries[0].source_key, 'goods_sale:2147483648')
  assert.equal(result.entries[1].source_key, 'goods_return:2147483652')
  assert.equal(result.reversal_cents, 333)
  const f = fixture(); f.repository.items = async () => [{ ...row, item_id: '9007199254740993' }]
  await assert.rejects(f.service.preview(8, through), { code: 'SALARY_GOODS_CONFLICT' })
})
