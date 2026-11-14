'use strict'

const assert = require('node:assert/strict')
const CustomerPointsLedgerService = require('../../src/services/customer-points-ledger.service')

/** 同连接SQL替身，可挂接销售夹具，余额/来源/分配随调用方事务一起回滚。 */
const ledgerExecutor = ({ getState, isActive, getFailure = () => '', onWrite = () => {}, installed = true }) => {
  return { async execute(sql, params = []) {
    const state = getState()
    const fail = getFailure()
    if (sql.includes('information_schema.TABLES')) return [installed ? [{ present: 1 }] : []]
    if (sql.includes('information_schema.COLUMNS')) return [[{ present: 1 }]]
    assert.equal(isActive(), true, '积分SQL必须使用外层事务连接')
    if (sql.includes('FROM customers WHERE id = ? FOR UPDATE')) return [[state.customers[params[0]] === undefined ? null : { id: params[0], points: state.customers[params[0]] }].filter(Boolean)]
    if (sql.includes("AND entry_type = 'award'")) {
      assert.match(sql, /FOR UPDATE/)
      return [state.entries.filter(row => row.customer_id === params[0] && row.entry_type === 'award').map(row => ({ ...row }))]
    }
    if (sql.includes('JOIN customer_points_entries c')) {
      assert.match(sql, /FOR UPDATE/)
      return [state.allocations.filter(row => state.entries.find(entry => entry.id === row.credit_entry_id)?.customer_id === params[0])
        .map(row => {
          const debit = state.entries.find(entry => entry.id === row.debit_entry_id)
          return { ...row, entry_type: debit?.entry_type, debit_customer_id: debit?.customer_id,
            redemption_item_id: debit?.redemption_item_id, debit_points: debit?.points,
            debit_amount_cents: debit?.amount_cents, points_per_yuan: debit?.points_per_yuan }
        })]
    }
    if (sql.includes('FROM customer_points_aftersales')) {
      assert.match(sql, /FOR UPDATE/)
      return [(state.aftersales || []).filter(row => sql.includes('WHERE request_key = ?')
        ? row.request_key === params[0] : row.customer_id === params[0]).map(row => ({ ...row }))]
    }
    if (sql.includes('INSERT INTO customer_points_aftersales')) {
      if (fail === 'aftersale') throw new Error('aftersale-failed')
      const fields = ['request_key', 'request_hash', 'customer_id', 'operation_type', 'source_type', 'source_id', 'points',
        'balance_delta', 'amount_cents', 'balance_after', 'allocation_snapshot']
      state.aftersales ||= []
      const row = { id: state.aftersales.length + 1, ...Object.fromEntries(fields.map((field, index) => [field, params[index]])) }
      if (state.aftersales.some(entry => entry.request_key === row.request_key)) throw Object.assign(new Error('duplicate-aftersale'), { code: 'ER_DUP_ENTRY' })
      state.aftersales.push(row); onWrite()
      return [{ insertId: row.id }]
    }
    if (sql.includes('WHERE redemption_item_id = ?')) return [state.entries.filter(row => row.redemption_item_id === params[0]).map(row => ({ ...row }))]
    if (sql.startsWith('UPDATE customers SET points = ?')) {
      if (fail === 'balance') return [{ affectedRows: 0 }]
      const [after, customerId, before] = params
      if (state.customers[customerId] !== before) return [{ affectedRows: 0 }]
      state.customers[customerId] = after; onWrite()
      return [{ affectedRows: 1 }]
    }
    if (sql.includes('INSERT INTO customer_points_entries')) {
      if (fail === 'entry') throw new Error('entry-failed')
      const fields = ['customer_id', 'entry_type', 'source_type', 'source_id', 'points', 'untracked_points', 'balance_after', 'amount_cents', 'points_per_yuan', 'redemption_item_id', 'source_snapshot']
      const row = { id: state.entries.length + 1, ...Object.fromEntries(fields.map((field, index) => [field, params[index]])) }
      if (row.redemption_item_id && state.entries.some(entry => entry.redemption_item_id === row.redemption_item_id)) throw Object.assign(new Error('duplicate-redemption'), { code: 'ER_DUP_ENTRY' })
      state.entries.push(row); onWrite()
      return [{ insertId: row.id }]
    }
    if (sql.includes('INSERT INTO customer_points_allocations')) {
      if (fail === 'allocation') throw new Error('allocation-failed')
      const [debit_entry_id, credit_entry_id, points, amount_cents] = params
      state.allocations.push({ id: state.allocations.length + 1, debit_entry_id, credit_entry_id, points, amount_cents }); onWrite()
      return [{ insertId: state.allocations.length }]
    }
    if (sql.includes('SELECT id, customer_id, points_awarded, points_accounted_at')) return [[state.sales[params[0]]].filter(Boolean).map(row => ({ ...row }))]
    if (sql.includes('UPDATE sales') && sql.includes('SET points_awarded = ?')) {
      state.sales[params[1]].points_awarded = params[0]
      state.sales[params[1]].points_accounted_at = '2026-11-13 10:00:00'
      onWrite()
      return [{ affectedRows: 1 }]
    }
    throw new Error(`未处理的积分测试SQL：${sql}`)
  } }
}

/** 实际积分仓储与服务的事务替身；外层回滚同时还原余额、来源及分配。 */
module.exports = function fixture({ initialPoints = 0, installed = true, aftersalesInstalled = true } = {}) {
  let state = { customers: { 9: initialPoints, 10: 0 }, entries: [], allocations: [], sales: {} }
  let active = false, fail = '', writes = 0, mutex = Promise.resolve()
  const db = ledgerExecutor({ getState: () => state, isActive: () => active, getFailure: () => fail, onWrite: () => { writes++ }, installed })
  const service = new CustomerPointsLedgerService({ tableExists: async name => installed && (name !== 'customer_points_aftersales' || aftersalesInstalled) })
  return {
    db, service, get state() { return state }, get writes() { return writes },
    failAt(value) { fail = value },
    async transaction(operation) {
      const previous = mutex
      let release
      mutex = new Promise(resolve => { release = resolve })
      await previous
      const before = structuredClone(state)
      active = true
      try { return await operation(db) }
      catch (error) { state = before; throw error }
      finally { active = false; release() }
    }
  }
}

module.exports.ledgerExecutor = ledgerExecutor
