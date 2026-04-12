/**
 * 价目表路由
 */
const express = require('express');
const router = express.Router();
const multer = require('multer');
const priceListController = require('../controllers/price-list.controller');
const { unifiedAuth, requirePermission } = require('../middleware/unified-auth');
const log = require('../utils/log');

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
      cb(null, true);
    } else {
      cb(new Error('只支持 Excel 文件格式'), false);
    }
  }
});

// ==================== 管理接口（需要登录和权限）====================

/**
 * @route   GET /api/price-list
 * @desc    获取价格列表（管理端）
 * @access  Private
 */
router.get('/', unifiedAuth, requirePermission('price-list:view'), priceListController.getPriceList);

/**
 * @route   GET /api/price-list/export
 * @desc    导出价格列表
 * @access  Private
 */
router.get('/export', unifiedAuth, requirePermission('price-list:export'), priceListController.exportPriceList);

/**
 * @route   POST /api/price-list/import
 * @desc    导入价格列表
 * @access  Private
 */
router.post('/import', unifiedAuth, requirePermission('price-list:import'), upload.single('file'), priceListController.importPriceList);

/**
 * @route   POST /api/price-list
 * @desc    创建/更新价格记录
 * @access  Private
 */
router.post('/', unifiedAuth, requirePermission('price-list:edit'), priceListController.upsertPriceItem);

/**
 * @route   DELETE /api/price-list/:id
 * @desc    删除价格记录
 * @access  Private
 */
router.delete('/:id', unifiedAuth, requirePermission('price-list:delete'), priceListController.deletePriceItem);

/**
 * @route   POST /api/price-list/migrate
 * @desc    数据库迁移：已废弃，表已是新结构
 * @access  Private
 */
router.post('/migrate', unifiedAuth, requirePermission('price-list:edit'), (req, res) => {
  return res.json({ success: true, message: '表已是新结构，无需迁移', data: { results: [] } });
});

// ==================== 同步配置接口（必须在 /:id 之前定义）====================

/**
 * @route   GET /api/price-list/sync/configs
 * @desc    获取所有同步配置列表
 * @access  Private
 */
router.get('/sync/configs', unifiedAuth, requirePermission('price-list:view'), priceListController.getAllSyncConfigs);

/**
 * @route   POST /api/price-list/sync/configs
 * @desc    创建新的同步配置
 * @access  Private
 */
router.post('/sync/configs', unifiedAuth, requirePermission('price-list:edit'), priceListController.createSyncConfig);

/**
 * @route   GET /api/price-list/sync/config
 * @desc    获取默认同步配置
 * @access  Private
 */
router.get('/sync/config', unifiedAuth, requirePermission('price-list:view'), priceListController.getSyncConfig);

/**
 * @route   PUT /api/price-list/sync/config
 * @desc    更新默认同步配置
 * @access  Private
 */
router.put('/sync/config', unifiedAuth, requirePermission('price-list:edit'), priceListController.updateSyncConfig);

/**
 * @route   PUT /api/price-list/sync/config/:configId/default
 * @desc    设置默认同步配置
 * @access  Private
 */
router.put('/sync/config/:configId/default', unifiedAuth, requirePermission('price-list:edit'), priceListController.setDefaultSyncConfig);

/**
 * @route   GET /api/price-list/sync/config/:configId
 * @desc    获取指定ID的同步配置详情（包含密码，用于编辑）
 * @access  Private
 */
router.get('/sync/config/:configId', unifiedAuth, requirePermission('price-list:view'), priceListController.getSyncConfigById);

/**
 * @route   PUT /api/price-list/sync/config/:configId
 * @desc    更新指定ID的同步配置
 * @access  Private
 */
router.put('/sync/config/:configId', unifiedAuth, requirePermission('price-list:edit'), priceListController.updateSyncConfigById);

/**
 * @route   DELETE /api/price-list/sync/config/:configId
 * @desc    删除同步配置
 * @access  Private
 */
router.delete('/sync/config/:configId', unifiedAuth, requirePermission('price-list:delete'), priceListController.deleteSyncConfig);

/**
 * @route   POST /api/price-list/sync/trigger
 * @desc    手动触发同步
 * @access  Private
 */
router.post('/sync/trigger', unifiedAuth, requirePermission('price-list:edit'), priceListController.triggerSync);

/**
 * @route   GET /api/price-list/check-iphone16
 * @desc    检查iPhone 16的采集状态
 * @access  Private
 */
