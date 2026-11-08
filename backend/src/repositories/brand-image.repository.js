'use strict'

const { getDatabase } = require('../config/database')

class BrandImageRepository {
  constructor(database = getDatabase) {
    this.database = database
  }

  async listReferencedPaths() {
    const [rows] = await this.database().execute(`
      SELECT DISTINCT filepath FROM brand_images
      UNION
      SELECT brand_image as filepath FROM settings WHERE brand_image IS NOT NULL AND brand_image != ''
    `)
    return rows
  }

  async getCurrentLogoUrl() {
    const database = this.database()
    const [columns] = await database.execute('SHOW COLUMNS FROM settings')
    const availableColumns = new Set(columns.map(column => column.Field))
    if (availableColumns.has('key_name') && availableColumns.has('value')) {
      const [rows] = await database.execute(
        'SELECT value FROM settings WHERE key_name = ? LIMIT 1',
        ['logo_url']
      )
      return rows[0]?.value || ''
    }

    if (!availableColumns.has('logo_url')) return ''
    const [rows] = await database.execute('SELECT logo_url AS logo_url FROM settings LIMIT 1')
    return rows[0]?.logo_url || ''
  }

  async saveCurrentLogoUrl(fileUrl) {
    const database = this.database()
    const [columns] = await database.execute('SHOW COLUMNS FROM settings')
    const availableColumns = new Set(columns.map(column => column.Field))
    const isKeyValueTable = availableColumns.has('key_name') && availableColumns.has('value')

    if (isKeyValueTable) {
      await database.execute(`
        INSERT INTO settings (key_name, value, type, description)
        VALUES (?, ?, 'string', ?)
        ON DUPLICATE KEY UPDATE
          value = VALUES(value),
          type = VALUES(type),
          description = VALUES(description),
          updated_at = CURRENT_TIMESTAMP
      `, ['logo_url', fileUrl, '站点Logo'])
      return
    }

    const logoColumn = ['logo_url'].find(column => availableColumns.has(column))
    if (!logoColumn) throw new Error('settings表缺少logo字段')

    const [existingSettings] = await database.execute('SELECT id FROM settings LIMIT 1')
    if (existingSettings.length > 0) {
      await database.execute(
        `UPDATE settings SET ${logoColumn} = ? WHERE id = ?`,
        [fileUrl, existingSettings[0].id]
      )
      return
    }

    await database.execute(`INSERT INTO settings (${logoColumn}) VALUES (?)`, [fileUrl])
  }

  async listImageRecords() {
    const [rows] = await this.database().execute(
      'SELECT * FROM brand_images ORDER BY created_at DESC'
    )
    return rows
  }
}

module.exports = BrandImageRepository
