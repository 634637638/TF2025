/**
 * 系统设置路由
 */
const express = require('express');
const router = express.Router();
const SettingsController = require('../controllers/settings.controller');
const { unifiedAuth, requirePermission } = require('../middleware/unified-auth');

const settingsController = new SettingsController();

// 公开路由（不需要认证）- 必须在最前面
router.get('/public/menu-width', settingsController.getMenuWidth);
router.get('/public/menu-widths', settingsController.getAllMenuWidths);
router.post('/public/menu-widths', settingsController.setBothMenuWidths);

// 需要认证的路由中间件
router.use(unifiedAuth);

// 菜单宽度专用接口（必须在 /:settingKey 之前）
router.get('/menu-width', settingsController.getMenuWidth);
router.post('/menu-width', settingsController.setMenuWidth);

// PC和手机端菜单宽度接口（需要认证）
router.get('/menu-widths', settingsController.getAllMenuWidths);
router.post('/menu-widths', settingsController.setBothMenuWidths);

// 获取所有设置
router.get('/', settingsController.getAllSettings);

// 批量设置
router.post('/', settingsController.setMultipleSettings);

// 获取单个设置
router.get('/:settingKey', settingsController.getSetting);

// 设置单个设置
router.post('/:settingKey', settingsController.setSetting);

module.exports = router;
