const express = require('express')
const router = express.Router()
const { unifiedAuth, requirePermission, requireAnyPermission } = require('../middleware/unified-auth')
const SalesCustomerSearchController = require('../controllers/sales-customer-search.controller')
const SalesCustomerPhoneController = require('../controllers/sales-customer-phone.controller')
const SalesStatsController = require('../controllers/sales-stats.controller')
const SalesAvailablePhonesController = require('../controllers/sales-available-phones.controller')
const SalesInventoryReportController = require('../controllers/sales-inventory-report.controller')
const SalesPhoneController = require('../controllers/sales-phone.controller')
const SalesCheckoutController = require('../controllers/sales-checkout.controller')
const SalesAftersaleController = require('../controllers/sales-aftersale.controller')
const SalesAvailablePhonesService = require('../services/sales-available-phones.service')
const salesCustomerSearchController = new SalesCustomerSearchController()
const salesCustomerPhoneController = new SalesCustomerPhoneController()
const salesStatsController = new SalesStatsController()
const salesAvailablePhonesService = new SalesAvailablePhonesService()
const salesAvailablePhonesController = new SalesAvailablePhonesController({ service: salesAvailablePhonesService })
const salesInventoryReportController = new SalesInventoryReportController()
const salesPhoneController = new SalesPhoneController()
const salesCheckoutController = new SalesCheckoutController()
const salesAftersaleController = new SalesAftersaleController()

// 业务表单只读取客户候选，不授予客户管理查看或档案写入。
const requireCustomerSearchPermission = requireAnyPermission([
  'sales:view', 'sales:sell', 'inventory:sell', 'sales:wholesale', 'sales:proxy-transfer',
  'query:edit', 'accessories:sell', 'accessories:gift', 'query:goods-sell', 'query:goods-gift',
  'preorders:create', 'preorders:edit'
])

// 获取可销售手机列表
router.get('/phones/available', unifiedAuth, requirePermission('sales:view'), salesAvailablePhonesController.getAvailablePhones.bind(salesAvailablePhonesController))

router.get('/phones/available/export', unifiedAuth, requirePermission('sales:export'), salesAvailablePhonesController.exportAvailablePhones.bind(salesAvailablePhonesController))

// 手机销售出库（支持单个和批量销售）
// 预定设备从销售、库存或预定页面均可出库；统一使用 sales:create 权限。
// 预定客户、匹配设备和预定状态仍在事务内严格校验，不能通过权限放宽绕过绑定关系。
router.post('/phone', unifiedAuth, requireAnyPermission(['sales:sell', 'inventory:sell']), salesPhoneController.sell.bind(salesPhoneController))

// 服务内按实际明细再次核验手机、收费商品和赠品权限；同一请求事务提交。
router.post('/checkout/quote', unifiedAuth, requireAnyPermission(['sales:sell', 'inventory:sell', 'accessories:sell', 'accessories:gift', 'query:goods-sell', 'query:goods-gift']), salesCheckoutController.quote.bind(salesCheckoutController))
router.get('/checkout/customer-summary', unifiedAuth, requireAnyPermission(['accessories:view', 'query:goods-view']), requireAnyPermission(['accessories:sell', 'accessories:gift', 'query:goods-sell', 'query:goods-gift']), salesCheckoutController.customerSummary.bind(salesCheckoutController))
router.post('/checkout', unifiedAuth, requireAnyPermission(['sales:sell', 'inventory:sell', 'accessories:sell', 'accessories:gift', 'query:goods-sell', 'query:goods-gift']), salesCheckoutController.checkout.bind(salesCheckoutController))
router.get('/checkout/phones/:phoneId/return-checklist', unifiedAuth, requirePermission('query:view'), requirePermission('query:return-to-stock'), salesAftersaleController.returnChecklist.bind(salesAftersaleController))
router.get('/checkout/:orderId/phones/:saleId/return-checklist', unifiedAuth, requirePermission('query:view'), requirePermission('query:return-to-stock'), salesAftersaleController.returnChecklist.bind(salesAftersaleController))
router.post('/checkout/:orderId/phones/:saleId/return/quote', unifiedAuth, requirePermission('query:view'), requirePermission('query:return-to-stock'), salesAftersaleController.quotePhoneReturn.bind(salesAftersaleController))
router.post('/checkout/:orderId/phones/:saleId/return', unifiedAuth, requirePermission('query:view'), requirePermission('query:return-to-stock'), salesAftersaleController.submitPhoneReturn.bind(salesAftersaleController))
router.get('/checkout/:orderId/items/:itemId/return', unifiedAuth, requirePermission('query:view'), requirePermission('query:return-to-stock'), requirePermission('query:goods-view'), salesAftersaleController.goodsReturnContext.bind(salesAftersaleController))
router.post('/checkout/:orderId/items/:itemId/return/quote', unifiedAuth, requirePermission('query:view'), requirePermission('query:return-to-stock'), requirePermission('query:goods-view'), salesAftersaleController.quoteGoodsReturn.bind(salesAftersaleController))
router.post('/checkout/:orderId/items/:itemId/return', unifiedAuth, requirePermission('query:view'), requirePermission('query:return-to-stock'), requirePermission('query:goods-view'), salesAftersaleController.submitGoodsReturn.bind(salesAftersaleController))
router.get('/checkout/:orderId/items/:itemId/exchange', unifiedAuth, requirePermission('query:view'), requirePermission('query:exchange'), requirePermission('query:goods-view'), salesAftersaleController.goodsExchangeContext.bind(salesAftersaleController))
router.post('/checkout/:orderId/items/:itemId/exchange/quote', unifiedAuth, requirePermission('query:view'), requirePermission('query:exchange'), requirePermission('query:goods-view'), salesAftersaleController.quoteGoodsExchange.bind(salesAftersaleController))
router.post('/checkout/:orderId/items/:itemId/exchange', unifiedAuth, requirePermission('query:view'), requirePermission('query:exchange'), requirePermission('query:goods-view'), salesAftersaleController.submitGoodsExchange.bind(salesAftersaleController))

// 获取销售统计
router.get('/stats', unifiedAuth, requirePermission('sales:view'), salesStatsController.getStats.bind(salesStatsController))

// 获取可销售手机统计数据（库存卡片统计）
router.get('/phones/available/stats', unifiedAuth, requirePermission('sales:view'), salesAvailablePhonesController.getStats.bind(salesAvailablePhonesController))

// 根据手机号查找客户
router.get('/customer/phone/:phone', unifiedAuth, requireCustomerSearchPermission, salesCustomerPhoneController.find.bind(salesCustomerPhoneController))

// 搜索客户（支持手机号和姓名搜索）
router.get('/customers', unifiedAuth, requireCustomerSearchPermission, salesCustomerSearchController.search.bind(salesCustomerSearchController))

// 库存统计表 - 按供应商、品牌、型号、颜色、内存、成色聚合统计
router.get('/inventory-summary', unifiedAuth, requirePermission('sales:view'), salesInventoryReportController.getSummary.bind(salesInventoryReportController))
/**
 * 获取库存明细（优化版 - 使用 ID 查询，避免 LIKE 模糊匹配）
 * GET /api/sales/inventory-detail
 * 查询参数: supplier_id, store_id, brand, model, color, memory, condition, page_size
 */
router.get('/inventory-detail', unifiedAuth, requirePermission('sales:view'), salesInventoryReportController.getDetail.bind(salesInventoryReportController))
module.exports = router
