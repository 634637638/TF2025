'use strict'

const { getDatabase } = require('../config/database')
const { withConnection } = require('../core/db/connection')

class ModuleManagementRepository {
  constructor({ database = getDatabase } = {}) {
    this.database = database
  }

  async getModuleKeys() {
    const [rows] = await this.database().execute('SELECT `key` FROM modules')
    return rows
  }

  async getModuleByKey(moduleKey, executor = this.database()) {
    const [rows] = await executor.execute(
      'SELECT * FROM modules WHERE `key` = ?',
      [moduleKey]
    )
    return rows[0] || null
  }

  async getModuleById(id) {
    const [rows] = await this.database().execute(
      'SELECT * FROM modules WHERE id = ?',
      [id]
    )
    return rows[0] || null
  }

  async updateModuleName(moduleKey, name, isCustom) {
    await this.database().execute(
      'UPDATE modules SET name = ?, is_custom_name = ?, updated_at = NOW() WHERE `key` = ?',
      [name, isCustom ? 1 : 0, moduleKey]
    )
  }

  async restoreModuleName(moduleKey, originalName) {
    await this.database().execute(
      'UPDATE modules SET name = ?, is_custom_name = 0, updated_at = NOW() WHERE `key` = ?',
      [originalName, moduleKey]
    )
  }

  async setModuleStatusById(id, isActive) {
    await this.database().execute(
      'UPDATE modules SET is_active = ?, updated_at = NOW() WHERE id = ?',
      [isActive, id]
    )
  }

  withConnection(operation) {
    return withConnection(this.database, operation)
  }

  createManualModule(connection, module) {
    return connection.execute(
      `INSERT INTO modules (\`key\`, name, description, category, icon, sort_order, is_active, is_custom_name, original_name, created_at)
       VALUES (?, ?, ?, ?, ?, 0, ?, 1, ?, NOW())`,
      [module.key, module.name, module.description, module.category, module.icon, module.isActive, module.name]
    )
  }

  deleteModulePermissions(connection, moduleKey) {
    return connection.execute(
      'DELETE FROM role_permissions WHERE module_key = ?',
      [moduleKey]
    )
  }

  softDeleteModule(connection, moduleKey) {
    return connection.execute(
      'UPDATE modules SET is_active = 0, updated_at = NOW() WHERE `key` = ?',
      [moduleKey]
    )
  }

  async updateModule(moduleKey, { name, description, category, icon, sort_order: sortOrder }) {
    const [result] = await this.database().execute(`
      UPDATE modules
      SET name = ?, description = ?, category = ?, icon = ?, sort_order = ?, updated_at = NOW()
      WHERE \`key\` = ?
    `, [name, description, category, icon, sortOrder, moduleKey])
    return result.affectedRows
  }

  async getModuleStatusByKey(moduleKey) {
    const [rows] = await this.database().execute(
      'SELECT id, `key`, name, is_active FROM modules WHERE `key` = ?',
      [moduleKey]
    )
    return rows[0] || null
  }

  async setModuleStatusByKey(moduleKey, isActive) {
    const [result] = await this.database().execute(
      'UPDATE modules SET is_active = ?, updated_at = NOW() WHERE `key` = ?',
      [isActive, moduleKey]
    )
    return result.affectedRows
  }

  async getOverviewStats() {
    const database = this.database()
    const [[totalModules]] = await database.execute(
      'SELECT COUNT(*) as total FROM modules WHERE is_active = 1'
    )
    const [[totalPermissions]] = await database.execute(
      'SELECT COUNT(DISTINCT CONCAT(module_key, permission_type)) as total FROM role_permissions'
    )
    const [[totalRoles]] = await database.execute(
      'SELECT COUNT(*) as total FROM roles WHERE is_active = 1'
    )
    const [[activeUsers]] = await database.execute(
      'SELECT COUNT(*) as total FROM users WHERE status = 1'
    )
    const [categoryStats] = await database.execute(`
      SELECT category, COUNT(*) as count
      FROM modules
      WHERE is_active = 1
      GROUP BY category
    `)

    return {
      total_modules: totalModules.total,
      total_permissions: totalPermissions.total,
      total_roles: totalRoles.total,
      active_users: activeUsers.total,
      category_stats: categoryStats,
      recent_syncs: []
    }
  }

  async getActiveModules() {
    const [rows] = await this.database().execute(`
      SELECT id, \`key\`, name, description, icon, is_active
      FROM modules
      WHERE is_active = 1
      ORDER BY name ASC
    `)
    return rows
  }

  async getRegisteredModules() {
    const [rows] = await this.database().execute(`
      SELECT m.*,
             CASE WHEN m.is_custom_name = 1 THEN "🔒 自定义" ELSE "🤖 自动" END as name_status
      FROM modules m
      ORDER BY m.is_active DESC, m.category, m.sort_order, m.\`key\`
    `)
    return rows
  }

  async getModuleNameRecord(moduleKey) {
    const [rows] = await this.database().execute(
      'SELECT `key`, name, is_active, is_custom_name, original_name, created_at, updated_at FROM modules WHERE `key` = ?',
      [moduleKey]
    )
    return rows[0] || null
  }

  async getModuleDetails(moduleKey) {
    const database = this.database()
    const [moduleRows] = await database.execute(
      'SELECT * FROM modules WHERE `key` = ? AND is_active = 1',
      [moduleKey]
    )
    if (moduleRows.length === 0) return null

    const [permissions] = await database.execute(
      'SELECT DISTINCT permission_type, description FROM role_permissions WHERE module_key = ?',
      [moduleKey]
    )
    const [rolePermissions] = await database.execute(`
      SELECT rp.role_id, r.name as role_name, rp.permission_type
      FROM role_permissions rp
      JOIN roles r ON rp.role_id = r.id
      WHERE rp.module_key = ?
      ORDER BY r.name
    `, [moduleKey])

    return { module: moduleRows[0], permissions, role_permissions: rolePermissions }
  }
}

module.exports = ModuleManagementRepository
