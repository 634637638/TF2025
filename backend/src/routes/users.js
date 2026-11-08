const express = require('express')
const { unifiedAuth, requirePermission, requireAnyPermission } = require('../middleware/unified-auth')
const UserRepository = require('../repositories/user.repository')
const UserController = require('../controllers/user.controller')
const auditUnpaginatedPersonnelSearch = require('../middleware/unpaginated-personnel-search')

const router = express.Router()
const userRepository = new UserRepository()
const userController = new UserController({ userRepository })
/**
 * 获取员工简单列表（用于考勤、综合查询等场景）
 * GET /api/users/employees
 * 权限规则：
 * - 考勤管理用户，或有综合查询权限：可以看到所有员工
 * - 普通用户（只有个人考勤查看权限）：只能看到自己
 */
router.get('/employees', unifiedAuth, requireAnyPermission(['attendance:view', 'attendance:view:own', 'attendance:view:all', 'query:view']), auditUnpaginatedPersonnelSearch('users-employees'), userController.employees.bind(userController))

/**
 * 获取用户列表
 * GET /api/users
 */
router.get('/', unifiedAuth, requirePermission('users:view'), userController.list.bind(userController))

/**
 * 根据用户名获取用户档案信息
 * GET /api/users/profile?username=<username>
 */
router.get('/profile', unifiedAuth, requirePermission('users:view'), userController.profile.bind(userController))

/**
 * 获取操作员列表 (销售员)
 * GET /api/users/operators
 * 注意：必须放在 /:id 路由之前，否则 operators 会被当作 :id 参数处理
 */
router.get('/operators', unifiedAuth, requireAnyPermission([
  'users:view',
  'sales:view',
  'inventory:view',
  'preorders:view',
  'return-goods:view'
]), auditUnpaginatedPersonnelSearch('users-operators'), userController.operators.bind(userController))

/**
 * 根据ID获取用户详情
 * GET /api/users/:id
 */
router.get('/:id', unifiedAuth, requirePermission('users:view'), userController.getById.bind(userController))

/**
 * 创建用户
 * POST /api/users
 */
router.post('/', unifiedAuth, requirePermission('users:create'), userController.create.bind(userController))

/**
 * 更新用户
 * PUT /api/users/:id
 */
router.put('/:id', unifiedAuth, requirePermission('users:edit'), userController.update.bind(userController))

/**
 * 删除用户
 * DELETE /api/users/:id
 */
router.delete('/:id', unifiedAuth, requirePermission('users:delete'), userController.remove.bind(userController))

/**
 * 切换用户状态
 * PATCH /api/users/:id/toggle
 */
router.patch('/:id/toggle', unifiedAuth, requirePermission('users:edit'), userController.toggle.bind(userController))

module.exports = router
