const SaleService = require('../services/sale.service');
const ApiResponse = require('../utils/response');
const log = require('../utils/log');

class SaleController {
  constructor() {
    this.saleService = new SaleService();
  }

  /**
   * 手机销售出库
   */
  async sellPhone(req, res) {
    try {
      // 添加销售数据，保留前端发送的操作员ID
      const saleData = {
        ...req.body,
        // 如果前端没有发送operator_id，则使用当前登录用户ID
        operator_id: req.body.operator_id || req.user.id,
        store_id: req.body.store_id || req.user.store_id
      };

      // 验证销售数据
      this.saleService.validateSaleData(saleData);

      // 执行销售
      const result = await this.saleService.sellPhone(saleData);

      return ApiResponse.success(res, result.message, result.data, 201);
    } catch (error) {
      log.error('手机销售失败:', error);
      return ApiResponse.error(res, error.message || '手机销售失败', 400);
    }
  };

  /**
   * 批量手机销售
   */
  async sellPhonesBatch(req, res) {
    try {
      const { phones } = req.body;

      if (!phones || !Array.isArray(phones) || phones.length === 0) {
        return ApiResponse.error(res, '请提供有效的销售数据', 400);
      }

      // 添加销售数据，保留前端发送的操作员ID
      const salesData = phones.map(phone => ({
        ...phone,
        // 如果前端没有发送operator_id，则使用当前登录用户ID
        operator_id: phone.operator_id || req.user.id,
        store_id: phone.store_id || req.user.store_id
      }));

      // 验证每个销售记录
      for (const saleData of salesData) {
        this.saleService.validateSaleData(saleData);
      }

      // 执行批量销售
      const result = await this.saleService.sellPhonesBatch(salesData);

      return ApiResponse.success(res, result.message, result.data, 201);
    } catch (error) {
      log.error('批量手机销售失败:', error);
      return ApiResponse.error(res, error.message || '批量手机销售失败', 400);
    }
  };

  /**
   * 通过IMEI查找手机
   */
  async findPhoneByImei(req, res) {
    try {
      const { imei } = req.params;
      if (!imei) {
        return ApiResponse.error(res, 'IMEI号不能为空', 400);
      }

      const phone = await this.saleService.findPhoneByImei(imei.trim());

      return ApiResponse.success(res, '查找手机成功', phone);
    } catch (error) {
      log.error('查找手机失败:', error);
      return ApiResponse.error(res, error.message || '查找手机失败', 404);
    }
  };

  /**
   * 通过序列号查找手机
   */
  async findPhoneBySerialNumber(req, res) {
    try {
      const { serialNumber } = req.params;
      if (!serialNumber) {
        return ApiResponse.error(res, '序列号不能为空', 400);
      }

      const phone = await this.saleService.findPhoneBySerialNumber(serialNumber.trim());

      return ApiResponse.success(res, '查找手机成功', phone);
    } catch (error) {
      log.error('查找手机失败:', error);
      return ApiResponse.error(res, error.message || '查找手机失败', 404);
    }
  };

  /**
   * 根据手机号码查找客户
   */
  async findCustomerByPhone(req, res) {
    try {
      const { phone } = req.params;
      if (!phone) {
        return ApiResponse.error(res, '手机号码不能为空', 400);
      }

      const customer = await this.saleService.findCustomerByPhone(phone.trim());

      return ApiResponse.success(res, '查找客户成功', customer);
    } catch (error) {
      log.error('查找客户失败:', error);
      return ApiResponse.error(res, error.message || '查找客户失败', 404);
    }
  };

  /**
   * 获取可销售的手机列表
   */
  async getAvailablePhones(req, res) {
    try {
      const filters = {
        search: req.query.search,
        brand: req.query.brand,
        model: req.query.model,
        color: req.query.color,
        memory: req.query.memory,
        store_id: req.query.store_id,
        operator_id: req.query.operator_id,
        is_new: req.query.is_new,
        page: parseInt(req.query.page) || 1,
        limit: parseInt(req.query.limit) || 20
      };

      const result = await this.saleService.getAvailablePhones(filters);

      return ApiResponse.paginated(
        res,
        result.message,
        result.data,
        result.pagination
      );
    } catch (error) {
      log.error('获取可销售手机列表失败:', error);
      return ApiResponse.error(res, error.message || '获取可销售手机列表失败', 500);
    }
  };

  /**
   * 获取销售记录
   */
  async getSaleRecords(req, res) {
    try {
      const filters = {
        customer_id: req.query.customer_id,
        sale_type: req.query.sale_type,
        store_id: req.query.store_id,
        operator_id: req.query.operator_id,
        start_date: req.query.start_date,
        end_date: req.query.end_date,
        page: parseInt(req.query.page) || 1,
        limit: parseInt(req.query.limit) || 20
      };

      const result = await this.saleService.getSaleRecords(filters);

      return ApiResponse.paginated(
        res,
        result.message,
        result.data,
        result.pagination
      );
    } catch (error) {
      log.error('获取销售记录失败:', error);
      return ApiResponse.error(res, error.message || '获取销售记录失败', 500);
    }
  };

  /**
   * 根据ID获取销售记录详情
   */
  async getSaleRecordById(req, res) {
    try {
      const { id } = req.params;
      if (!id || isNaN(id)) {
        return ApiResponse.error(res, '无效的销售记录ID', 400);
      }

      const result = await this.saleService.getSaleRecordById(parseInt(id));

      return ApiResponse.success(res, result.message, result.data);
    } catch (error) {
      log.error('获取销售记录详情失败:', error);
      return ApiResponse.error(res, error.message || '获取销售记录详情失败', 404);
    }
  };

  /**
   * 获取销售统计信息
   */
  async getSaleStats(req, res) {
    try {
      const filters = {
        store_id: req.query.store_id,
        operator_id: req.query.operator_id,
        start_date: req.query.start_date,
        end_date: req.query.end_date
      };

      const result = await this.saleService.getSaleStats(filters);

      return ApiResponse.success(res, result.message, result.data);
    } catch (error) {
      log.error('获取销售统计失败:', error);
      return ApiResponse.error(res, error.message || '获取销售统计失败', 500);
    }
  };

  /**
   * 获取手机统计信息
   */
  async getPhoneStats(req, res) {
    try {
      const filters = {
        store_id: req.query.store_id,
        operator_id: req.query.operator_id
      };

      // 直接调用仓库方法获取统计信息
      const stats = await this.saleService.saleRepository.getPhoneStats(filters);

      return ApiResponse.success(res, '获取手机统计成功', stats);
    } catch (error) {
      log.error('获取手机统计失败:', error);
      return ApiResponse.error(res, error.message || '获取手机统计失败', 500);
    }
  };

  /**
   * 生成销售发票号
   */
  async generateInvoiceNumber(req, res) {
    try {
      const invoiceNumber = this.saleService.generateInvoiceNumber();

      return ApiResponse.success(res, '生成发票号成功', { invoice_number: invoiceNumber });
    } catch (error) {
      log.error('生成发票号失败:', error);
      return ApiResponse.error(res, error.message || '生成发票号失败', 500);
    }
  };
}

module.exports = SaleController;