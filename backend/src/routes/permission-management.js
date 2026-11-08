const express = require('express')
const router = express.Router()
const { unifiedAuth, requirePermission } = require('../middleware/unified-auth')
const UserMenuController = require('../controllers/user-menu.controller')
const UserPermissionsController = require('../controllers/user-permissions.controller')
const UserRolesController = require('../controllers/user-roles.controller')
const UserRoleAssignmentController = require('../controllers/user-role-assignment.controller')
const RolePermissionVisibilityController = require('../controllers/role-permission-visibility.controller')
const PermissionStatisticsController = require('../controllers/permission-statistics.controller')
const PermissionConflictsController = require('../controllers/permission-conflicts.controller')
const ModulePermissionCheckController = require('../controllers/module-permission-check.controller')
const PermissionCleanupController = require('../controllers/permission-cleanup.controller')
const PermissionActionsController = require('../controllers/permission-actions.controller')
const PermissionListController = require('../controllers/permission-list.controller')
const PermissionModuleMappingController = require('../controllers/permission-module-mapping.controller')
const PermissionUsersListController = require('../controllers/permission-users-list.controller')
const PermissionRoleManagementController = require('../controllers/permission-role-management.controller')
const PermissionBatchController = require('../controllers/permission-batch.controller')
const PermissionExportController = require('../controllers/permission-export.controller')
const PermissionImportController = require('../controllers/permission-import.controller')
const PermissionMenuUpdateController = require('../controllers/permission-menu-update.controller')
const PermissionMenuController = require('../controllers/permission-menu.controller')
const RoleFieldPermissionsController = require('../controllers/role-field-permissions.controller')
const RolePermissionsController = require('../controllers/role-permissions.controller')
const RoleFieldPermissionDeleteController = require('../controllers/role-field-permission-delete.controller')
const UserFieldPermissionsController = require('../controllers/user-field-permissions.controller')
const permissionMenuUpdateController = new PermissionMenuUpdateController()
const permissionCleanupController = new PermissionCleanupController()
const userMenuController = new UserMenuController()
const userPermissionsController = new UserPermissionsController()
const userRolesController = new UserRolesController()
const userRoleAssignmentController = new UserRoleAssignmentController()
const rolePermissionVisibilityController = new RolePermissionVisibilityController()
const permissionStatisticsController = new PermissionStatisticsController()
const permissionConflictsController = new PermissionConflictsController()
const modulePermissionCheckController = new ModulePermissionCheckController()
const permissionActionsController = new PermissionActionsController()
const permissionListController = new PermissionListController()
const permissionModuleMappingController = new PermissionModuleMappingController()
const permissionUsersListController = new PermissionUsersListController()
const permissionRoleManagementController = new PermissionRoleManagementController()
const roleFieldPermissionDeleteController = new RoleFieldPermissionDeleteController()
const userFieldPermissionsController = new UserFieldPermissionsController()
const permissionBatchController = new PermissionBatchController()
const permissionExportController = new PermissionExportController()
const permissionImportController = new PermissionImportController()
const permissionMenuController = new PermissionMenuController()
const roleFieldPermissionsController = new RoleFieldPermissionsController()
const rolePermissionsController = new RolePermissionsController()

// 权限验证中间件
router.use(unifiedAuth)

router.get('/actions', requirePermission('permissions:admin'), permissionActionsController.list.bind(permissionActionsController))

/**
 * 获取所有权限（包含模块信息）
 */
router.get('/all', requirePermission('permissions:admin'), permissionListController.list.bind(permissionListController))

/**
 * 批量分配权限给角色
 */
router.post('/assign-batch', requirePermission('permissions:admin'), permissionBatchController.assign.bind(permissionBatchController))

/**
 * 批量回收角色权限
 */
router.post('/revoke-batch', requirePermission('permissions:admin'), permissionBatchController.revoke.bind(permissionBatchController))

/**
 * 复制角色权限
 */
router.post('/copy', requirePermission('permissions:admin'), permissionBatchController.copy.bind(permissionBatchController))

/**
 * 获取权限使用统计
 */
router.get('/stats', requirePermission('permissions:admin'), permissionStatisticsController.getStats.bind(permissionStatisticsController))

/**
 * 获取简化的统计数据（用于权限页面统计卡片）
 */
router.get('/overview', requirePermission('permissions:admin'), permissionStatisticsController.getOverview.bind(permissionStatisticsController))

/**
 * 获取权限冲突检测
 */
router.get('/conflicts/check', requirePermission('permissions:admin'), permissionConflictsController.check.bind(permissionConflictsController))

/**
 * 清理权限冲突
 */
router.post('/conflicts/cleanup', requirePermission('permissions:admin'), permissionConflictsController.cleanup.bind(permissionConflictsController))

/**
 * 导出权限配置
 */
router.get('/export', requirePermission('permissions:admin'), permissionExportController.export.bind(permissionExportController))

/**
 * 导入权限配置
 */
router.post('/import', requirePermission('permissions:admin'), permissionImportController.import.bind(permissionImportController))

/**
 * 获取角色的菜单权限
 */
