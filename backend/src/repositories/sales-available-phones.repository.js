'use strict'

const { getDatabase } = require('../config/database')
const { getEffectivePhoneStatusSql } = require('../utils/phone-status')

const SALES_REFERENCE_LOOKUP_SQL = Object.freeze({
  brand: 'SELECT id FROM brands WHERE LOWER(TRIM(name)) = LOWER(?)',
  color: 'SELECT id FROM colors WHERE LOWER(TRIM(name)) = LOWER(?)',
  memory: 'SELECT id FROM memories WHERE TRIM(size) = ?'
})

const AVAILABLE_PHONE_REFERENCE_JOINS = `
      LEFT JOIN brands b ON p.brand_id = b.id
      LEFT JOIN models m ON p.model_id = m.id
      LEFT JOIN colors co ON p.color_id = co.id
      LEFT JOIN memories mem ON p.memory_id = mem.id`

const AVAILABLE_PHONE_SELECT = `
      SELECT
        p.id,
        p.brand_id,
        p.model_id,
        p.color_id,
        p.memory_id,
        p.imei,
        p.serial_number,
        m.name as model,
        b.name as brand,
        co.name as color,
        mem.size as memory,
        COALESCE(
          (
            SELECT hi.image_url
            FROM H5_images hi
            WHERE hi.phone_id = p.id
            ORDER BY hi.is_primary DESC, hi.sort_order ASC, hi.id ASC
            LIMIT 1
          ),
          (
            SELECT ni.image_url
            FROM H5_newimages ni
            INNER JOIN H5_newtemplates nt ON ni.template_id = nt.id
            WHERE nt.brand_id = p.brand_id
              AND nt.model_id = p.model_id
              AND (
                nt.color_id = p.color_id
                OR (nt.color_id IS NULL AND p.color_id IS NULL)
              )
              AND nt.is_active = 1
            ORDER BY ni.is_primary DESC, ni.sort_order ASC, ni.id ASC
            LIMIT 1
          )
        ) as image_url,
        p.store_id,
        s.name as store_name,
        p.sale_price,
        p.purchase_cost,
        p.is_new,
        p.is_preordered,
        p.quality_grade,
        p.supplier_id,
        supp.name as supplier_name,
        p.inventory_operator_id,
        u.name as inventory_operator_name,
        u.username as operator_username,
        p.purchase_number,
        p.inventory_time AS inventory_time,
        p.sale_time AS sale_time,
        p.remarks,
        ${getEffectivePhoneStatusSql('p')} AS status,
        preorder.id AS preorder_id,
        preorder.customer_id AS preorder_customer_id,
        preorder_customer.name AS preorder_customer_name,
        preorder_customer.phone AS preorder_customer_phone,
        preorder.deposit_amount AS preorder_deposit_amount,
        preorder.total_price AS preorder_total_price,
        preorder.actual_price AS preorder_actual_price,
        CASE
          WHEN p.is_new = 1 THEN '全新'
          ELSE '二手'
        END as \`condition\`
      FROM phones p
      LEFT JOIN brands b ON p.brand_id = b.id
      LEFT JOIN models m ON p.model_id = m.id
      LEFT JOIN colors co ON p.color_id = co.id
      LEFT JOIN memories mem ON p.memory_id = mem.id
      LEFT JOIN stores s ON p.store_id = s.id
      LEFT JOIN suppliers supp ON p.supplier_id = supp.id
      LEFT JOIN users u ON p.inventory_operator_id = u.id
      LEFT JOIN preorders preorder
        ON preorder.matched_phone_id = p.id
       AND preorder.status = 'arrived'
      LEFT JOIN customers preorder_customer ON preorder_customer.id = preorder.customer_id`

class SalesAvailablePhonesRepository {
  constructor({ getDb = getDatabase } = {}) {
    if (typeof getDb !== 'function') throw new TypeError('SalesAvailablePhonesRepository requires getDb')
    this.getDb = getDb
  }

  async findReferenceId(resource, value) {
    const query = SALES_REFERENCE_LOOKUP_SQL[resource]
    if (!query) throw new Error(`不支持的销售筛选基础资料: ${resource}`)
    const database = await this.getDb()
    const [rows] = await database.execute(query, [String(value ?? '').trim()])
    return rows[0]?.id ?? null
  }

  async findBrandsByName(value) {
    const database = await this.getDb()
    const [rows] = await database.execute(
      'SELECT id, name FROM brands WHERE LOWER(name) LIKE LOWER(?) ORDER BY name',
      [`%${String(value ?? '').trim().toLowerCase()}%`]
    )
    return rows
  }

  async findModelsByName(value, exact) {
    const database = await this.getDb()
    const query = exact
      ? 'SELECT id, name FROM models WHERE LOWER(TRIM(name)) = LOWER(?) ORDER BY name'
      : 'SELECT id, name FROM models WHERE LOWER(name) LIKE LOWER(?) ORDER BY name'
    const normalizedName = String(value ?? '').trim()
    const [rows] = await database.execute(query, [exact ? normalizedName : `%${normalizedName}%`])
    return rows
  }

  async findPreorderDelivery(preorderId) {
    const database = await this.getDb()
    const [rows] = await database.execute(
      `SELECT matched_phone_id, status
       FROM preorders
       WHERE id = ?
       LIMIT 1`,
      [preorderId]
    )
    return rows[0] || null
  }

