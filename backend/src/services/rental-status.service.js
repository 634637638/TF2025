const { getDatabase } = require('../config/database')

async function refreshExpiredRentalStatuses() {
  const db = getDatabase()
  const [result] = await db.execute(
    "UPDATE rentals SET status='overdue' WHERE status='active' AND billing_mode IN ('buyout','monthly') AND end_date < CURDATE()"
  )
  return Number(result?.affectedRows || 0)
}

module.exports = { refreshExpiredRentalStatuses }
