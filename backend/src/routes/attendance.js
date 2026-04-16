const express = require('express');
const router = express.Router();
const AttendanceController = require('../controllers/attendance.controller');
const { unifiedAuth, requirePermission, requireAnyPermission } = require('../middleware/unified-auth');

// 考勤记录相关路由（需要认证）
router.use(unifiedAuth);

// 获取考勤记录列表 - 根据权限返回不同数据
// - 普通用户：只返回自己的数据
// - 管理员（拥有完整权限）：返回所有数据
router.get('/',
  requireAnyPermission(['attendance:view', 'attendance:view:own', 'attendance:view:all']),
  AttendanceController.getAttendanceRecords.bind(AttendanceController)
);

// 获取个人考勤记录
// 兼容旧端点，内部已复用统一主端点逻辑
router.get('/my',
  requirePermission('attendance:view:own'),
  AttendanceController.getMyAttendanceRecords.bind(AttendanceController)
);

// 获取考勤统计（管理员功能）
router.get('/stats/summary', requirePermission('attendance:view:all'),
  AttendanceController.getAttendanceStats.bind(AttendanceController)
);

// 获取考勤仪表盘汇总统计 - 所有认证用户
router.get('/stats/dashboard',
  AttendanceController.getDashboardStats.bind(AttendanceController)
);

// 获取待审批统计 - 仪表盘使用
router.get('/pending-stats',
  AttendanceController.getPendingStats.bind(AttendanceController)
);

// 获取用户休假余额 - 所有认证用户
router.get('/leave-balance',
  AttendanceController.getUserLeaveBalance.bind(AttendanceController)
);

// 获取休假配置 - 所有认证用户
router.get('/leave-config',
  AttendanceController.getLeaveConfig.bind(AttendanceController)
);

// 获取考勤记录详情
router.get('/:id',
  requireAnyPermission(['attendance:view', 'attendance:view:own', 'attendance:view:all']),
  AttendanceController.getAttendanceRecordById.bind(AttendanceController)
);

// 创建考勤记录（新增申请） - 所有认证用户
router.post('/', requirePermission('attendance:create'),
  AttendanceController.createAttendanceRecord.bind(AttendanceController)
);

// 更新考勤记录（管理员）
router.put('/:id', requirePermission('attendance:edit'),
  AttendanceController.updateAttendanceRecord.bind(AttendanceController)
);

// 删除考勤记录（管理员）
router.delete('/:id', requirePermission('attendance:delete'),
  AttendanceController.deleteAttendanceRecord.bind(AttendanceController)
);

// 取消考勤申请（所有认证用户 - 只能取消自己待审批的申请）
router.post('/:id/cancel',
  AttendanceController.cancelAttendanceRequest.bind(AttendanceController)
);

// 审批考勤记录
router.post('/:id/approve', requirePermission('attendance:approve'),
  AttendanceController.approveAttendanceRecord.bind(AttendanceController)
);

module.exports = router;
