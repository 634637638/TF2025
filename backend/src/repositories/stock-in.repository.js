'use strict'

const { appendStoreScopeCondition, resolveStoreScope } = require('../utils/store-scope')
const STOCK_IN_SELECT = `
  SELECT
    p.id,
    p.imei,
    p.serial_number,
    p.purchase_cost,
    p.store_id,
    s.name as store_name,
    p.supplier_id,
    supp.name as supplier_name,
    p.inventory_operator_id,
    u.name as operator_name,
    u.username as operator_username,
    p.status,
    p.is_new,
    p.inventory_time as inventory_time,
    p.purchase_number,
    p.remarks,
    p.sale_time as sale_time,
    p.payment_status,
    p.payment_time,
    b.name as brand_name,
    m.name as model_name,
    c.name as color_name,
    mem.size as memory_name
  FROM phones p
  LEFT JOIN stores s ON p.store_id = s.id
  LEFT JOIN suppliers supp ON p.supplier_id = supp.id
  LEFT JOIN users u ON p.inventory_operator_id = u.id
  LEFT JOIN brands b ON p.brand_id = b.id
  LEFT JOIN models m ON p.model_id = m.id
  LEFT JOIN colors c ON p.color_id = c.id
  LEFT JOIN memories mem ON p.memory_id = mem.id
`


class StockInRepository {
  async list(connection, actor, query) {
    const { search, product_type, brand_id, store_id, supplier_id, start_date, end_date } = query
    const page = Math.max(1, parseInt(query.page, 10) || 1)
    const page_size = Math.min(200, Math.max(1, parseInt(query.page_size, 10) || 20))

    const whereConditions = []
    const params = []
    const storeScope = resolveStoreScope(actor, store_id)
    appendStoreScopeCondition(storeScope, 'p.store_id', whereConditions, params)
    if (product_type === 'new') whereConditions.push('p.is_new = 1')
    else if (product_type === 'used') whereConditions.push('p.is_new = 0')
    if (brand_id) {
      whereConditions.push('p.brand_id = ?')
      params.push(parseInt(brand_id, 10))
    }
    if (supplier_id) {
      whereConditions.push('p.supplier_id = ?')
      params.push(parseInt(supplier_id, 10))
    }
    if (search) {
      whereConditions.push(`(
          p.serial_number LIKE ? OR
          p.purchase_number LIKE ? OR
          p.imei LIKE ? OR
          b.name LIKE ? OR
          m.name LIKE ? OR
          c.name LIKE ? OR
          mem.size LIKE ? OR
          p.remarks LIKE ? OR
          s.name LIKE ? OR
          supp.name LIKE ? OR
          u.name LIKE ? OR
          u.username LIKE ?
        )`)
      const searchParam = `%${search}%`
      params.push(...Array(12).fill(searchParam))
    }
    if (start_date) {
      whereConditions.push('p.inventory_time >= ?')
      params.push(start_date)
    }
    if (end_date) {
      whereConditions.push('p.inventory_time <= ?')
      params.push(end_date)
    }
    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : ''
    const joins = `
        FROM phones p
        LEFT JOIN stores s ON p.store_id = s.id
        LEFT JOIN suppliers supp ON p.supplier_id = supp.id
        LEFT JOIN users u ON p.inventory_operator_id = u.id
        LEFT JOIN brands b ON p.brand_id = b.id
        LEFT JOIN models m ON p.model_id = m.id
        LEFT JOIN colors c ON p.color_id = c.id
        LEFT JOIN memories mem ON p.memory_id = mem.id
      `
    const [countResult] = await connection.execute(`SELECT COUNT(*) as total ${joins} ${whereClause}`, params)
    const total = Number(countResult[0].total)
    const offset = (page - 1) * page_size
    const listSql = `${STOCK_IN_SELECT} ${whereClause}
        ORDER BY p.inventory_time DESC, p.id DESC
        LIMIT ? OFFSET ?`
    const [records] = await connection.query(listSql, [...params, page_size, offset])
    return { records, total, page, page_size }
  }