router.get('/menu/:role_id', requirePermission('permissions:admin'), permissionMenuController.getByRole.bind(permissionMenuController))

/**
 * 更新角色的菜单权限
 */
router.put('/menu/:role_id', requirePermission('permissions:admin'), permissionMenuUpdateController.update.bind(permissionMenuUpdateController))

/**
 * 获取用户的菜单权限（用于前端显示控制）
 */
router.get('/user-menu', userMenuController.getUserMenu.bind(userMenuController))

/**
 * 检查用户的模块权限（用于前端权限验证）
 */
router.get('/check-module-permission', modulePermissionCheckController.check.bind(modulePermissionCheckController))

/**
 * 获取用户的完整权限信息（包含菜单和功能权限）
 */
router.get('/user-permissions', userPermissionsController.getUserPermissions.bind(userPermissionsController))

/**
 * 获取角色列表（分页）
 */
router.get('/roles', requirePermission('permissions:admin'), userRolesController.listRoles.bind(userRolesController))

/**
 * 获取用户及其角色信息（分页）
 */
router.get('/users-with-roles', requirePermission('permissions:admin'), permissionUsersListController.list.bind(permissionUsersListController))

/**
 * 创建新角色
 */
router.post('/roles', requirePermission('permissions:admin'), permissionRoleManagementController.create.bind(permissionRoleManagementController))

/**
 * 更新角色
 */
router.put('/roles/:id', requirePermission('permissions:admin'), permissionRoleManagementController.update.bind(permissionRoleManagementController))

/**
 * 删除角色
 */
router.delete('/roles/:id', requirePermission('permissions:admin'), permissionRoleManagementController.remove.bind(permissionRoleManagementController))

/**
 * 更新角色状态
 */
router.put('/roles/:id/status', requirePermission('permissions:admin'), permissionRoleManagementController.updateStatus.bind(permissionRoleManagementController))

/**
 * 分配用户角色
 */
router.put('/users/:id/roles', requirePermission('permissions:admin'), userRoleAssignmentController.assign.bind(userRoleAssignmentController))

/**
 * 获取用户的角色列表
 */
router.get('/users/:id/roles', requirePermission('permissions:admin'), userRolesController.getUserRoles.bind(userRolesController))

/**
 * 获取角色的权限列表 - 返回所有权限及分配状态
 */
router.get('/roles/:id/permissions', requirePermission('permissions:admin'), rolePermissionsController.getByRole.bind(rolePermissionsController))

/**
 * 更新角色权限
 */
router.put('/roles/:id/permissions', requirePermission('permissions:admin'), rolePermissionsController.updateActionPermissions.bind(rolePermissionsController))

/**
 * 为角色分配所有权限
 */
router.put('/roles/:id/permissions/select-all', requirePermission('permissions:admin'), rolePermissionsController.selectAllActionPermissions.bind(rolePermissionsController))

/**
 * 清除角色的所有权限
 */
router.put('/roles/:id/permissions/clear-all', requirePermission('permissions:admin'), rolePermissionsController.clearAllActionPermissions.bind(rolePermissionsController))

/**
 * 切换权限可见性
 */
router.put('/toggle-visibility', requirePermission('permissions:admin'), rolePermissionVisibilityController.toggleVisibility.bind(rolePermissionVisibilityController))

/**
 * 获取权限可见性状态
 */
router.get('/visibility/:role_id', requirePermission('permissions:admin'), rolePermissionVisibilityController.getVisibility.bind(rolePermissionVisibilityController))

/**
 * 获取角色字段权限配置
 */
router.get('/field-permissions/:role_id', requirePermission('permissions:admin'), roleFieldPermissionsController.getByRole.bind(roleFieldPermissionsController))

/**
 * 更新角色字段权限配置
 */
router.put('/field-permissions/:role_id', requirePermission('permissions:admin'), roleFieldPermissionsController.update.bind(roleFieldPermissionsController))

/**
 * 保存角色字段权限配置
 */
router.post('/field-permissions/:role_id', requirePermission('permissions:admin'), roleFieldPermissionsController.save.bind(roleFieldPermissionsController))

/**
 * 批量保存角色字段权限配置
 */
router.post('/field-permissions/:role_id/batch', requirePermission('permissions:admin'), roleFieldPermissionsController.saveBatch.bind(roleFieldPermissionsController))

/**
 * 删除角色字段权限配置
 */
router.delete('/field-permissions/:role_id/:module_key', requirePermission('permissions:admin'), roleFieldPermissionDeleteController.remove.bind(roleFieldPermissionDeleteController))

/**
 * 获取用户当前生效的字段权限配置
 */
router.get('/user-field-permissions', userFieldPermissionsController.getCurrent.bind(userFieldPermissionsController))

/**
 * 获取模块映射列表（用于字段权限管理）
 */
router.get('/module-mappings', requirePermission('permissions:admin'), permissionModuleMappingController.list.bind(permissionModuleMappingController))

/**
 * 手动清理权限 - 管理员工具
 */
router.post('/cleanup-permissions', requirePermission('permissions:admin'), permissionCleanupController.manualCleanup.bind(permissionCleanupController))

module.exports = router
