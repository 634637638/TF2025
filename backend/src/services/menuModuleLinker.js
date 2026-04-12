/**
 * 菜单-模块关联服务
 * 负责自动关联 menus 表和 modules 表
 */

const { getDatabase } = require('../config/database');
const log = require('../utils/log');

class MenuModuleLinker {
  /**
   * 菜单名称到模块 key 的映射规则
   */
  constructor() {
    this.mappingRules = [
      // 直接名称匹配（使用实际的模块 key）
      { menuPattern: (name) => name === '考勤管理', moduleKey: 'attendance_attendanceview' },
      { menuPattern: (name) => name === '工资管理', moduleKey: 'salary_salaryview' },
      { menuPattern: (name) => name === '工资模板', moduleKey: 'salary_salarytemplatesview' },
      { menuPattern: (name) => name === '工资记录', moduleKey: 'salary_salaryrecordsview' },
      { menuPattern: (name) => name === '我的考勤', moduleKey: 'attendance_myattendanceview' },
      { menuPattern: (name) => name === '我的工资', moduleKey: 'salary_mysalaryview' },
      { menuPattern: (name) => name === 'Git管理', moduleKey: 'system_gitmanagement' },
      { menuPattern: (name) => name === 'Git仓库', moduleKey: 'system_gitmanagement' },
      { menuPattern: (name) => name === 'GIT仓库', moduleKey: 'system_gitmanagement' },

      // 模糊匹配规则
      { menuPattern: (name) => name.includes('考勤'), moduleKey: 'attendance_attendanceview' },
      { menuPattern: (name) => name.includes('工资') && name.includes('模板'), moduleKey: 'salary_salarytemplatesview' },
      { menuPattern: (name) => name.includes('工资') && !name.includes('模板'), moduleKey: 'salary_salaryview' },
      { menuPattern: (name) => /git/i.test(name) && (name.includes('仓库') || name.includes('管理')), moduleKey: 'system_gitmanagement' },

      // 通用规则：移除"管理"、"我的"等后缀/前缀
      { menuPattern: (name) => true, fallback: true }
    ];
  }

  /**
   * 根据菜单名称查找对应的模块 key
   */
  findModuleKeyForMenu(menuName) {
    // 先尝试直接精确匹配
    for (const rule of this.mappingRules) {
      if (!rule.fallback && rule.menuPattern(menuName)) {
        return rule.moduleKey;
      }
    }

    // 如果没有匹配，尝试通过 URL 匹配
    return null;
  }

  normalizeMatcherToken(value) {
    return String(value || '')
      .toLowerCase()
      .replace(/[^a-z0-9\u4e00-\u9fa5]/g, '');
  }

