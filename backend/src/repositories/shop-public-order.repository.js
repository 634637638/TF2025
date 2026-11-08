'use strict'

class ShopPublicOrderRepository {
  async getForUpdate(connection, id) {
    const [rows] = await connection.query(
      'SELECT id, order_number, customer_phone, status, expires_at FROM H5_orders WHERE id = ? FOR UPDATE',
      [id]
    )
    return rows[0] || null
  }

  async cancelPending(connection, id, reason) {
    const [result] = await connection.query(
      `UPDATE H5_orders
       SET status = 'cancelled',
           cancelled_at = NOW(),
           cancel_reason = ?,
           updated_at = NOW()
       WHERE id = ? AND status = 'pending'`,
      [reason, id]
    )
    return result.affectedRows
  }
}

module.exports = ShopPublicOrderRepository
