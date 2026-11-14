'use strict'

/** 仅使用工资编排持有的事务连接；不自行发放工资、建表或打开额外连接。 */
class SalaryGoodsSettlementRepository {
  async employeeClaims(connection, employeeId, afterId, batchSize) {
    const [rows] = await connection.execute(`SELECT l.id, l.employee_id, l.salary_record_id, l.original_salary_record_id,
      l.source_key, l.source_hash, l.amount_cents, l.source_snapshot, l.created_at
      FROM salary_goods_settlements l LEFT JOIN salary_records sr ON sr.id = l.salary_record_id
      WHERE (l.employee_id = ? OR sr.employee_id = ?) AND l.id > ? ORDER BY l.id LIMIT ?`,
    [employeeId, employeeId, afterId, batchSize])
    return rows
  }

  async sourceClaims(connection, keys) {
    if (!keys.length) return []
    const [rows] = await connection.execute(`SELECT id, employee_id, salary_record_id, original_salary_record_id,
      source_key, source_hash, amount_cents, source_snapshot, created_at FROM salary_goods_settlements
      WHERE source_key IN (${keys.map(() => '?').join(',')}) ORDER BY id`, keys)
    return rows
  }

  async records(connection, employeeId, afterId, batchSize) {
    const [rows] = await connection.execute(`SELECT sr.id, sr.employee_id, sr.period_start, sr.period_end,
      sr.status, sr.paid_at, sr.commission_amount, sr.net_salary, sr.goods_commission_snapshot FROM salary_records sr
      WHERE ((sr.employee_id = ? AND sr.goods_commission_snapshot IS NOT NULL) OR EXISTS (
        SELECT 1 FROM salary_goods_settlements l WHERE l.salary_record_id = sr.id AND l.employee_id = ?))
        AND sr.id > ? ORDER BY sr.id LIMIT ?`, [employeeId, employeeId, afterId, batchSize])
    return rows
  }

  async append(connection, recordId, employeeId, entry, paidAt) {
    const [result] = await connection.execute(`INSERT INTO salary_goods_settlements
      (employee_id, salary_record_id, original_salary_record_id, source_key, source_hash, amount_cents, source_snapshot, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [employeeId, recordId,
      entry.kind === 'return' ? entry.original_salary_record_id ?? recordId : null,
      entry.source_key, entry.source_hash, entry.amount_cents, JSON.stringify(entry), paidAt])
    return result.affectedRows
  }
}

module.exports = SalaryGoodsSettlementRepository
