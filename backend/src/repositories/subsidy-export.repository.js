'use strict'

const { getDatabase } = require('../config/database')

class SubsidyExportRepository {
  constructor({ getDb = getDatabase } = {}) {
    this.getDb = getDb
  }

  async listForExport({ whereConditions, queryParams, sortField, sortDirection }) {
    const query = `
      SELECT
        id,
        sale_id,
        phone_id,
        customer_name,
        customer_phone,
        customer_idcard,
        phone_brand,
        phone_model,
        phone_color,
        phone_memory,
        serial_number,
        imei1,
        imei2,
        sale_price,
        DATE_FORMAT(sale_time, '%Y-%m-%d') as sale_time,
        store_id,
        store_name,
        salesman_name,
        subsidy_amount,
        subsidy_rate,
        DATE_FORMAT(apply_time, '%Y-%m-%d') as apply_time,
        apply_status,
        DATE_FORMAT(arrival_time, '%Y-%m-%d') as arrival_time,
        remarks,
        subsidy_photos,
        has_different_handler,
        handler_name,
        handler_phone,
        handler_idcard
      FROM national_subsidies
      WHERE ${whereConditions.join(' AND ')}
      ORDER BY ${sortField} ${sortDirection}
    `
    const [rows] = await this.getDb().execute(query, queryParams)
    return rows
  }
}

module.exports = SubsidyExportRepository
