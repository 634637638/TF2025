/**
 * 价目表路由
 */
const express = require('express')
const router = express.Router()
const multer = require('multer')
const priceListController = require('../controllers/price-list.controller')
const { unifiedAuth, requirePermission } = require('../middleware/unified-auth')

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024
  },
  fileFilter: (_req, file, cb) => {
    if (
      file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      file.mimetype === 'application/vnd.ms-excel'
    ) {
      cb(null, true)
    } else {
      cb(new Error('只支持 Excel 文件格式'), false)
    }
  }
})

// ==================== 管理接口（需要登录和权限）====================

/**
 * @route   GET /api/price-list
 * @desc    获取价格列表（管理端）
 * @access  Private
 */
router.get('/', unifiedAuth, requirePermission('price-list:view'), priceListController.getPriceList)

/**
 * @route   GET /api/price-list/export
 * @desc    导出价格列表
 * @access  Private
 */
router.get('/export', unifiedAuth, requirePermission('price-list:export'), priceListController.exportPriceList)

/**
 * @route   POST /api/price-list/import
 * @desc    导入价格列表
 * @access  Private
 */
router.post('/import', unifiedAuth, requirePermission('price-list:import'), upload.single('file'), priceListController.importPriceList)

/**
 * @route   POST /api/price-list
 * @desc    创建/更新价格记录
 * @access  Private
 */
router.post('/', unifiedAuth, requirePermission('price-list:edit'), priceListController.upsertPriceItem)

/**
 * @route   PUT /api/price-list/batch-source
 * @desc    批量设置价格记录的采集来源
 * @access  Private
 */
router.put('/batch-source', unifiedAuth, requirePermission('price-list:edit'), priceListController.batchUpdatePriceSource)

/**
 * @route   DELETE /api/price-list/:id
 * @desc    删除价格记录
 * @access  Private
 */
router.delete('/:id', unifiedAuth, requirePermission('price-list:delete'), priceListController.deletePriceItem)

/**
 * @route   POST /api/price-list/migrate
 * @desc    数据库迁移：已废弃，表已是新结构
 * @access  Private
 */
router.post('/migrate', unifiedAuth, requirePermission('price-list:edit'), priceListController.acknowledgeMigration)

// ==================== 同步配置接口（必须在 /:id 之前定义）====================

/**
 * @route   GET /api/price-list/sync/configs
 * @desc    获取所有同步配置列表
 * @access  Private
 */
router.get('/sync/configs', unifiedAuth, requirePermission('price-list:view'), priceListController.getAllSyncConfigs)

/**
 * @route   POST /api/price-list/sync/configs
 * @desc    创建新的同步配置
 * @access  Private
 */
router.post('/sync/configs', unifiedAuth, requirePermission('price-list:edit'), priceListController.createSyncConfig)

/**
 * @route   GET /api/price-list/sync/config
 * @desc    获取默认同步配置
 * @access  Private
 */
router.get('/sync/config', unifiedAuth, requirePermission('price-list:view'), priceListController.getSyncConfig)

/**
 * @route   PUT /api/price-list/sync/config
 * @desc    更新默认同步配置
 * @access  Private
 */
router.put('/sync/config', unifiedAuth, requirePermission('price-list:edit'), priceListController.updateSyncConfig)

/**
 * @route   PUT /api/price-list/sync/config/:configId/default
 * @desc    设置默认同步配置
 * @access  Private
 */
router.put('/sync/config/:configId/default', unifiedAuth, requirePermission('price-list:edit'), priceListController.setDefaultSyncConfig)

/**
 * @route   GET /api/price-list/sync/config/:configId
 * @desc    获取指定ID的同步配置详情（密码永不回显）
 * @access  Private
 */
router.get('/sync/config/:configId', unifiedAuth, requirePermission('price-list:view'), priceListController.getSyncConfigById)

/**
 * @route   PUT /api/price-list/sync/config/:configId
 * @desc    更新指定ID的同步配置
 * @access  Private
 */
router.put('/sync/config/:configId', unifiedAuth, requirePermission('price-list:edit'), priceListController.updateSyncConfigById)

/**
 * @route   DELETE /api/price-list/sync/config/:configId
 * @desc    删除同步配置
 * @access  Private
 */
