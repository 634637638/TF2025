'use strict'

const SalesCheckoutRepository = require('./sales-checkout.repository')
const { getActiveSaleSql, getLatestActiveSaleIdSql } = require('../utils/sale-status')

/** 售后保存追加凭据，不删除原销售、共同明细、收款或采购事实。 */
class SalesAftersaleRepository extends SalesCheckoutRepository {
  async order(connection, id, { lock = true } = {}) {
    const [rows] = await connection.execute(`SELECT id, order_no, customer_id, customer_name, customer_phone, store_id, final_amount, paid_amount FROM sales_orders
      WHERE id = ? AND request_key IS NOT NULL AND order_status = 'completed'${lock ? ' FOR UPDATE' : ''}`, [id])
    return rows[0] || null
  }
  async item(connection, orderId, id, { lock = true } = {}) {
    const [rows] = await connection.execute(`SELECT i.id AS item_id, i.order_id, i.accessory_id, i.accessory_sale_id,
      i.quantity, i.unit_price, i.total_amount, i.purchase_cost, i.points_awarded, i.snapshot, i.linked_phone_sale_id,
      s.accessory_id AS sale_accessory_id, s.customer_id AS sale_customer_id, s.store_id AS sale_store_id,
      s.quantity AS sale_quantity, s.unit_price AS sale_unit_price, s.total_price AS sale_total_price, s.sale_type,
      s.sale_no, s.operator_name AS sale_operator_name, s.operator_id AS sale_operator_id
      FROM sales_order_items i JOIN accessory_sales s ON s.id = i.accessory_sale_id
      WHERE i.order_id = ? AND i.id = ? AND i.item_type = 'accessory'${lock ? ' FOR UPDATE' : ''}`, [orderId, id])
    return rows[0] || null
  }
  async request(connection, key) {
    const [rows] = await connection.execute(`SELECT id, request_hash, created_by, store_id, original_store_id, result_snapshot
      FROM sales_aftersales WHERE request_key = ? FOR UPDATE`, [key])
    return rows[0] || null
  }
  async returns(connection, itemId, { lock = true } = {}) {
    const [rows] = await connection.execute(`SELECT i.aftersale_id, i.quantity, i.fact_snapshot FROM sales_aftersale_items i
      JOIN sales_aftersales a ON a.id = i.aftersale_id WHERE i.original_item_id = ? ORDER BY i.id${lock ? ' FOR UPDATE' : ''}`, [itemId])
    return rows
  }
  async create(connection, row) {
    const phoneReturn = row.operation_type === 'phone_return'
    const exchange = row.operation_type === 'goods_exchange'
    if (row.operation_type !== undefined && !['phone_return', 'goods_return', 'goods_exchange'].includes(row.operation_type)) throw new Error('不支持的售后类型')
    const [result] = await connection.execute(`INSERT INTO sales_aftersales
      (request_key, request_hash, order_id, operation_type, customer_id, original_store_id, store_id, created_by,
       base_refund_cents, recovery_cents, compensation_cents, refund_cents, collection_cents, points_delta,
       settlement_method, settlement_channel, business_time, remarks, result_snapshot, created_at${phoneReturn || exchange ? ', gift_charge_cents' : ''}${exchange ? ', replacement_cents, additional_cents' : ''})
      VALUES (?, ?, ?, '${exchange ? 'goods_exchange' : phoneReturn ? 'phone_return' : 'goods_return'}', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?${phoneReturn || exchange ? ', ?' : ''}${exchange ? ', ?, ?' : ''})`,
    [row.request_key, row.request_hash, row.order_id, row.customer_id, row.original_store_id, row.store_id, row.actor_id,
      row.base_refund_cents, row.recovery_cents, row.compensation_cents, row.refund_cents, row.collection_cents, row.points_delta,
      row.settlement_method, row.settlement_channel, row.time, row.remarks, JSON.stringify(row.result), row.created_at,
      ...(phoneReturn || exchange ? [row.gift_charge_cents] : []), ...(exchange ? [row.replacement_cents, row.additional_cents] : [])])
    return Number(result.insertId)
  }
  async createAftersaleItem(connection, row) {
    await connection.execute(`INSERT INTO sales_aftersale_items
      (aftersale_id, original_item_id, quantity, fact_snapshot) VALUES (?, ?, ?, ?)`,
    [row.aftersale_id, row.original_item_id, row.quantity, JSON.stringify(row.fact_snapshot)])
  }

