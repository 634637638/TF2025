const { getDatabase } = require('../config/database')

class PhoneOptionRepository {
  constructor(database = null) {
    this.database = database
  }

  async getOptionRows() {
    const database = this.database || getDatabase()
    const [colors] = await database.execute(`
      SELECT id, name, sort_order
      FROM colors
      WHERE status = 1
      ORDER BY sort_order ASC, name ASC, id ASC
    `)
    const [memories] = await database.execute(`
      SELECT id, size, sort_order, status
      FROM memories
      WHERE status = 1
      ORDER BY sort_order ASC, size ASC, id ASC
    `)
    const [brands] = await database.execute(`
      SELECT id, name, sort_order, status
      FROM brands
      WHERE status = 1
      ORDER BY sort_order ASC, name ASC, id ASC
    `)
    const [models] = await database.execute(`
      SELECT m.id, m.name, m.brand_id, m.sort_order, m.status
      FROM models m
      INNER JOIN brands b ON m.brand_id = b.id
      WHERE m.status = 1 AND b.status = 1
      ORDER BY m.sort_order ASC, m.name ASC, m.id ASC
    `)
    const [actualModels] = await database.execute(`
      SELECT DISTINCT m.id, m.name as model, m.brand_id, m.sort_order
      FROM phones p
      LEFT JOIN models m ON p.model_id = m.id
      WHERE m.name IS NOT NULL AND m.name != ''
      AND m.name NOT IN (
        SELECT name FROM models WHERE status = 1
      )
      ORDER BY m.sort_order ASC, m.name ASC, m.id ASC
    `)
    const [actualBrands] = await database.execute(`
      SELECT DISTINCT b.id, b.name as brand, b.sort_order
      FROM phones p
      LEFT JOIN brands b ON p.brand_id = b.id
      WHERE b.name IS NOT NULL AND b.name != ''
      AND b.name NOT IN (
        SELECT name FROM brands WHERE status = 1
      )
      ORDER BY b.sort_order ASC, b.name ASC, b.id ASC
    `)
    const [actualColors] = await database.execute(`
      SELECT DISTINCT c.id, c.name as color, c.sort_order
      FROM phones p
      LEFT JOIN colors c ON p.color_id = c.id
      WHERE c.name IS NOT NULL AND c.name != ''
      AND c.name NOT IN (
        SELECT name FROM colors WHERE status = 1
      )
      ORDER BY c.sort_order ASC, c.name ASC, c.id ASC
    `)
    const [actualMemories] = await database.execute(`
      SELECT DISTINCT mem.id, mem.size as memory, mem.sort_order
      FROM phones p
      LEFT JOIN memories mem ON p.memory_id = mem.id
      WHERE mem.size IS NOT NULL AND mem.size != ''
      AND mem.size NOT IN (
        SELECT size FROM memories WHERE status = 1
      )
      ORDER BY mem.sort_order ASC, mem.size ASC, mem.id ASC
    `)
    const [purchaseNumbers] = await database.execute(`
      SELECT DISTINCT purchase_number
      FROM phones
      WHERE purchase_number IS NOT NULL AND purchase_number != ''
      ORDER BY purchase_number DESC
    `)
    const [conditions] = await database.execute(`
      SELECT DISTINCT quality_grade
      FROM phones
      WHERE quality_grade IS NOT NULL AND quality_grade != ''
      ORDER BY quality_grade
    `)
    const [stores] = await database.execute(`
      SELECT id, name, sort_order
      FROM stores
      WHERE status = 1
      ORDER BY sort_order ASC, name ASC, id ASC
    `)

    return {
      colors,
      memories,
      brands,
      models,
      actualModels,
      actualBrands,
      actualColors,
      actualMemories,
      purchaseNumbers,
      conditions,
      stores
    }
  }
}

module.exports = PhoneOptionRepository
