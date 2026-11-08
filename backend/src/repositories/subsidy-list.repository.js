'use strict'

const { getDatabase } = require('../config/database')

class SubsidyListRepository {
  constructor({ getDb = getDatabase } = {}) {
    this.getDb = getDb
  }

  async list({ whereConditions, queryParams, sortField, sortDirection, pageSize, offset }) {
    const whereClause = whereConditions.join(' AND ')
    const listQuery = `
      SELECT
        id, sale_id, phone_id, customer_name, customer_phone, customer_idcard,
        phone_brand, phone_model, phone_color, phone_memory, serial_number,
        imei1, imei2, sale_price,
        DATE_FORMAT(sale_time, '%Y-%m-%d') as sale_time,
        store_id, store_name, salesman_name, subsidy_amount, subsidy_rate,
        DATE_FORMAT(apply_time, '%Y-%m-%d') as apply_time,
        apply_status,
        DATE_FORMAT(arrival_time, '%Y-%m-%d') as arrival_time,
        remarks, subsidy_photos, has_different_handler, handler_name, handler_phone, handler_idcard,
        (SELECT is_new FROM phones WHERE phones.id = national_subsidies.phone_id LIMIT 1) as is_new,
        (SELECT inventory_time FROM phones WHERE phones.id = national_subsidies.phone_id LIMIT 1) as inventory_time
      FROM national_subsidies
      WHERE ${whereClause}
      ORDER BY ${sortField} ${sortDirection}
      LIMIT ? OFFSET ?
    `
    const countQuery = `SELECT COUNT(*) as total FROM national_subsidies WHERE ${whereClause}`
    const database = this.getDb()
    const [listResult, countResult] = await Promise.all([
      (async () => {
        const startedAt = process.hrtime.bigint()
        const result = await database.query(listQuery, [...queryParams, pageSize, offset])
        return { rows: result[0], elapsedMs: Number(process.hrtime.bigint() - startedAt) / 1e6 }
      })(),
      (async () => {
        const startedAt = process.hrtime.bigint()
        const result = await database.query(countQuery, queryParams)
        return { rows: result[0], elapsedMs: Number(process.hrtime.bigint() - startedAt) / 1e6 }
      })()
    ])
    return {
      subsidies: listResult.rows,
      total: countResult.rows[0].total,
      listQueryMs: listResult.elapsedMs,
      countQueryMs: countResult.elapsedMs
    }
  }
}

module.exports = SubsidyListRepository
