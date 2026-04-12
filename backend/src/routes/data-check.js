/**
 * 数据检查路由
 * 用于检查和管理基础数据的重复问题
 */
const express = require('express');
const router = express.Router();
const DataCheckController = require('../controllers/data-check.controller');
const { unifiedAuth, requirePermission } = require('../middleware/unified-auth');

// 实例化控制器
const dataCheckController = new DataCheckController();

// 应用认证中间件
router.use(unifiedAuth);

/**
 * 数据检查接口
 */
router.get('/check/brands', requirePermission('data-check:view'), (req, res) => {
  dataCheckController.checkBrands(req, res);
});

router.get('/check/models', requirePermission('data-check:view'), (req, res) => {
  dataCheckController.checkModels(req, res);
});

router.get('/check/colors', requirePermission('data-check:view'), (req, res) => {
  dataCheckController.checkColors(req, res);
});

router.get('/check/memories', requirePermission('data-check:view'), (req, res) => {
  dataCheckController.checkMemories(req, res);
});

router.get('/check/suppliers', requirePermission('data-check:view'), (req, res) => {
  dataCheckController.checkSuppliers(req, res);
});

router.get('/check/stores', requirePermission('data-check:view'), (req, res) => {
  dataCheckController.checkStores(req, res);
});

router.get('/check/customers', requirePermission('data-check:view'), (req, res) => {
  dataCheckController.checkCustomers(req, res);
});

router.get('/check/users', requirePermission('data-check:view'), (req, res) => {
  dataCheckController.checkUsers(req, res);
});

router.get('/check/all', requirePermission('data-check:view'), (req, res) => {
  dataCheckController.checkAll(req, res);
});

/**
 * 数据操作接口
 */
router.post('/merge', requirePermission('data-check:edit'), (req, res) => {
  dataCheckController.mergeDuplicates(req, res);
});

router.post('/batch-merge', requirePermission('data-check:edit'), (req, res) => {
  dataCheckController.batchMergeMultipleGroups(req, res);
});

router.post('/batch-delete', requirePermission('data-check:delete'), (req, res) => {
  dataCheckController.batchDeleteDuplicates(req, res);
});

router.put('/edit/:type/:id', requirePermission('data-check:edit'), (req, res) => {
  dataCheckController.editData(req, res);
});

router.delete('/delete/:type/:id', requirePermission('data-check:delete'), (req, res) => {
  dataCheckController.deleteData(req, res);
});

/**
 * 数据统计和清理
 */
router.get('/statistics', requirePermission('data-check:view'), (req, res) => {
  dataCheckController.getStatistics(req, res);
});

router.post('/cleanup', requirePermission('data-check:edit'), (req, res) => {
  dataCheckController.cleanupData(req, res);
});

/**
 * 获取所有数据（含重复状态标记）
 */
router.get('/all/:type', requirePermission('data-check:view'), (req, res) => {
  dataCheckController.getAllData(req, res);
});

module.exports = router;