  async detail(connection, actor, query, id) {
    const storeScope = resolveStoreScope(actor, query.store_id)
    const scopeConditions = ['p.id = ?']
    const scopeParams = [id]
    appendStoreScopeCondition(storeScope, 'p.store_id', scopeConditions, scopeParams)
    const [records] = await connection.execute(
      `${STOCK_IN_SELECT} WHERE ${scopeConditions.join(' AND ')}`,
      scopeParams
    )
    return records[0] || null
  }

  async overview(connection, actor, query) {
    const { store_id, start_date, end_date } = query

    const whereConditions = []
    const params = []
    const storeScope = resolveStoreScope(actor, store_id)
    appendStoreScopeCondition(storeScope, 'p.store_id', whereConditions, params)
    if (start_date) {
      whereConditions.push('p.inventory_time >= ?')
      params.push(start_date)
    }
    if (end_date) {
      whereConditions.push('p.inventory_time <= ?')
      params.push(end_date)
    }
    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : ''

    const statsQuery = `
      SELECT
        COUNT(*) as total_items,
        SUM(p.purchase_cost) as total_value,
        COUNT(CASE WHEN DATE(p.inventory_time) = CURDATE() THEN 1 END) as today_stock_in,
        COUNT(CASE WHEN p.is_new = 1 THEN 1 END) as new_items,
        COUNT(CASE WHEN p.is_new = 0 THEN 1 END) as used_items,
        COUNT(CASE WHEN p.status = 'in_stock' THEN 1 END) as in_stock_items,
        COUNT(CASE WHEN p.status = 'sold' THEN 1 END) as sold_items,
        COUNT(CASE WHEN p.payment_status = 'paid' THEN 1 END) as settled_count,
        COUNT(CASE WHEN p.payment_status = 'unpaid' THEN 1 END) as unsettled_count,
        COUNT(CASE WHEN p.payment_status IS NULL THEN 1 END) as unknown_payment_count
      FROM phones p
      ${whereClause}
    `
    const [statsResult] = await connection.execute(statsQuery, params)
    const stats = statsResult[0]

    const storeStatsQuery = `
      SELECT s.name as store_name, COUNT(*) as count
      FROM phones p
      LEFT JOIN stores s ON p.store_id = s.id
      ${whereClause}
      GROUP BY p.store_id, s.name
      ORDER BY count DESC
    `
    const [storeStats] = await connection.execute(storeStatsQuery, params)
    const by_store = {}
    storeStats.forEach(row => {
      if (row.store_name !== null && row.store_name !== undefined) by_store[row.store_name] = Number(row.count)
    })

    const brandStatsQuery = `
      SELECT b.name as brand_name, COUNT(*) as count
      FROM phones p
      LEFT JOIN brands b ON p.brand_id = b.id
      ${whereClause}
      GROUP BY b.id, b.name
      ORDER BY count DESC
    `
    const [brandStats] = await connection.execute(brandStatsQuery, params)
    const by_brand = {}
    brandStats.forEach(row => {
      if (row.brand_name !== null && row.brand_name !== undefined) by_brand[row.brand_name] = Number(row.count)
    })

    return {
      today_stock_in: Number(stats.today_stock_in),
      total_items: Number(stats.total_items),
      total_value: stats.total_value === null || stats.total_value === undefined ? null : Number(stats.total_value),
      new_items: Number(stats.new_items),
      used_items: Number(stats.used_items),
      in_stock_items: Number(stats.in_stock_items),
      sold_items: Number(stats.sold_items),
      settled_count: Number(stats.settled_count),
      unsettled_count: Number(stats.unsettled_count),
      unknown_payment_count: Number(stats.unknown_payment_count),
      by_store,
      by_brand
    }
  }

