/**
 * 仪表板业务逻辑层
 * 处理所有仪表板相关的业务逻辑和数据验证
 */
const DashboardRepository = require('../repositories/dashboard.repository');
const ApiResponse = require('../utils/response');
const log = require('../utils/log');

class DashboardService {
  constructor() {
    this.dashboardRepository = new DashboardRepository();
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
   * 获取仪表板数据
   */
  async getDashboardData() {
    try {
      // 获取统计数据
      const stats = await this.dashboardRepository.getDashboardStats();

      // 获取最近销售记录
      const recentSales = await this.dashboardRepository.getRecentSales(5);

      // 获取库存预警
      const stockWarnings = await this.dashboardRepository.getStockWarnings(5);

      return this.createSuccessResponse('获取仪表板数据成功', {
        stats,
        recentSales,
        stockWarnings
      });
    } catch (error) {
      log.error('获取仪表板数据失败:', error);
      return this.createErrorResponse('获取仪表板数据失败', 'DATABASE_ERROR');
    }
  }

  /**
   * 获取销售趋势数据
   */
  async getSalesTrends(days = 7) {
    try {
      const daysNum = parseInt(days) || 7;
      if (daysNum < 1 || daysNum > 365) {
        return this.createErrorResponse('天数范围必须在1-365之间', 'INVALID_DAYS');
      }

      const trends = await this.dashboardRepository.getSalesTrends(daysNum);
      return this.createSuccessResponse('获取销售趋势数据成功', trends);
    } catch (error) {
      log.error('获取销售趋势数据失败:', error);
      return this.createErrorResponse('获取销售趋势数据失败', 'DATABASE_ERROR');
    }
  }

  
  /**
   * 获取热销产品排行
   */
  async getTopSellingProducts(limit = 10) {
    try {
      const limitNum = parseInt(limit) || 10;
      if (limitNum < 1 || limitNum > 100) {
        return this.createErrorResponse('限制数量必须在1-100之间', 'INVALID_LIMIT');
      }

      const topProducts = await this.dashboardRepository.getTopSellingProducts(limitNum);
      return this.createSuccessResponse('获取热销产品排行成功', topProducts);
    } catch (error) {
      log.error('获取热销产品排行失败:', error);
      return this.createErrorResponse('获取热销产品排行失败', 'DATABASE_ERROR');
    }
  }

  /**
   * 获取员工绩效排行
   */
  async getTopEmployees(limit = 10) {
    try {
      const limitNum = parseInt(limit) || 10;
      if (limitNum < 1 || limitNum > 100) {
        return this.createErrorResponse('限制数量必须在1-100之间', 'INVALID_LIMIT');
      }

      const topEmployees = await this.dashboardRepository.getTopEmployees(limitNum);
      return this.createSuccessResponse('获取员工绩效排行成功', topEmployees);
    } catch (error) {
      log.error('获取员工绩效排行失败:', error);
      return this.createErrorResponse('获取员工绩效排行失败', 'DATABASE_ERROR');
    }
  }

  /**
   * 获取分类销售统计
   */
  async getCategorySalesStats() {
    try {
      const categoryStats = await this.dashboardRepository.getCategorySalesStats();
      return this.createSuccessResponse('获取分类销售统计成功', categoryStats);
    } catch (error) {
      log.error('获取分类销售统计失败:', error);
      return this.createErrorResponse('获取分类销售统计失败', 'DATABASE_ERROR');
    }
  }

  /**
   * 获取菜单列表
   */
  async getMenus() {
    try {
      const menus = await this.dashboardRepository.getMenus();
      return this.createSuccessResponse('获取菜单列表成功', menus);
    } catch (error) {
      log.error('获取菜单列表失败:', error);
      return this.createErrorResponse('获取菜单列表失败', 'DATABASE_ERROR');
    }
  }

  /**
   * 获取完整的仪表板概览（包含所有数据）
   */
  async getDashboardOverview(filters = {}) {
    try {
      const { days = 7, limit = 10 } = filters;

      const daysNum = parseInt(days) || 7;
      const limitNum = parseInt(limit) || 10;

      // 验证参数
      if (daysNum < 1 || daysNum > 365) {
        return this.createErrorResponse('天数范围必须在1-365之间', 'INVALID_DAYS');
      }

      if (limitNum < 1 || limitNum > 100) {
        return this.createErrorResponse('限制数量必须在1-100之间', 'INVALID_LIMIT');
      }

      // 并行获取所有数据
      const [
        stats,
        recentSales,
        stockWarnings,
        salesTrends,
        topProducts,
        topEmployees,
        categoryStats
      ] = await Promise.all([
        this.dashboardRepository.getDashboardStats(),
        this.dashboardRepository.getRecentSales(5),
        this.dashboardRepository.getStockWarnings(5),
        this.dashboardRepository.getSalesTrends(daysNum),
        this.dashboardRepository.getTopSellingProducts(limitNum),
        this.dashboardRepository.getTopEmployees(limitNum),
        this.dashboardRepository.getCategorySalesStats()
      ]);

      return this.createSuccessResponse('获取仪表板概览成功', {
        stats,
        recentSales,
        stockWarnings,
        salesTrends,
        topProducts,
        topEmployees,
        categoryStats
      });
    } catch (error) {
      log.error('获取仪表板概览失败:', error);
      return this.createErrorResponse('获取仪表板概览失败', 'DATABASE_ERROR');
    }
  }

  /**
   * 获取综合预警信息
   * 包含：手机库存预警、配件库存预警、销售预警、入库预警
   */
  async getComprehensiveWarnings(filters = {}) {
    try {
      const { phoneThreshold = 3, limit = 10 } = filters;

      const thresholdNum = parseInt(phoneThreshold) || 3;
      const limitNum = parseInt(limit) || 10;

      // 验证参数
      if (thresholdNum < 0 || thresholdNum > 100) {
        return this.createErrorResponse('预警阈值必须在0-100之间', 'INVALID_THRESHOLD');
      }

      if (limitNum < 1 || limitNum > 100) {
        return this.createErrorResponse('限制数量必须在1-100之间', 'INVALID_LIMIT');
      }

      const warnings = await this.dashboardRepository.getComprehensiveWarnings({
        phoneThreshold: thresholdNum,
        limit: limitNum
      });

      return this.createSuccessResponse('获取综合预警成功', warnings);
    } catch (error) {
      log.error('获取综合预警失败:', error);
      return this.createErrorResponse('获取综合预警失败', 'DATABASE_ERROR');
    }
  }

  /**
   * 获取手机库存预警
   */
  async getPhoneStockWarnings(filters = {}) {
    try {
      const { threshold = 3, limit = 20 } = filters;

      const thresholdNum = parseInt(threshold) || 3;
      const limitNum = parseInt(limit) || 20;

      if (thresholdNum < 0 || thresholdNum > 100) {
        return this.createErrorResponse('预警阈值必须在0-100之间', 'INVALID_THRESHOLD');
      }

      if (limitNum < 1 || limitNum > 100) {
        return this.createErrorResponse('限制数量必须在1-100之间', 'INVALID_LIMIT');
      }

      const warnings = await this.dashboardRepository.getPhoneStockWarnings(thresholdNum, limitNum);

      return this.createSuccessResponse('获取手机库存预警成功', {
        warnings,
        threshold: thresholdNum,
        count: warnings.length
      });
    } catch (error) {
      log.error('获取手机库存预警失败:', error);
      return this.createErrorResponse('获取手机库存预警失败', 'DATABASE_ERROR');
    }
  }

  /**
   * 获取机型库存预警详情
   */
  async getModelStockWarnings(filters = {}) {
    try {
      const { threshold = 3, limit = 20 } = filters;

      const thresholdNum = parseInt(threshold) || 3;
      const limitNum = parseInt(limit) || 20;

      if (thresholdNum < 0 || thresholdNum > 100) {
        return this.createErrorResponse('预警阈值必须在0-100之间', 'INVALID_THRESHOLD');
      }

      if (limitNum < 1 || limitNum > 100) {
        return this.createErrorResponse('限制数量必须在1-100之间', 'INVALID_LIMIT');
      }

      const warnings = await this.dashboardRepository.getModelStockWarnings(thresholdNum, limitNum);

      return this.createSuccessResponse('获取机型库存预警成功', {
        warnings,
        threshold: thresholdNum,
        count: warnings.length
      });
    } catch (error) {
      log.error('获取机型库存预警失败:', error);
      return this.createErrorResponse('获取机型库存预警失败', 'DATABASE_ERROR');
    }
  }

  /**
   * 获取销售预警信息
   */
  async getSalesWarnings() {
    try {
      const [todaySales, salesTrend] = await Promise.all([
        this.dashboardRepository.getTodaySalesWarnings(),
        this.dashboardRepository.getSalesTrendWarnings()
      ]);

      // 计算平均日销量
      const avgDailySales = salesTrend.length > 0
        ? Math.round(salesTrend.reduce((sum, t) => sum + (t.sales_count || 0), 0) / salesTrend.length)
        : 0;

      return this.createSuccessResponse('获取销售预警成功', {
        today: todaySales,
        trend: salesTrend,
        avgDailySales,
        isBelowAverage: todaySales.sales_count < avgDailySales
      });
    } catch (error) {
      log.error('获取销售预警失败:', error);
      return this.createErrorResponse('获取销售预警失败', 'DATABASE_ERROR');
    }
  }

  /**
   * 获取入库预警信息
   */
  async getPurchaseWarnings() {
    try {
      const warnings = await this.dashboardRepository.getPurchaseWarnings();

      return this.createSuccessResponse('获取入库预警成功', warnings);
    } catch (error) {
      log.error('获取入库预警失败:', error);
      return this.createErrorResponse('获取入库预警失败', 'DATABASE_ERROR');
    }
  }
}

module.exports = DashboardService;
