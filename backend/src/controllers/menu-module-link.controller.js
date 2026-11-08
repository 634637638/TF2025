'use strict'

const log = require('../utils/log')
const MenuModuleLinker = require('../services/menu-module-linker.service')

class MenuModuleLinkController {
  constructor({ service = new MenuModuleLinker(), logger = log } = {}) {
    this.service = service
    this.logger = logger
  }

  async getLinkStats(_req, res) {
    try {
      return res.json(await this.service.getLinkStats())
    } catch (error) {
      this.logger.error('获取关联统计失败:', error)
      return res.status(500).json({ success: false, message: '获取关联统计失败: ' + error.message })
    }
  }

  async getUnlinkedMenus(_req, res) {
    try {
      return res.json(await this.service.getUnlinkedMenus())
    } catch (error) {
      this.logger.error('获取未关联菜单失败:', error)
      return res.status(500).json({ success: false, message: '获取未关联菜单失败: ' + error.message })
    }
  }

  async syncAll(_req, res) {
    try {
      return res.json(await this.service.syncAllMenusToModules())
    } catch (error) {
      this.logger.error('同步菜单-模块关联失败:', error)
      return res.status(500).json({ success: false, message: '同步失败: ' + error.message })
    }
  }

  async linkMenu(req, res) {
    const { menu_id, module_key } = req.body
    if (!menu_id || !module_key) {
      return res.status(400).json({ success: false, message: '菜单ID和模块标识不能为空' })
    }

    try {
      return res.json(await this.service.linkMenuToModule(menu_id, module_key))
    } catch (error) {
      this.logger.error('关联菜单到模块失败:', error)
      return res.status(500).json({ success: false, message: '关联失败: ' + error.message })
    }
  }
}

module.exports = MenuModuleLinkController
