const express = require('express')
const router = express.Router()
const ModuleScanner = require('../services/module-scanner.service')
const MenuModuleLinker = require('../services/menu-module-linker.service')
const { unifiedAuth, requirePermission, requireAnyPermission } = require('../middleware/unified-auth')
const { logPermissionOperation } = require('./permission-logs')
const ModuleManagementService = require('../services/module-management.service')
const ModuleManagementController = require('../controllers/module-management.controller')
const MenuModuleLinkController = require('../controllers/menu-module-link.controller')

const moduleScanner = new ModuleScanner()
const menuLinker = new MenuModuleLinker()
const moduleManagementController = new ModuleManagementController({
  moduleScanner,
  service: new ModuleManagementService({ moduleScanner }),
  logPermissionOperation
})
const menuModuleLinkController = new MenuModuleLinkController({ service: menuLinker })

// 权限验证中间件
router.use(unifiedAuth)

/**
 * 获取所有模块列表（用于菜单管理中的模块选择）
 */
router.get('/', requireAnyPermission(['permissions:admin', 'menus:create', 'menus:edit']), moduleManagementController.list.bind(moduleManagementController))

/**
 * 扫描并获取所有发现的模块
 */
router.get('/scan', requirePermission('permissions:admin'), moduleManagementController.scan.bind(moduleManagementController))

/**
 * 获取未注册的模块列表
 */
router.get('/unregistered', requirePermission('permissions:admin'), moduleManagementController.unregistered.bind(moduleManagementController))

/**
 * 注册单个模块
 */
router.post('/register', requirePermission('permissions:admin'), moduleManagementController.register.bind(moduleManagementController))

/**
 * 批量注册模块
 */
router.post('/register-batch', requirePermission('permissions:admin'), moduleManagementController.registerBatch.bind(moduleManagementController))

/**
 * 同步所有模块
 */
router.post('/sync-all', requirePermission('permissions:admin'), moduleManagementController.syncAll.bind(moduleManagementController))

/**
 * 获取已注册的模块列表
 */
router.get('/registered', requirePermission('permissions:admin'), moduleManagementController.registered.bind(moduleManagementController))

/**
 * 获取模块详细信息
 */
router.get('/:module_key', requirePermission('permissions:admin'), moduleManagementController.detail.bind(moduleManagementController))

/**
 * 更新模块信息
 */
router.put('/:module_key', requirePermission('permissions:admin'), moduleManagementController.update.bind(moduleManagementController))

/**
 * 启用/禁用模块
 */
router.patch('/:module_key/toggle', requirePermission('permissions:admin'), moduleManagementController.toggle.bind(moduleManagementController))

/**
 * 删除模块
 */
router.delete('/:module_key', requirePermission('permissions:admin'), moduleManagementController.delete.bind(moduleManagementController))

/**
 * 获取模块统计信息
 */
router.get('/stats/overview', requirePermission('permissions:admin'), moduleManagementController.overviewStats.bind(moduleManagementController))

/**
 * 修改模块名称
 */
router.put('/:module_key/name', requirePermission('permissions:admin'), moduleManagementController.rename.bind(moduleManagementController))

/**
 * 恢复模块原始名称
 */
router.put('/:module_key/restore-name', requirePermission('permissions:admin'), moduleManagementController.restoreName.bind(moduleManagementController))

/**
 * 获取模块名称状态
 */
router.get('/:module_key/name-status', requirePermission('permissions:admin'), moduleManagementController.nameStatus.bind(moduleManagementController))

/**
 * 获取菜单-模块关联统计信息
 */
router.get('/menu-link/stats', requirePermission('permissions:admin'), menuModuleLinkController.getLinkStats.bind(menuModuleLinkController))

/**
 * 获取未关联的菜单列表
 */
router.get('/menu-link/unlinked', requirePermission('permissions:admin'), menuModuleLinkController.getUnlinkedMenus.bind(menuModuleLinkController))

/**
 * 同步所有菜单-模块关联
 */
router.post('/menu-link/sync', requirePermission('permissions:admin'), menuModuleLinkController.syncAll.bind(menuModuleLinkController))

/**
 * 手动关联单个菜单到模块
 */
router.post('/menu-link/link', requirePermission('permissions:admin'), menuModuleLinkController.linkMenu.bind(menuModuleLinkController))

/**
 * 切换模块启用/禁用状态
 */
router.put('/:id/status', requirePermission('permissions:admin'), moduleManagementController.setStatusById.bind(moduleManagementController))

/**
 * 手动创建模块
 */
router.post('/manual-create', requirePermission('permissions:admin'), moduleManagementController.manualCreate.bind(moduleManagementController))

/**
 * 手动触发菜单关联修复
 */
router.post('/fix-menu-links', requirePermission('permissions:admin'), moduleManagementController.fixMenuLinks.bind(moduleManagementController))

module.exports = router
