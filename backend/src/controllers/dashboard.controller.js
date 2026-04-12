const log = require('../utils/log');
/**
 * 仪表板控制器
 * 处理所有仪表板相关的HTTP请求
 */
const DashboardService = require('../services/dashboard.service');
const ApiResponse = require('../utils/response');

class DashboardController {
  constructor() {
    this.dashboardService = new DashboardService();
  }

  /**
   * 测试仪表板模块
   */
  async testDashboard(req, res) {
    try {
      const result = await this.dashboardService.testDashboard();
      ApiResponse.success(res, result.message, result.data);
    } catch (error) {
      log.error('测试仪表板模块失败:', error);
      ApiResponse.serverError(res, '测试仪表板模块失败', error);
    }
  }

  /**
   * 获取仪表板数据
   */
  async getDashboard(req, res) {
    try {
      const result = await this.dashboardService.getDashboardData();

      if (result.success) {
        ApiResponse.success(res, result.message, result.data);
      } else {
        ApiResponse.error(res, result.message, 400, result.code);
      }
    } catch (error) {
      log.error('获取仪表板数据失败:', error);
      ApiResponse.serverError(res, '获取仪表板数据失败', error);
    }
  }

  /**
   * 获取销售趋势数据
   */
  async getSalesTrends(req, res) {
    try {
      const { days = 7 } = req.query;

      const result = await this.dashboardService.getSalesTrends(days);

      if (result.success) {
        ApiResponse.success(res, result.message, result.data);
      } else {
        ApiResponse.error(res, result.message, 400, result.code);
      }
    } catch (error) {
      log.error('获取销售趋势数据失败:', error);
      ApiResponse.serverError(res, '获取销售趋势数据失败', error);
    }
  }

  
  /**
   * 获取热销产品排行
   */
  async getTopSellingProducts(req, res) {
    try {
      const { limit = 10 } = req.query;

      const result = await this.dashboardService.getTopSellingProducts(limit);

      if (result.success) {
        ApiResponse.success(res, result.message, result.data);
      } else {
        ApiResponse.error(res, result.message, 400, result.code);
      }
    } catch (error) {
      log.error('获取热销产品排行失败:', error);
      ApiResponse.serverError(res, '获取热销产品排行失败', error);
    }
  }

  /**
   * 获取员工绩效排行
   */
  async getTopEmployees(req, res) {
    try {
      const { limit = 10 } = req.query;

      const result = await this.dashboardService.getTopEmployees(limit);

      if (result.success) {
        ApiResponse.success(res, result.message, result.data);
      } else {
        ApiResponse.error(res, result.message, 400, result.code);
      }
    } catch (error) {
      log.error('获取员工绩效排行失败:', error);
      ApiResponse.serverError(res, '获取员工绩效排行失败', error);
    }
  }

  /**
   * 获取分类销售统计
   */
  async getCategorySalesStats(req, res) {
    try {
      const result = await this.dashboardService.getCategorySalesStats();

      if (result.success) {
        ApiResponse.success(res, result.message, result.data);
      } else {
        ApiResponse.error(res, result.message, 400, result.code);
      }
    } catch (error) {
      log.error('获取分类销售统计失败:', error);
      ApiResponse.serverError(res, '获取分类销售统计失败', error);
    }
  }

  /**
   * 获取菜单列表
   */
  async getMenus(req, res) {
    try {
      const result = await this.dashboardService.getMenus();

      if (result.success) {
        ApiResponse.success(res, result.message, result.data);
      } else {
        ApiResponse.error(res, result.message, 400, result.code);
      }
    } catch (error) {
      log.error('获取菜单列表失败:', error);
      ApiResponse.serverError(res, '获取菜单列表失败', error);
    }
  }

  /**
   * 获取完整的仪表板概览
   */
  async getDashboardOverview(req, res) {
    try {
      const { days = 7, limit = 10 } = req.query;

      const filters = {
        days,
        limit
      };

      const result = await this.dashboardService.getDashboardOverview(filters);

      if (result.success) {
        ApiResponse.success(res, result.message, result.data);
      } else {
        ApiResponse.error(res, result.message, 400, result.code);
      }
    } catch (error) {
      log.error('获取仪表板概览失败:', error);
      ApiResponse.serverError(res, '获取仪表板概览失败', error);
    }
  }
}

module.exports = DashboardController;