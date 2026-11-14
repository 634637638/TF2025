'use strict'

/** 所有查询使用积分调用方已持有的事务连接；来源ID不设置删除级联，保留原单追溯。 */
class CustomerPointsLedgerRepository {
  async customer(executor, id) {
    const [rows] = await executor.execute('SELECT id, points FROM customers WHERE id = ? FOR UPDATE', [id])
    return rows[0] || null
  }

  async credits(executor, customerId) {
    const [rows] = await executor.execute(`SELECT id, source_type, source_id, points
      FROM customer_points_entries WHERE customer_id = ? AND entry_type = 'award' ORDER BY id FOR UPDATE`, [customerId])
    return rows
  }

  async allocations(executor, customerId) {
    // 当前锁定读，避免RR事务在等待客户锁之前建立的旧快照漏掉刚提交的消费。
    const [rows] = await executor.execute(`SELECT a.id, a.debit_entry_id, a.credit_entry_id, a.points, a.amount_cents,
      e.entry_type, e.customer_id AS debit_customer_id, e.redemption_item_id,
      e.points AS debit_points, e.amount_cents AS debit_amount_cents, e.points_per_yuan
      FROM customer_points_allocations a
      JOIN customer_points_entries c ON c.id = a.credit_entry_id
      JOIN customer_points_entries e ON e.id = a.debit_entry_id
      WHERE c.customer_id = ? ORDER BY a.id FOR UPDATE`, [customerId])
    return rows
  }

  async aftersales(executor, customerId) {
    const [rows] = await executor.execute(`SELECT id, request_key, request_hash, customer_id, operation_type,
      source_type, source_id, points, balance_delta, amount_cents, balance_after, allocation_snapshot
      FROM customer_points_aftersales WHERE customer_id = ? ORDER BY id FOR UPDATE`, [customerId])
    return rows
  }

  async aftersaleRequest(executor, key) {
    const [rows] = await executor.execute(`SELECT id, request_key, request_hash, customer_id, operation_type,
      source_type, source_id, points, balance_delta, amount_cents, balance_after, allocation_snapshot
      FROM customer_points_aftersales WHERE request_key = ? FOR UPDATE`, [key])
    return rows[0] || null
  }

  async appendAftersale(executor, row) {
    const [result] = await executor.execute(`INSERT INTO customer_points_aftersales
      (request_key, request_hash, customer_id, operation_type, source_type, source_id, points,
       balance_delta, amount_cents, balance_after, allocation_snapshot, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
    [row.request_key, row.request_hash, row.customer_id, row.operation_type, row.source_type, row.source_id,
      row.points, row.balance_delta, row.amount_cents, row.balance_after, JSON.stringify(row.allocation_snapshot)])
    return result.insertId
  }

  async redemption(executor, itemId) {
    const [rows] = await executor.execute(`SELECT id, customer_id, points, amount_cents, points_per_yuan, balance_after
      FROM customer_points_entries WHERE redemption_item_id = ? FOR UPDATE`, [itemId])
    return rows[0] || null
  }

  async setBalance(executor, customerId, before, after) {
    const [result] = await executor.execute(`UPDATE customers SET points = ?, updated_at = NOW()
      WHERE id = ? AND points = ?`, [after, customerId, before])
    if (result.affectedRows !== 1) throw Object.assign(new Error('客户积分已变化，请重新核对'), { statusCode: 409, code: 'POINTS_BALANCE_CHANGED' })
  }

  async append(executor, row) {
    const [result] = await executor.execute(`INSERT INTO customer_points_entries
      (customer_id, entry_type, source_type, source_id, points, untracked_points, balance_after,
       amount_cents, points_per_yuan, redemption_item_id, source_snapshot, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
    [row.customer_id, row.entry_type, row.source_type, row.source_id, row.points, row.untracked_points || 0,
      row.balance_after, row.amount_cents ?? null, row.points_per_yuan ?? null, row.redemption_item_id ?? null,
      JSON.stringify(row.source_snapshot || {})])
    return result.insertId
  }

  async allocate(executor, row) {
    await executor.execute(`INSERT INTO customer_points_allocations
      (debit_entry_id, credit_entry_id, points, amount_cents, created_at) VALUES (?, ?, ?, ?, NOW())`,
    [row.debit_entry_id, row.credit_entry_id, row.points, row.amount_cents ?? null])
  }
}

module.exports = CustomerPointsLedgerRepository
