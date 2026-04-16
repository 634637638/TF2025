/**
 * 考勤服务
 */
const AttendanceRepository = require('../repositories/attendance.repository');
const ApiResponse = require('../utils/response');
const SystemSettingsService = require('./system-settings.service');
const log = require('../utils/log');

class AttendanceService {
  constructor() {
    this.repository = new AttendanceRepository();
  }

  /**
   * 获取员工工资模板中的休假天数配置
   * @param {number} employeeId - 员工ID
   * @returns {Promise<number>} 休假天数
   */
  async getEmployeeMonthlyLeaveDays(employeeId) {
    try {
      // 从员工的工资模板中获取休假天数
      const query = `
        SELECT st.rest_days
        FROM users u
        INNER JOIN salary_templates st ON u.salary_template_id = st.id
        WHERE u.id = ?
      `;
      const db = this.repository.getConnection();
      const [result] = await db.execute(query, [employeeId]);

      if (result && result.length > 0 && result[0].rest_days) {
        return parseInt(result[0].rest_days) || 2;
      }

      // 如果员工没有工资模板或没有配置，使用系统默认值
      return await SystemSettingsService.getMonthlyLeaveDays();
    } catch (error) {
      log.error('获取员工休假天数配置失败:', error);
      // 出错时使用系统默认值
      return await SystemSettingsService.getMonthlyLeaveDays();
    }
  }

  async getAttendanceRecords(filters, options) {
    try {
      return await this.repository.getAttendanceRecordsWithPagination(filters, options);
    } catch (error) {
      throw error;
    }
  }

  async getAttendanceRecordById(id) {
    try {
      return await this.repository.getAttendanceRecordById(id);
    } catch (error) {
      throw error;
    }
  }

  async createAttendanceRecord(data, userId) {
    try {
      data.created_by = userId;
      return await this.repository.createAttendanceRecord(data);
    } catch (error) {
      throw error;
    }
  }

  async updateAttendanceRecord(id, data) {
    try {
      return await this.repository.updateAttendanceRecord(id, data);
    } catch (error) {
      throw error;
    }
  }

  async deleteAttendanceRecord(id) {
    try {
      return await this.repository.deleteAttendanceRecord(id);
    } catch (error) {
      throw error;
    }
  }

  /**
   * 取消考勤申请（仅限申请人本人取消待审批的申请）
   * @param {number} id - 考勤记录ID
   * @param {number} userId - 当前用户ID
   */
  async cancelAttendanceRequest(id, userId) {
    try {
      // 首先获取记录信息
      const record = await this.repository.getAttendanceRecordById(id);

      if (!record) {
        throw new Error('考勤记录不存在');
      }

      // 检查是否为申请人本人
      if (record.employee_id !== userId) {
        throw new Error('只能取消自己的申请');
      }

      // 检查状态是否为待审批
      if (record.status !== 'pending') {
        throw new Error('只能取消待审批的申请');
      }

      // 删除记录
      return await this.repository.deleteAttendanceRecord(id);
    } catch (error) {
      throw error;
    }
  }

  async approveAttendanceRecord(id, approverId, status, note) {
    try {
      return await this.repository.approveAttendanceRecord(id, approverId, status, note);
    } catch (error) {
      throw error;
    }
  }

  async getEmployeeAttendanceStats(employeeId, startDate, endDate) {
    try {
      return await this.repository.getEmployeeAttendanceStats(employeeId, startDate, endDate);
    } catch (error) {
      throw error;
    }
  }

  /**
   * 获取用户当月已使用的休假天数
   */
  async getUserUsedMonthlyLeaveDays(employeeId, year, month) {
    try {
      return await this.repository.getUserUsedMonthlyLeaveDays(employeeId, year, month);
    } catch (error) {
      throw error;
    }
  }

