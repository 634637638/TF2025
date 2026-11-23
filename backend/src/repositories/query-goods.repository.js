'use strict'

const { purchaseSnapshotText } = require('../utils/accessory-purchase-snapshot')

const { getDatabase } = require('../config/database')
const { withConnection } = require('../core/db/connection')
const { appendStoreScopeCondition } = require('../utils/store-scope')
const { normalizedModelSql } = require('../utils/search')
const { buildPagination } = require('../utils/reference-options')

// 共同单读取成交快照；旧出库没有快照时才显示当前档案，不伪造历史资料。
const archive = (field, current) => `CASE WHEN i.id IS NOT NULL THEN NULLIF(JSON_UNQUOTE(JSON_EXTRACT(i.snapshot, '$.${field}')), 'null') ELSE ${current} END`
const product = {
  name: archive('name', 'COALESCE(t.name, a.name)'),
  barcode: archive('barcode', 'COALESCE(t.barcode, a.barcode)'),
  product_model: archive('product_model', 'IF(a.template_id IS NULL, a.product_model, t.product_model)'),
  category: archive('category', 'COALESCE(c.name, t.category, a.category)'),
  brand_name: archive('brand_name', 'b.name'),
  color_name: archive('color_name', 'color.name'),
  unit: archive('unit', 'COALESCE(u.name, t.unit, a.unit)')
}
const joins = `FROM accessory_sales s
  LEFT JOIN sales_order_items i ON i.accessory_sale_id = s.id AND i.item_type = 'accessory'
  LEFT JOIN sales_orders o ON o.id = i.order_id
  LEFT JOIN sales ps ON ps.id = i.linked_phone_sale_id
  LEFT JOIN accessories a ON a.id = s.accessory_id
  LEFT JOIN accessories t ON t.id = a.template_id
  LEFT JOIN accessory_categories c ON c.id = COALESCE(t.category_id, a.category_id)
  LEFT JOIN accessory_units u ON u.id = COALESCE(t.unit_id, a.unit_id)
  LEFT JOIN brands b ON b.id = a.brand_id
  LEFT JOIN colors color ON color.id = COALESCE(t.color_id, a.color_id)
  LEFT JOIN stores st ON st.id = s.store_id`
const returnedQuantity = `(SELECT COALESCE(SUM(re.quantity_delta), 0) FROM accessory_inventory_events re
  WHERE re.sale_id = s.id AND re.event_type IN ('sale_return', 'gift_return'))`
const fields = `s.id, s.sale_no, s.accessory_id, s.sale_type, s.store_id, st.name AS store_name,
  s.customer_name, s.customer_phone, s.quantity, s.unit_price, s.total_price, s.purchase_cost,
  s.profit, s.operator_name, COALESCE(s.sale_time, s.created_at) AS sale_time, s.remarks, o.order_no, ps.invoice_number AS linked_phone_invoice,
  i.points_awarded, o.id AS order_id, i.id AS order_item_id,
  ${returnedQuantity} AS returned_quantity, s.quantity - ${returnedQuantity} AS remaining_quantity,
  CASE WHEN i.id IS NULL THEN NULL ELSE COALESCE(JSON_EXTRACT(i.snapshot, '$.points_used'), 0) END AS points_used,
  CASE WHEN i.id IS NULL THEN NULL ELSE COALESCE(JSON_EXTRACT(i.snapshot, '$.deduction_cents'), 0) / 100 END AS deduction_amount,
  (i.id IS NOT NULL) AS has_snapshot,
  ${Object.entries(product).map(([key, sql]) => `${sql} AS ${key}`).join(', ')}`
const searchable = {
  ...product, customer_name: 's.customer_name', customer_phone: 's.customer_phone', operator_name: 's.operator_name',
  sale_no: 's.sale_no', order_no: 'o.order_no', linked_phone_invoice: 'ps.invoice_number', remarks: 's.remarks'
}

class QueryGoodsRepository {
  constructor({ database = getDatabase } = {}) { this.database = database }
  withConnection(operation) { return withConnection(this.database, operation) }

