'use strict'

const { getDatabase } = require('../config/database')

const LIST_SELECT = `
  SELECT r.id, r.contract_number, r.phone_id, r.customer_id, r.billing_mode, r.unit_price,
         r.term_months, r.sale_price, r.down_payment, r.principal_amount, r.monthly_rent,
         CASE WHEN r.billing_mode IN ('buyout','monthly') THEN
           ROUND(COALESCE(r.principal_amount, COALESCE(r.sale_price, r.unit_price * COALESCE(r.term_months,1)) - COALESCE(r.down_payment,0)) / NULLIF(r.term_months,0), 2)
           ELSE NULL END AS monthly_principal,
         CASE WHEN r.billing_mode IN ('buyout','monthly') THEN
           ROUND(ROUND(COALESCE(r.principal_amount, COALESCE(r.sale_price, r.unit_price * COALESCE(r.term_months,1)) - COALESCE(r.down_payment,0)) / NULLIF(r.term_months,0), 2) + COALESCE(r.monthly_rent,0), 2)
           ELSE r.unit_price END AS installment_amount,
         r.monitoring_lock, DATE_FORMAT(r.start_date, '%Y-%m-%d') AS start_date,
         DATE_FORMAT(r.end_date, '%Y-%m-%d') AS end_date,
         DATE_FORMAT(r.returned_at, '%Y-%m-%d %H:%i:%s') AS returned_at,
         r.deposit, r.total_cost, r.status, r.remarks, r.operator_id, r.sale_id,
         DATE_FORMAT(r.created_at, '%Y-%m-%d %H:%i:%s') AS created_at,
         c.name AS customer_name, c.phone AS customer_phone, c.id_card AS customer_id_card,
         p.imei, p.serial_number, p.purchase_cost, p.status AS phone_status,
         b.name AS brand, m.name AS model, co.name AS color, mem.size AS memory,
         s.id AS sale_order_id, s.invoice_number AS sale_invoice_number,
         s.sale_price AS sale_order_price, s.store_id AS sale_store_id,
         s.operator_id AS sale_operator_id, s.payment_method AS sale_payment_method,
         s.payment_channel AS sale_payment_channel, s.remarks AS sale_remarks,
         sale_store.name AS sale_store_name,
         COALESCE(sale_operator.name, sale_operator.username) AS sale_operator_name,
         COALESCE(u.name, u.username) AS operator_name,
         GREATEST(DATEDIFF(COALESCE(DATE(r.returned_at), CURDATE()), r.start_date) + 1, 1) AS rented_days,
         CASE WHEN r.billing_mode = 'daily'
           THEN ROUND(r.unit_price * GREATEST(DATEDIFF(COALESCE(DATE(r.returned_at), CURDATE()), r.start_date) + 1, 1), 2)
           ELSE ROUND(COALESCE(r.sale_price, r.unit_price * COALESCE(r.term_months, 1)), 2)
         END AS accrued_rent,
         COALESCE((SELECT SUM(rp.amount) FROM rental_payments rp WHERE rp.rental_id=r.id),0) AS paid_rent,
         GREATEST(CASE WHEN r.billing_mode = 'daily'
           THEN ROUND(r.unit_price * GREATEST(DATEDIFF(COALESCE(DATE(r.returned_at), CURDATE()), r.start_date) + 1, 1), 2)
           ELSE ROUND(COALESCE(r.sale_price, r.unit_price * COALESCE(r.term_months, 1)), 2)
         END - COALESCE((SELECT SUM(rp.amount) FROM rental_payments rp WHERE rp.rental_id=r.id),0),0) AS payable_rent,
         CASE WHEN r.billing_mode IN ('buyout','monthly') THEN GREATEST(
           COALESCE(r.term_months, 1) - LEAST(
             COALESCE(r.term_months, 1),
             COALESCE((SELECT COUNT(rp.period_number) FROM rental_payments rp WHERE rp.rental_id=r.id AND rp.payment_type='installment'),0)
           ), 0
         ) ELSE NULL END AS remaining_periods
  FROM rentals r
  JOIN customers c ON c.id = r.customer_id
  JOIN phones p ON p.id = r.phone_id
  LEFT JOIN brands b ON b.id = p.brand_id
  LEFT JOIN models m ON m.id = p.model_id
  LEFT JOIN colors co ON co.id = p.color_id
  LEFT JOIN memories mem ON mem.id = p.memory_id
  LEFT JOIN users u ON u.id = r.operator_id
  LEFT JOIN sales s ON s.id = r.sale_id
  LEFT JOIN stores sale_store ON sale_store.id = s.store_id
  LEFT JOIN users sale_operator ON sale_operator.id = s.operator_id`

