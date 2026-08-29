'use strict'

const crypto = require('node:crypto')
const path = require('node:path')
const dotenv = require('dotenv')
const mysql = require('mysql2/promise')
const { normalizeFieldConfig } = require('./field-permission-migration-normalizer')

dotenv.config({ path: path.resolve(__dirname, '../.env'), quiet: true })

const MODULE_KEY_MAP = Object.freeze({
  accessories_accessories: 'accessories_accessoriesview',
  analytics_analytics: 'analytics_analyticsview',
  attendance_attendance: 'attendance_attendanceview',
  brands_brands: 'brands_brandsview',
  colors_colors: 'colors_colorsview',
  customers_customers: 'customers_customersview',
  employees_employees: 'employees_employeesview',
  inventory: 'inventory_inventoryview',
  inventory_stockinpage: 'inventory_inventoryview',
  memories_memories: 'memories_memoriesview',
  models_models: 'models_modelsview',
  permissions: 'permissions_permissionsview',
  query: 'query_queryview',
  query_querypage: 'query_queryview',
  rentals_rentals: 'rentals_rentalsview',
  repairs_repairs: 'repairs_repairsview',
  salary_records: 'salary_salaryrecordsview',
  sales_salespage: 'sales_salesview',
  stock_out: 'query_queryview',
  stores: 'stores_storesview',
  stores_stores: 'stores_storesview',
  subsidy: 'subsidy_subsidyview',
  subsidy_management: 'subsidy_subsidyview',
  supplier_payments: 'payments_supplierphonepaymentsview',
  suppliers_suppliers: 'suppliers_suppliersview',
  system_settings: 'system_systemview'
})

const ACTION_ONLY_FIELDS = new Set(['view', 'create', 'edit', 'delete', 'approve', 'export'])

function parseConfig(value) {
  if (!value) return null
  if (typeof value === 'string') return JSON.parse(value)
  return value
}

function isActionOnlyConfig(config) {
  const keys = Object.keys(config || {})
  return keys.length > 0 && keys.every(key => ACTION_ONLY_FIELDS.has(key))
}

function stableValue(value) {
  if (Array.isArray(value)) return [...value].sort()
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(Object.keys(value).sort().map(key => [key, stableValue(value[key])]))
}

function checksum(rows) {
  return crypto.createHash('sha256').update(JSON.stringify(stableValue(rows))).digest('hex')
}

function mergeConfigs(current, incoming) {
  if (!current) return incoming
  if (!incoming) return current

  const merged = { ...incoming, ...current }
  for (const key of ['hidden_fields', 'editable_fields']) {
    if (Array.isArray(current[key]) || Array.isArray(incoming[key])) {
      merged[key] = Array.from(new Set([...(current[key] || []), ...(incoming[key] || [])])).sort()
    }
  }
  return merged
}

async function loadRows(connection) {
  const [rows] = await connection.query(`
    SELECT rfp.id, rfp.role_id, rfp.module_key, rfp.field_config
    FROM role_field_permissions rfp
    WHERE rfp.module_key IN (?)
    ORDER BY rfp.module_key, rfp.role_id, rfp.id
  `, [Object.keys(MODULE_KEY_MAP)])
  return rows
}

