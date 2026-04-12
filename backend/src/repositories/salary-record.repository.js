/**
 * 工资记录数据访问层（新版）
 * 处理所有工资记录相关的数据库操作
 * 适配新的 salary_records 表结构（period_start, period_end）
 */
const BaseRepository = require('./base.repository');
const log = require('../utils/log');

class SalaryRecordNewRepository extends BaseRepository {
  constructor() {
    super('salary_records');
  }

  /**
   * 获取工资记录列表（带分页和过滤）
   */
  async getSalaryRecordsWithPagination(filters = {}, options = {}) {
    try {
      const {
        page = 1,
        limit = 20,
        employee_id,
        status,
        period_start,
        period_end
      } = filters;

      const offset = (page - 1) * limit;

      // 构建查询条件
      const conditions = [];
      const params = [];

      if (employee_id) {
        conditions.push('sr.employee_id = ?');
        params.push(employee_id);
      }

      if (status) {
        conditions.push('sr.status = ?');
        params.push(status);
      }

      if (period_start) {
        conditions.push('sr.period_start >= ?');
        params.push(period_start);
      }

      if (period_end) {
        conditions.push('sr.period_end <= ?');
        params.push(period_end);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      // 查询数据（LIMIT 和 OFFSET 直接内联，因为它们是安全的整数值）
      const dataQuery = `
        SELECT
          sr.*,
          u.username,
          u.name as employee_name,
          u.phone as employee_phone,
          st.name as template_name,
          creator.username as creator_name
        FROM ${this.tableName} sr
        LEFT JOIN users u ON sr.employee_id = u.id
        LEFT JOIN salary_templates st ON sr.salary_template_id = st.id
        LEFT JOIN users creator ON sr.created_by = creator.id
        ${whereClause}
        ORDER BY sr.period_start DESC, sr.created_at DESC
        LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}
      `;

      const records = await this.executeQuery(dataQuery, params);

      // 查询总数
      const countQuery = `
        SELECT COUNT(*) as total
        FROM ${this.tableName} sr
        ${whereClause}
      `;
      const countResult = await this.executeQuery(countQuery, params);
      const total = countResult[0].total;

      return {
        records,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / limit),
          hasNext: page * limit < total,
          hasPrev: page > 1
        }
      };
    } catch (error) {
      log.error('获取工资记录列表失败:', error);
      throw error;
    }
  }

  /**
   * 根据ID获取工资记录详情
   */
  async getSalaryRecordById(id) {
    try {
      const query = `
        SELECT
          sr.*,
          u.username,
          u.name as employee_name,
          u.phone as employee_phone,
          st.name as template_name,
          st.commission_type,
          st.commission_fixed,
          st.commission_percentage,
          creator.username as creator_name
        FROM ${this.tableName} sr
        LEFT JOIN users u ON sr.employee_id = u.id
        LEFT JOIN salary_templates st ON sr.salary_template_id = st.id
        LEFT JOIN users creator ON sr.created_by = creator.id
        WHERE sr.id = ?
      `;
      const records = await this.executeQuery(query, [id]);
      return records[0] || null;
    } catch (error) {
      log.error('获取工资记录详情失败:', error);
      throw error;
    }
  }

  /**
   * 创建工资记录
   */
  async createSalaryRecord(data) {
    try {
      return await this.create(data);
    } catch (error) {
      log.error('创建工资记录失败:', error);
      throw error;
    }
  }

  /**
   * 保存或更新工资记录（UPSERT）
   * 如果员工在该周期已有记录，则更新；否则创建新记录
   */
  async upsertSalaryRecord(data) {
    try {
      const { employee_id, period_start, period_end } = data;

      // 检查是否已存在记录
      const existing = await this.checkExistingRecord(employee_id, period_start, period_end);

      if (existing) {
        // 记录存在，更新它
        return await this.update(existing.id, data);
      } else {
        // 记录不存在，创建新记录
        return await this.create(data);
      }
    } catch (error) {
      log.error('保存工资记录失败:', error);
      throw error;
    }
  }

  /**
   * 更新工资记录
   */
  async updateSalaryRecord(id, data) {
    try {
      return await this.update(id, data);
    } catch (error) {
      log.error('更新工资记录失败:', error);
      throw error;
    }
  }

  /**
   * 删除工资记录
   */
  async deleteSalaryRecord(id) {
    try {
      return await this.delete(id);
    } catch (error) {
      log.error('删除工资记录失败:', error);
      throw error;
    }
  }

  /**
   * 批量更新工资记录状态
   */
  async batchUpdateStatus(ids, status) {
    try {
      if (!Array.isArray(ids) || ids.length === 0) {
        return 0;
      }

      const placeholders = ids.map(() => '?').join(',');
      const query = `UPDATE ${this.tableName} SET status = ? WHERE id IN (${placeholders})`;
      const params = [status, ...ids];

      const db = this.getConnection();
      const [result] = await db.execute(query, params);
      return result.affectedRows;
    } catch (error) {
      log.error('批量更新工资记录状态失败:', error);
      throw error;
    }
  }

  /**
   * 审批工资记录
   */
  async approveSalaryRecord(id, approver_id) {
    try {
      const query = `
        UPDATE ${this.tableName}
        SET status = 'approved'
        WHERE id = ? AND status IN ('draft', 'pending')
      `;
      const db = this.getConnection();
      const [result] = await db.execute(query, [id]);
      return result.affectedRows > 0;
    } catch (error) {
      log.error('审批工资记录失败:', error);
      throw error;
    }
  }

  /**
   * 标记工资为已发放
   * @param {number} id - 工资记录ID
   * @param {object} options - 选项 { payment_method: string }
   *
   * 说明：
   * - 允许重复结算，每次结算都会更新 paid_at 时间为当前时间
   * - 如果记录已支付，则更新支付方式和结算时间
   * - 如果记录未支付（审批状态），则标记为已支付并设置结算时间
   */
  async markAsPaid(id, options = {}) {
    try {
      const { payment_method } = options;
      const db = this.getConnection();

      // 先检查记录是否存在以及当前状态
      const checkQuery = `SELECT id, status FROM ${this.tableName} WHERE id = ?`;
      const [records] = await db.execute(checkQuery, [id]);

      if (records.length === 0) {
        throw new Error('工资记录不存在');
      }

      const currentStatus = records[0].status;

      // 只允许审批或已支付的记录进行结算
      if (currentStatus !== 'approved' && currentStatus !== 'paid') {
        throw new Error(`只能结算已审批或已支付的工资记录，当前状态：${currentStatus}`);
      }

      // 更新状态和支付信息（无论当前状态是 approved 还是 paid，都更新时间和支付方式）
      const updateQuery = `
        UPDATE ${this.tableName}
        SET status = 'paid',
            paid_at = NOW(),
            payment_method = ?
        WHERE id = ?
      `;
      const [result] = await db.execute(updateQuery, [payment_method || null, id]);

      if (result.affectedRows === 0) {
        throw new Error('工资发放失败，记录可能已被修改');
      }

      // 返回更新后的记录
      const selectQuery = `SELECT * FROM ${this.tableName} WHERE id = ?`;
      const [updatedRecords] = await db.execute(selectQuery, [id]);
      return updatedRecords[0];
    } catch (error) {
      log.error('标记工资发放失败:', error);
      throw error;
    }
  }

  /**
   * 获取工资统计信息
   */
  async getSalaryStats(filters = {}) {
    try {
      const { period_start, period_end, status } = filters;

      // 构建查询条件
      const conditions = [];
      const params = [];

      if (period_start) {
        conditions.push('period_start >= ?');
        params.push(period_start);
      }

      if (period_end) {
        conditions.push('period_end <= ?');
        params.push(period_end);
      }

      if (status) {
        conditions.push('status = ?');
        params.push(status);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      // 基本统计（只使用 net_salary，因为 gross_salary 已删除）
      const basicStatsQuery = `
        SELECT
          COUNT(*) as total_records,
          SUM(net_salary) as total_net_salary,
          AVG(net_salary) as avg_net_salary,
          MAX(net_salary) as max_salary,
          MIN(net_salary) as min_salary
        FROM ${this.tableName}
        ${whereClause}
      `;

      const basicStats = await this.executeQuery(basicStatsQuery, params);

      // 按员工统计
      const employeeStatsQuery = `
        SELECT
          sr.employee_id,
          u.name as employee_name,
          COUNT(*) as count,
          AVG(sr.net_salary) as avg_salary,
          SUM(sr.net_salary) as total_salary
        FROM ${this.tableName} sr
        LEFT JOIN users u ON sr.employee_id = u.id
        ${whereClause}
        GROUP BY sr.employee_id, u.name
        ORDER BY total_salary DESC
        LIMIT 20
      `;

      const employeeStats = await this.executeQuery(employeeStatsQuery, params);

      // 按状态统计
      const statusStatsQuery = `
        SELECT
          status,
          COUNT(*) as count,
          SUM(net_salary) as total_salary
        FROM ${this.tableName}
        ${whereClause}
        GROUP BY status
      `;

      const statusStats = await this.executeQuery(statusStatsQuery, params);

      return {
        basic_stats: basicStats[0],
        employee_stats: employeeStats,
        status_stats: statusStats
      };
    } catch (error) {
      log.error('获取工资统计信息失败:', error);
      throw error;
    }
  }

  /**
   * 检查员工在指定周期是否已有工资记录
   */
  async checkExistingRecord(employee_id, period_start, period_end) {
    try {
      const query = `
        SELECT id FROM ${this.tableName}
        WHERE employee_id = ? AND period_start = ? AND period_end = ?
        LIMIT 1
      `;
      const records = await this.executeQuery(query, [employee_id, period_start, period_end]);
      return records[0] || null;
    } catch (error) {
      log.error('检查工资记录是否存在失败:', error);
      throw error;
    }
  }

  /**
   * 获取员工在指定周期的工资记录
   */
  async getRecordByEmployeePeriod(employee_id, period_start, period_end) {
    try {
      const query = `
        SELECT *
        FROM ${this.tableName}
        WHERE employee_id = ? AND period_start = ? AND period_end = ?
        LIMIT 1
      `;
      const records = await this.executeQuery(query, [employee_id, period_start, period_end]);
      return records[0] || null;
    } catch (error) {
      log.error('获取员工周期工资记录失败:', error);
      throw error;
    }
  }

  /**
   * 获取员工最近N条工资记录
   */
  async getRecentRecordsByEmployee(employee_id, limit = 6) {
    try {
      const query = `
        SELECT
          sr.id,
          sr.period_start,
          sr.period_end,
          sr.net_salary,
          sr.status,
          sr.created_at,
          st.name as template_name
        FROM ${this.tableName} sr
        LEFT JOIN salary_templates st ON sr.salary_template_id = st.id
        WHERE sr.employee_id = ?
        ORDER BY sr.period_start DESC
        LIMIT ${parseInt(limit)}
      `;
      return await this.executeQuery(query, [employee_id]);
    } catch (error) {
      log.error('获取员工工资记录失败:', error);
      throw error;
    }
  }
}

module.exports = SalaryRecordNewRepository;
