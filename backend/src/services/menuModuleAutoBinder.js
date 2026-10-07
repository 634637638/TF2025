/**
 * 菜单自动绑定入口适配层。
 * 复用公共关联服务，只绑定已注册的有效模块，不自行推断并创建权限模块。
 */
const { getDatabase } = require('../config/database')
const MenuModuleLinker = require('./menuModuleLinker')
const log = require('../utils/log')

class MenuModuleAutoBinder {
  constructor() {
    this.menuLinker = new MenuModuleLinker()
  }

  async autoBindModule(menuData) {
    try {
      const url = menuData.url || menuData.path
      if (!url || typeof url !== 'string' || url === '#') {
        return { success: false, message: '无有效页面路径，无需绑定业务模块' }
      }
      const [modules] = await getDatabase().execute(
        'SELECT id, `key`, name FROM modules WHERE is_active = 1'
      )
      const module = this.menuLinker.findModuleForMenu({ ...menuData, url }, modules)
      if (!module) {
        return { success: false, message: '未找到对应的有效模块，请先扫描注册或手动关联模块' }
      }
      return {
        success: true,
        module_id: module.id,
        module_key: module.key,
        message: `成功绑定到模块: ${module.name}`
      }
    } catch (error) {
      log.error('菜单模块自动绑定失败:', error)
      return { success: false, message: `绑定失败: ${error.message}` }
    }
  }

  async batchFixMenuModuleBindings() {
    try {
      const db = getDatabase()
      const [menus] = await db.execute(
        'SELECT id, name, url FROM menus WHERE is_active = 1 AND (module_id IS NULL OR module_id = 0 OR module_key IS NULL) AND url IS NOT NULL AND url != "" AND url != "#"'
      )
      const results = []
      for (const menu of menus) {
        const result = await this.bindModuleForMenu(menu.id, menu)
        results.push({
          menu_id: menu.id,
          menu_name: menu.name,
          status: result.success ? 'success' : 'failed',
          ...(result.success ? { module_key: result.module_key } : { message: result.message })
        })
      }
      const successCount = results.filter(result => result.status === 'success').length
      return {
        success: true,
        data: { total: menus.length, success: successCount, failed: menus.length - successCount, results }
      }
    } catch (error) {
      log.error('批量修复菜单关联失败:', error)
      return { success: false, message: `批量修复失败: ${error.message}` }
    }
  }

  async bindModuleForMenu(menuId, menuData) {
    try {
      const result = await this.autoBindModule(menuData)
      if (result.success) {
        await getDatabase().execute(
          'UPDATE menus SET module_id = ?, module_key = ?, updated_at = NOW() WHERE id = ?',
          [result.module_id, result.module_key, menuId]
        )
      }
      return result
    } catch (error) {
      log.error('菜单模块绑定失败:', error)
      return { success: false, message: `绑定失败: ${error.message}` }
    }
  }
}

module.exports = new MenuModuleAutoBinder()
