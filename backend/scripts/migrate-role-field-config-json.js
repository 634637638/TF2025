'use strict'

const crypto = require('node:crypto')
const path = require('node:path')
const dotenv = require('dotenv')
const mysql = require('mysql2/promise')
const {
  FIELD_CONFIG_KEY_MAP,
  FIELD_ID_MAP,
  normalizeFieldConfig
} = require('./field-permission-migration-normalizer')

dotenv.config({ path: path.resolve(__dirname, '../.env'), quiet: true })

function parseConfig(value) {
  if (!value) return null
  return typeof value === 'string' ? JSON.parse(value) : value
}

function stableValue(value) {
  if (Array.isArray(value)) return [...value].sort()
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(Object.keys(value).sort().map(key => [key, stableValue(value[key])]))
}

function checksum(rows) {
  return crypto.createHash('sha256').update(JSON.stringify(stableValue(rows))).digest('hex')
}

function hasLegacyValue(config) {
  const serialized = JSON.stringify(config || {})
  return Object.keys(FIELD_CONFIG_KEY_MAP).some(key => Object.hasOwn(config || {}, key)) ||
    Object.keys(FIELD_ID_MAP).some(fieldId => serialized.includes(fieldId))
}

async function loadRows(connection) {
  const [rows] = await connection.execute(
    'SELECT id, role_id, module_key, field_config FROM role_field_permissions ORDER BY id'
  )
  return rows
}

async function main() {
  const execute = process.argv.includes('--execute')
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD || process.env.DB_PASS,
    database: process.env.DB_NAME,
    connectTimeout: 30000
  })

  try {
    const rows = await loadRows(connection)
    const updates = rows.flatMap(row => {
      const current = parseConfig(row.field_config)
      const normalized = normalizeFieldConfig(current)
      if (!normalized || JSON.stringify(stableValue(current)) === JSON.stringify(stableValue(normalized))) {
        return []
      }
      return [{ ...row, field_config: normalized }]
    })
    const before = {
      row_count: rows.length,
      legacy_row_count: rows.filter(row => hasLegacyValue(parseConfig(row.field_config))).length,
      checksum: checksum(rows)
    }

    if (!execute) {
      console.log(JSON.stringify({
        status: 'preview',
        before,
        update_count: updates.length,
        affected_rows: updates.map(({ id, role_id, module_key }) => ({ id, role_id, module_key }))
      }, null, 2))
      return
    }

    await connection.beginTransaction()
    try {
      for (const row of updates) {
        await connection.execute(
          'UPDATE role_field_permissions SET field_config = ?, updated_at = NOW() WHERE id = ?',
          [JSON.stringify(row.field_config), row.id]
        )
      }
      await connection.commit()
    } catch (error) {
      await connection.rollback()
      throw error
    }

    const afterRows = await loadRows(connection)
    const legacyAfter = afterRows.filter(row => hasLegacyValue(parseConfig(row.field_config)))
    if (legacyAfter.length > 0) {
      throw new Error(`迁移后仍有 ${legacyAfter.length} 条历史字段权限 JSON`)
    }

    console.log(JSON.stringify({
      status: 'completed',
      before,
      updated: updates.length,
      after: {
        row_count: afterRows.length,
        legacy_row_count: 0,
        checksum: checksum(afterRows)
      }
    }, null, 2))
  } finally {
    await connection.end()
  }
}

main().catch(error => {
  console.error(JSON.stringify({ status: 'failed', message: error.message }, null, 2))
  process.exitCode = 1
})

module.exports = { hasLegacyValue }
