'use strict'

const { getDatabase } = require('../config/database')

class AnalyticsInventoryRepository {
  constructor({ database = getDatabase } = {}) {
    this.database = database
  }

  async getOverviewData({ storeId, supplierId }) {
    const db = this.database()
    const phoneFilters = [storeId, supplierId].filter(value => value !== null)
    const filter = (alias = 'p') => [
      storeId !== null ? `AND ${alias}.store_id = ?` : '',
      supplierId !== null ? `AND ${alias}.supplier_id = ?` : ''
    ].filter(Boolean).join('\n        ')
    const summaryQuery = `
      SELECT
        COUNT(DISTINCT CASE WHEN p.status = 'in_stock' THEN p.id END) as totalProducts,
        COUNT(CASE WHEN p.status = 'in_stock' THEN 1 END) as availableProducts,
        COUNT(CASE WHEN p.status = 'sold' THEN 1 END) as soldProducts,
        COUNT(CASE WHEN p.status = 'reserved' THEN 1 END) as reservedProducts,
        COALESCE(SUM(CASE WHEN p.status = 'in_stock' THEN COALESCE(p.purchase_cost, 0) ELSE 0 END), 0) as totalValue,
        COALESCE(SUM(CASE WHEN p.status = 'in_stock' THEN COALESCE(p.purchase_cost, 0) ELSE 0 END), 0) as availableValue
      FROM phones p
      WHERE 1=1 ${filter()}
    `
    const brandsQuery = `
      SELECT
        b.id,
        b.name as brand_name,
        COUNT(p.id) as totalItems,
        COUNT(CASE WHEN p.status = 'in_stock' THEN 1 END) as availableItems,
        COALESCE(SUM(p.purchase_cost), 0) as totalValue,
        COALESCE(SUM(CASE WHEN p.status = 'in_stock' THEN p.purchase_cost ELSE 0 END), 0) as availableValue
      FROM brands b
      LEFT JOIN phones p ON b.id = p.brand_id ${filter()}
      GROUP BY b.id, b.name
      HAVING totalItems > 0
      ORDER BY totalValue DESC
    `
    const turnoverQuery = `
      SELECT
        COUNT(CASE WHEN p.status = 'sold' AND p.sale_time >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 END) as soldLast30Days,
        COUNT(CASE WHEN p.status = 'in_stock' THEN 1 END) as availableNow
      FROM phones p
      WHERE 1=1 ${filter()}
    `
    const suppliersQuery = `
      SELECT
        s.id,
        s.name,
        COUNT(p.id) as totalProducts,
        COALESCE(SUM(p.purchase_cost), 0) as totalValue,
        AVG(p.sale_price) as avgSalePrice,
        COUNT(CASE WHEN p.status = 'in_stock' THEN 1 END) as availableProducts
      FROM suppliers s
      LEFT JOIN phones p ON s.id = p.supplier_id ${filter()}
      GROUP BY s.id, s.name
      HAVING totalProducts > 0
      ORDER BY totalValue DESC
      LIMIT 10
    `
    const [[summaryRows], [brandRows], [turnoverRows], [supplierRows]] = await Promise.all([
      db.execute(summaryQuery, phoneFilters),
      db.execute(brandsQuery, phoneFilters),
      db.execute(turnoverQuery, phoneFilters),
      db.execute(suppliersQuery, phoneFilters)
    ])
    return { summary: summaryRows[0], brands: brandRows, turnover: turnoverRows[0], suppliers: supplierRows }
  }

  async getTurnoverData({ days, storeId, supplierId }) {
    const db = this.database()
    const storeFilter = storeId !== null ? 'AND store_id = ?' : ''
    const supplierFilter = supplierId !== null ? 'AND supplier_id = ?' : ''
    const filters = [storeId, supplierId].filter(value => value !== null)

    const turnoverTrendQuery = `
      SELECT
        DATE(sale_time) as date,
        COUNT(CASE WHEN status = 'sold' THEN 1 END) as soldCount
      FROM phones
      WHERE sale_time >= DATE_SUB(NOW(), INTERVAL ? DAY)
        AND status = 'sold'
        ${storeFilter}
        ${supplierFilter}
      GROUP BY DATE(sale_time)
      ORDER BY date ASC
    `
    const currentStockQuery = `
      SELECT COUNT(*) as availableCount
      FROM phones
      WHERE status = 'in_stock'
        ${storeFilter}
        ${supplierFilter}
    `

    const [[sales], [stockRows]] = await Promise.all([
      db.execute(turnoverTrendQuery, [days, ...filters]),
      db.execute(currentStockQuery, filters)
    ])

    return { sales, availableCount: stockRows[0]?.availableCount }
  }

  async getSupplierCount({ storeId, supplierId }) {
    const db = this.database()
    const storeFilter = storeId !== null ? 'AND p.store_id = ?' : ''
    const supplierFilter = supplierId !== null ? 'AND p.supplier_id = ?' : ''
    const params = [storeId, supplierId].filter(value => value !== null)
    const [rows] = await db.execute(`
      SELECT COUNT(DISTINCT s.id) as supplierCount
      FROM suppliers s
      INNER JOIN phones p ON s.id = p.supplier_id
      WHERE p.status = 'in_stock'
        AND p.supplier_id IS NOT NULL
        ${storeFilter}
        ${supplierFilter}
    `, params)

    return rows[0]?.supplierCount
  }

  async getInventoryValue(storeId) {
    const db = this.database()
    const [rows] = await db.execute(`
      SELECT
        COALESCE(SUM(purchase_cost), 0) as totalValue,
        COUNT(CASE WHEN status = 'in_stock' THEN 1 END) as availableCount,
        COALESCE(SUM(CASE WHEN status = 'in_stock' THEN purchase_cost ELSE 0 END), 0) as availableValue,
        COUNT(CASE WHEN status = 'sold' THEN 1 END) as soldCount,
        COALESCE(SUM(CASE WHEN status = 'sold' THEN purchase_cost ELSE 0 END), 0) as soldValue,
        COUNT(CASE WHEN status = 'reserved' THEN 1 END) as reservedCount,
        COALESCE(SUM(CASE WHEN status = 'reserved' THEN purchase_cost ELSE 0 END), 0) as reservedValue
      FROM phones
      ${storeId !== null ? 'WHERE store_id = ?' : ''}
    `, storeId !== null ? [storeId] : [])

    return rows[0]
  }

  async getRecentSold({ limit, storeId, supplierId }) {
    const db = this.database()
    const storeFilter = storeId !== null ? 'AND p.store_id = ?' : ''
    const supplierFilter = supplierId !== null ? 'AND p.supplier_id = ?' : ''
    const params = [storeId, supplierId].filter(value => value !== null)
    const [rows] = await db.execute(`
      SELECT
        b.name as brand,
        m.name as model,
        c.name as color,
        p.sale_price as salePrice,
        p.sale_time as saleDate,
        st.name as store
      FROM phones p
      LEFT JOIN brands b ON p.brand_id = b.id
      LEFT JOIN models m ON p.model_id = m.id
      LEFT JOIN colors c ON p.color_id = c.id
      LEFT JOIN stores st ON p.store_id = st.id
      WHERE p.status = 'sold'
        AND p.sale_time IS NOT NULL
        ${storeFilter}
        ${supplierFilter}
      ORDER BY p.sale_time DESC
      LIMIT ?
    `, [...params, limit])

    return rows
  }
}

module.exports = AnalyticsInventoryRepository
