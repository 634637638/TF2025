const express = require('express')
const router = express.Router()
const { unifiedAuth, requirePermission } = require('../middleware/unified-auth')
const EmployeeRoleController = require('../controllers/employee-role.controller')
const EmployeeMutationController = require('../controllers/employee-mutation.controller')
const EmployeeStatisticsController = require('../controllers/employee-statistics.controller')
const EmployeeDirectoryController = require('../controllers/employee-directory.controller')
const EmployeeSalaryController = require('../controllers/employee-salary.controller')
const employeeRoleController = new EmployeeRoleController()
const employeeMutationController = new EmployeeMutationController()
const employeeStatisticsController = new EmployeeStatisticsController()
const employeeDirectoryController = new EmployeeDirectoryController()
const employeeSalaryController = new EmployeeSalaryController()

// 获取员工列表
router.get('/', unifiedAuth, requirePermission('employee:view'), employeeDirectoryController.list.bind(employeeDirectoryController))

// 获取员工简化列表（用于工资管理）
// 只返回基本的员工信息，不需要员工管理权限
// 工资记录查看权限：可以看到所有员工
// 我的工资查看权限：只能看到自己
router.get('/salary-list', unifiedAuth, requirePermission('salary-records:view'), employeeSalaryController.list.bind(employeeSalaryController))

// 获取员工当前底薪（包含工龄涨薪计算）
// 专门用于工资发放页面
// 支持通过 date 参数（YYYY-MM）计算指定月份的底薪
// 工资记录查看权限：可以看到所有员工
// 我的工资查看权限：只能看到自己
router.get('/current-salary', unifiedAuth, requirePermission('salary-records:view'), employeeSalaryController.current.bind(employeeSalaryController))

// ==================== 角色管理相关路由 ====================

// 获取权限系统的所有角色（与权限系统同步）
router.get('/system-roles', unifiedAuth, requirePermission('permissions:admin'), employeeRoleController.systemRoles.bind(employeeRoleController))

// 获取所有角色
router.get('/roles', unifiedAuth, requirePermission('employee:view'), employeeRoleController.list.bind(employeeRoleController))

// 创建新角色
router.post('/roles', unifiedAuth, requirePermission('employee:create'), employeeRoleController.create.bind(employeeRoleController))

// 更新角色
router.put('/roles/:id', unifiedAuth, requirePermission('employee:edit'), employeeRoleController.update.bind(employeeRoleController))

// 删除角色
router.delete('/roles/:id', unifiedAuth, requirePermission('employee:delete'), employeeRoleController.delete.bind(employeeRoleController))

// 为员工分配角色
router.post('/:id/roles', unifiedAuth, requirePermission('employee:edit'), employeeRoleController.assign.bind(employeeRoleController))

// 移除员工的单个角色
router.delete('/:employeeId/roles/:roleId', unifiedAuth, requirePermission('employee:edit'), employeeRoleController.remove.bind(employeeRoleController))

// ==================== 员工详情相关路由 ====================

// 获取员工详情
router.get('/:id(\\d+)', unifiedAuth, requirePermission('employee:view'), employeeDirectoryController.detail.bind(employeeDirectoryController))

// 创建员工
router.post('/', unifiedAuth, requirePermission('employee:create'), employeeMutationController.create.bind(employeeMutationController))

// 更新员工
router.put('/:id', unifiedAuth, requirePermission('employee:edit'), employeeMutationController.update.bind(employeeMutationController))

// 删除员工
router.delete('/:id', unifiedAuth, requirePermission('employee:delete'), employeeMutationController.delete.bind(employeeMutationController))

// 更新员工状态
router.patch('/:id/status', unifiedAuth, requirePermission('employee:edit'), employeeMutationController.updateStatus.bind(employeeMutationController))

// 获取员工统计信息
router.get('/stats/overview', unifiedAuth, requirePermission('employee:view'), employeeStatisticsController.overview.bind(employeeStatisticsController))

module.exports = router
