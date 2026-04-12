/**
 * 考勤记录数据访问层
 * 处理所有考勤相关的数据库操作
 */
const BaseRepository = require('./base.repository');
const log = require('../utils/log');

class AttendanceRepository extends BaseRepository {
  constructor() {
    super('attendance_records');
  }

  /**
   * 获取考勤记录列表（带分页和过滤）
   */
  async getAttendanceRecordsWithPagination(filters = {}, options = {}) {
    try {
      const {
        page = 1,
        limit = 20,
        employee_id,
        record_type,
        status,
        start_date,
        end_date
      } = filters;

      // 安全转换分页参数为整数
      const pageInt = parseInt(page) || 1;
      const limitInt = parseInt(limit) || 20;
      const offsetInt = (pageInt - 1) * limitInt;

      // 构建查询条件
      const conditions = [];
      const params = [];

      if (employee_id) {
        conditions.push('ar.employee_id = ?');
        params.push(employee_id);
      }

      if (record_type) {
        conditions.push('ar.record_type = ?');
        params.push(record_type);
      }

      if (status) {
        conditions.push('ar.status = ?');
        params.push(status);
      }

      if (start_date) {
        conditions.push('ar.record_date >= ?');
        params.push(start_date);
      }

      if (end_date) {
        conditions.push('ar.record_date <= ?');
        params.push(end_date);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      // 查询数据 - LIMIT 和 OFFSET 使用字符串拼接（已验证为整数）
      const dataQuery = `
        SELECT
          ar.id,
          ar.employee_id,
          DATE_FORMAT(ar.record_date, '%Y-%m-%d') as record_date,
          ar.record_type,
          ar.leave_type,
          ar.leave_days,
          ar.leave_reason,
          ar.overtime_hours,
          ar.overtime_reason,
          ar.monthly_leave_days,
          ar.status,
          ar.approval_note,
          ar.approved_by,
          DATE_FORMAT(ar.approved_at, '%Y-%m-%d %H:%i:%s') as approved_at,
          ar.created_by,
          DATE_FORMAT(ar.created_at, '%Y-%m-%d %H:%i:%s') as created_at,
          DATE_FORMAT(ar.updated_at, '%Y-%m-%d %H:%i:%s') as updated_at,
          u.username,
          u.name as employee_name,
          u.phone as employee_phone,
          approver.username as approver_name,
          creator.username as creator_name
        FROM ${this.tableName} ar
        LEFT JOIN users u ON ar.employee_id = u.id
        LEFT JOIN users approver ON ar.approved_by = approver.id
        LEFT JOIN users creator ON ar.created_by = creator.id
        ${whereClause}
        ORDER BY ar.record_date DESC, ar.created_at DESC
        LIMIT ${limitInt} OFFSET ${offsetInt}
      `;

      const records = await this.executeQuery(dataQuery, params);

      // 查询总数
      const countQuery = `
        SELECT COUNT(*) as total
        FROM ${this.tableName} ar
        ${whereClause}
      `;
      const countResult = await this.executeQuery(countQuery, params);
      const total = countResult[0].total;

      return {
        records,
        pagination: {
          page: pageInt,
          limit: limitInt,
          total,
          totalPages: Math.ceil(total / limitInt),
          hasNext: pageInt * limitInt < total,
          hasPrev: pageInt > 1
        }
      };
    } catch (error) {
      log.error('获取考勤记录失败:', error);
      throw error;
    }
  }

  /**
   * 根据ID获取考勤记录详情
   */
  async getAttendanceRecordById(id) {
    try {
      const query = `
        SELECT
          ar.id,
          ar.employee_id,
          DATE_FORMAT(ar.record_date, '%Y-%m-%d') as record_date,
          ar.record_type,
          ar.leave_type,
          ar.leave_days,
          ar.leave_reason,
          ar.overtime_hours,
          ar.overtime_reason,
          ar.monthly_leave_days,
          ar.status,
          ar.approval_note,
          ar.approved_by,
          DATE_FORMAT(ar.approved_at, '%Y-%m-%d %H:%i:%s') as approved_at,
          ar.created_by,
          DATE_FORMAT(ar.created_at, '%Y-%m-%d %H:%i:%s') as created_at,
          DATE_FORMAT(ar.updated_at, '%Y-%m-%d %H:%i:%s') as updated_at,
          u.username,
          u.name as employee_name,
          u.phone as employee_phone,
          approver.username as approver_name,
          creator.username as creator_name
        FROM ${this.tableName} ar
        LEFT JOIN users u ON ar.employee_id = u.id
        LEFT JOIN users approver ON ar.approved_by = approver.id
        LEFT JOIN users creator ON ar.created_by = creator.id
        WHERE ar.id = ?
      `;
      const records = await this.executeQuery(query, [id]);
      return records[0] || null;
    } catch (error) {
      log.error('获取考勤记录详情失败:', error);
      throw error;
    }
  }

  /**
   * 创建考勤记录
   */
  async createAttendanceRecord(data) {
    try {
      return await this.create(data);
    } catch (error) {
      log.error('创建考勤记录失败:', error);
      throw error;
    }
  }

  /**
   * 更新考勤记录
   */
  async updateAttendanceRecord(id, data) {
    try {
      return await this.update(id, data);
    } catch (error) {
      log.error('更新考勤记录失败:', error);
      throw error;
    }
  }

  /**
   * 删除考勤记录
   */
  async deleteAttendanceRecord(id) {
    try {
      return await this.delete(id);
    } catch (error) {
      log.error('删除考勤记录失败:', error);
      throw error;
    }
  }

  /**
   * 审批考勤记录
   */
  async approveAttendanceRecord(id, approver_id, status, note = null) {
    try {
      const query = `
        UPDATE ${this.tableName}
        SET status = ?, approved_by = ?, approved_at = NOW(), approval_note = ?
        WHERE id = ?
      `;
      await this.executeQuery(query, [status, approver_id, note, id]);
      return true;
    } catch (error) {
      log.error('审批考勤记录失败:', error);
      throw error;
    }
  }

  /**
   * 获取员工在指定日期范围内的考勤统计
   */
  async getEmployeeAttendanceStats(employee_id, start_date, end_date) {
    try {
      const query = `
        SELECT
          record_type,
          COUNT(*) as count,
          SUM(CASE WHEN record_type = 'leave' THEN leave_days
                  WHEN record_type = 'overtime' THEN overtime_hours
                  WHEN record_type = 'monthly_leave' THEN monthly_leave_days
                  ELSE 0 END) as total_days
        FROM ${this.tableName}
        WHERE employee_id = ?
          AND record_date BETWEEN ? AND ?
          AND status = 'approved'
        GROUP BY record_type
      `;
      return await this.executeQuery(query, [employee_id, start_date, end_date]);
    } catch (error) {
      log.error('获取员工考勤统计失败:', error);
      throw error;
    }
  }

  /**
   * 批量创建考勤记录
   */
  async batchCreateAttendanceRecords(records) {
    try {
      if (!records || records.length === 0) {
        return { insertedCount: 0 };
      }

      const keys = Object.keys(records[0]);
      const placeholders = keys.map(() => '?').join(', ');
      const sql = `INSERT INTO ${this.tableName} (${keys.join(', ')}) VALUES (${placeholders})`;

      const db = this.getConnection();
      let insertedCount = 0;

      for (const record of records) {
        const values = Object.values(record);
        try {
          await db.execute(sql, values);
          insertedCount++;
        } catch (error) {
          if (error.code !== 'ER_DUP_ENTRY') {
            throw error;
          }
        }
      }

      return { insertedCount };
    } catch (error) {
      log.error('批量创建考勤记录失败:', error);
      throw error;
    }
  }

  /**
   * 获取用户当月已使用的休假天数
   * 包括所有状态的记录（pending, approved, rejected）
   * 用于实时计算可用天数，防止超额申请
   */
  async getUserUsedMonthlyLeaveDays(employeeId, year, month) {
    try {
      const query = `
        SELECT COALESCE(SUM(monthly_leave_days), 0) as used_days
        FROM ${this.tableName}
        WHERE employee_id = ?
          AND record_type = 'monthly_leave'
          AND status IN ('pending', 'approved')
          AND YEAR(record_date) = ?
          AND MONTH(record_date) = ?
      `;
      const result = await this.executeQuery(query, [employeeId, year, month]);
      return result[0]?.used_days || 0;
    } catch (error) {
      log.error('获取用户已使用休假天数失败:', error);
      throw error;
    }
  }

  /**
   * 检查用户某月是否有普通请假记录（leave）
   * 仅普通请假会阻断上月剩余休假累计到本月。
   */
  async hasAnyRegularLeaveRecords(employeeId, year, month) {
    try {
      const query = `
        SELECT COUNT(*) as count
        FROM ${this.tableName}
        WHERE employee_id = ?
          AND record_type = 'leave'
          AND status IN ('pending', 'approved')
          AND YEAR(record_date) = ?
          AND MONTH(record_date) = ?
      `;
      const result = await this.executeQuery(query, [employeeId, year, month]);
      return (result[0]?.count || 0) > 0;
    } catch (error) {
      log.error('检查用户普通请假记录失败:', error);
      throw error;
    }
  }

  /**
   * 获取用户某月普通请假天数（leave）
   */
  async getUserRegularLeaveDays(employeeId, year, month) {
    try {
      const query = `
        SELECT COALESCE(SUM(leave_days), 0) as leave_days
        FROM ${this.tableName}
        WHERE employee_id = ?
          AND record_type = 'leave'
          AND status IN ('pending', 'approved')
          AND YEAR(record_date) = ?
          AND MONTH(record_date) = ?
      `;
      const result = await this.executeQuery(query, [employeeId, year, month]);
      return result[0]?.leave_days || 0;
    } catch (error) {
      log.error('获取用户普通请假天数失败:', error);
      throw error;
    }
  }
}

module.exports = AttendanceRepository;
