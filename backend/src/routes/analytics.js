const express = require('express')
const router = express.Router()
const {
  unifiedAuth,
  requireBusinessUser,
  requirePermission,
  requireAnyPermission
} = require('../middleware/unified-auth')
const ApiResponse = require('../utils/response')
const AnalyticsSalesTrendController = require('../controllers/analytics-sales-trend.controller')
const AnalyticsCustomerGrowthController = require('../controllers/analytics-customer-growth.controller')
const AnalyticsCustomerDetailController = require('../controllers/analytics-customer-detail.controller')
const AnalyticsCustomerSegmentsController = require('../controllers/analytics-customer-segments.controller')
const AnalyticsHighValueCustomersController = require('../controllers/analytics-high-value-customers.controller')
const AnalyticsCustomerActivityController = require('../controllers/analytics-customer-activity.controller')
const AnalyticsCustomerRetentionController = require('../controllers/analytics-customer-retention.controller')
const AnalyticsRealtimeController = require('../controllers/analytics-realtime.controller')
const AnalyticsEmployeeRolesController = require('../controllers/analytics-employee-roles.controller')
const AnalyticsEmployeeSummaryController = require('../controllers/analytics-employee-summary.controller')
const AnalyticsInventoryController = require('../controllers/analytics-inventory.controller')
const AnalyticsProfitTrendController = require('../controllers/analytics-profit-trend.controller')
const AnalyticsStoreProfitController = require('../controllers/analytics-store-profit.controller')
const AnalyticsProductRankingController = require('../controllers/analytics-product-ranking.controller')
const AnalyticsSalesByConditionController = require('../controllers/analytics-sales-by-condition.controller')
const AnalyticsEmployeePerformanceController = require('../controllers/analytics-employee-performance.controller')
const AnalyticsSalesController = require('../controllers/analytics-sales.controller')
const AnalyticsProfitController = require('../controllers/analytics-profit.controller')
const AnalyticsCustomerOverviewController = require('../controllers/analytics-customer-overview.controller')
const AnalyticsTransfersController = require('../controllers/analytics-transfers.controller')
const { isStoreScopeError, resolveStoreScope } = require('../utils/store-scope')
const AnalyticsSalesForecastController = require('../controllers/analytics-sales-forecast.controller')

const analyticsSalesTrendController = new AnalyticsSalesTrendController()
const analyticsCustomerGrowthController = new AnalyticsCustomerGrowthController()
const analyticsCustomerDetailController = new AnalyticsCustomerDetailController()
const analyticsCustomerSegmentsController = new AnalyticsCustomerSegmentsController()
const analyticsHighValueCustomersController = new AnalyticsHighValueCustomersController()
const analyticsCustomerActivityController = new AnalyticsCustomerActivityController()
const analyticsCustomerRetentionController = new AnalyticsCustomerRetentionController()
const analyticsRealtimeController = new AnalyticsRealtimeController()
const analyticsEmployeeRolesController = new AnalyticsEmployeeRolesController()
const analyticsEmployeeSummaryController = new AnalyticsEmployeeSummaryController()
const analyticsInventoryController = new AnalyticsInventoryController()
const analyticsProfitTrendController = new AnalyticsProfitTrendController()
const analyticsStoreProfitController = new AnalyticsStoreProfitController()
const analyticsProductRankingController = new AnalyticsProductRankingController()
const analyticsSalesByConditionController = new AnalyticsSalesByConditionController()
const analyticsEmployeePerformanceController = new AnalyticsEmployeePerformanceController()
const analyticsSalesController = new AnalyticsSalesController()
const analyticsProfitController = new AnalyticsProfitController()
const analyticsCustomerOverviewController = new AnalyticsCustomerOverviewController()
const analyticsTransfersController = new AnalyticsTransfersController()
const analyticsSalesForecastController = new AnalyticsSalesForecastController()

const enforceAnalyticsStoreScope = (req, res, next) => {
  try {
    const storeScope = resolveStoreScope(req.user, req.query.store_id)
    if (storeScope.allStores) {
      req.storeScope = storeScope
      return next()
    }

    if (storeScope.storeIds.length === 0) {
      return ApiResponse.error(res, '当前账号未关联任何门店，无法查看分析数据', 403)
    }

    if (storeScope.requestedStoreId === null) {
      if (storeScope.storeIds.length > 1) {
        return ApiResponse.error(res, '请选择授权门店后再查看分析数据', 400)
      }
      req.query.store_id = String(storeScope.storeIds[0])
    }

    req.storeScope = storeScope
    return next()
  } catch (error) {
    if (isStoreScopeError(error)) {
      return ApiResponse.error(res, error.message, error.statusCode)
    }
    return next(error)
  }
}

