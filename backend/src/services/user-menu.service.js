'use strict'

const { withConnection } = require('../core/db/connection')

const { getDatabase } = require('../config/database')
const { getUserMenuVisibility } = require('./access-control.service')
const UserMenuRepository = require('../repositories/user-menu.repository')
const { buildHierarchicalMenu, formatMenus } = require('../utils/menu-hierarchy')

class UserMenuService {
  constructor({
    database = getDatabase,
    repository = new UserMenuRepository(),
    getVisibility = getUserMenuVisibility
  } = {}) {
    this.database = database
    this.repository = repository
    this.getVisibility = getVisibility
  }

  async getUserMenu(userId) {
    return withConnection(this.database(), async connection => {
      const [allMenus, modules] = await Promise.all([
        this.repository.getActiveMenus(connection),
        this.repository.getActiveModules(connection)
      ])
      const moduleIdToKey = new Map(modules.map(module => [module.id, module.key]))
      const menuVisibility = await this.getVisibility(userId, connection)
      const visibleModuleKeys = new Set(
        Object.entries(menuVisibility)
          .filter(([, visible]) => visible)
          .map(([moduleKey]) => moduleKey)
      )
      const fullHierarchy = buildHierarchicalMenu(allMenus)
      const filterMenus = (menus) => menus
        .map((menu) => {
          const children = filterMenus(menu.children || [])
          const resolvedModuleKey = menu.module_key || moduleIdToKey.get(menu.module_id) || null
          const isPublicMenu = !menu.module_id && !menu.module_key
          const isVisible = isPublicMenu || (resolvedModuleKey ? visibleModuleKeys.has(resolvedModuleKey) : false)
          if (!isVisible && children.length === 0) return null
          return { ...menu, children }
        })
        .filter(Boolean)

      return formatMenus(filterMenus(fullHierarchy))
    })
  }
}

module.exports = UserMenuService