  async getAvailablePhones({ whereConditions, queryParams, page, pageSize }) {
    const database = await this.getDb()
    const whereClause = whereConditions.join(' AND ')
    const offset = (page - 1) * pageSize
    const [phones] = await database.execute(`
      ${AVAILABLE_PHONE_SELECT}
      WHERE ${whereClause}
      ORDER BY p.inventory_time DESC
      LIMIT ${pageSize} OFFSET ${offset}
    `, queryParams)
    const [countRows] = await database.execute(`
      SELECT COUNT(*) as total
      FROM phones p
      ${AVAILABLE_PHONE_REFERENCE_JOINS}
      WHERE ${whereClause}
    `, queryParams)
    const [valueRows] = await database.execute(`
      SELECT
        COALESCE(SUM(CASE WHEN p.is_new = 1 THEN p.purchase_cost ELSE 0 END), 0) as new_value,
        COALESCE(SUM(CASE WHEN p.is_new = 0 THEN p.purchase_cost ELSE 0 END), 0) as used_value,
        COALESCE(SUM(p.purchase_cost), 0) as total_value
      FROM phones p
      ${AVAILABLE_PHONE_REFERENCE_JOINS}
      WHERE ${whereClause}
    `, queryParams)

    return {
      phones,
      total: Number(countRows[0]?.total ?? 0),
      values: valueRows[0] || {}
    }
  }

  async getAvailablePhonesForExport({ whereConditions, queryParams }) {
    const database = await this.getDb()
    const whereClause = whereConditions.join(' AND ')
    const [phones] = await database.execute(`
      SELECT
        p.id,
        p.imei,
        p.serial_number,
        m.name as model,
        b.name as brand,
        co.name as color,
        mem.size as memory,
        COALESCE(
          (
            SELECT hi.image_url
            FROM H5_images hi
            WHERE hi.phone_id = p.id
            ORDER BY hi.is_primary DESC, hi.sort_order ASC, hi.id ASC
            LIMIT 1
          ),
          (
            SELECT ni.image_url
            FROM H5_newimages ni
            INNER JOIN H5_newtemplates nt ON ni.template_id = nt.id
            WHERE nt.brand_id = p.brand_id
              AND nt.model_id = p.model_id
              AND (
                nt.color_id = p.color_id
                OR (nt.color_id IS NULL AND p.color_id IS NULL)
              )
              AND nt.is_active = 1
            ORDER BY ni.is_primary DESC, ni.sort_order ASC, ni.id ASC
            LIMIT 1
          )
        ) as image_url,
        p.store_id,
        s.name as store_name,
        p.sale_price,
        p.purchase_cost,
        p.is_new,
        p.is_preordered,
        p.quality_grade,
        p.supplier_id,
        supp.name as supplier_name,
        p.inventory_operator_id,
        u.name as inventory_operator_name,
        u.username as operator_username,
        p.purchase_number,
        p.inventory_time AS inventory_time,
        p.sale_time AS sale_time,
        p.remarks,
        ${getEffectivePhoneStatusSql('p')} AS status,
        CASE
          WHEN p.is_new = 1 THEN '全新'
          ELSE '二手'
        END as \`condition\`
      FROM phones p
      LEFT JOIN brands b ON p.brand_id = b.id
      LEFT JOIN models m ON p.model_id = m.id
      LEFT JOIN colors co ON p.color_id = co.id
      LEFT JOIN memories mem ON p.memory_id = mem.id
      LEFT JOIN stores s ON p.store_id = s.id
      LEFT JOIN suppliers supp ON p.supplier_id = supp.id
      LEFT JOIN users u ON p.inventory_operator_id = u.id
      WHERE ${whereClause}
      ORDER BY p.inventory_time DESC
    `, queryParams)
    return phones
  }

  async getStats({ whereConditions, queryParams, todayQueryParams, todayStart }) {
    const database = await this.getDb()
    const whereClause = whereConditions.join(' AND ')
    const [totalValueRows] = await database.execute(`
      SELECT COALESCE(SUM(p.purchase_cost), 0) as total_value
      FROM phones p
      ${AVAILABLE_PHONE_REFERENCE_JOINS}
      WHERE ${whereClause}
    `, queryParams)

    const todayConditions = whereConditions.slice(1)
    todayConditions.push("p.status = 'sold'", 'p.sale_time >= ?')
    const [todaySoldRows] = await database.execute(`
      SELECT COUNT(*) as today_sold
      FROM phones p
      ${AVAILABLE_PHONE_REFERENCE_JOINS}
      WHERE ${todayConditions.join(' AND ')}
    `, [...todayQueryParams, todayStart])

    const [profitMarginRows] = await database.execute(`
      SELECT
        COUNT(*) as count,
        COALESCE(SUM(
          CASE
            WHEN p.sale_price > 0 AND p.purchase_cost > 0
            THEN ((p.sale_price - p.purchase_cost) / p.sale_price) * 100
            ELSE 0
          END
        ), 0) as total_profit_margin
      FROM phones p
      ${AVAILABLE_PHONE_REFERENCE_JOINS}
      WHERE ${whereClause}
        AND p.sale_price > 0
        AND p.purchase_cost > 0
    `, queryParams)

    return {
      totalValue: totalValueRows[0],
      todaySold: todaySoldRows[0],
      profitMargin: profitMarginRows[0]
    }
  }
}

module.exports = SalesAvailablePhonesRepository
