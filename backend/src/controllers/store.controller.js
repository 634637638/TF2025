const log = require('../utils/log');
const StoreService = require('../services/store.service');
const ApiResponse = require('../utils/response');

/**
 * 商店控制器类
 * 处理商店相关的HTTP请求
 */
class StoreController {
  constructor() {
    this.storeService = new StoreService();
  }

  /**
   * 获取商店列表（分页和过滤）
   * @param {Object} req - Express请求对象
   * @param {Object} res - Express响应对象
   */
  async getStores(req, res) {
    try {
      const { page, limit, name, status } = req.query;
      const filters = {
        page: page ? parseInt(page, 10) : 1,
        limit: limit ? parseInt(limit, 10) : 10,
        name: name ? name.trim() : '',
        status: status !== undefined ? parseInt(status, 10) : null
      };

      const result = await this.storeService.getStores(filters);

      if (!result.success) {
        return ApiResponse.error(res, result.message, 400);
      }

      ApiResponse.paginated(res, result.message, result.data, result.meta);
    } catch (error) {
      log.error('获取商店列表控制器错误:', error);
      ApiResponse.serverError(res, '获取商店列表失败');
    }
  }

  /**
   * 获取商店统计信息
   * @param {Object} req - Express请求对象
   * @param {Object} res - Express响应对象
   */
  async getStoreStats(req, res) {
    try {
      const result = await this.storeService.getStoreStats();

      if (!result.success) {
        return ApiResponse.error(res, result.message, 500);
      }

      ApiResponse.success(res, result.message, result.data);
    } catch (error) {
      log.error('获取商店统计控制器错误:', error);
      ApiResponse.serverError(res, '获取商店统计失败');
    }
  }

  /**
   * 获取可用管理员列表
   * @param {Object} req - Express请求对象
   * @param {Object} res - Express响应对象
   */
  async getAvailableManagers(req, res) {
    try {
      const result = await this.storeService.getAvailableManagers();

      if (!result.success) {
        return ApiResponse.error(res, result.message, 500);
      }

      ApiResponse.success(res, result.message, result.data);
    } catch (error) {
      log.error('获取管理员列表控制器错误:', error);
      ApiResponse.serverError(res, '获取管理员列表失败');
    }
  }

  /**
   * 根据ID获取商店详情
   * @param {Object} req - Express请求对象
   * @param {Object} res - Express响应对象
   */
  async getStoreById(req, res) {
    try {
      const { id } = req.params;
      const result = await this.storeService.getStoreById(id);

      if (!result.success) {
        return ApiResponse.error(res, result.message, 404);
      }

      ApiResponse.success(res, result.message, result.data);
    } catch (error) {
      log.error('获取商店详情控制器错误:', error);
      ApiResponse.serverError(res, '获取商店详情失败');
    }
  }

  /**
   * 创建商店
   * @param {Object} req - Express请求对象
   * @param {Object} res - Express响应对象
   */
  async createStore(req, res) {
    try {
      const storeData = req.body;
      const result = await this.storeService.createStore(storeData, req.user);

      if (!result.success) {
        return ApiResponse.error(res, result.message, 400);
      }

      ApiResponse.created(res, result.message, result.data);
    } catch (error) {
      log.error('创建商店控制器错误:', error);
      ApiResponse.serverError(res, '创建商店失败');
    }
  }

  /**
   * 更新商店信息
   * @param {Object} req - Express请求对象
   * @param {Object} res - Express响应对象
   */
  async updateStore(req, res) {
    try {
      const { id } = req.params;
      const storeData = req.body;
      const result = await this.storeService.updateStore(id, storeData, req.user);

      if (!result.success) {
        return ApiResponse.error(res, result.message, 400);
      }

      ApiResponse.success(res, result.message, result.data);
    } catch (error) {
      log.error('更新商店控制器错误:', error);
      ApiResponse.serverError(res, '更新商店失败');
    }
  }

  /**
   * 删除商店
   * @param {Object} req - Express请求对象
   * @param {Object} res - Express响应对象
   */
  async deleteStore(req, res) {
    try {
      const { id } = req.params;
      const result = await this.storeService.deleteStore(id, req.user);

      if (!result.success) {
        return ApiResponse.error(res, result.message, 400);
      }

      ApiResponse.success(res, result.message, result.data);
    } catch (error) {
      log.error('删除商店控制器错误:', error);
      ApiResponse.serverError(res, '删除商店失败');
    }
  }

  /**
   * 批量更新商店状态
   * @param {Object} req - Express请求对象
   * @param {Object} res - Express响应对象
   */
  async batchUpdateStatus(req, res) {
    try {
      const { ids, status } = req.body;

      if (!Array.isArray(ids) || ids.length === 0) {
        return ApiResponse.error(res, '请提供要更新的商店ID列表', 400);
      }

      if (status !== 0 && status !== 1) {
        return ApiResponse.error(res, '状态值只能是0（禁用）或1（启用）', 400);
      }

      const result = await this.storeService.batchUpdateStatus(ids, status, req.user);

      if (!result.success) {
        return ApiResponse.error(res, result.message, 400);
      }

      ApiResponse.success(res, result.message, result.data);
    } catch (error) {
      log.error('批量更新状态控制器错误:', error);
      ApiResponse.serverError(res, '批量更新状态失败');
    }
  }

