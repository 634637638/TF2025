'use strict'

const { getDatabase } = require('../config/database')

class BrandSettingsRepository {
  constructor(database = getDatabase) {
    this.database = database
  }

  async getCurrent() {
    const [rows] = await this.database().execute('SELECT * FROM brand_settings LIMIT 1')
    return rows[0] || null
  }

  async saveCurrent(settings) {
    const values = [
      settings.logoUrl,
      settings.systemName,
      settings.systemShortName,
      settings.loginTitle,
      settings.loginSubtitle,
      settings.loginBackgroundUrl,
      settings.primaryColor,
      settings.accentColor
    ]
    const database = this.database()
    await database.execute(
      `UPDATE brand_settings SET
        logoUrl = ?, systemName = ?, systemShortName = ?,
        loginTitle = ?, loginSubtitle = ?, loginBackgroundUrl = ?,
        primaryColor = ?, accentColor = ?, updated_at = NOW()
       WHERE id = 1`,
      values
    )

    const [result] = await database.execute('SELECT ROW_COUNT() as affected')
    if (result[0].affected === 0) {
      await database.execute(
        `INSERT INTO brand_settings (
          logoUrl, systemName, systemShortName,
          loginTitle, loginSubtitle, loginBackgroundUrl,
          primaryColor, accentColor, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        values
      )
    }
  }
}

module.exports = BrandSettingsRepository
