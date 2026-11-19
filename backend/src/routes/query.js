const express = require('express')
const router = express.Router()
const QueryController = require('../controllers/query.controller')
const QueryGoodsController = require('../controllers/query-goods.controller')
const FilmServiceController = require('../controllers/film-service.controller')
const SalesCheckoutController = require('../controllers/sales-checkout.controller')
const AccessoryController = require('../controllers/accessory.controller')
const { unifiedAuth, requirePermission, requireAnyPermission } = require('../middleware/unified-auth')
const { cacheMiddleware } = require('../middleware/cache')
const { CACHE_TTL } = require('../config/constants')

// 实例化控制器
const queryController = new QueryController()
const queryGoodsController = new QueryGoodsController()
const filmServiceController = new FilmServiceController()
const salesCheckoutController = new SalesCheckoutController()
const accessoryController = new AccessoryController()

// 所有路由都需要身份验证
router.use(unifiedAuth)

router.get('/customers/:customerId/film-services', requirePermission('query:view'), requirePermission('query:film'),
  filmServiceController.context.bind(filmServiceController))

// 贴膜能力与商品管理菜单隔离；服务内重新校验客户、设备、适配商品及门店库存。
router.get('/customers/:customerId/film-services/products', requirePermission('query:view'), requirePermission('query:film'), filmServiceController.products.bind(filmServiceController))
router.get('/customers/:customerId/film-services/customer-summary', requirePermission('query:view'), requirePermission('query:film'), salesCheckoutController.filmCustomerSummary.bind(salesCheckoutController))
router.post('/film-services/checkout/quote', requirePermission('query:view'), requirePermission('query:film'), salesCheckoutController.filmQuote.bind(salesCheckoutController))
router.post('/film-services/checkout', requirePermission('query:view'), requirePermission('query:film'), salesCheckoutController.filmCheckout.bind(salesCheckoutController))

router.get('/goods/sale-options', requirePermission('query:view'), requirePermission('query:goods-view'), requireAnyPermission(['query:goods-sell', 'query:goods-gift', 'accessories:sell', 'accessories:gift']), accessoryController.querySaleOptions.bind(accessoryController))
router.get('/goods/filter-options', requirePermission('query:view'), requirePermission('query:goods-view'), queryGoodsController.filterOptions.bind(queryGoodsController))
router.get('/goods/product-name-options', requirePermission('query:view'), requirePermission('query:goods-view'), queryGoodsController.productNameOptions.bind(queryGoodsController))

// 复用原结算事务与动作权限；字段明确归综合查询商品模式。
router.get('/goods/checkout/customer-summary', requirePermission('query:view'), requirePermission('query:goods-view'), requireAnyPermission(['query:goods-sell', 'query:goods-gift']), salesCheckoutController.queryGoodsSummary.bind(salesCheckoutController))
router.post('/goods/checkout/quote', requirePermission('query:view'), requirePermission('query:goods-view'), requireAnyPermission(['query:goods-sell', 'query:goods-gift']), salesCheckoutController.queryGoodsQuote.bind(salesCheckoutController))
router.post('/goods/checkout', requirePermission('query:view'), requirePermission('query:goods-view'), requireAnyPermission(['query:goods-sell', 'query:goods-gift']), salesCheckoutController.queryGoodsCheckout.bind(salesCheckoutController))

router.get('/goods', requirePermission('query:view'), requirePermission('query:goods-view'), queryGoodsController.list.bind(queryGoodsController))
router.get('/customers/:customerId/goods', requirePermission('customers:view'), requirePermission('query:view'), requirePermission('query:goods-view'), queryGoodsController.customerHistory.bind(queryGoodsController))
router.get('/goods/:id', requirePermission('query:view'), requirePermission('query:goods-view'), queryGoodsController.detail.bind(queryGoodsController))
router.get('/goods/:id/order', requirePermission('query:view'), requirePermission('query:goods-view'), queryGoodsController.goodsOrder.bind(queryGoodsController))
router.get('/sales/:saleId/order', requirePermission('query:view'), requirePermission('query:goods-view'), queryGoodsController.phoneOrder.bind(queryGoodsController))
router.get('/goods/:id/aftersales', requirePermission('query:view'), requirePermission('query:goods-view'), queryGoodsController.aftersales.bind(queryGoodsController))
router.get('/sales/:saleId/accessories', requirePermission('query:view'), requirePermission('query:goods-view'), queryGoodsController.phoneReceipt.bind(queryGoodsController))

