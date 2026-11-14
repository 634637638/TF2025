'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fixture = require('./helpers/customer-points-ledger')
const CustomerPointsLedgerService = require('../src/services/customer-points-ledger.service')

const award = (f, db, sourceId, points, sourceType = 'phone_sale') => f.service.applyDelta(db, { customerId: 9, sourceId, sourceType, delta: points })
const consume = async (f, db, itemId, points, rate = 100) => f.service.consume(db, {
  customerId: 9, itemId, points, pointsPerYuan: rate, amountCents: points * 100 / rate,
  snapshot: await f.service.snapshot(db, 9)
})
const sourceReturn = (f, db, sourceId, points, requestKey, sourceType = 'phone_sale') => f.service.returnAward(db, {
  customerId: 9, sourceType, sourceId, points, requestKey
})
const itemReturn = (f, db, itemId, points, requestKey) => f.service.returnRedemption(db, { customerId: 9, itemId, points, requestKey })
const state = f => f.transaction(db => f.service.state(db, 9))

test('退奖励先扣原来源未用积分，已抵扣部分按原价值追回，不占其他新单或历史余额', async () => {
  const f = fixture({ initialPoints: 50 })
  await f.transaction(async db => {
    await award(f, db, 1, 10)
    await award(f, db, 2, 20, 'checkout_item')
    await consume(f, db, 101, 7, 1)
    const result = await sourceReturn(f, db, 1, 10, 'return:source:1')
    assert.deepEqual(result, { entry_id: 1, operation_type: 'award_return', points: 10,
      points_delta: -3, recovery_cents: 700, compensation_cents: 0, balance_after: 70 })
    const current = await f.service.state(db, 9)
    assert.deepEqual(current.sources.map(row => [row.available, row.spent]), [[0, 0], [20, 0]])
    assert.equal(current.untracked, 50)
    await assert.rejects(sourceReturn(f, db, 1, 1, 'return:source:again'), /剩余可冲回奖励不足/)
    await assert.rejects(sourceReturn(f, db, 99, 1, 'return:legacy:99'), /剩余可冲回奖励不足/)
    for (const delta of [-1, 1]) await assert.rejects(award(f, db, 1, delta), { code: 'POINTS_AFTERSALE_SOURCE_LOCKED' })
  })
})

test('先退抵扣商品恢复原来源，返还可再次消费，随后退来源只追回当前尚在使用的优惠', async () => {
  const f = fixture()
  await f.transaction(async db => {
    await award(f, db, 1, 6)
    await consume(f, db, 101, 6)
    const restored = await itemReturn(f, db, 101, 4, 'return:item:part')
    assert.equal(restored.points_delta, 4)
    assert.equal(restored.compensation_cents, 0)
    await consume(f, db, 102, 3)
    assert.equal((await f.service.state(db, 9)).tracked, 1)
    const recovery = await sourceReturn(f, db, 1, 6, 'return:source:all')
    assert.equal(recovery.points_delta, -1)
    assert.equal(recovery.recovery_cents, 5)
    const returned = await itemReturn(f, db, 101, 2, 'return:item:rest')
    assert.equal(returned.points_delta, 0)
    assert.equal(returned.compensation_cents, 2)
    const second = await itemReturn(f, db, 102, 3, 'return:second:all')
    assert.equal(second.compensation_cents, 3)
    assert.equal((await f.service.state(db, 9)).tracked, 0)
  })
  assert.equal(f.state.entries.length, 3, '返分不伪造新奖励或更改原分配')
})

test('来源退回后再退抵扣商品，已追回部分补退现金、其余恢复积分，不重发已撤销奖励', async () => {
  const f = fixture()
  await f.transaction(async db => {
    await award(f, db, 1, 3)
    await award(f, db, 2, 3)
    await consume(f, db, 101, 6)
    assert.equal((await sourceReturn(f, db, 1, 3, 'source:all:1')).recovery_cents, 3)
    const first = await itemReturn(f, db, 101, 4, 'item:first:4')
    assert.equal(first.points_delta, 1)
    assert.equal(first.compensation_cents, 3)
    const second = await itemReturn(f, db, 101, 2, 'item:second:2')
    assert.equal(second.points_delta, 2)
    assert.equal(second.compensation_cents, 0)
    assert.equal((await f.service.state(db, 9)).tracked, 3)
    assert.equal((await sourceReturn(f, db, 2, 3, 'source:all:2')).recovery_cents, 0)
    assert.equal((await f.service.state(db, 9)).tracked, 0)
  })
})

