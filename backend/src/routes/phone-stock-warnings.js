const express = require('express');
const router = express.Router();
const { unifiedAuth, requirePermission } = require('../middleware/unified-auth');
const ApiResponse = require('../utils/response');
const PhoneStockWarningService = require('../services/phone-stock-warning.service');
const log = require('../utils/log');

const phoneStockWarningService = new PhoneStockWarningService();

/**
 * 获取所有预警配置
 */
router.get('/configs', unifiedAuth, requirePermission('system:view'), async (req, res) => {
  const result = await phoneStockWarningService.getAllConfigs();

  if (result.success) {
    ApiResponse.success(res, result.data, result.message);
  } else {
    ApiResponse.error(res, result.message, result.statusCode || 500);
  }
});

/**
 * 根据品牌和型号获取预警阈值
 * 查询参数：brand_id, model_id
 */
router.get('/threshold', unifiedAuth, requirePermission('system:view'), async (req, res) => {
  try {
    const { brand_id, model_id } = req.query;

    if (!brand_id) {
      return ApiResponse.error(res, '品牌ID不能为空', 400);
    }

    const result = await phoneStockWarningService.getWarningThreshold(
      parseInt(brand_id) || null,
      model_id ? parseInt(model_id) : null
    );

    if (result.success) {
      ApiResponse.success(res, result.data, result.message);
    } else {
      ApiResponse.error(res, result.message, result.statusCode || 500);
    }
  } catch (error) {
    log.error('获取预警阈值失败:', error);
    ApiResponse.error(res, '获取预警阈值失败', 500);
  }
});

/**
 * 创建预警配置
 */
router.post('/configs', unifiedAuth, requirePermission('system:edit'), async (req, res) => {
  const result = await phoneStockWarningService.createConfig(req.user.id, req.body);

  if (result.success) {
    ApiResponse.success(res, result.data, result.message);
  } else {
    ApiResponse.error(res, result.message, result.statusCode || 500);
  }
});

/**
 * 更新预警配置
 */
router.put('/configs/:id', unifiedAuth, requirePermission('system:edit'), async (req, res) => {
  const configId = parseInt(req.params.id);

  if (isNaN(configId)) {
    return ApiResponse.error(res, '配置ID无效', 400);
  }

  const result = await phoneStockWarningService.updateConfig(req.user.id, configId, req.body);

  if (result.success) {
    ApiResponse.success(res, result.data, result.message);
  } else {
    ApiResponse.error(res, result.message, result.statusCode || 500);
  }
});

/**
 * 删除预警配置
 */
router.delete('/configs/:id', unifiedAuth, requirePermission('system:delete'), async (req, res) => {
  const configId = parseInt(req.params.id);

  if (isNaN(configId)) {
    return ApiResponse.error(res, '配置ID无效', 400);
  }

  const result = await phoneStockWarningService.deleteConfig(req.user.id, configId);

  if (result.success) {
    ApiResponse.success(res, result.data, result.message);
  } else {
    ApiResponse.error(res, result.message, result.statusCode || 500);
  }
});

/**
 * 切换预警开关
 * 请求体：{ enabled: boolean }
 */
router.patch('/configs/:id/toggle', unifiedAuth, requirePermission('system:edit'), async (req, res) => {
  const configId = parseInt(req.params.id);
  const { enabled } = req.body;

  if (isNaN(configId)) {
    return ApiResponse.error(res, '配置ID无效', 400);
  }

  if (typeof enabled !== 'boolean') {
    return ApiResponse.error(res, 'enabled 必须是布尔值', 400);
  }

  const result = await phoneStockWarningService.toggleWarning(req.user.id, configId, enabled);

  if (result.success) {
    ApiResponse.success(res, result.data, result.message);
  } else {
    ApiResponse.error(res, result.message, result.statusCode || 500);
  }
});

/**
 * 获取品牌列表
 */
router.get('/brands', unifiedAuth, requirePermission('system:view'), async (req, res) => {
  const result = await phoneStockWarningService.getBrands();

  if (result.success) {
    ApiResponse.success(res, result.data, result.message);
  } else {
    ApiResponse.error(res, result.message, result.statusCode || 500);
  }
});

/**
 * 根据品牌获取型号列表
 * 查询参数：brand_id
 */
router.get('/models', unifiedAuth, requirePermission('system:view'), async (req, res) => {
  const { brand_id } = req.query;

  if (!brand_id) {
    return ApiResponse.error(res, '品牌ID不能为空', 400);
  }

  const result = await phoneStockWarningService.getModelsByBrand(parseInt(brand_id));

  if (result.success) {
    ApiResponse.success(res, result.data, result.message);
  } else {
    ApiResponse.error(res, result.message, result.statusCode || 500);
  }
});

/**
 * 获取颜色列表
 */
router.get('/colors', unifiedAuth, requirePermission('system:view'), async (req, res) => {
  const result = await phoneStockWarningService.getColors();

  if (result.success) {
    ApiResponse.success(res, result.data, result.message);
  } else {
    ApiResponse.error(res, result.message, result.statusCode || 500);
  }
});

/**
 * 获取内存列表
 */
router.get('/memories', unifiedAuth, requirePermission('system:view'), async (req, res) => {
  const result = await phoneStockWarningService.getMemories();

  if (result.success) {
    ApiResponse.success(res, result.data, result.message);
  } else {
    ApiResponse.error(res, result.message, result.statusCode || 500);
  }
});

module.exports = router;
