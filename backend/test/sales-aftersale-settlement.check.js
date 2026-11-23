'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const { allocateAftersaleSettlement: allocate, readAftersaleSettlement: read } = require('../src/utils/sales-aftersale-settlement')

const line = (id, base, recovery = 0, compensation = 0, points = 0) => ({ original_item_id: id,
  base_refund_cents: base, recovery_cents: recovery, compensation_cents: compensation, points_delta: points })
const saved = lines => {
  const result = allocate(lines)
  const header = { id: 31, order_id: 71, operation_type: 'goods_return', ...result.totals }
  const rows = result.items.map((item, index) => ({ id: index + 1, aftersale_id: 31, original_item_id: item.original_item_id,
    item_order_id: 71, item_type: 'accessory', fact_snapshot: { payable_cents: item.settlement.base_refund_cents, settlement: item.settlement } }))
  return { header, rows }
}
const sum = (items, key) => items.reduce((amount, item) => amount + item.settlement[key], 0)

test('换货第三版分开保存旧件可退与新件应付，只确认一次净差价，不重解释旧版凭据', () => {
  for (const [base, replacement, refund, collection] of [[2000, 5000, 0, 3000], [5000, 2000, 3000, 0], [2000, 2000, 0, 0], [0, 0, 0, 0]]) {
    const result = allocate([{ ...line(1, base), gift_charge_cents: 0, replacement_cents: replacement }], { version: 3 })
    assert.equal(result.totals.refund_cents, refund); assert.equal(result.totals.collection_cents, collection)
    const header = { id: 1, order_id: 10, operation_type: 'goods_exchange', ...result.totals }
    const rows = [{ id: 1, aftersale_id: 1, original_item_id: 1, item_order_id: 10, item_type: 'accessory', quantity: 1,
      fact_snapshot: { payable_cents: base, exchange: { replacement_cents: replacement, replacement_order_id: 11,
        replacement_item_id: 2, root_order_id: 10, root_item_id: 1, quantity: 1 }, settlement: result.items[0].settlement } }]
    assert.equal(read(header, rows)[0].settlement.replacement_cents, replacement)
    for (const corrupt of [data => { data.header.replacement_cents++ }, data => { delete data.header.replacement_cents },
      data => { data.rows[0].fact_snapshot.exchange.replacement_cents++ }, data => { data.rows[0].fact_snapshot.settlement.version = 2 },
      data => { data.header.operation_type = 'goods_return' }, data => { data.rows[0].quantity = 0 },
      data => { data.rows[0].fact_snapshot.exchange.replacement_item_id = 1 }, data => { data.rows[0].fact_snapshot.exchange.root_item_id = 3 },
      data => { delete data.rows[0].fact_snapshot.exchange.root_order_id }]) {
      const data = structuredClone({ header, rows }); corrupt(data)
      assert.throws(() => read(data.header, data.rows), { code: 'CHECKOUT_RETURN_CONFLICT' })
    }
  }
  assert.throws(() => allocate([{ ...line(1, 100), replacement_cents: 1 }]), { statusCode: 409 })
})

test('换货第四版额外购买金额独立守恒，多个商品合并入同一售后资金头', () => {
  const result = allocate([{ ...line(50, 2000), gift_charge_cents: 0, replacement_cents: 5000, additional_cents: 3500 }], { version: 4 })
  assert.equal(result.totals.refund_cents, 0)
  assert.equal(result.totals.collection_cents, 6500)
  assert.equal(result.totals.additional_cents, 3500)
  const header = { id: 1, order_id: 10, operation_type: 'goods_exchange', ...result.totals }
  const rows = [{ id: 1, aftersale_id: 1, original_item_id: 50, item_order_id: 10, item_type: 'accessory', quantity: 1,
    fact_snapshot: { payable_cents: 2000, exchange: { replacement_cents: 5000, additional_cents: 3500, replacement_order_id: 11,
      replacement_item_id: 51, root_order_id: 10, root_item_id: 50, quantity: 1 }, settlement: result.items[0].settlement } }]
  assert.equal(read(header, rows)[0].settlement.additional_cents, 3500)
  const changed = structuredClone({ header, rows })
  changed.header.additional_cents++
  assert.throws(() => read(changed.header, changed.rows), { code: 'CHECKOUT_RETURN_CONFLICT' })
})

