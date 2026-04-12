const QueryService = require('../services/query.service');
const ApiResponse = require('../utils/response');
const dataMaskingService = require('../services/dataMaskingService');
const log = require('../utils/log');

class QueryController {
  constructor() {
    this.queryService = new QueryService();
  }

  /**
   * 综合查询手机数据
   */
  async getComprehensiveQuery(req, res) {
    try {
      // 验证查询参数
      await this.queryService.validateQueryFilters(req.query);

      // 获取用户关联的门店ID（用于数据权限过滤）
      const userStoreId = req.user?.store_id || null;
      const userStoreIds = req.user?.store_ids || [];

      const result = await this.queryService.getComprehensiveQuery(req.query, userStoreId, userStoreIds);

      // 根据用户权限过滤敏感数据
      if (result.data && result.data.length > 0) {
        const userId = req.user?.id || req.user?.userId;
        if (userId) {
          result.data = await dataMaskingService.maskDataList(result.data, userId, 'query_queryview');
        }
      }

      return ApiResponse.paginated(
        res,
        result.message,
        result.data,
        result.pagination
      );
    } catch (error) {
      log.error('QueryController: 综合查询失败:', error);
      return ApiResponse.error(res, error.message || '综合查询失败', 400);
    }
  }

  /**
   * 获取统计信息
   */
  async getStatistics(req, res) {
    try {
      // 获取用户关联的门店ID（用于数据权限过滤）
      const userStoreId = req.user?.store_id || null;
      const userStoreIds = req.user?.store_ids || [];

      const result = await this.queryService.getStatistics(req.query, userStoreId, userStoreIds);

      return ApiResponse.success(res, result.message, result.data);
    } catch (error) {
      log.error('QueryController: 统计查询失败:', error);
      return ApiResponse.error(res, error.message || '统计查询失败', 400);
    }
  }

  /**
   * 获取退库记录
   */
  async getReturnGoodsRecords(req, res) {
    try {
      const result = await this.queryService.getReturnGoodsRecords(req.query);

      return ApiResponse.paginated(
        res,
        result.message,
        result.data,
        {
          ...result.pagination,
          stats: result.stats
        }
      );
    } catch (error) {
      log.error('QueryController: 退库记录查询失败:', error);
      return ApiResponse.error(res, error.message || '退库记录查询失败', 400);
    }
  }

  async updateReturnGoodsRecord(req, res) {
    try {
      const { id } = req.params;
      const result = await this.queryService.updateReturnGoodsRecord(id, req.body);
      return ApiResponse.success(res, result.message, result.data);
    } catch (error) {
      log.error('QueryController: 退库记录更新失败:', error);
      return ApiResponse.error(res, error.message || '退库记录更新失败', 400);
    }
  }

  async deleteReturnGoodsRecord(req, res) {
    try {
      const { id } = req.params;
      const result = await this.queryService.deleteReturnGoodsRecord(id);
      return ApiResponse.success(res, result.message, result.data);
    } catch (error) {
      log.error('QueryController: 退库记录删除失败:', error);
      return ApiResponse.error(res, error.message || '退库记录删除失败', 400);
    }
  }

  
  /**
   * 退库操作 - 删除购买信息，恢复库存状态
   */
  async returnToStock(req, res) {
    try {
      const { id } = req.params;
      const operatorId = req.user.id; // 从JWT token中获取操作员ID
      const returnInfo = req.body; // 获取退库信息

      if (!id) {
        return ApiResponse.error(res, '手机ID不能为空', 400);
      }

      const result = await this.queryService.returnToStock(id, operatorId, returnInfo);

      return ApiResponse.success(res, result.message, result.data);
    } catch (error) {
      log.error('QueryController: 退库操作失败:', error);
      return ApiResponse.error(res, error.message || '退库操作失败', 400);
    }
  }

  /**
   * 删除手机记录
   */
  async deletePhoneRecord(req, res) {
    try {
      const { id } = req.params;

      if (!id) {
        return ApiResponse.error(res, '手机ID不能为空', 400);
      }

      const result = await this.queryService.deletePhoneRecord(id);

      return ApiResponse.success(res, result.message, result.data);
    } catch (error) {
      log.error('QueryController: 删除手机记录失败:', error);
      return ApiResponse.error(res, error.message || '删除手机记录失败', 400);
    }
  }