router.delete('/sync/config/:configId', unifiedAuth, requirePermission('price-list:delete'), priceListController.deleteSyncConfig)

/**
 * @route   POST /api/price-list/sync/trigger
 * @desc    手动触发同步
 * @access  Private
 */
router.post('/sync/trigger', unifiedAuth, requirePermission('price-list:sync'), priceListController.triggerSync)

/**
 * @route   GET /api/price-list/check-iphone16
 * @desc    检查iPhone 16的采集状态
 * @access  Private
 */
router.get('/check-iphone16', unifiedAuth, requirePermission('price-list:view'), priceListController.checkIphone16)

/**
 * @route   POST /api/price-list/update-iphone16-is-collect
 * @desc    批量更新iPhone 16的采集状态
 * @access  Private
 */
router.post('/update-iphone16-is-collect', unifiedAuth, requirePermission('price-list:edit'), priceListController.updateIphone16Collection)

/**
 * @route   GET /api/price-list/sync/logs
 * @desc    获取同步日志
 * @access  Private
 */
router.get('/sync/logs', unifiedAuth, requirePermission('price-list-sync-logs:view'), priceListController.getSyncLogs)

/**
 * @route   GET /api/price-list/sync/logs/statistics
 * @desc    获取同步日志统计
 * @access  Private
 */
router.get('/sync/logs/statistics', unifiedAuth, requirePermission('price-list-sync-logs:view'), priceListController.getSyncLogStatistics)

/**
 * @route   DELETE /api/price-list/sync/logs/:id
 * @desc    删除同步日志
 * @access  Private
 */
router.delete('/sync/logs/:id', unifiedAuth, requirePermission('price-list-sync-logs:delete'), priceListController.deleteSyncLog)

/**
 * @route   DELETE /api/price-list/sync/logs
 * @desc    清空同步日志
 * @access  Private
 */
router.delete('/sync/logs', unifiedAuth, requirePermission('price-list-sync-logs:delete'), priceListController.clearSyncLogs)

/**
 * @route   POST /api/price-list/fix-is-collect
 * @desc    修复 is_collect 状态（临时方法）
 * @access  Private
 */
router.post('/fix-is-collect', unifiedAuth, requirePermission('price-list:edit'), priceListController.fixIsCollect)

/**
 * @route   POST /api/price-list/clear-prices
 * @desc    一键清零所有采集价格
 * @access  Private
 */
router.post('/clear-prices', unifiedAuth, requirePermission('price-list:edit'), priceListController.clearPrices)

/**
 * @route   DELETE /api/price-list/history/all
 * @desc    清空所有价格历史记录
 * @access  Private
 */
router.delete('/history/all', unifiedAuth, requirePermission('price-list:delete'), priceListController.clearAllPriceHistory)

/**
 * @route   GET /api/price-list/history/trends
 * @desc    批量获取价格趋势
 * @access  Private
 */
router.get('/history/trends', unifiedAuth, requirePermission('price-list:view'), priceListController.getPriceHistoryTrends)

// ==================== 带ID参数的路由（必须放在最后）====================

/**
 * @route   GET /api/price-list/:id/history
 * @desc    获取价格历史
 * @access  Private
 */
router.get('/:id/history', unifiedAuth, requirePermission('price-list:view'), priceListController.getPriceHistory)

/**
 * @route   DELETE /api/price-list/:id/history/:historyId
 * @desc    删除单条价格历史记录
 * @access  Private
 */
router.delete('/:id/history/:historyId', unifiedAuth, requirePermission('price-list:delete'), priceListController.deletePriceHistory)

/**
 * @route   POST /api/price-list/:id/history/batch-delete
 * @desc    批量删除价格历史记录
 * @access  Private
 */
router.post('/:id/history/batch-delete', unifiedAuth, requirePermission('price-list:delete'), priceListController.batchDeletePriceHistory)

/**
 * @route   DELETE /api/price-list/:id/history
 * @desc    清空价格历史记录
 * @access  Private
 */
router.delete('/:id/history', unifiedAuth, requirePermission('price-list:delete'), priceListController.clearPriceHistory)

module.exports = router
