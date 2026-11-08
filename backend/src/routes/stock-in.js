/**
 * 入库管理路由
 * 提供入库记录的增删改查功能
 */
const express = require('express')
const router = express.Router()
const { unifiedAuth, requirePermission, requireAnyPermission } = require('../middleware/unified-auth')
const StockInController = require('../controllers/stock-in.controller')

const stockInController = new StockInController()

// 获取入库记录列表
router.get('/', unifiedAuth, requirePermission('stock-in:view'), stockInController.list.bind(stockInController))

// 获取入库记录统计信息
router.get('/stats/overview', unifiedAuth, requirePermission('stock-in:view'), stockInController.overview.bind(stockInController))

// 获取单个入库记录详情
router.get('/:id', unifiedAuth, requirePermission('stock-in:view'), stockInController.detail.bind(stockInController))

// 创建入库记录
router.post('/', unifiedAuth, requireAnyPermission(['stock-in:create', 'inventory:create']), stockInController.create.bind(stockInController))

// 更新入库记录
router.put('/:id', unifiedAuth, requirePermission('stock-in:edit'), stockInController.update.bind(stockInController))

// 删除入库记录
router.delete('/:id', unifiedAuth, requirePermission('stock-in:delete'), stockInController.remove.bind(stockInController))

module.exports = router
