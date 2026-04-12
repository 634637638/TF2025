/**
 * 菜单服务类
 * 处理所有菜单相关的业务逻辑
 */
const { getDatabase } = require('../config/database');
const XLSX = require('xlsx');
const fs = require('fs');
const log = require('../utils/log');

class MenuService {
  constructor() {
    this.db = getDatabase();
  }

  /**
   * 获取菜单列表
   */
  async getMenuList(filters = {}) {
    try {
      const {
        page,
        limit,
        menu_type,
        status,
        keyword,
        is_tree
      } = filters;

      if (is_tree) {
        // 返回树形结构
        return await this.getMenuTree(menu_type, status, keyword);
      } else {
        // 返回分页列表
        return await this.getMenuListWithPagination(page, limit, menu_type, status, keyword);
      }
    } catch (error) {
      log.error('获取菜单列表失败:', error);
      return { success: false, message: '获取菜单列表失败', code: 'DATABASE_ERROR' };
    }
  }

  /**
   * 获取用户菜单（根据用户权限）
   * 使用统一菜单服务，确保权限和menu_visible过滤生效
   */
  async getUserMenus(user) {
    try {
      const UnifiedMenuService = require('./unifiedMenu.service');
      const result = await UnifiedMenuService.getUserMenus({ user });
      return result;
    } catch (error) {
      log.error('获取用户菜单失败:', error);
      return { success: false, message: '获取用户菜单失败', code: 'DATABASE_ERROR' };
    }
  }

  /**
   * 获取菜单详情
   */
  async getMenuById(id) {
    try {
      const query = 'SELECT * FROM menus WHERE id = ?';
      const [menus] = await this.db.execute(query, [id]);

      if (menus.length === 0) {
        return { success: false, message: '菜单不存在', code: 'NOT_FOUND' };
      }

      return {
        success: true,
        message: '获取菜单详情成功',
        data: menus[0]
      };
    } catch (error) {
      log.error('获取菜单详情失败:', error);
      return { success: false, message: '获取菜单详情失败', code: 'DATABASE_ERROR' };
    }
  }

