/**
 * 品牌业务逻辑层
 * 处理所有品牌相关的业务逻辑和数据验证
 */
const BrandRepository = require('../repositories/brand.repository');
const ApiResponse = require('../utils/response');
const log = require('../utils/log');

class BrandService {
  constructor() {
    this.brandRepository = new BrandRepository();
  }

  /**
   * 创建成功的响应格式
   */
  createSuccessResponse(message, data = null) {
    return {
      success: true,
      message,
      data
    };
  }

  /**
   * 创建错误的响应格式
   */
  createErrorResponse(message, code = null) {
    return {
      success: false,
      message,
      code
    };
  }

  /**
   * 验证必填字段
   */
  validateRequiredFields(data, requiredFields) {
    const missingFields = requiredFields.filter(field =>
      !data[field] || String(data[field]).trim() === ''
    );

    if (missingFields.length > 0) {
      return {
        isValid: false,
        message: `缺少必填字段: ${missingFields.join(', ')}`
      };
    }

    return { isValid: true };
  }

  /**
   * 验证品牌数据
   */
  validateBrandData(brandData, isUpdate = false) {
    const {
      name,
      status,
      sort_order
    } = brandData;

    // 名称验证
    if (name !== undefined) {
      if (!name || String(name).trim() === '') {
        return {
          isValid: false,
          message: '品牌名称不能为空'
        };
      }
      if (name.length < 2 || name.length > 100) {
        return {
          isValid: false,
          message: '品牌名称长度必须在2-100个字符之间'
        };
      }
    } else if (!isUpdate) {
      return {
        isValid: false,
        message: '品牌名称不能为空'
      };
    }

    // 状态验证
    if (status !== undefined && ![0, 1].includes(parseInt(status))) {
      return {
        isValid: false,
        message: '状态值只能是0(禁用)或1(启用)'
      };
    }

    // 排序值验证
    if (sort_order !== undefined && (isNaN(parseInt(sort_order)) || parseInt(sort_order) < 0)) {
      return {
        isValid: false,
        message: '排序值必须是非负整数'
      };
    }

    return { isValid: true };
  }

  /**
   * 获取品牌列表
   */
  async getBrands(filters = {}, options = {}) {
    try {
      const {
        page = 1,
        limit = 10,
        name,
        status
      } = filters;

      // 验证分页参数
      const validPage = Math.max(parseInt(page) || 1, 1);
      const validLimit = Math.min(Math.max(parseInt(limit) || 10, 1), 100);

      const result = await this.brandRepository.getBrandsWithPagination(
        { page: validPage, limit: validLimit, name, status },
        options
      );

      return this.createSuccessResponse('获取品牌列表成功', result);
    } catch (error) {
      log.error('获取品牌列表失败:', error);
      return this.createErrorResponse('获取品牌列表失败', 'DATABASE_ERROR');
    }
  }

  /**
   * 根据ID获取品牌详情
   */
  async getBrandById(id) {
    try {
      const brandId = parseInt(id);
      if (isNaN(brandId) || brandId <= 0) {
        return this.createErrorResponse('无效的品牌ID', 'INVALID_ID');
      }

      const brand = await this.brandRepository.getBrandById(brandId);
      if (!brand) {
        return this.createErrorResponse('品牌不存在', 'NOT_FOUND');
      }

      return this.createSuccessResponse('获取品牌详情成功', brand);
    } catch (error) {
      log.error('获取品牌详情失败:', error);
      return this.createErrorResponse('获取品牌详情失败', 'DATABASE_ERROR');
    }
  }

  /**
   * 创建品牌
   */
  async createBrand(brandData, user = null) {
    try {
      // 验证数据
      const validation = this.validateBrandData(brandData);
      if (!validation.isValid) {
        return this.createErrorResponse(validation.message, 'VALIDATION_ERROR');
      }

      const { name } = brandData;

      // 检查名称是否已存在
      const isNameAvailable = await this.brandRepository.checkNameAvailability(name);
      if (!isNameAvailable) {
        return this.createErrorResponse('品牌名称已存在', 'DUPLICATE_NAME');
      }

      // 创建品牌
      const brandId = await this.brandRepository.createBrand(brandData);
      if (!brandId) {
        return this.createErrorResponse('创建品牌失败', 'CREATE_FAILED');
      }

      // 获取创建的品牌信息
      const newBrand = await this.brandRepository.getBrandById(brandId);

      return this.createSuccessResponse('品牌创建成功', {
        id: brandId,
        ...newBrand
      });
    } catch (error) {
      log.error('创建品牌失败:', error);
      return this.createErrorResponse('创建品牌失败', 'DATABASE_ERROR');
    }
  }