  async originalOrder(scope, id, source, connection) {
    const phone = source === 'phone'
    const sourceJoin = phone ? "JOIN sales_order_items origin ON origin.order_id = o.id AND origin.item_type = 'phone' JOIN sales sale ON sale.id = origin.sale_id"
      : "JOIN sales_order_items origin ON origin.order_id = o.id AND origin.item_type = 'accessory' JOIN accessory_sales sale ON sale.id = origin.accessory_sale_id"
    const conditions = ['sale.id = ?', 'o.request_key IS NOT NULL', "o.order_status = 'completed'"], params = [id]
    appendStoreScopeCondition(scope, 'sale.store_id', conditions, params)
    appendStoreScopeCondition(scope, 'o.store_id', conditions, params)
    const [headers] = await connection.query(`SELECT o.id, o.order_no, o.customer_name, o.customer_phone, o.store_id,
      st.name AS store_name, seller.name AS operator_name, o.customer_id, o.operator_id,
      COALESCE(sale.sale_time, sale.created_at) AS sale_time, o.remarks, o.total_amount, o.final_amount, o.paid_amount, o.points_awarded
      FROM sales_orders o ${sourceJoin} LEFT JOIN stores st ON st.id = o.store_id
      LEFT JOIN users seller ON seller.id = o.operator_id
      WHERE ${conditions.join(' AND ')}`, params)
    if (!headers.length) return null
    if (headers.length !== 1) throw Object.assign(new Error('共同原单关联不唯一'), { statusCode: 409, code: 'CHECKOUT_FACTS_CONFLICT' })
    const [items] = await connection.query(`SELECT i.*, ps.phone_id AS sale_phone_id, ps.sale_price AS phone_sale_price,
      ps.invoice_number AS phone_sale_no, gs.sale_no AS goods_sale_no, gs.quantity AS goods_quantity,
      gs.unit_price AS goods_unit_price, gs.total_price AS goods_total_price, gs.sale_type AS goods_sale_type,
      gs.accessory_id AS goods_accessory_id,
      CASE WHEN i.item_type = 'phone' THEN ps.customer_id ELSE gs.customer_id END AS sale_customer_id,
      CASE WHEN i.item_type = 'phone' THEN ps.operator_id ELSE gs.operator_id END AS sale_operator_id, linked.invoice_number AS linked_phone_sale_no, linked.store_id AS linked_phone_store_id,
      CASE WHEN i.item_type = 'phone' THEN ps.store_id ELSE gs.store_id END AS sale_store_id
      FROM sales_order_items i LEFT JOIN sales ps ON ps.id = i.sale_id AND i.item_type = 'phone'
      LEFT JOIN accessory_sales gs ON gs.id = i.accessory_sale_id AND i.item_type = 'accessory'
      LEFT JOIN sales linked ON linked.id = i.linked_phone_sale_id
      WHERE i.order_id = ? ORDER BY i.id`, [headers[0].id])
    return { header: headers[0], items }
  }

  filters(scope, query, searchFields) {
    const conditions = [], params = []
    appendStoreScopeCondition(scope, 's.store_id', conditions, params)
    // 仅由客户定向历史服务设置；公开商品列表不接受customer_id筛选。
    if (query.customer_id !== undefined) { conditions.push('s.customer_id = ?'); params.push(query.customer_id) }
    if (query.film_only) conditions.push(`${product.category} LIKE '%膜%'`)
    if (query.sale_type) { conditions.push('s.sale_type = ?'); params.push(query.sale_type) }
    if (query.sale_operator_id !== undefined) { conditions.push('s.operator_id = ?'); params.push(query.sale_operator_id) }
    if (query.brand_id !== undefined) { conditions.push(`${product.brand_name} = (SELECT name FROM brands WHERE id = ?)`); params.push(query.brand_id) }
    if (query.category_id !== undefined) { conditions.push(`${product.category} = (SELECT name FROM accessory_categories WHERE id = ?)`); params.push(query.category_id) }
    if (query.product_name) {
      conditions.push(`${normalizedModelSql(product.name)} LIKE ${normalizedModelSql('?')}`)
      params.push(`%${query.product_name}%`)
    }
    // 商品销售日期是业务时间；created_at 只是实际写入时间，不能覆盖用户选择的历史销售日期。
    if (query.start_date) { conditions.push('COALESCE(s.sale_time, s.created_at) >= ?'); params.push(`${query.start_date} 00:00:00`) }
    if (query.end_date) { conditions.push('COALESCE(s.sale_time, s.created_at) <= ?'); params.push(`${query.end_date} 23:59:59`) }
    if (query.keyword) {
      const matches = []
      for (const field of searchFields) {
        if (searchable[field]) {
          matches.push(`${normalizedModelSql(searchable[field])} LIKE ${normalizedModelSql('?')}`)
          params.push(`%${query.keyword}%`)
        } else if (field === 'serial_number') {
          matches.push(`EXISTS (SELECT 1 FROM accessory_serial_events se JOIN accessory_serials sn ON sn.id = se.serial_id
            WHERE se.sale_id = s.id AND se.event_type IN ('sale', 'gift') AND ${normalizedModelSql('sn.serial_number')} LIKE ${normalizedModelSql('?')})`)
          params.push(`%${query.keyword}%`)
        }
      }
      conditions.push(matches.length ? `(${matches.join(' OR ')})` : '1 = 0')
    }
    return { where: conditions.length ? `WHERE ${conditions.join(' AND ')}` : '', params }
  }