  /**
   * 创建菜单
   */
  async createMenu(menuData, user) {
    try {
      // 验证数据
      const validation = this.validateMenuData(menuData, false);
      if (!validation.valid) {
        return { success: false, message: validation.message, code: 'VALIDATION_ERROR' };
      }

      // 检查菜单名称是否重复
      const [existingMenu] = await this.db.execute(
        'SELECT id FROM menus WHERE name = ?',
        [menuData.name]
      );

      if (existingMenu.length > 0) {
        return { success: false, message: '菜单名称已存在', code: 'DUPLICATE_NAME' };
      }

      // 如果有父菜单，检查父菜单是否存在
      if (menuData.parent_id) {
        const [parentMenu] = await this.db.execute(
          'SELECT id FROM menus WHERE id = ?',
          [menuData.parent_id]
        );

        if (parentMenu.length === 0) {
          return { success: false, message: '父菜单不存在', code: 'PARENT_NOT_FOUND' };
        }
      }

      // 处理模块关联
      let moduleId = menuData.module_id || null;
      let moduleKey = menuData.module_key || null;

      // 如果指定了 module_key 但没有 module_id，自动查找
      if (moduleKey && !moduleId) {
        const [moduleResult] = await this.db.execute(
          'SELECT id FROM modules WHERE `key` = ?',
          [moduleKey]
        );
        if (moduleResult.length > 0) {
          moduleId = moduleResult[0].id;
        }
      }

      // 如果指定了 module_id 但没有 module_key，自动查找
      if (moduleId && !moduleKey) {
        const [moduleResult] = await this.db.execute(
          'SELECT `key` FROM modules WHERE id = ?',
          [moduleId]
        );
        if (moduleResult.length > 0) {
          moduleKey = moduleResult[0].key;
        }
      }

      // 插入菜单 - 包含模块关联字段
      const insertQuery = `
        INSERT INTO menus (
          parent_id, name, url, icon, sort_order,
          menu_type, target, remarks, is_active, module_id, module_key
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      const [result] = await this.db.execute(insertQuery, [
        menuData.parent_id !== undefined ? menuData.parent_id : 0,
        menuData.name,
        menuData.url || null,
        menuData.icon || null,
        menuData.sort_order || 0,
        menuData.menu_type || 'menu',
        menuData.target || '_self',
        menuData.remarks || null,
        menuData.is_active !== false ? 1 : 0,
        moduleId,
        moduleKey
      ]);

      return {
        success: true,
        message: '创建菜单成功',
        data: { id: result.insertId, ...menuData }
      };
    } catch (error) {
      log.error('创建菜单失败:', error);
      return { success: false, message: '创建菜单失败', code: 'DATABASE_ERROR' };
    }
  }

  /**
   * 更新菜单
   */
  async updateMenu(id, menuData, user) {
    try {
      // 验证数据
      const validation = this.validateMenuData(menuData, true);
      if (!validation.valid) {
        return { success: false, message: validation.message, code: 'VALIDATION_ERROR' };
      }

      // 检查菜单是否存在
      const [existingMenu] = await this.db.execute(
        'SELECT * FROM menus WHERE id = ?',
        [id]
      );

      if (existingMenu.length === 0) {
        return { success: false, message: '菜单不存在', code: 'NOT_FOUND' };
      }

      // 检查菜单名称是否重复（排除自己）
      if (menuData.name && menuData.name !== existingMenu[0].name) {
        const [duplicateMenu] = await this.db.execute(
          'SELECT id FROM menus WHERE name = ? AND id != ?',
          [menuData.name, id]
        );

        if (duplicateMenu.length > 0) {
          return { success: false, message: '菜单名称已存在', code: 'DUPLICATE_NAME' };
        }
      }

      // 检查是否设置了自己为父菜单
      if (menuData.parent_id && menuData.parent_id == id) {
        return { success: false, message: '不能设置自己为父菜单', code: 'INVALID_PARENT' };
      }

      // 检查父菜单是否存在
      if (menuData.parent_id) {
        const [parentMenu] = await this.db.execute(
          'SELECT id FROM menus WHERE id = ?',
          [menuData.parent_id]
        );

        if (parentMenu.length === 0) {
          return { success: false, message: '父菜单不存在', code: 'PARENT_NOT_FOUND' };
        }
      }

      // 处理模块关联
      let moduleId = menuData.module_id !== undefined ? menuData.module_id : existingMenu[0].module_id;
      let moduleKey = menuData.module_key !== undefined ? menuData.module_key : existingMenu[0].module_key;

      // 如果只提供了 module_key，自动查找 module_id
      if (moduleKey && !moduleId) {
        const [moduleResult] = await this.db.execute(
          'SELECT id FROM modules WHERE `key` = ?',
          [moduleKey]
        );
        if (moduleResult.length > 0) {
          moduleId = moduleResult[0].id;
        }
      }

      // 如果只提供了 module_id，自动查找 module_key
      if (moduleId && !moduleKey) {
        const [moduleResult] = await this.db.execute(
          'SELECT `key` FROM modules WHERE id = ?',
          [moduleId]
        );
        if (moduleResult.length > 0) {
          moduleKey = moduleResult[0].key;
        }
      }

      // 更新菜单 - 只更新存在的字段，包含模块关联字段
      const updateQuery = `
        UPDATE menus SET
          parent_id = ?, name = ?, url = ?, icon = ?, sort_order = ?,
          menu_type = ?, target = ?, remarks = ?, is_active = ?, module_id = ?, module_key = ?
        WHERE id = ?
      `;

      // 确保所有参数都不是 undefined，使用 ?? 运算符提供 null 默认值
      await this.db.execute(updateQuery, [
        menuData.parent_id !== undefined ? menuData.parent_id : existingMenu[0].parent_id,
        menuData.name ?? existingMenu[0].name,
        menuData.url ?? existingMenu[0].url ?? null,
        menuData.icon ?? existingMenu[0].icon ?? '',
        menuData.sort_order ?? existingMenu[0].sort_order ?? 0,
        menuData.menu_type ?? existingMenu[0].menu_type ?? 'menu',
        menuData.target ?? existingMenu[0].target ?? '_self',
        menuData.remarks ?? existingMenu[0].remarks ?? null,
        menuData.is_active !== undefined ? menuData.is_active : existingMenu[0].is_active,
        moduleId,
        moduleKey,
        id
      ]);

      return {
        success: true,
        message: '更新菜单成功',
        data: { id: parseInt(id), ...menuData }
      };
    } catch (error) {
      log.error('更新菜单失败:', error);
      return { success: false, message: '更新菜单失败', code: 'DATABASE_ERROR' };
    }
  }

  /**
   * 删除菜单
   */
  async deleteMenu(id, user) {
    try {
      // 检查菜单是否存在
      const [existingMenu] = await this.db.execute(
        'SELECT * FROM menus WHERE id = ?',
        [id]
      );

      if (existingMenu.length === 0) {
        return { success: false, message: '菜单不存在', code: 'NOT_FOUND' };
      }

      // 检查是否有子菜单
      const [children] = await this.db.execute(
        'SELECT id FROM menus WHERE parent_id = ?',
        [id]
      );

      if (children.length > 0) {
        return { success: false, message: '请先删除子菜单', code: 'HAS_CHILDREN' };
      }

      // 真正删除菜单
      await this.db.execute('DELETE FROM menus WHERE id = ?', [id]);

      return {
        success: true,
        message: '删除菜单成功',
        data: { id: parseInt(id) }
      };
    } catch (error) {
      log.error('删除菜单失败:', error);
      return { success: false, message: '删除菜单失败', code: 'DATABASE_ERROR' };
    }
  }

  /**
   * 获取父菜单选项
   */
  async getParentMenuOptions(menuType) {
    try {
      let query = `
        SELECT id, name, parent_id
        FROM menus
        WHERE (menu_type = 'menu' OR menu_type = 'directory')
      `;

      const params = [];
      if (menuType) {
        query += ' AND menu_type = ?';
        params.push(menuType);
      }

      query += ' ORDER BY sort_order ASC, id ASC';

      const [menus] = await this.db.execute(query, params);

      // 构建选项树
      const options = this.buildMenuOptions(menus);

      return {
        success: true,
        message: '获取父菜单选项成功',
        data: options
      };
    } catch (error) {
      log.error('获取父菜单选项失败:', error);
      return { success: false, message: '获取父菜单选项失败', code: 'DATABASE_ERROR' };
    }
  }

  /**
   * 更新菜单状态
   */
  async updateMenuStatus(id, status, user) {
    try {
      const [existingMenu] = await this.db.execute(
        'SELECT * FROM menus WHERE id = ?',
        [id]
      );

      if (existingMenu.length === 0) {
        return { success: false, message: '菜单不存在', code: 'NOT_FOUND' };
      }

      await this.db.execute(
        'UPDATE menus SET is_active = ? WHERE id = ?',
        [status ? 1 : 0, id]
      );

      return {
        success: true,
        message: '更新菜单状态成功',
        data: { id: parseInt(id), is_active: status ? 1 : 0, status: status ? 1 : 0 }
      };
    } catch (error) {
      log.error('更新菜单状态失败:', error);
      return { success: false, message: '更新菜单状态失败', code: 'DATABASE_ERROR' };
    }
  }

  /**
   * 批量更新菜单排序
   */
  async updateMenuSort(menuSorts, user) {
    try {
      const connection = await this.db.getConnection();

      try {
        await connection.beginTransaction();

        for (const item of menuSorts) {
          await connection.execute(
            'UPDATE menus SET sort_order = ?, updated_at = NOW() WHERE id = ?',
            [item.sort_order, item.id]
          );
        }

        await connection.commit();

        return {
          success: true,
          message: '更新菜单排序成功',
          data: { updatedCount: menuSorts.length }
        };
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    } catch (error) {
      log.error('更新菜单排序失败:', error);
      return { success: false, message: '更新菜单排序失败', code: 'DATABASE_ERROR' };
    }
  }

  /**
   * 复制菜单
   */
  async copyMenu(id, { title, name }, user) {
    try {
      const [existingMenu] = await this.db.execute(
        'SELECT * FROM menus WHERE id = ?',
        [id]
      );

      if (existingMenu.length === 0) {
        return { success: false, message: '菜单不存在', code: 'NOT_FOUND' };
      }

      const menu = existingMenu[0];

      // 检查新名称是否重复
      const [duplicateMenu] = await this.db.execute(
        'SELECT id FROM menus WHERE name = ?',
        [name]
      );

      if (duplicateMenu.length > 0) {
        return { success: false, message: '菜单名称已存在', code: 'DUPLICATE_NAME' };
      }

      // 复制菜单
      const insertQuery = `
        INSERT INTO menus (
          parent_id, name, title, path, component, redirect, icon,
          sort_order, menu_type, is_hidden, is_cache, is_affix,
          is_external, permission, remark, is_active
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      const [result] = await this.db.execute(insertQuery, [
        menu.parent_id,
        name,
        title,
        menu.path,
        menu.component,
        menu.redirect,
        menu.icon,
        menu.sort_order,
        menu.menu_type,
        menu.is_hidden,
        menu.is_cache,
        menu.is_affix,
        menu.is_external,
        menu.permission,
        `复制自: ${menu.remark || menu.title}`,
        menu.is_active
      ]);

      return {
        success: true,
        message: '复制菜单成功',
        data: { id: result.insertId, name, title }
      };
    } catch (error) {
      log.error('复制菜单失败:', error);
      return { success: false, message: '复制菜单失败', code: 'DATABASE_ERROR' };
    }
  }

  /**
   * 获取菜单统计信息
   */
  async getMenuStats() {
    try {
      const [stats] = await this.db.execute(`
        SELECT
          COUNT(*) as total_menus,
          COUNT(CASE WHEN menu_type = 'menu' THEN 1 END) as menu_count,
          COUNT(CASE WHEN menu_type = 'directory' THEN 1 END) as directory_count,
          COUNT(CASE WHEN menu_type = 'button' THEN 1 END) as button_count,
          COUNT(CASE WHEN is_active = 1 THEN 1 END) as active_count,
          COUNT(CASE WHEN is_hidden = 1 THEN 1 END) as hidden_count
        FROM menus
      `);

      return {
        success: true,
        message: '获取菜单统计信息成功',
        data: stats[0]
      };
    } catch (error) {
      log.error('获取菜单统计信息失败:', error);
      return { success: false, message: '获取菜单统计信息失败', code: 'DATABASE_ERROR' };
    }
  }

  /**
   * 获取分页菜单列表
   */
  async getMenuListWithPagination(page, limit, menu_type, status, keyword) {
    try {
      const offset = (page - 1) * limit;
      let whereClause = 'WHERE 1=1';
      const params = [];

      if (menu_type) {
        whereClause += ' AND menu_type = ?';
        params.push(menu_type);
      }

      if (status !== undefined) {
        whereClause += ' AND is_active = ?';
        params.push(status ? 1 : 0);
      }

      if (keyword) {
        whereClause += ' AND (title LIKE ? OR name LIKE ? OR path LIKE ?)';
        params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
      }

      // 获取总数
      const [countResult] = await this.db.execute(
        `SELECT COUNT(*) as total FROM menus ${whereClause}`,
        params
      );
      const total = countResult[0].total;

      // 获取数据
      const [menus] = await this.db.execute(
        `SELECT *, is_active as status FROM menus ${whereClause} ORDER BY sort_order ASC, id ASC LIMIT ? OFFSET ?`,
        [...params, limit, offset]
      );

      return {
        success: true,
        message: '获取菜单列表成功',
        data: {
          records: menus,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: parseInt(total),
            pages: Math.ceil(total / limit)
          }
        }
      };
    } catch (error) {
      log.error('获取分页菜单列表失败:', error);
      throw error;
    }
  }