  /**
   * 导出Excel
   */
  async exportToExcel(req, res) {
    try {
      // 验证查询参数
      await this.queryService.validateQueryFilters(req.query);

      const userStoreId = req.user?.store_id || null;
      const userStoreIds = req.user?.store_ids || [];
      const result = await this.queryService.getComprehensiveQuery(
        { ...req.query, page: 1, limit: 10000 },
        userStoreId,
        userStoreIds
      );

      let exportData = result.data || [];
      const userId = req.user?.id || req.user?.userId;

      if (exportData.length > 0 && userId) {
        exportData = await dataMaskingService.maskDataList(exportData, userId, 'query_queryview');
      }

      const exportFile = this.queryService.buildExcelExport(exportData);

      res.setHeader('Content-Type', exportFile.mimeType);
      res.setHeader(
        'Content-Disposition',
        `attachment; filename*=UTF-8''${encodeURIComponent(exportFile.filename)}`
      );
      res.setHeader('X-Export-Total', String(exportFile.total));

      return res.send(exportFile.buffer);
    } catch (error) {
      log.error('QueryController: 导出Excel失败:', error);
      return ApiResponse.error(res, error.message || '导出Excel失败', 400);
    }
  }

  /**
   * 获取查询选项数据（供应商、店铺、品牌、型号等）
   */
  async getQueryOptions(req, res) {
    try {
      // 从数据库获取各种选项数据
      const optionsData = await this.queryService.getQueryOptions();

      const options = {
        suppliers: optionsData.suppliers || [], // 从suppliers表获取
        stores: optionsData.stores || [],    // 从stores表获取
        brands: optionsData.brands || [],    // 从phones表获取distinct品牌
        models: optionsData.models || [],    // 从phones表获取distinct型号
        colors: optionsData.colors || [],    // 从phones表获取distinct颜色
        memories: optionsData.memories || [],  // 从phones表获取distinct内存
        statuses: [
          { value: 'in_stock', label: '在库' },
          { value: 'sold', label: '已售' },
          { value: 'reserved', label: '预订' },
          { value: 'repair', label: '维修中' },
          { value: 'lost', label: '丢失' },
          { value: 'peer_transfer', label: '调货' },
          { value: 'supplier_proxy', label: '划拨' },
          { value: 'returned', label: '已退货' },
          { value: 'damaged', label: '损坏' },
          { value: 'available', label: '可用' }
        ],
        conditions: [
          { value: 'true', label: '全新' },
          { value: 'false', label: '二手' }
        ],
        sort_fields: [
          { value: 'created_at', label: '创建时间' },
          { value: 'purchase_date', label: '入库时间' },
          { value: 'sale_date', label: '销售时间' },
          { value: 'brand', label: '品牌' },
          { value: 'model', label: '型号' },
          { value: 'price', label: '销售价格' },
          { value: 'purchase_unit_price', label: '入库价格' }
        ]
      };

      return ApiResponse.success(res, '获取查询选项成功', options);
    } catch (error) {
      log.error('QueryController: 获取查询选项失败:', error);
      return ApiResponse.error(res, error.message || '获取查询选项失败', 500);
    }
  }

  /**
   * 批量操作
   */
  async batchOperations(req, res) {
    try {
      const { operation, phone_ids } = req.body;

      if (!operation || !phone_ids || !Array.isArray(phone_ids)) {
        return ApiResponse.error(res, '操作类型和手机ID列表不能为空', 400);
      }

      const results = [];

      switch (operation) {
        case 'delete':
          for (const phoneId of phone_ids) {
            try {
              const result = await this.queryService.deletePhoneRecord(phoneId);
              results.push({ phone_id: phoneId, success: true, message: result.message });
            } catch (error) {
              results.push({ phone_id: phoneId, success: false, message: error.message });
            }
          }
          break;

        default:
          return ApiResponse.error(res, '不支持的操作类型', 400);
      }

      const successCount = results.filter(r => r.success).length;
      const totalCount = results.length;

      return ApiResponse.success(res, `批量操作完成，成功 ${successCount}/${totalCount} 项`, {
        results,
        summary: {
          total: totalCount,
          success: successCount,
          failed: totalCount - successCount
        }
      });
    } catch (error) {
      log.error('QueryController: 批量操作失败:', error);
      return ApiResponse.error(res, error.message || '批量操作失败', 400);
    }
  }

  /**
   * 根据ID获取手机详情
   */
  async getPhoneDetail(req, res) {
    try {
      const { id } = req.params;

      if (!id) {
        return ApiResponse.error(res, '手机ID不能为空', 400);
      }

      // 使用综合查询获取单个手机详情
      const userStoreId = req.user?.store_id || null;
      const userStoreIds = req.user?.store_ids || [];
      const result = await this.queryService.getComprehensiveQuery({
        phone_id: id,
        limit: 1
      }, userStoreId, userStoreIds);

      if (result.data.length === 0) {
        return ApiResponse.error(res, '手机记录不存在', 404);
      }

      return ApiResponse.success(res, '获取手机详情成功', result.data[0]);
    } catch (error) {
      log.error('QueryController: 获取手机详情失败:', error);
      return ApiResponse.error(res, error.message || '获取手机详情失败', 500);
    }
  }
}

module.exports = QueryController;
