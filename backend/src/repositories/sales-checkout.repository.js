'use strict'

const { getActiveSaleSql, getLatestActiveSaleIdSql } = require('../utils/sale-status')

const { getDatabase } = require('../config/database')
const { withConnection } = require('../core/db/connection')
const { appendStoreScopeCondition } = require('../utils/store-scope')

class SalesCheckoutRepository {
  constructor({ database = getDatabase } = {}) { this.database = database }
  withConnection(operation) { return withConnection(this.database, operation) }

  async findRequest(connection, key) {
    const [rows] = await connection.execute('SELECT id, created_by, store_id, request_hash, checkout_result FROM sales_orders WHERE request_key = ? FOR UPDATE', [key])
    return rows[0] || null
  }
  async validStore(connection, id) {
    const [rows] = await connection.execute('SELECT id FROM stores WHERE id = ? AND status = 1', [id])
    return rows.length === 1
  }
  async seller(connection, id) {
    const [rows] = await connection.execute('SELECT id, name, username, salary_template_id FROM users WHERE id = ? AND status = 1', [id])
    const seller = rows[0]
    if (!seller) return null
    if (!seller.salary_template_id) return { ...seller, salary_template_id: null, goods_commission_rule: null }
    // SELECT *允许尚未升级商品提成字段的环境继续销售；只投影本业务需要的规则，不外传工资资料。
    const [templates] = await connection.execute('SELECT st.* FROM salary_templates st WHERE st.id = ?', [seller.salary_template_id])
    if (!templates.length) throw Object.assign(new Error('销售员关联的工资模板不存在，请先核对员工资料'), { statusCode: 409, code: 'GOODS_COMMISSION_CONFLICT' })
    return { ...seller, goods_commission_rule: templates[0].goods_commission_rule ?? null }
  }
  async customerByPhone(connection, phone) {
    const [rows] = await connection.execute('SELECT id, points FROM customers WHERE phone = ? FOR UPDATE', [phone])
    return rows[0] || null
  }
  async lockCustomer(connection, id, { lock = true } = {}) {
    const [rows] = await connection.execute(`SELECT id, points FROM customers WHERE id = ?${lock ? ' FOR UPDATE' : ''}`, [id])
    return rows[0] || null
  }
  async returnChecklist(orderId, saleId, scope) {
    const conditions = ['o.id = ?', 'o.request_key IS NOT NULL', "o.order_status = 'completed'", "p.status = 'sold'",
      `s.id = (${getLatestActiveSaleIdSql('p', 'current_sale')})`]
    const params = [saleId, orderId]
    appendStoreScopeCondition(scope, 'o.store_id', conditions, params)
    return this.withConnection(async connection => {
      const [rows] = await connection.execute(`SELECT o.id AS order_id, o.order_no, o.store_id,
        pi.id AS phone_item_id, pi.sale_id, pi.phone_id, pi.quantity AS phone_quantity,
        pi.total_amount AS phone_amount, pi.points_awarded AS phone_points,
        i.id AS item_id, i.order_id AS goods_order_id, i.accessory_id, i.accessory_sale_id, i.quantity, i.unit_price, i.total_amount, i.purchase_cost, i.points_awarded, i.snapshot,
        gs.operator_id AS sale_operator_id
        FROM sales_orders o
        JOIN sales_order_items pi ON pi.order_id = o.id AND pi.item_type = 'phone' AND pi.sale_id = ?
        JOIN sales s ON s.id = pi.sale_id AND s.phone_id = pi.phone_id AND s.customer_id = o.customer_id
          AND s.store_id = o.store_id AND s.sale_type = 'retail' AND ${getActiveSaleSql()}
        JOIN phones p ON p.id = pi.phone_id
        LEFT JOIN sales_order_items i ON i.item_type = 'accessory' AND i.linked_phone_sale_id = pi.sale_id
        LEFT JOIN accessory_sales gs ON gs.id = i.accessory_sale_id
        WHERE ${conditions.join(' AND ')} ORDER BY i.id`, params)
      const ids = rows.filter(row => row.item_id !== null && row.item_id !== undefined).map(row => row.item_id)
      if (!ids.length) return rows
      // 核对需要完整已退数量；不按办理门店截断库存事实，也不返回办理人等历史明细。
      const [history] = await connection.execute(`SELECT i.original_item_id, i.aftersale_id, i.quantity, i.fact_snapshot
        FROM sales_aftersale_items i JOIN sales_aftersales a ON a.id = i.aftersale_id
        WHERE i.original_item_id IN (${ids.map(() => '?').join(',')}) ORDER BY i.id`, ids)
      const byItem = new Map()
      for (const item of history) {
        const key = String(item.original_item_id)
        if (!byItem.has(key)) byItem.set(key, [])
        byItem.get(key).push(item)
      }
      return rows.map(row => ({ ...row, return_history: byItem.get(String(row.item_id)) || [] }))
    })
  }
  async phoneReturnSource(phoneId, scope) {
    const conditions = ['p.id = ?', "p.status IN ('sold', 'peer_transfer', 'supplier_proxy')"]
    const params = [phoneId]
    appendStoreScopeCondition(scope, 'p.store_id', conditions, params)
    appendStoreScopeCondition(scope, 's.store_id', conditions, params)
    return this.withConnection(async connection => {
      const [rows] = await connection.execute(`SELECT p.id AS phone_id, s.id AS sale_id,
        i.order_id, i.sale_id AS checkout_sale_id
        FROM phones p JOIN sales s ON s.id = (${getLatestActiveSaleIdSql('p', 'current_sale')})
        LEFT JOIN sales_order_items i ON i.sale_id = s.id
        WHERE ${conditions.join(' AND ')}`, params)
      return rows[0] || null
    })
  }
  async phoneOrder(connection, phoneId) {
    const [rows] = await connection.execute(`SELECT i.order_id FROM sales_order_items i
      LEFT JOIN sales s ON s.id = i.sale_id
      WHERE i.phone_id = ? OR s.phone_id = ? ORDER BY i.id DESC LIMIT 1 FOR UPDATE`, [phoneId, phoneId])
    return rows[0]?.order_id || null
  }
  async currentPhoneOrder(connection, phoneId) {
    const [rows] = await connection.execute(`SELECT i.order_id FROM sales_order_items i
      JOIN sales s ON s.id = i.sale_id
      JOIN phones p ON p.id = s.phone_id
      WHERE s.phone_id = ?
        AND s.id = (${getLatestActiveSaleIdSql('p', 'current_sale')})
      ORDER BY i.id DESC LIMIT 1 FOR UPDATE`, [phoneId])
    return rows[0]?.order_id || null
  }
  async awardPoints(connection, id, points) {
    const [result] = await connection.execute('UPDATE customers SET points = points + ?, updated_at = NOW() WHERE id = ? AND points >= 0 AND points <= ?', [points, id, 2147483647 - points])
    return result.affectedRows === 1
  }
  async phoneSnapshots(connection, ids) {
    if (!ids.length) return []
    const [rows] = await connection.execute(`SELECT p.id, p.store_id, p.imei, p.serial_number, p.brand_id, p.model_id, p.color_id, p.memory_id,
      p.supplier_id, p.is_new, b.name AS brand_name, m.name AS model_name, c.name AS color_name, mem.size AS memory_name
      FROM phones p LEFT JOIN brands b ON b.id = p.brand_id LEFT JOIN models m ON m.id = p.model_id
      LEFT JOIN colors c ON c.id = p.color_id LEFT JOIN memories mem ON mem.id = p.memory_id
      WHERE p.id IN (${ids.map(() => '?').join(',')}) ORDER BY p.id FOR UPDATE`, ids)
    return rows
  }
  async sales(connection, ids) {
    const [rows] = await connection.execute(`SELECT id, phone_id, sale_price, purchase_cost, invoice_number, points_awarded
      FROM sales WHERE id IN (${ids.map(() => '?').join(',')}) ORDER BY id`, ids)
    return rows
  }
  async createOrder(connection, row) {
    const [result] = await connection.execute(`INSERT INTO sales_orders
      (order_no, request_key, request_hash, customer_id, customer_name, customer_phone, store_id, operator_id,
       created_by, total_amount, final_amount, order_date, remarks, points_config_snapshot)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?, ?)`,
    [row.order_no, row.request_key, row.request_hash, row.customer_id, row.customer_name, row.customer_phone,
      row.store_id, row.operator_id, row.created_by, row.time, row.remarks, JSON.stringify(row.config)])
    return result.insertId
  }
  async createItem(connection, row) {
    const [result] = await connection.execute(`INSERT INTO sales_order_items
      (order_id, line_key, item_type, sale_id, accessory_sale_id, phone_id, accessory_id, linked_phone_sale_id,
       quantity, unit_price, total_amount, purchase_cost, points_awarded, snapshot, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [row.order_id, row.key, row.type, row.sale_id || null, row.accessory_sale_id || null, row.phone_id || null,
      row.accessory_id || null, row.linked_phone_sale_id || null, row.quantity, row.unit_price, row.total_amount,
      row.purchase_cost, row.points_awarded, JSON.stringify(row.snapshot), row.time])
    return result.insertId
  }
  async linkPayments(connection, ids, orderId) {
    if (!ids.length) return
    const [result] = await connection.execute(`UPDATE payment_records SET sales_order_id = ? WHERE id IN (${ids.map(() => '?').join(',')}) AND sales_order_id IS NULL`, [orderId, ...ids])
    if (result.affectedRows !== ids.length) throw new Error('收款关联已变化，整单结算已取消')
  }
  async createPayment(connection, row) {
    const [result] = await connection.execute(`INSERT INTO payment_records
      (order_id, sales_order_id, customer_id, payment_method, payment_channel, amount, payment_status, transaction_no, payment_time, remarks, created_by)
      VALUES (NULL, ?, ?, ?, ?, ?, 'success', ?, ?, ?, ?)`,
    [row.order_id, row.customer_id, row.payment_method, row.payment_channel, row.amount, row.transaction_no, row.time, row.remarks, row.actor_id])
    return result.insertId
  }
  async completeOrder(connection, row) {
    const [result] = await connection.execute(`UPDATE sales_orders SET total_amount = ?, final_amount = ?, total_cost = ?, total_profit = ?,
      paid_amount = ?, points_awarded = ?, payment_method = ?, payment_channel = ?, payment_status = 'paid',
      order_status = 'completed', completed_date = ?, checkout_result = ?, updated_at = NOW() WHERE id = ? AND order_status = 'draft'`,
    [row.total_amount, row.final_amount, row.total_cost, row.total_profit, row.final_amount, row.points_awarded,
      row.payment_method, row.payment_channel, row.time, JSON.stringify(row.result), row.id])
    if (result.affectedRows !== 1) throw new Error('结算订单状态已变化，整单已取消')
  }
}
module.exports = SalesCheckoutRepository
