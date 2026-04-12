const QueryRepository = require('../repositories/query.repository');
const ApiResponse = require('../utils/response');
const XLSX = require('xlsx');

class QueryService {
  constructor() {
    this.queryRepository = new QueryRepository();
  }

  normalizeReturnGoodsType(value) {
    const raw = String(value || '').trim();
    if (!raw) return null;

    const mapping = {
      in_stock: 'in_stock',
      '在库': 'in_stock',
      sold: 'sold',
      '已售': 'sold',
      retail: 'sold',
      '零售': 'sold',
      peer_transfer: 'peer_transfer',
      '调货': 'peer_transfer',
      supplier_proxy: 'supplier_proxy',
      '划拨': 'supplier_proxy',
      reserved: 'reserved',
      '预订': 'reserved',
      '预定': 'reserved',
      repair: 'repair',
      '维修中': 'repair',
      '维修': 'repair',
      lost: 'lost',
      '丢失': 'lost',
      returned: 'returned',
      '已退货': 'returned',
      damaged: 'damaged',
      '损坏': 'damaged',
      available: 'available',
      '可用': 'available'
    };

    return mapping[raw] || raw;
  }

  /**
   * 获取综合查询数据
   */
  async getComprehensiveQuery(filters, userStoreId = null, userStoreIds = []) {
    try {
      // 处理数组参数
      const processArrayParam = (param) => {
        if (Array.isArray(param)) {
          return param.length > 0 ? param[0] : undefined;
        }
        return param;
      };

      // 参数验证和清理
      const cleanFilters = {
        page: parseInt(processArrayParam(filters.page)) || 1,
        limit: parseInt(processArrayParam(filters.limit)) || 20,
        phone_id: processArrayParam(filters.phone_id) ? parseInt(processArrayParam(filters.phone_id)) : undefined,
        supplier_id: processArrayParam(filters.supplier_id) ? parseInt(processArrayParam(filters.supplier_id)) : undefined,
        store_id: processArrayParam(filters.store_id) ? parseInt(processArrayParam(filters.store_id)) : undefined,
        brand: processArrayParam(filters.brand) ? processArrayParam(filters.brand).trim() : undefined,
        model: processArrayParam(filters.model) ? processArrayParam(filters.model).trim() : undefined,
        color: processArrayParam(filters.color) ? processArrayParam(filters.color).trim() : undefined,
        memory: processArrayParam(filters.memory) ? processArrayParam(filters.memory).trim() : undefined,
        status: processArrayParam(filters.status) ? processArrayParam(filters.status).trim() : undefined,
        is_new: filters.is_new !== undefined ? (filters.is_new === 'true' || filters.is_new === true) : undefined,
        sale_operator_id: processArrayParam(filters.sale_operator_id) ? parseInt(processArrayParam(filters.sale_operator_id)) : undefined,
        start_date: processArrayParam(filters.start_date) ? processArrayParam(filters.start_date).trim() : undefined,
        end_date: processArrayParam(filters.end_date) ? processArrayParam(filters.end_date).trim() : undefined,
        search_term: processArrayParam(filters.search_term) ? processArrayParam(filters.search_term).trim() : undefined,
        sort_field: processArrayParam(filters.sort_field) ? processArrayParam(filters.sort_field).trim() : 'salestime',
        sort_order: processArrayParam(filters.sort_order) ? processArrayParam(filters.sort_order).trim() : 'DESC'
      };

      // 店铺权限控制：
      // 1. 如果用户没有关联任何店铺（store_id和store_ids都为空），则不显示任何数据
      // 2. 如果用户关联了店铺，则只显示关联店铺的数据
      // 3. 如果用户手动选择了店铺筛选（cleanFilters.store_id有值），则使用用户选择的值
      // 4. 优先使用 userStoreIds（多门店），如果没有则使用 userStoreId（单门店）

      if (!cleanFilters.store_id) {
        // 用户没有手动选择店铺筛选，应用自动店铺过滤
        if (userStoreIds && userStoreIds.length > 0) {
          // 用户有关联的多个门店，应用多门店过滤
          cleanFilters.store_ids = userStoreIds;
        } else if (userStoreId) {
          // 用户有关联的单个门店，应用单门店过滤
          cleanFilters.store_id = userStoreId;
        } else {
          // 用户没有关联任何店铺，返回空结果
          return {
            success: true,
            message: '查询成功，但您没有关联任何店铺，无法查看数据',
            data: [],
            pagination: {
              page: cleanFilters.page,
              limit: cleanFilters.limit,
              total: 0,
              totalPages: 0,
              hasNextPage: false,
              hasPrevPage: false
            }
          };
        }
      } else {
        // 用户手动选择了店铺筛选
      }

      // 验证排序字段 - 更新为新的字段名
      const allowedSortFields = ['business_time', 'Inventorytime', 'salestime', 'brand', 'model', 'price', 'purchase_unit_price'];
      if (!allowedSortFields.includes(cleanFilters.sort_field)) {
        cleanFilters.sort_field = 'salestime';
      }

      // 验证排序方向
      const validSortOrders = ['ASC', 'DESC'];
      if (!validSortOrders.includes(cleanFilters.sort_order.toUpperCase())) {
        cleanFilters.sort_order = 'DESC';
      }

      const result = await this.queryRepository.getComprehensivePhoneQuery(cleanFilters);

      // 格式化返回数据
      const formattedData = result.data.map(item => {
        // 🔥 型号标准化：确保型号名称一致
        const normalizedModel = this.normalizeModelName(item.model);

        return ({
        基本信息: {
          phone_id: item.phone_id,
          imei: item.imei,
          serial_number: item.serial_number,
          brand_id: item.brand_id || null,
          model_id: item.model_id || null,
          color_id: item.color_id || null,
          memory_id: item.memory_id || null,
          brand: item.brand,
          model: normalizedModel,  // 使用标准化后的型号
          color: item.color,
          memory: item.memory,
          is_new: item.is_new,  // 直接返回数字值：1=全新，0=二手
          quality_grade: item.quality_grade,
          status: this.getStatusText(item.status),  // 中文状态（用于显示）
          status_code: item.status,  // 英文状态码（用于样式判断）
          remarks: item.remarks
        },
        供应商信息: {
          supplier_id: item.supplier_id || null,
          supplier_name: item.supplier_name || '-',
          supplier_contact: item.supplier_contact || '-',
          supplier_phone: item.supplier_phone || '-'
        },
        店铺信息: {
          store_id: item.store_id || null,
          store_name: item.store_name || '-',
          store_address: item.store_address || '-'
        },
        价格信息: {
          // 🔥 优先显示价格表的批发价（如果没有则显示入库成本价）
          wholesale_price: item.wholesale_price || item.purchase_price || 0,  // 批发价（来自价格表）
          retail_price: item.retail_price || 0,                                  // 零售价（来自价格表）
          purchase_price: item.purchase_price || 0,     // 入库成本价 (phones.purchase_cost)
          sale_price: item.sale_price || 0,             // 实际销售价 (phones.sale_price，销售时设置)

          // sales表中的价格（销售记录）
          sales_record_price: item.sales_record_price || 0   // 销售总价 (sales.price)
        },
        时间信息: {
          Inventorytime: item.Inventorytime,  // 入库时间
          // 销售时间：优先使用 sales.sale_date，然后是 phones.salestime，最后是 sales.created_at
          // 确保不返回空字符串，如果为空则返回 null
          salestime: item.sales_sale_date || item.phones_salestime || item.sale_created_at || item.sale_date || null,
        },
        客户信息: {
          customer_id: item.customer_id || null,
          customer_name: item.customer_name || '-',
          customer_phone: item.customer_phone || '-',
          apple_id: item.customer_apple_id || '-'
        },
        操作员信息: {
          operator_id: item.sale_operator_id || item.phone_sale_operator_id || null,
          sale_operator_id: item.sale_operator_id || item.phone_sale_operator_id || null,
          inventory_operator_id: item.inventory_operator_id || null,
          purchase_operator_name: item.inventory_operator_name || '-',
          inventory_operator_name: item.inventory_operator_name || '-',  // 添加前端需要的字段名
          sale_operator_name: item.sale_operator_name || '-'
        },
        销售信息: {
          sale_id: item.sale_id,
          sale_type: item.sale_type || '-',
          payment_method: item.payment_method || '-',
          payment_channel: item.payment_channel || '-',
          invoice_number: item.invoice_number || '-',
          sale_remarks: item.sale_remarks || '-'
        }
      });
      });

      return {
        success: true,
        message: '查询成功',
        data: formattedData,
        pagination: result.pagination
      };
    } catch (error) {
      throw new Error('综合查询失败: ' + error.message);
    }
  }

