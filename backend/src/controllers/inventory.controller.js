const log = require('../utils/log');
/**
 * 库存控制器
 * 处理所有库存相关的HTTP请求
 */
const InventoryService = require('../services/inventory.service');
const ApiResponse = require('../utils/response');

class InventoryController {
  constructor() {
    this.inventoryService = new InventoryService();
  }

  /**
   * 测试库存模块
   */
  async testInventory(req, res) {
    try {
      const result = await this.inventoryService.testInventory();
      ApiResponse.success(res, result.message, result.data);
    } catch (error) {
      log.error('测试库存模块失败:', error);
      ApiResponse.serverError(res, '测试库存模块失败', error);
    }
  }

  /**
   * 获取库存记录列表
   */
  async getInventoryRecords(req, res) {
    try {
      const {
        page = 1,
        limit = 10,
        type,
        operation_type,
        store_id,
        operator_id,
        product_type,
        is_settled,
        start_date,
        end_date
      } = req.query;

      const filters = {
        page: parseInt(page) || 1,
        limit: parseInt(limit) || 10,
        type,
        operation_type,
        store_id: store_id ? parseInt(store_id) : undefined,
        operator_id: operator_id ? parseInt(operator_id) : undefined,
        product_type,
        is_settled: is_settled !== undefined ? parseInt(is_settled) : undefined,
        start_date,
        end_date
      };

      const result = await this.inventoryService.getInventoryRecords(filters);

      if (result.success) {
        ApiResponse.paginated(
          res,
          result.message,
          result.data.records,
          result.data.pagination
        );
      } else {
        ApiResponse.error(res, result.message, 400, result.code);
      }
    } catch (error) {
      log.error('获取库存记录列表失败:', error);
      ApiResponse.serverError(res, '获取库存记录列表失败', error);
    }
  }

  /**
   * 获取库存记录详情
   */
  async getInventoryRecordById(req, res) {
    try {
      const { id } = req.params;

      const result = await this.inventoryService.getInventoryRecordById(id);

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
      log.error('获取库存记录详情失败:', error);
      ApiResponse.serverError(res, '获取库存记录详情失败', error);
    }
  }

  /**
   * 创建库存记录
   */
  async createInventoryRecord(req, res) {
    try {
      const inventoryData = req.body;

      const result = await this.inventoryService.createInventoryRecord(inventoryData, req.user);

      if (result.success) {
        ApiResponse.created(res, result.message, result.data);
      } else {
        if (result.code === 'VALIDATION_ERROR') {
          ApiResponse.validationError(res, result.message);
        } else {
          ApiResponse.error(res, result.message, 400, result.code);
        }
      }
    } catch (error) {
      log.error('创建库存记录失败:', error);
      ApiResponse.serverError(res, '创建库存记录失败', error);
    }
  }

  /**
   * 更新库存记录
   */
  async updateInventoryRecord(req, res) {
    try {
      const { id } = req.params;
      const inventoryData = req.body;

      const result = await this.inventoryService.updateInventoryRecord(id, inventoryData, req.user);

      if (result.success) {
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
      log.error('更新库存记录失败:', error);
      ApiResponse.serverError(res, '更新库存记录失败', error);
    }
  }

  /**
   * 删除库存记录
   */
  async deleteInventoryRecord(req, res) {
    try {
      const { id } = req.params;

      const result = await this.inventoryService.deleteInventoryRecord(id, req.user);

      if (result.success) {
        ApiResponse.success(res, result.message, result.data);
      } else {
        if (result.code === 'NOT_FOUND') {
          ApiResponse.notFound(res, result.message);
        } else if (result.code === 'HAS_RELATIONSHIPS') {
          ApiResponse.error(res, result.message, 409, result.code);
        } else {
          ApiResponse.error(res, result.message, 400, result.code);
        }
      }
    } catch (error) {
      log.error('删除库存记录失败:', error);
      ApiResponse.serverError(res, '删除库存记录失败', error);
    }
  }

  /**
   * 批量更新库存记录结算状态
   */
  async batchUpdateSettledStatus(req, res) {
    try {
      const { ids, is_settled } = req.body;

      const result = await this.inventoryService.batchUpdateSettledStatus(ids, is_settled, req.user);

      if (result.success) {
        ApiResponse.success(res, result.message, result.data);
      } else {
        if (result.code === 'VALIDATION_ERROR') {
          ApiResponse.validationError(res, result.message);
        } else {
          ApiResponse.error(res, result.message, 400, result.code);
        }
      }
    } catch (error) {
      log.error('批量更新结算状态失败:', error);
      ApiResponse.serverError(res, '批量更新结算状态失败', error);
    }
  }

  /**
   * 搜索库存记录
   */
  async searchInventoryRecords(req, res) {
    try {
      const { keyword, page, limit, type, operation_type, store_id, is_settled } = req.query;

      if (!keyword) {
        return ApiResponse.validationError(res, '搜索关键词不能为空');
      }

      const filters = {
        keyword: keyword.trim(),
        page: page ? parseInt(page) : undefined,
        limit: limit ? parseInt(limit) : undefined,
        type,
        operation_type,
        store_id: store_id ? parseInt(store_id) : undefined,
        is_settled: is_settled !== undefined ? parseInt(is_settled) : undefined
      };

      const result = await this.inventoryService.searchInventoryRecords(filters.keyword, filters);

      if (result.success) {
        ApiResponse.paginated(
          res,
          result.message,
          result.data.records,
          result.data.pagination
        );
      } else {
        ApiResponse.error(res, result.message, 400, result.code);
      }
    } catch (error) {
      log.error('搜索库存记录失败:', error);
      ApiResponse.serverError(res, '搜索库存记录失败', error);
    }
  }

  /**
   * 获取库存统计信息
   */
  async getInventoryStats(req, res) {
    try {
      const { store_id, product_type, start_date, end_date } = req.query;

      const filters = {
        store_id: store_id ? parseInt(store_id) : undefined,
        product_type,
        start_date,
        end_date
      };

      const result = await this.inventoryService.getInventoryStats(filters);

      if (result.success) {
        ApiResponse.success(res, result.message, result.data);
      } else {
        ApiResponse.error(res, result.message, 400, result.code);
      }
    } catch (error) {
      log.error('获取库存统计信息失败:', error);
      ApiResponse.serverError(res, '获取库存统计信息失败', error);
    }
  }

  /**
   * 导出库存数据
   */
  async exportInventoryRecords(req, res) {
    try {
      const { type, operation_type, store_id, is_settled, start_date, end_date } = req.query;

      const filters = {
        type,
        operation_type,
        store_id: store_id ? parseInt(store_id) : undefined,
        is_settled: is_settled !== undefined ? parseInt(is_settled) : undefined,
        start_date,
        end_date
      };

      const result = await this.inventoryService.exportInventoryRecords(filters);

      if (result.success) {
        ApiResponse.success(res, result.message, result.data);
      } else {
        ApiResponse.error(res, result.message, 400, result.code);
      }
    } catch (error) {
      log.error('导出库存数据失败:', error);
      ApiResponse.serverError(res, '导出库存数据失败', error);
    }
  }
}

module.exports = InventoryController;