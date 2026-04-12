const log = require('../utils/log');
/**
 * 供应商打款控制器
 * 处理供应商手机打款相关业务
 */
const supplierPaymentService = require('../services/supplier-payment.service');
const XLSX = require('xlsx');
const { getBeijingTimeString } = require('../utils/time');

class SupplierPaymentController {
  /**
   * 获取供应商应付统计
   */
  async getStatistics(req, res) {
    try {
      const { supplier_id } = req.query;
      const statistics = await supplierPaymentService.getStatistics({
        supplier_id: supplier_id ? parseInt(supplier_id) : null
      });

      res.json({
        success: true,
        data: statistics,
        message: '获取统计数据成功'
      });
    } catch (error) {
      log.error('获取统计数据失败:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'GET_STATISTICS_ERROR',
          message: error.message || '获取统计数据失败'
        }
      });
    }
  }

  /**
   * 获取汇总统计（用于卡片显示）
   */
  async getSummaryStatistics(req, res) {
    try {
      const { sale_status } = req.query;
      const summary = await supplierPaymentService.getSummaryStatistics({
        sale_status: sale_status || 'all'
      });

      res.json({
        success: true,
        data: summary,
        message: '获取汇总统计成功'
      });
    } catch (error) {
      log.error('获取汇总统计失败:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'GET_SUMMARY_STATISTICS_ERROR',
          message: error.message || '获取汇总统计失败'
        }
      });
    }
  }

  /**
   * 获取供应商手机列表
   */
  async getPhones(req, res) {
    try {
      const {
        supplier_id,
        store_id,
        payment_status = 'unpaid',
        sale_status = 'all',
        keyword,
        start_date,
        end_date,
        page = 1,
        limit = 50
      } = req.query;

      const result = await supplierPaymentService.getPhones({
        supplier_id: supplier_id ? parseInt(supplier_id) : null,
        store_id: store_id ? parseInt(store_id) : null,
        payment_status,
        sale_status,
        keyword: keyword?.trim(),
        start_date,
        end_date,
        page: parseInt(page),
        limit: parseInt(limit)
      });

      res.json({
        success: true,
        data: result.phones,
        pagination: result.pagination,
        message: '获取手机列表成功'
      });
    } catch (error) {
      log.error('获取手机列表失败:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'GET_PHONES_ERROR',
          message: error.message || '获取手机列表失败'
        }
      });
    }
  }

  async exportPhones(req, res) {
    try {
      const {
        supplier_id,
        store_id,
        payment_status = 'all',
        sale_status = 'all',
        keyword,
        start_date,
        end_date
      } = req.query;

      const result = await supplierPaymentService.getPhones({
        supplier_id: supplier_id ? parseInt(supplier_id, 10) : null,
        store_id: store_id ? parseInt(store_id, 10) : null,
        payment_status,
        sale_status,
        keyword: keyword?.trim(),
        start_date,
        end_date,
        export_all: true
      });

      const rows = (result.phones || []).map((item) => ({
        供应商: item.supplier_name || '',
        店铺: item.store_name || '',
        品牌: item.brand_name || '',
        型号: item.model_name || '',
        颜色: item.color_name || '',
        内存: item.memory_name || '',
        IMEI: item.imei || '',
        序列号: item.serial_number || '',
        入库成本: item.purchase_cost || 0,
        销售价: item.sale_price || 0,
        利润: item.profit || 0,
        销售状态: item.phone_status === 'in_stock' ? '在库' : item.phone_status === 'peer_transfer' ? '批发' : item.phone_status === 'sold' ? '已售' : item.phone_status || '',
        打款状态: item.payment_status === 'paid' ? '已打款' : '未打款',
        打款方式: item.payment_method || '',
        打款时间: item.payment_time || '',
        打款操作人: item.payment_operator_name || '',
        入库时间: item.purchase_date || '',
        销售时间: item.sale_time || '',
        入库员: item.inventory_operator_name || '',
        销售员: item.sale_operator_name || ''
      }));

      const worksheet = XLSX.utils.json_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      const beijingDate = new Intl.DateTimeFormat('zh-CN', {
        timeZone: 'Asia/Shanghai',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).format(new Date()).replace(/\//g, '-');

      XLSX.utils.book_append_sheet(workbook, worksheet, '供应商打款');

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename*=UTF-8''${encodeURIComponent(`供应商打款_${beijingDate}.xlsx`)}`
      );

      return res.send(XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }));
    } catch (error) {
      log.error('导出供应商打款手机列表失败:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'EXPORT_PHONES_ERROR',
          message: error.message || '导出供应商打款手机列表失败'
        }
      });
    }
  }

  /**
   * 批量打款
   */
  async batchPayment(req, res) {
    try {
      const { phone_ids, payment_method, payment_time } = req.body;
      const operator_id = req.user?.id || null;

      // 如果没有提供时间，使用当前北京时间
      const defaultTime = payment_time || getBeijingTimeString();

      const result = await supplierPaymentService.batchPayment({
        phone_ids,
        payment_method,
        payment_time: defaultTime,
        operator_id
      });

      res.json({
        success: true,
        data: result,
        message: `成功打款 ${result.count} 台手机`
      });
    } catch (error) {
      log.error('批量打款失败:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'BATCH_PAYMENT_ERROR',
          message: error.message || '批量打款失败'
        }
      });
    }
  }

  /**
   * 单个手机打款
   */
  async singlePayment(req, res) {
    try {
      const { id } = req.params;
      const { payment_method, payment_time } = req.body;
      const operator_id = req.user?.id || null;

      // 如果没有提供时间，使用当前北京时间
      const defaultTime = payment_time || getBeijingTimeString();

      const result = await supplierPaymentService.singlePayment({
        phone_id: parseInt(id),
        payment_method,
        payment_time: defaultTime,
        operator_id
      });

      res.json({
        success: true,
        data: result,
        message: '打款成功'
      });
    } catch (error) {
      log.error('打款失败:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'PAYMENT_ERROR',
          message: error.message || '打款失败'
        }
      });
    }
  }

  /**
   * 获取打款批次详情
   */
  async getPaymentBatchDetails(req, res) {
    try {
      const { supplier_id, payment_time } = req.query;

      const details = await supplierPaymentService.getPaymentBatchDetails(
        parseInt(supplier_id),
        payment_time
      );

      res.json({
        success: true,
        data: details,
        message: '获取批次详情成功'
      });
    } catch (error) {
      log.error('获取批次详情失败:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'GET_BATCH_DETAILS_ERROR',
          message: error.message || '获取批次详情失败'
        }
      });
    }
  }

  /**
   * 批量取消打款
   */
  async batchCancelPayment(req, res) {
    try {
      const { phone_ids } = req.body;

      const result = await supplierPaymentService.batchCancelPayment({
        phone_ids
      });

      res.json({
        success: true,
        data: result,
        message: result.message
      });
    } catch (error) {
      log.error('批量取消打款失败:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'BATCH_CANCEL_PAYMENT_ERROR',
          message: error.message || '批量取消打款失败'
        }
      });
    }
  }

  /**
   * 更新打款信息
   */
  async updatePayment(req, res) {
    try {
      const { id } = req.params;
      const { payment_method, payment_time } = req.body;

      const result = await supplierPaymentService.updatePayment({
        phone_id: parseInt(id),
        payment_method,
        payment_time
      });

      res.json({
        success: true,
        data: result,
        message: '更新成功'
      });
    } catch (error) {
      log.error('更新打款信息失败:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'UPDATE_PAYMENT_ERROR',
          message: error.message || '更新打款信息失败'
        }
      });
    }
  }
}

module.exports = new SupplierPaymentController();