test('第二版赠品扣款单独守恒，不混入积分追回；旧版不重解释、跨版本或篡改扣款均拒绝', () => {
  const result = allocate([{ ...line(1, 10000), gift_charge_cents: 0 }, { ...line(2, 0), gift_charge_cents: 1500 }], { version: 2 })
  assert.equal(result.totals.refund_cents, 8500); assert.equal(result.totals.recovery_cents, 0)
  assert.equal(result.items[1].settlement.offset_cents, -1500)
  const header = { id: 31, order_id: 71, operation_type: 'phone_return', ...result.totals }
  const rows = result.items.map((row, index) => ({ id: index + 1, aftersale_id: 31, original_item_id: row.original_item_id,
    item_order_id: 71, item_type: index ? 'accessory' : 'phone', fact_snapshot: { payable_cents: row.settlement.base_refund_cents,
      ...(index ? { gift_charge: { amount_cents: 1500 } } : {}), settlement: row.settlement } }))
  assert.equal(read(header, rows)[1].settlement.gift_charge_cents, 1500)
  assert.throws(() => allocate([{ ...line(1, 100), gift_charge_cents: 1 }]), { statusCode: 409 })
  for (const mutate of [data => { data.rows[1].fact_snapshot.settlement.version = 1 },
    data => { data.header.gift_charge_cents = 0 }, data => { delete data.header.gift_charge_cents },
    data => { data.rows[1].fact_snapshot.gift_charge.amount_cents = 1400 },
    data => { delete data.rows[1].fact_snapshot.settlement.gift_charge_cents }]) {
    const data = structuredClone({ header, rows }); mutate(data)
    assert.throws(() => read(data.header, data.rows), { statusCode: 409 })
  }
})

test('单明细与原退款/补款一致，实际0元仍保留积分事实；整笔资金和逐行归属分别守恒', () => {
  for (const lines of [[line(1, 1000, 300, 50, -5)], [line(1, 100, 300)], [line(1, 0, 0, 0, 5)]]) {
    const result = allocate(lines), { header, rows } = saved(lines)
    assert.equal(result.items[0].settlement.offset_cents, 0)
    assert.equal(result.totals.refund_cents, Math.max(lines[0].base_refund_cents + lines[0].compensation_cents - lines[0].recovery_cents, 0))
    assert.equal(read(header, rows)[0].settlement.refund_cents, result.totals.refund_cents)
    for (const key of Object.keys(result.totals)) assert.equal(sum(result.items, key), result.totals[key])
  }
})

test('多明细退款与追回在同单互抵，只保存净资金归属，不对每行重复整笔退款', () => {
  const result = allocate([line(50, 10000, 0, 0, -100), line(51, 1000, 3000, 0, 2)])
  assert.equal(result.totals.refund_cents, 8000)
  assert.equal(result.totals.collection_cents, 0)
  assert.deepEqual(result.items.map(item => [item.settlement.refund_cents, item.settlement.collection_cents, item.settlement.offset_cents]),
    [[8000, 0, 2000], [0, 0, -2000]])
  assert.equal(sum(result.items, 'offset_cents'), 0)
  assert.equal(sum(result.items, 'points_delta'), -98)
  const collection = allocate([line(1, 2000), line(2, 0, 10000), line(3, 0, 5000)])
  assert.equal(collection.totals.collection_cents, 13000)
  assert.deepEqual(collection.items.map(item => item.settlement.collection_cents), [0, 8667, 4333])
  assert.equal(sum(collection.items, 'offset_cents'), 0)
})

test('分币采用原明细ID稳定打破并列，换顺序不改变金额；正负整笔及恰好抵完均无双向资金', () => {
  for (const lines of [[line(3, 1), line(1, 1), line(2, 0, 1)], [line(3, 0, 1), line(1, 0, 1), line(2, 1)],
    [line(1, 100), line(2, 0, 100)]]) {
    const first = allocate(lines)
    assert.deepEqual(allocate([...lines].reverse()), first)
    assert.equal(sum(first.items, 'refund_cents'), first.totals.refund_cents)
    assert.equal(sum(first.items, 'collection_cents'), first.totals.collection_cents)
    assert.equal(sum(first.items, 'offset_cents'), 0)
    if (first.totals.refund_cents) assert.equal(first.items[0].settlement.refund_cents, 1)
    if (first.totals.collection_cents) assert.equal(first.items[0].settlement.collection_cents, 1)
  }
})