router.get('/check-iphone16', unifiedAuth, requirePermission('price-list:view'), async (req, res) => {
  try {
    const db = req.app.get('db');

    // 检查iPhone 16的状态
    const [records] = await db.query(`
      SELECT
        b.name as brand_name,
        m.name as model_number,
        c.name as color_name,
        mem.size as memory,
        COALESCE(pl.is_collect, 1) as is_collect,
        pl.id,
        pl.wholesale_price,
        pl.last_sync_time
      FROM price_list pl
      JOIN brands b ON pl.brand_id = b.id
      JOIN models m ON pl.model_id = m.id
      LEFT JOIN colors c ON pl.color_id = c.id
      LEFT JOIN memories mem ON pl.memory_id = mem.id
      WHERE m.name = 'iPhone 16'
      ORDER BY c.name, mem.size
    `);

    return res.json({
      success: true,
      message: `找到 ${records.length} 条iPhone 16记录`,
      data: records
    });
  } catch (error) {
    log.error('检查失败:', error);
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * @route   POST /api/price-list/update-iphone16-is-collect
 * @desc    批量更新iPhone 16的采集状态
 * @access  Private
 */
router.post('/update-iphone16-is-collect', unifiedAuth, requirePermission('price-list:edit'), async (req, res) => {
  try {
    const db = req.app.get('db');
    const { is_collect = 1 } = req.body;

    // 更新所有 iPhone 16 的 is_collect
    const [result] = await db.query(`
      UPDATE price_list pl
      JOIN models m ON pl.model_id = m.id
      SET pl.is_collect = ?
      WHERE m.name = 'iPhone 16'
    `, [is_collect]);

    // 查询更新后的记录
    const [records] = await db.query(`
      SELECT
        b.name as brand_name,
        m.name as model_number,
        c.name as color_name,
        mem.size as memory,
        COALESCE(pl.is_collect, 1) as is_collect,
        pl.id,
        pl.wholesale_price
      FROM price_list pl
      JOIN brands b ON pl.brand_id = b.id
      JOIN models m ON pl.model_id = m.id
      LEFT JOIN colors c ON pl.color_id = c.id
      LEFT JOIN memories mem ON pl.memory_id = mem.id
      WHERE m.name = 'iPhone 16'
      ORDER BY c.name, mem.size
    `);

    return res.json({
      success: true,
      message: `已更新 ${result.affectedRows} 条iPhone 16记录的采集状态为 ${is_collect}`,
      data: records
    });
  } catch (error) {
    log.error('更新失败:', error);
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * @route   POST /api/price-list/test-no-inventory
 * @desc    测试仅按 price_list 采集功能
 * @access  Private
 */
router.post('/test-no-inventory', unifiedAuth, requirePermission('price-list:edit'), async (req, res) => {
  try {
    const service = req.app.get('priceListService');

    if (!service) {
      return res.status(500).json({ success: false, message: '服务未初始化' });
    }

    // 模拟外部价格数据（iPhone 16）
    const externalPrices = new Map();
    externalPrices.set('苹果-iPhone 16', [
      { brand: '苹果', model: 'iPhone 16', modelCode: 'A3288', color: '白色', memory: '128GB', price: 4600 },
      { brand: '苹果', model: 'iPhone 16', modelCode: 'A3288', color: '白色', memory: '256GB', price: 5600 },
      { brand: '苹果', model: 'iPhone 16', modelCode: 'A3288', color: '粉色', memory: '128GB', price: 4580 },
      { brand: '苹果', model: 'iPhone 16', modelCode: 'A3288', color: '粉色', memory: '256GB', price: 5450 }
    ]);

    // 模拟有其他库存（但不是iPhone 16）
    const inventoryItems = [
      { brand_name: '苹果', model_number: '11 Pro', color_name: '白色', memory: '128GB' }
    ];

    log.debug('🧪 测试按 price_list 采集功能...');
    log.debug('📦 传入商品:', inventoryItems);
    log.debug('📊 外部价格:', externalPrices.size, '个组合');

    // 调用匹配函数
    const syncTime = new Date().toISOString();
    const result = await service.matchInventoryWithPrices(
      inventoryItems,
      externalPrices,
      syncTime
    );

    return res.json({
      success: true,
      message: '测试完成',
      data: result
    });
  } catch (error) {
    log.error('测试失败:', error);
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * @route   GET /api/price-list/sync/logs
 * @desc    获取同步日志
 * @access  Private
 */
router.get('/sync/logs', unifiedAuth, requirePermission('price-list:view'), priceListController.getSyncLogs);

/**
 * @route   DELETE /api/price-list/sync/logs/:id
 * @desc    删除同步日志
 * @access  Private
 */
router.delete('/sync/logs/:id', unifiedAuth, requirePermission('price-list:delete'), priceListController.deleteSyncLog);

/**
 * @route   DELETE /api/price-list/sync/logs
 * @desc    清空同步日志
 * @access  Private
 */
router.delete('/sync/logs', unifiedAuth, requirePermission('price-list:delete'), priceListController.clearSyncLogs);

/**
 * @route   POST /api/price-list/fix-is-collect
 * @desc    修复 is_collect 状态（临时方法）
 * @access  Private
 */
router.post('/fix-is-collect', unifiedAuth, requirePermission('price-list:edit'), priceListController.fixIsCollect);

/**
 * @route   POST /api/price-list/clear-prices
 * @desc    一键清零所有采集价格
 * @access  Private
 */
router.post('/clear-prices', unifiedAuth, requirePermission('price-list:edit'), priceListController.clearPrices);

/**
 * @route   DELETE /api/price-list/history/all
 * @desc    清空所有价格历史记录
 * @access  Private
 */
router.delete('/history/all', unifiedAuth, requirePermission('price-list:delete'), priceListController.clearAllPriceHistory);

// ==================== 带ID参数的路由（必须放在最后）====================

/**
 * @route   GET /api/price-list/:id/history
 * @desc    获取价格历史
 * @access  Private
 */
router.get('/:id/history', unifiedAuth, requirePermission('price-list:view'), priceListController.getPriceHistory);

/**
 * @route   DELETE /api/price-list/:id/history/:historyId
 * @desc    删除单条价格历史记录
 * @access  Private
 */
router.delete('/:id/history/:historyId', unifiedAuth, requirePermission('price-list:delete'), priceListController.deletePriceHistory);

/**
 * @route   POST /api/price-list/:id/history/batch-delete
 * @desc    批量删除价格历史记录
 * @access  Private
 */
router.post('/:id/history/batch-delete', unifiedAuth, requirePermission('price-list:delete'), priceListController.batchDeletePriceHistory);

/**
 * @route   DELETE /api/price-list/:id/history
 * @desc    清空价格历史记录
 * @access  Private
 */
router.delete('/:id/history', unifiedAuth, requirePermission('price-list:delete'), priceListController.clearPriceHistory);

module.exports = router;
