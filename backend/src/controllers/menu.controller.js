const log = require('../utils/log');
/**
 * 菜单控制器
 * 处理所有菜单相关的HTTP请求
 */
const MenuService = require('../services/menu.service');
const ApiResponse = require('../utils/response');
const { clearAllMenuCache } = require('../utils/menuCacheManager');

const parseOptionalStatus = (value) => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) ? undefined : parsed;
};

class MenuController {
  constructor() {
    this.menuService = null;
  }

  getMenuService() {
    if (!this.menuService) {
      this.menuService = new MenuService();
    }
    return this.menuService;
  }

  /**
   * 获取菜单列表（树形结构）
   */
  async getMenuList(req, res) {
    try {
      const {
        page = 1,
        limit = 100,
        menu_type,
        status,
        keyword,
        is_tree = false
      } = req.query;

      const filters = {
        page: parseInt(page) || 1,
        limit: parseInt(limit) || 100,
        menu_type,
        status: parseOptionalStatus(status),
        keyword: keyword?.trim(),
        is_tree: is_tree === 'true'
      };

      const result = await this.getMenuService().getMenuList(filters);

      if (result.success) {
        if (filters.is_tree) {
          ApiResponse.success(res, result.message, result.data);
        } else {
          ApiResponse.paginated(
            res,
            result.message,
            result.data.records,
            result.data.pagination
          );
        }
      } else {
        ApiResponse.error(res, result.message, 400, result.code);
      }
    } catch (error) {
      log.error('获取菜单列表失败:', error);
      ApiResponse.serverError(res, '获取菜单列表失败', error);
    }
  }

  /**
   * 获取用户菜单（根据用户权限）
   */
  async getUserMenus(req, res) {
    try {
      const user = req.user;
      const result = await this.getMenuService().getUserMenus(user);

      if (result.success) {
        ApiResponse.success(res, result.message, result.data);
      } else {
        ApiResponse.error(res, result.message, 400, result.code);
      }
    } catch (error) {
      ApiResponse.serverError(res, '获取用户菜单失败', error);
    }
  }

  /**
   * 获取菜单详情
   */
  async getMenuById(req, res) {
    try {
      const { id } = req.params;

      const result = await this.getMenuService().getMenuById(id);

      if (result.success) {
        ApiResponse.success(res, result.message, result.data);
      } else {
        if (result.code === 'NOT_FOUND') {
          ApiResponse.notFound(res, result.message);
        } else {
          ApiResponse.error(res, result.message, 400, result.code);
        }
      }
    } catch (error) {
      ApiResponse.serverError(res, '获取菜单详情失败', error);
    }
  }

  /**
   * 创建菜单
   */
  async createMenu(req, res) {
    try {
      const menuData = req.body;
      const result = await this.getMenuService().createMenu(menuData, req.user);

      if (result.success) {
        // 清除所有用户的菜单缓存
        clearAllMenuCache();
        ApiResponse.created(res, result.message, result.data);
      } else {
        if (result.code === 'VALIDATION_ERROR') {
          ApiResponse.validationError(res, result.message);
        } else {
          ApiResponse.error(res, result.message, 400, result.code);
        }
      }
    } catch (error) {
      ApiResponse.serverError(res, '创建菜单失败', error);
    }
  }

  /**
   * 更新菜单
   */
  async updateMenu(req, res) {
    try {
      const { id } = req.params;
      const menuData = req.body;

      const result = await this.getMenuService().updateMenu(id, menuData, req.user);

      if (result.success) {
        // 清除所有用户的菜单缓存
        clearAllMenuCache();
        ApiResponse.success(res, result.message, result.data);
      } else {
        if (result.code === 'NOT_FOUND') {
          ApiResponse.notFound(res, result.message);
        } else if (result.code === 'VALIDATION_ERROR') {
          ApiResponse.validationError(res, result.message);
        } else {
          ApiResponse.error(res, result.message, 400, result.code);
        }
      }
    } catch (error) {
      ApiResponse.serverError(res, '更新菜单失败', error);
    }
  }

  /**
   * 删除菜单
   */
  async deleteMenu(req, res) {
    try {
      const { id } = req.params;

      const result = await this.getMenuService().deleteMenu(id, req.user);

      if (result.success) {
        // 清除所有用户的菜单缓存
        clearAllMenuCache();
        ApiResponse.success(res, result.message, result.data);
      } else {
        if (result.code === 'NOT_FOUND') {
          ApiResponse.notFound(res, result.message);
        } else if (result.code === 'HAS_CHILDREN') {
          ApiResponse.error(res, result.message, 409, result.code);
        } else {
          ApiResponse.error(res, result.message, 400, result.code);
        }
      }
    } catch (error) {
      ApiResponse.serverError(res, '删除菜单失败', error);
    }
  }

