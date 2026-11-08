'use strict'

const { getDatabase } = require('../config/database')

class SubsidyPhoneDetailRepository {
  constructor({ getDb = getDatabase } = {}) {
    this.getDb = getDb
  }

  async findSoldPhoneById(phoneId) {
    const [rows] = await this.getDb().execute(`
      SELECT
        p.id as phone_id,
        p.imei,
        p.serial_number,
        p.is_new,
        p.inventory_time,
        p.sale_price,
        DATE_FORMAT(COALESCE(p.sale_time, latest_sale.sale_time), '%Y-%m-%d') as sale_time,
        p.sale_operator_id,
        b.name as brand,
        m.name as model,
        co.name as color,
        mem.size as memory,
        latest_sale.store_id as store_id,
        sale_st.name as store_name,
        u.name as salesman_name
      FROM phones p
      LEFT JOIN brands b ON p.brand_id = b.id
      LEFT JOIN models m ON p.model_id = m.id
      LEFT JOIN colors co ON p.color_id = co.id
      LEFT JOIN memories mem ON p.memory_id = mem.id
      LEFT JOIN users u ON p.sale_operator_id = u.id
      LEFT JOIN (
        SELECT s.*, ROW_NUMBER() OVER (PARTITION BY s.phone_id ORDER BY s.created_at DESC) as rn
        FROM sales s
      ) latest_sale ON p.id = latest_sale.phone_id AND latest_sale.rn = 1
      LEFT JOIN stores sale_st ON latest_sale.store_id = sale_st.id
      WHERE p.id = ? AND p.status = 'sold'
      LIMIT 1
    `, [phoneId])
    return rows[0] || null
  }

  async findSaleByPhoneId(phoneId) {
    const [rows] = await this.getDb().execute(`
      SELECT
        s.id as sale_id,
        s.customer_id,
        c.name as customer_name,
        c.phone as customer_phone,
        c.id_card as customer_idcard
      FROM sales s
      LEFT JOIN customers c ON s.customer_id = c.id
      WHERE s.phone_id = ?
      LIMIT 1
    `, [phoneId])
    return rows[0] || null
  }

  async findSubsidyByPhoneId(phoneId) {
    const [rows] = await this.getDb().execute(`
      SELECT id, apply_status, subsidy_amount
      FROM national_subsidies
      WHERE phone_id = ?
    `, [phoneId])
    return rows[0] || null
  }
}

module.exports = SubsidyPhoneDetailRepository
