const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const log = require('../utils/log');
const { getUploadSubdir } = require('../utils/upload-paths');

// 导入控制器和中间件
const menuController = require('../controllers/menu.controller');
const { unifiedAuth, requirePermission } = require('../middleware/unified-auth');

// 配置文件上传
const storage = multer.diskStorage({
  destination: async (_req, _file, cb) => {
    const uploadDir = getUploadSubdir('temp');
    try {
      await require('fs').promises.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (error) {
      cb(error, uploadDir);
    }
  },
  filename: (_req, file, cb) => {
    cb(null, Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  },
  fileFilter: (_req, file, cb) => {
    // 检查文件类型
    if (file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
        file.mimetype === 'application/vnd.ms-excel') {
      cb(null, true);
    } else {
      cb(new Error('只支持Excel文件格式'), false);
    }
  }
});

// ========== GET 路由（特定路径必须在 /:id 之前） ==========

// 获取菜单列表（树形结构）
router.get('/', unifiedAuth, requirePermission('menus:view'), (req, res) => menuController.getMenuList(req, res));

// 获取父菜单选项（必须在 /:id 之前，避免被当作ID匹配）
router.get('/options/parents', unifiedAuth, requirePermission('menus:view'), (req, res) => menuController.getParentMenuOptions(req, res));

// 获取菜单统计信息（必须在 /:id 之前）
router.get('/stats/overview', unifiedAuth, requirePermission('menus:view'), (req, res) => menuController.getMenuStats(req, res));

// 导出菜单数据（必须在 /:id 之前）
router.get('/export/excel', unifiedAuth, requirePermission('menus:export'), (req, res) => menuController.exportMenus(req, res));

// 获取菜单详情（使用动态参数，必须放在最后）
router.get('/:id', unifiedAuth, requirePermission('menus:view'), (req, res) => menuController.getMenuById(req, res));

// ========== POST 路由（特定路径必须在 /:id 之前） ==========

// 创建菜单
router.post('/', unifiedAuth, requirePermission('menus:create'), (req, res) => menuController.createMenu(req, res));

// 初始化菜单数据（必须在 /:id 之前）
router.post('/init-menus', unifiedAuth, requirePermission('menus:create'), (req, res) => menuController.initMenus(req, res));

// 导入菜单数据（必须在 /:id 之前）
router.post('/import/excel', unifiedAuth, requirePermission('menus:import'), upload.single('file'), (req, res) => menuController.importMenus(req, res));

// 自动绑定菜单模块（必须在 /:id 之前）
router.post('/auto-bind-modules', unifiedAuth, requirePermission('menus:edit'), async (req, res) => {
  const menuModuleAutoBinder = require('../services/menuModuleAutoBinder');

  try {
    const { single, menuId } = req.body;

    let result;

    if (single && menuId) {
      // 单个菜单绑定
      const connection = require('../config/database').getDatabase();
      const [menus] = await connection.execute('SELECT id, name, url FROM menus WHERE id = ?', [menuId]);

      if (menus.length === 0) {
        return res.status(404).json({
          success: false,
          message: '菜单不存在'
        });
      }

      result = await menuModuleAutoBinder.bindModuleForMenu(menuId, menus[0]);
    } else {
      // 批量修复所有菜单
      result = await menuModuleAutoBinder.batchFixMenuModuleBindings();
    }

    res.json(result);
  } catch (error) {
    log.error('自动绑定菜单模块失败:', error);
    res.status(500).json({
      success: false,
      message: '自动绑定失败: ' + error.message
    });
  }
});

// 复制菜单（使用动态参数）
router.post('/:id/copy', unifiedAuth, requirePermission('menus:create'), (req, res) => menuController.copyMenu(req, res));

// ========== PUT 路由 ==========

// 更新菜单
router.put('/:id', unifiedAuth, requirePermission('menus:edit'), (req, res) => menuController.updateMenu(req, res));

// ========== DELETE 路由 ==========

// 删除菜单
router.delete('/:id', unifiedAuth, requirePermission('menus:delete'), (req, res) => menuController.deleteMenu(req, res));

// ========== PATCH 路由 ==========

// 更新菜单状态
router.patch('/:id/status', unifiedAuth, requirePermission('menus:edit'), (req, res) => menuController.updateMenuStatus(req, res));

// 批量更新菜单排序（特定路径，必须在 /:id 之前）
router.patch('/sort', unifiedAuth, requirePermission('menus:edit'), (req, res) => menuController.updateMenuSort(req, res));

module.exports = router;
