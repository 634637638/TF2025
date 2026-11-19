'use strict'

const BaseRepository = require('./base.repository')
const { appendPurchaseStoreScope } = require('../utils/accessory-purchase-scope')
const { appendStoreScopeCondition } = require('../utils/store-scope')
const { purchaseSnapshotText } = require('../utils/accessory-purchase-snapshot')

const joins = `FROM accessory_stock_in si
  LEFT JOIN accessories a ON a.id = si.accessory_id
  LEFT JOIN accessories t ON t.id = a.template_id
  LEFT JOIN suppliers s ON s.id = si.supplier_id
  LEFT JOIN stores st ON st.id = si.store_id
  LEFT JOIN brands b ON b.id = a.brand_id
  LEFT JOIN colors c ON c.id = IF(a.template_id IS NULL, a.color_id, t.color_id)
  LEFT JOIN accessory_categories category ON category.id = IF(a.template_id IS NULL, a.category_id, t.category_id)
  LEFT JOIN accessory_units unit ON unit.id = IF(a.template_id IS NULL, a.unit_id, t.unit_id)
  LEFT JOIN accessory_purchase_payments p ON p.id = (
    SELECT MAX(last_payment.id) FROM accessory_purchase_payments last_payment WHERE last_payment.stock_in_id = si.id
  )`
const paid = "p.action = 'pay'"

class AccessoryPurchaseRepository extends BaseRepository {
  constructor() { super('accessory_stock_in') }

  conditions(scope, query = {}) {
    const conditions = ["si.status = 'completed'", 'si.supplier_id IS NOT NULL']
    const params = []
    appendPurchaseStoreScope(scope, 'si', conditions, params)
    for (const [field, column] of [['supplier_id', 'si.supplier_id'], ['store_id', 'si.store_id']]) {
      if (query[field]) { conditions.push(`${column} = ?`); params.push(query[field]) }
    }
    if (query.payment_status === 'paid') conditions.push(paid)
    for (const [field, column] of [['supplier_name', 's.name'], ['store_name', 'st.name'], ['brand_name', 'b.name']]) {
      if (query[field]) { conditions.push(`CONVERT(${purchaseSnapshotText(field, column)} USING utf8mb4) COLLATE utf8mb4_unicode_ci LIKE ?`); params.push(`%${query[field]}%`) }
    }
    if (query.product_name) {
      conditions.push(`CONVERT(${purchaseSnapshotText('name', 'COALESCE(t.name, a.name)')} USING utf8mb4) COLLATE utf8mb4_unicode_ci LIKE ?`)
      params.push(`%${query.product_name}%`)
    }
    if (query.payment_status === 'unpaid') conditions.push("(p.id IS NULL OR p.action = 'cancel')")
    if (query.keyword) {
      conditions.push(`(CONVERT(si.batch_no USING utf8mb4) COLLATE utf8mb4_unicode_ci LIKE ? OR
        CONVERT(${purchaseSnapshotText('name', 'COALESCE(t.name, a.name)')} USING utf8mb4) COLLATE utf8mb4_unicode_ci LIKE ?)`)
      params.push(`%${query.keyword}%`, `%${query.keyword}%`)
    }
    if (query.start_date) { conditions.push('si.inventory_time >= ?'); params.push(`${query.start_date} 00:00:00`) }
    if (query.end_date) { conditions.push('si.inventory_time < DATE_ADD(?, INTERVAL 1 DAY)'); params.push(query.end_date) }
    return { where: `WHERE ${conditions.join(' AND ')}`, params }
  }

