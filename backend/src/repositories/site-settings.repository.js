'use strict'

const { getDatabase } = require('../config/database')
const { schemaChangesAllowed } = require('../utils/schema-change-policy')

const SETTINGS_KEY_VALUE_COLUMNS = ['key_name', 'value']
const PUBLIC_PRICE_COLUMN_DEFINITIONS = {
  public_price_contacts: 'TEXT NULL COMMENT \'公开报价联系人配置\'',
  public_price_default_contact: 'VARCHAR(160) NULL COMMENT \'默认报价联系人标识\'',
  public_price_watermark: 'VARCHAR(255) NULL COMMENT \'公开报价水印文字\'',
  public_price_watermark_enabled: 'TINYINT(1) NOT NULL DEFAULT 1 COMMENT \'公开报价水印开关\'',
  public_price_watermark_time_enabled: 'TINYINT(1) NOT NULL DEFAULT 1 COMMENT \'公开报价水印时间开关\'',
  public_price_watermark_color: 'VARCHAR(20) NOT NULL DEFAULT \'#6b7280\' COMMENT \'公开报价水印颜色\''
}

class SiteSettingsRepository {
  constructor({ database = getDatabase, canChangeSchema = schemaChangesAllowed } = {}) {
    this.database = database
    this.canChangeSchema = canChangeSchema
  }

  async getTableMeta() {
    const [columns] = await this.database().execute('SHOW COLUMNS FROM settings')
    const availableColumns = new Set(columns.map(column => column.Field))
    return {
      columns,
      availableColumns,
      isKeyValueTable: SETTINGS_KEY_VALUE_COLUMNS.every(column => availableColumns.has(column))
    }
  }

  async ensurePublicPriceColumns() {
    const { columns, isKeyValueTable } = await this.getTableMeta()
    if (isKeyValueTable || !this.canChangeSchema()) return

    const existing = new Set(columns.map(column => column.Field))
    for (const [column, definition] of Object.entries(PUBLIC_PRICE_COLUMN_DEFINITIONS)) {
      if (!existing.has(column)) {
        await this.database().execute(`ALTER TABLE settings ADD COLUMN ${column} ${definition}`)
      }
    }
  }

  async getColumnMap(aliases) {
    const { availableColumns } = await this.getTableMeta()
    return Object.fromEntries(Object.entries(aliases).map(([field, candidates]) => [
      field,
      candidates.find(candidate => availableColumns.has(candidate)) || null
    ]))
  }

  async listKeyValueSettings(keys) {
    const placeholders = keys.map(() => '?').join(', ')
    const [rows] = await this.database().execute(
      `SELECT key_name, value FROM settings WHERE key_name IN (${placeholders})`,
      keys
    )
    return rows
  }

  async getSingleRowSettings() {
    const [rows] = await this.database().execute('SELECT * FROM settings LIMIT 1')
    return rows[0] || null
  }

  async saveKeyValueSetting(keyName, value, description) {
    await this.database().execute(`
      INSERT INTO settings (key_name, value, type, description)
      VALUES (?, ?, 'string', ?)
      ON DUPLICATE KEY UPDATE
        value = VALUES(value),
        type = VALUES(type),
        description = VALUES(description),
        updated_at = CURRENT_TIMESTAMP
    `, [keyName, String(value ?? ''), description])
  }

  async saveSingleRowSettings(entries) {
    const database = this.database()
    const [existingRecords] = await database.execute('SELECT id FROM settings LIMIT 1')
    const columns = entries.map(item => item.column)
    const values = entries.map(item => item.value)

    if (existingRecords.length > 0) {
      const updateClause = columns.map(column => `${column} = ?`).join(', ')
      await database.execute(
        `UPDATE settings SET ${updateClause} WHERE id = ?`,
        [...values, existingRecords[0].id]
      )
      return
    }

    const placeholders = columns.map(() => '?').join(', ')
    await database.execute(
      `INSERT INTO settings (${columns.join(', ')}) VALUES (${placeholders})`,
      values
    )
  }
}

module.exports = SiteSettingsRepository
