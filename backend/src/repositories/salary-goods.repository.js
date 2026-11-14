'use strict'

const { getDatabase } = require('../config/database')
const { withConnection } = require('../core/db/connection')

/** 工资核对只读原成交/售后凭据，不读取当前商品、员工模板或库存余额。 */
class SalaryGoodsRepository {
  constructor({ database = getDatabase } = {}) { this.database = database }
  withConnection(operation) { return withConnection(this.database, operation) }

  async items(connection, employeeId, through, afterId, batchSize) {
    const [rows] = await connection.execute(`SELECT i.id AS item_id, i.order_id, i.accessory_id, i.accessory_sale_id,
      i.quantity, i.unit_price, i.total_amount, i.purchase_cost, i.points_awarded, i.snapshot,
      i.created_at AS item_time, o.order_no, o.store_id, o.customer_id, o.operator_id AS order_operator_id,
      o.order_date AS order_time, o.created_at AS recorded_at,
      s.id AS source_sale_id, s.accessory_id AS sale_accessory_id, s.customer_id AS sale_customer_id,
      s.store_id AS sale_store_id, s.quantity AS sale_quantity, s.unit_price AS sale_unit_price,
      s.total_price AS sale_total_price, s.purchase_cost AS sale_purchase_cost, s.sale_type,
      s.operator_id AS sale_operator_id, s.sale_time
      FROM sales_order_items i JOIN sales_orders o ON o.id = i.order_id
      LEFT JOIN accessory_sales s ON s.id = i.accessory_sale_id
      WHERE i.item_type = 'accessory' AND o.request_key IS NOT NULL AND o.order_status = 'completed'
        AND (s.operator_id = ? OR JSON_UNQUOTE(JSON_EXTRACT(i.snapshot, '$.commission.employee_id')) = ?)
        AND i.created_at <= ? AND o.created_at <= ? AND i.id > ?
      ORDER BY i.id LIMIT ?`, [employeeId, String(employeeId), through, through, afterId, batchSize])
    return rows
  }

  async returns(connection, itemIds) {
    if (!itemIds.length) return []
    const [rows] = await connection.execute(`SELECT i.id AS aftersale_item_id, i.original_item_id, i.aftersale_id,
      i.quantity, i.fact_snapshot, a.id AS source_aftersale_id, a.operation_type,
      a.business_time, a.created_at AS recorded_at
      FROM sales_aftersale_items i LEFT JOIN sales_aftersales a ON a.id = i.aftersale_id
      WHERE i.original_item_id IN (${itemIds.map(() => '?').join(',')}) ORDER BY i.id`, itemIds)
    return rows
  }
}

module.exports = SalaryGoodsRepository
