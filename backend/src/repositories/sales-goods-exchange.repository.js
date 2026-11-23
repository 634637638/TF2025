'use strict'

const SalesAftersaleRepository = require('./sales-aftersale.repository')

/** 换货追加关系及替换订单；现金仅保存在售后凭据，不重复创建全额收款。 */
class SalesGoodsExchangeRepository extends SalesAftersaleRepository {
  async createExchangeAddition(connection, row) {
    const [result] = await connection.execute(`INSERT INTO sales_goods_exchange_additions
      (aftersale_id, replacement_order_id, replacement_item_id, quantity, amount_cents) VALUES (?, ?, ?, ?, ?)`,
    [row.aftersale_id, row.replacement_order_id, row.replacement_item_id, row.quantity, row.amount_cents])
    return Number(result.insertId)
  }

  async createExchange(connection, row) {
    const [result] = await connection.execute(`INSERT INTO sales_goods_exchanges
      (aftersale_id, original_item_id, replacement_order_id, replacement_item_id, root_order_id, root_item_id, quantity, exchange_credit_cents)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [row.aftersale_id, row.original_item_id, row.replacement_order_id, row.replacement_item_id,
      row.root_order_id, row.root_item_id, row.quantity, row.exchange_credit_cents])
    return Number(result.insertId)
  }

  async completeExchangeOrder(connection, row) {
    const [result] = await connection.execute(`UPDATE sales_orders SET total_amount = ?, final_amount = ?, total_cost = ?, total_profit = ?,
      paid_amount = ?, points_awarded = ?, payment_method = ?, payment_channel = ?, payment_status = 'paid',
      order_status = 'completed', completed_date = ?, checkout_result = ?, updated_at = NOW() WHERE id = ? AND order_status = 'draft'`,
    [row.total_amount, row.final_amount, row.total_cost, row.total_profit, row.paid_amount, row.points_awarded,
      row.payment_method, row.payment_channel, row.time, JSON.stringify(row.result), row.id])
    if (result.affectedRows !== 1) throw Object.assign(new Error('换货订单状态已变化'), { statusCode: 409, code: 'CHECKOUT_RETURN_CONFLICT' })
  }
}

module.exports = SalesGoodsExchangeRepository
