/**
 * 数据检查路由
 * 用于检查和管理基础数据的重复问题
 */
const express = require('express')
const router = express.Router()
const DataCheckController = require('../controllers/data-check.controller')
const { unifiedAuth, requirePermission } = require('../middleware/unified-auth')

// 实例化控制器
const dataCheckController = new DataCheckController()

// 应用认证中间件
router.use(unifiedAuth)

/**
 * 数据检查接口
 */
router.get('/check/brands', requirePermission('data-check:view'), dataCheckController.checkBrands.bind(dataCheckController))

router.get('/check/models', requirePermission('data-check:view'), dataCheckController.checkModels.bind(dataCheckController))

router.get('/check/colors', requirePermission('data-check:view'), dataCheckController.checkColors.bind(dataCheckController))

router.get('/check/memories', requirePermission('data-check:view'), dataCheckController.checkMemories.bind(dataCheckController))

router.get('/check/suppliers', requirePermission('data-check:view'), dataCheckController.checkSuppliers.bind(dataCheckController))

router.get('/check/stores', requirePermission('data-check:view'), dataCheckController.checkStores.bind(dataCheckController))

router.get('/check/customers', requirePermission('data-check:view'), dataCheckController.checkCustomers.bind(dataCheckController))

router.get('/check/users', requirePermission('data-check:view'), dataCheckController.checkUsers.bind(dataCheckController))

router.get('/check/all', requirePermission('data-check:view'), dataCheckController.checkAll.bind(dataCheckController))

/**
 * 数据操作接口
 */
router.post('/merge', requirePermission('data-check:edit'), dataCheckController.mergeDuplicates.bind(dataCheckController))

router.post('/batch-merge', requirePermission('data-check:edit'), dataCheckController.batchMergeMultipleGroups.bind(dataCheckController))

router.post('/batch-delete', requirePermission('data-check:delete'), dataCheckController.batchDeleteDuplicates.bind(dataCheckController))

router.put('/edit/:type/:id', requirePermission('data-check:edit'), dataCheckController.editData.bind(dataCheckController))

router.delete('/delete/:type/:id', requirePermission('data-check:delete'), dataCheckController.deleteData.bind(dataCheckController))

/**
 * 数据统计和清理
 */
router.get('/statistics', requirePermission('data-check:view'), dataCheckController.getStatistics.bind(dataCheckController))

router.post('/cleanup', requirePermission('data-check:edit'), dataCheckController.cleanupData.bind(dataCheckController))

/**
 * 获取所有数据（含重复状态标记）
 */
router.get('/all/:type', requirePermission('data-check:view'), dataCheckController.getAllData.bind(dataCheckController))

module.exports = router
