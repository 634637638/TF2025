'use strict'

class RentalFinishRepository {
  async getForUpdate(connection, rentalId) {
    const [rows] = await connection.execute(
      `SELECT r.id,r.status,r.billing_mode,r.phone_id,r.unit_price,r.start_date,
              COALESCE(s.store_id,p.store_id) AS store_id, p.store_id AS source_store_id
       FROM rentals r JOIN phones p ON p.id=r.phone_id LEFT JOIN sales s ON s.id=r.sale_id WHERE r.id=? FOR UPDATE`,
      [rentalId]
    )
    return rows[0] || null
  }

  async calculateTotalCost(connection, rentalId) {
    const [rows] = await connection.execute(
      `SELECT ROUND(unit_price * GREATEST(DATEDIFF(CURDATE(),start_date)+1,1),2) AS cost
       FROM rentals WHERE id=?`,
      [rentalId]
    )
    return Number(rows[0]?.cost || 0)
  }

  async finishRental(connection, rentalId, totalCost) {
    await connection.execute(
      "UPDATE rentals SET status='returned',returned_at=NOW(),end_date=CURDATE(),total_cost=? WHERE id=?",
      [totalCost, rentalId]
    )
  }

  async restorePhone(connection, phoneId) {
    await connection.execute("UPDATE phones SET status='in_stock' WHERE id=? AND status='rented'", [phoneId])
  }
}

module.exports = RentalFinishRepository
