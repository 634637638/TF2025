'use strict'

const { ensureIconSchema, iconLeftJoin } = require('../utils/iconStore')

class UserMenuRepository {
  async getActiveMenus(connection) {
    await ensureIconSchema(connection)
    const [rows] = await connection.execute(`
      SELECT
        m.id,
        m.name,
        m.url,
        m.icon,
        m.parent_id,
        m.sort_order,
        m.is_active,
        m.module_id,
        m.module_key,
        i.svg AS icon_svg,
        i.source AS icon_source,
        i.is_valid AS icon_is_valid
      FROM menus m
      ${iconLeftJoin('m', 'i')}
      WHERE m.is_active = 1
      ORDER BY m.parent_id, m.sort_order
    `)
    return rows
  }

  async getActiveModules(connection) {
    const [rows] = await connection.execute(`
      SELECT id, \`key\`
      FROM modules
      WHERE is_active = 1
    `)
    return rows
  }
}

module.exports = UserMenuRepository