/**
 * @route GET /api/query/comprehensive
 * @desc 综合查询手机数据
 * @access Private
 * @param {Object} query - 查询参数
 * @param {string} query.page - 页码
 * @param {string} query.page_size - 每页数量（规范字段）
 * @param {string} query.supplier_id - 供应商ID
 * @param {string} query.store_id - 店铺ID
 * @param {string} query.brand - 品牌
 * @param {string} query.model - 型号
 * @param {string} query.color - 颜色
 * @param {string} query.memory - 内存
 * @param {string} query.status - 状态
 * @param {string} query.is_new - 是否全新
 * @param {string} query.sale_operator_id - 销售员ID
 * @param {string} query.start_date - 开始日期
 * @param {string} query.end_date - 结束日期
 * @param {string} query.search_term - 搜索关键词
 * @param {string} query.sort_field - 排序字段
 * @param {string} query.sort_order - 排序方向
 */
router.get('/comprehensive', requirePermission('query:view', 'business'), cacheMiddleware({ ttl: CACHE_TTL.SHORT }), queryController.getComprehensiveQuery.bind(queryController))

/**
 * @route GET /api/query/statistics
 * @desc 获取统计信息
 * @access Private
 * @param {Object} query - 统计参数
 * @param {string} query.search_term - 与综合查询列表相同的关键词条件
 */
router.get('/statistics', requirePermission('query:view', 'business'), cacheMiddleware({ ttl: CACHE_TTL.DISABLED }), queryController.getStatistics.bind(queryController))

/**
 * @route GET /api/query/returngoods
 * @desc 获取退库记录列表
 * @access Private
 */
router.get('/returngoods', requirePermission('return-goods:view'), cacheMiddleware({ ttl: CACHE_TTL.DISABLED }), queryController.getReturnGoodsRecords.bind(queryController))
router.put('/returngoods/:id', requirePermission('return-goods:edit'), queryController.rejectHiddenReturnGoodsWrites(), queryController.updateReturnGoodsRecord.bind(queryController))
router.delete('/returngoods/:id', requirePermission('return-goods:delete'), queryController.deleteReturnGoodsRecord.bind(queryController))

/**
 * @route GET /api/query/options
 * @desc 获取查询选项数据
 * @access Private
 */
router.get('/options', requirePermission('query:view', 'business'), cacheMiddleware({ ttl: CACHE_TTL.NEAR_REALTIME }), queryController.getQueryOptions.bind(queryController))

/**
 * @route POST /api/query/batch
 * @desc 批量操作
 * @access Private
 * @param {Object} body - 批量操作参数
 * @param {string} body.operation - 操作类型 (reverse_sale, delete)
 * @param {Array} body.phone_ids - 手机ID列表
 */
router.post('/batch', requirePermission('query:edit', 'business'), queryController.batchOperations.bind(queryController))

/**
 * @route GET /api/query/export/excel
 * @desc 导出Excel
 * @access Private
 * @param {Object} query - 导出参数
 */
router.get('/export/excel', requirePermission('query:export', 'business'), queryController.exportToExcel.bind(queryController))

/**
 * @route GET /api/query/phone/:id
 * @desc 根据ID获取手机详情
 * @access Private
 * @param {string} params.id - 手机ID
 */
router.get('/phone/:id', requirePermission('query:view', 'business'), queryController.getPhoneDetail.bind(queryController))

/**
 * @route DELETE /api/query/cache
 * @desc 清除查询缓存
 * @access Private
 */
router.delete('/cache', requirePermission('query:view', 'business'), queryController.clearQueryCache.bind(queryController))


/**
 * @route POST /api/query/:id/return-to-stock
 * @desc 退库操作 - 删除购买信息，恢复库存状态
 * @access Private
 * @param {string} params.id - 手机ID
 */
router.post('/:id/return-to-stock', requirePermission('query:return-to-stock', 'business'), queryController.returnToStock.bind(queryController))

/**
 * @route DELETE /api/query/:id
 * @desc 删除手机记录
 * @access Private
 * @param {string} params.id - 手机ID
 */
router.delete('/:id', requirePermission('query:delete', 'business'), queryController.deletePhoneRecord.bind(queryController))

module.exports = router
