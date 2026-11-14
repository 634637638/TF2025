'use strict'

const BaseRepository = require('./base.repository')
const { getActiveSaleSql } = require('../utils/sale-status')

/** 贴膜只追加服务事实；库存、积分及收款仍由共同结算仓储负责。 */
class FilmServiceRepository extends BaseRepository {
  constructor() { super('customer_film_services') }

  async customer(connection, id) {
    const [rows] = await connection.execute('SELECT id FROM customers WHERE id = ?', [id])
    return rows[0] || null
  }

  async qualification(connection, customerId, time, { lock = false } = {}) {
    const [rows] = await connection.execute(`SELECT s.id FROM sales s
      WHERE s.customer_id = ? AND s.sale_type = 'retail' AND ${getActiveSaleSql('s')}
        AND s.sale_time <= ? ORDER BY s.id DESC LIMIT 1${lock ? ' FOR UPDATE' : ''}`, [customerId, time])
    return rows[0] || null
  }

  async product(connection, id, { lock = false } = {}) {
    const [rows] = await connection.execute(`SELECT a.id, c.film_enabled, c.status AS category_status
      FROM accessories a LEFT JOIN accessories t ON t.id = a.template_id
      JOIN accessory_categories c ON c.id = IF(a.template_id IS NULL, a.category_id, t.category_id)
      WHERE a.id = ?${lock ? ' FOR UPDATE' : ''}`, [id])
    return rows[0] || null
  }

  async append(connection, row) {
    const [result] = await connection.execute(`INSERT INTO customer_film_services
      (order_id, customer_id, qualification_sale_id, store_id, operator_id, created_by,
       quantity, business_time, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [row.order_id, row.customer_id, row.qualification_sale_id, row.store_id, row.operator_id,
      row.created_by, row.quantity, row.business_time, row.created_at])
    return result.insertId
  }

  async history(connection, customerId, { page, page_size: pageSize }) {
    const [[summary]] = await connection.execute(`SELECT COUNT(*) AS total,
      COALESCE(SUM(quantity), 0) AS total_quantity FROM customer_film_services WHERE customer_id = ?`, [customerId])
    const [rows] = await connection.execute(`SELECT f.id, f.order_id, o.order_no, f.quantity,
      f.store_id, st.name AS store_name, f.operator_id, u.name AS operator_name,
      f.business_time, f.created_at FROM customer_film_services f
      JOIN sales_orders o ON o.id = f.order_id LEFT JOIN stores st ON st.id = f.store_id
      LEFT JOIN users u ON u.id = f.operator_id WHERE f.customer_id = ?
      ORDER BY f.id DESC LIMIT ? OFFSET ?`, [customerId, pageSize, (page - 1) * pageSize])
    if (!rows.length) return { rows, total: Number(summary.total), total_quantity: Number(summary.total_quantity), items: [] }
    const [items] = await connection.execute(`SELECT i.order_id, i.quantity, i.total_amount,
      JSON_UNQUOTE(JSON_EXTRACT(i.snapshot, '$.name')) AS name,
      JSON_UNQUOTE(JSON_EXTRACT(i.snapshot, '$.sale_type')) AS sale_type
      FROM sales_order_items i WHERE i.item_type = 'accessory'
        AND i.order_id IN (${rows.map(() => '?').join(',')}) ORDER BY i.id`, rows.map(row => row.order_id))
    return { rows, total: Number(summary.total), total_quantity: Number(summary.total_quantity), items }
  }
}

module.exports = FilmServiceRepository