  /**
   * 获取父菜单选项（用于下拉选择）
   */
  async getParentMenuOptions(req, res) {
    try {
      const { menu_type } = req.query;

      const result = await this.getMenuService().getParentMenuOptions(menu_type);

      if (result.success) {
        ApiResponse.success(res, result.message, result.data);
      } else {
        ApiResponse.error(res, result.message, 400, result.code);
      }
    } catch (error) {
      log.error('获取父菜单选项失败:', error);
      ApiResponse.serverError(res, '获取父菜单选项失败', error);
    }
  }

  /**
   * 更新菜单状态
   */
  async updateMenuStatus(req, res) {
    try {
      const { id } = req.params;
      const { status } = req.body;

      const result = await this.getMenuService().updateMenuStatus(id, status, req.user);

      if (result.success) {
        ApiResponse.success(res, result.message, result.data);
      } else {
        if (result.code === 'NOT_FOUND') {
          ApiResponse.notFound(res, result.message);
        } else {
          ApiResponse.error(res, result.message, 400, result.code);
        }
      }
    } catch (error) {
      log.error('更新菜单状态失败:', error);
      ApiResponse.serverError(res, '更新菜单状态失败', error);
    }
  }

  /**
   * 批量更新菜单排序
   */
  async updateMenuSort(req, res) {
    try {
      const { menuSorts } = req.body;

      if (!Array.isArray(menuSorts)) {
        return ApiResponse.validationError(res, '菜单排序数据格式错误');
      }

      const result = await this.getMenuService().updateMenuSort(menuSorts, req.user);

      if (result.success) {
        ApiResponse.success(res, result.message, result.data);
      } else {
        ApiResponse.error(res, result.message, 400, result.code);
      }
    } catch (error) {
      log.error('更新菜单排序失败:', error);
      ApiResponse.serverError(res, '更新菜单排序失败', error);
    }
  }

  /**
   * 复制菜单
   */
  async copyMenu(req, res) {
    try {
      const { id } = req.params;
      const { title, name } = req.body;

      const result = await this.getMenuService().copyMenu(id, { title, name }, req.user);

      if (result.success) {
        ApiResponse.created(res, result.message, result.data);
      } else {
        if (result.code === 'NOT_FOUND') {
          ApiResponse.notFound(res, result.message);
        } else {
          ApiResponse.error(res, result.message, 400, result.code);
        }
      }
    } catch (error) {
      log.error('复制菜单失败:', error);
      ApiResponse.serverError(res, '复制菜单失败', error);
    }
  }

  /**
   * 导出菜单数据
   */
  async exportMenus(req, res) {
    try {
      const { menu_type, status, keyword } = req.query;

      const filters = {
        menu_type,
        status: parseOptionalStatus(status),
        keyword: keyword?.trim()
      };

      const result = await this.getMenuService().exportMenus(filters);

      if (result.success) {
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=menus_${Date.now()}.xlsx`);
        res.send(result.data);
      } else {
        ApiResponse.error(res, result.message, 400, result.code);
      }
    } catch (error) {
      log.error('导出菜单数据失败:', error);
      ApiResponse.serverError(res, '导出菜单数据失败', error);
    }
  }

  /**
   * 导入菜单数据
   */
  async importMenus(req, res) {
    try {
      if (!req.file) {
        return ApiResponse.validationError(res, '请选择要导入的文件');
      }

      const result = await this.getMenuService().importMenus(req.file, req.user);

      if (result.success) {
        ApiResponse.success(res, result.message, result.data);
      } else {
        if (result.code === 'INVALID_FILE') {
          ApiResponse.validationError(res, result.message);
        } else {
          ApiResponse.error(res, result.message, 400, result.code);
        }
      }
    } catch (error) {
      log.error('导入菜单数据失败:', error);
      ApiResponse.serverError(res, '导入菜单数据失败', error);
    }
  }

  /**
   * 获取菜单统计信息
   */
  async getMenuStats(req, res) {
    try {
      const result = await this.getMenuService().getMenuStats();

      if (result.success) {
        ApiResponse.success(res, result.message, result.data);
      } else {
        ApiResponse.error(res, result.message, 400, result.code);
      }
    } catch (error) {
      log.error('获取菜单统计信息失败:', error);
      ApiResponse.serverError(res, '获取菜单统计信息失败', error);
    }
  }

  /**
   * 初始化菜单数据
   */
  async initMenus(req, res) {
    try {
      const result = await this.getMenuService().initMenus(req.user);

      if (result.success) {
        // 清除所有用户的菜单缓存
        clearAllMenuCache();
        ApiResponse.success(res, result.message, result.data);
      } else {
        ApiResponse.error(res, result.message, 400, result.code);
      }
    } catch (error) {
      log.error('初始化菜单数据失败:', error);
      ApiResponse.serverError(res, '初始化菜单数据失败', error);
    }
  }
}

module.exports = new MenuController();