  /**
   * 根据管理员ID获取商店列表
   * @param {Object} req - Express请求对象
   * @param {Object} res - Express响应对象
   */
  async getStoresByManager(req, res) {
    try {
      const { managerId } = req.params;
      const result = await this.storeService.getStoresByManager(managerId);

      if (!result.success) {
        return ApiResponse.error(res, result.message, 400);
      }

      ApiResponse.success(res, result.message, result.data);
    } catch (error) {
      log.error('根据管理员获取商店控制器错误:', error);
      ApiResponse.serverError(res, '获取管理员商店失败');
    }
  }

  /**
   * 获取活跃商店列表
   * @param {Object} req - Express请求对象
   * @param {Object} res - Express响应对象
   */
  async getActiveStores(req, res) {
    try {
      const result = await this.storeService.getActiveStores();

      if (!result.success) {
        return ApiResponse.error(res, result.message, 500);
      }

      ApiResponse.success(res, result.message, result.data);
    } catch (error) {
      log.error('获取活跃商店控制器错误:', error);
      ApiResponse.serverError(res, '获取活跃商店失败');
    }
  }

  /**
   * 检查商店名称可用性
   * @param {Object} req - Express请求对象
   * @param {Object} res - Express响应对象
   */
  async checkNameAvailability(req, res) {
    try {
      const { name } = req.query;
      const { excludeId } = req.query;

      if (!name) {
        return ApiResponse.error(res, '商店名称不能为空', 400);
      }

      const result = await this.storeService.checkNameAvailability(name, excludeId);

      if (!result.success) {
        return ApiResponse.error(res, result.message, 400);
      }

      ApiResponse.success(res, result.message, result.data);
    } catch (error) {
      log.error('检查商店名称控制器错误:', error);
      ApiResponse.serverError(res, '检查商店名称失败');
    }
  }

  /**
   * 搜索商店
   * @param {Object} req - Express请求对象
   * @param {Object} res - Express响应对象
   */
  async searchStores(req, res) {
    try {
      const { keyword, page, limit, status } = req.query;

      if (!keyword) {
        return ApiResponse.error(res, '搜索关键词不能为空', 400);
      }

      const options = {
        page: page ? parseInt(page, 10) : 1,
        limit: limit ? parseInt(limit, 10) : 10,
        status: status !== undefined ? parseInt(status, 10) : null
      };

      const result = await this.storeService.searchStores(keyword, options);

      if (!result.success) {
        return ApiResponse.error(res, result.message, 400);
      }

      ApiResponse.paginated(res, result.message, result.data, result.meta);
    } catch (error) {
      log.error('搜索商店控制器错误:', error);
      ApiResponse.serverError(res, '搜索商店失败');
    }
  }

  /**
   * 导出商店数据
   * @param {Object} req - Express请求对象
   * @param {Object} res - Express响应对象
   */
  async exportStores(req, res) {
    try {
      const { status } = req.query;
      const filters = {
        status: status !== undefined ? parseInt(status, 10) : null
      };

      const result = await this.storeService.exportStores(filters);

      if (!result.success) {
        return ApiResponse.error(res, result.message, 500);
      }

      // 设置响应头用于文件下载
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="stores_export_${Date.now()}.json"`);

      ApiResponse.success(res, result.message, result.data);
    } catch (error) {
      log.error('导出商店控制器错误:', error);
      ApiResponse.serverError(res, '导出商店失败');
    }
  }

  /**
   * 测试商店API接口
   * @param {Object} req - Express请求对象
   * @param {Object} res - Express响应对象
   */
  async testStores(req, res) {
    try {
      ApiResponse.success(res, '商店管理模块工作正常', {
        message: '新的商店管理系统已成功集成',
        version: '1.0.0',
        features: [
          '商店CRUD操作',
          '分页查询和过滤',
          '统计分析功能',
          '批量操作支持',
          '数据导出功能',
          '搜索功能'
        ],
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      log.error('测试商店API控制器错误:', error);
      ApiResponse.serverError(res, '测试商店API失败');
    }
  }

  /**
   * 获取商店概览信息
   * @param {Object} req - Express请求对象
   * @param {Object} res - Express响应对象
   */
  async getStoreOverview(req, res) {
    try {
      // 并行获取统计信息、活跃商店、最近创建的商店
      const [statsResult, activeStoresResult] = await Promise.all([
        this.storeService.getStoreStats(),
        this.storeService.getActiveStores()
      ]);

      if (!statsResult.success || !activeStoresResult.success) {
        return ApiResponse.error(res, '获取商店概览失败', 500);
      }

      const overview = {
        stats: statsResult.data,
        activeStores: activeStoresResult.data.slice(0, 5), // 最近5个活跃商店
        totalActiveStores: activeStoresResult.data.length,
        timestamp: new Date().toISOString()
      };

      ApiResponse.success(res, '获取商店概览成功', overview);
    } catch (error) {
      log.error('获取商店概览控制器错误:', error);
      ApiResponse.serverError(res, '获取商店概览失败');
    }
  }
}

module.exports = StoreController;