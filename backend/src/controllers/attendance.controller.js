const log = require('../utils/log');
const AttendanceService = require('../services/attendance.service');
const ApiResponse = require('../utils/response');
const {
  getAttendanceAccessScope,
  canAccessScopedTarget
} = require('../services/accessControl.service');

/**
 * 考勤控制器
 */
class AttendanceController {
  async getAttendanceScope(userId) {
    return getAttendanceAccessScope(userId);
  }

  /**
   * 获取考勤记录列表 - 根据权限返回不同数据
   * - 管理用户：返回所有数据
   * - 普通用户：只返回自己的数据
   */
  async getAttendanceRecords(req, res) {
    try {
      const { page, limit, employee_id, record_type, status, start_date, end_date } = req.query;
      const userId = req.user.id;
      const scopeInfo = await this.getAttendanceScope(userId);

      // 权限检查：无权限直接返回
      if (!scopeInfo.canView) {
        return ApiResponse.forbidden(res, '无权限查看考勤记录');
      }

      // 只传递允许的字段到 filters
      const filters = {};

      // 对于非管理员，强制使用当前用户ID
      const scopedEmployeeId = scopeInfo.isAdmin
        ? (employee_id ? parseInt(employee_id, 10) : null)
        : userId;

      if (scopedEmployeeId !== null) {
        filters.employee_id = scopedEmployeeId;
      }

      if (record_type) filters.record_type = record_type;
      if (status) filters.status = status;
      if (start_date) filters.start_date = start_date;
      if (end_date) filters.end_date = end_date;

      const options = { page: parseInt(page) || 1, limit: parseInt(limit) || 20 };

      const result = await AttendanceService.getAttendanceRecords(filters, options);
      ApiResponse.success(res, '获取考勤记录成功', result, 200);
    } catch (error) {
      log.error('获取考勤记录失败:', error);
      ApiResponse.error(res, error.message, 500);
    }
  }

  /**
   * 获取个人考勤记录
   * 兼容旧端点，内部复用统一列表逻辑
   */
  async getMyAttendanceRecords(req, res) {
    req.query = {
      ...req.query,
      employee_id: req.user.id
    };
    return this.getAttendanceRecords(req, res);
  }

