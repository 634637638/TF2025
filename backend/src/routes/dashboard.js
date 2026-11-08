const express = require('express')
const router = express.Router()
const { unifiedAuth, requirePermission } = require('../middleware/unified-auth')
const DashboardController = require('../controllers/dashboard.controller')

const dashboardController = new DashboardController()

// 获取仪表盘数据
router.get('/', unifiedAuth, requirePermission('dashboard:view'), dashboardController.getDashboardData.bind(dashboardController))

// 获取最近活动
router.get('/activities', unifiedAuth, requirePermission('dashboard:view'), dashboardController.getActivities.bind(dashboardController))

/**
 * 获取综合预警信息
 * 包含：手机库存预警、配件库存预警、销售预警、入库预警
 * 查询参数：
 * - phone_threshold: 手机库存预警阈值（默认3）
 * - page_size: 返回数量限制（默认10）
 */
router.get('/warnings/comprehensive', unifiedAuth, requirePermission('dashboard:view'), dashboardController.getComprehensiveWarnings.bind(dashboardController))

/**
 * 获取手机库存预警
 * 按型号、颜色、内存分组，显示库存低于阈值的机型
 * 查询参数：
 * - threshold: 预警阈值（默认3）
 * - page_size: 返回数量限制（默认20）
 */
router.get('/warnings/phones', unifiedAuth, requirePermission('dashboard:view'), dashboardController.getPhoneStockWarnings.bind(dashboardController))

/**
 * 获取机型库存预警详情
 * 包含全新机/二手机数量、价格区间等信息
 * 查询参数：
 * - threshold: 预警阈值（默认3）
 */
router.get('/warnings/models', unifiedAuth, requirePermission('dashboard:view'), dashboardController.getModelStockWarnings.bind(dashboardController))

/**
 * 获取销售预警信息
 * 包含今日销售统计、近7天销售趋势
 */
router.get('/warnings/sales', unifiedAuth, requirePermission('dashboard:view'), dashboardController.getSalesWarnings.bind(dashboardController))

/**
 * 获取入库预警信息
 * 包含最近入库记录、长期未入库的供应商
 */
router.get('/warnings/purchases', unifiedAuth, requirePermission('dashboard:view'), dashboardController.getPurchaseWarnings.bind(dashboardController))

module.exports = router
