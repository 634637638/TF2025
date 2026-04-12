/**
 * 工资计算服务（核心）
 * 负责计算员工工资：底薪 + 提成 + 加班费 - 扣除
 */
const { getDatabase } = require('../config/database');
const log = require('../utils/log');

const EXPECTED_SALARY_ERRORS = new Set([
  '员工不存在',
  '员工没有关联工资模板'
]);

class SalaryCalculatorService {
  /**
   * 计算员工工资
   * @param {number} employeeId - 员工ID
   * @param {string} periodStart - 周期开始日期
   * @param {string} periodEnd - 周期结束日期
   * @param {object} options - 选项
   */
  async calculateSalary(employeeId, periodStart, periodEnd, options = {}) {
    try {
      // 1. 获取员工信息和工资模板
      const employeeInfo = await this._getEmployeeWithTemplate(employeeId);
      if (!employeeInfo) {
        throw new Error('员工不存在');
      }

      // 检查是否有关联工资模板（template_id 不为空）
      if (!employeeInfo.template_id || !employeeInfo.base_salary) {
        throw new Error('员工没有关联工资模板');
      }

      // 2. 获取销售数据（传入员工信息用于过滤有提成的销售）
      const salesData = await this._getSalesData(employeeId, periodStart, periodEnd, employeeInfo);

      // 3. 获取考勤数据
      const attendanceData = await this._getAttendanceData(employeeId, periodStart, periodEnd);

      // 4. 计算工资各组成部分
      const salaryBreakdown = {
        employee_id: employeeId,
        salary_template_id: employeeInfo.template_id,
        period_start: periodStart,
        period_end: periodEnd,

        // 底薪
        base_salary: employeeInfo.base_salary || 0,
        base_salary_adjustment: 0,
        base_salary_note: '',

        // 提成
        commission_amount: 0,
        commission_detail: JSON.stringify(salesData.details || []),
        sales_count: salesData.count || 0, // 销售数量（台）

        // 加班费
        overtime_hours: attendanceData.overtimeHours,
        overtime_pay: 0,

        // 奖励
        performance_bonus: 0,
        other_bonus: 0,

        // 扣除
        leave_days: attendanceData.leaveDays,
        leave_deduction: 0,
        other_deduction: 0,

        // 汇总
        net_salary: 0,
        status: 'approved' // 管理员计算后直接进入待发放状态
      };

      // 5. 计算底薪（含工龄调整）
      const baseSalaryResult = await this._calculateBaseSalary(
        employeeInfo,
        salaryBreakdown,
        periodEnd
      );
      // base_salary 应该是涨薪后的总额
      salaryBreakdown.base_salary = baseSalaryResult.base_salary + baseSalaryResult.adjustment;
      salaryBreakdown.base_salary_adjustment = baseSalaryResult.adjustment;
      salaryBreakdown.base_salary_note = baseSalaryResult.note;

      // 6. 计算提成
      salaryBreakdown.commission_amount = this._calculateCommission(
        salesData,
        employeeInfo
      );

      // 7. 计算加班费
      salaryBreakdown.overtime_pay = this._calculateOvertimePay(
        attendanceData.overtimeHours,
        employeeInfo.overtime_hourly_rate || 0
      );

      // 8. 计算扣除
      const periodDays = this._calculatePeriodDays(periodStart, periodEnd);
      const deductions = this._calculateDeductions(
        attendanceData,
        employeeInfo,
        salaryBreakdown.base_salary,
        periodDays
      );
      salaryBreakdown.leave_deduction = deductions.leaveDeduction;
      salaryBreakdown.leave_days = deductions.actualLeaveDays;

      // 10. 检查长期请假（请假超过当月天数的一半）
      // 长期请假则无工资、无提成
      const workDays = this._calculateWorkDays(periodStart, periodEnd);
      if (attendanceData.leaveDays > workDays / 2) {
        salaryBreakdown.base_salary = 0;
        salaryBreakdown.base_salary_adjustment = 0;
        salaryBreakdown.commission_amount = 0;
        salaryBreakdown.overtime_pay = 0;
        salaryBreakdown.leave_deduction = 0;
        salaryBreakdown.base_salary_note = '长期请假，无工资无提成';
      }

      // 11. 计算实发工资（不扣社保个税）
      // base_salary 已经包含了涨薪调整，不需要再加 base_salary_adjustment
      salaryBreakdown.net_salary =
        salaryBreakdown.base_salary +
        salaryBreakdown.commission_amount +
        salaryBreakdown.overtime_pay +
        salaryBreakdown.performance_bonus +
        salaryBreakdown.other_bonus -
        (salaryBreakdown.leave_deduction + salaryBreakdown.other_deduction);

      // 12. 添加工作天数相关字段
      // 实际工作天数 = 月份天数 - 请假天数
      // 注意：休假（monthly_leave）不影响工作天数计算
      salaryBreakdown.actual_work_days = periodDays - salaryBreakdown.leave_days;

      return salaryBreakdown;
    } catch (error) {
      const isExpectedError = EXPECTED_SALARY_ERRORS.has(error.message);

      if (!isExpectedError) {
        log.error('计算工资失败:', error);
      } else if (options.logExpectedErrors) {
        log.warn(`工资计算已跳过员工 ${employeeId}: ${error.message}`);
      }

      throw error;
    }
  }

