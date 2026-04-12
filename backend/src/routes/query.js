const express = require('express');
const router = express.Router();
const QueryController = require('../controllers/query.controller');
const { unifiedAuth, requirePermission, requireAnyPermission } = require('../middleware/unified-auth');
const { cacheMiddleware } = require('../middleware/cache');

// 实例化控制器
const queryController = new QueryController();

// 所有路由都需要身份验证
router.use(unifiedAuth);

/**
 * @route GET /api/query/comprehensive
 * @desc 综合查询手机数据
 * @access Private
 * @param {Object} query - 查询参数
 * @param {string} query.page - 页码
 * @param {string} query.limit - 每页数量
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
router.get('/comprehensive', requirePermission('query:view', 'business'), cacheMiddleware({ ttl: 10 * 1000 }), queryController.getComprehensiveQuery.bind(queryController));

/**
 * @route GET /api/query/statistics
 * @desc 获取统计信息
 * @access Private
 * @param {Object} query - 统计参数
 */
router.get('/statistics', requirePermission('query:view', 'business'), cacheMiddleware({ ttl: 0 }), queryController.getStatistics.bind(queryController));

/**
 * @route GET /api/query/returngoods
 * @desc 获取退库记录列表
 * @access Private
 */
router.get('/returngoods', requirePermission('return-goods:view'), cacheMiddleware({ ttl: 0 }), queryController.getReturnGoodsRecords.bind(queryController));
router.put('/returngoods/:id', requirePermission('return-goods:edit'), queryController.updateReturnGoodsRecord.bind(queryController));
router.delete('/returngoods/:id', requirePermission('return-goods:delete'), queryController.deleteReturnGoodsRecord.bind(queryController));

/**
 * @route GET /api/query/options
 * @desc 获取查询选项数据
 * @access Private
 */
router.get('/options', requirePermission('query:view', 'business'), cacheMiddleware({ ttl: 1000 }), queryController.getQueryOptions.bind(queryController));

/**
 * @route POST /api/query/batch
 * @desc 批量操作
 * @access Private
 * @param {Object} body - 批量操作参数
 * @param {string} body.operation - 操作类型 (reverse_sale, delete)
 * @param {Array} body.phone_ids - 手机ID列表
 */
router.post('/batch', requirePermission('query:edit', 'business'), queryController.batchOperations.bind(queryController));

/**
 * @route GET /api/query/export/excel
 * @desc 导出Excel
 * @access Private
 * @param {Object} query - 导出参数
 */
router.get('/export/excel', requirePermission('query:export', 'business'), queryController.exportToExcel.bind(queryController));

/**
 * @route GET /api/query/phone/:id
 * @desc 根据ID获取手机详情
 * @access Private
 * @param {string} params.id - 手机ID
 */
router.get('/phone/:id', requirePermission('query:view', 'business'), queryController.getPhoneDetail.bind(queryController));


/**
 * @route POST /api/query/:id/return-to-stock
 * @desc 退库操作 - 删除购买信息，恢复库存状态
 * @access Private
 * @param {string} params.id - 手机ID
 */
router.post('/:id/return-to-stock', requirePermission('query:return-to-stock', 'business'), queryController.returnToStock.bind(queryController));

/**
 * @route DELETE /api/query/:id
 * @desc 删除手机记录
 * @access Private
 * @param {string} params.id - 手机ID
 */
router.delete('/:id', requirePermission('inventory:delete', 'business'), queryController.deletePhoneRecord.bind(queryController));

/**
 * @route DELETE /api/query/cache
 * @desc 清除查询缓存
 * @access Private
 */
router.delete('/cache', (req, res) => {
  try {
    const { clearCache } = require('../middleware/cache');
    clearCache('comprehensive');
    res.json({ success: true, message: '查询缓存已清除' });
  } catch (error) {
    res.status(500).json({ success: false, message: '清除缓存失败', error: error.message });
  }
});

module.exports = router;
