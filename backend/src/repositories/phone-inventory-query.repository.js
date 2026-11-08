'use strict'

const { withConnection } = require('../core/db/connection')

const { getDatabase } = require('../config/database')
const {
  getEffectivePhoneStatusSql,
  isPhoneStatusAlias,
  normalizePhoneStatus
} = require('../utils/phone-status')

class PhoneInventoryQueryRepository {
  constructor(databaseProvider = getDatabase) {
    this.databaseProvider = databaseProvider
  }

  async listInventoryPhones(filters, { page, page_size }) {
    const whereConditions = []
    const queryParams = []

    if (filters.brand_id) {
      whereConditions.push('p.brand_id = ?')
      queryParams.push(parseInt(filters.brand_id))
    }
    if (filters.model_id) {
      whereConditions.push('p.model_id = ?')
      queryParams.push(parseInt(filters.model_id))
    }
    if (filters.store_id) {
      whereConditions.push('p.store_id = ?')
      queryParams.push(parseInt(filters.store_id))
    }
    if (filters.supplier_id) {
      whereConditions.push('p.supplier_id = ?')
      queryParams.push(parseInt(filters.supplier_id))
    }
    if (filters.status) {
      whereConditions.push(`${getEffectivePhoneStatusSql('p')} = ?`)
      queryParams.push(normalizePhoneStatus(filters.status))
    }
    if (filters.condition) {
      whereConditions.push('p.is_new = ?')
      queryParams.push(filters.condition === 'new' ? 1 : 0)
    }
    if (filters.date) {
      if (filters.date.includes(',')) {
        const [startDate, endDate] = filters.date.split(',')
        whereConditions.push('p.inventory_time BETWEEN ? AND ?')
        queryParams.push(startDate.trim(), endDate.trim())
      } else {
        whereConditions.push('DATE(p.inventory_time) = ?')
        queryParams.push(filters.date)
      }
    }

    if (filters.search) {
      const searchStr = filters.search.trim()
      if (/^\d{15}$/.test(searchStr)) {
        whereConditions.push('p.imei = ?')
        queryParams.push(searchStr)
      } else if (/^[A-Za-z0-9]{8,}$/.test(searchStr)) {
        whereConditions.push('UPPER(p.serial_number) LIKE ?')
        queryParams.push(`%${searchStr.toUpperCase()}%`)
      } else if (/^(\d+[Gg][Bb]|1[Tt][Bb])$/.test(searchStr)) {
        whereConditions.push('UPPER(mem.size) LIKE ?')
        queryParams.push(`%${searchStr.toUpperCase()}%`)
      } else if (isPhoneStatusAlias(searchStr)) {
        whereConditions.push(`${getEffectivePhoneStatusSql('p')} = ?`)
        queryParams.push(normalizePhoneStatus(searchStr))
      } else if (['new', 'used', '全新', '二手'].includes(searchStr.toLowerCase())) {
        whereConditions.push('p.is_new = ?')
        queryParams.push(['new', '全新'].includes(searchStr.toLowerCase()) ? 1 : 0)
      } else if (/^[A-C]$/.test(searchStr.toUpperCase())) {
        whereConditions.push('UPPER(p.quality_grade) = ?')
        queryParams.push(searchStr.toUpperCase())
      } else if (/^\d{4}-\d{2}-\d{2}$/.test(searchStr)) {
        whereConditions.push('(DATE(p.inventory_time) = ? OR DATE(p.sale_time) = ?)')
        queryParams.push(searchStr, searchStr)
      } else if (/^\d+$/.test(searchStr)) {
        const price = parseFloat(searchStr)
        whereConditions.push(`(
          p.imei LIKE ? OR
          p.serial_number LIKE ? OR
          b.name LIKE ? OR
          m.name LIKE ? OR
          co.name LIKE ? OR
          mem.size LIKE ? OR
          p.sale_price = ? OR
          p.purchase_cost = ?
        )`)
        const searchTerm = `%${searchStr}%`
        queryParams.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, price, price)
      } else {
        whereConditions.push(`(
          p.imei LIKE ? OR
          p.serial_number LIKE ? OR
          b.name LIKE ? OR
          m.name LIKE ? OR
          co.name LIKE ? OR
          mem.size LIKE ? OR
          p.status LIKE ? OR
          p.quality_grade LIKE ? OR
          p.remarks LIKE ? OR
          st.name LIKE ? OR
          s.name LIKE ? OR
          p.purchase_number LIKE ? OR
          DATE(p.inventory_time) LIKE ? OR
          DATE(p.sale_time) LIKE ?
        )`)
        const searchTerm = `%${searchStr}%`
        queryParams.push(...Array(14).fill(searchTerm))
      }
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : ''
    return withConnection(this.databaseProvider(), async connection => {
      const [countResult] = await connection.execute(`
        SELECT COUNT(*) as total
        FROM phones p
        LEFT JOIN brands b ON p.brand_id = b.id
        LEFT JOIN models m ON p.model_id = m.id
        LEFT JOIN colors co ON p.color_id = co.id
        LEFT JOIN memories mem ON p.memory_id = mem.id
        LEFT JOIN stores st ON p.store_id = st.id
        LEFT JOIN suppliers s ON p.supplier_id = s.id
        ${whereClause}
      `, queryParams)

      const offset = (page - 1) * page_size
      const [phones] = await connection.execute(`
        SELECT p.id, p.imei, p.serial_number, p.brand_id, p.model_id, p.color_id, p.memory_id, p.purchase_cost, p.sale_price, p.is_new, p.status, p.quality_grade, p.remarks, p.purchase_number, p.inventory_operator_id, p.sale_operator_id, p.supplier_id, p.store_id, p.inventory_time, p.sale_time,
               s.name as supplier_name,
               st.name as store_name,
               su.name as sale_operator_name,
               inv_u.name as inventory_operator_name,
               latest_sale.customer_id,
               c.name as customer_name,
               c.phone as customer_phone
        FROM phones p
        LEFT JOIN brands b ON p.brand_id = b.id
        LEFT JOIN models m ON p.model_id = m.id
        LEFT JOIN colors co ON p.color_id = co.id
        LEFT JOIN memories mem ON p.memory_id = mem.id
        LEFT JOIN suppliers s ON p.supplier_id = s.id
        LEFT JOIN stores st ON p.store_id = st.id
        LEFT JOIN users su ON p.sale_operator_id = su.id
        LEFT JOIN users inv_u ON p.inventory_operator_id = inv_u.id
        LEFT JOIN (
          SELECT
            s.customer_id,
            s.phone_id,
            ROW_NUMBER() OVER (PARTITION BY s.phone_id ORDER BY s.created_at DESC) as rn
          FROM sales s
        ) latest_sale ON p.id = latest_sale.phone_id AND latest_sale.rn = 1
        LEFT JOIN customers c ON latest_sale.customer_id = c.id
        ${whereClause}
        ORDER BY p.inventory_time DESC
        LIMIT ? OFFSET ?
      `, [...queryParams, page_size, offset])

      return { phones, total: countResult[0].total }
    })
  }

