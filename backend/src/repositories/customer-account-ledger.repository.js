'use strict'

const BaseRepository = require('./base.repository')

class CustomerAccountLedgerRepository extends BaseRepository {
  constructor () { super('customer_account_entries') }

  async list (executor, customerId, kind, limit = 100, includeAftersales = false, includePhoneReturnOperator = false) {
    const pointsEntries = `SELECT id, customer_id, 'points' AS kind, points AS delta, balance_after, balance_after AS points_after,
        source_type, source_id,
        CASE
          WHEN source_type = 'phone_sale' AND EXISTS (
            SELECT 1 FROM sales_order_items soi
            WHERE (soi.sale_id = customer_points_entries.source_id OR soi.linked_phone_sale_id = customer_points_entries.source_id)
              AND soi.item_type = 'accessory'
          ) THEN '购买手机+商品（自动生成）'
          WHEN source_type = 'phone_sale' THEN COALESCE(JSON_UNQUOTE(JSON_EXTRACT(source_snapshot, '$.reason')), '购买手机（自动生成）')
          WHEN source_type = 'checkout_item' THEN COALESCE(JSON_UNQUOTE(JSON_EXTRACT(source_snapshot, '$.reason')), '购买商品（自动生成）')
          WHEN source_type = 'opening_balance' THEN '历史期初'
          WHEN source_type = 'manual_adjustment' THEN COALESCE(JSON_UNQUOTE(JSON_EXTRACT(source_snapshot, '$.reason')), '人工调整')
          ELSE COALESCE(JSON_UNQUOTE(JSON_EXTRACT(source_snapshot, '$.reason')), entry_type)
        END AS note,
        COALESCE(
          (SELECT a.actor_user_id FROM customer_account_entries a
            WHERE a.customer_id = customer_points_entries.customer_id AND a.kind = 'points'
              AND a.source_id = customer_points_entries.id LIMIT 1),
          CAST(JSON_UNQUOTE(JSON_EXTRACT(source_snapshot, '$.operator_id')) AS UNSIGNED),
          CASE WHEN source_type = 'phone_sale' THEN
            (SELECT s.operator_id FROM sales s WHERE s.id = customer_points_entries.source_id LIMIT 1)
          END
        ) AS actor_user_id,
        created_at
      FROM customer_points_entries WHERE customer_id = ? AND (? IS NULL OR ? = 'points')`
    const phoneReturnOperator = includePhoneReturnOperator ? `CASE WHEN operation_type = 'award_return' AND source_type = 'phone_sale' THEN (
            SELECT a.created_by FROM sales_order_items soi
            JOIN sales_aftersale_items sai ON sai.original_item_id = soi.id
            JOIN sales_aftersales a ON a.id = sai.aftersale_id AND a.operation_type = 'phone_return'
            WHERE soi.sale_id = customer_points_aftersales.source_id AND soi.item_type = 'phone'
            ORDER BY a.id DESC LIMIT 1
          ) END` : 'NULL'
    const aftersales = includeAftersales ? ` UNION ALL
      SELECT id, customer_id, 'points' AS kind, balance_delta AS delta, balance_after, balance_after AS points_after,
        CASE WHEN operation_type = 'award_return' AND source_type = 'phone_sale' THEN 'phone_return'
          WHEN operation_type = 'award_return' THEN 'checkout_return' ELSE 'checkout_return' END AS source_type,
        source_id,
        COALESCE(JSON_UNQUOTE(JSON_EXTRACT(allocation_snapshot, '$.reason')),
          CASE WHEN operation_type = 'award_return' AND source_type = 'phone_sale' THEN '手机退货'
            WHEN operation_type = 'award_return' THEN '商品退货' ELSE '商品退货返还抵扣积分' END) AS note,
        COALESCE(
          CAST(JSON_UNQUOTE(JSON_EXTRACT(allocation_snapshot, '$.operator_id')) AS UNSIGNED),
          ${phoneReturnOperator}
        ) AS actor_user_id,
        created_at
      FROM customer_points_aftersales WHERE customer_id = ? AND (? IS NULL OR ? = 'points')` : ''
    const params = [customerId, kind, kind]
    if (includeAftersales) params.push(customerId, kind, kind)
    params.push(limit)
    const [rows] = await executor.execute(`SELECT entries.*, COALESCE(u.name, u.username) AS operator_name FROM (
      SELECT id, customer_id, kind, delta, balance_after, points_after, source_type, source_id, note, actor_user_id, created_at
      FROM customer_account_entries WHERE customer_id = ? AND kind = 'balance' AND (? IS NULL OR kind = ?)
      UNION ALL
      ${pointsEntries}${aftersales}
      ) entries LEFT JOIN users u ON u.id = entries.actor_user_id ORDER BY created_at DESC, id DESC LIMIT ?`, [customerId, kind, kind, ...params])
    return rows
  }

  async append (executor, row) {
    const [result] = await executor.execute(`INSERT INTO customer_account_entries
      (customer_id, kind, delta, balance_after, points_after, source_type, source_id, note, actor_user_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`, [row.customer_id, row.kind, row.delta, row.balance_after,
      row.points_after, row.source_type, row.source_id, row.note, row.actor_user_id])
    return result.insertId
  }

  async linkPointEntry (executor, id, pointEntryId) {
    await executor.execute("UPDATE customer_account_entries SET source_id = ? WHERE id = ? AND kind = 'points'", [pointEntryId, id])
  }
}

module.exports = CustomerAccountLedgerRepository
