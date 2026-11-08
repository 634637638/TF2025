'use strict'

class RepairLookupRepository {
  constructor({ getDatabase } = {}) {
    if (typeof getDatabase !== 'function') throw new TypeError('RepairLookupRepository requires getDatabase')
    this.getDatabase = getDatabase
  }

  async getOptions() {
    const database = await this.getDatabase()
    const [brands, models, colors, memories, technicians] = await Promise.all([
      database.execute('SELECT id, name FROM brands WHERE status = 1 OR status IS NULL ORDER BY sort_order, id'),
      database.execute('SELECT id, name, brand_id FROM models WHERE status = 1 OR status IS NULL ORDER BY sort_order, id'),
      database.execute('SELECT id, name FROM colors WHERE status = 1 OR status IS NULL ORDER BY sort_order, id'),
      database.execute('SELECT id, size FROM memories WHERE status = 1 OR status IS NULL ORDER BY sort_order, id'),
      database.execute('SELECT id, name, username FROM users WHERE status = 1 ORDER BY name, id')
    ])
    return { brands: brands[0] || [], models: models[0] || [], colors: colors[0] || [], memories: memories[0] || [], technicians: technicians[0] || [] }
  }

  async searchDevices(keyword) {
    const database = await this.getDatabase()
    const like = `%${keyword}%`
    const [rows] = await database.execute(`
      SELECT p.id AS phone_id, p.imei, p.serial_number,
             p.brand_id, b.name AS brand_name,
             p.model_id, mo.name AS model_name,
             p.color_id, co.name AS color_name,
             p.memory_id, me.size AS memory_size,
             latest_sale.customer_id,
             cu.name AS customer_name, cu.phone AS customer_phone
      FROM phones p
      LEFT JOIN brands b ON b.id = p.brand_id
      LEFT JOIN models mo ON mo.id = p.model_id
      LEFT JOIN colors co ON co.id = p.color_id
      LEFT JOIN memories me ON me.id = p.memory_id
      LEFT JOIN (
        SELECT s.phone_id, s.customer_id,
               ROW_NUMBER() OVER (PARTITION BY s.phone_id ORDER BY s.created_at DESC, s.id DESC) AS rn
        FROM sales s
      ) latest_sale ON latest_sale.phone_id = p.id AND latest_sale.rn = 1
      LEFT JOIN customers cu ON cu.id = latest_sale.customer_id
      WHERE p.imei LIKE ? OR p.serial_number LIKE ?
      ORDER BY CASE WHEN p.imei = ? OR p.serial_number = ? THEN 0 ELSE 1 END, p.id DESC
      LIMIT 20
    `, [like, like, keyword, keyword])
    return rows
  }
}

module.exports = RepairLookupRepository
