const assert = require('node:assert/strict')
const test = require('node:test')
const { buildMonthlyLeaveBalances } = require('../src/utils/leave-balance')

test('跨月申请可使用两个月额度且余额逐月结转', () => {
  const balances = buildMonthlyLeaveBalances({
    monthlyLimit: 2,
    monthlyUsage: {
      '2026-08': { paidUsed: 2 },
      '2026-09': { paidUsed: 2 }
    },
    startDate: '2026-10-31',
    endDate: '2026-11-04'
  })

  assert.deepEqual(balances.filter(item => item.month >= '2026-10').map(item => [item.month, item.available]), [
    ['2026-10', 2],
    ['2026-11', 4]
  ])
})

test('带薪休假占用额度，上月无薪请假不结转', () => {
  const balances = buildMonthlyLeaveBalances({
    monthlyLimit: 2,
    monthlyUsage: {
      '2026-09': { paidUsed: 2, unpaidUsed: 1 },
      '2026-10': { paidUsed: 1 }
    },
    startDate: '2026-10-31',
    endDate: '2026-11-01'
  })

  assert.equal(balances.find(item => item.month === '2026-10').available, 1)
  assert.equal(balances.find(item => item.month === '2026-11').available, 3)
})

test('超过两个月的未用额度过期，累计不超过两个月配额', () => {
  const balances = buildMonthlyLeaveBalances({
    monthlyLimit: 2,
    monthlyUsage: {},
    startDate: '2026-11-01',
    endDate: '2026-11-01'
  })

  assert.equal(balances.find(item => item.month === '2026-11').available, 4)
})

test('模板每月额度为5天时，两个月最多10天', () => {
  const balances = buildMonthlyLeaveBalances({
    monthlyLimit: 5,
    monthlyUsage: {},
    startDate: '2026-11-01',
    endDate: '2026-11-01'
  })

  const current = balances.find(item => item.month === '2026-11')
  assert.equal(current.available, 10)
  assert.equal(current.quota, 10)
})

test('先消耗即将过期的结转额度，保留当月额度继续结转', () => {
  const balances = buildMonthlyLeaveBalances({
    monthlyLimit: 2,
    monthlyUsage: {
      '2026-09': { paidUsed: 1 },
      '2026-10': { paidUsed: 1 }
    },
    startDate: '2026-11-01',
    endDate: '2026-11-01'
  })

  const november = balances.find(item => item.month === '2026-11')
  assert.equal(november.carry_in, 2)
  assert.equal(november.available, 4)
})

test('上月存在无薪请假时不结转上月余额，本月额度仍有效', () => {
  const balances = buildMonthlyLeaveBalances({
    monthlyLimit: 2,
    monthlyUsage: {
      '2026-09': { paidUsed: 1, unpaidUsed: 1 }
    },
    startDate: '2026-10-01',
    endDate: '2026-10-01'
  })

  const october = balances.find(item => item.month === '2026-10')
  assert.equal(october.carry_in, 0)
  assert.equal(october.available, 2)
})

test('案例A：9月无休假，10月1日至4日均为带薪休假', () => {
  const balances = buildMonthlyLeaveBalances({
    monthlyLimit: 2,
    monthlyUsage: { '2026-10': { paidUsed: 4 } },
    startDate: '2026-10-01',
    endDate: '2026-11-01'
  })

  const october = balances.find(item => item.month === '2026-10')
  const november = balances.find(item => item.month === '2026-11')
  assert.equal(october.quota, 4)
  assert.equal(october.available, 0)
  assert.equal(november.available, 2)
})

test('案例B：9月无休假，10月31日至11月3日均可带薪休假', () => {
  const balances = buildMonthlyLeaveBalances({
    monthlyLimit: 2,
    monthlyUsage: {
      '2026-10': { paidUsed: 1 },
      '2026-11': { paidUsed: 3 }
    },
    startDate: '2026-10-31',
    endDate: '2026-11-03'
  })

  const november = balances.find(item => item.month === '2026-11')
  assert.equal(november.quota, 4)
  assert.equal(november.paid_used, 3)
  assert.equal(november.available, 1)
})
