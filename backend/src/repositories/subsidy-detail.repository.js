'use strict'

const { getDatabase } = require('../config/database')

class SubsidyDetailRepository {
  constructor({ getDb = getDatabase } = {}) {
    this.getDb = getDb
  }

  async findById(id) {
    const [rows] = await this.getDb().execute(`
      SELECT
        id,
        customer_id,
        phone_id,
        customer_name,
        customer_phone,
        customer_idcard,
        phone_brand,
        phone_model,
        phone_color,
        phone_memory,
        salesman_name,
        imei1,
        imei2,
        serial_number,
        sale_price,
        subsidy_photos,
        subsidy_amount,
        subsidy_rate,
        store_id,
        store_name,
        apply_time,
        apply_status,
        arrival_time,
        remarks,
        has_different_handler,
        handler_name,
        handler_phone,
        handler_idcard,
        DATE_FORMAT(sale_time, '%Y-%m-%d') as sale_time_formatted
      FROM national_subsidies
      WHERE id = ?
    `, [id])
    return rows[0] || null
  }
}

module.exports = SubsidyDetailRepository
