/**
 * 工资记录服务
 */
const SalaryRecordRepository = require('../repositories/salary-record.repository');
const SalaryCalculatorService = require('./salary-calculator.service');
const { getDatabase } = require('../config/database');
const log = require('../utils/log');

class SalaryRecordService {
  constructor() {
    this.repository = new SalaryRecordRepository();
    this.calculator = SalaryCalculatorService;
  }

  async getSalaryRecords(filters, options) {
    try {
      return await this.repository.getSalaryRecordsWithPagination(filters, options);
    } catch (error) {
      throw error;
    }
  }

  async getSalaryRecordById(id) {
    try {
      return await this.repository.getSalaryRecordById(id);
    } catch (error) {
      throw error;
    }
  }

  async createSalaryRecord(data, userId) {
    try {
      data.created_by = userId;
      return await this.repository.createSalaryRecord(data);
    } catch (error) {
      throw error;
    }
  }

  async updateSalaryRecord(id, data) {
    try {
      return await this.repository.updateSalaryRecord(id, data);
    } catch (error) {
      throw error;
    }
  }

  async deleteSalaryRecord(id) {
    try {
      return await this.repository.deleteSalaryRecord(id);
    } catch (error) {
      throw error;
    }
  }

  async calculateSalary(employeeId, periodStart, periodEnd) {
    try {
      return await this.calculator.calculateSalary(employeeId, periodStart, periodEnd);
    } catch (error) {
      throw error;
    }
  }

  /**
   * 保存计算的工资（UPSERT）
   * 如果员工在该周期已有记录，则更新；否则创建新记录
   */
  async saveCalculatedSalary(salaryData, userId) {
    try {
      salaryData.created_by = userId;
      return await this.repository.upsertSalaryRecord(salaryData);
    } catch (error) {
      throw error;
    }
  }

  async batchCalculateSalaries(employeeIds, periodStart, periodEnd) {
    try {
      return await this.calculator.batchCalculateSalary(employeeIds, periodStart, periodEnd);
    } catch (error) {
      throw error;
    }
  }

  async approveSalaryRecord(id, approverId) {
    try {
      return await this.repository.approveSalaryRecord(id, approverId);
    } catch (error) {
      throw error;
    }
  }

  /**
   * 标记工资为已发放
   * @param {number} id - 工资记录ID
   * @param {object} options - 选项 { payment_method: string }
   */
  async markAsPaid(id, options = {}) {
    try {
      return await this.repository.markAsPaid(id, options);
    } catch (error) {
      throw error;
    }
  }

  async getSalaryStats(filters) {
    try {
      return await this.repository.getSalaryStats(filters);
    } catch (error) {
      throw error;
    }
  }

  async checkExistingRecord(employeeId, periodStart, periodEnd) {
    try {
      return await this.repository.checkExistingRecord(employeeId, periodStart, periodEnd);
    } catch (error) {
      throw error;
    }
  }

  async getRecentRecordsByEmployee(employeeId, limit = 6) {
    try {
      return await this.repository.getRecentRecordsByEmployee(employeeId, limit);
    } catch (error) {
      throw error;
    }
  }

  /**
   * 批量重算某月工资（覆盖旧记录）
   */
  async bulkRecalculateByPeriod(periodStart, periodEnd, operatorId) {
    const db = getDatabase();
    const conn = await db.getConnection();

    try {
      const [employees] = await conn.execute(
        `SELECT id FROM users WHERE status = 1 AND salary_template_id IS NOT NULL`
      );

      const results = {
        total: employees.length,
        recalculated: 0,
        errors: []
      };

      for (const emp of employees) {
        try {
          const calculated = await this.calculator.calculateSalary(emp.id, periodStart, periodEnd);
          const existing = await this.repository.getRecordByEmployeePeriod(emp.id, periodStart, periodEnd);

          if (existing) {
            calculated.status = existing.status || calculated.status;
            calculated.payment_method = existing.payment_method || calculated.payment_method || null;
            calculated.paid_at = existing.paid_at || calculated.paid_at || null;
            calculated.payment_date = existing.payment_date || calculated.payment_date || null;
            calculated.approved_by = existing.approved_by || calculated.approved_by || null;
            calculated.approved_at = existing.approved_at || calculated.approved_at || null;
            calculated.created_by = existing.created_by || operatorId;
          } else {
            calculated.created_by = operatorId;
          }

          await this.repository.upsertSalaryRecord(calculated);
          results.recalculated += 1;
        } catch (error) {
          results.errors.push({ employee_id: emp.id, message: error.message });
        }
      }

      return results;
    } finally {
      conn.release();
    }
  }

