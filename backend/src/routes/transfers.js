const express = require('express');
const router = express.Router();
const TransferController = require('../controllers/transfer.controller');
const { unifiedAuth, requirePermission } = require('../middleware/unified-auth');

// 实例化控制器
const transferController = new TransferController();

// 所有路由都需要身份验证
router.use(unifiedAuth);

/**
 * @route POST /api/transfers/wholesale
 * @desc 批发给同行
 * @access Private
 * @permission sales:edit 或 inventory:edit
 * 场景：自己批发给同行，产生货款，计算利润
 */
router.post('/wholesale',
  (req, res, next) => {
    // 放行，在控制器中进行权限检查
    next();
  },
  transferController.wholesaleToPeer.bind(transferController)
);

/**
 * @route POST /api/transfers/proxy
 * @desc 代供应商划拨
 * @access Private
 * @permission sales:edit 或 inventory:edit
 * 场景：代供应商把手机划拨给其客户，不产生货款，不计算利润
 */
router.post('/proxy',
  (req, res, next) => {
    // 放行，在控制器中进行权限检查
    next();
  },
  transferController.proxyTransferForSupplier.bind(transferController)
);

/**
 * @route GET /api/transfers/records
 * @desc 获取批发/划拨记录列表
 * @access Private
 * @permission inventory:view
 */
router.get('/records',
  requirePermission('inventory:view', 'business'),
  transferController.getTransferRecords.bind(transferController)
);

/**
 * @route GET /api/transfers/statistics
 * @desc 获取批发/划拨统计
 * @access Private
 * @permission inventory:view
 */
router.get('/statistics',
  requirePermission('inventory:view', 'business'),
  transferController.getTransferStatistics.bind(transferController)
);

module.exports = router;