  /**
   * 获取员工信息和工资模板
   */
  async _getEmployeeWithTemplate(employeeId) {
    const db = getDatabase();
    const conn = await db.getConnection();

    try {
      const query = `
        SELECT
          u.id,
          u.username,
          u.name,
          u.salary_template_id,
          u.created_at,
          u.hire_date,
          st.*,
          st.id as template_id
        FROM users u
        LEFT JOIN salary_templates st ON u.salary_template_id = st.id
        WHERE u.id = ? AND u.status = 1
      `;
      const [rows] = await conn.execute(query, [employeeId]);

      const employee = rows[0] || null;
      if (employee) {
        // 优先使用 hire_date，如果为空则使用 created_at 作为入职日期
        employee.hire_date = employee.hire_date || employee.created_at;
      }

      return employee;
    } finally {
      conn.release();
    }
  }

  /**
   * 获取销售数据（统计全新机和二手机，排除请假期间的销售）
   * 只返回实际有提成的销售记录
   */
  async _getSalesData(employeeId, periodStart, periodEnd, employeeInfo = null) {
    const db = getDatabase();
    const conn = await db.getConnection();

    try {
      // 首先获取该员工在周期内的请假日期
      const leaveQuery = `
        SELECT record_date, leave_days
        FROM attendance_records
        WHERE employee_id = ?
          AND record_date BETWEEN ? AND ?
          AND record_type = 'leave'
          AND status = 'approved'
      `;
      const [leaveRows] = await conn.execute(leaveQuery, [employeeId, periodStart, periodEnd]);

      // 构建请假日期集合（考虑到leave_days可能>1）
      const leaveDates = new Set();
      leaveRows.forEach(row => {
        const leaveDate = new Date(row.record_date);
        const leaveDays = parseInt(row.leave_days) || 1;
        for (let i = 0; i < leaveDays; i++) {
          const date = new Date(leaveDate);
          date.setDate(date.getDate() + i);
          leaveDates.add(date.toISOString().split('T')[0]);
        }
      });

      // 查询周期内该员工的销售记录（统计全新机和二手机）
      // 排除请假日期的销售
      // 排除批发（wholesale）、调货（peer_transfer）和划拨（supplier_proxy）的手机，这些不计入员工提成
      const query = `
        SELECT
          p.id as phone_id,
          p.imei,
          p.sale_price,
          p.purchase_cost,
          p.salestime,
          (p.sale_price - p.purchase_cost) as profit,
          p.is_new,
          c.name as customer_name,
          m.name as model_name,
          co.name as color_name
        FROM phones p
        LEFT JOIN models m ON p.model_id = m.id
        LEFT JOIN colors co ON p.color_id = co.id
        LEFT JOIN (
          SELECT s.customer_id, s.phone_id, s.sale_type
          FROM sales s
          INNER JOIN (
            SELECT phone_id, MAX(created_at) as max_created
            FROM sales
            GROUP BY phone_id
          ) latest ON s.phone_id = latest.phone_id AND s.created_at = latest.max_created
        ) latest_sale ON p.id = latest_sale.phone_id
        LEFT JOIN customers c ON latest_sale.customer_id = c.id
        WHERE p.sale_operator_id = ?
          AND p.salestime IS NOT NULL
          AND DATE(p.salestime) BETWEEN ? AND ?
          AND p.status = 'sold'
          AND (latest_sale.sale_type IS NULL OR latest_sale.sale_type NOT IN ('wholesale', 'supplier_proxy', 'peer_transfer'))
        ORDER BY p.salestime DESC
      `;

      const [rows] = await conn.execute(query, [employeeId, periodStart, periodEnd]);

      // 调试：记录查询结果
      log.debug(`[工资计算] 员工 ${employeeId} 在 ${periodStart} ~ ${periodEnd} 的销售查询：`);
      log.debug(`  - 原始查询结果数: ${rows.length}`);
      log.debug(`  - 请假日期集合: ${leaveDates.size > 0 ? Array.from(leaveDates).sort().join(', ') : '无'}`);

      // 过滤掉请假日期的销售
      let filteredRows = rows.filter(r => {
        const saleDate = new Date(r.salestime).toISOString().split('T')[0];
        return !leaveDates.has(saleDate);
      });

      log.debug(`  - 过滤请假日期后结果数: ${filteredRows.length}`);

      // 获取提成配置（从员工模板中获取）
      const commissionType = employeeInfo?.commission_type || 'fixed';
      const newRate = parseFloat(employeeInfo?.commission_new_fixed || employeeInfo?.commission_fixed || 0);
      const usedRate = parseFloat(employeeInfo?.commission_used_fixed || 0);
      const commissionPercentage = parseFloat(employeeInfo?.commission_percentage || 0);

      // 进一步过滤：只保留实际有提成的销售
      // 判断该员工是否有提成配置：
      // - 固定提成模式：只要全新机或二手机任一提成率 > 0
      // - 利润提成模式：只要利润提成率 > 0
      let hasCommissionConfig = false;
      if (commissionType === 'fixed') {
        hasCommissionConfig = (newRate > 0 || usedRate > 0);
      } else if (commissionType === 'percentage') {
        hasCommissionConfig = (commissionPercentage > 0);
      }

      // 如果没有任何提成配置，则不过滤（保持向后兼容，显示所有销售）
      // 如果有提成配置，则只保留有提成的销售
      if (hasCommissionConfig) {
        if (commissionType === 'fixed') {
          filteredRows = filteredRows.filter(r => {
            const isNew = r.is_new === 1;
            if (isNew && newRate > 0) return true;  // 全新机有提成
            if (!isNew && usedRate > 0) return true;  // 二手机有提成
            return false;  // 对应机型没有提成
          });
          log.debug(`  - 过滤无提成销售后结果数: ${filteredRows.length} (全新机提成率=${newRate}, 二手机提成率=${usedRate})`);
        }
        // percentage 模式不过滤，因为所有销售都有利润提成
      } else {
        log.debug('  - 该员工无提成配置，保留所有销售记录');
      }

      const details = filteredRows.map(r => ({
        phone_id: r.phone_id,
        imei: r.imei,
        sale_price: parseFloat(r.sale_price) || 0,
        purchase_cost: parseFloat(r.purchase_cost) || 0,
        profit: parseFloat(r.profit) || 0,
        sale_time: r.salestime,
        is_new: r.is_new,
        customer_name: r.customer_name || null,
        model_name: r.model_name || null,
        color_name: r.color_name || null
      }));

      const newRows = filteredRows.filter(r => r.is_new === 1);
      const usedRows = filteredRows.filter(r => r.is_new === 0 || r.is_new === null);

      return {
        count: filteredRows.length,
        new_count: newRows.length,
        used_count: usedRows.length,
        revenue: filteredRows.reduce((sum, r) => sum + (parseFloat(r.sale_price) || 0), 0),
        cost: filteredRows.reduce((sum, r) => sum + (parseFloat(r.purchase_cost) || 0), 0),
        profit: filteredRows.reduce((sum, r) => sum + (parseFloat(r.profit) || 0), 0),
        details,
        excludedCount: rows.length - filteredRows.length // 记录被排除的销售数量
      };
    } finally {
      conn.release();
    }
  }

