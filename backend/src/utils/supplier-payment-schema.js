const { getDatabase } = require('../config/database')

let ensurePromise = null

/**
 * Supplier payment notes are kept separate from the phone's sales/inventory remarks.
 * The check is idempotent so existing installations receive the column safely.
 */
async function ensureSupplierPaymentSchema() {
  if (!ensurePromise) {
    ensurePromise = (async () => {
      const db = getDatabase()
      const [columns] = await db.query('SHOW COLUMNS FROM phones')
      if (!columns.some(column => column.Field === 'payment_remarks')) {
        await db.query('ALTER TABLE phones ADD COLUMN payment_remarks TEXT NULL AFTER payment_operator_id')
      }
    })().catch(error => {
      ensurePromise = null
      throw error
    })
  }

  return ensurePromise
}

module.exports = { ensureSupplierPaymentSchema }