router.use(unifiedAuth, requirePermission('analytics:view'), enforceAnalyticsStoreScope)
router.use('/inventory', requirePermission('inventory:view'))
router.use('/customers', requirePermission('customers:view'))
router.use(['/employee-performance', '/employees'], requirePermission('salary:view'))
router.use('/attendance', requireAnyPermission([
  'attendance:view',
  'attendance:view:own',
  'attendance:view:all'
]))
router.use('/employees/attendance', requireAnyPermission([
  'attendance:view',
  'attendance:view:own',
  'attendance:view:all'
]))

// ==================== 销售分析相关API ====================

// 获取销售分析数据
router.get('/sales', unifiedAuth, requireBusinessUser, analyticsSalesController.getSales.bind(analyticsSalesController))

// 获取全新机/二手机销量趋势
router.get('/sales/trends', unifiedAuth, requireBusinessUser, analyticsSalesTrendController.getSalesTrends.bind(analyticsSalesTrendController))

// 获取库存分析数据（使用 phones 表代替 inventory 表）
router.get('/inventory', unifiedAuth, requireBusinessUser, analyticsInventoryController.getOverview.bind(analyticsInventoryController))

// 获取低库存预警列表
// 使用系统预警配置（phone_stock_warnings）统一判断
router.get('/inventory/low-stock', unifiedAuth, requireBusinessUser, analyticsInventoryController.getLowStock.bind(analyticsInventoryController))

// 获取库存周转趋势
router.get('/inventory/turnover', unifiedAuth, requireBusinessUser, analyticsInventoryController.getTurnover.bind(analyticsInventoryController))

// 获取供应商统计（有货的供应商数量）
router.get('/inventory/supplier-stats', unifiedAuth, requireBusinessUser, analyticsInventoryController.getSupplierStats.bind(analyticsInventoryController))

// 获取最近销售的型号
router.get('/inventory/recent-sold', unifiedAuth, requireBusinessUser, analyticsInventoryController.getRecentSold.bind(analyticsInventoryController))

// 获取库存价值
router.get('/inventory/value', unifiedAuth, requireBusinessUser, analyticsInventoryController.getValue.bind(analyticsInventoryController))

// 获取客户分析数据
router.get('/customers', unifiedAuth, requireBusinessUser, analyticsCustomerOverviewController.getOverview.bind(analyticsCustomerOverviewController))

// 获取实时数据
router.get('/realtime', unifiedAuth, requireBusinessUser, analyticsRealtimeController.getRealtime.bind(analyticsRealtimeController))

// 辅助函数
function _generateInventoryIssues(summary) {
  const issues = []

  if (summary.lowStockItems > 0) {
    issues.push({
      type: 'low_stock',
      severity: summary.lowStockItems > 10 ? 'high' : 'medium',
      description: `有 ${summary.lowStockItems} 个商品库存不足`,
      affectedItems: summary.lowStockItems,
      potentialLoss: summary.lowStockItems * 1000
    })
  }

  if (summary.outOfStockItems > 0) {
    issues.push({
      type: 'out_of_stock',
      severity: 'high',
      description: `有 ${summary.outOfStockItems} 个商品已售罄`,
      affectedItems: summary.outOfStockItems,
      potentialLoss: summary.outOfStockItems * 2000
    })
  }

  return issues
}

function _generateInventoryRecommendations(summary) {
  const recommendations = []

  if (summary.lowStockItems > 0) {
    recommendations.push('及时补充库存不足的商品')
  }

  if (summary.overstockItems > 0) {
    recommendations.push('考虑促销活动清理过量库存')
  }

  recommendations.push('定期进行库存盘点确保数据准确性')

  return recommendations
}

function _getSegmentCharacteristics(segment) {
  const characteristics = {
    '高价值客户': ['购买频率高', '客单价高', '忠诚度高'],
    '中价值客户': ['有一定购买力', '需要培养忠诚度'],
    '低价值客户': ['购买次数少', '客单价较低'],
    '新客户': ['首次购买', '需要引导和关怀']
  }

  return characteristics[segment] || []
}

function _generateCLVTrends() {
  const trends = []
  const now = new Date()

  for (let i = 5; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
    trends.push({
      period: date.toISOString().slice(0, 7),
      value: 0,
      change: 0
    })
  }

  return trends
}