  /**
   * 批量获取员工销售数据（用于薪资计算）
   * 返回指定时间段内所有员工的销售统计（含全新机和二手机）
   * 排除请假日期的销售数据（与工资计算逻辑保持一致）
   */
  async getEmployeesSalesData(periodStart, periodEnd) {
    const db = getDatabase();
    const conn = await db.getConnection();

    try {
      // 首先获取所有员工在周期内的请假日期
      const leaveQuery = `
        SELECT employee_id, record_date, leave_days
        FROM attendance_records
        WHERE record_date BETWEEN ? AND ?
          AND status = 'approved'
          AND record_type = 'leave'
      `;
      const [leaveRows] = await conn.execute(leaveQuery, [periodStart, periodEnd]);

      // 构建每个员工的请假日期集合
      const employeeLeaveDates = new Map();
      leaveRows.forEach(row => {
        const employeeId = row.employee_id;
        if (!employeeLeaveDates.has(employeeId)) {
          employeeLeaveDates.set(employeeId, new Set());
        }
        const leaveDate = new Date(row.record_date);
        const leaveDays = parseInt(row.leave_days) || 1;
        for (let i = 0; i < leaveDays; i++) {
          const date = new Date(leaveDate);
          date.setDate(date.getDate() + i);
          employeeLeaveDates.get(employeeId).add(date.toISOString().split('T')[0]);
        }
      });

      // 查询所有员工在指定时间段内的销售记录（不聚合，便于过滤请假日期）
      const query = `
        SELECT
          u.id as employee_id,
          u.username,
          u.name,
          p.id as phone_id,
          p.is_new,
          p.sale_price,
          p.purchase_cost,
          p.salestime
        FROM users u
        INNER JOIN phones p ON u.id = p.sale_operator_id
          AND p.salestime IS NOT NULL
          AND DATE(p.salestime) BETWEEN ? AND ?
          AND p.status = 'sold'
        LEFT JOIN (
          SELECT s.phone_id, s.sale_type
          FROM sales s
          INNER JOIN (
            SELECT phone_id, MAX(created_at) as max_created
            FROM sales
            GROUP BY phone_id
          ) latest ON s.phone_id = latest.phone_id AND s.created_at = latest.max_created
        ) latest_sale ON p.id = latest_sale.phone_id
        WHERE u.status = 1
          AND (latest_sale.sale_type IS NULL OR latest_sale.sale_type NOT IN ('wholesale', 'supplier_proxy', 'peer_transfer'))
        ORDER BY u.id, p.is_new DESC, p.salestime DESC
      `;

      const [rows] = await conn.execute(query, [periodStart, periodEnd]);

      // 调试：记录查询结果
      log.debug(`[工资发放] 查询 ${periodStart} ~ ${periodEnd} 的销售数据：`);
      log.debug(`  - 原始查询结果数: ${rows.length}`);

      // 获取所有涉及员工的模板信息（用于过滤无提成的销售）
      const employeeIds = [...new Set(rows.map(r => r.employee_id))];

      // 如果没有员工数据，直接返回空结果
      if (employeeIds.length === 0) {
        return {};
      }

      const templatesQuery = `
        SELECT u.id as employee_id, st.*
        FROM users u
        LEFT JOIN salary_templates st ON u.salary_template_id = st.id
        WHERE u.id IN (${employeeIds.map(() => '?').join(',')})
      `;
      const [templates] = await conn.execute(templatesQuery, employeeIds);

      // 构建员工模板信息映射
      const employeeTemplates = new Map();
      templates.forEach(t => {
        employeeTemplates.set(t.employee_id, t);
      });

      // 按员工统计销售数据，排除请假日期的销售
      const result = {};
      rows.forEach(row => {
        const empId = row.employee_id;
        const saleDate = new Date(row.salestime).toISOString().split('T')[0];
        const leaveDates = employeeLeaveDates.get(empId);

        // 如果该员工有请假记录，且销售日期在请假期间，则跳过
        if (leaveDates && leaveDates.has(saleDate)) {
          return; // 跳过请假日期的销售
        }

        // 获取该员工的模板信息
        const template = employeeTemplates.get(empId);
        if (!template) {
          return; // 没有模板，跳过（不应该发生）
        }

        // 检查该销售是否有提成
        const commissionType = template.commission_type || 'fixed';
        const isNew = row.is_new === 1;
        const newRate = parseFloat(template.commission_new_fixed || template.commission_fixed || 0);
        const usedRate = parseFloat(template.commission_used_fixed || 0);
        const commissionPercentage = parseFloat(template.commission_percentage || 0);

        // 判断该员工是否有提成配置
        let hasCommissionConfig = false;
        if (commissionType === 'fixed') {
          hasCommissionConfig = (newRate > 0 || usedRate > 0);
        } else if (commissionType === 'percentage') {
          hasCommissionConfig = (commissionPercentage > 0);
        }

        // 如果有提成配置，则只统计有提成的销售
        if (hasCommissionConfig) {
          if (commissionType === 'fixed') {
            if (isNew && newRate <= 0) return;  // 全新机没有提成
            if (!isNew && usedRate <= 0) return;  // 二手机没有提成
          }
          // percentage 模式不过滤，因为所有销售都有利润提成
        }

        if (!result[empId]) {
          result[empId] = {
            employee_id: empId,
            username: row.username,
            name: row.name,
            sales_count: 0,
            sales_amount: 0,
            total_profit: 0,
            new_count: 0,
            new_amount: 0,
            new_profit: 0,
            used_count: 0,
            used_amount: 0,
            used_profit: 0
          };
        }

        const salePrice = parseFloat(row.sale_price) || 0;
        const purchaseCost = parseFloat(row.purchase_cost) || 0;
        const profit = salePrice - purchaseCost;
        // isNew 已在上面声明，此处无需重复声明

        // 累加统计数据
        result[empId].sales_count += 1;
        result[empId].sales_amount += salePrice;
        result[empId].total_profit += profit;

        if (isNew) {
          result[empId].new_count += 1;
          result[empId].new_amount += salePrice;
          result[empId].new_profit += profit;
        } else {
          result[empId].used_count += 1;
          result[empId].used_amount += salePrice;
          result[empId].used_profit += profit;
        }
      });

      // 调试：输出每个员工的销售统计
      log.debug('  - 过滤后员工销售统计：');
      Object.values(result).forEach(emp => {
        log.debug(`    员工 ${emp.employee_id} (${emp.name}): ${emp.sales_count}台`);
      });

      return result;
    } finally {
      conn.release();
    }
  }

