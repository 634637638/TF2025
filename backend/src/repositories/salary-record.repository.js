/**
 * 工资记录数据访问层（新版）
 * 处理所有工资记录相关的数据库操作
 * 适配新的 salary_records 表结构（period_start, period_end）
 */
const BaseRepository = require('./base.repository')
const log = require('../utils/log')
const { hasColumn } = require('../utils/schema-inspector')

const WRITABLE_FIELDS = new Set([
  'employee_id',
  'salary_template_id',
  'period_start',
  'period_end',
  'base_salary',
  'commission_amount',
  'commission_detail',
  'sales_count',
  'overtime_hours',
  'overtime_pay',
  'performance_bonus',
  'other_bonus',
  'leave_days',
  'leave_deduction',
  'net_salary',
  'status',
  'paid_at',
  'payment_method',
  'created_by',
  'base_salary_adjustment',
  'base_salary_note',
  'actual_work_days',
  'other_deduction'
])

// 响应字段显式冻结，避免通配列将历史字段或内部字段透传给前端。
const RESPONSE_FIELDS = [
  'id',
  'employee_id',
  'salary_template_id',
  'period_start',
  'period_end',
  'actual_work_days',
  'base_salary',
  'base_salary_adjustment',
  'base_salary_note',
  'commission_amount',
  'commission_detail',
  'sales_count',
  'overtime_hours',
  'overtime_pay',
  'performance_bonus',
  'other_bonus',
  'leave_days',
  'leave_deduction',
  'other_deduction',
  'net_salary',
  'status',
  'paid_at',
  'payment_method',
  'created_by',
  'created_at',
  'updated_at'
]

const RESPONSE_SELECT = RESPONSE_FIELDS.map(field => `sr.${field}`).join(',\n          ')
const RESPONSE_FIELDS_SELECT = RESPONSE_FIELDS.join(',\n          ')

class SalaryRecordNewRepository extends BaseRepository {
  constructor({ columnExists = hasColumn } = {}) {
    super('salary_records')
    this.columnExists = columnExists
  }

  async internalSelect(connection) {
    return `${RESPONSE_FIELDS_SELECT}, ${await this.columnExists('salary_records', 'goods_commission_snapshot', connection)
      ? 'goods_commission_snapshot' : 'NULL AS goods_commission_snapshot'}`
  }

  async lockRecordEmployee(connection, id) {
    // 单条SQL先锁员工，不先取得工资行锁；后续锁读再次核验员工不变。
    const [rows] = await connection.execute(`SELECT u.id FROM users u
      WHERE u.id = (SELECT employee_id FROM salary_records WHERE id = ?) FOR UPDATE`, [id])
    return rows[0] || null
  }

  async snapshotSelect() {
    return await this.columnExists('salary_records', 'goods_commission_snapshot')
      ? 'sr.goods_commission_snapshot' : 'NULL AS goods_commission_snapshot'
  }

  async saveGoodsSnapshot(connection, id, snapshot) {
    const [result] = await connection.execute(`UPDATE salary_records SET goods_commission_snapshot = ?
      WHERE id = ? AND (status IS NULL OR status <> 'paid') AND paid_at IS NULL`, [snapshot, id])
    return result.affectedRows
  }

  sanitizeWriteData(data = {}) {
    return Object.fromEntries(
      Object.entries(data).filter(([key, value]) => WRITABLE_FIELDS.has(key) && value !== undefined)
    )
  }