  async phone(connection, orderId, saleId) {
    // 不用JOIN条件隐藏损坏关联；服务层逐字段核对后才允许撤销当前销售。
    const [items] = await connection.execute(`SELECT id AS item_id, order_id, item_type, sale_id, phone_id,
      quantity, unit_price, total_amount, points_awarded, snapshot FROM sales_order_items
      WHERE order_id = ? AND sale_id = ? FOR UPDATE`, [orderId, saleId])
    if (items.length !== 1) return null
    const [sales] = await connection.execute(`SELECT s.id AS sale_id, s.phone_id, s.customer_id, s.store_id,
      s.sale_type, s.status AS sale_status, s.sale_price, s.points_awarded, s.points_accounted_at, s.operator_id,
      p.status AS phone_status, p.store_id AS phone_store_id,
      (${getLatestActiveSaleIdSql('p', 'current_sale')}) AS current_sale_id
      FROM sales s JOIN phones p ON p.id = s.phone_id
      WHERE s.id = ? FOR UPDATE`, [saleId])
    return sales.length === 1 ? { item: items[0], sale: sales[0] } : null
  }

  async linkedGoods(connection, saleId) {
    const [rows] = await connection.execute(`SELECT id AS item_id, order_id, item_type, linked_phone_sale_id
      FROM sales_order_items WHERE linked_phone_sale_id = ? ORDER BY id FOR UPDATE`, [saleId])
    if (rows.some(row => row.item_type !== 'accessory' || !Number.isSafeInteger(Number(row.order_id)) || Number(row.order_id) < 1)) {
      throw Object.assign(new Error('关联商品原单关系异常'), { statusCode: 409, code: 'CHECKOUT_RETURN_CONFLICT' })
    }
    return rows
  }

  async exchangeForItem(connection, itemId, { lock = true } = {}) {
    const [rows] = await connection.execute(`SELECT e.*, a.order_id, a.customer_id, a.operation_type,
      a.base_refund_cents, a.recovery_cents, a.compensation_cents, a.gift_charge_cents, a.replacement_cents, a.additional_cents,
      a.refund_cents, a.collection_cents, a.points_delta, i.id AS aftersale_item_id, i.quantity AS returned_quantity, i.fact_snapshot
      FROM sales_goods_exchanges e LEFT JOIN sales_aftersales a ON a.id = e.aftersale_id
      LEFT JOIN sales_aftersale_items i ON i.aftersale_id = a.id AND i.original_item_id = e.original_item_id
      WHERE e.replacement_item_id = ?${lock ? ' FOR UPDATE' : ''}`, [itemId])
    if (rows.length > 1) throw Object.assign(new Error('商品换货关联重复'), { statusCode: 409, code: 'CHECKOUT_RETURN_CONFLICT' })
    return rows[0] || null
  }

  async exchangeAdditions(connection, aftersaleId, { lock = true } = {}) {
    const [rows] = await connection.execute(`SELECT aftersale_id, replacement_order_id, replacement_item_id, quantity, amount_cents
      FROM sales_goods_exchange_additions WHERE aftersale_id = ? ORDER BY replacement_item_id${lock ? ' FOR UPDATE' : ''}`, [aftersaleId])
    return rows
  }

  async exchangeRootPhone(connection, saleId, { lock = true } = {}) {
    // 根手机可以已退货；只查不可变原销售及原共同明细，不要求仍为当前有效销售。
    const [rows] = await connection.execute(`SELECT i.id AS item_id, i.order_id, i.item_type, i.sale_id,
      i.phone_id, i.quantity, i.unit_price, i.total_amount, s.id AS actual_sale_id,
      s.phone_id AS sale_phone_id, s.customer_id, s.store_id, s.sale_type, s.status AS sale_status, s.sale_price
      FROM sales_order_items i LEFT JOIN sales s ON s.id = i.sale_id
      WHERE i.sale_id = ?${lock ? ' FOR UPDATE' : ''}`, [saleId])
    return rows.length === 1 ? rows[0] : null
  }

  async cancelPhoneSale(connection, saleId, phoneId, storeId, originalStoreId) {
    const [sale] = await connection.execute(`UPDATE sales s SET s.status = 'cancelled'
      WHERE s.id = ? AND s.phone_id = ? AND ${getActiveSaleSql()}`, [saleId, phoneId])
    const [phone] = await connection.execute(`UPDATE phones SET status = 'in_stock', store_id = ?,
      sale_time = NULL, sale_price = NULL, sale_operator_id = NULL
      WHERE id = ? AND status = 'sold' AND store_id = ?`, [storeId, phoneId, originalStoreId])
    if (sale.affectedRows !== 1 || phone.affectedRows !== 1) {
      throw Object.assign(new Error('手机当前销售或库存状态已变化'), { statusCode: 409, code: 'CHECKOUT_RETURN_CONFLICT' })
    }
  }
}

module.exports = SalesAftersaleRepository
