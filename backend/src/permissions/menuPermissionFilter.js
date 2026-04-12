const { getDatabase } = require('../config/database');
const { getUserMenuVisibility } = require('../services/accessControl.service');
const log = require('../utils/log');

function buildHierarchicalMenu(flatMenus) {
  const menuMap = new Map();
  const rootMenus = [];

  flatMenus.forEach((menu) => {
    menuMap.set(String(menu.id), {
      ...menu,
      children: []
    });
  });

  flatMenus.forEach((menu) => {
    const menuItem = menuMap.get(String(menu.id));
    if (!menu.parent_id || menu.parent_id === 0) {
      rootMenus.push(menuItem);
      return;
    }

    const parentMenu = menuMap.get(String(menu.parent_id));
    if (parentMenu) {
      parentMenu.children.push(menuItem);
    } else {
      rootMenus.push(menuItem);
    }
  });

  const sortMenus = (menus) => menus
    .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
    .map((menu) => ({
      ...menu,
      children: menu.children?.length ? sortMenus(menu.children) : []
    }));

  return sortMenus(rootMenus);
}

function formatMenus(menus) {
  return menus.map((menu) => ({
    id: menu.id,
    name: menu.name,
    url: menu.url,
    icon: menu.icon || 'el-icon-menu',
    parent_id: menu.parent_id,
    children: formatMenus(menu.children || [])
  }));
}

async function getMenuWithPermissionFilter(req, res) {
  let connection;

  try {
    const pool = getDatabase();
    connection = await pool.getConnection();

    const userId = req.user?.id || req.user?.userId;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: '用户未认证'
      });
    }

    const [allMenus] = await connection.execute(`
      SELECT
        id,
        name,
        url,
        icon,
        parent_id,
        sort_order,
        is_active,
        module_id,
        module_key
      FROM menus
      WHERE is_active = 1
      ORDER BY parent_id, sort_order
    `);

    const [modules] = await connection.execute(`
      SELECT id, \`key\`
      FROM modules
      WHERE is_active = 1
    `);

    const moduleIdToKey = new Map(modules.map((module) => [module.id, module.key]));
    const menuVisibility = await getUserMenuVisibility(userId, connection);
    const visibleModuleKeys = new Set(
      Object.entries(menuVisibility)
        .filter(([, visible]) => visible)
        .map(([moduleKey]) => moduleKey)
    );

    const fullHierarchy = buildHierarchicalMenu(allMenus);

    const filterMenus = (menus) => menus
      .map((menu) => {
        const children = filterMenus(menu.children || []);
        const resolvedModuleKey = menu.module_key || moduleIdToKey.get(menu.module_id) || null;
        const isPublicMenu = !menu.module_id && !menu.module_key;
        const isVisible = isPublicMenu || (resolvedModuleKey ? visibleModuleKeys.has(resolvedModuleKey) : false);

        if (!isVisible && children.length === 0) {
          return null;
        }

        return {
          ...menu,
          children
        };
      })
      .filter(Boolean);

    const permittedHierarchy = filterMenus(fullHierarchy);

    return res.json({
      success: true,
      message: '获取用户菜单权限成功',
      data: {
        menuPermissions: formatMenus(permittedHierarchy)
      }
    });
  } catch (error) {
    log.error('获取用户菜单权限失败:', error);
    return res.status(500).json({
      success: false,
      message: '获取用户菜单权限失败: ' + error.message
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
}

module.exports = getMenuWithPermissionFilter;
