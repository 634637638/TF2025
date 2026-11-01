'use strict'

const { getDatabase } = require('../config/database')

let ensurePromise = null

async function ensureAttendanceSchema() {
  if (ensurePromise) return ensurePromise

  ensurePromise = (async () => {
    const db = getDatabase()
    const [columns] = await db.query('SHOW COLUMNS FROM attendance_records LIKE ?', ['attendance_batch_id'])
    if (columns.length === 0) {
      await db.query(
        'ALTER TABLE attendance_records ADD COLUMN attendance_batch_id VARCHAR(36) NULL AFTER employee_id'
      )
    }

    const [indexes] = await db.query('SHOW INDEX FROM attendance_records WHERE Key_name = ?', ['idx_attendance_batch'])
    if (indexes.length === 0) {
      await db.query(
        'ALTER TABLE attendance_records ADD INDEX idx_attendance_batch (employee_id, attendance_batch_id, record_date)'
      )
    }
  })().catch(error => {
    ensurePromise = null
    throw error
  })

  return ensurePromise
}

module.exports = { ensureAttendanceSchema }
