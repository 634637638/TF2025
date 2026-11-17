'use strict'

const BaseRepository = require('./base.repository')
const { appendPurchaseStoreScope } = require('../utils/accessory-purchase-scope')
const { inspectStockCorrectionSchema } = require('../utils/accessory-stock-correction-schema')

/** 原采购保持不可变；更正关系与替代采购、库存反向流水同事务提交。 */
class AccessoryStockCorrectionRepository extends BaseRepository {
  constructor() { super('accessory_stock_corrections') }

  async ready(connection) {
    const [tables] = await connection.query(`SELECT TABLE_NAME, ENGINE FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME IN ('accessory_stock_corrections', 'accessory_stock_in', 'accessory_stock', 'accessory_inventory_events', 'accessory_serials', 'accessory_serial_events', 'accessory_purchase_payments')`)
    if (tables.length !== 7 || tables.some(row => row.ENGINE !== 'InnoDB')) return false
    try {
      const schema = await inspectStockCorrectionSchema(connection)
      return schema.exists && schema.eventType.includes("'stock_correct'")
    } catch (error) {
      if (error.code === 'STOCK_CORRECTION_SCHEMA_CONFLICT') return false
      throw error
    }
  }

  async purchase(id, scope, connection, lock = false) {
    const conditions = ['si.id = ?'], params = [id]
    appendPurchaseStoreScope(scope, 'si', conditions, params)
    const [rows] = await connection.query(`SELECT si.*,
      DATE_FORMAT(si.inventory_time, '%Y-%m-%d %H:%i:%s') AS inventory_time
      FROM accessory_stock_in si WHERE ${conditions.join(' AND ')}${lock ? ' FOR UPDATE' : ''}`, params)
    return rows[0] || null
  }

  async options(accessoryId, scope, page, pageSize, connection) {
    const conditions = ["si.status = 'completed'", 'si.accessory_id = ?'], params = [accessoryId]
    appendPurchaseStoreScope(scope, 'si', conditions, params)
    const from = `FROM accessory_stock_in si WHERE ${conditions.join(' AND ')}`
    const [[count]] = await connection.query(`SELECT COUNT(*) AS total ${from}`, params)
    const [data] = await connection.query(`SELECT si.id AS purchase_id, si.batch_no, si.accessory_id,
      si.supplier_id, si.store_id, si.quantity, si.purchase_cost, si.total_amount, si.product_snapshot,
      si.inventory_time, si.operator_name ${from} ORDER BY si.inventory_time DESC, si.id DESC LIMIT ? OFFSET ?`,
    [...params, pageSize, (page - 1) * pageSize])
    const total = Number(count.total)
    return { data, pagination: { page, page_size: pageSize, total, total_pages: Math.ceil(total / pageSize) } }
  }

  async events(id, connection, lock = false) {
    const [rows] = await connection.query(`SELECT * FROM accessory_inventory_events WHERE stock_in_id = ? ORDER BY id${lock ? ' FOR UPDATE' : ''}`, [id])
    return rows
  }

  async serials(id, connection, lock = false) {
    const [rows] = await connection.query(`SELECT id, accessory_id, stock_in_id, serial_number, store_id, purchase_cost, status, sale_id
      FROM accessory_serials WHERE stock_in_id = ? ORDER BY id${lock ? ' FOR UPDATE' : ''}`, [id])
    return rows
  }

  async paymentExists(id, connection, lock = false) {
    // 持有原采购锁后当前读；付款/撤销均取同一原单锁，已撤销的付款也不能被更正抹掉。
    const [rows] = await connection.query(`SELECT id FROM accessory_purchase_payments WHERE stock_in_id = ? LIMIT 1${lock ? ' FOR UPDATE' : ''}`, [id])
    return rows.length > 0
  }

  async byKey(key, connection) {
    const [rows] = await connection.query('SELECT * FROM accessory_stock_corrections WHERE request_key = ? FOR UPDATE', [key])
    return rows[0] || null
  }

  async cancelOriginal(id, connection) {
    const [result] = await connection.query("UPDATE accessory_stock_in SET status = 'cancelled' WHERE id = ? AND status = 'completed'", [id])
    return result.affectedRows === 1
  }

  async removeStock(accessoryId, storeId, quantity, time, connection) {
    // 更正冲减原采购累计入库，不能记成销售或划拨，也不能把整个商品汇总覆写为本批数量。
    const [result] = await connection.query(`UPDATE accessory_stock SET quantity = quantity - ?, total_in = total_in - ?, updated_at = ?
      WHERE accessory_id = ? AND store_id = ? AND quantity >= ? AND total_in >= ?`,
    [quantity, quantity, time, accessoryId, storeId, quantity, quantity])
    return result.affectedRows === 1
  }

  async correctSerial(id, data, connection) {
    const [result] = await connection.query(`UPDATE accessory_serials SET accessory_id = ?, stock_in_id = ?, store_id = ?,
      purchase_cost = ?, status = ?, updated_at = ? WHERE id = ? AND status IN ('in_stock', 'voided') AND sale_id IS NULL`,
    [data.accessory_id, data.stock_in_id, data.store_id, data.purchase_cost, data.status, data.time, id])
    return result.affectedRows === 1
  }

  async append(data, connection) {
    const [result] = await connection.query(`INSERT INTO accessory_stock_corrections
      (source_stock_in_id, target_stock_in_id, request_key, request_hash, before_snapshot, after_snapshot, operator_id, operator_name, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [data.source_stock_in_id, data.target_stock_in_id, data.request_key, data.request_hash,
      JSON.stringify(data.before_snapshot), JSON.stringify(data.after_snapshot), data.operator_id, data.operator_name, data.time])
    return result.insertId
  }
}
module.exports = AccessoryStockCorrectionRepository
