const express = require('express');
const router = express.Router();
const log = require('../utils/log');

// 健康检查端点（无需认证）
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Backend is healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// 导入现有的旧版路由（保持向后兼容）
const authRoutes = require('./auth');
const dataRoutes = require('./data');
const dashboardRoutes = require('./dashboard');
const systemRoutes = require('./system');
const menusRoutes = require('./menus');
const brandsRoutes = require('./brands');
const suppliersRoutes = require('./suppliers');
const storesRoutes = require('./stores');
// simpleMenusRoutes 已删除，功能合并到 menusRoutes
const salesRoutes = require('./sales');
const optionsRoutes = require('./options');
const usersRoutes = require('./users');
const operatorsRoutes = require('./operators');
const employeesRoutes = require('./employees');
const analyticsRoutes = require('./analytics');
const phonesRoutes = require('./phones');
const modelsRoutes = require('./models');
const colorsRoutes = require('./colors');
const memoriesRoutes = require('./memories');
const inventoryRoutes = require('./inventory');
const csrfRoutes = require('./csrf');
const customersRoutes = require('./customers');
const settingsRoutes = require('./settings');
const iconsRoutes = require('./icons');
const sampleDataRoutes = require('./sample-data');
const stockInRoutes = require('./stock-in');
const queryRoutes = require('./query');

// 新的权限管理路由
const moduleManagementRoutes = require('./module-management');
const permissionManagementRoutes = require('./permission-management');
const { router: permissionLogsRoutes } = require('./permission-logs');

// 系统管理路由
const systemManagementRoutes = require('./system-management');

// 屏幕保护设置路由
const screenLockRoutes = require('./screen-lock');

// 数据库状态路由
const dbStatusRoutes = require('./dbStatus');

// 用户偏好设置路由
const userPreferencesRoutes = require('./user-preferences');

// 考勤工资模块路由
const attendanceRoutes = require('./attendance');
const salaryTemplatesRoutes = require('./salary-templates');
const salaryRecordsRoutes = require('./salary-records');

// 用户-门店关联路由
const userStoresRoutes = require('./user-stores');

// 系统配置路由
const systemSettingsRoutes = require('./system-settings');

// 调试路由（仅开发环境）
const debugPermissionsRoutes = require('./debug-permissions');

// 国补管理路由
const subsidyRoutes = require('./subsidy');

// 通用上传路由
const uploadCommonRoutes = require('./upload-common');

// Git 管理路由
const gitRoutes = require('./git');

// 供应商付款管理路由
const paymentRoutes = require('./payments');

// 供应商手机打款路由
const supplierPaymentRoutes = require('./supplier-payments');

// 数据检查路由
const dataCheckRoutes = require('./data-check');

// 数据导入路由
const dataImportRoutes = require('./data-import');

// 数据库同步路由
const databaseSyncRoutes = require('./database-sync');

// 配件管理路由
const accessoriesRoutes = require('./accessories');

// 预定管理路由
const preordersRoutes = require('./preorders');

// 备份管理路由
const backupRoutes = require('./backup');

// 注册版本化路由（新的架构）
// TODO: v1 路由待开发，暂时注释掉
// router.use('/v1', v1Routes);

// 注册 v1 版本的路由（已废弃，使用标准路由替代）
// router.use('/v1', screenLockRoutes); // 已废弃，使用 /screen-lock
// router.use('/v1/colors', colorsRoutes); // 已废弃，使用 /colors
// router.use('/v1/memories', memoriesRoutes); // 已废弃，使用 /memories

