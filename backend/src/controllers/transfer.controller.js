const log = require('../utils/log');
const TransferService = require('../services/transfer.service');
const ApiResponse = require('../utils/response');

const LEGACY_TRANSFER_PERMISSION_MAP = {
  'sales_salesview:wholesale': 'sales:wholesale',
  'sales_salesview:proxy-transfer': 'sales:proxy-transfer'
};

/**
 * 批发/划拨管理控制器
 */
class TransferController {
  constructor() {
    this.transferService = new TransferService();
  }

  /**
   * 检查用户是否有批发/划拨权限
   */
  hasTransferPermission(req, action) {
    if (!req.user) {
      return false;
    }

    const permissions = Array.isArray(req.user.permissions)
      ? req.user.permissions
      : Array.isArray(req.user.allPermissions)
        ? req.user.allPermissions
        : [];

    if (permissions.includes('*')) {
      return true;
    }

    const normalizedPermissions = new Set(
      permissions.map((permission) => LEGACY_TRANSFER_PERMISSION_MAP[permission] || permission)
    );

    const requiredPermissionMap = {
      wholesale: 'sales:wholesale',
      'proxy-transfer': 'sales:proxy-transfer'
    };

    const requiredPermission = requiredPermissionMap[action];
    return requiredPermission ? normalizedPermissions.has(requiredPermission) : false;
  }

  /**
   * 批发给同行
   * POST /api/transfers/wholesale
   * 场景：自己批发给同行，产生货款，计算利润
   */
  async wholesaleToPeer(req, res) {
    try {
      // 权限检查
      if (!this.hasTransferPermission(req, 'wholesale')) {
        return ApiResponse.error(res, '您没有调货权限，请联系管理员开通 sales:wholesale 权限', 403);
      }

      log.start('批发请求开始');
      log.debug('TransferController: 收到批发请求');
      log.debug('req.body:', JSON.stringify(req.body, null, 2));
      log.debug('phone_ids:', req.body.phone_ids);
      log.debug('phones:', JSON.stringify(req.body.phones));

      const {
        phone_id,          // 单台批发
        phone_ids,         // 多台批发
        customer_id,       // 客户ID（同行）
        customer_name,     // 客户姓名（新建客户时使用）
        customer_phone,    // 客户手机（新建客户时使用）
        phones,            // 每台手机的价格信息 [{phone_id, wholesale_price, purchase_cost}]
        store_id,          // 销售门店ID
        salesperson_name,  // 销售员姓名
        payment_method,    // 支付方式
        invoice_number,    // 发票号
        sale_date,         // 销售时间
        remarks            // 备注
      } = req.body;

      const operator_id = req.user.id;

      // 处理单台或多台批发
      const ids = phone_ids || (phone_id ? [phone_id] : []);
      log.debug('处理 ids:', ids);
      log.debug('phones 数组:', phones);

      if (ids.length === 0) {
        return ApiResponse.error(res, '请选择要批发的手机', 400);
      }

      const result = await this.transferService.wholesaleToPeer({
        phone_ids: ids,
        customer_id,
        customer_name,
        customer_phone,
        phones,
        remarks,
        operator_id,
        store_id,
        salesperson_name,
        payment_method,
        invoice_number,
        sale_date
      });

      return ApiResponse.success(res, `成功批发 ${result.success_count} 台`, result);
    } catch (error) {
      log.error('TransferController: 批发失败:', error);
      return ApiResponse.error(res, error.message || '批发失败', 500);
    }
  }

  /**
   * 代供应商划拨
   * POST /api/transfers/proxy
   * 场景：代供应商把手机划拨给其客户，不产生货款，不计算利润
   */
  async proxyTransferForSupplier(req, res) {
    try {
      // 权限检查
      if (!this.hasTransferPermission(req, 'proxy-transfer')) {
        return ApiResponse.error(res, '您没有划拨权限，请联系管理员开通 sales:proxy-transfer 权限', 403);
      }

      log.debug('TransferController: 收到代划拨请求，body:', req.body);

      const {
        phone_id,          // 单台划拨
        phone_ids,         // 多台划拨
        supplier_id,       // 供应商ID（必填）
        customer_id,       // 客户ID（可选，供应商的客户）
        customer_name,     // 客户姓名
        customer_phone,    // 客户手机
        phones,            // 每台手机的价格信息
        store_id,          // 销售门店ID
        salesperson_name,  // 销售员姓名
        sale_date,         // 划拨时间
        remarks            // 备注
      } = req.body;

      const operator_id = req.user.id;

      // 验证必填字段
      if (!supplier_id) {
        return ApiResponse.error(res, '请选择供应商', 400);
      }

      // 处理单台或多台划拨
      const ids = phone_ids || (phone_id ? [phone_id] : []);
      if (ids.length === 0) {
        return ApiResponse.error(res, '请选择要划拨的手机', 400);
      }

      const result = await this.transferService.proxyTransferForSupplier({
        phone_ids: ids,
        supplier_id,
        customer_id,
        customer_name,
        customer_phone,
        phones,
        remarks,
        operator_id,
        store_id,
        salesperson_name,
        sale_date
      });

      return ApiResponse.success(res, `成功划拨 ${result.success_count} 台`, result);
    } catch (error) {
      log.error('TransferController: 代划拨失败:', error);
      return ApiResponse.error(res, error.message || '代划拨失败', 500);
    }
  }

  /**
   * 获取批发/划拨记录列表
   * GET /api/transfers/records
   */
  async getTransferRecords(req, res) {
    try {
      log.debug('TransferController: 收到记录查询请求，query:', req.query);

      const filters = {
        page: parseInt(req.query.page) || 1,
        limit: parseInt(req.query.limit) || 20,
        start_date: req.query.start_date,
        end_date: req.query.end_date,
        record_type: req.query.record_type, // wholesale 或 supplier_proxy
        customer_id: req.query.customer_id,
        supplier_id: req.query.supplier_id,
        store_id: req.query.store_id
      };

      const result = await this.transferService.getWholesaleRecords(filters);

      return ApiResponse.paginated(res, '查询成功', result.data, result.pagination);
    } catch (error) {
      log.error('TransferController: 查询记录失败:', error);
      return ApiResponse.error(res, error.message || '查询记录失败', 500);
    }
  }

  /**
   * 获取批发/划拨统计
   * GET /api/transfers/statistics
   */
  async getTransferStatistics(req, res) {
    try {
      const filters = {
        start_date: req.query.start_date,
        end_date: req.query.end_date,
        store_id: req.query.store_id,
        supplier_id: req.query.supplier_id
      };

      const stats = await this.transferService.getWholesaleStatistics(filters);

      return ApiResponse.success(res, '获取统计成功', stats);
    } catch (error) {
      log.error('TransferController: 获取统计失败:', error);
      return ApiResponse.error(res, error.message || '获取统计失败', 500);
    }
  }
}

module.exports = TransferController;
