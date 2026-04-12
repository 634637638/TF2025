/**
 * 供应商业务逻辑层
 * 处理所有供应商相关的业务逻辑和数据验证
 */
const SupplierRepository = require('../repositories/supplier.repository');
const ApiResponse = require('../utils/response');
const log = require('../utils/log');

class SupplierService {
  constructor() {
    this.supplierRepository = new SupplierRepository();
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
   * 验证供应商数据
   */
  validateSupplierData(supplierData, isUpdate = false) {
    const {
      name,
      contact,
      phone,
      address,
      bank_info,
      tax_number,
      status
    } = supplierData;

    // 名称验证
    if (name !== undefined) {
      if (!name || String(name).trim() === '') {
        return {
          isValid: false,
          message: '供应商名称不能为空'
        };
      }
      if (name.length < 2 || name.length > 100) {
        return {
          isValid: false,
          message: '供应商名称长度必须在2-100个字符之间'
        };
      }
    } else if (!isUpdate) {
      return {
        isValid: false,
        message: '供应商名称不能为空'
      };
    }

    // 联系人验证
    if (contact !== undefined && contact && contact.length > 50) {
      return {
        isValid: false,
        message: '联系人姓名长度不能超过50个字符'
      };
    }

    // 电话验证
    if (phone !== undefined && phone && phone.length > 20) {
      return {
        isValid: false,
        message: '联系电话长度不能超过20个字符'
      };
    }

    // 地址验证
    if (address !== undefined && address && address.length > 200) {
      return {
        isValid: false,
        message: '地址长度不能超过200个字符'
      };
    }

    // 银行信息验证
    if (bank_info !== undefined && bank_info && bank_info.length > 500) {
      return {
        isValid: false,
        message: '银行信息长度不能超过500个字符'
      };
    }

    // 税号验证
    if (tax_number !== undefined && tax_number && tax_number.length > 50) {
      return {
        isValid: false,
        message: '税号长度不能超过50个字符'
      };
    }

    // 状态验证
    if (status !== undefined && ![0, 1].includes(parseInt(status))) {
      return {
        isValid: false,
        message: '状态值只能是0(禁用)或1(启用)'
      };
    }

    return { isValid: true };
  }

  /**
   * 获取供应商列表
   */
  async getSuppliers(filters = {}, options = {}) {
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

      const result = await this.supplierRepository.getSuppliersWithPagination(
        { page: validPage, limit: validLimit, name, status },
        options
      );

      return this.createSuccessResponse('获取供应商列表成功', result);
    } catch (error) {
      log.error('获取供应商列表失败:', error);
      return this.createErrorResponse('获取供应商列表失败', 'DATABASE_ERROR');
    }
  }

  /**
   * 根据ID获取供应商详情
   */
  async getSupplierById(id) {
    try {
      const supplierId = parseInt(id);
      if (isNaN(supplierId) || supplierId <= 0) {
        return this.createErrorResponse('无效的供应商ID', 'INVALID_ID');
      }

      const supplier = await this.supplierRepository.getSupplierById(supplierId);
      if (!supplier) {
        return this.createErrorResponse('供应商不存在', 'NOT_FOUND');
      }

      return this.createSuccessResponse('获取供应商详情成功', supplier);
    } catch (error) {
      log.error('获取供应商详情失败:', error);
      return this.createErrorResponse('获取供应商详情失败', 'DATABASE_ERROR');
    }
  }

  /**
   * 创建供应商
   */
  async createSupplier(supplierData, user = null) {
    try {
      // 验证数据
      const validation = this.validateSupplierData(supplierData);
      if (!validation.isValid) {
        return this.createErrorResponse(validation.message, 'VALIDATION_ERROR');
      }

      const { name } = supplierData;

      // 检查名称是否已存在
      const isNameAvailable = await this.supplierRepository.checkNameAvailability(name);
      if (!isNameAvailable) {
        return this.createErrorResponse('供应商名称已存在', 'DUPLICATE_NAME');
      }

      // 创建供应商
      const supplierId = await this.supplierRepository.createSupplier(supplierData);
      if (!supplierId) {
        return this.createErrorResponse('创建供应商失败', 'CREATE_FAILED');
      }

      // 获取创建的供应商信息
      const newSupplier = await this.supplierRepository.getSupplierById(supplierId);

      return this.createSuccessResponse('供应商创建成功', {
        id: supplierId,
        ...newSupplier
      });
    } catch (error) {
      log.error('创建供应商失败:', error);
      return this.createErrorResponse('创建供应商失败', 'DATABASE_ERROR');
    }
  }

  /**
   * 更新供应商
   */
  async updateSupplier(id, supplierData, user = null) {
    try {
      const supplierId = parseInt(id);
      if (isNaN(supplierId) || supplierId <= 0) {
        return this.createErrorResponse('无效的供应商ID', 'INVALID_ID');
      }

      // 检查供应商是否存在
      const existingSupplier = await this.supplierRepository.getSupplierById(supplierId);
      if (!existingSupplier) {
        return this.createErrorResponse('供应商不存在', 'NOT_FOUND');
      }

      // 验证数据
      const validation = this.validateSupplierData(supplierData, true);
      if (!validation.isValid) {
        return this.createErrorResponse(validation.message, 'VALIDATION_ERROR');
      }

      // 如果更新名称，检查名称是否重复
      if (supplierData.name && supplierData.name !== existingSupplier.name) {
        const isNameAvailable = await this.supplierRepository.checkNameAvailability(
          supplierData.name, supplierId
        );
        if (!isNameAvailable) {
          return this.createErrorResponse('供应商名称已存在', 'DUPLICATE_NAME');
        }
      }

      // 更新供应商
      const updated = await this.supplierRepository.updateSupplier(supplierId, supplierData);
      if (!updated) {
        return this.createErrorResponse('更新供应商失败', 'UPDATE_FAILED');
      }

      // 获取更新后的供应商信息
      const updatedSupplier = await this.supplierRepository.getSupplierById(supplierId);

      return this.createSuccessResponse('供应商更新成功', updatedSupplier);
    } catch (error) {
      log.error('更新供应商失败:', error);
      return this.createErrorResponse('更新供应商失败', 'DATABASE_ERROR');
    }
  }

