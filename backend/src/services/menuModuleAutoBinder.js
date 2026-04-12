/**
 * 菜单模块自动绑定服务
 * 功能：在创建/更新菜单时，自动根据路径检索并绑定对应的模块
 *
 * 作者：TF2025 Team
 * 创建时间：2025-01-05
 */

const { getDatabase } = require('../config/database');
const log = require('../utils/log');

class MenuModuleAutoBinder {
  constructor() {
    this.viewsPath = null; // 将在初始化时设置
  }

  /**
   * 初始化服务
   */
  initialize() {
    // 动态获取 views 路径
    const path = require('path');
    this.viewsPath = path.join(__dirname, '../../../frontend/src/views');
    log.debug('📁 菜单模块自动绑定服务已初始化，views 路径:', this.viewsPath);
  }

  /**
   * 根据菜单路径自动推断并绑定模块
   *
   * @param {Object} menuData - 菜单数据
   * @param {string} menuData.url - 菜单 URL（如 /subsidy, /sales/phone-sale）
   * @param {string} menuData.name - 菜单名称
   * @returns {Promise<Object>} 绑定结果 { success, module_id, module_key, message }
   */
  async autoBindModule(menuData) {
    const connection = getDatabase();

    try {
      const url = menuData.url || menuData.path;

      if (!url || typeof url !== 'string') {
        return {
          success: false,
          message: '无效的菜单 URL'
        };
      }

      // 步骤 1：从 URL 提取模块路径（如 /subsidy -> subsidy, /sales/phone-sale -> sales_phone-sale）
      const moduleKey = this.extractModuleKeyFromUrl(url);

      log.debug(`🔍 正在为菜单 "${menuData.name}" (${url}) 查找模块，推断的 module_key: ${moduleKey}`);

      // 步骤 2：在数据库中查找对应的模块
      const [modules] = await connection.execute(
        'SELECT id, `key`, name, description FROM modules WHERE `key` = ? COLLATE utf8mb4_unicode_ci',
        [moduleKey]
      );

      if (modules.length === 0) {
        // 步骤 3：如果数据库中没有找到，尝试扫描 views 目录创建模块
        log.debug(`⚠️  数据库中未找到模块 "${moduleKey}"，尝试自动创建...`);
        const scanResult = await this.tryCreateModuleFromViews(url, moduleKey);

        if (scanResult.success) {
          return {
            success: true,
            module_id: scanResult.module_id,
            module_key: scanResult.module_key,
            message: `已自动创建并绑定模块: ${scanResult.module_key}`
          };
        } else {
          return {
            success: false,
            message: `未找到模块 "${moduleKey}"，且无法自动创建: ${scanResult.message}`
          };
        }
      }

      const module = modules[0];
      log.debug(`✅ 找到模块: ${module.name} (ID: ${module.id}, key: ${module.key})`);

      return {
        success: true,
        module_id: module.id,
        module_key: module.key,
        message: `成功绑定到模块: ${module.name}`
      };

    } catch (error) {
      log.error('❌ 菜单模块自动绑定失败:', error);
      return {
        success: false,
        message: `绑定失败: ${error.message}`
      };
    }
  }