  /**
   * 获取菜单树
   */
  async getMenuTree(menu_type, status, keyword) {
    try {
      let query = `
        SELECT *, is_active as status FROM menus
        WHERE 1=1
      `;
      const params = [];

      if (menu_type) {
        query += ' AND menu_type = ?';
        params.push(menu_type);
      }

      if (status !== undefined) {
        query += ' AND is_active = ?';
        params.push(status ? 1 : 0);
      }

      if (keyword) {
        query += ' AND (title LIKE ? OR name LIKE ?)';
        params.push(`%${keyword}%`, `%${keyword}%`);
      }

      query += ' ORDER BY sort_order ASC, id ASC';

      const [menus] = await this.db.execute(query, params);

      const menuTree = this.buildMenuTree(menus);

      return {
        success: true,
        message: '获取菜单树成功',
        data: menuTree
      };
    } catch (error) {
      log.error('获取菜单树失败:', error);
      throw error;
    }
  }

  /**
   * 构建菜单树
   */
  buildMenuTree(menus) {
    const menuMap = {};
    const rootMenus = [];

    // 建立菜单映射
    menus.forEach(menu => {
      menuMap[menu.id] = { ...menu, children: [] };
    });

    // 构建树形结构
    menus.forEach(menu => {
      // parent_id 为 null 或 0 表示根菜单
      if (menu.parent_id === null || menu.parent_id === 0) {
        rootMenus.push(menuMap[menu.id]);
      } else {
        const parent = menuMap[menu.parent_id];
        if (parent) {
          parent.children.push(menuMap[menu.id]);
        }
      }
    });

    return rootMenus;
  }

