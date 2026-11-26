'use strict'

const BaseRepository = require('./base.repository')
const AccessoryRepository = require('./accessory.repository')

/** 贴膜只追加服务事实；库存、积分及收款仍由共同结算仓储负责。 */
class FilmServiceRepository extends BaseRepository {
  constructor({ accessories = new AccessoryRepository() } = {}) {
    super('customer_film_services')
    this.accessories = accessories
  }

  async customer(connection, id) {
    const [rows] = await connection.execute('SELECT id FROM customers WHERE id = ?', [id])
    return rows[0] || null
  }

  async device(connection, phoneId, customerId, { lock = false } = {}) {
    const [rows] = await connection.execute(`SELECT p.id AS phone_id, p.model_id, m.name AS model_name,
      s.id AS sale_id FROM phones p JOIN models m ON m.id = p.model_id
      JOIN sales s ON s.phone_id = p.id AND s.customer_id = ?
      WHERE p.id = ? ORDER BY s.id DESC LIMIT 1${lock ? ' FOR UPDATE' : ''}`, [customerId, phoneId])
    return rows[0] || null
  }

  /** 找到配置的唯一模板后才查询该门店实物，不用有货筛选掩盖配置冲突。 */
  async matchingTemplates(connection, modelId, { lock = false } = {}) {
    const [rows] = await connection.execute(`SELECT a.id FROM accessories a
      WHERE a.template_id IS NULL AND a.status = 1 AND a.free_film = 1
      AND EXISTS (SELECT 1 FROM accessory_categories c WHERE c.id = a.category_id AND c.status = 1 AND c.name LIKE '%膜%')
      AND NOT EXISTS (SELECT 1 FROM accessory_template_colors colors WHERE colors.accessory_id = a.id)
      AND (EXISTS (SELECT 1 FROM accessory_compatible_models fm WHERE fm.accessory_id = a.id AND fm.model_id = ?)
        OR (NOT EXISTS (SELECT 1 FROM accessory_compatible_models fm WHERE fm.accessory_id = a.id)
          AND (a.model_id IS NULL OR a.model_id = ?)))
      ORDER BY a.id${lock ? ' FOR UPDATE' : ''}`, [modelId, modelId])
    return rows
  }

  async availableProduct(connection, accessoryId, storeId, { lock = false } = {}) {
    const [rows] = await connection.execute(`SELECT st.quantity,
      (SELECT COUNT(*) FROM accessory_serials sn WHERE sn.accessory_id = a.id AND sn.store_id = st.store_id AND sn.status = 'in_stock') AS serial_quantity
      FROM accessory_stock st JOIN accessories a ON a.id = st.accessory_id
      WHERE st.accessory_id = ? AND st.store_id = ? AND st.quantity > 0${lock ? ' FOR UPDATE' : ''}`, [accessoryId, storeId])
    return rows[0] || null
  }

  async availableProducts(connection, templateId, storeId, { lock = false } = {}) {
    const serialQuantity = lock ? '' : `,
      (SELECT COUNT(*) FROM accessory_serials sn WHERE sn.accessory_id = a.id AND sn.store_id = st.store_id AND sn.status = 'in_stock') AS serial_quantity`
    const [rows] = await connection.execute(`SELECT a.id, st.quantity${serialQuantity}
      FROM accessories a JOIN accessory_stock st ON st.accessory_id = a.id AND st.store_id = ?
      JOIN accessories root ON root.id = COALESCE(a.template_id, a.id) AND root.status = 1
      WHERE st.quantity > 0
      AND (COALESCE(a.template_id, a.id) = ? OR COALESCE(a.template_id, a.id) IN
        (SELECT colors.accessory_id FROM accessory_template_colors colors WHERE colors.template_id = ?))
      ORDER BY a.id${lock ? ' FOR UPDATE' : ''}`, [storeId, templateId, templateId])
    if (lock) {
      // 与已锁定的库存汇总使用同一次当前读，避免混入事务早期的 SN 快照。
      for (const row of rows) {
        row.serial_quantity = await this.accessories.countStockSerials(row.id, storeId, connection)
      }
    }
    return rows
  }

  async product(connection, id, { lock = false } = {}) {
    const [rows] = await connection.execute(`SELECT a.id,
      c.status AS category_status, c.name AS category_name,
      IF(a.template_id IS NULL,a.status,t.status) AS status,
      IF(a.template_id IS NULL,a.model_id,t.model_id) AS model_id,
      IF(a.template_id IS NULL,a.free_film,t.free_film) AS free_film,
      COALESCE(a.template_id,a.id) AS root_id
      FROM accessories a LEFT JOIN accessories t ON t.id = a.template_id
      JOIN accessory_categories c ON c.id = IF(a.template_id IS NULL, a.category_id, t.category_id)
      WHERE a.id = ?${lock ? ' FOR UPDATE' : ''}`, [id])
    return rows[0] || null
  }

  async compatible(connection, product, modelId) {
    const [rows] = await connection.execute('SELECT model_id FROM accessory_compatible_models WHERE accessory_id = ?', [product.root_id])
    return rows.length ? rows.some(row => Number(row.model_id) === modelId) : !product.model_id || Number(product.model_id) === modelId
  }