  async list(scope, query, connection) {
    const { where, params } = this.conditions(scope, query)
    // 服务层提供同一只读快照连接，汇总和明细不得另行租借。
    const [[summary]] = await connection.query(`SELECT COUNT(*) AS total,
          COALESCE(SUM(si.quantity), 0) AS total_quantity,
          COALESCE(SUM(si.total_amount), 0) AS total_amount,
          COALESCE(SUM(CASE WHEN ${paid} THEN si.total_amount ELSE 0 END), 0) AS paid_amount,
          COALESCE(SUM(CASE WHEN ${paid} THEN 0 ELSE si.total_amount END), 0) AS unpaid_amount
          ${joins} ${where}`, params)
    const [rows] = await connection.query(`SELECT si.id, si.batch_no, si.accessory_id, si.product_snapshot,
          si.supplier_id, s.name AS supplier_name, si.store_id, st.name AS store_name,
          COALESCE(t.name, a.name) AS name, b.name AS brand_name, IF(a.template_id IS NULL, a.product_model, t.product_model) AS product_model,
          c.name AS color_name, COALESCE(category.name, t.category, a.category) AS category,
          COALESCE(unit.name, t.unit, a.unit) AS unit, si.quantity, si.purchase_cost, si.total_amount,
          si.inventory_time, si.operator_name AS inventory_operator_name,
          CASE WHEN ${paid} THEN 'paid' ELSE 'unpaid' END AS payment_status,
          COALESCE(p.id, 0) AS latest_event_id,
          CASE WHEN ${paid} THEN p.payment_method END AS payment_method,
          CASE WHEN ${paid} THEN p.payment_time END AS payment_time,
          CASE WHEN ${paid} THEN p.operator_name END AS payment_operator_name,
          CASE WHEN ${paid} THEN p.remarks END AS payment_remarks,
          CASE WHEN ${paid} THEN p.payment_batch_id END AS payment_batch_id
          ${joins} ${where} ORDER BY si.inventory_time DESC, si.id DESC LIMIT ? OFFSET ?`,
    [...params, query.page_size, (query.page - 1) * query.page_size])
    const total = Number(summary.total)
    return { rows, summary, pagination: { page: query.page, page_size: query.page_size,
      total, total_pages: Math.ceil(total / query.page_size) } }
  }