  async list(scope, query, searchFields, connection) {
    if (!connection) return this.withConnection(connection => this.list(scope, query, searchFields, connection))
    const { where, params } = this.filters(scope, query, searchFields)
    const [counts] = await connection.query(`SELECT COUNT(*) AS total ${joins} ${where}`, params)
    const [rows] = await connection.query(`SELECT ${fields}${query.customer_id !== undefined ? ', ps.store_id AS linked_phone_store_id' : ''} ${joins} ${where}
      ORDER BY COALESCE(s.sale_time, s.created_at) DESC, s.id DESC LIMIT ? OFFSET ?`, [...params, query.page_size, (query.page - 1) * query.page_size])
    return { data: rows, pagination: buildPagination(query.page, query.page_size, Number(counts[0].total)) }
  }

  async filterOptions(connection) {
    if (!connection) return this.withConnection(executor => this.filterOptions(executor))
    const [brands] = await connection.query(`SELECT id, name, sort_order
      FROM brands WHERE status = 1 AND business_scope IN ('accessory', 'both') ORDER BY sort_order, name, id`)
    const [categories] = await connection.query(`SELECT id, name, sort_order
      FROM accessory_categories WHERE status = 1 ORDER BY sort_order, name, id`)
    return { brands, categories }
  }

  async productNameOptions(scope, keyword, connection) {
    if (!connection) return this.withConnection(executor => this.productNameOptions(scope, keyword, executor))
    const conditions = [`${product.name} IS NOT NULL`, `TRIM(${product.name}) <> ''`]
    const params = []
    appendStoreScopeCondition(scope, 's.store_id', conditions, params)
    if (keyword) {
      conditions.push(`${normalizedModelSql(product.name)} LIKE ${normalizedModelSql('?')}`)
      params.push(`%${keyword}%`)
    }
    // 空关键词用于初次展开，优先显示最近成交商品；键入后按名称匹配，限制建议数避免大列表。
    const [rows] = await connection.query(`SELECT ${product.name} AS name, MAX(COALESCE(s.sale_time, s.created_at)) AS last_sold_at ${joins}
      WHERE ${conditions.join(' AND ')} GROUP BY ${product.name} ORDER BY last_sold_at DESC, name LIMIT 100`, params)
    return rows.map(row => row.name)
  }

  async detail(scope, id, connection) {
    if (!connection) return this.withConnection(connection => this.detail(scope, id, connection))
    const conditions = ['s.id = ?'], params = [id]
    appendStoreScopeCondition(scope, 's.store_id', conditions, params)
    const [rows] = await connection.query(`SELECT ${fields} ${joins} WHERE ${conditions.join(' AND ')}`, params)
    if (!rows.length) return null
    const [serials] = await connection.query(`SELECT DISTINCT sn.serial_number
      FROM accessory_serial_events se JOIN accessory_serials sn ON sn.id = se.serial_id
      WHERE se.sale_id = ? AND se.event_type IN ('sale', 'gift') ORDER BY sn.serial_number`, [id])
    const [batches] = await connection.query(`SELECT e.id, e.stock_in_id, si.batch_no, ${purchaseSnapshotText('supplier_name', 'supplier.name')} AS supplier_name,
      si.inventory_time, si.operator_name AS inventory_operator_name, e.purchase_cost, e.usage_type,
      -e.quantity_delta AS quantity, e.serial_tracking
      FROM accessory_inventory_events e
      LEFT JOIN accessory_stock_in si ON si.id = e.stock_in_id AND si.accessory_id = e.accessory_id
      LEFT JOIN suppliers supplier ON supplier.id = si.supplier_id
      WHERE e.sale_id = ? AND e.event_type IN ('sale', 'gift') AND e.quantity_delta < 0 ORDER BY e.id`, [id])
    return { ...rows[0], serial_numbers: serials.map(row => row.serial_number), batches }
  }