  findOperator(connection, values) { return connection.execute('SELECT name, username FROM users WHERE id = ? LIMIT 1', values) }
  findExistingPhones(connection, products) { return connection.query(`SELECT id, imei, status FROM phones WHERE imei IN (${products.map(() => '?').join(', ')})`, products.map(product => product.imei)) }
  insertPhone(connection, values) { return connection.execute(`INSERT INTO phones (
            purchase_number, inventory_operator_id, brand_id, model_id, color_id, memory_id,
            imei, serial_number, purchase_cost, sale_price, is_new, supplier_id, store_id, status,
            quality_grade, remarks, inventory_time, sale_time
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, values) }
  publishUsedPhone(connection, values) { return connection.execute(`INSERT INTO H5_product (phone_id, is_published, created_at, updated_at) VALUES (?, ?, NOW(), NOW())
             ON DUPLICATE KEY UPDATE is_published = VALUES(is_published), updated_at = NOW()`, values) }
  findPendingPreorder(connection, values) { return connection.execute(`
            SELECT
              p.id,
              p.preorder_number,
              p.customer_id,
              c.name AS customer_name,
              c.phone AS customer_phone,
              p.brand_id,
              p.model_id,
              p.color_id,
              p.memory_id,
              p.is_new,
              p.deposit_amount,
              p.total_price
            FROM preorders p
            LEFT JOIN customers c ON c.id = p.customer_id
            WHERE p.status = 'pending'
              AND p.matched_phone_id IS NULL
              AND p.store_id = ?
              AND p.brand_id = ?
              AND p.model_id = ?
              AND p.color_id = ?
              AND p.memory_id = ?
              AND p.is_new = ?
            ORDER BY p.created_at ASC
            LIMIT 1
            FOR UPDATE
          `, values) }
  matchPreorder(connection, values) { return connection.execute(`
              UPDATE preorders SET
                status = 'arrived',
                matched_phone_id = ?,
                imei = ?,
                matched_time = NOW(),
                updated_at = NOW()
              WHERE id = ? AND status = 'pending' AND matched_phone_id IS NULL
            `, values) }
  markPreorderedPhone(connection, values) { return connection.execute(`
              UPDATE phones SET is_preordered = 1
              WHERE id = ? AND COALESCE(is_preordered, 0) = 0
            `, values) }
  lockPhone(connection, values) { return connection.execute('SELECT id, store_id FROM phones WHERE id = ? FOR UPDATE', values) }
  updateRecord(connection, id, storeScope, updateFields, values) {
    const scopeConditions = ['id = ?']
    const scopeParams = [id]
    appendStoreScopeCondition(storeScope, 'store_id', scopeConditions, scopeParams)
    return connection.execute(`
        UPDATE phones
        SET ${updateFields.join(', ')}
        WHERE ${scopeConditions.join(' AND ')}
      `, [...values, ...scopeParams])
  }
  getUpdatedRecord(connection, values) { return connection.execute(`
        SELECT
          id, brand_id, model_id, color_id, memory_id, imei, serial_number,
          is_new, status, supplier_id, store_id, purchase_cost, sale_price,
          inventory_time AS inventory_time, sale_time AS sale_time,
          inventory_operator_id, sale_operator_id, purchase_number, remarks
        FROM phones
        WHERE id = ?
      `, values) }
  deleteScoped(connection, id, storeScope) {
    const scopeConditions = ['id = ?']
    const scopeParams = [id]
    appendStoreScopeCondition(storeScope, 'store_id', scopeConditions, scopeParams)
    return connection.execute(`DELETE FROM phones WHERE ${scopeConditions.join(' AND ')}`, scopeParams)
  }
  async loadReferenceMap(connection, table, valueColumn, ids) {
    const allowed = { brands: 'name', models: 'name', colors: 'name', memories: 'size' }
    if (!Object.hasOwn(allowed, table) || allowed[table] !== valueColumn) throw new Error('无效的入库参考字段')
    const uniqueIds = [...new Set(ids.map(Number).filter(Number.isInteger))]
    const placeholders = uniqueIds.map(() => '?').join(', ')
    const [rows] = await connection.query(`SELECT id, ${valueColumn} AS value FROM ${table} WHERE id IN (${placeholders})`, uniqueIds)
    return new Map(rows.map(row => [Number(row.id), row.value]))
  }
}
module.exports = StockInRepository