  buildUrlTokens(menuUrl) {
    const rawParts = String(menuUrl || '')
      .replace(/^\//, '')
      .split('/')
      .map(part => this.normalizeMatcherToken(part))
      .filter(Boolean);

    const tokenSet = new Set();
    rawParts.forEach(token => {
      tokenSet.add(token);
      if (token.endsWith('s') && token.length > 3) {
        tokenSet.add(token.slice(0, -1));
      }
    });

    return Array.from(tokenSet);
  }

  /**
   * 同步所有菜单和模块的关联关系
   */
  async syncAllMenusToModules() {
    const pool = getDatabase();
    const connection = await pool.getConnection();

    try {
      log.debug('🔗 开始同步菜单-模块关联...');

      // 1. 获取所有未关联的活跃菜单
      const [unlinkedMenus] = await connection.execute(
        'SELECT id, name, url FROM menus WHERE (module_id IS NULL OR module_id = 0) AND is_active = 1'
      );

      log.debug(`📋 发现 ${unlinkedMenus.length} 个未关联的菜单`);

      if (unlinkedMenus.length === 0) {
        return {
          success: true,
          message: '所有菜单已关联，无需同步',
          linked: 0,
          notFound: 0
        };
      }

      // 2. 获取所有活跃模块
      const [allModules] = await connection.execute(
        'SELECT id, `key`, name FROM modules WHERE is_active = 1'
      );

      const moduleMap = new Map();
      for (const module of allModules) {
        moduleMap.set(module.key, module.id);
        moduleMap.set(module.name, module.id);
      }

      log.debug(`📦 当前有 ${allModules.length} 个模块可用`);

      // 3. 尝试关联每个菜单
      let linkedCount = 0;
      let notFoundCount = 0;
      const results = [];

      for (const menu of unlinkedMenus) {
        const moduleKey = this.findModuleKeyForMenu(menu.name);
        const moduleId = moduleKey ? moduleMap.get(moduleKey) : null;

        if (moduleId) {
          // 找到匹配的模块，更新菜单
          await connection.execute(
            'UPDATE menus SET module_id = ?, module_key = ?, updated_at = NOW() WHERE id = ?',
            [moduleId, moduleKey, menu.id]
          );

          linkedCount++;
          results.push({
            menuId: menu.id,
            menuName: menu.name,
            action: 'linked',
            moduleKey: moduleKey,
            moduleId: moduleId
          });

          log.debug(`✅ 已关联菜单 "${menu.name}" -> 模块 "${moduleKey}" (ID: ${moduleId})`);
        } else {
          // 尝试通过 URL 路径匹配
          const matchedByPath = this.matchModuleByPath(menu.url, moduleMap, allModules);

          if (matchedByPath) {
            await connection.execute(
              'UPDATE menus SET module_id = ?, module_key = ?, updated_at = NOW() WHERE id = ?',
              [matchedByPath.id, matchedByPath.key, menu.id]
            );

            linkedCount++;
            results.push({
              menuId: menu.id,
              menuName: menu.name,
              action: 'linked',
              moduleKey: matchedByPath.key,
              moduleId: matchedByPath.id,
              method: 'path-match'
            });

            log.debug(`✅ 已关联菜单 "${menu.name}" -> 模块 "${matchedByPath.key}" (通过 URL 匹配)`);
          } else {
            notFoundCount++;
            results.push({
              menuId: menu.id,
              menuName: menu.name,
              action: 'not-found',
              reason: 'no matching module'
            });

            log.debug(`⚠️ 未找到匹配模块: "${menu.name}" (URL: ${menu.url})`);
          }
        }
      }

      log.debug(`📊 同步完成: ${linkedCount} 个已关联, ${notFoundCount} 个未找到匹配`);

      return {
        success: true,
        message: `同步完成: ${linkedCount} 个关联成功, ${notFoundCount} 个未找到匹配`,
        linked: linkedCount,
        notFound: notFoundCount,
        results: results
      };

    } catch (error) {
      log.error('❌ 同步菜单-模块关联失败:', error);
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * 通过 URL 路径匹配模块
   */
  matchModuleByPath(menuUrl, moduleMap, allModules) {
    if (!menuUrl) return null;

    const urlTokens = this.buildUrlTokens(menuUrl);
    if (urlTokens.length === 0) return null;

    const normalizedPath = urlTokens.join('');
    const normalizedModules = allModules.map(module => ({
      ...module,
      normalizedKey: this.normalizeMatcherToken(module.key)
    }));

    const directMatch = normalizedModules.find(module =>
      module.normalizedKey === normalizedPath ||
      module.normalizedKey.startsWith(normalizedPath) ||
      normalizedPath.startsWith(module.normalizedKey)
    );

    if (directMatch) {
      return directMatch;
    }

    const scoredMatches = normalizedModules
      .map(module => {
        const score = urlTokens.reduce((total, token) => {
          if (!module.normalizedKey.includes(token)) {
            return total;
          }
          return total + (token.length > 4 ? 2 : 1);
        }, 0);

        return { module, score };
      })
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score || a.module.normalizedKey.length - b.module.normalizedKey.length);

    return scoredMatches[0]?.module || null;
  }

  /**
   * 关联单个菜单到模块
   */
  async linkMenuToModule(menuId, moduleKey) {
    const pool = getDatabase();

    try {
      // 获取模块信息
      const [modules] = await pool.execute(
        'SELECT id, `key` FROM modules WHERE `key` = ? AND is_active = 1',
        [moduleKey]
      );

      if (modules.length === 0) {
        return {
          success: false,
          message: `模块 "${moduleKey}" 不存在`
        };
      }

      const module = modules[0];

      // 更新菜单
      const [result] = await pool.execute(
        'UPDATE menus SET module_id = ?, module_key = ?, updated_at = NOW() WHERE id = ?',
        [module.id, module.key, menuId]
      );

      if (result.affectedRows === 0) {
        return {
          success: false,
          message: `菜单 ID ${menuId} 不存在`
        };
      }

      return {
        success: true,
        message: `菜单已关联到模块 "${moduleKey}"`,
        menuId: menuId,
        moduleKey: module.key,
        moduleId: module.id
      };

    } catch (error) {
      log.error('关联菜单到模块失败:', error);
      throw error;
    }
  }

  /**
   * 获取所有未关联的菜单
   */
  async getUnlinkedMenus() {
    const pool = getDatabase();

    try {
      const [menus] = await pool.execute(
        'SELECT id, name, url, parent_id, sort_order FROM menus WHERE (module_id IS NULL OR module_id = 0) AND is_active = 1 ORDER BY parent_id, sort_order'
      );

      return {
        success: true,
        data: {
          total: menus.length,
          menus: menus
        }
      };

    } catch (error) {
      log.error('获取未关联菜单失败:', error);
      throw error;
    }
  }

  /**
   * 获取关联统计信息
   */
  async getLinkStats() {
    const pool = getDatabase();

    try {
      // 总菜单数
      const [totalMenus] = await pool.execute(
        'SELECT COUNT(*) as count FROM menus WHERE is_active = 1'
      );

      // 已关联菜单数
      const [linkedMenus] = await pool.execute(
        'SELECT COUNT(*) as count FROM menus WHERE module_id IS NOT NULL AND module_id != 0 AND is_active = 1'
      );

      // 未关联菜单数
      const [unlinkedMenus] = await pool.execute(
        'SELECT COUNT(*) as count FROM menus WHERE (module_id IS NULL OR module_id = 0) AND is_active = 1'
      );

      // 总模块数
      const [totalModules] = await pool.execute(
        'SELECT COUNT(*) as count FROM modules WHERE is_active = 1'
      );

      return {
        success: true,
        data: {
          totalMenus: totalMenus[0].count,
          linkedMenus: linkedMenus[0].count,
          unlinkedMenus: unlinkedMenus[0].count,
          totalModules: totalModules[0].count,
          linkRate: totalMenus[0].count > 0
            ? Math.round((linkedMenus[0].count / totalMenus[0].count) * 100)
            : 0
        }
      };

    } catch (error) {
      log.error('获取关联统计失败:', error);
      throw error;
    }
  }
}

module.exports = MenuModuleLinker;