  /**
   * 获取用户休假余额信息
   * 规则：
   * 1. 每月有固定天数的带薪休假（从员工工资模板获取）
   * 2. 上个月只有普通请假（leave）时，剩余休假不可累计
   * 3. 上个月只有带薪休假（monthly_leave）时，未用完部分仍可累计
   * 4. 累计上限最多 2 个月
   */
  async getUserLeaveBalance(employeeId) {
    try {
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth() + 1;

      // 从员工工资模板获取每月休假天数配置
      const monthlyLeaveDays = await this.getEmployeeMonthlyLeaveDays(employeeId);

      // 获取上个月的使用情况
      const lastMonthDate = new Date(currentYear, currentMonth - 2, 1);
      const lastMonthYear = lastMonthDate.getFullYear();
      const lastMonth = lastMonthDate.getMonth() + 1;

      const lastMonthUsed = await this.getUserUsedMonthlyLeaveDays(
        employeeId,
        lastMonthYear,
        lastMonth
      );
      const lastMonthRegularLeaveDays = await this.repository.getUserRegularLeaveDays(
        employeeId,
        lastMonthYear,
        lastMonth
      );

      // 只有上个月存在普通请假（leave）时，才阻断上月剩余额度累计到本月
      const lastMonthHasRegularLeave = Number(lastMonthRegularLeaveDays || 0) > 0;

      // 计算上个月剩余天数
      const lastMonthRemaining = Math.max(0, monthlyLeaveDays - (lastMonthUsed || 0));
      const carryForwardDays = lastMonthHasRegularLeave
        ? 0
        : Math.min(monthlyLeaveDays, lastMonthRemaining);

      const monthlyUsage = [{
        year: lastMonthYear,
        month: lastMonth,
        used: lastMonthUsed || 0,
        regularLeaveDays: lastMonthRegularLeaveDays || 0,
        limit: monthlyLeaveDays,
        isFull: (lastMonthUsed || 0) >= monthlyLeaveDays || lastMonthHasRegularLeave,
        remaining: carryForwardDays,
        hasRegularLeave: lastMonthHasRegularLeave
      }];

      // 获取当月已使用天数
      const currentMonthUsed = await this.getUserUsedMonthlyLeaveDays(
        employeeId,
        currentYear,
        currentMonth
      );

      // 本月总可用额度 = 本月额度 + 上月可累计额度，最多 2 个月
      const totalMonthlyQuota = Math.min(
        monthlyLeaveDays * 2,
        monthlyLeaveDays + carryForwardDays
      );
      const totalAvailableDays = totalMonthlyQuota - currentMonthUsed;

      const availableDays = Math.max(0, totalAvailableDays);

      return {
        monthlyLimit: monthlyLeaveDays,
        used: currentMonthUsed || 0,
        available: availableDays,
        totalQuota: totalMonthlyQuota,
        isLeaveDisabled: false,
        consecutiveFullMonths: 0,
        monthlyHistory: monthlyUsage,
        lastMonthRemaining: carryForwardDays,
        message: carryForwardDays > 0
          ? `上月剩余${carryForwardDays}天可累积到本月，本月总额度${totalMonthlyQuota}天，当前还可用${availableDays}天`
          : (lastMonthHasRegularLeave
            ? '上月存在请假记录，本月不累计上月剩余休假额度'
            : null)
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * 获取待审批统计 - 仪表盘使用
   * @param {number} userId - 用户ID
   * @param {boolean} isAdmin - 是否为管理员
   * @returns {Promise<Object>} 待审批统计
   */
  async getPendingStats(userId, isAdmin) {
    try {
      const db = this.repository.getConnection();

      // 构建查询条件
      const whereClause = isAdmin ? 'WHERE' : 'WHERE employee_id = ? AND';
      const params = isAdmin ? [] : [userId];

      // 获取待审批的考勤记录数量
      // record_type 可能的值: 'monthly_leave', 'overtime', 'late', 'leave'
      const [attendanceResult] = await db.execute(
        `SELECT COUNT(*) as count FROM attendance_records ${whereClause} status = 'pending' AND record_type IN ('monthly_leave', 'overtime', 'late', 'leave')`,
        params
      );

      // 获取待审批的请假记录数量（包括monthly_leave和leave）
      const [leaveResult] = await db.execute(
        `SELECT COUNT(*) as count FROM attendance_records ${whereClause} status = 'pending' AND record_type IN ('monthly_leave', 'leave')`,
        params
      );

      // 获取待审批的加班记录数量
      const [overtimeResult] = await db.execute(
        `SELECT COUNT(*) as count FROM attendance_records ${whereClause} status = 'pending' AND record_type = 'overtime'`,
        params
      );

      return {
        total: attendanceResult[0].count || 0,
        leave: leaveResult[0].count || 0,
        overtime: overtimeResult[0].count || 0
      };
    } catch (error) {
      log.error('获取待审批统计失败:', error);
      throw error;
    }
  }

  /**
   * 获取考勤仪表盘汇总统计
   * @param {number} userId - 用户ID
   * @param {boolean} isAdmin - 是否为管理员（查看所有员工或仅自己）
   * @returns {Promise<Object>} 汇总统计数据
   */
  async getDashboardStats(userId, isAdmin) {
    try {
      const db = this.repository.getConnection();
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth() + 1;

      // 上月
      const lastMonth = currentMonth === 1 ? 12 : currentMonth - 1;
      const lastMonthYear = currentMonth === 1 ? currentYear - 1 : currentYear;

      // 构建基础查询条件
      const employeeCondition = isAdmin ? '' : 'AND employee_id = ?';
      const params = isAdmin ? [] : [userId];

      // 上月休假天数（monthly_leave）
      const [lastMonthLeaveResult] = await db.execute(
        `SELECT COALESCE(SUM(monthly_leave_days), 0) as total_days
         FROM attendance_records
         WHERE YEAR(record_date) = ? AND MONTH(record_date) = ?
         AND record_type = 'monthly_leave' AND status = 'approved' ${employeeCondition}`,
        isAdmin ? [lastMonthYear, lastMonth] : [lastMonthYear, lastMonth, userId]
      );

      // 上月加班小时数
      const [lastMonthOvertimeResult] = await db.execute(
        `SELECT COALESCE(SUM(overtime_hours), 0) as total_hours
         FROM attendance_records
         WHERE YEAR(record_date) = ? AND MONTH(record_date) = ?
         AND record_type = 'overtime' AND status = 'approved' ${employeeCondition}`,
        isAdmin ? [lastMonthYear, lastMonth] : [lastMonthYear, lastMonth, userId]
      );

      // 本月休假天数（monthly_leave）
      const [currentMonthLeaveResult] = await db.execute(
        `SELECT COALESCE(SUM(monthly_leave_days), 0) as total_days
         FROM attendance_records
         WHERE YEAR(record_date) = ? AND MONTH(record_date) = ?
         AND record_type = 'monthly_leave' AND status IN ('pending', 'approved') ${employeeCondition}`,
        isAdmin ? [currentYear, currentMonth] : [currentYear, currentMonth, userId]
      );

      // 本月请假天数（leave，无薪）
      const [currentMonthUnpaidLeaveResult] = await db.execute(
        `SELECT COALESCE(SUM(leave_days), 0) as total_days
         FROM attendance_records
         WHERE YEAR(record_date) = ? AND MONTH(record_date) = ?
         AND record_type = 'leave' AND status IN ('pending', 'approved') ${employeeCondition}`,
        isAdmin ? [currentYear, currentMonth] : [currentYear, currentMonth, userId]
      );

      // 本月加班小时数
      const [currentMonthOvertimeResult] = await db.execute(
        `SELECT COALESCE(SUM(overtime_hours), 0) as total_hours
         FROM attendance_records
         WHERE YEAR(record_date) = ? AND MONTH(record_date) = ?
         AND record_type = 'overtime' AND status IN ('pending', 'approved') ${employeeCondition}`,
        isAdmin ? [currentYear, currentMonth] : [currentYear, currentMonth, userId]
      );

      // 本月费用统计（计算所有 pending + approved 状态的加班费和请假扣款）
      // 获取员工工资模板信息（加班费率和基本工资）
      const [employeeSalaries] = await db.execute(
        `SELECT u.id as employee_id, st.overtime_hourly_rate, st.base_salary
         FROM users u
         LEFT JOIN salary_templates st ON u.salary_template_id = st.id
         WHERE u.status = 1 ${isAdmin ? '' : 'AND u.id = ?'}`,
        isAdmin ? [] : [userId]
      );

      // 创建员工工资信息映射，如果没有工资模板则使用默认值
      const rateMap = new Map();
      const salaryMap = new Map();
      const daysInMonth = new Date(currentYear, currentMonth, 0).getDate(); // 当月天数

      for (const row of employeeSalaries) {
        // 加班费率：如果没有设置，默认按基本工资/174小时计算（每月工作时间约174小时）
        let overtimeRate = Number(row.overtime_hourly_rate || 0);
        const baseSalary = Number(row.base_salary || 3000); // 默认基本工资3000
        if (overtimeRate === 0 && baseSalary > 0) {
          overtimeRate = baseSalary / 174; // 默认加班费率 = 月工资/174
        }
        rateMap.set(row.employee_id, overtimeRate);

        // 日工资 = 月工资/当月天数
        const dailySalary = baseSalary / daysInMonth;
        salaryMap.set(row.employee_id, dailySalary);
      }

      // 获取本月所有加班记录计算加班费（pending + approved）
      const [overtimeRecords] = await db.execute(
        `SELECT employee_id, overtime_hours, status
         FROM attendance_records
         WHERE YEAR(record_date) = ? AND MONTH(record_date) = ?
         AND record_type = 'overtime' AND status IN ('pending', 'approved') ${employeeCondition}`,
        isAdmin ? [currentYear, currentMonth] : [currentYear, currentMonth, userId]
      );

      let overtimePay = 0;
      for (const record of overtimeRecords) {
        const rate = rateMap.get(record.employee_id) || 20; // 默认20元/小时
        overtimePay += Number(record.overtime_hours || 0) * rate;
      }

      // 获取本月所有请假（leave类型）扣款（pending + approved）
      const [leaveRecords] = await db.execute(
        `SELECT employee_id, leave_days, status
         FROM attendance_records
         WHERE YEAR(record_date) = ? AND MONTH(record_date) = ?
         AND record_type = 'leave' AND status IN ('pending', 'approved') ${employeeCondition}`,
        isAdmin ? [currentYear, currentMonth] : [currentYear, currentMonth, userId]
      );

      let leaveDeduction = 0;
      for (const record of leaveRecords) {
        const dailySalary = salaryMap.get(record.employee_id) || 100; // 默认100元/天
        leaveDeduction += Number(record.leave_days || 0) * dailySalary;
      }

      return {
        lastMonth: {
          leaveDays: Number(lastMonthLeaveResult[0]?.total_days || 0),
          overtimeHours: Number(lastMonthOvertimeResult[0]?.total_hours || 0)
        },
        currentMonth: {
          leaveDays: Number(currentMonthLeaveResult[0]?.total_days || 0),
          unpaidLeaveDays: Number(currentMonthUnpaidLeaveResult[0]?.total_days || 0),
          overtimeHours: Number(currentMonthOvertimeResult[0]?.total_hours || 0)
        },
        pending: {
          overtimePay: overtimePay,
          leaveDeduction: leaveDeduction,
          count: overtimeRecords.length + leaveRecords.length
        }
      };
    } catch (error) {
      log.error('获取仪表盘统计失败:', error);
      throw error;
    }
  }
}

module.exports = new AttendanceService();
