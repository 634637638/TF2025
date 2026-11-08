const express = require('express')
const router = express.Router()
const SystemManagementController = require('../controllers/system-management.controller')
const { unifiedAuth, requirePermission } = require('../middleware/unified-auth')

router.use(unifiedAuth)
const systemManagementController = new SystemManagementController()

/**
 * 初始化模块管理数据库
 */
router.post('/init-module-management', requirePermission('permissions:admin'), systemManagementController.initModuleManagement.bind(systemManagementController))

router.get('/verify-module-management', requirePermission('permissions:admin'), systemManagementController.verifyModuleManagement.bind(systemManagementController))

/**
 * 同步扫描发现的模块
 */
router.post('/sync-modules', requirePermission('permissions:admin'), systemManagementController.syncModules.bind(systemManagementController))

/**
 * 记录同步日志（module_sync_log表不存在，暂时记录到控制台）
 */
router.get('/sync-logs', requirePermission('permissions:admin'), systemManagementController.getSyncLogs.bind(systemManagementController))

module.exports = router
