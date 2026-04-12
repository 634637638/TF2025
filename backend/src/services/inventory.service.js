/**
 * 库存业务逻辑层
 * 处理所有库存相关的业务逻辑和数据验证
 */
const InventoryRepository = require('../repositories/inventory.repository');
const ApiResponse = require('../utils/response');
const log = require('../utils/log');

class InventoryService {
  constructor() {
    this.inventoryRepository = new InventoryRepository();
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
   * 验证库存记录数据
   */
  validateInventoryData(inventoryData, isUpdate = false) {
    const {
      quantity,
      type,
      operation_type,
      reason,
      store_id,
      operator_id,
      note,
      is_settled,
      phone_id,
      accessory_id
    } = inventoryData;

    // 数量验证
    if (quantity !== undefined) {
      const qty = parseInt(quantity);
      if (isNaN(qty) || qty <= 0) {
        return {
          isValid: false,
          message: '数量必须是正整数'
        };
      }
    } else if (!isUpdate) {
      return {
        isValid: false,
        message: '数量不能为空'
      };
    }

    // 类型验证
    if (type !== undefined) {
      const validTypes = ['in', 'out', 'adjustment', 'sale'];
      if (!validTypes.includes(type)) {
        return {
          isValid: false,
          message: '库存类型无效，必须是 in、out、adjustment 或 sale'
        };
      }
    }

    // 操作类型验证
    if (operation_type !== undefined) {
      const validOperationTypes = ['in', 'out', 'adjust'];
      if (!validOperationTypes.includes(operation_type)) {
        return {
          isValid: false,
          message: '操作类型无效，必须是 in、out 或 adjust'
        };
      }
    }

    // 原因验证
    if (reason !== undefined) {
      if (reason && reason.length > 500) {
        return {
          isValid: false,
          message: '原因长度不能超过500个字符'
        };
      }
    } else if (!isUpdate && ['in', 'out'].includes(type)) {
      return {
        isValid: false,
        message: '入库和出库操作必须填写原因'
      };
    }

    // 商店ID验证
    if (store_id !== undefined && store_id !== null) {
      const storeId = parseInt(store_id);
      if (isNaN(storeId) || storeId <= 0) {
        return {
          isValid: false,
          message: '商店ID必须是正整数'
        };
      }
    }

    // 操作员ID验证
    if (operator_id !== undefined && operator_id !== null) {
      const operatorId = parseInt(operator_id);
      if (isNaN(operatorId) || operatorId <= 0) {
        return {
          isValid: false,
          message: '操作员ID必须是正整数'
        };
      }
    }

    // 结算状态验证
    if (is_settled !== undefined && ![0, 1].includes(parseInt(is_settled))) {
      return {
        isValid: false,
        message: '结算状态只能是0(未结算)或1(已结算)'
      };
    }

    // 产品ID验证（必须是手机或配件其中一个）
    if (!isUpdate) {
      if (!phone_id && !accessory_id) {
        return {
          isValid: false,
          message: '必须指定手机ID或配件ID中的一个'
        };
      }
      if (phone_id && accessory_id) {
        return {
          isValid: false,
          message: '不能同时指定手机ID和配件ID'
        };
      }
    }

    return { isValid: true };
  }

  /**
   * 获取库存记录列表
   */
  async getInventoryRecords(filters = {}, options = {}) {
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
      } = filters;

      // 验证分页参数
      const validPage = Math.max(parseInt(page) || 1, 1);
      const validLimit = Math.min(Math.max(parseInt(limit) || 10, 1), 100);

      const result = await this.inventoryRepository.getInventoryRecordsWithPagination(
        {
          page: validPage,
          limit: validLimit,
          type,
          operation_type,
          store_id: store_id ? parseInt(store_id) : undefined,
          operator_id: operator_id ? parseInt(operator_id) : undefined,
          product_type,
          is_settled: is_settled !== undefined ? parseInt(is_settled) : undefined,
          start_date,
          end_date
        },
        options
      );

      return this.createSuccessResponse('获取库存记录成功', result);
    } catch (error) {
      log.error('获取库存记录失败:', error);
      return this.createErrorResponse('获取库存记录失败', 'DATABASE_ERROR');
    }
  }

  /**
   * 根据ID获取库存记录详情
   */
  async getInventoryRecordById(id) {
    try {
      const recordId = parseInt(id);
      if (isNaN(recordId) || recordId <= 0) {
        return this.createErrorResponse('无效的库存记录ID', 'INVALID_ID');
      }

      const record = await this.inventoryRepository.getInventoryRecordById(recordId);
      if (!record) {
        return this.createErrorResponse('库存记录不存在', 'NOT_FOUND');
      }

      return this.createSuccessResponse('获取库存记录详情成功', record);
    } catch (error) {
      log.error('获取库存记录详情失败:', error);
      return this.createErrorResponse('获取库存记录详情失败', 'DATABASE_ERROR');
    }
  }

  /**
   * 创建库存记录
   */
  async createInventoryRecord(inventoryData, user = null) {
    try {
      // 验证数据
      const validation = this.validateInventoryData(inventoryData);
      if (!validation.isValid) {
        return this.createErrorResponse(validation.message, 'VALIDATION_ERROR');
      }

      // 创建库存记录
      const recordId = await this.inventoryRepository.createInventoryRecord(inventoryData);
      if (!recordId) {
        return this.createErrorResponse('创建库存记录失败', 'CREATE_FAILED');
      }

      // 获取创建的库存记录信息
      const newRecord = await this.inventoryRepository.getInventoryRecordById(recordId);

      return this.createSuccessResponse('库存记录创建成功', newRecord);
    } catch (error) {
      log.error('创建库存记录失败:', error);
      return this.createErrorResponse('创建库存记录失败', 'DATABASE_ERROR');
    }
  }

  /**
   * 更新库存记录
   */
  async updateInventoryRecord(id, inventoryData, user = null) {
    try {
      const recordId = parseInt(id);
      if (isNaN(recordId) || recordId <= 0) {
        return this.createErrorResponse('无效的库存记录ID', 'INVALID_ID');
      }

      // 检查库存记录是否存在
      const existingRecord = await this.inventoryRepository.getInventoryRecordById(recordId);
      if (!existingRecord) {
        return this.createErrorResponse('库存记录不存在', 'NOT_FOUND');
      }

      // 验证数据
      const validation = this.validateInventoryData(inventoryData, true);
      if (!validation.isValid) {
        return this.createErrorResponse(validation.message, 'VALIDATION_ERROR');
      }

      // 更新库存记录
      const updated = await this.inventoryRepository.updateInventoryRecord(recordId, inventoryData);
      if (!updated) {
        return this.createErrorResponse('更新库存记录失败', 'UPDATE_FAILED');
      }

      // 获取更新后的库存记录信息
      const updatedRecord = await this.inventoryRepository.getInventoryRecordById(recordId);

      return this.createSuccessResponse('库存记录更新成功', updatedRecord);
    } catch (error) {
      log.error('更新库存记录失败:', error);
      return this.createErrorResponse('更新库存记录失败', 'DATABASE_ERROR');
    }
  }

  /**
   * 删除库存记录
   */
  async deleteInventoryRecord(id, user = null) {
    try {
      const recordId = parseInt(id);
      if (isNaN(recordId) || recordId <= 0) {
        return this.createErrorResponse('无效的库存记录ID', 'INVALID_ID');
      }

      // 检查库存记录是否存在
      const existingRecord = await this.inventoryRepository.getInventoryRecordById(recordId);
      if (!existingRecord) {
        return this.createErrorResponse('库存记录不存在', 'NOT_FOUND');
      }

      // 检查是否可以删除
      if (existingRecord.related_records && existingRecord.related_records.length > 0) {
        return this.createErrorResponse(
          `该库存记录还有 ${existingRecord.related_records.length} 个相关记录，无法删除`,
          'HAS_RELATIONSHIPS'
        );
      }

      // 删除库存记录
      const deleteResult = await this.inventoryRepository.deleteInventoryRecord(recordId);
      if (!deleteResult.deleted) {
        return this.createErrorResponse('删除库存记录失败', 'DELETE_FAILED');
      }

      return this.createSuccessResponse('库存记录删除成功', {
        id: recordId,
        type: existingRecord.type
      });
    } catch (error) {
      log.error('删除库存记录失败:', error);
      return this.createErrorResponse('删除库存记录失败', 'DATABASE_ERROR');
    }
  }

  /**
   * 批量更新库存记录结算状态
   */
  async batchUpdateSettledStatus(ids, is_settled, user = null) {
    try {
      if (!Array.isArray(ids) || ids.length === 0) {
        return this.createErrorResponse('请选择要操作的库存记录', 'INVALID_IDS');
      }

      if (![0, 1].includes(parseInt(is_settled))) {
        return this.createErrorResponse('结算状态只能是0(未结算)或1(已结算)', 'INVALID_SETTLED_STATUS');
      }

      // 验证ID格式
      const validIds = ids.filter(id => {
        const numId = parseInt(id);
        return !isNaN(numId) && numId > 0;
      });

      if (validIds.length === 0) {
        return this.createErrorResponse('无效的库存记录ID列表', 'INVALID_IDS');
      }

      // 批量更新
      const affectedRows = await this.inventoryRepository.batchUpdateSettledStatus(validIds, is_settled);

      return this.createSuccessResponse('批量更新结算状态成功', {
        updated_count: affectedRows,
        is_settled: parseInt(is_settled),
        status_text: is_settled == 1 ? '已结算' : '未结算'
      });
    } catch (error) {
      log.error('批量更新结算状态失败:', error);
      return this.createErrorResponse('批量更新结算状态失败', 'DATABASE_ERROR');
    }
  }

  /**
   * 搜索库存记录
   */
  async searchInventoryRecords(keyword, filters = {}) {
    try {
      if (!keyword || String(keyword).trim() === '') {
        return this.createErrorResponse('搜索关键词不能为空', 'INVALID_KEYWORD');
      }

      if (keyword.length < 2) {
        return this.createErrorResponse('搜索关键词长度至少2个字符', 'KEYWORD_TOO_SHORT');
      }

      const result = await this.inventoryRepository.searchInventoryRecords(keyword.trim(), filters);

      return this.createSuccessResponse('搜索库存记录成功', result);
    } catch (error) {
      log.error('搜索库存记录失败:', error);
      return this.createErrorResponse('搜索库存记录失败', 'DATABASE_ERROR');
    }
  }

  /**
   * 获取库存统计信息
   */
  async getInventoryStats(filters = {}) {
    try {
      const stats = await this.inventoryRepository.getInventoryStats(filters);

      return this.createSuccessResponse('获取库存统计信息成功', stats);
    } catch (error) {
      log.error('获取库存统计信息失败:', error);
      return this.createErrorResponse('获取库存统计信息失败', 'DATABASE_ERROR');
    }
  }

  /**
   * 导出库存数据
   */
  async exportInventoryRecords(filters = {}) {
    try {
      const records = await this.inventoryRepository.exportInventoryRecords(filters);

      return this.createSuccessResponse('导出库存数据成功', {
        data: records,
        total_count: records.length,
        export_time: new Date().toISOString()
      });
    } catch (error) {
      log.error('导出库存数据失败:', error);
      return this.createErrorResponse('导出库存数据失败', 'DATABASE_ERROR');
    }
  }

  /**
   * 测试库存服务
   */
  async testInventory() {
    return this.createSuccessResponse('库存管理模块工作正常', {
      message: '新的库存管理系统已成功集成',
      version: '1.0.0',
      features: [
        '库存记录CRUD操作',
        '分页查询和过滤',
        '搜索功能',
        '批量操作支持',
        '数据导出功能',
        '统计分析功能',
        '库存追踪管理',
        '结算状态管理'
      ]
    });
  }
}

module.exports = InventoryService;