test('不同来源的33/33/34分原分摊保持，先退来源后退商品补回原33分，兑换配置无参与', async () => {
  const f = fixture()
  await f.transaction(async db => {
    for (let id = 1; id <= 3; id++) await award(f, db, id, 1)
    await consume(f, db, 101, 3, 3)
    assert.equal((await sourceReturn(f, db, 1, 1, 'source:first:1')).recovery_cents, 33)
    assert.equal((await sourceReturn(f, db, 3, 1, 'source:third:1')).recovery_cents, 34)
    const returned = await itemReturn(f, db, 101, 3, 'item:all:101')
    assert.equal(returned.points_delta, 1)
    assert.equal(returned.compensation_cents, 67)
    assert.equal((await f.service.state(db, 9)).tracked, 1)
    const recovery = await sourceReturn(f, db, 2, 1, 'source:second:1')
    assert.equal(recovery.recovery_cents, 0)
    assert.equal(recovery.points_delta, -1)
  })
})

test('跨来源部分追回按原全局分币位置：同一分配内分次追回累计不丢尾差', async () => {
  const f = fixture()
  await f.transaction(async db => {
    await award(f, db, 1, 1)
    await award(f, db, 2, 2)
    await consume(f, db, 101, 3, 3)
    const first = await sourceReturn(f, db, 2, 1, 'source:second:a')
    const second = await sourceReturn(f, db, 2, 1, 'source:second:b')
    assert.deepEqual([first.recovery_cents, second.recovery_cents], [33, 34])
    assert.equal((await itemReturn(f, db, 101, 3, 'item:101:all')).compensation_cents, 67)
    assert.equal((await f.service.state(db, 9)).tracked, 1)
  })
})

const permutations = values => values.length ? values.flatMap((value, index) =>
  permutations(values.filter((_, i) => i !== index)).map(rest => [value, ...rest])) : [[]]
test('两次部分退来源与两次部分退抵扣商品的24种办理顺序，余额及净追回金额一致', async () => {
  for (const order of permutations(['a1', 'a2', 'r1', 'r2'])) {
    const f = fixture()
    let recovered = 0, compensated = 0
    await f.transaction(async db => {
      await award(f, db, 1, 6)
      await consume(f, db, 101, 6)
      for (const operation of order) {
        const result = operation.startsWith('a') ? await sourceReturn(f, db, 1, 3, `source:${operation}`)
          : await itemReturn(f, db, 101, 3, `return:${operation}`)
        recovered += result.recovery_cents; compensated += result.compensation_cents
        await f.service.state(db, 9)
      }
    })
    assert.equal(f.state.customers[9], 0, order.join(','))
    assert.equal(recovered - compensated, 0, order.join(','))
  }
})

test('同一来源先后用于不同兑换比例，追回使用各笔原抵扣金额并可逐笔补退', async () => {
  const f = fixture()
  await f.transaction(async db => {
    await award(f, db, 1, 6)
    await consume(f, db, 101, 3, 3)
    await consume(f, db, 102, 3, 1)
    assert.equal((await sourceReturn(f, db, 1, 6, 'source:all:1')).recovery_cents, 400)
    assert.equal((await itemReturn(f, db, 102, 3, 'return:102:all')).compensation_cents, 300)
    assert.equal((await itemReturn(f, db, 101, 3, 'return:101:all')).compensation_cents, 100)
    assert.equal((await f.service.state(db, 9)).tracked, 0)
  })
})

test('一个来源用于多笔大额抵扣时，追回合计可超过单笔销售金额上限且仍精确到分', async () => {
  const f = fixture()
  await f.transaction(async db => {
    await award(f, db, 1, 199999998)
    await consume(f, db, 101, 99999999, 1)
    await consume(f, db, 102, 99999999, 1)
    const returned = await sourceReturn(f, db, 1, 199999998, 'source:large:all')
    assert.equal(returned.recovery_cents, 19999999800)
    assert.equal((await f.service.state(db, 9)).tracked, 0)
    assert.equal((await itemReturn(f, db, 101, 99999999, 'return:large:101')).compensation_cents, 9999999900)
    assert.equal((await f.service.state(db, 9)).tracked, 0)
  })
})

test('同键重试返回原凭据、不改余额；换内容或客户冲突，其他键不能超额返还', async () => {
  const f = fixture()
  let first
  await f.transaction(async db => {
    await award(f, db, 1, 3)
    await consume(f, db, 101, 3)
    first = await itemReturn(f, db, 101, 3, 'return:101:all')
  })
  const before = structuredClone(f.state)
  await f.transaction(async db => {
    assert.deepEqual(await itemReturn(f, db, 101, 3, 'return:101:all'), first)
    await assert.rejects(itemReturn(f, db, 101, 2, 'return:101:all'), { code: 'POINTS_AFTERSALE_REQUEST_CONFLICT' })
    await assert.rejects(f.service.returnRedemption(db, { customerId: 10, itemId: 101, points: 3, requestKey: 'return:101:all' }),
      { code: 'POINTS_AFTERSALE_REQUEST_CONFLICT' })
    await assert.rejects(itemReturn(f, db, 101, 1, 'return:101:again'), /剩余可返还/)
  })
  assert.deepEqual(f.state, before)
})