async function buildPlan(connection) {
  const legacyRows = await loadRows(connection)
  const targetKeys = Array.from(new Set(Object.values(MODULE_KEY_MAP)))
  const [moduleRows] = await connection.query('SELECT `key` FROM modules WHERE `key` IN (?)', [targetKeys])
  const existingModules = new Set(moduleRows.map(row => row.key))
  const missingTargets = targetKeys.filter(key => !existingModules.has(key))
  if (missingTargets.length > 0) {
    throw new Error(`目标模块不存在: ${missingTargets.join(', ')}`)
  }

  const [targetRows] = await connection.query(`
    SELECT id, role_id, module_key, field_config
    FROM role_field_permissions
    WHERE module_key IN (?)
  `, [targetKeys])
  const targetByRole = new Map(targetRows.map(row => [`${row.role_id}:${row.module_key}`, row]))
  const updates = []
  const inserts = []
  const ignoredActionConfigs = []

  for (const legacyRow of legacyRows) {
    const targetKey = MODULE_KEY_MAP[legacyRow.module_key]
    const rawConfig = parseConfig(legacyRow.field_config)
    if (isActionOnlyConfig(rawConfig)) {
      ignoredActionConfigs.push({ id: legacyRow.id, role_id: legacyRow.role_id, module_key: legacyRow.module_key })
      continue
    }

    const incoming = normalizeFieldConfig(rawConfig)
    if (!incoming) continue

    const lookupKey = `${legacyRow.role_id}:${targetKey}`
    const targetRow = targetByRole.get(lookupKey)
    if (targetRow) {
      const current = normalizeFieldConfig(parseConfig(targetRow.field_config))
      const merged = mergeConfigs(current, incoming)
      updates.push({ id: targetRow.id, role_id: legacyRow.role_id, module_key: targetKey, field_config: merged })
      targetRow.field_config = merged
    } else {
      const created = { role_id: legacyRow.role_id, module_key: targetKey, field_config: incoming }
      inserts.push(created)
      targetByRole.set(lookupKey, created)
    }
  }

  return {
    legacyRows,
    updates: Array.from(new Map(updates.map(item => [item.id, item])).values()),
    inserts,
    ignoredActionConfigs
  }
}

async function main() {
  const execute = process.argv.includes('--execute')
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD || process.env.DB_PASS,
    database: process.env.DB_NAME
  })

  try {
    const plan = await buildPlan(connection)
    const before = {
      row_count: plan.legacyRows.length,
      checksum: checksum(plan.legacyRows),
      distinct_module_keys: Array.from(new Set(plan.legacyRows.map(row => row.module_key))).length
    }

    if (!execute) {
      console.log(JSON.stringify({
        status: 'preview',
        before,
        update_count: plan.updates.length,
        insert_count: plan.inserts.length,
        ignored_action_config_count: plan.ignoredActionConfigs.length,
        delete_legacy_count: plan.legacyRows.length,
        mappings: MODULE_KEY_MAP
      }, null, 2))
      return
    }

    await connection.beginTransaction()
    try {
      for (const item of plan.updates) {
        await connection.execute(
          'UPDATE role_field_permissions SET field_config = ?, updated_at = NOW() WHERE id = ?',
          [JSON.stringify(item.field_config), item.id]
        )
      }
      for (const item of plan.inserts) {
        await connection.execute(
          'INSERT INTO role_field_permissions (role_id, module_key, field_config, created_at, updated_at) VALUES (?, ?, ?, NOW(), NOW())',
          [item.role_id, item.module_key, JSON.stringify(item.field_config)]
        )
      }
      if (plan.legacyRows.length > 0) {
        await connection.query('DELETE FROM role_field_permissions WHERE module_key IN (?)', [Object.keys(MODULE_KEY_MAP)])
      }
      await connection.commit()
    } catch (error) {
      await connection.rollback()
      throw error
    }

    const [remaining] = await connection.query(`
      SELECT COUNT(*) AS count
      FROM role_field_permissions rfp
      LEFT JOIN modules m ON m.\`key\` = rfp.module_key
      WHERE m.id IS NULL
    `)
    console.log(JSON.stringify({
      status: 'completed',
      before,
      updated: plan.updates.length,
      inserted: plan.inserts.length,
      removed_legacy_rows: plan.legacyRows.length,
      ignored_action_configs: plan.ignoredActionConfigs,
      unmatched_after: Number(remaining[0].count)
    }, null, 2))
  } finally {
    await connection.end()
  }
}

main().catch(error => {
  console.error(JSON.stringify({ status: 'failed', message: error.message }, null, 2))
  process.exitCode = 1
})

module.exports = { MODULE_KEY_MAP, mergeConfigs }