  /** 单张手机原销售凭证的配件明细；排除后续换货订单，保留原赠送和原SN。 */
  async phoneReceipt(scope, saleId, connection) {
    if (!connection) return this.withConnection(connection => this.phoneReceipt(scope, saleId, connection))
    const conditions = ['ps.id = ?'], params = [saleId]
    appendStoreScopeCondition(scope, 'ps.store_id', conditions, params)
    appendStoreScopeCondition(scope, 's.store_id', conditions, params)
    const [rows] = await connection.query(`SELECT ${fields}, i.snapshot AS receipt_snapshot ${joins}
      JOIN sales_order_items pi ON pi.sale_id = ps.id AND pi.item_type = 'phone' AND pi.order_id = i.order_id
      WHERE ${conditions.join(' AND ')} ORDER BY i.id`, params)
    if (!rows.length) return []
    const ids = rows.map(row => row.id)
    const [serials] = await connection.query(`SELECT DISTINCT se.sale_id, sn.serial_number
      FROM accessory_serial_events se JOIN accessory_serials sn ON sn.id = se.serial_id
      WHERE se.sale_id IN (${ids.map(() => '?').join(',')}) AND se.event_type IN ('sale', 'gift')
        AND NOT EXISTS (SELECT 1 FROM accessory_serial_events returned
          WHERE returned.sale_id = se.sale_id AND returned.serial_id = se.serial_id AND returned.event_type = 'return')
      ORDER BY se.sale_id, sn.serial_number`, ids)
    return rows.map(row => ({ ...row, serial_numbers: serials.filter(serial => Number(serial.sale_id) === Number(row.id)).map(serial => serial.serial_number) }))
  }

  async aftersales(scope, id, query, verifyItems, connection) {
    if (!connection) return this.withConnection(connection => this.aftersales(scope, id, query, verifyItems, connection))
    const originalConditions = ['s.id = ?'], originalParams = [id]
    appendStoreScopeCondition(scope, 's.store_id', originalConditions, originalParams)
    // 先核验原销售范围；不能借售后端点探测其他门店的销售或数据库升级状态。
    const [original] = await connection.query(`SELECT s.id, i.id AS item_id, i.order_id, s.store_id
      FROM accessory_sales s LEFT JOIN sales_order_items i ON i.accessory_sale_id = s.id AND i.item_type = 'accessory'
      WHERE ${originalConditions.join(' AND ')}`, originalParams)
    if (!original.length) return null
    if (!original[0].item_id) return { data: [], pagination: buildPagination(query.page, query.page_size, 0) }
    const conditions = ['ai.original_item_id = ?',
      "((a.order_id = ? AND a.original_store_id = ?) OR (a.operation_type = 'phone_return' AND a.order_id <> ?))",
      "a.operation_type IN ('goods_return', 'phone_return', 'goods_exchange')"]
    const params = [original[0].item_id, original[0].order_id, original[0].store_id, original[0].order_id]
    appendStoreScopeCondition(scope, 'a.original_store_id', conditions, params)
    appendStoreScopeCondition(scope, 'a.store_id', conditions, params)
    const from = `FROM sales_aftersale_items ai JOIN sales_aftersales a ON a.id = ai.aftersale_id
      WHERE ${conditions.join(' AND ')}`
    const [counts] = await connection.query(`SELECT COUNT(*) AS total ${from}`, params)
    // 内部读取头全部版本字段，兼容尚无replacement_cents的旧表；公开响应由服务层白名单重建。
    const [rows] = await connection.query(`SELECT a.*, ai.id AS aftersale_item_id, ai.original_item_id,
      (SELECT name FROM stores WHERE id = a.store_id) AS store_name,
      a.created_by AS operator_id, (SELECT name FROM users WHERE id = a.created_by) AS operator_name,
      a.business_time
      ${from} ORDER BY a.id DESC, ai.id DESC LIMIT ? OFFSET ?`, [...params, query.page_size, (query.page - 1) * query.page_size])
    const byAftersale = new Map()
    if (rows.length) {
      const ids = [...new Set(rows.map(row => row.id))]
      // 读取完整同笔明细，仅用于服务端核验头/行守恒；绝不把其他商品资金返回给客户端。
      const [items] = await connection.query(`SELECT ai.id, ai.aftersale_id, ai.original_item_id, ai.quantity, ai.fact_snapshot,
        oi.order_id AS item_order_id, oi.item_type, oi.sale_id, oi.phone_id, oi.linked_phone_sale_id
        FROM sales_aftersale_items ai LEFT JOIN sales_order_items oi ON oi.id = ai.original_item_id
        WHERE ai.aftersale_id IN (${ids.map(() => '?').join(', ')}) ORDER BY ai.aftersale_id, ai.id`, ids)
      for (const item of items) {
        const key = String(item.aftersale_id)
        if (!byAftersale.has(key)) byAftersale.set(key, [])
        byAftersale.get(key).push(item)
      }
    }
    const data = rows.map(row => ({ ...row, settlement_items: byAftersale.get(String(row.id)) || [] }))
    if (verifyItems) await verifyItems(connection, data)
    return { data,
      pagination: buildPagination(query.page, query.page_size, Number(counts[0].total)) }
  }
}
module.exports = QueryGoodsRepository
