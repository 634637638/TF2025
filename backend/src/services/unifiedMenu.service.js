/**
 * 统一菜单服务
 * 统一按“用户角色并集 + 菜单可见性”返回菜单，不再做角色名特判。
 */

const { getDatabase } = require('../config/database');
const { getUserMenuVisibility } = require('./accessControl.service');
const log = require('../utils/log');

class UnifiedMenuService {
  async getUserMenus(req) {
    try {
      const userId = req.user?.id || req.user?.userId;
      if (!userId) {
        return {
          success: false,
          message: '用户未认证',
          data: []
        };
      }

      const db = getDatabase();
      const [allMenus] = await db.execute(`
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
        ORDER BY sort_order ASC, id ASC
      `);

      const [modules] = await db.execute(`
        SELECT id, \`key\`
        FROM modules
        WHERE is_active = 1
      `);

      const moduleIdToKey = new Map(modules.map((module) => [module.id, module.key]));
      const menuVisibility = await getUserMenuVisibility(userId, db);
      const visibleModuleKeys = new Set(
        Object.entries(menuVisibility)
          .filter(([, visible]) => visible)
          .map(([moduleKey]) => moduleKey)
      );

      const fullTree = this.buildTree(allMenus);
      const filteredMenus = this.filterTree(fullTree, visibleModuleKeys, moduleIdToKey);

      return {
        success: true,
        data: filteredMenus,
        message: '获取菜单成功'
      };
    } catch (error) {
      log.error('❌ 统一菜单服务错误:', error);
      return {
        success: true,
        data: [],
        message: '获取菜单失败: ' + error.message
      };
    }
  }

  buildTree(items, parentId = 0) {
    const tree = [];

    for (const item of items) {
      if (item.parent_id === parentId) {
        const children = this.buildTree(items, item.id);
        if (children.length > 0) {
          item.children = children;
        }
        tree.push(item);
      }
    }

    return tree;
  }

  filterTree(menus, visibleModuleKeys, moduleIdToKey) {
    return menus
      .map((menu) => {
        const children = this.filterTree(menu.children || [], visibleModuleKeys, moduleIdToKey);
        const moduleKey = menu.module_key || moduleIdToKey.get(menu.module_id) || null;
        const isPublicMenu = !menu.module_id && !menu.module_key;
        const isVisible = isPublicMenu || (moduleKey ? visibleModuleKeys.has(moduleKey) : false);

        if (!isVisible && children.length === 0) {
          return null;
        }

        return {
          ...menu,
          children
        };
      })
      .filter(Boolean);
  }

  async getFlatUserMenus(req) {
    const result = await this.getUserMenus(req);

    if (!result.success) {
      return result;
    }

    const flatMenus = [];
    const flatten = (menus) => {
      menus.forEach((menu) => {
        const { children, ...menuData } = menu;
        flatMenus.push(menuData);
        if (children && children.length > 0) {
          flatten(children);
        }
      });
    };

    flatten(result.data);

    return {
      success: true,
      data: flatMenus,
      message: '获取菜单成功'
    };
  }
}

module.exports = new UnifiedMenuService();
