'use strict'

class PermissionMenuRepository {
  /** 仅提供导航位置，不按查看人或目标角色的菜单可见性裁剪权限模块。 */
  async listMenuOrder(database) {
    const [menus] = await database.execute(`
      SELECT menu.id, menu.parent_id, menu.sort_order,
        COALESCE(NULLIF(menu.module_key, ''), module.\`key\`) AS module_key
      FROM menus menu
      LEFT JOIN modules module ON module.id = menu.module_id
      WHERE menu.is_active = 1
      ORDER BY menu.parent_id, menu.sort_order, menu.id
    `)
    return menus
  }


  async listModules(database, supportsModuleIsActive) {
    const activeModuleClause = supportsModuleIsActive ? 'WHERE m.is_active = 1' : ''
    const [modules] = await database.execute(`
      SELECT
        m.\`key\` AS module_key,
        m.name AS module_name,
        m.category,
        m.icon,
        m.description AS module_description
      FROM modules m
      ${activeModuleClause}
      ORDER BY m.category, m.sort_order, m.name
    `)
    return modules
  }
}

module.exports = PermissionMenuRepository
