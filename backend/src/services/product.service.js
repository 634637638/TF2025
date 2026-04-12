/**
 * 产品业务逻辑层
 * 处理所有产品相关的业务逻辑和数据验证
 */
const ProductRepository = require('../repositories/product.repository');
const ApiResponse = require('../utils/response');
const log = require('../utils/log');

class ProductService {
  constructor() {
    this.productRepository = new ProductRepository();
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
   * 验证型号数据
   */
  validateModelData(modelData, isUpdate = false) {
    const { name, brand_id } = modelData;

    if (!isUpdate) {
      if (!name || String(name).trim() === '') {
        return {
          isValid: false,
          message: '型号名称不能为空'
        };
      }

      if (name.length > 100) {
        return {
          isValid: false,
          message: '型号名称长度不能超过100个字符'
        };
      }

      if (!brand_id || parseInt(brand_id) <= 0) {
        return {
          isValid: false,
          message: '品牌ID必须是正整数'
        };
      }
    }

    return { isValid: true };
  }

  /**
   * 验证颜色数据
   */
  validateColorData(colorData, isUpdate = false) {
    const { name } = colorData;

    if (!isUpdate) {
      if (!name || String(name).trim() === '') {
        return {
          isValid: false,
          message: '颜色名称不能为空'
        };
      }

      if (name.length > 50) {
        return {
          isValid: false,
          message: '颜色名称长度不能超过50个字符'
        };
      }
    }

    return { isValid: true };
  }

  /**
   * 验证内存规格数据
   */
  validateMemoryData(memoryData, isUpdate = false) {
    const { size } = memoryData;

    if (!isUpdate) {
      if (!size || String(size).trim() === '') {
        return {
          isValid: false,
          message: '内存规格不能为空'
        };
      }

      // 验证内存规格格式（如：64GB, 128GB, 256GB等）
      const memoryPattern = /^\d+(GB|TB)$/;
      if (!memoryPattern.test(size.toUpperCase())) {
        return {
          isValid: false,
          message: '内存规格格式不正确，应为数字+单位（如：64GB, 128GB）'
        };
      }
    }

    return { isValid: true };
  }

  /**
   * 验证手机数据
   */
  validatePhoneData(phoneData, isUpdate = false) {
    const {
      brand,
      model,
      color,
      memory,
      cost,
      price,
      supplier_id,
      store_id,
      quality_grade,
      warranty_period
    } = phoneData;

    if (brand !== undefined) {
      if (!brand || String(brand).trim() === '') {
        return {
          isValid: false,
          message: '品牌不能为空'
        };
      }
      if (brand.length > 50) {
        return {
          isValid: false,
          message: '品牌长度不能超过50个字符'
        };
      }
    }

    if (model !== undefined) {
      if (!model || String(model).trim() === '') {
        return {
          isValid: false,
          message: '型号不能为空'
        };
      }
      if (model.length > 100) {
        return {
          isValid: false,
          message: '型号长度不能超过100个字符'
        };
      }
    }

    if (color !== undefined) {
      if (!color || String(color).trim() === '') {
        return {
          isValid: false,
          message: '颜色不能为空'
        };
      }
      if (color.length > 50) {
        return {
          isValid: false,
          message: '颜色长度不能超过50个字符'
        };
      }
    }

    if (memory !== undefined) {
      if (!memory || String(memory).trim() === '') {
        return {
          isValid: false,
          message: '内存规格不能为空'
        };
      }
    }

    if (cost !== undefined) {
      const costValue = parseFloat(cost);
      if (isNaN(costValue) || costValue < 0) {
        return {
          isValid: false,
          message: '成本价必须是非负数'
        };
      }
    }

    if (price !== undefined) {
      const priceValue = parseFloat(price);
      if (isNaN(priceValue) || priceValue < 0) {
        return {
          isValid: false,
          message: '销售价必须是非负数'
        };
      }
    }

    if (supplier_id !== undefined && supplier_id !== null) {
      const supplierId = parseInt(supplier_id);
      if (isNaN(supplierId) || supplierId <= 0) {
        return {
          isValid: false,
          message: '供应商ID必须是正整数'
        };
      }
    }

    if (store_id !== undefined && store_id !== null) {
      const storeId = parseInt(store_id);
      if (isNaN(storeId) || storeId <= 0) {
        return {
          isValid: false,
          message: '商店ID必须是正整数'
        };
      }
    }

    if (quality_grade !== undefined) {
      const validGrades = ['A', 'B', 'C'];
      if (!validGrades.includes(quality_grade)) {
        return {
          isValid: false,
          message: '品质等级只能是A、B、C'
        };
      }
    }

    if (warranty_period !== undefined && warranty_period !== null) {
      const warranty = parseInt(warranty_period);
      if (isNaN(warranty) || warranty < 0) {
        return {
          isValid: false,
          message: '保修期必须是非负整数'
        };
      }
    }

    return { isValid: true };
  }

  /**
   * 获取型号列表
   */
  async getModels(filters = {}) {
    try {
      const { brandId } = filters;

      // 验证brandId
      if (brandId) {
        const brandIdNum = parseInt(brandId);
        if (isNaN(brandIdNum) || brandIdNum <= 0) {
          return this.createErrorResponse('品牌ID必须是正整数', 'INVALID_BRAND_ID');
        }
        filters.brandId = brandIdNum;
      }

      const models = await this.productRepository.getModels(filters);
      return this.createSuccessResponse('获取型号列表成功', models);
    } catch (error) {
      log.error('获取型号列表失败:', error);
      return this.createErrorResponse('获取型号列表失败', 'DATABASE_ERROR');
    }
  }

  /**
   * 获取颜色列表
   */
  async getColors() {
    try {
      const colors = await this.productRepository.getColors();
      return this.createSuccessResponse('获取颜色列表成功', colors);
    } catch (error) {
      log.error('获取颜色列表失败:', error);
      return this.createErrorResponse('获取颜色列表失败', 'DATABASE_ERROR');
    }
  }

  /**
   * 获取内存规格列表
   */
  async getMemories() {
    try {
      const memories = await this.productRepository.getMemories();
      return this.createSuccessResponse('获取内存规格列表成功', memories);
    } catch (error) {
      log.error('获取内存规格列表失败:', error);
      return this.createErrorResponse('获取内存规格列表失败', 'DATABASE_ERROR');
    }
  }

  /**
   * 获取在库手机列表
   */
  async getInStockPhones(filters = {}) {
    try {
      const {
        page = 1,
        limit = 50,
        supplier_id,
        store_id,
        is_new,
        search
      } = filters;

      // 验证分页参数
      const validPage = Math.max(parseInt(page) || 1, 1);
      const validLimit = Math.min(Math.max(parseInt(limit) || 10, 1), 100);

      const validFilters = {
        page: validPage,
        limit: validLimit,
        supplier_id: supplier_id ? parseInt(supplier_id) : undefined,
        store_id: store_id ? parseInt(store_id) : undefined,
        is_new: is_new !== undefined ? parseInt(is_new) : undefined,
        search: search ? search.trim() : undefined
      };

      const result = await this.productRepository.getInStockPhones(validFilters);
      return this.createSuccessResponse('获取在库手机列表成功', result);
    } catch (error) {
      log.error('获取在库手机列表失败:', error);
      return this.createErrorResponse('获取在库手机列表失败', 'DATABASE_ERROR');
    }
  }

  /**
   * 根据ID获取手机详情
   */
  async getPhoneById(id) {
    try {
      const phoneId = parseInt(id);
      if (isNaN(phoneId) || phoneId <= 0) {
        return this.createErrorResponse('无效的手机ID', 'INVALID_ID');
      }

      const phone = await this.productRepository.getPhoneById(phoneId);
      if (!phone) {
        return this.createErrorResponse('手机不存在', 'NOT_FOUND');
      }

      return this.createSuccessResponse('获取手机详情成功', phone);
    } catch (error) {
      log.error('获取手机详情失败:', error);
      return this.createErrorResponse('获取手机详情失败', 'DATABASE_ERROR');
    }
  }

  /**
   * 更新手机信息
   */
  async updatePhone(id, phoneData) {
    try {
      const phoneId = parseInt(id);
      if (isNaN(phoneId) || phoneId <= 0) {
        return this.createErrorResponse('无效的手机ID', 'INVALID_ID');
      }

      // 检查手机是否存在
      const existingPhone = await this.productRepository.getPhoneById(phoneId);
      if (!existingPhone) {
        return this.createErrorResponse('手机不存在', 'NOT_FOUND');
      }

      // 验证数据
      const validation = this.validatePhoneData(phoneData, true);
      if (!validation.isValid) {
        return this.createErrorResponse(validation.message, 'VALIDATION_ERROR');
      }

      // 更新手机信息
      const updated = await this.productRepository.updatePhone(phoneId, phoneData);
      if (!updated) {
        return this.createErrorResponse('更新手机信息失败', 'UPDATE_FAILED');
      }

      // 获取更新后的手机信息
      const updatedPhone = await this.productRepository.getPhoneById(phoneId);
      return this.createSuccessResponse('手机信息更新成功', updatedPhone);
    } catch (error) {
      log.error('更新手机信息失败:', error);
      return this.createErrorResponse('更新手机信息失败', 'DATABASE_ERROR');
    }
  }

  /**
   * 删除手机记录
   */
  async deletePhone(id) {
    try {
      const phoneId = parseInt(id);
      if (isNaN(phoneId) || phoneId <= 0) {
        return this.createErrorResponse('无效的手机ID', 'INVALID_ID');
      }

      // 检查手机是否存在
      const existingPhone = await this.productRepository.getPhoneById(phoneId);
      if (!existingPhone) {
        return this.createErrorResponse('手机不存在', 'NOT_FOUND');
      }

      // 删除手机记录
      const deleted = await this.productRepository.deletePhone(phoneId);
      if (!deleted) {
        return this.createErrorResponse('删除手机记录失败', 'DELETE_FAILED');
      }

      return this.createSuccessResponse('手机记录删除成功', {
        id: phoneId,
        brand: existingPhone.brand,
        model: existingPhone.model
      });
    } catch (error) {
      log.error('删除手机记录失败:', error);
      return this.createErrorResponse('删除手机记录失败', 'DATABASE_ERROR');
    }
  }

  /**
   * 获取型号建议
   */
  async getModelSuggestions(keyword = '') {
    try {
      if (keyword && keyword.length < 1) {
        return this.createErrorResponse('搜索关键词长度至少1个字符', 'KEYWORD_TOO_SHORT');
      }

      const suggestions = await this.productRepository.getModelSuggestions(keyword.trim());
      return this.createSuccessResponse('获取型号建议成功', suggestions);
    } catch (error) {
      log.error('获取型号建议失败:', error);
      return this.createErrorResponse('获取型号建议失败', 'DATABASE_ERROR');
    }
  }

  /**
   * 获取产品统计信息
   */
  async getProductStats() {
    try {
      const stats = await this.productRepository.getProductStats();
      return this.createSuccessResponse('获取产品统计信息成功', stats);
    } catch (error) {
      log.error('获取产品统计信息失败:', error);
      return this.createErrorResponse('获取产品统计信息失败', 'DATABASE_ERROR');
    }
  }

  /**
   * 测试产品服务
   */
  async testProducts() {
    return this.createSuccessResponse('产品管理模块工作正常', {
      message: '新的产品管理系统已成功集成',
      version: '1.0.0',
      features: [
        '型号管理',
        '颜色管理',
        '内存规格管理',
        '在库手机管理',
        '手机详情查看',
        '手机信息更新',
        '型号搜索建议',
        '产品统计分析',
        '库存数据查询',
        '多维度过滤'
      ]
    });
  }
}

module.exports = ProductService;