  async getUsedModelRows(keyword) {
    const conditions = [
      "p.status = 'in_stock'",
      'p.is_new = 0',
      'COALESCE(p.is_preordered, 0) = 0'
    ]
    const params = []
    if (keyword) {
      conditions.push('(b.name LIKE ? OR m.name LIKE ? OR c.name LIKE ? OR mem.size LIKE ?)')
      params.push(...Array(4).fill(`%${keyword}%`))
    }

    return withConnection(this.databaseProvider(), async connection => {
      const [rows] = await connection.execute(`
        SELECT
          p.brand_id,
          p.model_id,
          p.color_id,
          p.memory_id,
          b.name AS brand_name,
          m.name AS model_name,
          c.name AS color_name,
          mem.size AS memory,
          COUNT(*) AS stock_quantity,
          p.purchase_cost AS inventory_price
        FROM phones p
        INNER JOIN brands b ON b.id = p.brand_id
        INNER JOIN models m ON m.id = p.model_id
        LEFT JOIN colors c ON c.id = p.color_id
        LEFT JOIN memories mem ON mem.id = p.memory_id
        WHERE ${conditions.join(' AND ')}
        GROUP BY p.brand_id, p.model_id, p.color_id, p.memory_id,
                 b.name, m.name, c.name, mem.size, p.purchase_cost,
                 b.id, m.id, c.id, mem.id,
                 b.sort_order, m.sort_order, c.sort_order, mem.sort_order
        ORDER BY b.sort_order ASC, b.name ASC, b.id ASC,
                 m.sort_order ASC, m.name ASC, m.id ASC,
                 c.sort_order ASC, c.name ASC, c.id ASC,
                 mem.sort_order ASC, mem.size ASC, mem.id ASC,
                 p.purchase_cost ASC
      `, params)
      return rows
    })
  }

