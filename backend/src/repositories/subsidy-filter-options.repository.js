'use strict'

const { appendStoreScopeCondition } = require('../utils/store-scope')

const { getDatabase } = require('../config/database')

class SubsidyFilterOptionsRepository {
  constructor({ getDb = getDatabase } = {}) {
    this.getDb = getDb
  }

  async getFilterOptions(scope) {
    const conditions = ['1=1']; const params = []
    appendStoreScopeCondition(scope, 'store_id', conditions, params)
    const database = this.getDb()
    const [brands] = await database.execute(`
      SELECT DISTINCT phone_brand
      FROM national_subsidies
      WHERE ${conditions.join(' AND ')} AND phone_brand IS NOT NULL
      ORDER BY phone_brand
    `, params)
    const [models] = await database.execute(`
      SELECT DISTINCT phone_model
      FROM national_subsidies
      WHERE ${conditions.join(' AND ')} AND phone_model IS NOT NULL
      ORDER BY phone_model
    `, params)
    const [colors] = await database.execute(`
      SELECT DISTINCT phone_color
      FROM national_subsidies
      WHERE ${conditions.join(' AND ')} AND phone_color IS NOT NULL
      ORDER BY phone_color
    `, params)
    const [memories] = await database.execute(`
      SELECT DISTINCT phone_memory
      FROM national_subsidies
      WHERE ${conditions.join(' AND ')} AND phone_memory IS NOT NULL
      ORDER BY phone_memory
    `, params)
    const [stores] = await database.execute(`
      SELECT DISTINCT store_id, store_name
      FROM national_subsidies
      WHERE ${conditions.join(' AND ')} AND store_id IS NOT NULL AND store_name IS NOT NULL
      ORDER BY store_name
    `, params)
    return { brands, models, colors, memories, stores }
  }
}

module.exports = SubsidyFilterOptionsRepository