// 获取客户增长数据
router.get('/customers/growth', unifiedAuth, requireBusinessUser, analyticsCustomerGrowthController.getGrowth.bind(analyticsCustomerGrowthController))

// 获取高价值客户列表
router.get('/customers/high-value', unifiedAuth, requireBusinessUser, analyticsHighValueCustomersController.list.bind(analyticsHighValueCustomersController))

// 获取单个客户的消费趋势和商品偏好。
router.get('/customers/:id/detail', unifiedAuth, requireBusinessUser, analyticsCustomerDetailController.getDetail.bind(analyticsCustomerDetailController))

// 获取客户细分数据
router.get('/customers/segments', unifiedAuth, requireBusinessUser, analyticsCustomerSegmentsController.getSegments.bind(analyticsCustomerSegmentsController))

router.get('/customers/retention', unifiedAuth, requireBusinessUser, analyticsCustomerRetentionController.getRetention.bind(analyticsCustomerRetentionController))

// 获取客户活跃度
router.get('/customers/activity', unifiedAuth, requireBusinessUser, analyticsCustomerActivityController.getActivity.bind(analyticsCustomerActivityController))

// 获取盈利分析数据
router.get('/profit', unifiedAuth, requireBusinessUser, analyticsProfitController.getProfit.bind(analyticsProfitController))

// 获取盈利趋势数据（月度/季度/年度）
router.get('/profit-trend', unifiedAuth, requireBusinessUser, analyticsProfitTrendController.getProfitTrend.bind(analyticsProfitTrendController))

// 获取门店利润数据
router.get('/store-profit', unifiedAuth, requireBusinessUser, analyticsStoreProfitController.getStoreProfit.bind(analyticsStoreProfitController))

// 获取品牌销量排行
router.get('/ranking/brands', unifiedAuth, requireBusinessUser, analyticsProductRankingController.getBrandRanking.bind(analyticsProductRankingController))

// 获取型号销量排行
router.get('/ranking/models', unifiedAuth, requireBusinessUser, analyticsProductRankingController.getModelRanking.bind(analyticsProductRankingController))

// 获取全新/二手销售数据
router.get('/sales-by-condition', unifiedAuth, requireBusinessUser, analyticsSalesByConditionController.getSalesByCondition.bind(analyticsSalesByConditionController))

// 获取员工业绩统计
router.get('/employee-performance', unifiedAuth, requireBusinessUser, analyticsEmployeePerformanceController.getPerformance.bind(analyticsEmployeePerformanceController))

/**
 * 📊 获取划拨批发分析数据
 * GET /api/analytics/transfers-and-allocations
 */
router.get('/transfers-and-allocations', unifiedAuth, requireBusinessUser, analyticsTransfersController.getTransfersAndAllocations.bind(analyticsTransfersController))

// ==================== 员工分析相关API ====================

/**
 * 获取员工分析详情数据
 * 包括：员工总数、在职员工、工资总额、出勤率、销售数据等
 */
router.get('/employees/detail', unifiedAuth, requireBusinessUser, analyticsEmployeeSummaryController.employeeOverview.bind(analyticsEmployeeSummaryController))

/**
 * 获取员工销售业绩排行
 * 支持按不同指标排序：总销售额、全新机销量、二手机销量、批发量、划拨量
 */
router.get('/employees/performance', unifiedAuth, requireBusinessUser, analyticsEmployeeSummaryController.employeePerformance.bind(analyticsEmployeeSummaryController))

/**
 * 获取员工角色分布数据
 */
router.get('/employees/roles', unifiedAuth, requireBusinessUser, analyticsEmployeeRolesController.getEmployeeRoles.bind(analyticsEmployeeRolesController))

/**
 * 获取员工工资趋势数据
 */
router.get('/employees/salary-trend', unifiedAuth, requireBusinessUser, analyticsEmployeeSummaryController.salaryTrend.bind(analyticsEmployeeSummaryController))

/**
 * 获取员工出勤统计
 */
router.get('/employees/attendance', unifiedAuth, requireBusinessUser, analyticsEmployeeSummaryController.attendance.bind(analyticsEmployeeSummaryController))

/**
 * 获取考勤记录（含异常）
 */
router.get('/attendance/summary', unifiedAuth, requireBusinessUser, analyticsEmployeeSummaryController.attendanceSummary.bind(analyticsEmployeeSummaryController))

// 销售预测 API - 基于历史数据预测具体型号+颜色+内存组合的销售趋势
router.get('/sales-forecast', unifiedAuth, requireBusinessUser, analyticsSalesForecastController.getForecast.bind(analyticsSalesForecastController))


module.exports = router