  /**
   * 获取统计信息
   */
  async getStatistics(filters, userStoreId = null, userStoreIds = []) {
    try {
      // 清理统计过滤参数
      const cleanFilters = {
        supplier_id: filters.supplier_id ? parseInt(filters.supplier_id) : undefined,
        store_id: filters.store_id ? parseInt(filters.store_id) : undefined,
        brand: filters.brand ? filters.brand.trim() : undefined,
        model: filters.model ? filters.model.trim() : undefined,
        status: filters.status ? filters.status.trim() : undefined,
        is_new: filters.is_new !== undefined ? (filters.is_new === 'true' || filters.is_new === true) : undefined,
        sale_operator_id: filters.sale_operator_id ? parseInt(filters.sale_operator_id) : undefined,
        start_date: filters.start_date ? filters.start_date.trim() : undefined,
        end_date: filters.end_date ? filters.end_date.trim() : undefined
      };

      // 店铺权限控制（与查询方法保持一致）
      if (!cleanFilters.store_id) {
        // 用户没有手动选择店铺筛选，应用自动店铺过滤
        if (userStoreIds && userStoreIds.length > 0) {
          // 用户有关联的多个门店，应用多门店过滤
          cleanFilters.store_ids = userStoreIds;
        } else if (userStoreId) {
          // 用户有关联的单个门店，应用单门店过滤
          cleanFilters.store_id = userStoreId;
        } else {
          // 用户没有关联任何店铺，返回空统计
          return {
            success: true,
            message: '统计查询成功，但您没有关联任何店铺',
            data: {
              total_phones: 0,
              in_stock_count: 0,
              sold_count: 0,
              new_count: 0,
              used_count: 0,
              total_purchase_cost: 0,
              total_sales_revenue: 0
            }
          };
        }
      } else {
        // 用户手动选择了店铺筛选进行统计
      }

      const stats = await this.queryRepository.getQueryStatistics(cleanFilters);

      return {
        success: true,
        message: '统计查询成功',
        data: {
          total_phones: parseInt(stats.total_phones) || 0,
          in_stock_count: parseInt(stats.in_stock_count) || 0,
          sold_count: parseInt(stats.sold_count) || 0,
          new_count: parseInt(stats.new_count) || 0,
          used_count: parseInt(stats.used_count) || 0,
          total_purchase_cost: parseFloat(stats.total_purchase_cost) || 0,
          total_sales_revenue: parseFloat(stats.total_sales_revenue) || 0
        }
      };
    } catch (error) {
      throw new Error('统计查询失败: ' + error.message);
    }
  }