  /**
   * 构建菜单选项
   */
  buildMenuOptions(menus) {
    const menuMap = {};
    const rootOptions = [];

    // 建立菜单映射
    menus.forEach(menu => {
      menuMap[menu.id] = {
        value: menu.id,
        label: menu.title,
        children: []
      };
    });

    // 构建树形结构
    menus.forEach(menu => {
      if (menu.parent_id === null) {
        rootOptions.push(menuMap[menu.id]);
      } else {
        const parent = menuMap[menu.parent_id];
        if (parent) {
          parent.children.push(menuMap[menu.id]);
        }
      }
    });

    return rootOptions;
  }

  /**
   * 验证菜单数据
   */
  validateMenuData(data, isUpdate = false) {
    if (!isUpdate) {
      if (!data.name || !data.name.trim()) {
        return { valid: false, message: '菜单名称不能为空' };
      }

      // 放宽验证规则: 允许中文、英文、数字、下划线、横线和中文标点
      // 只要不为空且长度在合理范围内即可
      if (data.name.length > 100) {
        return { valid: false, message: '菜单名称长度不能超过100个字符' };
      }

      // 检查是否包含特殊字符(只允许中文、英文、数字、下划线、横线、空格、括号、斜杠)
      if (!/^[\u4e00-\u9fa5a-zA-Z0-9_\-/()\s]*$/.test(data.name)) {
        return { valid: false, message: '菜单名称只能包含中文、英文、数字、下划线、横线、括号和斜杠' };
      }
    }

    if (data.title && !data.title.trim()) {
      return { valid: false, message: '菜单标题不能为空' };
    }

    if (data.menu_type && !['menu', 'button', 'directory'].includes(data.menu_type)) {
      return { valid: false, message: '菜单类型无效' };
    }

    if (data.sort_order !== undefined && (data.sort_order < 0 || !Number.isInteger(data.sort_order))) {
      return { valid: false, message: '排序顺序必须是非负整数' };
    }

    return { valid: true };
  }

