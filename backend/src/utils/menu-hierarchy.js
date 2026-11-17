'use strict'

function buildHierarchicalMenu(flatMenus) {
  const menuMap = new Map()
  const rootMenus = []

  flatMenus.forEach((menu) => {
    menuMap.set(String(menu.id), { ...menu, children: [] })
  })

  flatMenus.forEach((menu) => {
    const menuItem = menuMap.get(String(menu.id))
    if (!menu.parent_id || menu.parent_id === 0) {
      rootMenus.push(menuItem)
      return
    }

    const parentMenu = menuMap.get(String(menu.parent_id))
    if (parentMenu) parentMenu.children.push(menuItem)
    else rootMenus.push(menuItem)
  })

  const sortMenus = (menus) => menus
    .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
    .map((menu) => ({
      ...menu,
      children: menu.children?.length ? sortMenus(menu.children) : []
    }))

  return sortMenus(rootMenus)
}

function sortModulesByMenu(modules, menus, normalizeModuleKey) {
  const positions = new Map()
  const visit = nodes => {
    for (const menu of nodes) {
      const key = menu.module_key && normalizeModuleKey(menu.module_key)
      if (key && !positions.has(key)) positions.set(key, positions.size)
      visit(menu.children || [])
    }
  }
  visit(buildHierarchicalMenu(menus))
  // 无导航位置的模块保留原分类/名称顺序，既不丢失，也不挤到已配置菜单前。
  const position = module => positions.get(normalizeModuleKey(module.module_key)) ?? Number.MAX_SAFE_INTEGER
  return [...modules].sort((left, right) => position(left) - position(right))
}

function formatMenus(menus) {
  return menus.map((menu) => ({
    id: menu.id,
    name: menu.name,
    url: menu.url,
    icon: menu.icon || 'el-icon-menu',
    icon_svg: menu.icon_svg || null,
    icon_source: menu.icon_source || null,
    icon_is_valid: menu.icon_is_valid,
    parent_id: menu.parent_id,
    children: formatMenus(menu.children || [])
  }))
}

module.exports = { buildHierarchicalMenu, sortModulesByMenu, formatMenus }
