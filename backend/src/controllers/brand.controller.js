const log = require('../utils/log');
/**
 * 品牌控制器
 * 处理所有品牌相关的HTTP请求
 */
const BrandService = require('../services/brand.service');
const ApiResponse = require('../utils/response');

class BrandController {
  constructor() {
    this.brandService = new BrandService();
  }

  /**
   * 测试品牌模块
   */
  async testBrands(req, res) {
    try {
      const result = await this.brandService.testBrands();
      ApiResponse.success(res, result.message, result.data);
    } catch (error) {
      log.error('测试品牌模块失败:', error);
      ApiResponse.serverError(res, '测试品牌模块失败', error);
    }
  }

  /**
   * 获取品牌列表
   */
  async getBrands(req, res) {
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

      const result = await this.brandService.getBrands(filters);

      if (result.success) {
        ApiResponse.paginated(
          res,
          result.message,
          result.data.brands,
          result.data.pagination
        );
      } else {
        ApiResponse.error(res, result.message, 400, result.code);
      }
    } catch (error) {
      log.error('获取品牌列表失败:', error);
      ApiResponse.serverError(res, '获取品牌列表失败', error);
    }
  }

  /**
   * 获取品牌统计信息
   */
  async getBrandStats(req, res) {
    try {
      const result = await this.brandService.getBrandStats();

      if (result.success) {
        ApiResponse.success(res, result.message, result.data);
      } else {
        ApiResponse.error(res, result.message, 400, result.code);
      }
    } catch (error) {
      log.error('获取品牌统计信息失败:', error);
      ApiResponse.serverError(res, '获取品牌统计信息失败', error);
    }
  }

  /**
   * 获取活跃品牌
   */
  async getActiveBrands(req, res) {
    try {
      const result = await this.brandService.getActiveBrands();

      if (result.success) {
        ApiResponse.success(res, result.message, result.data);
      } else {
        ApiResponse.error(res, result.message, 400, result.code);
      }
    } catch (error) {
      log.error('获取活跃品牌失败:', error);
      ApiResponse.serverError(res, '获取活跃品牌失败', error);
    }
  }

  /**
   * 搜索品牌
   */
  async searchBrands(req, res) {
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

      const result = await this.brandService.searchBrands(filters.keyword, filters);

      if (result.success) {
        ApiResponse.paginated(
          res,
          result.message,
          result.data.brands,
          result.data.pagination
        );
      } else {
        ApiResponse.error(res, result.message, 400, result.code);
      }
    } catch (error) {
      log.error('搜索品牌失败:', error);
      ApiResponse.serverError(res, '搜索品牌失败', error);
    }
  }

  /**
   * 检查品牌名称可用性
   */
  async checkNameAvailability(req, res) {
    try {
      const { name, excludeId } = req.query;

      if (!name) {
        return ApiResponse.validationError(res, '品牌名称不能为空');
      }

      const result = await this.brandService.checkNameAvailability(name.trim(), excludeId);

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
   * 根据ID获取品牌详情
   */
  async getBrandById(req, res) {
    try {
      const { id } = req.params;

      const result = await this.brandService.getBrandById(id);

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
      log.error('获取品牌详情失败:', error);
      ApiResponse.serverError(res, '获取品牌详情失败', error);
    }
  }

  /**
   * 创建品牌
   */
  async createBrand(req, res) {
    try {
      const brandData = req.body;

      const result = await this.brandService.createBrand(brandData, req.user);

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
      log.error('创建品牌失败:', error);
      ApiResponse.serverError(res, '创建品牌失败', error);
    }
  }

  /**
   * 更新品牌
   */
  async updateBrand(req, res) {
    try {
      const { id } = req.params;
      const brandData = req.body;

      const result = await this.brandService.updateBrand(id, brandData, req.user);

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
      log.error('更新品牌失败:', error);
      ApiResponse.serverError(res, '更新品牌失败', error);
    }
  }

  /**
   * 批量更新品牌状态
   */
  async batchUpdateStatus(req, res) {
    try {
      const { ids, status } = req.body;

      const result = await this.brandService.batchUpdateStatus(ids, status, req.user);

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
   * 删除品牌
   */
  async deleteBrand(req, res) {
    try {
      const { id } = req.params;

      const result = await this.brandService.deleteBrand(id, req.user);

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
      log.error('删除品牌失败:', error);
      ApiResponse.serverError(res, '删除品牌失败', error);
    }
  }

  /**
   * 获取品牌下的所有型号
   */
  async getBrandModels(req, res) {
    try {
      const { brandId } = req.params;
      const { status = 1 } = req.query;

      const result = await this.brandService.getBrandModels(brandId, parseInt(status));

      if (result.success) {
        ApiResponse.success(res, result.message, result.data);
      } else {
        if (result.code === 'INVALID_ID') {
          ApiResponse.validationError(res, result.message);
        } else {
          ApiResponse.error(res, result.message, 400, result.code);
        }
      }
    } catch (error) {
      log.error('获取品牌型号失败:', error);
      ApiResponse.serverError(res, '获取品牌型号失败', error);
    }
  }

  /**
   * 品牌搜索建议
   */
  async getBrandSuggestions(req, res) {
    try {
      const { q: keyword, limit = 5 } = req.query;

      if (!keyword || keyword.length < 2) {
        return ApiResponse.success(res, '获取搜索建议成功', []);
      }

      const result = await this.brandService.getBrandSuggestions(keyword.trim(), parseInt(limit));

      if (result.success) {
        ApiResponse.success(res, result.message, result.data);
      } else {
        ApiResponse.error(res, result.message, 400, result.code);
      }
    } catch (error) {
      log.error('获取搜索建议失败:', error);
      ApiResponse.serverError(res, '获取搜索建议失败', error);
    }
  }

  /**
   * 导出品牌数据
   */
  async exportBrands(req, res) {
    try {
      const { name, status } = req.query;

      const filters = {
        name,
        status: status !== undefined ? parseInt(status) : undefined
      };

      const result = await this.brandService.exportBrands(filters);

      if (result.success) {
        ApiResponse.success(res, result.message, result.data);
      } else {
        ApiResponse.error(res, result.message, 400, result.code);
      }
    } catch (error) {
      log.error('导出品牌数据失败:', error);
      ApiResponse.serverError(res, '导出品牌数据失败', error);
    }
  }
}

module.exports = BrandController;