  async options(scope, connection) {
    const { where, params } = this.conditions(scope)
    const storeConditions = ['status = 1']
    const storeParams = []
    appendStoreScopeCondition(scope, 'id', storeConditions, storeParams)
    const [[rows], [supplierRows], [brandRows], [storeRows]] = await Promise.all([
      connection.query(`SELECT DISTINCT
      ${purchaseSnapshotText('supplier_name', 's.name')} AS supplier_name,
      ${purchaseSnapshotText('brand_name', 'b.name')} AS brand_name,
      ${purchaseSnapshotText('name', 'COALESCE(t.name, a.name)')} AS product_name,
      ${purchaseSnapshotText('store_name', 'st.name')} AS store_name
      ${joins} ${where}`, params),
      connection.query("SELECT name FROM suppliers WHERE status = 1 AND business_scope IN ('accessory', 'both') ORDER BY sort_order, name, id"),
      connection.query("SELECT name FROM brands WHERE status = 1 AND business_scope IN ('accessory', 'both') ORDER BY sort_order, name, id"),
      connection.query(`SELECT name FROM stores WHERE ${storeConditions.join(' AND ')} ORDER BY sort_order, name, id`, storeParams)
    ])
    return {
      suppliers: [...new Set([...supplierRows.map(row => row.name), ...rows.map(row => row.supplier_name)].map(value => String(value || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'zh-CN')),
      brands: [...new Set([...brandRows.map(row => row.name), ...rows.map(row => row.brand_name)].map(value => String(value || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'zh-CN')),
      products: [...new Set(rows.map(row => String(row.product_name || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'zh-CN')),
      stores: [...new Set([...storeRows.map(row => row.name), ...rows.map(row => row.store_name)].map(value => String(value || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'zh-CN'))
    }
  }

  /** 供应商累计采购只读统计，沿用货款页的原整单授权，不按现存商品倒推。 */
  async supplierSummary(id, scope, connection) {
    const { where, params } = this.conditions(scope, { supplier_id: id })
    const [[row]] = await connection.query(`SELECT COALESCE(SUM(si.quantity), 0) AS quantity,
      CAST(COALESCE(SUM(si.total_amount * 100), 0) AS DECIMAL(65, 0)) AS total_cents,
      COALESCE(SUM(CASE WHEN si.quantity IS NULL OR si.quantity <= 0 OR si.purchase_cost IS NULL OR si.purchase_cost < 0
        OR si.total_amount IS NULL OR si.total_amount < 0 OR si.total_amount <> si.quantity * si.purchase_cost THEN 1 ELSE 0 END), 0) AS invalid_count
      FROM accessory_stock_in si ${where}`, params)
    return row
  }

  async getPurchase(id, scope, connection, lock = false) {
    const { where, params } = this.conditions(scope)
    const [rows] = await (connection || this.getConnection()).query(`SELECT si.id, si.supplier_id,
      si.quantity, si.purchase_cost, si.total_amount, si.store_id, si.distribution
      FROM accessory_stock_in si ${where} AND si.id = ? ${lock ? 'FOR UPDATE' : ''}`, [...params, id])
    return rows[0] || null
  }

  async returnPurchase(id, scope, connection) {
    const { where, params } = this.conditions(scope)
    const [rows] = await connection.query(`SELECT si.id, si.accessory_id, si.batch_no, si.product_snapshot,
      si.supplier_id, s.name AS supplier_name, si.store_id, st.name AS store_name,
      COALESCE(t.name, a.name) AS name, b.name AS brand_name, IF(a.template_id IS NULL, a.product_model, t.product_model) AS product_model,
      c.name AS color_name, COALESCE(category.name, t.category, a.category) AS category,
      COALESCE(unit.name, t.unit, a.unit) AS unit, si.quantity, si.purchase_cost, si.total_amount,
      si.inventory_time, si.operator_name AS inventory_operator_name
      ${joins} ${where} AND si.id = ?`, [...params, id])
    return rows[0] || null
  }

  /** 沿用服务层连接按游标核对完整追加账，不把分页首屏当成全部付款事实。 */
  async paymentEventsAfter(id, afterId, pageSize, connection) {
    const [rows] = await connection.query(`SELECT id, stock_in_id, supplier_id, action, amount, reference_event_id,
      payment_method, DATE_FORMAT(payment_time, '%Y-%m-%d %H:%i:%s') AS payment_time, payment_batch_id
      FROM accessory_purchase_payments WHERE stock_in_id = ? AND id > ? ORDER BY id LIMIT ?`, [id, afterId, pageSize])
    return rows
  }

  async byKey(key, connection) {
    const [rows] = await connection.query('SELECT id, stock_in_id, request_hash, action, amount FROM accessory_purchase_payments WHERE request_key = ?', [key])
    return rows[0] || null
  }

  async append(data, connection) {
    const [result] = await connection.query(`INSERT INTO accessory_purchase_payments
      (stock_in_id, supplier_id, action, amount, reference_event_id, request_key, request_hash,
       payment_method, payment_time, remarks, operator_id, operator_name, created_at, payment_batch_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [data.stock_in_id, data.supplier_id, data.action, data.amount, data.reference_event_id,
      data.request_key, data.request_hash, data.payment_method, data.payment_time, data.remarks,
      data.operator_id, data.operator_name, data.created_at, data.payment_batch_id || null])
    return result.insertId
  }

  async history(id, page, pageSize, connection) {
    const [[count]] = await connection.query('SELECT COUNT(*) AS total FROM accessory_purchase_payments WHERE stock_in_id = ?', [id])
    const [rows] = await connection.query(`SELECT id, stock_in_id, action, amount, reference_event_id,
      payment_method, payment_time, remarks, operator_id, operator_name, created_at
      FROM accessory_purchase_payments WHERE stock_in_id = ? ORDER BY id DESC LIMIT ? OFFSET ?`, [id, pageSize, (page - 1) * pageSize])
    return { rows, pagination: { page, page_size: pageSize, total: Number(count.total), total_pages: Math.ceil(Number(count.total) / pageSize) } }
  }
}
module.exports = AccessoryPurchaseRepository