  /**
   * 获取退库记录
   */
  async getReturnGoodsRecords(filters = {}) {
    try {
      const cleanFilters = {
        page: parseInt(filters.page, 10) || 1,
        limit: parseInt(filters.limit, 10) || 20,
        keyword: filters.keyword ? String(filters.keyword).trim() : '',
        start_date: filters.start_date ? String(filters.start_date).trim() : '',
        end_date: filters.end_date ? String(filters.end_date).trim() : ''
      };

      const result = await this.queryRepository.getReturnGoodsRecords(cleanFilters);

      return {
        success: true,
        message: '退库记录查询成功',
        data: result.data,
        pagination: result.pagination,
        stats: result.stats
      };
    } catch (error) {
      throw new Error('退库记录查询失败: ' + error.message);
    }
  }

  async updateReturnGoodsRecord(recordId, payload = {}) {
    try {
      if (!recordId) {
        throw new Error('退库记录ID不能为空');
      }

      await this.queryRepository.updateReturnGoodsRecord(recordId, {
        original_sale_type: this.normalizeReturnGoodsType(payload.original_sale_type),
        original_sale_operator_id: payload.original_sale_operator_id ? parseInt(payload.original_sale_operator_id, 10) : null,
        original_sale_operator_name: payload.original_sale_operator_name ? String(payload.original_sale_operator_name).trim() : null,
        reversal_date: payload.reversal_date ? String(payload.reversal_date).trim() : null,
        remarks: payload.remarks ? String(payload.remarks).trim() : null
      });

      return {
        success: true,
        message: '退库记录更新成功'
      };
    } catch (error) {
      throw new Error('退库记录更新失败: ' + error.message);
    }
  }

