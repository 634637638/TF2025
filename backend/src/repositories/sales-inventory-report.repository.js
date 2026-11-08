'use strict'

const { getDatabase } = require('../config/database')

class SalesInventoryReportRepository {
  constructor({ getDb = getDatabase } = {}) {
    if (typeof getDb !== 'function') throw new TypeError('SalesInventoryReportRepository requires getDb')
    this.getDb = getDb
  }

  async findReferenceId(resource, value) {
    const queries = {
      brand: 'SELECT id FROM brands WHERE LOWER(TRIM(name)) = LOWER(?)',
      color: 'SELECT id FROM colors WHERE LOWER(TRIM(name)) = LOWER(?)',
      memory: 'SELECT id FROM memories WHERE TRIM(size) = ?'
    }
    const query = queries[resource]
    if (!query) throw new Error(`不支持的库存筛选基础资料: ${resource}`)
    const [rows] = await (await this.getDb()).execute(query, [String(value ?? '').trim()])
    return rows[0]?.id ?? null
  }

  async findModelIds(value) {
    const [rows] = await (await this.getDb()).execute(
      'SELECT id FROM models WHERE LOWER(name) LIKE LOWER(?)',
      [`%${String(value ?? '').trim()}%`]
    )
    return rows.map(row => row.id)
  }

  async findExactId(resource, value, brandId = null) {
    const queries = {
      brand: ['SELECT id FROM brands WHERE name = ? LIMIT 1', [value]],
      model: ['SELECT id FROM models WHERE name = ? AND brand_id = ? LIMIT 1', [value, brandId]],
      color: ['SELECT id FROM colors WHERE name = ? LIMIT 1', [value]],
      memory: ['SELECT id FROM memories WHERE size = ? LIMIT 1', [String(value ?? '').trim()]]
    }
    const query = queries[resource]
    if (!query) throw new Error(`不支持的库存筛选基础资料: ${resource}`)
    const [rows] = await (await this.getDb()).execute(query[0], query[1])
    return rows[0]?.id ?? null
  }

  async getSummary({ whereConditions, queryParams }) {
    const [rows] = await (await this.getDb()).execute(`
      SELECT
        supp.id as supplier_id,
        supp.name as supplier_name,
        s.id as store_id,
        s.name as store_name,
        b.name as brand,
        m.name as model,
        c.name as color,
        mem.size as memory,
        CASE WHEN p.is_new = 1 THEN '全新' ELSE '二手' END as \`condition\`,
        COUNT(*) as quantity,
        MIN(DATE(p.inventory_time)) as earliest_date,
        MAX(DATE(p.inventory_time)) as latest_date
      FROM phones p
      LEFT JOIN suppliers supp ON p.supplier_id = supp.id
      LEFT JOIN stores s ON p.store_id = s.id
      LEFT JOIN brands b ON p.brand_id = b.id
      LEFT JOIN models m ON p.model_id = m.id
      LEFT JOIN colors c ON p.color_id = c.id
      LEFT JOIN memories mem ON p.memory_id = mem.id
      WHERE ${whereConditions.join(' AND ')}
      GROUP BY supp.id, supp.name, s.id, s.name, b.id, b.name, m.id, m.name,
        c.id, c.name, mem.id, mem.size, p.is_new
      ORDER BY supp.name, s.name, b.name,
        CAST(SUBSTRING(m.name, LOCATE(' ', m.name) + 1) AS UNSIGNED) ASC,
        m.name ASC, c.name, mem.size DESC, p.is_new DESC
    `, queryParams)
    return rows
  }

  async getDetail({ whereConditions, queryParams, pageSize }) {
    const [rows] = await (await this.getDb()).query(`
      SELECT
        p.id, p.imei, p.serial_number, p.supplier_id, supp.name as supplier_name,
        p.store_id, s.name as store_name, p.brand_id, b.name as brand,
        p.model_id, m.name as model, p.color_id, c.name as color,
        p.memory_id, mem.size as memory, p.is_new,
        CASE WHEN p.is_new = 1 THEN '全新' ELSE '二手' END as \`condition\`,
        p.inventory_time AS inventory_time, p.purchase_cost, p.sale_price, p.status,
        DATEDIFF(CURDATE(), DATE(p.inventory_time)) as inventory_days
      FROM phones p
      LEFT JOIN suppliers supp ON p.supplier_id = supp.id
      LEFT JOIN stores s ON p.store_id = s.id
      LEFT JOIN brands b ON p.brand_id = b.id
      LEFT JOIN models m ON p.model_id = m.id
      LEFT JOIN colors c ON p.color_id = c.id
      LEFT JOIN memories mem ON p.memory_id = mem.id
      WHERE ${whereConditions.join(' AND ')}
      ORDER BY inventory_days DESC
      LIMIT ?
    `, [...queryParams, pageSize])
    return rows
  }
}

module.exports = SalesInventoryReportRepository
