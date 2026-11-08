'use strict'

const { getDatabase } = require('../config/database')
const { withConnection } = require('../core/db/connection')
const { PREORDER_RESPONSE_FIELDS, PREORDER_STATUS_LABELS } = require('../config/preorder-response.constants')

const REFERENCE_COLUMNS = {
  store_id: 'p.store_id',
  brand_id: 'p.brand_id',
  model_id: 'p.model_id',
  color_id: 'p.color_id',
  memory_id: 'p.memory_id'
}

class PreorderReadRepository {
  constructor({ database = getDatabase } = {}) {
    this.database = database
  }

  async getStats() {
    return withConnection(this.database(), async connection => {
      const [rows] = await connection.execute(`
        SELECT
          SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_count,
          SUM(CASE WHEN status = 'arrived' THEN 1 ELSE 0 END) as matched_count,
          SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as delivered_count,
          SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled_count
        FROM preorders
      `)
      return rows[0]
    })
  }

  async getById(id, executor = null) {
    const read = async connection => {
      const [records] = await connection.execute(`
        SELECT
          ${PREORDER_RESPONSE_FIELDS.map(field => `p.${field}`).join(',\n          ')},
          c.name as customer_name,
          c.phone as customer_phone,
          COALESCE(creator.name, creator.username) as preorder_person_name,
          COALESCE(sale_operator.name, sale_operator.username) as sales_operator_name,
          COALESCE(sale_operator.name, sale_operator.username) as operator_name,
          br.name as brand_name,
          mo.name as model_name,
          co.name as color_name,
          me.size as memory_size,
          CASE
            WHEN p.status = 'pending' THEN '${PREORDER_STATUS_LABELS.pending}'
            WHEN p.status = 'arrived' THEN '${PREORDER_STATUS_LABELS.arrived}'
            WHEN p.status = 'completed' THEN '${PREORDER_STATUS_LABELS.completed}'
            WHEN p.status = 'cancelled' THEN '${PREORDER_STATUS_LABELS.cancelled}'
            ELSE p.status
          END as status_text,
          CONCAT(COALESCE(br.name, ''), ' ', COALESCE(mo.name, ''), ' ', COALESCE(co.name, ''), ' ', COALESCE(me.size, '')) as product_name,
          CASE WHEN p.actual_price IS NOT NULL THEN p.actual_price - p.deposit_amount ELSE NULL END as remaining_amount
        FROM preorders p
        LEFT JOIN customers c ON p.customer_id = c.id
        LEFT JOIN users creator ON p.created_by = creator.id
        LEFT JOIN users sale_operator ON p.operator_id = sale_operator.id
        LEFT JOIN brands br ON p.brand_id = br.id
        LEFT JOIN models mo ON p.model_id = mo.id
        LEFT JOIN colors co ON p.color_id = co.id
        LEFT JOIN memories me ON p.memory_id = me.id
        WHERE p.id = ?
      `, [id])
      return records[0] || null
    }
    return executor ? read(executor) : withConnection(this.database(), read)
  }