  /**
   * 获取考勤记录详情
   * 只有“所有考勤查看”权限可查看全部，否则只能查看自己的记录
   */
  async getAttendanceRecordById(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      const scopeInfo = await this.getAttendanceScope(userId);

      const result = await AttendanceService.getAttendanceRecordById(id);

      if (!result) {
        return ApiResponse.error(res, '考勤记录不存在', 404);
      }

      // 无全量查看权限时，只能查看自己的记录
      if (!canAccessScopedTarget(scopeInfo, userId, result.employee_id)) {
        return ApiResponse.forbidden(res, '无权限查看其他员工的考勤记录');
      }

      ApiResponse.success(res, '获取考勤记录详情成功', result, 200);
    } catch (error) {
      log.error('获取考勤记录详情失败:', error);
      ApiResponse.error(res, error.message, 500);
    }
  }

  /**
   * 创建考勤记录
   */
  async createAttendanceRecord(req, res) {
    try {
      const userId = req.user.id;
      const scopeInfo = await this.getAttendanceScope(userId);

      // 权限检查：无权限直接返回
      if (!scopeInfo.canView) {
        return ApiResponse.forbidden(res, '无权限创建考勤记录');
      }

      // 对于非管理员，强制使用当前用户ID
      const targetEmployeeId = scopeInfo.isAdmin
        ? (req.body.employee_id ? parseInt(req.body.employee_id, 10) : userId)
        : userId;

      const payload = {
        ...req.body,
        employee_id: targetEmployeeId
      };

      const result = await AttendanceService.createAttendanceRecord(payload, userId);
      ApiResponse.success(res, '创建考勤记录成功', result, 201);
    } catch (error) {
      log.error('创建考勤记录失败:', error);
      ApiResponse.error(res, error.message, 500);
    }
  }

  /**
   * 更新考勤记录
   */
  async updateAttendanceRecord(req, res) {
    try {
      const { id } = req.params;
      const result = await AttendanceService.updateAttendanceRecord(id, req.body);
      ApiResponse.success(res, '更新考勤记录成功', result, 200);
    } catch (error) {
      log.error('更新考勤记录失败:', error);
      ApiResponse.error(res, error.message, 500);
    }
  }

  /**
   * 删除考勤记录
   */
  async deleteAttendanceRecord(req, res) {
    try {
      const { id } = req.params;
      await AttendanceService.deleteAttendanceRecord(id);
      ApiResponse.success(res, '删除考勤记录成功', null, 200);
    } catch (error) {
      log.error('删除考勤记录失败:', error);
      ApiResponse.error(res, error.message, 500);
    }
  }

  /**
   * 取消考勤申请（申请人本人取消待审批的申请）
   */
  async cancelAttendanceRequest(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      await AttendanceService.cancelAttendanceRequest(id, userId);
      ApiResponse.success(res, '取消申请成功', null, 200);
    } catch (error) {
      log.error('取消考勤申请失败:', error);
      ApiResponse.error(res, error.message, 500);
    }
  }

  /**
   * 审批考勤记录
   */
  async approveAttendanceRecord(req, res) {
    try {
      const { id } = req.params;
      const { status, note } = req.body;
      const approverId = req.user.id;

      const result = await AttendanceService.approveAttendanceRecord(id, approverId, status, note);
      ApiResponse.success(res, '审批考勤记录成功', result, 200);
    } catch (error) {
      log.error('审批考勤记录失败:', error);
      ApiResponse.error(res, error.message, 500);
    }
  }

  /**
   * 获取员工考勤统计
   * 只有”所有考勤查看”权限可查看全部，否则只能查看自己的统计数据
   */
  async getAttendanceStats(req, res) {
    try {
      const userId = req.user.id;
      const scopeInfo = await this.getAttendanceScope(userId);

      // 权限检查：无权限直接返回
      if (!scopeInfo.canView) {
        return ApiResponse.forbidden(res, '无权限查看考勤统计');
      }

      let { employee_id, start_date, end_date } = req.query;
      // 对于非管理员，强制使用当前用户ID
      employee_id = scopeInfo.isAdmin
        ? (employee_id ? parseInt(employee_id, 10) : userId)
        : userId;

      const result = await AttendanceService.getEmployeeAttendanceStats(
        employee_id,
        start_date,
        end_date
      );
      ApiResponse.success(res, '获取考勤统计成功', result, 200);
    } catch (error) {
      log.error('获取考勤统计失败:', error);
      ApiResponse.error(res, error.message, 500);
    }
  }

  /**
   * 获取用户休假余额
   * 只有”所有考勤查看”权限可查看全部，否则只能查看自己的休假余额
   */
  async getUserLeaveBalance(req, res) {
    try {
      const userId = req.user.id;
      const scopeInfo = await this.getAttendanceScope(userId);

      // 权限检查：无权限直接返回
      if (!scopeInfo.canView) {
        return ApiResponse.forbidden(res, '无权限查看休假余额');
      }

      // 对于非管理员，强制使用当前用户ID
      const employeeId = scopeInfo.isAdmin
        ? (req.query.employee_id ? parseInt(req.query.employee_id, 10) : userId)
        : userId;

      const result = await AttendanceService.getUserLeaveBalance(employeeId);
      ApiResponse.success(res, '获取休假余额成功', result, 200);
    } catch (error) {
      log.error('获取休假余额失败:', error);
      ApiResponse.error(res, error.message, 500);
    }
  }

  /**
   * 获取休假配置（每月休假天数等）
   */
  async getLeaveConfig(req, res) {
    try {
      const SystemSettingsService = require('../services/system-settings.service');
      const monthlyLeaveDays = await SystemSettingsService.getMonthlyLeaveDays();

      ApiResponse.success(res, '获取休假配置成功', {
        monthlyLeaveDays: monthlyLeaveDays
      }, 200);
    } catch (error) {
      log.error('获取休假配置失败:', error);
      ApiResponse.error(res, error.message, 500);
    }
  }

  /**
   * 获取待审批统计 - 仪表盘使用
   */
  async getPendingStats(req, res) {
    try {
      const userId = req.user.id;
      const { isAdmin } = await this.getAttendanceScope(userId);

      log.info('获取待审批统计 - userId:', userId, 'isAdmin:', isAdmin);

      const stats = await AttendanceService.getPendingStats(userId, isAdmin);
      log.debug('待审批统计结果:', stats);

      ApiResponse.success(res, '获取待审批统计成功', stats, 200);
    } catch (error) {
      log.error('获取待审批统计失败:', error);
      ApiResponse.error(res, error.message, 500);
    }
  }

  /**
   * 获取考勤仪表盘汇总统计
   */
  async getDashboardStats(req, res) {
    try {
      const userId = req.user.id;
      const scopeInfo = await this.getAttendanceScope(userId);

      // 权限检查
      if (!scopeInfo.canView) {
        return ApiResponse.forbidden(res, '无权限查看考勤统计');
      }

      const isAdmin = scopeInfo.isAdmin;
      const stats = await AttendanceService.getDashboardStats(userId, isAdmin);

      ApiResponse.success(res, '获取仪表盘统计成功', stats, 200);
    } catch (error) {
      log.error('获取仪表盘统计失败:', error);
      ApiResponse.error(res, error.message, 500);
    }
  }
}

module.exports = new AttendanceController();