  /**
   * 获取单个员工的销售明细列表
   * 返回指定时间段内该员工的销售记录详情（含全新机和二手机）
   * 排除请假日期的销售数据（与工资计算逻辑保持一致）
   * 只返回实际有提成的销售
   */
  async getEmployeeSalesDetails(employeeId, periodStart, periodEnd) {
    const db = getDatabase();
    const conn = await db.getConnection();

    try {
      // 首先获取该员工在周期内的请假日期
      const leaveQuery = `
        SELECT record_date, leave_days
        FROM attendance_records
        WHERE employee_id = ?
          AND record_date BETWEEN ? AND ?
          AND status = 'approved'
          AND record_type = 'leave'
      `;
      const [leaveRows] = await conn.execute(leaveQuery, [employeeId, periodStart, periodEnd]);

      // 构建请假日期集合
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

      // 获取该员工的模板信息（用于过滤无提成的销售）
      const templateQuery = `
        SELECT st.*
        FROM users u
        LEFT JOIN salary_templates st ON u.salary_template_id = st.id
        WHERE u.id = ?
      `;
      const [templates] = await conn.execute(templateQuery, [employeeId]);
      const template = templates[0];

      // 查询指定员工在指定时间段内的销售明细（通过JOIN获取brand/model/color名称）
      const query = `
        SELECT
          p.id as phone_id,
          p.imei,
          p.serial_number,
          b.name as brand,
          m.name as model,
          c.name as color,
          mem.size as memory,
          p.purchase_cost,
          p.sale_price,
          p.salestime,
          p.status,
          p.is_new,
          cust.name as customer_name,
          cust.phone as customer_phone
        FROM phones p
        LEFT JOIN brands b ON p.brand_id = b.id
        LEFT JOIN models m ON p.model_id = m.id
        LEFT JOIN colors c ON p.color_id = c.id
        LEFT JOIN memories mem ON p.memory_id = mem.id
        LEFT JOIN (
          SELECT s.*
          FROM sales s
          INNER JOIN (
            SELECT phone_id, MAX(created_at) as max_created
            FROM sales
            GROUP BY phone_id
          ) latest ON s.phone_id = latest.phone_id AND s.created_at = latest.max_created
        ) latest_sale ON p.id = latest_sale.phone_id
        LEFT JOIN customers cust ON latest_sale.customer_id = cust.id
        WHERE p.sale_operator_id = ?
          AND p.salestime IS NOT NULL
          AND DATE(p.salestime) BETWEEN ? AND ?
          AND p.status = 'sold'
          AND (latest_sale.sale_type IS NULL OR latest_sale.sale_type NOT IN ('wholesale', 'supplier_proxy', 'peer_transfer'))
        ORDER BY p.is_new DESC, p.salestime DESC
      `;

      const [rows] = await conn.execute(query, [employeeId, periodStart, periodEnd]);

      // 过滤掉请假日期的销售记录和没有提成的销售
      const filteredRows = rows.filter(row => {
        const saleDate = new Date(row.salestime).toISOString().split('T')[0];
        // 排除请假日期的销售
        if (leaveDates.has(saleDate)) return false;

        // 排除没有提成的销售（如果模板存在）
        if (template) {
          const commissionType = template.commission_type || 'fixed';
          const isNew = row.is_new === 1;
          const newRate = parseFloat(template.commission_new_fixed || template.commission_fixed || 0);
          const usedRate = parseFloat(template.commission_used_fixed || 0);
          const commissionPercentage = parseFloat(template.commission_percentage || 0);

          // 判断该员工是否有提成配置
          let hasCommissionConfig = false;
          if (commissionType === 'fixed') {
            hasCommissionConfig = (newRate > 0 || usedRate > 0);
          } else if (commissionType === 'percentage') {
            hasCommissionConfig = (commissionPercentage > 0);
          }

          // 如果有提成配置，则只返回有提成的销售
          if (hasCommissionConfig) {
            if (commissionType === 'fixed') {
              if (isNew && newRate <= 0) return false;  // 全新机没有提成
              if (!isNew && usedRate <= 0) return false;  // 二手机没有提成
            }
            // percentage 模式不过滤，因为所有销售都有利润提成
          }
        }

        return true;
      });

      // 格式化返回数据
      return filteredRows.map(row => ({
        phone_id: row.phone_id,
        imei: row.imei || '-',
        serial_number: row.serial_number || '-',
        brand: row.brand || '-',
        model: row.model || '-',
        model_name: row.model || '-',
        color: row.color || '-',
        color_name: row.color || '-',
        memory: row.memory || '-',
        is_new: row.is_new === 1,
        condition_type: row.is_new === 1 ? '全新' : '二手',
        purchase_cost: parseFloat(row.purchase_cost) || 0,
        sale_price: parseFloat(row.sale_price) || 0,
        profit: (parseFloat(row.sale_price) || 0) - (parseFloat(row.purchase_cost) || 0),
        salestime: row.salestime,
        sale_time: row.salestime,
        customer_name: row.customer_name || '-',
        customer_phone: row.customer_phone || '-'
      }));
    } finally {
      conn.release();
    }
  }
}

module.exports = new SalaryRecordService();