test('大额比例乘法使用整数，不丢分；非法类型、溢出、重复明细及积分超范围拒绝', () => {
  const result = allocate([line(1, 900000000000000), line(2, 800000000000000), line(3, 0, 1)])
  assert.equal(sum(result.items, 'refund_cents'), 1699999999999999)
  assert.equal(sum(result.items, 'offset_cents'), 0)
  const invalid = [[], [line(1, true)], [line(1, 1.1)], [line(1, -1)], [line(1, '1x')],
    [line(1, 1), line(1, 1)], [line(1, 1, 0, 0, 2147483648)], [line(1, 1, 0, 0, -2147483649)],
    [line(1, Number.MAX_SAFE_INTEGER), line(2, 1)], [line(1, 1, 0, Number.MAX_SAFE_INTEGER)]]
  for (const lines of invalid) assert.throws(() => allocate(lines), { code: 'CHECKOUT_RETURN_CONFLICT' })
})

test('新凭据须完整核验整笔和所有明细，缺失、重复、跨原单、错头、坏JSON和篡改归属均拒绝', () => {
  const fixture = () => saved([line(1, 1000, 30, 0, -2), line(2, 2000)])
  const good = fixture()
  assert.equal(read(good.header, good.rows).length, 2)
  const corruptions = [
    f => { f.rows.pop() }, f => { f.rows.push(f.rows[0]) }, f => { f.rows[0].item_order_id = 99 },
    f => { f.rows[0].aftersale_id = 32 }, f => { f.rows[0].fact_snapshot = '{broken' },
    f => { f.rows[0].fact_snapshot.payable_cents = 2 }, f => { f.header.refund_cents++ },
    f => { delete f.rows[0].fact_snapshot.settlement }, f => { f.rows[0].fact_snapshot.settlement = null },
    f => { f.rows[0].fact_snapshot.settlement.version = 2 }, f => { f.rows[0].fact_snapshot.settlement.offset_cents = 1 },
    f => { f.rows[0].fact_snapshot.settlement.extra = 1 },
    f => { f.rows[0].fact_snapshot.settlement.points_delta = 1 }, f => { f.rows[1].original_item_id = 1 }
  ]
  for (const corrupt of corruptions) {
    const f = fixture(); corrupt(f)
    assert.throws(() => read(f.header, f.rows), { code: 'CHECKOUT_RETURN_CONFLICT' })
  }
})

test('分币归属即使总额守恒也不能互换；旧历史只在单条商品原单凭据确切时读取头金额且不回写', () => {
  const f = saved([line(1, 1), line(2, 1), line(3, 0, 1)])
  f.rows[0].fact_snapshot.settlement.refund_cents = 0; f.rows[0].fact_snapshot.settlement.offset_cents = 1
  f.rows[1].fact_snapshot.settlement.refund_cents = 1; f.rows[1].fact_snapshot.settlement.offset_cents = 0
  assert.throws(() => read(f.header, f.rows), { code: 'CHECKOUT_RETURN_CONFLICT' })
  const legacy = saved([line(1, 1000, 30, 0, -2)])
  delete legacy.rows[0].fact_snapshot.settlement
  const before = structuredClone(legacy)
  assert.equal(read(legacy.header, legacy.rows)[0].settlement.refund_cents, 970)
  assert.deepEqual(legacy, before)
  for (const change of [f => { f.rows[0].item_type = 'phone' }, f => { f.header.operation_type = 'phone_return' },
    f => { f.rows[0].fact_snapshot.payable_cents++ }, f => { f.rows.push({ ...f.rows[0], id: 2, original_item_id: 2 }) }]) {
    const copy = structuredClone(legacy); change(copy)
    assert.throws(() => read(copy.header, copy.rows), { code: 'CHECKOUT_RETURN_CONFLICT' })
  }
})

test('多明细正负金额组合保持分币、积分、同单抵扣和读取守恒，稳定重排不改变原事实', () => {
  let seed = 20261113
  const next = max => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed % max }
  for (let index = 0; index < 500; index++) {
    const lines = Array.from({ length: next(20) + 1 }, (_, i) => line(i + 1, next(100000), next(100000), next(10000), next(1000) - 500))
    const before = structuredClone(lines), result = allocate(lines), fixture = saved(lines)
    assert.deepEqual(allocate([...lines].reverse()), result)
    assert.deepEqual(lines, before)
    assert.equal(sum(result.items, 'offset_cents'), 0)
    assert.equal(read(fixture.header, fixture.rows).length, lines.length)
    for (const key of Object.keys(result.totals)) assert.equal(sum(result.items, key), result.totals[key])
    for (const { settlement: item } of result.items) {
      assert.equal(item.base_refund_cents + item.compensation_cents - item.recovery_cents - item.offset_cents,
        item.refund_cents - item.collection_cents)
      assert.equal(Boolean(item.refund_cents && item.collection_cents), false)
    }
  }
})
