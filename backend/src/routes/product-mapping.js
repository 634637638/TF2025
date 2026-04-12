/**
 * 产品名称映射路由
 */
const express = require('express');
const router = express.Router();
const productMappingController = require('../controllers/product-mapping.controller');
const { unifiedAuth, requirePermission } = require('../middleware/unified-auth');

// 所有路由都需要认证
router.use(unifiedAuth);

// 获取所有映射（从静态配置读取）
router.get('/', requirePermission('price-list:view'), productMappingController.getAllMappings);

// 添加映射（写入静态配置文件）
router.post('/', requirePermission('price-list:edit'), productMappingController.addMapping);

// 删除映射（从静态配置文件删除）
router.delete('/:externalName', requirePermission('price-list:delete'), productMappingController.deleteMapping);

// 测试映射匹配（使用现有的 matchProductName 函数）
router.get('/test', requirePermission('price-list:view'), productMappingController.testMapping);

module.exports = router;