  async list({ filters, page, pageSize }) {
    const conditions = ['1=1']
    const params = []

    if (filters.status) {
      conditions.push('p.status = ?')
      params.push(filters.status)
    } else {
      conditions.push("p.status IN ('pending', 'arrived', 'cancelled')")
    }

    if (filters.customer_id) {
      conditions.push('p.customer_id = ?')
      params.push(filters.customer_id)
    }

    for (const [field, column] of Object.entries(REFERENCE_COLUMNS)) {
      if (!filters[field]) continue
      conditions.push(`${column} = ?`)
      params.push(filters[field])
    }

    if (filters.search) {
      conditions.push(`(
        (CONVERT(c.name USING utf8mb4) COLLATE utf8mb4_unicode_ci)
          LIKE (CONVERT(? USING utf8mb4) COLLATE utf8mb4_unicode_ci) OR
        (CONVERT(c.phone USING utf8mb4) COLLATE utf8mb4_unicode_ci)
          LIKE (CONVERT(? USING utf8mb4) COLLATE utf8mb4_unicode_ci) OR
        (CONVERT(p.preorder_number USING utf8mb4) COLLATE utf8mb4_unicode_ci)
          LIKE (CONVERT(? USING utf8mb4) COLLATE utf8mb4_unicode_ci) OR
        (CONVERT(ph.imei USING utf8mb4) COLLATE utf8mb4_unicode_ci)
          LIKE (CONVERT(? USING utf8mb4) COLLATE utf8mb4_unicode_ci) OR
        (CONVERT(ph.serial_number USING utf8mb4) COLLATE utf8mb4_unicode_ci)
          LIKE (CONVERT(? USING utf8mb4) COLLATE utf8mb4_unicode_ci) OR
        (CONVERT(CONCAT(
          COALESCE(br.name, ''), ' ',
          COALESCE(mo.name, ''), ' ',
          COALESCE(co.name, ''), ' ',
          COALESCE(me.size, '')
        ) USING utf8mb4) COLLATE utf8mb4_unicode_ci)
          LIKE (CONVERT(? USING utf8mb4) COLLATE utf8mb4_unicode_ci)
      )`)
      const searchParam = `%${filters.search}%`
      params.push(searchParam, searchParam, searchParam, searchParam, searchParam, searchParam)
    }

    if (filters.start_date) {
      conditions.push('p.created_at >= ?')
      params.push(filters.start_date)
    }
    if (filters.end_date) {
      conditions.push('p.created_at < DATE_ADD(?, INTERVAL 1 DAY)')
      params.push(filters.end_date)
    }

    const fromAndJoins = `
      FROM preorders p
      LEFT JOIN customers c ON p.customer_id = c.id
      LEFT JOIN brands br ON p.brand_id = br.id
      LEFT JOIN models mo ON p.model_id = mo.id
      LEFT JOIN colors co ON p.color_id = co.id
      LEFT JOIN memories me ON p.memory_id = me.id
      LEFT JOIN phones ph ON p.matched_phone_id = ph.id
    `
    const whereClause = conditions.join(' AND ')
    return withConnection(this.database(), async connection => {
      const [countResult] = await connection.execute(
        `SELECT COUNT(*) as total ${fromAndJoins} WHERE ${whereClause}`,
        params
      )
      const offset = (page - 1) * pageSize
      const [records] = await connection.execute(`
        SELECT
          ${PREORDER_RESPONSE_FIELDS.map(field => `p.${field}`).join(',\n          ')},
          c.name as customer_name,
          c.phone as customer_phone,
          COALESCE(creator.name, creator.username) as preorder_person_name,
          COALESCE(sale_operator.name, sale_operator.username) as sales_operator_name,
          COALESCE(sale_operator.name, sale_operator.username) as operator_name,
          st.name as store_name,
          br.name as brand_name,
          mo.name as model_name,
          co.name as color_name,
          me.size as memory_size,
          ph.supplier_id,
          s.name as supplier_name,
          CASE
            WHEN p.status = 'pending' THEN '${PREORDER_STATUS_LABELS.pending}'
            WHEN p.status = 'arrived' THEN '${PREORDER_STATUS_LABELS.arrived}'
            WHEN p.status = 'completed' THEN '${PREORDER_STATUS_LABELS.completed}'
            WHEN p.status = 'cancelled' THEN '${PREORDER_STATUS_LABELS.cancelled}'
            ELSE p.status
          END as status_text,
          CONCAT(COALESCE(br.name, ''), ' ', COALESCE(mo.name, ''), ' ', COALESCE(co.name, ''), ' ', COALESCE(me.size, '')) as product_name,
          CASE WHEN p.actual_price IS NOT NULL THEN p.actual_price - p.deposit_amount ELSE NULL END as remaining_amount
        ${fromAndJoins}
        LEFT JOIN users creator ON p.created_by = creator.id
        LEFT JOIN users sale_operator ON p.operator_id = sale_operator.id
        LEFT JOIN stores st ON p.store_id = st.id
        LEFT JOIN suppliers s ON ph.supplier_id = s.id
        WHERE ${whereClause}
        ORDER BY p.status = 'pending' DESC, p.created_at DESC
        LIMIT ? OFFSET ?
      `, [...params, String(pageSize), String(offset)])
      return { records, total: countResult[0].total }
    })
  }

  async getStores() {
    return withConnection(this.database(), async connection => {
      const [stores] = await connection.query(
        'SELECT id, name, sort_order FROM stores WHERE status = 1 ORDER BY sort_order ASC, name ASC, id ASC'
      )
      return stores
    })
  }