  async deleteReturnGoodsRecord(recordId) {
    try {
      if (!recordId) {
        throw new Error('退库记录ID不能为空');
      }

      await this.queryRepository.deleteReturnGoodsRecord(recordId);

      return {
        success: true,
        message: '退库记录删除成功'
      };
    } catch (error) {
      throw new Error('退库记录删除失败: ' + error.message);
    }
  }

  
  /**
   * 执行退库操作 - 删除购买信息，恢复库存状态
   */
  async returnToStock(phoneId, operatorId, returnInfo = {}) {
    try {
      if (!phoneId || !operatorId) {
        throw new Error('手机ID和操作员ID不能为空');
      }

      const result = await this.queryRepository.returnToStock(phoneId, operatorId, returnInfo);

      return {
        success: true,
        message: result.message,
        data: result
      };
    } catch (error) {
      throw new Error('退库操作失败: ' + error.message);
    }
  }

  /**
   * 删除手机记录
   */
  async deletePhoneRecord(phoneId) {
    try {
      if (!phoneId) {
        throw new Error('手机ID不能为空');
      }

      const result = await this.queryRepository.deletePhoneRecord(phoneId);

      return {
        success: true,
        message: result.message,
        data: result
      };
    } catch (error) {
      throw new Error('删除手机记录失败: ' + error.message);
    }
  }

  /**
   * 获取状态文本
   */
  getStatusText(status) {
    const statusMap = {
      'in_stock': '在库',
      'sold': '已售',
      'reserved': '预订',
      'repair': '维修中',
      'lost': '丢失',
      'peer_transfer': '调货',
      'supplier_proxy': '划拨',
      'returned': '已退货'
    };
    return statusMap[status] || status;
  }

  /**
   * 标准化型号名称
   * 确保型号名称格式一致，避免出现 iPad11 和 iPad 11 这样的重复
   */
  normalizeModelName(model) {
    if (!model) return model;

    let normalized = model.trim();

    // iPad 系列标准化
    // iPad11 -> iPad 11
    // iPadPro11 -> iPad Pro 11
    // iPadAir -> iPad Air
    normalized = normalized.replace(/iPad(\d)/i, 'iPad $1');
    normalized = normalized.replace(/iPadPro(\d)/i, 'iPad Pro $1');
    normalized = normalized.replace(/iPadAir/i, 'iPad Air');
    normalized = normalized.replace(/iPadMini/i, 'iPad Mini');

    // iPhone 系列标准化
    // iphone17 -> iPhone 17
    // iphone17pro -> iPhone 17 Pro
    // iphone17promax -> iPhone 17 Pro Max
    normalized = normalized.replace(/iphone(\d+)pro/i, 'iPhone $1 Pro');
    normalized = normalized.replace(/iphone(\d+)promax/i, 'iPhone $1 Pro Max');
    normalized = normalized.replace(/iphone(\d+)/i, 'iPhone $1');
    normalized = normalized.replace(/iPhone(\d+)Pro/i, 'iPhone $1 Pro');
    normalized = normalized.replace(/iPhone(\d+)ProMax/i, 'iPhone $1 Pro Max');

    // 确保单词间只有一个空格
    normalized = normalized.replace(/\s+/g, ' ').trim();

    return normalized;
  }

