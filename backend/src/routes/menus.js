const express = require('express')
const router = express.Router()
const multer = require('multer')
const path = require('path')
const crypto = require('crypto')
const { getUploadSubdir } = require('../utils/upload-paths')

// 导入控制器和中间件
const menuController = require('../controllers/menu.controller')
const { unifiedAuth, requirePermission } = require('../middleware/unified-auth')

// 配置文件上传
const storage = multer.diskStorage({
  destination: async (_req, _file, cb) => {
    const uploadDir = getUploadSubdir('temp')
    try {
      await require('fs').promises.mkdir(uploadDir, { recursive: true })
      cb(null, uploadDir)
    } catch (error) {
      cb(error, uploadDir)
    }
  },
  filename: (_req, file, cb) => {
    cb(null, Date.now() + '-' + crypto.randomBytes(8).toString('hex') + path.extname(file.originalname))
  }
})

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  },
  fileFilter: (_req, file, cb) => {
    // 检查文件类型
    if (file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
        file.mimetype === 'application/vnd.ms-excel') {
      cb(null, true)
    } else {
      cb(new Error('只支持Excel文件格式'), false)
    }
  }
})

// ========== GET 路由（特定路径必须在 /:id 之前） ==========

// 获取菜单列表（树形结构）
router.get('/', unifiedAuth, requirePermission('menus:view'), menuController.getMenuList.bind(menuController))

// 获取父菜单选项（必须在 /:id 之前，避免被当作ID匹配）
router.get('/options/parents', unifiedAuth, requirePermission('menus:view'), menuController.getParentMenuOptions.bind(menuController))

// 获取菜单统计信息（必须在 /:id 之前）
router.get('/stats/overview', unifiedAuth, requirePermission('menus:view'), menuController.getMenuStats.bind(menuController))

// 导出菜单数据（必须在 /:id 之前）
router.get('/export/excel', unifiedAuth, requirePermission('menus:export'), menuController.exportMenus.bind(menuController))

// 获取菜单详情（使用动态参数，必须放在最后）
router.get('/:id', unifiedAuth, requirePermission('menus:view'), menuController.getMenuById.bind(menuController))

// ========== POST 路由（特定路径必须在 /:id 之前） ==========

// 创建菜单
router.post('/', unifiedAuth, requirePermission('menus:create'), menuController.createMenu.bind(menuController))

// 导入菜单数据（必须在 /:id 之前）
router.post('/import/excel', unifiedAuth, requirePermission('menus:import'), upload.single('file'), menuController.importMenus.bind(menuController))

// 自动绑定菜单模块（必须在 /:id 之前）
router.post('/auto-bind-modules', unifiedAuth, requirePermission('menus:edit'), menuController.autoBindModules.bind(menuController))

// 复制菜单（使用动态参数）
router.post('/:id/copy', unifiedAuth, requirePermission('menus:create'), menuController.copyMenu.bind(menuController))

// ========== PUT 路由 ==========

// 更新菜单
router.put('/:id', unifiedAuth, requirePermission('menus:edit'), menuController.updateMenu.bind(menuController))

// ========== DELETE 路由 ==========

// 删除菜单
router.delete('/:id', unifiedAuth, requirePermission('menus:delete'), menuController.deleteMenu.bind(menuController))

// ========== PATCH 路由 ==========

// 更新菜单状态
router.patch('/:id/status', unifiedAuth, requirePermission('menus:edit'), menuController.updateMenuStatus.bind(menuController))

// 批量更新菜单排序（特定路径，必须在 /:id 之前）
router.patch('/sort', unifiedAuth, requirePermission('menus:edit'), menuController.updateMenuSort.bind(menuController))

module.exports = router