for (const fail of ['balance', 'aftersale', 'outer']) test(`${fail}失败随退款外层事务回滚，重试后仅一条售后凭据`, async () => {
  const f = fixture()
  await f.transaction(async db => { await award(f, db, 1, 3); await consume(f, db, 101, 3) })
  const before = structuredClone(f.state)
  f.failAt(fail)
  await assert.rejects(f.transaction(async db => {
    await itemReturn(f, db, 101, 3, 'return:101:all')
    if (fail === 'outer') throw new Error('refund-record-failed')
  }))
  assert.deepEqual(f.state, before)
  f.failAt('')
  await f.transaction(db => itemReturn(f, db, 101, 3, 'return:101:all'))
  assert.equal(f.state.aftersales.length, 1)
  assert.equal((await state(f)).tracked, 3)
})

test('两个并发模拟退同一抵扣不能重复返分，返还与消费共用客户锁后状态守恒', async () => {
  const f = fixture()
  await f.transaction(async db => { await award(f, db, 1, 3); await consume(f, db, 101, 3) })
  const results = await Promise.allSettled(['return:a', 'return:b'].map(key => f.transaction(db => itemReturn(f, db, 101, 3, key))))
  assert.equal(results.filter(row => row.status === 'fulfilled').length, 1)
  assert.equal(f.state.customers[9], 3)
  await Promise.all([
    f.transaction(db => sourceReturn(f, db, 1, 1, 'source:part:1')),
    f.transaction(db => consume(f, db, 102, 2))
  ])
  assert.equal((await state(f)).tracked, 0)
  assert.equal((await state(f)).sources[0].spent, 2)
})

test('未安装售后表保持旧累计与消费，售后明确拒绝；余额上限和非法参数拒绝', async () => {
  const orphan = new CustomerPointsLedgerService({ tableExists: async name => name === 'customer_points_aftersales' })
  await assert.rejects(orphan.ready({ execute() { assert.fail('结构不全时不能读写积分') } }), { code: 'POINTS_LEDGER_SCHEMA_INCOMPLETE' })
  const missing = fixture({ aftersalesInstalled: false })
  await missing.transaction(async db => {
    await award(missing, db, 1, 3)
    await consume(missing, db, 101, 3)
    await assert.rejects(itemReturn(missing, db, 101, 3, 'return:101:all'), { code: 'POINTS_AFTERSALE_NOT_READY' })
  })
  const f = fixture()
  await f.transaction(async db => {
    await award(f, db, 1, 3)
    await consume(f, db, 101, 3, 3)
    await award(f, db, 2, 2147483647)
    await assert.rejects(itemReturn(f, db, 101, 3, 'return:101:all'), /超出范围/)
    await assert.rejects(itemReturn(f, db, 101, 1, 'return:101:part'), /精确兑换/)
    for (const points of [0, -1, 1.2, '3', 2147483648]) await assert.rejects(itemReturn(f, db, 101, points, 'return:invalid'), { statusCode: 400 })
    await assert.rejects(itemReturn(f, db, 101, 3, 'bad key'), { statusCode: 400 })
  })
})

test('损坏的原分配和售后区间/金额不按当前规则猜测修复', async () => {
  const setup = async () => {
    const f = fixture()
    await f.transaction(async db => {
      await award(f, db, 1, 3)
      await consume(f, db, 101, 3)
      await sourceReturn(f, db, 1, 2, 'source:part:1')
      await itemReturn(f, db, 101, 3, 'return:101:all')
    })
    return f
  }
  for (const corrupt of [
    f => { f.state.allocations[0].amount_cents++ },
    f => { f.state.aftersales[0].amount_cents++ },
    f => { f.state.aftersales[1].balance_delta++ },
    f => { const row = f.state.aftersales[0]; const parsed = JSON.parse(row.allocation_snapshot); parsed.ranges[0].start++; row.allocation_snapshot = JSON.stringify(parsed) },
    f => { f.state.aftersales[1].allocation_snapshot = '{broken' },
    f => { f.state.aftersales.push({ ...f.state.aftersales[0], id: 3, request_key: 'source:duplicate' }) }
  ]) {
    const f = await setup()
    corrupt(f)
    await assert.rejects(state(f), { code: 'POINTS_AFTERSALE_FACTS_CONFLICT' })
  }
})