  /**
   * 删除供应商
   */
  async deleteSupplier(id, user = null) {
    try {
      const supplierId = parseInt(id);
      if (isNaN(supplierId) || supplierId <= 0) {
        return this.createErrorResponse('无效的供应商ID', 'INVALID_ID');
      }

      // 检查供应商是否存在
      const existingSupplier = await this.supplierRepository.getSupplierById(supplierId);
      if (!existingSupplier) {
        return this.createErrorResponse('供应商不存在', 'NOT_FOUND');
      }

      // 尝试删除供应商
      const deleteResult = await this.supplierRepository.deleteSupplier(supplierId);
      if (!deleteResult.canDelete) {
        return this.createErrorResponse(
          deleteResult.reason,
          'HAS_RELATIONSHIPS'
        );
      }

      if (!deleteResult.deleted) {
        return this.createErrorResponse('删除供应商失败', 'DELETE_FAILED');
      }

      return this.createSuccessResponse('供应商删除成功', {
        id: supplierId,
        name: existingSupplier.name
      });
    } catch (error) {
      log.error('删除供应商失败:', error);
      return this.createErrorResponse('删除供应商失败', 'DATABASE_ERROR');
    }
  }

  /**
   * 批量更新供应商状态
   */
  async batchUpdateStatus(ids, status, user = null) {
    try {
      if (!Array.isArray(ids) || ids.length === 0) {
        return this.createErrorResponse('请选择要操作的供应商', 'INVALID_IDS');
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
        return this.createErrorResponse('无效的供应商ID列表', 'INVALID_IDS');
      }

      // 批量更新
      const affectedRows = await this.supplierRepository.batchUpdateStatus(validIds, status);

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
   * 搜索供应商
   */
  async searchSuppliers(keyword, filters = {}) {
    try {
      if (!keyword || String(keyword).trim() === '') {
        return this.createErrorResponse('搜索关键词不能为空', 'INVALID_KEYWORD');
      }

      if (keyword.length < 2) {
        return this.createErrorResponse('搜索关键词长度至少2个字符', 'KEYWORD_TOO_SHORT');
      }

      const result = await this.supplierRepository.searchSuppliers(keyword.trim(), filters);

      return this.createSuccessResponse('搜索供应商成功', result);
    } catch (error) {
      log.error('搜索供应商失败:', error);
      return this.createErrorResponse('搜索供应商失败', 'DATABASE_ERROR');
    }
  }

  /**
   * 检查供应商名称可用性
   */
  async checkNameAvailability(name, excludeId = null) {
    try {
      if (!name || String(name).trim() === '') {
        return this.createErrorResponse('供应商名称不能为空', 'INVALID_NAME');
      }

      if (name.length < 2 || name.length > 100) {
        return this.createErrorResponse('供应商名称长度必须在2-100个字符之间', 'INVALID_NAME_LENGTH');
      }

      const isAvailable = await this.supplierRepository.checkNameAvailability(name.trim(), excludeId);

      return this.createSuccessResponse('检查完成', {
        name: name.trim(),
        is_available: isAvailable,
        message: isAvailable ? '供应商名称可用' : '供应商名称已存在'
      });
    } catch (error) {
      log.error('检查名称可用性失败:', error);
      return this.createErrorResponse('检查名称可用性失败', 'DATABASE_ERROR');
    }
  }

  /**
   * 获取供应商统计信息
   */
  async getSupplierStats() {
    try {
      const stats = await this.supplierRepository.getSupplierStats();

      return this.createSuccessResponse('获取统计信息成功', stats);
    } catch (error) {
      log.error('获取供应商统计信息失败:', error);
      return this.createErrorResponse('获取统计信息失败', 'DATABASE_ERROR');
    }
  }

  /**
   * 获取活跃供应商
   */
  async getActiveSuppliers() {
    try {
      const suppliers = await this.supplierRepository.getActiveSuppliers();

      return this.createSuccessResponse('获取活跃供应商成功', suppliers);
    } catch (error) {
      log.error('获取活跃供应商失败:', error);
      return this.createErrorResponse('获取活跃供应商失败', 'DATABASE_ERROR');
    }
  }

  /**
   * 导出供应商数据
   */
  async exportSuppliers(filters = {}) {
    try {
      const suppliers = await this.supplierRepository.exportSuppliers(filters);

      return this.createSuccessResponse('导出供应商数据成功', {
        data: suppliers,
        total_count: suppliers.length,
        export_time: new Date().toISOString()
      });
    } catch (error) {
      log.error('导出供应商数据失败:', error);
      return this.createErrorResponse('导出供应商数据失败', 'DATABASE_ERROR');
    }
  }

  /**
   * 测试供应商服务
   */
  async testSuppliers() {
    return this.createSuccessResponse('供应商管理模块工作正常', {
      message: '新的供应商管理系统已成功集成',
      version: '1.0.0',
      features: [
        '供应商CRUD操作',
        '分页查询和过滤',
        '搜索功能',
        '批量操作支持',
        '数据导出功能',
        '统计分析功能'
      ]
    });
  }
}

module.exports = SupplierService;