  /**
   * 获取考勤数据（支持2个月累积休假逻辑）
   * - 请假（leave）记录：只查询当月的记录
   * - 休假（monthly_leave）记录：查询2个月（当月+上月）来计算累积和超额
   * - 加班（overtime）记录：只查询当月的记录
   */
  async _getAttendanceData(employeeId, periodStart, periodEnd) {
    const db = getDatabase();
    const conn = await db.getConnection();

    try {
      const currentMonthStartDate = new Date(periodStart);
      currentMonthStartDate.setDate(1);
      const currentMonthStart = currentMonthStartDate.toISOString().split('T')[0];

      const lastMonthStartDate = new Date(currentMonthStartDate);
      lastMonthStartDate.setMonth(lastMonthStartDate.getMonth() - 1);
      const lastMonthStart = lastMonthStartDate.toISOString().split('T')[0];

      // 查询1：当月的请假和加班记录（只查询计算周期内的）
      const currentPeriodQuery = `
        SELECT
          record_type,
          leave_days,
          overtime_hours
        FROM attendance_records
        WHERE employee_id = ?
          AND record_date BETWEEN ? AND ?
          AND status = 'approved'
          AND record_type IN ('leave', 'overtime')
        ORDER BY record_date
      `;

      const [currentRows] = await conn.execute(currentPeriodQuery, [employeeId, periodStart, periodEnd]);

      const result = {
        leaveDays: 0,
        overtimeHours: 0
      };

      // 统计当月的请假和加班
      currentRows.forEach(row => {
        if (row.record_type === 'leave') {
          result.leaveDays += parseFloat(row.leave_days) || 0;
        } else if (row.record_type === 'overtime') {
          result.overtimeHours += parseFloat(row.overtime_hours) || 0;
        }
      });

      // 查询2：2个月的休假记录（用于计算累积和超额）
      const restDaysQuery = `
        SELECT
          monthly_leave_days,
          record_date
        FROM attendance_records
        WHERE employee_id = ?
          AND record_date BETWEEN ? AND ?
          AND status = 'approved'
          AND record_type = 'monthly_leave'
        ORDER BY record_date
      `;

      const [restRows] = await conn.execute(restDaysQuery, [employeeId, lastMonthStart, periodEnd]);

      let lastMonthRestDays = 0;
      let currentMonthRestDays = 0;
      restRows.forEach(row => {
        const restDays = parseFloat(row.monthly_leave_days) || 0;
        const recordDate = new Date(row.record_date);
        if (recordDate < currentMonthStartDate) {
          lastMonthRestDays += restDays;
        } else {
          currentMonthRestDays += restDays;
        }
      });

      // 查询3：上个月是否存在普通请假（leave），有则不累计上月剩余休假额度
      const lastMonthLeaveQuery = `
        SELECT COUNT(*) AS leave_count
        FROM attendance_records
        WHERE employee_id = ?
          AND record_date BETWEEN ? AND DATE_SUB(?, INTERVAL 1 DAY)
          AND status = 'approved'
          AND record_type = 'leave'
      `;
      const [lastMonthLeaveRows] = await conn.execute(lastMonthLeaveQuery, [employeeId, lastMonthStart, currentMonthStart]);
      const lastMonthHasRegularLeave = (lastMonthLeaveRows[0]?.leave_count || 0) > 0;

      // 获取员工模板以确定月均休假天数
      const templateQuery = `
        SELECT st.rest_days
        FROM users u
        LEFT JOIN salary_templates st ON u.salary_template_id = st.id
        WHERE u.id = ?
      `;
      const [templateRows] = await conn.execute(templateQuery, [employeeId]);
      const monthlyRestDays = (templateRows[0]?.rest_days) || 2;

      // 上个月只有普通请假才阻断累计；只有休假不阻断累计，且累计上限最多 2 个月。
      const carryForwardRestDays = lastMonthHasRegularLeave
        ? 0
        : Math.min(monthlyRestDays, Math.max(0, monthlyRestDays - lastMonthRestDays));
      const allowedCurrentRestDays = Math.min(
        monthlyRestDays * 2,
        monthlyRestDays + carryForwardRestDays
      );

      // 当月休假超出本月可用额度时，超出部分转为请假扣款
      if (currentMonthRestDays > allowedCurrentRestDays) {
        const excessDays = currentMonthRestDays - allowedCurrentRestDays;
        result.leaveDays += excessDays;
      }

      return result;
    } finally {
      conn.release();
    }
  }

