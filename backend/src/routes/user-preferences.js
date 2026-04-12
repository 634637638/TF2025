/**
 * 用户偏好设置路由
 */
const express = require('express');
const router = express.Router();
const UserPreferencesController = require('../controllers/user-preferences.controller');
const userPreferencesController = new UserPreferencesController();
const { unifiedAuth } = require('../middleware/unified-auth');

// 所有路由都需要认证
router.use(unifiedAuth);

// 获取单个偏好设置
router.get('/:preferenceKey', userPreferencesController.getPreference);

// 设置单个偏好设置
router.post('/:preferenceKey', userPreferencesController.setPreference);

// 获取所有偏好设置
router.get('/', userPreferencesController.getAllPreferences);

// 批量设置偏好设置
router.post('/', userPreferencesController.setMultiplePreferences);

// 删除偏好设置
router.delete('/:preferenceKey', userPreferencesController.deletePreference);

module.exports = router;
