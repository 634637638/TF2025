'use strict'

const SalesAftersaleRepository = require('./sales-aftersale.repository')

/** 服务撤销复用售后、客户及库存原单；只追加服务到售后的唯一关联。 */
class FilmCancellationRepository extends SalesAftersaleRepository {
  async service(connection, id, { lock = false } = {}) {
    const [rows] = await connection.execute(`SELECT id, order_id, customer_id, store_id, quantity, business_time,
      created_at FROM customer_film_services WHERE id = ?${lock ? ' FOR UPDATE' : ''}`, [id])
    return rows[0] || null
  }

  async cancellation(connection, id) {
    const [rows] = await connection.execute('SELECT id, aftersale_id FROM customer_film_cancellations WHERE service_id = ? FOR UPDATE', [id])
    return rows[0] || null
  }

  async serviceItems(connection, orderId) {
    const [rows] = await connection.execute('SELECT id, item_type FROM sales_order_items WHERE order_id = ? ORDER BY id FOR UPDATE', [orderId])
    return rows
  }

  async appendCancellation(connection, row) {
    const [result] = await connection.execute(`INSERT INTO customer_film_cancellations
      (service_id, aftersale_id, actually_used, reason) VALUES (?, ?, ?, ?)`,
    [row.service_id, row.aftersale_id, row.actually_used ? 1 : 0, row.reason])
    return Number(result.insertId)
  }
}

module.exports = FilmCancellationRepository