  /**
   * 计算周期天数
   */
  _calculatePeriodDays(startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    return Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
  }

  /**
   * 计算工作日天数（简化版，排除周末）
   */
  _calculateWorkDays(startDate, endDate) {
    let count = 0;
    let current = new Date(startDate);
    const end = new Date(endDate);

    while (current <= end) {
      const dayOfWeek = current.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) { // 排除周六日
        count++;
      }
      current.setDate(current.getDate() + 1);
    }

    return count;
  }

  /**
   * 计算底薪（含自动涨薪调整）
   * 新逻辑：支持按月份计算涨薪，设置最高上限
   * 返回：original_base_salary (原始底薪), adjustment (调整金额)
   */
  async _calculateBaseSalary(employeeInfo, breakdown, periodEnd) {
    let baseSalary = parseFloat(breakdown.base_salary) || 0;
    let adjustment = 0;
    let note = '';

    // 检查是否有自动涨薪规则（从模板中获取）
    if (employeeInfo.auto_raise_rule) {
      try {
        const rule = typeof employeeInfo.auto_raise_rule === 'string'
          ? JSON.parse(employeeInfo.auto_raise_rule)
          : employeeInfo.auto_raise_rule;

        if (rule.enabled && rule.months && rule.amount) {
          const hireDate = new Date(employeeInfo.hire_date);
          // 使用结算月份的结束日期计算工龄涨薪
          const currentDate = periodEnd ? new Date(periodEnd) : new Date();

          // 计算入职月数
          const monthsOfService = this._calculateMonthsOfService(hireDate, currentDate);

          // 计算涨薪次数
          const raiseCount = Math.floor(monthsOfService / rule.months);

          if (raiseCount > 0) {
            const potentialAdjustment = raiseCount * parseFloat(rule.amount);
            const maxSalary = parseFloat(rule.max_salary) || 0;

            // 检查是否超过最高上限
            const newSalary = baseSalary + potentialAdjustment;
            if (maxSalary > 0 && newSalary > maxSalary) {
              // 超过上限，只涨到上限
              adjustment = maxSalary - baseSalary;
              note = `工龄涨薪：每${rule.months}个月涨${rule.amount}元，已达到上限${maxSalary}元`;
            } else {
              adjustment = potentialAdjustment;
              note = `工龄涨薪：每${rule.months}个月涨${rule.amount}元，已涨薪${raiseCount}次`;
            }
          }
        }
      } catch (e) {
        // JSON 解析失败，忽略自动涨薪
        log.warn('解析自动涨薪规则失败:', e);
      }
    }

    // 返回原始底薪和调整金额（分开存储，便于显示）
    return {
      base_salary: baseSalary,  // 原始底薪
      adjustment,  // 调整金额
      note
    };
  }

  /**
   * 计算入职月数
   * @param {Date} hireDate - 入职日期
   * @param {Date} currentDate - 当前日期
   * @returns {number} 入职月数
   */
  _calculateMonthsOfService(hireDate, currentDate) {
    const years = currentDate.getFullYear() - hireDate.getFullYear();
    const months = currentDate.getMonth() - hireDate.getMonth();
    return years * 12 + months;
  }

  /**
   * 计算提成
   */
  _calculateCommission(salesData, template) {
    const type = template.commission_type;

    if (type === 'fixed') {
      // 固定金额/台（按全新/二手机分别计算）
      const newRate = parseFloat(template.commission_new_fixed || template.commission_fixed) || 0;
      const usedRate = parseFloat(template.commission_used_fixed) || 0;
      const newCount = parseInt(salesData.new_count) || 0;
      const usedCount = parseInt(salesData.used_count) || 0;

      return (newCount * newRate) + (usedCount * usedRate);
    } else if (type === 'percentage') {
      // 利润百分比
      const percentage = parseFloat(template.commission_percentage) || 0;
      return salesData.profit * (percentage / 100);
    }

    return 0;
  }

  /**
   * 计算加班费
   */
  _calculateOvertimePay(overtimeHours, hourlyRate) {
    return (parseFloat(overtimeHours) || 0) * (parseFloat(hourlyRate) || 0);
  }

  /**
   * 计算请假扣除
   * @param {object} attendanceData - 考勤数据
   * @param {object} template - 工资模板
   * @param {number} baseSalary - 底薪
   * @param {number} periodDays - 当月天数
   * @returns {object} 扣除金额和实际请假天数
   */
  _calculateDeductions(attendanceData, template, baseSalary, periodDays) {
    // 计算日薪 = 当月底薪 ÷ 当月天数
    const dailySalary = periodDays > 0 ? baseSalary / periodDays : 0;

    // 请假天数直接使用 attendanceData.leaveDays（已包含累积超出的部分转为请假）
    const actualLeaveDays = attendanceData.leaveDays || 0;

    // 请假扣除 = 日薪 × 请假天数
    const leaveDeduction = dailySalary * actualLeaveDays;

    return {
      leaveDeduction,
      actualLeaveDays
    };
  }

  /**
   * 计算社保
   */
  _calculateSocialInsurance(grossSalary, rate) {
    return grossSalary * (parseFloat(rate) / 100);
  }

  /**
   * 计算个税（简化版）
   */
  _calculateTax(taxableIncome, rate) {
    const threshold = 5000; // 起征点
    if (taxableIncome <= threshold) {
      return 0;
    }

    const userRate = parseFloat(rate) || 0;
    if (userRate > 0) {
      return (taxableIncome - threshold) * (userRate / 100);
    }

    // 默认累进税率
    const excess = taxableIncome - threshold;
    if (excess <= 3000) return excess * 0.03;
    if (excess <= 12000) return excess * 0.1 - 210;
    if (excess <= 25000) return excess * 0.2 - 1410;
    if (excess <= 35000) return excess * 0.25 - 2660;
    if (excess <= 55000) return excess * 0.3 - 4410;
    if (excess <= 80000) return excess * 0.35 - 7160;
    return excess * 0.45 - 15160;
  }

  /**
   * 批量计算工资
   */
  async batchCalculateSalary(employeeIds, periodStart, periodEnd, options = {}) {
    const results = [];

    for (const employeeId of employeeIds) {
      try {
        const salary = await this.calculateSalary(employeeId, periodStart, periodEnd, options);
        results.push({ success: true, data: salary });
      } catch (error) {
        results.push({
          success: false,
          employee_id: employeeId,
          error: error.message
        });
      }
    }

    return results;
  }
}

module.exports = new SalaryCalculatorService();