  async append(connection, row) {
    const [result] = await connection.execute(`INSERT INTO customer_film_services
      (order_id, customer_id, qualification_sale_id, store_id, operator_id, created_by,
       quantity, business_time, created_at, phone_id, model_id, phone_snapshot) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [row.order_id, row.customer_id, row.qualification_sale_id, row.store_id, row.operator_id,
      row.created_by, row.quantity, row.business_time, row.created_at, row.phone_id, row.model_id, JSON.stringify(row.phone_snapshot)])
    return result.insertId
  }

  async history(connection, customerId, { page, page_size: pageSize, phone_id: phoneId = null, sale_type: saleType = 'all' }) {
    const saleExists = `EXISTS (SELECT 1 FROM sales_order_items sale_item WHERE sale_item.order_id = f.order_id
      AND sale_item.item_type = 'accessory'
      AND (COALESCE(JSON_UNQUOTE(JSON_EXTRACT(f.phone_snapshot, '$.automatic')), 'false') NOT IN ('true', '1')
        OR sale_item.linked_phone_sale_id = CAST(JSON_UNQUOTE(JSON_EXTRACT(f.phone_snapshot, '$.sale_id')) AS UNSIGNED))
      AND JSON_UNQUOTE(JSON_EXTRACT(sale_item.snapshot, '$.sale_type')) = 'sale')`
    const giftExists = `EXISTS (SELECT 1 FROM sales_order_items gift_item WHERE gift_item.order_id = f.order_id
      AND gift_item.item_type = 'accessory'
      AND (COALESCE(JSON_UNQUOTE(JSON_EXTRACT(f.phone_snapshot, '$.automatic')), 'false') NOT IN ('true', '1')
        OR gift_item.linked_phone_sale_id = CAST(JSON_UNQUOTE(JSON_EXTRACT(f.phone_snapshot, '$.sale_id')) AS UNSIGNED))
      AND JSON_UNQUOTE(JSON_EXTRACT(gift_item.snapshot, '$.sale_type')) = 'gift')`
    const filter = saleType === 'sale' ? `AND ${saleExists}` : saleType === 'gift' ? `AND NOT ${saleExists} AND ${giftExists}` : ''
    const [[summary]] = await connection.execute(`SELECT COUNT(*) AS total,
      COALESCE(SUM(CASE WHEN ${saleExists} THEN 1 ELSE 0 END), 0) AS paid_count,
      COALESCE(SUM(CASE WHEN NOT ${saleExists} AND ${giftExists} THEN 1 ELSE 0 END), 0) AS free_count,
      COALESCE(SUM(quantity), 0) AS total_quantity,
      COALESCE(SUM(CASE WHEN phone_id = ? THEN 1 ELSE 0 END), 0) AS device_total,
      COALESCE(SUM(CASE WHEN phone_id = ? THEN quantity ELSE 0 END), 0) AS device_total_quantity
      FROM customer_film_services f WHERE customer_id = ?`, [phoneId, phoneId, customerId])
    const totals = { total: Number(summary.total), total_quantity: Number(summary.total_quantity),
      paid_count: Number(summary.paid_count), free_count: Number(summary.free_count),
      device_total: phoneId === null ? null : Number(summary.device_total),
      device_total_quantity: phoneId === null ? null : Number(summary.device_total_quantity) }
    const [rows] = await connection.execute(`SELECT f.id, f.order_id, o.order_no, f.quantity,
      f.store_id, st.name AS store_name, f.operator_id, u.name AS operator_name,
      f.business_time, f.created_at, f.phone_id, f.model_id,
      JSON_UNQUOTE(JSON_EXTRACT(f.phone_snapshot, '$.model_name')) AS phone_model_name,
      JSON_UNQUOTE(JSON_EXTRACT(f.phone_snapshot, '$.sale_id')) AS phone_sale_id,
      JSON_UNQUOTE(JSON_EXTRACT(f.phone_snapshot, '$.automatic')) AS automatic FROM customer_film_services f
      JOIN sales_orders o ON o.id = f.order_id LEFT JOIN stores st ON st.id = f.store_id
      LEFT JOIN users u ON u.id = f.operator_id WHERE f.customer_id = ? ${filter}
      ORDER BY f.id DESC LIMIT ? OFFSET ?`, [customerId, pageSize, (page - 1) * pageSize])
    const filteredTotal = saleType === 'sale' ? totals.paid_count : saleType === 'gift' ? totals.free_count : totals.total
    if (!rows.length) return { rows, ...totals, filtered_total: filteredTotal, items: [] }
    const [items] = await connection.execute(`SELECT i.order_id, i.accessory_id, i.linked_phone_sale_id, i.quantity, i.total_amount,
      JSON_UNQUOTE(JSON_EXTRACT(i.snapshot, '$.name')) AS name,
      COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(i.snapshot, '$.unit')), 'null'), unit.name, t.unit, a.unit) AS unit,
      JSON_UNQUOTE(JSON_EXTRACT(i.snapshot, '$.sale_type')) AS sale_type
      FROM sales_order_items i LEFT JOIN accessories a ON a.id = i.accessory_id
      LEFT JOIN accessories t ON t.id = a.template_id
      LEFT JOIN accessory_units unit ON unit.id = COALESCE(t.unit_id, a.unit_id)
      WHERE i.item_type = 'accessory'
        AND i.order_id IN (${rows.map(() => '?').join(',')}) ORDER BY i.id`, rows.map(row => row.order_id))
    return { rows, ...totals, filtered_total: filteredTotal, items }
  }
}

module.exports = FilmServiceRepository
