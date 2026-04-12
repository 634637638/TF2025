const log = require('../utils/log');
/**
 * 供应商控制器
 * 处理所有供应商相关的HTTP请求
 */
const SupplierService = require('../services/supplier.service');
const ApiResponse = require('../utils/response');

class SupplierController {
  constructor() {
    this.supplierService = new SupplierService();
  }

  /**
   * 测试供应商模块
   */
  async testSuppliers(req, res) {
    try {
      const result = await this.supplierService.testSuppliers();
      ApiResponse.success(res, result.message, result.data);
    } catch (error) {
      log.error('测试供应商模块失败:', error);
      ApiResponse.serverError(res, '测试供应商模块失败', error);
    }
  }

  /**
   * 获取供应商列表
   */
  async getSuppliers(req, res) {
    try {
      const {
        page = 1,
        limit = 10,
        name,
        status
      } = req.query;

      const filters = {
        page: parseInt(page) || 1,
        limit: parseInt(limit) || 10,
        name,
        status: status !== undefined ? parseInt(status) : undefined
      };

      const result = await this.supplierService.getSuppliers(filters);

      if (result.success) {
        ApiResponse.paginated(
          res,
          result.message,
          result.data.suppliers,
          result.data.pagination
        );
      } else {
        ApiResponse.error(res, result.message, 400, result.code);
      }
    } catch (error) {
      log.error('获取供应商列表失败:', error);
      ApiResponse.serverError(res, '获取供应商列表失败', error);
    }
  }

  /**
   * 获取供应商统计信息
   */
  async getSupplierStats(req, res) {
    try {
      const result = await this.supplierService.getSupplierStats();

      if (result.success) {
        ApiResponse.success(res, result.message, result.data);
      } else {
        ApiResponse.error(res, result.message, 400, result.code);
      }
    } catch (error) {
      log.error('获取供应商统计信息失败:', error);
      ApiResponse.serverError(res, '获取供应商统计信息失败', error);
    }
  }

  /**
   * 获取活跃供应商
   */
  async getActiveSuppliers(req, res) {
    try {
      const result = await this.supplierService.getActiveSuppliers();

      if (result.success) {
        ApiResponse.success(res, result.message, result.data);
      } else {
        ApiResponse.error(res, result.message, 400, result.code);
      }
    } catch (error) {
      log.error('获取活跃供应商失败:', error);
      ApiResponse.serverError(res, '获取活跃供应商失败', error);
    }
  }

  /**
   * 搜索供应商
   */
  async searchSuppliers(req, res) {
    try {
      const { keyword, page, limit, status } = req.query;

      if (!keyword) {
        return ApiResponse.validationError(res, '搜索关键词不能为空');
      }

      const filters = {
        keyword: keyword.trim(),
        page: page ? parseInt(page) : undefined,
        limit: limit ? parseInt(limit) : undefined,
        status: status !== undefined ? parseInt(status) : undefined
      };

      const result = await this.supplierService.searchSuppliers(filters.keyword, filters);

      if (result.success) {
        ApiResponse.paginated(
          res,
          result.message,
          result.data.suppliers,
          result.data.pagination
        );
      } else {
        ApiResponse.error(res, result.message, 400, result.code);
      }
    } catch (error) {
      log.error('搜索供应商失败:', error);
      ApiResponse.serverError(res, '搜索供应商失败', error);
    }
  }

  /**
   * 检查供应商名称可用性
   */
  async checkNameAvailability(req, res) {
    try {
      const { name, excludeId } = req.query;

      if (!name) {
        return ApiResponse.validationError(res, '供应商名称不能为空');
      }

      const result = await this.supplierService.checkNameAvailability(name.trim(), excludeId);

      if (result.success) {
        ApiResponse.success(res, result.message, result.data);
      } else {
        ApiResponse.error(res, result.message, 400, result.code);
      }
    } catch (error) {
      log.error('检查名称可用性失败:', error);
      ApiResponse.serverError(res, '检查名称可用性失败', error);
    }
  }

  /**
   * 根据ID获取供应商详情
   */
  async getSupplierById(req, res) {
    try {
      const { id } = req.params;

      const result = await this.supplierService.getSupplierById(id);

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
      log.error('获取供应商详情失败:', error);
      ApiResponse.serverError(res, '获取供应商详情失败', error);
    }
  }

  /**
   * 创建供应商
   */
  async createStore(req, res) {
    try {
      const supplierData = req.body;

      const result = await this.supplierService.createSupplier(supplierData, req.user);

      if (result.success) {
        ApiResponse.created(res, result.message, result.data);
      } else {
        if (result.code === 'VALIDATION_ERROR') {
          ApiResponse.validationError(res, result.message);
        } else if (result.code === 'DUPLICATE_NAME') {
          ApiResponse.conflict(res, result.message);
        } else {
          ApiResponse.error(res, result.message, 400, result.code);
        }
      }
    } catch (error) {
      log.error('创建供应商失败:', error);
      ApiResponse.serverError(res, '创建供应商失败', error);
    }
  }

  /**
   * 更新供应商
   */
  async updateSupplier(req, res) {
    try {
      const { id } = req.params;
      const supplierData = req.body;

      const result = await this.supplierService.updateSupplier(id, supplierData, req.user);

      if (result.success) {
        ApiResponse.success(res, result.message, result.data);
      } else {
        if (result.code === 'NOT_FOUND') {
          ApiResponse.notFound(res, result.message);
        } else if (result.code === 'VALIDATION_ERROR') {
          ApiResponse.validationError(res, result.message);
        } else if (result.code === 'DUPLICATE_NAME') {
          ApiResponse.conflict(res, result.message);
        } else {
          ApiResponse.error(res, result.message, 400, result.code);
        }
      }
    } catch (error) {
      log.error('更新供应商失败:', error);
      ApiResponse.serverError(res, '更新供应商失败', error);
    }
  }

  /**
   * 批量更新供应商状态
   */
  async batchUpdateStatus(req, res) {
    try {
      const { ids, status } = req.body;

      const result = await this.supplierService.batchUpdateStatus(ids, status, req.user);

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
      log.error('批量更新状态失败:', error);
      ApiResponse.serverError(res, '批量更新状态失败', error);
    }
  }

  /**
   * 删除供应商
   */
  async deleteSupplier(req, res) {
    try {
      const { id } = req.params;

      const result = await this.supplierService.deleteSupplier(id, req.user);

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
      log.error('删除供应商失败:', error);
      ApiResponse.serverError(res, '删除供应商失败', error);
    }
  }

  /**
   * 导出供应商数据
   */
  async exportSuppliers(req, res) {
    try {
      const { name, status } = req.query;

      const filters = {
        name,
        status: status !== undefined ? parseInt(status) : undefined
      };

      const result = await this.supplierService.exportSuppliers(filters);

      if (result.success) {
        ApiResponse.success(res, result.message, result.data);
      } else {
        ApiResponse.error(res, result.message, 400, result.code);
      }
    } catch (error) {
      log.error('导出供应商数据失败:', error);
      ApiResponse.serverError(res, '导出供应商数据失败', error);
    }
  }
}

module.exports = SupplierController;