  /**
   * 获取工资记录列表（带分页和过滤）
   */
  async getSalaryRecordsWithPagination(filters = {}, options = {}) {
    try {
      const {
        page = options.page ?? filters.page ?? 1,
        page_size = options.page_size ?? filters.page_size ?? 20,
        employee_id,
        status,
        period_start,
        period_end
      } = filters

      const safePage = Math.max(1, Number.isSafeInteger(Number(page)) ? Number(page) : 1)
      const safePageSize = Math.min(100, Math.max(1, Number.isSafeInteger(Number(page_size)) ? Number(page_size) : 20))
      const offset = (safePage - 1) * safePageSize

      // 构建查询条件
      const conditions = []
      const params = []

      if (employee_id) {
        conditions.push('sr.employee_id = ?')
        params.push(employee_id)
      }

      if (status) {
        conditions.push('sr.status = ?')
        params.push(status)
      }

      if (period_start) {
        conditions.push('sr.period_start >= ?')
        params.push(period_start)
      }

      if (period_end) {
        conditions.push('sr.period_end <= ?')
        params.push(period_end)
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

      // 查询数据（LIMIT 和 OFFSET 直接内联，因为它们是安全的整数值）
      const dataQuery = `
        SELECT
          ${RESPONSE_SELECT}, ${await this.snapshotSelect()},
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
        LIMIT ${safePageSize} OFFSET ${offset}
      `

      const records = await this.executeQuery(dataQuery, params)

      // 查询总数
      const countQuery = `
        SELECT COUNT(*) as total
        FROM ${this.tableName} sr
        ${whereClause}
      `
      const countResult = await this.executeQuery(countQuery, params)
      const total = countResult[0].total

      return {
        records,
        pagination: {
          page: safePage,
          page_size: safePageSize,
          total,
          total_pages: Math.ceil(total / safePageSize),
          has_next: safePage * safePageSize < total,
          has_prev: safePage > 1
        }
      }
    } catch (error) {
      log.error('获取工资记录列表失败:', error)
      throw error
    }
  }

  /**
   * 根据ID获取工资记录详情
   */
  async getSalaryRecordById(id) {
    try {
      const query = `
        SELECT
          ${RESPONSE_SELECT}, ${await this.snapshotSelect()},
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
      `
      const records = await this.executeQuery(query, [id])
      return records[0] || null
    } catch (error) {
      log.error('获取工资记录详情失败:', error)
      throw error
    }
  }

  /**
   * 创建工资记录
   */
  async lockEmployee(connection, employeeId) {
    const [rows] = await connection.execute('SELECT id FROM users WHERE id = ? FOR UPDATE', [employeeId])
    return rows[0] || null
  }

  async lockRecord(connection, id) {
    const [rows] = await connection.execute(`SELECT ${await this.internalSelect(connection)} FROM salary_records WHERE id = ? FOR UPDATE`, [id])
    return rows[0] || null
  }

  async lockPeriodRecords(connection, employeeId, periodStart, periodEnd) {
    const [rows] = await connection.execute(`SELECT ${await this.internalSelect(connection)} FROM salary_records
      WHERE employee_id = ? AND period_start = ? AND period_end = ? ORDER BY id FOR UPDATE`, [employeeId, periodStart, periodEnd])
    return rows
  }

  async activeEmployeeIds() {
    return this.executeQuery('SELECT id FROM users WHERE status = 1 AND salary_template_id IS NOT NULL')
  }

  /** 调用方拥有事务，并先锁定员工及该周期记录，避免重复创建同一工资。 */
  async createSalaryRecord(data, connection) {
    const values = this.sanitizeWriteData(data), fields = Object.keys(values)
    const [result] = await connection.execute(`INSERT INTO salary_records (${fields.join(', ')}) VALUES (${fields.map(() => '?').join(', ')})`, Object.values(values))
    return { id: Number(result.insertId), affectedRows: result.affectedRows, data: { id: Number(result.insertId), ...values } }
  }

  /**
   * 更新工资记录
   */
  async updateSalaryRecord(id, data, connection) {
    const values = this.sanitizeWriteData(data), fields = Object.keys(values)
    const [result] = await connection.execute(`UPDATE salary_records SET ${fields.map(field => `${field} = ?`).join(', ')}
      WHERE id = ? AND (status IS NULL OR status <> 'paid') AND paid_at IS NULL`, [...Object.values(values), id])
    return { affectedRows: result.affectedRows, changedRows: result.changedRows || 0, data: { id, ...values } }
  }

  /**
   * 删除工资记录
   */
  async deleteSalaryRecord(id, connection) {
    const [result] = await connection.execute(`DELETE FROM salary_records
      WHERE id = ? AND (status IS NULL OR status <> 'paid') AND paid_at IS NULL`, [id])
    return { affectedRows: result.affectedRows, deletedId: id }
  }

  /**
   * 审批工资记录
   */
  async approveSalaryRecord(id, _approver_id, connection) {
    try {
      const query = `
        UPDATE ${this.tableName}
        SET status = 'approved'
        WHERE id = ? AND status IN ('draft', 'pending') AND paid_at IS NULL
      `
      const [result] = await connection.execute(query, [id])
      return result.affectedRows > 0
    } catch (error) {
      log.error('审批工资记录失败:', error)
      throw error
    }
  }

  /**
   * 首次发放；事务、原状态及重复请求由服务层核对。
   */
  async markAsPaid(id, options, connection) {
    const [result] = await connection.execute(`UPDATE salary_records SET status = 'paid', paid_at = ?, payment_method = ?
      WHERE id = ? AND status = 'approved' AND paid_at IS NULL`, [options.paid_at, options.payment_method || null, id])
    return result.affectedRows
  }

  /**
   * 获取工资统计信息
   */
  async getSalaryStats(filters = {}) {
    try {
      const { period_start, period_end, status } = filters

      // 构建查询条件
      const conditions = []
      const params = []

      if (period_start) {
        conditions.push('period_start >= ?')
        params.push(period_start)
      }

      if (period_end) {
        conditions.push('period_end <= ?')
        params.push(period_end)
      }

      if (status) {
        conditions.push('status = ?')
        params.push(status)
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

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
      `

      const basicStats = await this.executeQuery(basicStatsQuery, params)

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
      `

      const employeeStats = await this.executeQuery(employeeStatsQuery, params)

      // 按状态统计
      const statusStatsQuery = `
        SELECT
          status,
          COUNT(*) as count,
          SUM(net_salary) as total_salary
        FROM ${this.tableName}
        ${whereClause}
        GROUP BY status
      `

      const statusStats = await this.executeQuery(statusStatsQuery, params)

      return {
        basic_stats: basicStats[0],
        employee_stats: employeeStats,
        status_stats: statusStats
      }
    } catch (error) {
      log.error('获取工资统计信息失败:', error)
      throw error
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
      `
      const records = await this.executeQuery(query, [employee_id, period_start, period_end])
      return records[0] || null
    } catch (error) {
      log.error('检查工资记录是否存在失败:', error)
      throw error
    }
  }

  /**
   * 获取员工在指定周期的工资记录
   */
  async getRecordByEmployeePeriod(employee_id, period_start, period_end) {
    try {
      const query = `
        SELECT ${RESPONSE_FIELDS_SELECT}
        FROM ${this.tableName}
        WHERE employee_id = ? AND period_start = ? AND period_end = ?
        LIMIT 1
      `
      const records = await this.executeQuery(query, [employee_id, period_start, period_end])
      return records[0] || null
    } catch (error) {
      log.error('获取员工周期工资记录失败:', error)
      throw error
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
      `
      return await this.executeQuery(query, [employee_id])
    } catch (error) {
      log.error('获取员工工资记录失败:', error)
      throw error
    }
  }
}

module.exports = SalaryRecordNewRepository