  async getLongestInventoryRows(filters) {
    const conditions = ['p.status = "in_stock"', 'p.is_new = ?']
    const params = [filters.is_new]
    if (filters.purchase_cost_is_null) {
      conditions.push('p.purchase_cost IS NULL')
    } else if (filters.purchase_cost !== undefined) {
      conditions.push('p.purchase_cost = ?')
      params.push(filters.purchase_cost)
    }

    for (const field of ['brand_id', 'model_id', 'color_id', 'memory_id', 'store_id']) {
      if (filters[field] !== undefined) {
        conditions.push(`p.${field} = ?`)
        params.push(filters[field])
      }
    }

    return withConnection(this.databaseProvider(), async connection => {
      const [rows] = await connection.execute(`
        SELECT
          p.id,
          p.imei,
          p.serial_number,
          st.name as store_name,
          supp.name as supplier_name,
          p.inventory_time as inventory_time,
          DATE_FORMAT(p.inventory_time, '%Y-%m-%d') as inventory_date
        FROM phones p
          LEFT JOIN stores st ON p.store_id = st.id
          LEFT JOIN suppliers supp ON p.supplier_id = supp.id
        WHERE ${conditions.join(' AND ')}
        ORDER BY p.inventory_time ASC
      `, params)
      return rows
    })
  }

  async getSoldTimeline() {
    return withConnection(this.databaseProvider(), async connection => {
      const [rows] = await connection.execute(`
        SELECT
          p.id,
          b.name as brand,
          m.name as model,
          co.name as color,
          mem.size as memory,
          p.inventory_time as inventory_time,
          latest_sale.sale_time as sale_time,
          c.name as customer_name,
          c.phone as customer_phone,
          st.name as store_name
        FROM phones p
        LEFT JOIN brands b ON p.brand_id = b.id
        LEFT JOIN models m ON p.model_id = m.id
        LEFT JOIN colors co ON p.color_id = co.id
        LEFT JOIN memories mem ON p.memory_id = mem.id
        LEFT JOIN (
          SELECT
            s.*,
            ROW_NUMBER() OVER (PARTITION BY s.phone_id ORDER BY s.created_at DESC) as rn
          FROM sales s
        ) latest_sale ON p.id = latest_sale.phone_id AND latest_sale.rn = 1
        LEFT JOIN customers c ON latest_sale.customer_id = c.id
        LEFT JOIN stores st ON p.store_id = st.id
        WHERE p.status = 'sold'
        ORDER BY latest_sale.sale_time DESC
      `, [])
      return rows
    })
  }