  /**
   * 初始化菜单数据
   */
  async initMenus(user) {
    try {
      // 检查是否已有菜单数据
      const [existingMenus] = await this.db.execute('SELECT COUNT(*) as count FROM menus');

      if (existingMenus[0].count > 0) {
        return {
          success: true,
          message: '菜单数据已存在，无需初始化',
          data: { count: existingMenus[0].count }
        };
      }

      // 获取所有活跃模块，用于关联菜单
      const [modules] = await this.db.execute(
        'SELECT id, `key`, name FROM modules WHERE is_active = 1'
      );

      // 创建模块 key 到模块 ID 的映射
      const moduleMap = {};
      for (const module of modules) {
        moduleMap[module.key] = module.id;
      }

      log.debug('📦 可用模块:', Object.keys(moduleMap));

      // 初始化基础菜单数据（包含模块关联）
      const initialMenus = [
        {
          parent_id: null,
          name: 'dashboard',
          url: '/dashboard',
          icon: 'fas fa-tachometer-alt',
          sort_order: 1,
          menu_type: 'menu',
          target: '_self',
          remarks: '系统首页仪表盘',
          module_key: null,  // 仪表盘不需要模块权限
          module_id: null
        },
        {
          parent_id: null,
          name: 'sales',
          url: '/sales',
          icon: 'fas fa-shopping-cart',
          sort_order: 2,
          menu_type: 'directory',
          target: '_self',
          remarks: '销售管理模块',
          module_key: 'sales',  // 关联销售模块
          module_id: moduleMap['sales'] || null
        },
        {
          parent_id: null,
          name: 'inventory',
          url: '/inventory',
          icon: 'fas fa-boxes',
          sort_order: 3,
          menu_type: 'directory',
          target: '_self',
          remarks: '库存管理模块',
          module_key: 'inventory',  // 关联库存模块
          module_id: moduleMap['inventory'] || null
        },
        {
          parent_id: null,
          name: 'customers',
          url: '/customers',
          icon: 'fas fa-users',
          sort_order: 4,
          menu_type: 'menu',
          target: '_self',
          remarks: '客户信息管理',
          module_key: 'customers',  // 关联客户模块
          module_id: moduleMap['customers'] || null
        },
        {
          parent_id: null,
          name: 'menu',
          url: '/menu',
          icon: 'fas fa-bars',
          sort_order: 5,
          menu_type: 'menu',
          target: '_self',
          remarks: '系统菜单配置',
          module_key: null,  // 菜单管理不需要模块权限
          module_id: null
        }
      ];

      // 批量插入菜单
      for (const menu of initialMenus) {
        const [result] = await this.db.execute(
          `INSERT INTO menus (
            parent_id, name, url, icon, sort_order,
            menu_type, target, remarks, is_active, module_key, module_id
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
          [
            menu.parent_id,
            menu.name,
            menu.url,
            menu.icon,
            menu.sort_order,
            menu.menu_type,
            menu.target,
            menu.remarks,
            menu.module_key,
            menu.module_id
          ]
        );

        log.debug(`✅ 创建菜单: ${menu.name} -> 模块: ${menu.module_key || '无'}`);
      }

      return {
        success: true,
        message: '菜单数据初始化成功',
        data: { count: initialMenus.length }
      };
    } catch (error) {
      log.error('初始化菜单数据失败:', error);
      return { success: false, message: '初始化菜单数据失败', code: 'DATABASE_ERROR' };
    }
  }

  async exportMenus(filters = {}) {
    try {
      const { menu_type, status, keyword } = filters;
      let query = `
        SELECT
          m.id,
          m.parent_id,
          p.name as parent_name,
          m.name,
          m.url,
          m.icon,
          m.sort_order,
          m.menu_type,
          m.target,
          m.remarks,
          m.is_active,
          m.module_key,
          m.module_id
        FROM menus m
        LEFT JOIN menus p ON m.parent_id = p.id
        WHERE 1 = 1
      `;
      const params = [];

      if (menu_type) {
        query += ' AND m.menu_type = ?';
        params.push(menu_type);
      }

      if (status !== undefined && status !== null && status !== '') {
        query += ' AND m.is_active = ?';
        params.push(Number(status) ? 1 : 0);
      }

      if (keyword) {
        query += ' AND (m.name LIKE ? OR m.url LIKE ?)';
        params.push(`%${keyword}%`, `%${keyword}%`);
      }

      query += ' ORDER BY COALESCE(m.parent_id, 0), m.sort_order ASC, m.id ASC';

      const [menus] = await this.db.execute(query, params);
      const rows = menus.map((item) => ({
        ID: item.id,
        父级ID: item.parent_id || 0,
        父级菜单: item.parent_name || '',
        菜单名称: item.name || '',
        路径: item.url || '',
        图标: item.icon || '',
        排序: item.sort_order || 0,
        类型: item.menu_type || 'menu',
        打开方式: item.target || '_self',
        状态: Number(item.is_active) === 1 ? '启用' : '禁用',
        备注: item.remarks || '',
        模块KEY: item.module_key || '',
        模块ID: item.module_id || ''
      }));

      const worksheet = XLSX.utils.json_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, '菜单管理');

      return {
        success: true,
        message: '导出菜单成功',
        data: XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })
      };
    } catch (error) {
      log.error('导出菜单失败:', error);
      return { success: false, message: '导出菜单失败', code: 'DATABASE_ERROR' };
    }
  }

  async importMenus(file) {
    let cleanupError = null;

    try {
      const workbook = XLSX.readFile(file.path);
      const sheetName = workbook.SheetNames[0];
      const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' });

      if (!Array.isArray(rows) || rows.length === 0) {
        return { success: false, message: '导入文件没有有效数据', code: 'INVALID_FILE' };
      }

      const [existingMenus] = await this.db.execute('SELECT id, name FROM menus');
      const menuNameMap = new Map(existingMenus.map(item => [String(item.name), item.id]));
      const normalizedRows = rows.map((row) => {
        const name = String(row['菜单名称'] || row['name'] || '').trim();
        const explicitId = row['ID'] !== '' && row['ID'] !== undefined ? Number(row['ID']) : null;
        const parentIdCell = row['父级ID'] !== '' && row['父级ID'] !== undefined ? Number(row['父级ID']) : null;
        const hasExplicitParentId = Number.isInteger(parentIdCell);
        const parentName = String(row['父级菜单'] || '').trim();

        return {
          name,
          explicitId,
          parentName,
          hasExplicitParentId,
          explicitParentId: hasExplicitParentId ? parentIdCell : null,
          payload: {
            parent_id: hasExplicitParentId
              ? parentIdCell
              : (parentName ? (menuNameMap.get(parentName) || 0) : 0),
            name,
            url: String(row['路径'] || row['url'] || '').trim() || null,
            icon: String(row['图标'] || row['icon'] || '').trim() || null,
            sort_order: Number(row['排序'] || 0) || 0,
            menu_type: String(row['类型'] || 'menu').trim() || 'menu',
            target: String(row['打开方式'] || '_self').trim() || '_self',
            remarks: String(row['备注'] || '').trim() || null,
            is_active: ['启用', '1', 'true', 'TRUE'].includes(String(row['状态']).trim()) ? 1 : 0,
            module_key: String(row['模块KEY'] || '').trim() || null,
            module_id: row['模块ID'] !== '' && row['模块ID'] !== undefined ? Number(row['模块ID']) || null : null
          }
        };
      }).filter((row) => row.name);
      let importedCount = 0;
      let updatedCount = 0;
      const importedTargets = [];

      for (const row of normalizedRows) {
        const targetId = row.explicitId || menuNameMap.get(row.name);

        if (targetId) {
          await this.db.execute(
            `UPDATE menus
             SET parent_id = ?, name = ?, url = ?, icon = ?, sort_order = ?, menu_type = ?, target = ?, remarks = ?, is_active = ?, module_key = ?, module_id = ?, updated_at = NOW()
             WHERE id = ?`,
            [
              row.payload.parent_id,
              row.payload.name,
              row.payload.url,
              row.payload.icon,
              row.payload.sort_order,
              row.payload.menu_type,
              row.payload.target,
              row.payload.remarks,
              row.payload.is_active,
              row.payload.module_key,
              row.payload.module_id,
              targetId
            ]
          );
          menuNameMap.set(row.name, targetId);
          updatedCount += 1;
          importedTargets.push({ ...row, targetId });
        } else {
          const [insertResult] = await this.db.execute(
            `INSERT INTO menus (
              parent_id, name, url, icon, sort_order, menu_type, target, remarks, is_active, module_key, module_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              row.payload.parent_id,
              row.payload.name,
              row.payload.url,
              row.payload.icon,
              row.payload.sort_order,
              row.payload.menu_type,
              row.payload.target,
              row.payload.remarks,
              row.payload.is_active,
              row.payload.module_key,
              row.payload.module_id
            ]
          );
          menuNameMap.set(row.name, insertResult.insertId);
          importedCount += 1;
          importedTargets.push({ ...row, targetId: insertResult.insertId });
        }
      }

      for (const row of importedTargets) {
        if (row.hasExplicitParentId || !row.parentName || !row.targetId) {
          continue;
        }

        const resolvedParentId = menuNameMap.get(row.parentName) || 0;
        if (resolvedParentId === row.targetId || resolvedParentId === row.payload.parent_id) {
          continue;
        }

        await this.db.execute(
          'UPDATE menus SET parent_id = ?, updated_at = NOW() WHERE id = ?',
          [resolvedParentId, row.targetId]
        );
      }

      return {
        success: true,
        message: `菜单导入成功，新增 ${importedCount} 条，更新 ${updatedCount} 条`,
        data: {
          imported: importedCount,
          updated: updatedCount,
          total: importedCount + updatedCount
        }
      };
    } catch (error) {
      log.error('导入菜单失败:', error);
      return { success: false, message: '导入菜单失败', code: 'INVALID_FILE' };
    } finally {
      try {
        if (file?.path && fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }
      } catch (error) {
        cleanupError = error;
      }

      if (cleanupError) {
        log.warn('清理菜单导入临时文件失败:', cleanupError.message);
      }
    }
  }
}

module.exports = MenuService;
