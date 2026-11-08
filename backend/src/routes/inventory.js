const express = require('express')
const router = express.Router()
const { unifiedAuth, requirePermission } = require('../middleware/unified-auth')
const InventoryController = require('../controllers/inventory.controller')

const inventoryController = new InventoryController()

router.get('/list', unifiedAuth, requirePermission('inventory:view'), inventoryController.list.bind(inventoryController))

// 获取库存统计信息
router.get('/stats/overview', unifiedAuth, requirePermission('inventory:view'), inventoryController.overview.bind(inventoryController))

/**
 * 获取库存统计数据
 * 注意：此路由必须放在 /:id 路由之前，否则 'stats' 会被当作 id 参数处理
 */
router.get('/stats', unifiedAuth, requirePermission('inventory:view'), inventoryController.stats.bind(inventoryController))

// 获取单个库存详情
router.get('/:id', unifiedAuth, requirePermission('inventory:view'), inventoryController.detail.bind(inventoryController))

// 更新库存商品信息
router.put('/:id', unifiedAuth, requirePermission('inventory:edit'), inventoryController.update.bind(inventoryController))

// 删除库存商品
router.delete('/:id', unifiedAuth, requirePermission('inventory:delete'), inventoryController.remove.bind(inventoryController))

const requireQuickSalePermission = (req, res, next) => {
  const permissionByStatus = {
    sold: ['inventory:sell', 'system'],
    peer_transfer: ['sales:wholesale', 'business'],
    supplier_proxy: ['sales:proxy-transfer', 'business']
  }
  const requirement = permissionByStatus[req.body?.status || 'sold']
  if (!requirement) return next()
  return requirePermission(...requirement)(req, res, next)
}

// 快速出库按交易类型校验权限，业务事务由 controller 处理。
router.post('/quick-sale', unifiedAuth, requireQuickSalePermission, inventoryController.quickSale.bind(inventoryController))

// 添加根路由，重定向到 /list
router.get('/', unifiedAuth, requirePermission('inventory:view'), inventoryController.index.bind(inventoryController))

module.exports = router