  /**
   * 验证查询参数
   */
  validateQueryFilters(filters) {
    const errors = [];

    // 验证页码
    if (filters.page && (isNaN(filters.page) || parseInt(filters.page) < 1)) {
      errors.push('页码必须是大于0的数字');
    }

    // 验证每页数量
    if (filters.limit && (isNaN(filters.limit) || parseInt(filters.limit) < 1 || parseInt(filters.limit) > 500)) {
      errors.push('每页数量必须是1-500之间的数字');
    }

    // 验证日期格式
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

    // 处理数组形式的日期参数
    const start_date = Array.isArray(filters.start_date) ? filters.start_date[0] : filters.start_date;
    const end_date = Array.isArray(filters.end_date) ? filters.end_date[0] : filters.end_date;

    if (start_date && !dateRegex.test(start_date)) {
      errors.push('开始日期格式不正确，应为YYYY-MM-DD');
    }

    if (end_date && !dateRegex.test(end_date)) {
      errors.push('结束日期格式不正确，应为YYYY-MM-DD');
    }

    if (start_date && end_date && start_date > end_date) {
      errors.push('开始日期不能晚于结束日期');
    }

    // 验证状态参数 - 使用数据库中实际的状态值
    const validStatuses = ['in_stock', 'sold', 'peer_transfer', 'supplier_proxy', 'reserved', 'repair', 'lost', 'damaged', 'available', 'returned'];
    if (filters.status && !validStatuses.includes(filters.status)) {
      errors.push(`状态参数无效，有效值为: ${validStatuses.join(', ')}`);
    }

    if (errors.length > 0) {
      throw new Error('参数验证失败: ' + errors.join(', '));
    }

    return true;
  }

  /**
   * 将综合查询结果转换为 Excel 行数据
   */
  buildExcelRows(items = []) {
    return items.map(item => ({
      手机ID: item?.基本信息?.phone_id || '',
      IMEI: item?.基本信息?.imei || '',
      序列号: item?.基本信息?.serial_number || '',
      品牌: item?.基本信息?.brand || '',
      型号: item?.基本信息?.model || '',
      颜色: item?.基本信息?.color || '',
      内存: item?.基本信息?.memory || '',
      新旧: item?.基本信息?.is_new === 1 ? '全新' : item?.基本信息?.is_new === 0 ? '二手' : '',
      机况: item?.基本信息?.quality_grade || '',
      状态: item?.基本信息?.status || '',
      备注: item?.基本信息?.remarks || '',
      供应商: item?.供应商信息?.supplier_name || '',
      供应商联系人: item?.供应商信息?.supplier_contact || '',
      供应商电话: item?.供应商信息?.supplier_phone || '',
      店铺: item?.店铺信息?.store_name || '',
      店铺地址: item?.店铺信息?.store_address || '',
      入库成本价: item?.价格信息?.purchase_price || 0,
      批发价: item?.价格信息?.wholesale_price || 0,
      零售价: item?.价格信息?.retail_price || 0,
      实际销售价: item?.价格信息?.sale_price || 0,
      销售记录价: item?.价格信息?.sales_record_price || 0,
      入库时间: item?.时间信息?.Inventorytime || '',
      销售时间: item?.时间信息?.salestime || '',
      客户姓名: item?.客户信息?.customer_name || '',
      客户电话: item?.客户信息?.customer_phone || '',
      AppleID: item?.客户信息?.apple_id || '',
      销售员: item?.操作员信息?.sale_operator_name || '',
      入库员: item?.操作员信息?.inventory_operator_name || '',
      销售类型: item?.销售信息?.sale_type || '',
      支付方式: item?.销售信息?.payment_method || '',
      支付渠道: item?.销售信息?.payment_channel || '',
      发票号: item?.销售信息?.invoice_number || '',
      销售备注: item?.销售信息?.sale_remarks || ''
    }));
  }

  /**
   * 构建综合查询 Excel 导出文件
   */
  buildExcelExport(items = []) {
    const rows = this.buildExcelRows(items);
    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    const beijingDate = new Intl.DateTimeFormat('zh-CN', {
      timeZone: 'Asia/Shanghai',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(new Date()).replace(/\//g, '-');

    XLSX.utils.book_append_sheet(workbook, worksheet, '综合查询');

    return {
      filename: `综合查询_${beijingDate}.xlsx`,
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer: XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }),
      total: rows.length
    };
  }

  /**
   * 获取查询选项数据
   */
  async getQueryOptions() {
    try {
      // 通过查询repository获取各种选项数据
      const options = await this.queryRepository.getQueryOptionsData();

      return options;
    } catch (error) {
      throw new Error('获取查询选项失败: ' + error.message);
    }
  }
}

module.exports = QueryService;
