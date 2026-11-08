'use strict'

const { getDatabase } = require('../config/database')

class SubsidyFilterOptionsRepository {
  constructor({ getDb = getDatabase } = {}) {
    this.getDb = getDb
  }

  async getFilterOptions() {
    const database = this.getDb()
    const [brands] = await database.execute(`
      SELECT DISTINCT phone_brand
      FROM national_subsidies
      WHERE phone_brand IS NOT NULL
      ORDER BY phone_brand
    `)
    const [models] = await database.execute(`
      SELECT DISTINCT phone_model
      FROM national_subsidies
      WHERE phone_model IS NOT NULL
      ORDER BY phone_model
    `)
    const [colors] = await database.execute(`
      SELECT DISTINCT phone_color
      FROM national_subsidies
      WHERE phone_color IS NOT NULL
      ORDER BY phone_color
    `)
    const [memories] = await database.execute(`
      SELECT DISTINCT phone_memory
      FROM national_subsidies
      WHERE phone_memory IS NOT NULL
      ORDER BY phone_memory
    `)
    const [stores] = await database.execute(`
      SELECT DISTINCT store_id, store_name
      FROM national_subsidies
      WHERE store_id IS NOT NULL AND store_name IS NOT NULL
      ORDER BY store_name
    `)
    return { brands, models, colors, memories, stores }
  }
}

module.exports = SubsidyFilterOptionsRepository
