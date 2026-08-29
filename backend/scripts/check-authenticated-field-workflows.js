'use strict'

const path = require('node:path')
const dotenv = require('dotenv')
const mysql = require('mysql2/promise')

dotenv.config({ path: path.resolve(__dirname, '../.env'), quiet: true })

const baseUrl = process.env.AUTH_REGRESSION_BASE_URL || 'http://127.0.0.1:3010/api'

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function assertNoKeys(value, forbiddenKeys, location) {
  if (!value || typeof value !== 'object') return
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoKeys(item, forbiddenKeys, `${location}[${index}]`))
    return
  }
  for (const [key, nested] of Object.entries(value)) {
    assert(!forbiddenKeys.has(key), `${location} 返回已退役字段 ${key}`)
    assertNoKeys(nested, forbiddenKeys, `${location}.${key}`)
  }
}

async function request(pathname, token) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    headers: { Authorization: `Bearer ${token}` }
  })
  const contentType = response.headers.get('content-type') || ''
  const body = contentType.includes('application/json')
    ? await response.json()
    : await response.text()
  if (!response.ok) {
    const message = body && typeof body === 'object' ? body.message : String(body)
    throw new Error(`${pathname} 返回 ${response.status}: ${message || '请求失败'}`)
  }
  return { status: response.status, body, content_type: contentType }
}

async function main() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD || process.env.DB_PASS,
    database: process.env.DB_NAME,
    connectTimeout: 30000
  })

  try {
    const [users] = await connection.execute(`
      SELECT u.id, u.username, u.name
      FROM users u
      JOIN user_roles ur ON ur.user_id = u.id AND ur.status = 'active'
      JOIN roles r ON r.id = ur.role_id AND r.is_active = 1
      JOIN role_permissions rp ON rp.role_id = r.id
      WHERE (u.status = 1 OR u.status = 'active')
        AND rp.module_key = 'permissions_permissionsview'
        AND rp.permission_type IN ('view', 'create', 'edit', 'delete')
      GROUP BY u.id, u.username, u.name
      HAVING COUNT(DISTINCT rp.permission_type) = 4
      ORDER BY u.id
      LIMIT 1
    `)
    assert(users.length === 1, '未找到具备权限管理完整权限的启用用户')

    const user = users[0]
    const [roles] = await connection.execute(`
      SELECT r.id, r.name, r.code
      FROM user_roles ur
      JOIN roles r ON r.id = ur.role_id
      WHERE ur.user_id = ? AND ur.status = 'active' AND r.is_active = 1
      ORDER BY r.id
    `, [user.id])
    const [stores] = await connection.execute(
      'SELECT store_id, is_primary FROM user_stores WHERE user_id = ? ORDER BY is_primary DESC, store_id',
      [user.id]
    )
    assert(roles.length > 0, '回归用户没有有效角色')

    const { generateTokens } = require('../src/middleware/jwt-blacklist')
    const { accessToken } = generateTokens({
      ...user,
      roles: roles.map(role => role.name),
      role_ids: roles.map(role => role.id),
      role_codes: roles.map(role => role.code).filter(Boolean),
      store_id: stores.find(store => Number(store.is_primary) === 1)?.store_id || null,
      store_ids: stores.map(store => store.store_id)
    })

    const roleId = roles[0].id
    const checks = [
      ['roles', '/permissions/roles?page=1&page_size=5'],
      ['users_with_roles', '/permissions/users-with-roles?page=1&page_size=5'],
      ['field_permissions', `/permissions/field-permissions/${roleId}`],
      ['permission_logs', '/permission-logs/logs?page=1&page_size=5'],
      ['user_stores', `/user-stores/user/${user.id}`],
      ['modules', '/modules/registered'],
      ['permission_export', '/permissions/export?format=json'],
      ['h5_orders', '/shop/orders?page=1&page_size=5'],
      ['data_import_history', '/data-import/history?page=1&page_size=5']
    ]
    const forbiddenKeys = new Set([
      'totalPages', 'hasNext', 'hasPrev', 'roleId', 'startDate', 'endDate', 'size',
      'moduleKey', 'moduleKeys', 'permissionType', 'fieldConfig', 'hiddenFields',
      'editableFields', 'userId', 'storeId', 'storeIds', 'isPrimary', 'replaceExisting',
      'isActive', 'isCustom', 'targetType', 'targetId', 'targetName', 'rolePermissions'
    ])
    const results = []

    for (const [name, pathname] of checks) {
      const result = await request(pathname, accessToken)
      if (typeof result.body === 'object') {
        assertNoKeys(result.body, forbiddenKeys, name)
      }
      results.push({ name, status: result.status, success: true })
    }

    console.log(JSON.stringify({
      status: 'completed',
      authenticated_user_id: user.id,
      checks: results
    }, null, 2))
  } finally {
    await connection.end()
  }
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(JSON.stringify({ status: 'failed', message: error.message }, null, 2))
    process.exit(1)
  })
