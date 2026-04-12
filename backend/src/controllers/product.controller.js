const log = require('../utils/log');
/**
 * 产品控制器
 * 处理所有产品相关的HTTP请求
 */
const ProductService = require('../services/product.service');
const ApiResponse = require('../utils/response');

class ProductController {
  constructor() {
    this.productService = new ProductService();
  }

  /**
   * 测试产品模块
   */
  async testProducts(req, res) {
    try {
      const result = await this.productService.testProducts();
      ApiResponse.success(res, result.message, result.data);
    } catch (error) {
      log.error('测试产品模块失败:', error);
      ApiResponse.serverError(res, '测试产品模块失败', error);
    }
  }

  /**
   * 获取型号列表
   */
  async getModels(req, res) {
    try {
      const { brandId } = req.query;

      const filters = {
        brandId
      };

      const result = await this.productService.getModels(filters);

      if (result.success) {
        ApiResponse.success(res, result.message, result.data);
      } else {
        ApiResponse.error(res, result.message, 400, result.code);
      }
    } catch (error) {
      log.error('获取型号列表失败:', error);
      ApiResponse.serverError(res, '获取型号列表失败', error);
    }
  }

  /**
   * 获取颜色列表
   */
  async getColors(req, res) {
    try {
      const result = await this.productService.getColors();

      if (result.success) {
        ApiResponse.success(res, result.message, result.data);
      } else {
        ApiResponse.error(res, result.message, 400, result.code);
      }
    } catch (error) {
      log.error('获取颜色列表失败:', error);
      ApiResponse.serverError(res, '获取颜色列表失败', error);
    }
  }

  /**
   * 获取内存规格列表
   */
  async getMemories(req, res) {
    try {
      const result = await this.productService.getMemories();

      if (result.success) {
        ApiResponse.success(res, result.message, result.data);
      } else {
        ApiResponse.error(res, result.message, 400, result.code);
      }
    } catch (error) {
      log.error('获取内存规格列表失败:', error);
      ApiResponse.serverError(res, '获取内存规格列表失败', error);
    }
  }

  /**
   * 获取在库手机列表
   */
  async getInStockPhones(req, res) {
    try {
      const {
        page = 1,
        limit = 50,
        supplier_id,
        store_id,
        is_new,
        search
      } = req.query;

      const filters = {
        page,
        limit,
        supplier_id,
        store_id,
        is_new,
        search
      };

      const result = await this.productService.getInStockPhones(filters);

      if (result.success) {
        ApiResponse.paginated(
          res,
          result.message,
          result.data.phones,
          result.data.pagination
        );
      } else {
        ApiResponse.error(res, result.message, 400, result.code);
      }
    } catch (error) {
      log.error('获取在库手机列表失败:', error);
      ApiResponse.serverError(res, '获取在库手机列表失败', error);
    }
  }

  /**
   * 根据ID获取手机详情
   */
  async getPhoneById(req, res) {
    try {
      const { id } = req.params;

      const result = await this.productService.getPhoneById(id);

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
      log.error('获取手机详情失败:', error);
      ApiResponse.serverError(res, '获取手机详情失败', error);
    }
  }

  /**
   * 更新手机信息
   */
  async updatePhone(req, res) {
    try {
      const { id } = req.params;
      const phoneData = req.body;

      const result = await this.productService.updatePhone(id, phoneData);

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
      log.error('更新手机信息失败:', error);
      ApiResponse.serverError(res, '更新手机信息失败', error);
    }
  }

  /**
   * 删除手机记录
   */
  async deletePhone(req, res) {
    try {
      const { id } = req.params;

      const result = await this.productService.deletePhone(id);

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
      log.error('删除手机记录失败:', error);
      ApiResponse.serverError(res, '删除手机记录失败', error);
    }
  }

  /**
   * 获取型号建议
   */
  async getModelSuggestions(req, res) {
    try {
      const { keyword } = req.query;

      const result = await this.productService.getModelSuggestions(keyword);

      if (result.success) {
        ApiResponse.success(res, result.message, result.data);
      } else {
        ApiResponse.error(res, result.message, 400, result.code);
      }
    } catch (error) {
      log.error('获取型号建议失败:', error);
      ApiResponse.serverError(res, '获取型号建议失败', error);
    }
  }

  /**
   * 获取产品统计信息
   */
  async getProductStats(req, res) {
    try {
      const result = await this.productService.getProductStats();

      if (result.success) {
        ApiResponse.success(res, result.message, result.data);
      } else {
        ApiResponse.error(res, result.message, 400, result.code);
      }
    } catch (error) {
      log.error('获取产品统计信息失败:', error);
      ApiResponse.serverError(res, '获取产品统计信息失败', error);
    }
  }
}

module.exports = ProductController;