// 注册旧版路由（保持向后兼容，逐步迁移）
router.use('/auth', authRoutes);
router.use('/data', dataRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/system', systemRoutes);
router.use('/menus', menusRoutes);
router.use('/brands', brandsRoutes);
router.use('/suppliers', suppliersRoutes);
router.use('/stores', storesRoutes);
router.use('/sales', salesRoutes);
router.use('/options', optionsRoutes);
router.use('/users', usersRoutes);
router.use('/operators', operatorsRoutes);
router.use('/employees', employeesRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/phones', phonesRoutes);
router.use('/models', modelsRoutes);
router.use('/colors', colorsRoutes);
router.use('/memories', memoriesRoutes);
router.use('/inventory', inventoryRoutes);
// router.use('/repairs', repairsRoutes);
router.use('/customers', customersRoutes);
router.use('/settings', settingsRoutes);
router.use('/icons', iconsRoutes);
router.use('/sample-data', sampleDataRoutes);
router.use('/stock-in', stockInRoutes);
router.use('/query', queryRoutes);
// router.use('/sales-orders', salesOrdersRoutes);
// router.use('/operator-assignments', operatorAssignmentsRoutes);

// 统一的权限管理路由 - 权威权限接口
router.use('/permissions', permissionManagementRoutes);
router.use('/permission-logs', permissionLogsRoutes);

// 废弃的路由 - 保留以防兼容性问题，但标记为废弃
// router.use('/simple-permissions', simplePermissionsRoutes); // 废弃
// router.use('/user-permissions', userPermissionsRoutes); // 废弃

// 模块管理路由
router.use('/modules', moduleManagementRoutes);

// 系统管理路由（独立前缀，避免与 /system 冲突）
router.use('/system-management', systemManagementRoutes);

// 屏幕保护设置路由（独立前缀，避免与 /settings 冲突）
router.use('/screen-lock', screenLockRoutes);

// 数据库状态路由（路由内部已验证）
router.use('/db-status', dbStatusRoutes);

// CSRF 路由（无需验证）
router.use('/csrf', csrfRoutes.router);

// 用户偏好设置路由（需要验证）
router.use('/user-preferences', userPreferencesRoutes);

// 考勤工资模块路由
router.use('/attendance', attendanceRoutes);
router.use('/salary-templates', salaryTemplatesRoutes);
router.use('/salary-records', salaryRecordsRoutes);

// 系统配置路由
router.use('/system-settings', systemSettingsRoutes);

// 用户-门店关联路由
router.use('/user-stores', userStoresRoutes);

// 调试路由（仅开发环境）
if (process.env.NODE_ENV !== 'production') {
  router.use('/debug-permissions', debugPermissionsRoutes);
}

// 国补管理路由
router.use('/subsidy', subsidyRoutes);

// 通用上传路由
router.use('/upload', uploadCommonRoutes);

// Git 管理路由（仅管理员可用）
router.use('/git', gitRoutes);

// 供应商付款管理路由
router.use('/payments', paymentRoutes);

// 供应商手机打款路由
router.use('/supplier-payments', supplierPaymentRoutes);

// 数据检查路由
router.use('/data-check', dataCheckRoutes);

// 数据导入路由
router.use('/data-import', dataImportRoutes);

// 数据库同步路由
router.use('/database-sync', databaseSyncRoutes);

// 数据批量同步路由 - 暂时注释，文件不存在
// router.use('/data-sync', dataSyncRoutes);

// 配件管理路由
router.use('/accessories', accessoriesRoutes);

// 预定管理路由
router.use('/preorders', preordersRoutes);

// 备份管理路由
router.use('/backup', backupRoutes);

// 批发/划拨管理路由
const transfersRoutes = require('./transfers');
router.use('/transfers', transfersRoutes);

// 价目表管理路由
const priceListRoutes = require('./price-list');
const priceListPublicRoutes = require('./price-list-public');
router.use('/price-list', priceListRoutes);
router.use('/public/price', priceListPublicRoutes);

// 产品名称映射路由
const productMappingRoutes = require('./product-mapping');
router.use('/product-mapping', productMappingRoutes);

// 手机库存预警配置路由
const phoneStockWarningsRoutes = require('./phone-stock-warnings');
router.use('/phone-stock-warnings', phoneStockWarningsRoutes);

// H5 商城管理路由（员工端，需要权限）
const shopRoutes = require('./shop');
router.use('/shop', shopRoutes);

// H5 商城首页推荐路由
const homeSectionsRoutes = require('../routes/home-sections');
router.use('/', homeSectionsRoutes);

// H5商城公开API（用户端，无需认证）
const shopPublicRoutes = require('./shop-public');
router.use('/public', shopPublicRoutes);

// H5销售管理路由（后台管理，需要权限）
const salesManagementRoutes = require('./sales-management');
router.use('/sales-management', salesManagementRoutes);

// 临时端点：仅在开发环境且显式开启时挂载
const enableDevTempRoutes = process.env.NODE_ENV === 'development' && process.env.ENABLE_DEV_TEMP_ROUTES === 'true';

if (enableDevTempRoutes) {
  router.post('/temp/make-admin', async (req, res) => {
    try {
      const db = require('../config/database');
      const { username } = req.body;

      if (!username) {
        return res.status(400).json({ success: false, message: '请提供用户名' });
      }

      await db.getDatabase().query(
        "UPDATE users SET role = 'admin' WHERE username = ?",
        [username]
      );

      res.json({
        success: true,
        message: `用户 ${username} 已设置为管理员，请重新登录`
      });
    } catch (error) {
      log.debug('设置管理员失败:', error);
      res.status(500).json({
        success: false,
        message: '设置失败'
      });
    }
  });

  // 临时端点：执行首页推荐表迁移
  router.post('/temp/migrate-home-sections', async (req, res) => {
    try {
      const db = require('../config/database');
      const fs = require('fs');
      const path = require('path');

      const sql = fs.readFileSync(
        path.join(__dirname, '../../migrations/create_home_sections.sql'),
        'utf8'
      );

      await db.getDatabase().query(sql);

      const [sections] = await db.getDatabase().query('SELECT * FROM H5_home_sections');

      res.json({
        success: true,
        message: '首页推荐表创建成功',
        data: {
          sections: sections,
          count: sections.length
        }
      });
    } catch (error) {
      log.debug('迁移失败:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  });
}

// 注意：以下路由待拆分（stores, employees, models, colors, memories, icons, salary）
// 暂时保留在 server.js 中，后续可以继续拆分

module.exports = router;
