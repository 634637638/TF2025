const express = require('express');
const router = express.Router();
const SystemSettingsController = require('../controllers/system-settings.controller');
const { unifiedAuth, requirePermission, requireAnyPermission } = require('../middleware/unified-auth');

// 系统配置相关路由（需要认证）
router.use(unifiedAuth);

// 获取所有配置（管理员）
router.get('/', requirePermission('system:view'),
  SystemSettingsController.getAllSettings.bind(SystemSettingsController)
);

// 根据分类获取配置（管理员）
router.get('/category/:category', requirePermission('system:view'),
  SystemSettingsController.getSettingsByCategory.bind(SystemSettingsController)
);

// 获取考勤相关配置（考勤可见用户可访问）
router.get('/attendance/config', requireAnyPermission([
  'attendance:view',
  'attendance:view:own'
]),
  SystemSettingsController.getAttendanceSettings.bind(SystemSettingsController)
);

// ==================== 加价配置专用路由 ====================
// 注意：必须放在 /:key 这类动态路由前面，避免被通用配置路由误匹配

// 获取加价配置（价目表可见用户可访问）
router.get('/price-markup-config', requirePermission('price-list:view'),
  SystemSettingsController.getMarkupConfig.bind(SystemSettingsController)
);

// 保存加价配置（价目表编辑权限）
router.post('/price-markup-config', requirePermission('price-list:edit'),
  SystemSettingsController.saveMarkupConfig.bind(SystemSettingsController)
);

// 获取单个配置（管理员）
router.get('/:key', requirePermission('system:view'),
  SystemSettingsController.getSettingByKey.bind(SystemSettingsController)
);

// 更新配置（管理员）
router.put('/:key', requirePermission('system:edit'),
  SystemSettingsController.updateSetting.bind(SystemSettingsController)
);

// 批量更新配置（管理员）
router.post('/batch', requirePermission('system:edit'),
  SystemSettingsController.batchUpdateSettings.bind(SystemSettingsController)
);

// 删除配置（管理员）
router.delete('/:key', requirePermission('system:delete'),
  SystemSettingsController.deleteSetting.bind(SystemSettingsController)
);

module.exports = router;