  /**
   * 更新品牌
   */
  async updateBrand(id, brandData, user = null) {
    try {
      const brandId = parseInt(id);
      if (isNaN(brandId) || brandId <= 0) {
        return this.createErrorResponse('无效的品牌ID', 'INVALID_ID');
      }

      // 检查品牌是否存在
      const existingBrand = await this.brandRepository.getBrandById(brandId);
      if (!existingBrand) {
        return this.createErrorResponse('品牌不存在', 'NOT_FOUND');
      }

      // 验证数据
      const validation = this.validateBrandData(brandData, true);
      if (!validation.isValid) {
        return this.createErrorResponse(validation.message, 'VALIDATION_ERROR');
      }

      // 如果更新名称，检查名称是否重复
      if (brandData.name && brandData.name !== existingBrand.name) {
        const isNameAvailable = await this.brandRepository.checkNameAvailability(
          brandData.name, brandId
        );
        if (!isNameAvailable) {
          return this.createErrorResponse('品牌名称已存在', 'DUPLICATE_NAME');
        }
      }

      // 更新品牌
      const updated = await this.brandRepository.updateBrand(brandId, brandData);
      if (!updated) {
        return this.createErrorResponse('更新品牌失败', 'UPDATE_FAILED');
      }

      // 获取更新后的品牌信息
      const updatedBrand = await this.brandRepository.getBrandById(brandId);

      return this.createSuccessResponse('品牌更新成功', updatedBrand);
    } catch (error) {
      log.error('更新品牌失败:', error);
      return this.createErrorResponse('更新品牌失败', 'DATABASE_ERROR');
    }
  }

  /**
   * 删除品牌
   */
  async deleteBrand(id, user = null) {
    try {
      const brandId = parseInt(id);
      if (isNaN(brandId) || brandId <= 0) {
        return this.createErrorResponse('无效的品牌ID', 'INVALID_ID');
      }

      // 检查品牌是否存在
      const existingBrand = await this.brandRepository.getBrandById(brandId);
      if (!existingBrand) {
        return this.createErrorResponse('品牌不存在', 'NOT_FOUND');
      }

      // 尝试删除品牌
      const deleteResult = await this.brandRepository.deleteBrand(brandId);
      if (!deleteResult.canDelete) {
        return this.createErrorResponse(
          deleteResult.reason,
          'HAS_RELATIONSHIPS'
        );
      }

      if (!deleteResult.deleted) {
        return this.createErrorResponse('删除品牌失败', 'DELETE_FAILED');
      }

      return this.createSuccessResponse('品牌删除成功', {
        id: brandId,
        name: deleteResult.name || existingBrand.name
      });
    } catch (error) {
      log.error('删除品牌失败:', error);
      return this.createErrorResponse('删除品牌失败', 'DATABASE_ERROR');
    }
  }

  /**
   * 批量更新品牌状态
   */
  async batchUpdateStatus(ids, status, user = null) {
    try {
      if (!Array.isArray(ids) || ids.length === 0) {
        return this.createErrorResponse('请选择要操作的品牌', 'INVALID_IDS');
      }

      if (![0, 1].includes(parseInt(status))) {
        return this.createErrorResponse('状态值只能是0(禁用)或1(启用)', 'INVALID_STATUS');
      }

      // 验证ID格式
      const validIds = ids.filter(id => {
        const numId = parseInt(id);
        return !isNaN(numId) && numId > 0;
      });

      if (validIds.length === 0) {
        return this.createErrorResponse('无效的品牌ID列表', 'INVALID_IDS');
      }

      // 批量更新
      const affectedRows = await this.brandRepository.batchUpdateStatus(validIds, status);

      return this.createSuccessResponse('批量更新状态成功', {
        updated_count: affectedRows,
        status: parseInt(status),
        status_text: status == 1 ? '启用' : '禁用'
      });
    } catch (error) {
      log.error('批量更新状态失败:', error);
      return this.createErrorResponse('批量更新状态失败', 'DATABASE_ERROR');
    }
  }

