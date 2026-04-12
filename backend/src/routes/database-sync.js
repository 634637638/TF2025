/**
 * 数据库同步路由
 * 处理跨数据库数据同步的 API 端点
 */
const express = require('express');
const router = express.Router();
const controller = require('../controllers/database-sync.controller');
const { unifiedAuth } = require('../middleware/unified-auth');

// 所有路由都需要认证
router.use(unifiedAuth);

/**
 * 外部数据库连接管理
 */

// 创建外部数据库连接
router.post('/connections', controller.createConnection.bind(controller));

// 获取所有连接
router.get('/connections', controller.getConnections.bind(controller));

// 关闭连接
router.delete('/connections/:connectionId', controller.closeConnection.bind(controller));

/**
 * 外部数据库表操作
 */

// 获取外部数据库的表列表
router.get('/connections/:connectionId/tables', controller.getTables.bind(controller));

// 获取外部数据库的表结构
router.get('/connections/:connectionId/tables/:tableName/structure', controller.getTableStructure.bind(controller));

// 获取外部数据库的表数据预览
router.get('/connections/:connectionId/tables/:tableName/data', controller.getTableData.bind(controller));

/**
 * 本地数据库表操作
 */

// 获取本地数据库的表列表
router.get('/local/tables', controller.getLocalTables.bind(controller));

// 获取本地数据库的表结构
router.get('/local/tables/:tableName/structure', controller.getLocalTableStructure.bind(controller));

/**
 * 数据映射配置
 */

// 保存映射配置
router.post('/mappings', controller.saveMappingConfig.bind(controller));

// 获取所有映射配置
router.get('/mappings', controller.getMappingConfigs.bind(controller));

// 获取单个映射配置
router.get('/mappings/:configId', controller.getMappingConfig.bind(controller));

// 删除映射配置
router.delete('/mappings/:configId', controller.deleteMappingConfig.bind(controller));

/**
 * 智能映射
 */

// 智能字段映射建议
router.get('/suggest-mapping', controller.suggestFieldMapping.bind(controller));

/**
 * 数据同步
 */

// 一键智能同步
router.post('/smart-sync', controller.smartSync.bind(controller));

// 数据预检查
router.post('/precheck', controller.preCheckSync.bind(controller));

// 执行数据同步
router.post('/sync', controller.executeSync.bind(controller));

// 获取同步进度
router.get('/sync/:syncId/progress', controller.getSyncProgress.bind(controller));

/**
 * 本地到云端同步
 */

// 本地到云端同步（一键）
router.post('/local-to-cloud/sync', controller.localToCloudSync.bind(controller));

// 预检查本地到云端同步
router.post('/local-to-cloud/precheck', controller.localToCloudPreCheck.bind(controller));

// 执行本地到云端同步
router.post('/local-to-cloud/execute', controller.localToCloudExecute.bind(controller));

module.exports = router;