const SUMMARY_SELECT = `
  SELECT
    SUM(CASE WHEN r.status IN ('active','overdue') THEN 1 ELSE 0 END) AS active_count,
    SUM(CASE WHEN r.status IN ('active','overdue') THEN 1 ELSE 0 END) AS device_count,
    SUM(CASE WHEN r.status IN ('active','overdue') THEN GREATEST(
      CASE WHEN r.billing_mode='daily'
        THEN ROUND(r.unit_price * GREATEST(DATEDIFF(CURDATE(),r.start_date)+1,1),2)
        ELSE ROUND(COALESCE(r.sale_price,r.unit_price*COALESCE(r.term_months,1)),2)
      END - COALESCE((SELECT SUM(rp.amount) FROM rental_payments rp WHERE rp.rental_id=r.id),0),0
    ) ELSE 0 END) AS receivable_amount,
    SUM(CASE WHEN r.status IN ('active','overdue') THEN COALESCE(r.deposit,0) ELSE 0 END) AS deposit_amount
  FROM rentals r JOIN customers c ON c.id=r.customer_id JOIN phones p ON p.id=r.phone_id`

const buildWhere = ({ keyword, searchableColumns, status, billingMode }) => {
  const conditions = []
  const params = []
  if (keyword) {
    conditions.push(`(${searchableColumns.map(column => `${column} LIKE ?`).join(' OR ')})`)
    params.push(...searchableColumns.map(() => `%${keyword}%`))
  }
  if (status) {
    conditions.push('r.status = ?')
    params.push(status)
  }
  if (billingMode === 'buyout') conditions.push("r.billing_mode IN ('buyout','monthly')")
  else if (billingMode) {
    conditions.push('r.billing_mode = ?')
    params.push(billingMode)
  }
  return { sql: conditions.length ? `WHERE ${conditions.join(' AND ')}` : '', params }
}

class RentalListRepository {
  constructor({ getDb = getDatabase } = {}) {
    this.getDb = getDb
  }

  async list({ page, pageSize, keyword, searchableColumns, status, billingMode }) {
    const db = this.getDb()
    const { sql: where, params } = buildWhere({ keyword, searchableColumns, status, billingMode })
    const [rows] = await db.execute(`${LIST_SELECT} ${where} ORDER BY r.id DESC LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`, params)
    const rentalIds = rows.map(row => Number(row.id)).filter(Number.isInteger)
    let files = []
    let payments = []
    if (rentalIds.length) {
      const placeholders = rentalIds.map(() => '?').join(',')
      ;[[files], [payments]] = await Promise.all([
        db.execute(`SELECT id,rental_id,file_url,file_name,created_at FROM rental_contract_files WHERE rental_id IN (${placeholders}) ORDER BY id DESC`, rentalIds),
        db.execute(`SELECT rental_id,period_number FROM rental_payments WHERE rental_id IN (${placeholders}) AND period_number IS NOT NULL ORDER BY period_number`, rentalIds)
      ])
    }
    const [[countRows], [summaryRows]] = await Promise.all([
      db.execute(`SELECT COUNT(*) AS total FROM rentals r JOIN customers c ON c.id=r.customer_id JOIN phones p ON p.id=r.phone_id ${where}`, params),
      db.execute(`${SUMMARY_SELECT} ${where}`, params)
    ])
    return { rows, files, payments, total: Number(countRows[0]?.total || 0), summary: summaryRows[0] || {} }
  }
}

module.exports = RentalListRepository