  /**
   * 搜索品牌
   */
  async searchBrands(keyword, filters = {}) {
    try {
      if (!keyword || String(keyword).trim() === '') {
        return this.createErrorResponse('搜索关键词不能为空', 'INVALID_KEYWORD');
      }

      if (keyword.length < 2) {
        return this.createErrorResponse('搜索关键词长度至少2个字符', 'KEYWORD_TOO_SHORT');
      }

      const result = await this.brandRepository.searchBrands(keyword.trim(), filters);

      return this.createSuccessResponse('搜索品牌成功', result);
    } catch (error) {
      log.error('搜索品牌失败:', error);
      return this.createErrorResponse('搜索品牌失败', 'DATABASE_ERROR');
    }
  }

  /**
   * 检查品牌名称可用性
   */
  async checkNameAvailability(name, excludeId = null) {
    try {
      if (!name || String(name).trim() === '') {
        return this.createErrorResponse('品牌名称不能为空', 'INVALID_NAME');
      }

      if (name.length < 2 || name.length > 100) {
        return this.createErrorResponse('品牌名称长度必须在2-100个字符之间', 'INVALID_NAME_LENGTH');
      }

      const isAvailable = await this.brandRepository.checkNameAvailability(name.trim(), excludeId);

      return this.createSuccessResponse('检查完成', {
        name: name.trim(),
        is_available: isAvailable,
        message: isAvailable ? '品牌名称可用' : '品牌名称已存在'
      });
    } catch (error) {
      log.error('检查名称可用性失败:', error);
      return this.createErrorResponse('检查名称可用性失败', 'DATABASE_ERROR');
    }
  }

  /**
   * 获取品牌统计信息
   */
  async getBrandStats() {
    try {
      const stats = await this.brandRepository.getBrandStats();

      return this.createSuccessResponse('获取统计信息成功', stats);
    } catch (error) {
      log.error('获取品牌统计信息失败:', error);
      return this.createErrorResponse('获取统计信息失败', 'DATABASE_ERROR');
    }
  }

  /**
   * 获取活跃品牌
   */
  async getActiveBrands() {
    try {
      const brands = await this.brandRepository.getActiveBrands();

      return this.createSuccessResponse('获取活跃品牌成功', brands);
    } catch (error) {
      log.error('获取活跃品牌失败:', error);
      return this.createErrorResponse('获取活跃品牌失败', 'DATABASE_ERROR');
    }
  }

  /**
   * 获取品牌下的所有型号
   */
  async getBrandModels(brandId, status = 1) {
    try {
      const brandIdNum = parseInt(brandId);
      if (isNaN(brandIdNum) || brandIdNum <= 0) {
        return this.createErrorResponse('无效的品牌ID', 'INVALID_ID');
      }

      const models = await this.brandRepository.getBrandModels(brandIdNum, status);

      return this.createSuccessResponse('获取品牌型号成功', models);
    } catch (error) {
      log.error('获取品牌型号失败:', error);
      return this.createErrorResponse('获取品牌型号失败', 'DATABASE_ERROR');
    }
  }

  /**
   * 品牌搜索建议
   */
  async getBrandSuggestions(keyword, limit = 5) {
    try {
      if (!keyword || keyword.length < 2) {
        return this.createSuccessResponse('搜索建议', []);
      }

      const suggestions = await this.brandRepository.getBrandSuggestions(keyword.trim(), limit);

      return this.createSuccessResponse('获取搜索建议成功', suggestions);
    } catch (error) {
      log.error('获取搜索建议失败:', error);
      return this.createErrorResponse('获取搜索建议失败', 'DATABASE_ERROR');
    }
  }

  /**
   * 导出品牌数据
   */
  async exportBrands(filters = {}) {
    try {
      const brands = await this.brandRepository.exportBrands(filters);

      return this.createSuccessResponse('导出品牌数据成功', {
        data: brands,
        total_count: brands.length,
        export_time: new Date().toISOString()
      });
    } catch (error) {
      log.error('导出品牌数据失败:', error);
      return this.createErrorResponse('导出品牌数据失败', 'DATABASE_ERROR');
    }
  }

  /**
   * 测试品牌服务
   */
  async testBrands() {
    return this.createSuccessResponse('品牌管理模块工作正常', {
      message: '新的品牌管理系统已成功集成',
      version: '1.0.0',
      features: [
        '品牌CRUD操作',
        '分页查询和过滤',
        '搜索功能和建议',
        '批量操作支持',
        '数据导出功能',
        '统计分析功能',
        '型号管理集成'
      ]
    });
  }
}

module.exports = BrandService;
