'use strict'

const { getDatabase } = require('../config/database')

class SubsidyUpdateRepository {
  constructor({ getDb = getDatabase } = {}) {
    this.getDb = getDb
  }

  async findExisting(id) {
    const [records] = await this.getDb().execute(
      'SELECT ns.customer_id, ns.imei2, ns.subsidy_photos FROM national_subsidies ns WHERE ns.id = ?',
      [id]
    )
    return records[0] || null
  }

  async updateCustomerIdCard(customerId, idCard) {
    await this.getDb().execute('UPDATE customers SET id_card = ? WHERE id = ?', [idCard, customerId])
  }

  async updateCustomer(customerId, fields, values) {
    await this.getDb().execute(
      `UPDATE customers SET ${fields.join(', ')} WHERE id = ?`,
      [...values, customerId]
    )
  }

  async getStoreName(storeId) {
    const [stores] = await this.getDb().execute('SELECT id, name FROM stores WHERE id = ?', [storeId])
    return stores[0]?.name || null
  }

  async updateSubsidy(id, fields, values) {
    await this.getDb().execute(
      `UPDATE national_subsidies SET ${fields.join(', ')} WHERE id = ?`,
      [...values, id]
    )
  }

  async getPhotoDirectoryNamingInput(id) {
    const [records] = await this.getDb().execute(`
      SELECT ns.customer_name, ns.has_different_handler, ns.handler_name, ns.serial_number,
             p.is_new, p.inventory_time
      FROM national_subsidies ns
      LEFT JOIN phones p ON p.id = ns.phone_id
      WHERE ns.id = ?
    `, [id])
    return records[0] || null
  }

  async updatePhotos(id, photos) {
    await this.getDb().execute(
      'UPDATE national_subsidies SET subsidy_photos = ? WHERE id = ?',
      [JSON.stringify(photos), id]
    )
  }

  async getPhoneId(id) {
    const [records] = await this.getDb().execute('SELECT phone_id FROM national_subsidies WHERE id = ?', [id])
    return records[0]?.phone_id || null
  }

  async updatePhoneSaleTime(phoneId, saleTime) {
    await this.getDb().execute('UPDATE phones SET sale_time = ? WHERE id = ?', [saleTime, phoneId])
  }
}

module.exports = SubsidyUpdateRepository