  async getMatchablePreorders({ brand_id, model_id, color_id, memory_id, store_id }) {
    return withConnection(this.database(), async connection => {
      const conditions = [
        "p.status = 'pending'",
        '(p.brand_id = ? AND p.model_id = ? AND p.color_id = ? AND p.memory_id = ?)'
      ]
      const params = [brand_id, model_id, color_id, memory_id]
      if (store_id) {
        conditions.push('(p.store_id IS NULL OR p.store_id = ?)')
        params.push(store_id)
      }

      const [rows] = await connection.execute(`
        SELECT
          p.id,
          p.preorder_number,
          p.customer_id,
          p.brand_id,
          p.model_id,
          p.color_id,
          p.memory_id,
          c.name as customer_name,
          c.phone as customer_phone,
          br.name as brand_name,
          mo.name as model_name,
          co.name as color_name,
          me.size as memory_size,
          CONCAT(COALESCE(br.name, ''), ' ', COALESCE(mo.name, ''), ' ', COALESCE(co.name, ''), ' ', COALESCE(me.size, '')) as product_name,
          p.deposit_amount,
          p.total_price,
          p.created_at,
          DATEDIFF(COALESCE(p.expected_arrival, DATE_ADD(p.created_at, INTERVAL 30 DAY)), CURDATE()) as days_remaining,
          COALESCE(creator.name, creator.username) as preorder_person_name,
          COALESCE(sale_operator.name, sale_operator.username) as sales_operator_name,
          COALESCE(sale_operator.name, sale_operator.username) as operator_name
        FROM preorders p
        LEFT JOIN customers c ON p.customer_id = c.id
        LEFT JOIN users creator ON p.created_by = creator.id
        LEFT JOIN users sale_operator ON p.operator_id = sale_operator.id
        LEFT JOIN brands br ON p.brand_id = br.id
        LEFT JOIN models mo ON p.model_id = mo.id
        LEFT JOIN colors co ON p.color_id = co.id
        LEFT JOIN memories me ON p.memory_id = me.id
        WHERE ${conditions.join(' AND ')}
        ORDER BY p.created_at ASC
        LIMIT 10
      `, params)
      return rows
    })
  }

  async withConnection(callback) {
    return withConnection(this.database, callback)
  }

  async getPreorderForMatching(connection, id) {
    const [preorders] = await connection.execute(
      `SELECT id, status, matched_phone_id, brand_id, model_id, color_id, memory_id, is_new
       FROM preorders
       WHERE id = ?`,
      [id]
    )
    return preorders[0] || null
  }

  async getCandidatePhones(connection, preorder) {
    const [phones] = await connection.execute(
      `SELECT
         p.id,
         p.imei,
         p.serial_number,
         p.purchase_cost,
         p.is_new,
         CASE WHEN p.id = ? THEN 1 ELSE 0 END AS is_current,
         b.name AS brand_name,
         m.name AS model_name,
         c.name AS color_name,
         mem.size AS memory_size,
         st.name AS store_name
       FROM phones p
       LEFT JOIN brands b ON p.brand_id = b.id
       LEFT JOIN models m ON p.model_id = m.id
       LEFT JOIN colors c ON p.color_id = c.id
       LEFT JOIN memories mem ON p.memory_id = mem.id
       LEFT JOIN stores st ON p.store_id = st.id
       WHERE p.status IN ('in_stock', 'reserved')
         AND (COALESCE(p.is_preordered, 0) = 0 OR p.id = ?)
         AND NOT EXISTS (
           SELECT 1
           FROM preorders active_preorder
           WHERE active_preorder.matched_phone_id = p.id
             AND active_preorder.status IN ('pending', 'arrived')
             AND active_preorder.id <> ?
         )
         AND p.brand_id = ?
         AND p.model_id = ?
         AND p.color_id = ?
         AND p.memory_id = ?
         AND p.is_new = ?
       ORDER BY p.inventory_time ASC, p.id ASC`,
      [
        preorder.matched_phone_id || 0,
        preorder.matched_phone_id || 0,
        preorder.id,
        preorder.brand_id,
        preorder.model_id,
        preorder.color_id,
        preorder.memory_id,
        Number(preorder.is_new) === 0 ? 0 : 1
      ]
    )
    return phones
  }
}

module.exports = PreorderReadRepository
