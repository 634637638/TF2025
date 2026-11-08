'use strict'

const { getDatabase } = require('../config/database')

class AnalyticsTransfersRepository {
  constructor({ database = getDatabase } = {}) {
    this.database = database
  }

  async getAnalytics({ startDate, endDate, storeId }) {
    const storeFilter = storeId !== null ? ' AND p.store_id = ?' : ''
    const rangeParams = [startDate, endDate]
    const rangeAndStoreParams = storeId !== null ? [...rangeParams, storeId] : rangeParams
    const combinedParams = [...rangeParams, ...rangeParams, ...(storeId !== null ? [storeId] : [])]

    const wholesaleQuery = `
      SELECT COUNT(*) as count,
        COALESCE(SUM(p.wholesale_price), 0) as amount,
        COALESCE(SUM(p.wholesale_price - COALESCE(p.purchase_cost, 0)), 0) as profit
      FROM phones p
      WHERE p.status = 'peer_transfer'
        AND p.wholesale_date IS NOT NULL
        AND DATE(p.wholesale_date) >= ?
        AND DATE(p.wholesale_date) <= ?
        ${storeFilter}
    `
    const allocationQuery = `
      SELECT COUNT(*) as count, COALESCE(SUM(p.purchase_cost), 0) as amount
      FROM phones p
      WHERE p.status = 'supplier_proxy'
        AND p.inventory_time IS NOT NULL
        AND DATE(p.inventory_time) >= ?
        AND DATE(p.inventory_time) <= ?
        ${storeFilter}
    `
    const trendQuery = `
      SELECT date, COUNT(*) as count, SUM(wholesale_count) as wholesale_count,
        SUM(allocation_count) as allocation_count
      FROM (
        SELECT DATE(p.wholesale_date) as date, 1 as wholesale_count, 0 as allocation_count
        FROM phones p
        WHERE p.status = 'peer_transfer'
          AND p.wholesale_date IS NOT NULL
          AND DATE(p.wholesale_date) >= ?
          AND DATE(p.wholesale_date) <= ?
          ${storeFilter}
        UNION ALL
        SELECT DATE(p.inventory_time) as date, 0 as wholesale_count, 1 as allocation_count
        FROM phones p
        WHERE p.status = 'supplier_proxy'
          AND p.inventory_time IS NOT NULL
          AND DATE(p.inventory_time) >= ?
          AND DATE(p.inventory_time) <= ?
          ${storeFilter}
      ) AS combined
      GROUP BY date
      ORDER BY date ASC
    `
    const wholesaleProductRankQuery = `
      SELECT m.name as model_name, b.name as brand_name, COUNT(*) as count,
        COALESCE(SUM(p.wholesale_price), 0) as amount,
        COALESCE(SUM(p.wholesale_price - COALESCE(p.purchase_cost, 0)), 0) as profit
      FROM phones p
      LEFT JOIN models m ON p.model_id = m.id
      LEFT JOIN brands b ON p.brand_id = b.id
      WHERE p.status = 'peer_transfer'
        AND p.wholesale_date IS NOT NULL
        AND DATE(p.wholesale_date) >= ?
        AND DATE(p.wholesale_date) <= ?
        ${storeFilter}
      GROUP BY p.model_id, m.name, b.name
      ORDER BY count DESC
      LIMIT 10
    `
    const allocationProductRankQuery = `
      SELECT m.name as model_name, b.name as brand_name, COUNT(*) as count,
        COALESCE(SUM(p.purchase_cost), 0) as amount
      FROM phones p
      LEFT JOIN models m ON p.model_id = m.id
      LEFT JOIN brands b ON p.brand_id = b.id
      WHERE p.status = 'supplier_proxy'
        AND p.inventory_time IS NOT NULL
        AND DATE(p.inventory_time) >= ?
        AND DATE(p.inventory_time) <= ?
        ${storeFilter}
      GROUP BY p.model_id, m.name, b.name
      ORDER BY count DESC
      LIMIT 10
    `
    const storeDistributionQuery = `
      SELECT p.store_id, s.name as store_name, COUNT(*) as count,
        COALESCE(SUM(CASE WHEN p.status = 'peer_transfer' THEN p.wholesale_price ELSE p.purchase_cost END), 0) as amount,
        SUM(CASE WHEN p.status = 'peer_transfer' THEN 1 ELSE 0 END) as wholesale_count,
        SUM(CASE WHEN p.status = 'supplier_proxy' THEN 1 ELSE 0 END) as allocation_count
      FROM phones p
      LEFT JOIN stores s ON p.store_id = s.id
      WHERE p.status IN ('peer_transfer', 'supplier_proxy')
        AND (
          (p.status = 'peer_transfer' AND p.wholesale_date IS NOT NULL AND DATE(p.wholesale_date) >= ? AND DATE(p.wholesale_date) <= ?)
          OR
          (p.status = 'supplier_proxy' AND p.inventory_time IS NOT NULL AND DATE(p.inventory_time) >= ? AND DATE(p.inventory_time) <= ?)
        )
        ${storeFilter}
      GROUP BY p.store_id, s.name
      ORDER BY amount DESC
    `
    const recentRecordsQuery = `
      SELECT p.id, COALESCE(sal.invoice_number, CONCAT('SALE-', p.sale_id)) as order_no,
        CASE WHEN p.status = 'peer_transfer' THEN 'wholesale' ELSE 'allocation' END as type,
        p.store_id, s.name as from_store_name, COALESCE(sup.name, '-') as supplier_name,
        b.name as brand_name, m.name as model_name, COALESCE(cust.name, '-') as to_store_name,
        CASE WHEN p.status = 'peer_transfer' THEN p.wholesale_price ELSE p.purchase_cost END as amount,
        CASE WHEN p.status = 'peer_transfer' THEN p.wholesale_price - COALESCE(p.purchase_cost, 0) ELSE NULL END as profit,
        'completed' as status,
        CASE WHEN p.status = 'peer_transfer' THEN p.wholesale_date ELSE p.inventory_time END as created_at,
        u.name as operator_name, p.brand_id, p.model_id, p.color_id, c.name as color_name
      FROM phones p
      LEFT JOIN stores s ON p.store_id = s.id
      LEFT JOIN suppliers sup ON p.supplier_id = sup.id
      LEFT JOIN sales sal ON p.sale_id = sal.id
      LEFT JOIN customers cust ON sal.customer_id = cust.id
      LEFT JOIN users u ON p.inventory_operator_id = u.id
      LEFT JOIN brands b ON p.brand_id = b.id
      LEFT JOIN models m ON p.model_id = m.id
      LEFT JOIN colors c ON p.color_id = c.id
      WHERE p.status IN ('peer_transfer', 'supplier_proxy')
        AND (
          (p.status = 'peer_transfer' AND p.wholesale_date IS NOT NULL AND DATE(p.wholesale_date) >= ? AND DATE(p.wholesale_date) <= ?)
          OR
          (p.status = 'supplier_proxy' AND p.inventory_time IS NOT NULL AND DATE(p.inventory_time) >= ? AND DATE(p.inventory_time) <= ?)
        )
        ${storeFilter}
      ORDER BY created_at DESC
      LIMIT 20
    `

    const db = this.database()
    const [wholesale, allocation, trends, wholesaleRanks, allocationRanks, stores, records] = await Promise.all([
      db.execute(wholesaleQuery, rangeAndStoreParams),
      db.execute(allocationQuery, rangeAndStoreParams),
      db.execute(trendQuery, [...rangeAndStoreParams, ...rangeAndStoreParams]),
      db.execute(wholesaleProductRankQuery, rangeAndStoreParams),
      db.execute(allocationProductRankQuery, rangeAndStoreParams),
      db.execute(storeDistributionQuery, combinedParams),
      db.execute(recentRecordsQuery, combinedParams)
    ])
    return {
      wholesale: wholesale[0],
      allocation: allocation[0],
      trends: trends[0],
      wholesaleRanks: wholesaleRanks[0],
      allocationRanks: allocationRanks[0],
      stores: stores[0],
      records: records[0]
    }
  }
}

module.exports = AnalyticsTransfersRepository