  async searchByIdentifier(searchKeyword) {
    return withConnection(this.databaseProvider(), async connection => {
      const selectFields = `
        p.id,
        p.imei,
        p.serial_number,
        b.name as brand_name,
        m.name as model_name,
        co.name as color_name,
        mem.size as memory_size,
        p.purchase_cost,
        p.sale_price,
        p.is_new,
        p.inventory_time,
        p.status,
        p.sale_time,
        st.name as store_name,
        st.id as store_id
      `
      const joins = `
        FROM phones p
        LEFT JOIN brands b ON p.brand_id = b.id
        LEFT JOIN models m ON p.model_id = m.id
        LEFT JOIN colors co ON p.color_id = co.id
        LEFT JOIN memories mem ON p.memory_id = mem.id
        LEFT JOIN stores st ON p.store_id = st.id
      `
      const [exactResults] = await connection.execute(`
        SELECT ${selectFields}
        ${joins}
        WHERE p.imei = ? OR p.serial_number = ?
        LIMIT 1
      `, [searchKeyword, searchKeyword])
      if (exactResults.length > 0) {
        return { exact: exactResults[0], fuzzy: [] }
      }

      const fuzzyPattern = `%${searchKeyword}%`
      const [fuzzyResults] = await connection.execute(`
        SELECT ${selectFields}
        ${joins}
        WHERE p.imei LIKE ? OR p.serial_number LIKE ?
        ORDER BY
          CASE
            WHEN p.imei = ? THEN 1
            WHEN p.serial_number = ? THEN 1
            WHEN p.imei LIKE ? THEN 2
            WHEN p.serial_number LIKE ? THEN 2
            ELSE 3
          END
        LIMIT 10
      `, [
        fuzzyPattern, fuzzyPattern,
        searchKeyword, searchKeyword,
        `${searchKeyword}%`, `${searchKeyword}%`
      ])
      return { exact: null, fuzzy: fuzzyResults }
    })
  }

  async getPhoneDetails(id) {
    return withConnection(this.databaseProvider(), async connection => {
      const [rows] = await connection.execute(`
        SELECT
          p.id,
          p.imei,
          p.serial_number,
          p.brand_id,
          p.model_id,
          p.color_id,
          p.memory_id,
          p.purchase_cost,
          p.sale_price,
          p.is_new,
          p.status,
          p.quality_grade,
          p.remarks,
          p.purchase_number,
          p.inventory_operator_id,
          p.sale_operator_id as phone_sale_operator_id,
          p.supplier_id,
          p.store_id as inventory_store_id,
          p.inventory_time,
          p.sale_time,
          b.name as brand,
          m.name as model,
          co.name as color,
          mem.size as memory,
          s.name as supplier_name,
          st.name as inventory_store_name,
          inv_u.name as inventory_operator_name,
          latest_sale.customer_id,
          c.name as customer_name,
          c.phone as customer_phone,
          c.apple_id as customer_apple_id,
          COALESCE(sales_operator.name, su.name) as sale_operator_name,
          COALESCE(latest_sale.operator_id, p.sale_operator_id) as sale_operator_id,
          latest_sale.sale_type,
          latest_sale.payment_method,
          latest_sale.invoice_number,
          latest_sale.store_id as sale_store_id,
          sale_st.name as sale_store_name
        FROM phones p
        LEFT JOIN brands b ON p.brand_id = b.id
        LEFT JOIN models m ON p.model_id = m.id
        LEFT JOIN colors co ON p.color_id = co.id
        LEFT JOIN memories mem ON p.memory_id = mem.id
        LEFT JOIN suppliers s ON p.supplier_id = s.id
        LEFT JOIN stores st ON p.store_id = st.id
        LEFT JOIN users su ON p.sale_operator_id = su.id
        LEFT JOIN users inv_u ON p.inventory_operator_id = inv_u.id
        LEFT JOIN (
          SELECT
            s.id,
            s.customer_id,
            s.phone_id,
            s.operator_id,
            s.sale_type,
            s.payment_method,
            s.invoice_number,
            s.store_id,
            ROW_NUMBER() OVER (PARTITION BY s.phone_id ORDER BY s.created_at DESC) as rn
          FROM sales s
        ) latest_sale ON p.id = latest_sale.phone_id AND latest_sale.rn = 1
        LEFT JOIN customers c ON latest_sale.customer_id = c.id
        LEFT JOIN users sales_operator ON latest_sale.operator_id = sales_operator.id
        LEFT JOIN stores sale_st ON latest_sale.store_id = sale_st.id
        WHERE p.id = ?
      `, [id])
      return rows
    })
  }
}

module.exports = PhoneInventoryQueryRepository