  /**
   * 从 URL 提取模块 key
   * 例如：
   *   /subsidy -> subsidy
   *   /sales/phone-sale -> sales_phone-sale
   *   /inventory/stock-in -> inventory_stock-in
   *
   * @param {string} url - 菜单 URL
   * @returns {string} 模块 key
   */
  extractModuleKeyFromUrl(url) {
    // 移除开头和结尾的斜杠
    let cleanUrl = url.replace(/^\/+|\/+$/g, '');

    // 替换斜杠为下划线
    let moduleKey = cleanUrl.replace(/\//g, '_');

    // 移除查询参数
    moduleKey = moduleKey.split('?')[0];

    // 转为小写
    moduleKey = moduleKey.toLowerCase();

    // 移除特殊字符，只保留字母、数字、下划线和连字符
    moduleKey = moduleKey.replace(/[^a-z0-9_-]/g, '_');

    // 移除多余的下划线
    moduleKey = moduleKey.replace(/_+/g, '_').replace(/^_|_$/g, '');

    return moduleKey;
  }

  /**
   * 尝试从 views 目录扫描并创建模块
   *
   * @param {string} url - 菜单 URL
   * @param {string} moduleKey - 推断的模块 key
   * @returns {Promise<Object>} 创建结果
   */
  async tryCreateModuleFromViews(url, moduleKey) {
    const fs = require('fs');
    const path = require('path');

    try {
      // 解析 URL 路径
      const pathParts = url.replace(/^\/+|\/+$/g, '').split('/');

      if (pathParts.length === 0) {
        return {
          success: false,
          message: 'URL 路径为空'
        };
      }

      // 构建 views 目录中的文件路径
      const folder = pathParts[0]; // 第一级目录作为文件夹名
      const fileName = pathParts.length > 1 ? pathParts[pathParts.length - 1] : folder;

      // 检查文件夹是否存在
      const folderPath = path.join(this.viewsPath, folder);
      if (!fs.existsSync(folderPath)) {
        return {
          success: false,
          message: `views 目录下不存在文件夹: ${folder}`
        };
      }

      // 检查文件是否存在（支持 .vue 和 .js）
      const possibleFiles = [
        path.join(folderPath, `${fileName}.vue`),
        path.join(folderPath, `${fileName}.js`),
        path.join(folderPath, `${this.capitalize(fileName)}.vue`),
        path.join(folderPath, `${this.capitalize(fileName)}.js`)
      ];

      let foundFile = null;
      for (const file of possibleFiles) {
        if (fs.existsSync(file)) {
          foundFile = file;
          break;
        }
      }

      if (!foundFile) {
        return {
          success: false,
          message: `未找到对应的视图文件: ${folder}/${fileName}.vue 或 .js`
        };
      }

      log.debug(`✅ 找到视图文件: ${foundFile}`);

      // 创建模块记录
      const connection = getDatabase();
      const moduleName = this.generateModuleName(fileName);

      const [result] = await connection.execute(
        `INSERT INTO modules (\`key\`, name, description, category, icon, is_active, created_at)
         VALUES (?, ?, ?, 'custom', 'fas fa-cube', 1, NOW())
         ON DUPLICATE KEY UPDATE
         name = VALUES(name),
         description = VALUES(description)`,
        [moduleKey, moduleName, `${moduleName}模块`]
      );

      const moduleId = result.insertId || result.updateResultId;

      log.debug(`✅ 自动创建模块成功: ${moduleName} (ID: ${moduleId}, key: ${moduleKey})`);

      return {
        success: true,
        module_id: moduleId,
        module_key: moduleKey,
        message: `已创建模块: ${moduleName}`
      };

    } catch (error) {
      log.error('❌ 创建模块失败:', error);
      return {
        success: false,
        message: `创建模块失败: ${error.message}`
      };
    }
  }

  /**
   * 首字母大写
   */
  capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  /**
   * 生成中文模块名称
   */
  generateModuleName(fileName) {
    const chineseNames = {
      // 业务模块
      'subsidy': '国补管理',
      'sales': '销售管理',
      'inventory': '库存管理',
      'customers': '客户管理',
      'suppliers': '供应商管理',
      'phones': '手机管理',
      'repairs': '维修管理',
      'rentals': '租赁管理',

      // 商品管理
      'brands': '品牌管理',
      'models': '型号管理',
      'colors': '颜色管理',
      'memories': '内存管理',

      // 系统管理
      'users': '用户管理',
      'roles': '角色管理',
      'permissions': '权限管理',
      'menus': '菜单管理',
      'settings': '系统设置',
      'dashboard': '仪表盘',

      // 其他
      'query': '查询管理',
      'attendance': '考勤管理',
      'salary': '工资管理',
      'analytics': '数据分析'
    };

    // 直接匹配
    if (chineseNames[fileName]) {
      return chineseNames[fileName];
    }

    // 带后缀的匹配（如 phone-sale -> 手机销售）
    for (const [key, name] of Object.entries(chineseNames)) {
      if (fileName.includes(key)) {
        return name;
      }
    }

    // 默认返回英文（首字母大写）
    return this.capitalize(fileName.replace(/-/g, ' '));
  }

  /**
   * 批量修复现有菜单的模块绑定
   * 用于修复历史数据中缺失 module_id 和 module_key 的菜单
   *
   * @returns {Promise<Object>} 修复结果
   */
  async batchFixMenuModuleBindings() {
    const connection = getDatabase();

    try {
      log.debug('🔧 开始批量修复菜单的模块绑定...');

      // 查找所有未绑定模块的菜单
      const [menus] = await connection.execute(
        'SELECT id, name, url FROM menus WHERE (module_id IS NULL OR module_key IS NULL) AND url IS NOT NULL AND url != ""'
      );

      log.debug(`📋 找到 ${menus.length} 个未绑定模块的菜单`);

      let successCount = 0;
      let failCount = 0;
      const results = [];

      for (const menu of menus) {
        const bindResult = await this.autoBindModule(menu);

        if (bindResult.success) {
          // 更新菜单的模块绑定
          await connection.execute(
            `UPDATE menus SET module_id = ?, module_key = ?, updated_at = NOW()
             WHERE id = ?`,
            [bindResult.module_id, bindResult.module_key, menu.id]
          );

          successCount++;
          results.push({
            menu_id: menu.id,
            menu_name: menu.name,
            status: 'success',
            module_key: bindResult.module_key
          });

          log.debug(`✅ [${menu.name}] 绑定成功: ${bindResult.module_key}`);
        } else {
          failCount++;
          results.push({
            menu_id: menu.id,
            menu_name: menu.name,
            status: 'failed',
            message: bindResult.message
          });

          log.debug(`❌ [${menu.name}] 绑定失败: ${bindResult.message}`);
        }
      }

      log.debug(`\n📊 批量修复完成: 成功 ${successCount} 个，失败 ${failCount} 个`);

      return {
        success: true,
        data: {
          total: menus.length,
          success: successCount,
          failed: failCount,
          results: results
        }
      };

    } catch (error) {
      log.error('❌ 批量修复失败:', error);
      return {
        success: false,
        message: `批量修复失败: ${error.message}`
      };
    }
  }

  /**
   * 为单个菜单绑定模块（中间件辅助函数）
   * 用于在菜单创建/更新时自动调用
   *
   * @param {number} menuId - 菜单 ID
   * @param {Object} menuData - 菜单数据
   * @returns {Promise<Object>} 绑定结果
   */
  async bindModuleForMenu(menuId, menuData) {
    const connection = getDatabase();

    try {
      const bindResult = await this.autoBindModule(menuData);

      if (bindResult.success) {
        await connection.execute(
          `UPDATE menus SET module_id = ?, module_key = ?, updated_at = NOW()
           WHERE id = ?`,
          [bindResult.module_id, bindResult.module_key, menuId]
        );

        log.debug(`✅ 菜单 ID ${menuId} 已自动绑定到模块: ${bindResult.module_key}`);
      }

      return bindResult;

    } catch (error) {
      log.error(`❌ 菜单 ID ${menuId} 绑定模块失败:`, error);
      return {
        success: false,
        message: `绑定失败: ${error.message}`
      };
    }
  }
}

// 导出单例实例
const menuModuleAutoBinder = new MenuModuleAutoBinder();
menuModuleAutoBinder.initialize();

module.exports = menuModuleAutoBinder;
