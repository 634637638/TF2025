const { getLatestActiveSaleIdSql } = require('../utils/sale-status')
const { withConnection } = require('../core/db/connection')
/**
 * 工资记录服务
 */
const SalaryRecordRepository = require('../repositories/salary-record.repository')
const SalaryCalculatorService = require('./salary-calculator.service')
const { getDatabase } = require('../config/database')
const log = require('../utils/log')
const { getMonthDateRange, getBeijingTimeString, formatLocalDate, parseLocalDate } = require('../utils/time')
const { validId } = require('../utils/sale-input')
const paymentOptions = require('../config/payment-methods.json')
const SalaryGoodsSettlementService = require('./salary-goods-settlement.service')
const { cents, applyGoods, removeGoods, manualSalary, calculatedSalary, publicSalary, assertCalculationVersion } = require('../utils/salary-goods-amounts')
const {
  buildLeaveExclusionRules,
  shouldExcludeSaleByLeave
} = require('../utils/leave-sales-filter')

const reject = (message, code, statusCode = 409) => { throw Object.assign(new Error(message), { code, statusCode }) }
const isPaid = row => Boolean(row && (row.status === 'paid' || row.paid_at !== null && row.paid_at !== undefined && row.paid_at !== ''))
const assertUnpaid = row => {
  if (isPaid(row)) reject('已发工资保留原始记录，不能覆盖、编辑或删除；后续差额须另行关联调整', 'SALARY_RECORD_PAID')
}
const identity = data => {
  if (!data || typeof data !== 'object' || Array.isArray(data) || !validId(data.employee_id) ||
    ![data.period_start, data.period_end].every(value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && formatLocalDate(parseLocalDate(value)) === value) ||
    data.period_start > data.period_end) reject('请提供有效员工和工资周期', 'SALARY_RECORD_INVALID', 400)
}

class SalaryRecordService {
  constructor({ repository = new SalaryRecordRepository(), calculator = SalaryCalculatorService, now = getBeijingTimeString,
    goods = new SalaryGoodsSettlementService() } = {}) {
    Object.assign(this, { repository, calculator, now, goods })
  }

  /** 写入只使用同一连接；发放与编辑/重算竞争时，以原记录行锁决定先后。 */
  async mutate(operation) {
    return this.repository.withConnection(async connection => {
      await connection.execute('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ')
      await connection.beginTransaction()
      try {
        const result = await operation(connection)
        await connection.commit()
        return result
      } catch (error) {
        await connection.rollback()
        throw error
      }
    })
  }

  async lockRecord(connection, id) {
    if (!validId(id)) reject('工资记录编号无效', 'SALARY_RECORD_INVALID', 400)
    const employee = await this.repository.lockRecordEmployee(connection, Number(id))
    if (!employee) reject('工资记录或员工不存在', 'NOT_FOUND', 404)
    const record = await this.repository.lockRecord(connection, Number(id))
    if (!record) reject('工资记录不存在', 'NOT_FOUND', 404)
    if (Number(record.employee_id) !== Number(employee.id)) reject('工资员工归属发生变化，请刷新重试', 'SALARY_PERIOD_CONFLICT')
    return record
  }

  assertExternalInput(data) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) reject('工资记录内容无效', 'SALARY_RECORD_INVALID', 400)
    if (data.status === 'paid' || data.paid_at !== undefined && data.paid_at !== null && data.paid_at !== '') {
      reject('请保存为待发放后，通过确认结算首次发放工资', 'SALARY_PAYMENT_REQUIRED')
    }
    if (['goods_commission_snapshot', 'goods_commission', 'calculation_version'].some(key => Object.hasOwn(data, key))) {
      reject('商品工资凭据及计算结果由服务器生成', 'SALARY_RECORD_INVALID', 400)
    }
    if (data.status !== undefined && !['draft', 'pending', 'approved', 'cancelled'].includes(data.status)) reject('工资状态无效', 'SALARY_RECORD_INVALID', 400)
    for (const field of ['base_salary', 'base_salary_adjustment', 'commission_amount', 'overtime_pay', 'performance_bonus',
      'other_bonus', 'leave_deduction', 'other_deduction', 'net_salary']) {
      if (data[field] !== undefined) {
        try { cents(data[field]) } catch { reject('工资金额必须为有效两位金额且不超出范围', 'SALARY_RECORD_INVALID', 400) }
      }
    }
  }

  async withGoods(connection, salary) {
    const plan = await this.goods.prepare(connection, { employee_id: Number(salary.employee_id),
      period_start: formatLocalDate(salary.period_start), period_end: formatLocalDate(salary.period_end), through: this.now() })
    return applyGoods(salary, plan)
  }

  async persist(connection, salary, existing = null) {
    const result = existing ? await this.repository.updateSalaryRecord(existing.id, salary, connection)
      : await this.repository.createSalaryRecord(salary, connection)
    if (result.affectedRows !== 1) reject('工资记录已变化，请刷新核对', 'SALARY_STATUS_CONFLICT')
    const id = existing?.id || result.id
    if (await this.repository.saveGoodsSnapshot(connection, id, salary.goods_commission_snapshot) !== 1) reject('商品工资快照保存失败', 'SALARY_STATUS_CONFLICT')
    return { ...result, data: publicSalary({ ...result.data, ...salary, id }) }
  }

  async mutatePeriod(data, operation) {
    identity(data)
    return this.mutate(async connection => {
      // 员工行串行化首次创建；即使尚无周期记录，也不能并发插入两笔工资。
      if (!await this.repository.lockEmployee(connection, Number(data.employee_id))) reject('员工不存在', 'NOT_FOUND', 404)
      const records = await this.repository.lockPeriodRecords(connection, Number(data.employee_id), data.period_start, data.period_end)
      if (records.length > 1) reject('该员工周期存在重复工资，请先核对历史记录', 'SALARY_PERIOD_CONFLICT')
      return operation(connection, records[0] || null)
    })
  }

  async getSalaryRecords(filters, options) {
    try {
      const result = await this.repository.getSalaryRecordsWithPagination(filters, options)
      return { ...result, records: result.records.map(publicSalary) }
    } catch (error) {
      throw error
    }
  }

  async getSalaryRecordById(id) {
    try {
      return publicSalary(await this.repository.getSalaryRecordById(id))
    } catch (error) {
      throw error
    }
  }

  async createSalaryRecord(data, userId) {
    this.assertExternalInput(data)
    identity(data)
    assertUnpaid(await this.repository.getRecordByEmployeePeriod(data.employee_id, data.period_start, data.period_end))
    const calculated = calculatedSalary(await this.calculator.calculateSalary(data.employee_id, data.period_start, data.period_end))
    return this.mutatePeriod(data, async (connection, existing) => {
      assertUnpaid(existing)
      if (existing) reject('该员工周期已有工资，请编辑原记录', 'SALARY_PERIOD_CONFLICT')
      const preview = await this.withGoods(connection, calculated)
      assertCalculationVersion(preview, data.expected_calculation_version)
      const salary = manualSalary(removeGoods(preview), { ...this.repository.sanitizeWriteData(data), created_by: userId })
      return this.persist(connection, applyGoods(salary, preview.goods_commission_snapshot))
    })
  }

  async updateSalaryRecord(id, data) {
    return this.mutate(async connection => {
      const existing = await this.lockRecord(connection, id)
      assertUnpaid(existing)
      this.assertExternalInput(data)
      if (data.employee_id !== undefined && (!validId(data.employee_id) || Number(data.employee_id) !== Number(existing.employee_id)) ||
        ['period_start', 'period_end'].some(field => data[field] !== undefined && data[field] !== formatLocalDate(existing[field]))) {
        reject('工资记录的员工和周期不能改写，请核对原记录', 'SALARY_PERIOD_CONFLICT')
      }
      const write = this.repository.sanitizeWriteData({ ...data, created_by: existing.created_by })
      if (!Object.keys(write).some(field => field !== 'created_by')) reject('没有要更新的工资字段', 'SALARY_RECORD_INVALID', 400)
      assertCalculationVersion(existing, data.expected_calculation_version)
      return this.persist(connection, await this.withGoods(connection, manualSalary(removeGoods(existing), write)), existing)
    })
  }

  async deleteSalaryRecord(id) {
    return this.mutate(async connection => {
      assertUnpaid(await this.lockRecord(connection, id))
      const result = await this.repository.deleteSalaryRecord(Number(id), connection)
      if (result.affectedRows !== 1) reject('工资记录已变化，请刷新核对', 'SALARY_STATUS_CONFLICT')
      return result
    })
  }

  async calculateSalary(employeeId, periodStart, periodEnd) {
    const input = { employee_id: employeeId, period_start: periodStart, period_end: periodEnd }
    identity(input)
    const calculated = calculatedSalary(await this.calculator.calculateSalary(employeeId, periodStart, periodEnd))
    return this.mutatePeriod(input, async (connection, existing) => {
      if (isPaid(existing)) return publicSalary(existing)
      return publicSalary(await this.withGoods(connection, calculated))
    })
  }

  /**
   * 保存计算的工资（UPSERT）
   * 如果员工在该周期已有记录，则更新；否则创建新记录
   */
  async saveCalculatedSalary(salaryData, userId, authorize = null) {
    this.assertExternalInput(salaryData)
    identity(salaryData)
    const { employee_id, period_start, period_end } = salaryData
    assertUnpaid(await this.repository.getRecordByEmployeePeriod(employee_id, period_start, period_end))
    const calculated = calculatedSalary(await this.calculator.calculateSalary(employee_id, period_start, period_end))
    return this.mutatePeriod(salaryData, async (connection, existing) => {
      if (authorize) await authorize(Boolean(existing), connection)
      const merged = this.mergeCalculatedSalaryState(calculated, existing, userId, {
        status: salaryData.status,
        payment_method: salaryData.payment_method,
        paid_at: salaryData.paid_at
      })
      const salary = await this.withGoods(connection, merged)
      assertCalculationVersion(salary, salaryData.expected_calculation_version)
      return this.persist(connection, salary, existing)
    })
  }

  mergeCalculatedSalaryState(calculated, existing, operatorId, overrides = {}) {
    assertUnpaid(existing)
    const allowedStatuses = new Set(['draft', 'pending', 'approved'])
    const nextStatus = allowedStatuses.has(overrides.status) ? overrides.status : null
    const merged = { ...calculated }

    if (existing) {
      merged.status = nextStatus || existing.status || calculated.status
      merged.payment_method = overrides.payment_method !== undefined
        ? overrides.payment_method
        : (existing.payment_method || null)
      merged.paid_at = overrides.paid_at !== undefined
        ? overrides.paid_at
        : (existing.paid_at || null)
      merged.created_by = existing.created_by || operatorId
      return merged
    }

    merged.status = nextStatus || calculated.status
    merged.payment_method = overrides.payment_method || null
    merged.paid_at = overrides.paid_at || null
    merged.created_by = operatorId
    return merged
  }

  async recalculateExistingSalaryForPeriod(employeeId, periodStart, periodEnd, operatorId) {
    const existing = await this.repository.getRecordByEmployeePeriod(employeeId, periodStart, periodEnd)
    if (!existing || isPaid(existing)) {
      return null
    }

    const calculated = calculatedSalary(await this.calculator.calculateSalary(employeeId, periodStart, periodEnd))
    return this.mutatePeriod({ employee_id: employeeId, period_start: periodStart, period_end: periodEnd }, async (connection, current) => {
      // 考勤审批不得因工资已发而失败；计算期间恰好发放也只跳过，不回写旧月。
      if (!current || isPaid(current)) return null
      const merged = this.mergeCalculatedSalaryState(calculated, current, operatorId)
      return this.persist(connection, await this.withGoods(connection, merged), current)
    })
  }

  async recalculateExistingSalaryForAttendanceRecord(attendanceRecord, operatorId) {
    if (!attendanceRecord || !attendanceRecord.employee_id || !attendanceRecord.record_date) {
      return null
    }

    const salaryAffectingTypes = new Set(['leave', 'monthly_leave', 'overtime', 'absent'])
    if (!salaryAffectingTypes.has(attendanceRecord.record_type)) {
      return null
    }

    const period = getMonthDateRange(attendanceRecord.record_date)
    if (!period) {
      return null
    }

    return await this.recalculateExistingSalaryForPeriod(
      attendanceRecord.employee_id,
      period.period_start,
      period.period_end,
      operatorId
    )
  }

  async batchCalculateSalaries(employeeIds, periodStart, periodEnd) {
    if (!Array.isArray(employeeIds) || employeeIds.some(id => !validId(id))) reject('员工编号无效', 'SALARY_RECORD_INVALID', 400)
    const results = []
    for (const employeeId of employeeIds) {
      try { results.push({ success: true, data: await this.calculateSalary(employeeId, periodStart, periodEnd) }) }
      catch (error) { results.push({ success: false, employee_id: employeeId, error: error.message }) }
    }
    return results
  }

  async approveSalaryRecord(id, approverId) {
    return this.mutate(async connection => {
      const existing = await this.lockRecord(connection, id)
      assertUnpaid(existing)
      if (existing.status === 'approved') return true
      if (!['draft', 'pending'].includes(existing.status)) reject('只能审批待审批的工资记录', 'SALARY_STATUS_CONFLICT')
      if (!await this.repository.approveSalaryRecord(Number(id), approverId, connection)) reject('工资记录已变化，请刷新核对', 'SALARY_STATUS_CONFLICT')
      return true
    })
  }

  /**
   * 标记工资为已发放
   * @param {number} id - 工资记录ID
   * @param {object} options - 选项 { payment_method: string }
   */
  async markAsPaid(id, options = {}) {
    return this.mutate(async connection => {
      const existing = await this.lockRecord(connection, id)
      if (existing.status === 'paid') return publicSalary(existing) // 重试保留第一次发放事实且不再次核销。
      assertUnpaid(existing)
      if (existing.status !== 'approved') reject('只能发放已审批的工资记录', 'SALARY_STATUS_CONFLICT')
      assertCalculationVersion(existing, options.expected_calculation_version)
      const method = options.payment_method ?? existing.payment_method ?? null
      if (method !== null && !paymentOptions.settlement.some(item => item.value === method)) reject('请选择有效的工资支付方式', 'SALARY_RECORD_INVALID', 400)
      const paidAt = this.now()
      if (!existing.goods_commission_snapshot) reject('工资尚未核对商品提成，请先重新计算后发放', 'SALARY_GOODS_RECALCULATION_REQUIRED')
      const confirmed = await this.goods.confirm(connection, existing, paidAt)
      if (await this.repository.markAsPaid(Number(id), { payment_method: method, paid_at: paidAt }, connection) !== 1) {
        reject('工资记录已变化，请刷新核对', 'SALARY_STATUS_CONFLICT')
      }
      const paid = await this.repository.lockRecord(connection, Number(id))
      await this.goods.append(connection, paid, confirmed)
      return publicSalary(paid)
    })
  }

  async getSalaryStats(filters) {
    try {
      return await this.repository.getSalaryStats(filters)
    } catch (error) {
      throw error
    }
  }

  async checkExistingRecord(employeeId, periodStart, periodEnd) {
    try {
      return await this.repository.checkExistingRecord(employeeId, periodStart, periodEnd)
    } catch (error) {
      throw error
    }
  }

  async getRecentRecordsByEmployee(employeeId, limit = 6) {
    try {
      return await this.repository.getRecentRecordsByEmployee(employeeId, limit)
    } catch (error) {
      throw error
    }
  }

  /**
   * 批量重算未发工资；已发记录单独计入跳过数，不修改其原始快照。
   */
  async bulkRecalculateByPeriod(periodStart, periodEnd, operatorId) {
    identity({ employee_id: 1, period_start: periodStart, period_end: periodEnd })
    const employees = await this.repository.activeEmployeeIds()
    const results = {
      total: employees.length,
      recalculated: 0,
      skipped_paid: 0,
      errors: []
    }

    for (const emp of employees) {
      try {
        await this.saveCalculatedSalary({ employee_id: emp.id, period_start: periodStart, period_end: periodEnd }, operatorId)
        results.recalculated += 1
      } catch (error) {
        if (error.code === 'SALARY_RECORD_PAID') results.skipped_paid += 1
        else results.errors.push({ employee_id: emp.id, message: error.message })
      }
    }

    return results
  }

  /**
   * 批量获取员工销售数据（用于薪资计算）
   * 返回指定时间段内所有员工的销售统计（含全新机和二手机）
   * 排除请假日期的销售数据（与工资计算逻辑保持一致）
   */
  async getEmployeesSalesData(periodStart, periodEnd) {
    const db = getDatabase()
    return await withConnection(db, async conn => {
      // 首先获取所有员工在周期内的请假记录
      const leaveQuery = `
        SELECT employee_id, record_date, leave_days, leave_type, leave_reason
        FROM attendance_records
        WHERE record_date BETWEEN ? AND ?
          AND status = 'approved'
          AND record_type = 'leave'
      `
      const [leaveRows] = await conn.execute(leaveQuery, [periodStart, periodEnd])

      // 构建每个员工的请假过滤规则
      const employeeLeaveRows = new Map()
      leaveRows.forEach(row => {
        const employeeId = row.employee_id
        if (!employeeLeaveRows.has(employeeId)) {
          employeeLeaveRows.set(employeeId, [])
        }
        employeeLeaveRows.get(employeeId).push(row)
      })
      const employeeLeaveRules = new Map()
      employeeLeaveRows.forEach((rows, employeeId) => {
        employeeLeaveRules.set(employeeId, buildLeaveExclusionRules(rows))
      })

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
          p.sale_time
        FROM users u
        INNER JOIN phones p ON u.id = p.sale_operator_id
          AND p.sale_time IS NOT NULL
          AND DATE(p.sale_time) BETWEEN ? AND ?
          AND p.status = 'sold'
        LEFT JOIN sales latest_sale ON latest_sale.id = (${getLatestActiveSaleIdSql()})
        WHERE u.status = 1
          AND (latest_sale.sale_type IS NULL OR latest_sale.sale_type NOT IN ('wholesale', 'supplier_proxy', 'peer_transfer'))
        ORDER BY u.id, p.is_new DESC, p.sale_time DESC
      `

      const [rows] = await conn.execute(query, [periodStart, periodEnd])

      // 调试：记录查询结果
      log.debug(`[工资发放] 查询 ${periodStart} ~ ${periodEnd} 的销售数据：`)
      log.debug(`  - 原始查询结果数: ${rows.length}`)

      // 获取所有涉及员工的模板信息（用于过滤无提成的销售）
      const employeeIds = [...new Set(rows.map(r => r.employee_id))]

      // 如果没有员工数据，直接返回空结果
      if (employeeIds.length === 0) {
        return {}
      }

      const templatesQuery = `
        SELECT u.id as employee_id, st.*
        FROM users u
        LEFT JOIN salary_templates st ON u.salary_template_id = st.id
        WHERE u.id IN (${employeeIds.map(() => '?').join(',')})
      `
      const [templates] = await conn.execute(templatesQuery, employeeIds)

      // 构建员工模板信息映射
      const employeeTemplates = new Map()
      templates.forEach(t => {
        employeeTemplates.set(t.employee_id, t)
      })

      // 按员工统计销售数据，排除请假日期的销售
      const result = {}
      rows.forEach(row => {
        const empId = row.employee_id
        const leaveRules = employeeLeaveRules.get(empId)

        // 如果该员工有请假记录，且销售日期在请假期间，则跳过
        if (leaveRules && shouldExcludeSaleByLeave(row.sale_time, leaveRules)) {
          return // 跳过请假日期的销售
        }

        // 获取该员工的模板信息
        const template = employeeTemplates.get(empId)
        if (!template) {
          return // 没有模板，跳过（不应该发生）
        }

        // 检查该销售是否有提成
        const commissionType = template.commission_type || 'fixed'
        const isNew = row.is_new === 1
        const newRate = parseFloat(template.commission_new_fixed || template.commission_fixed || 0)
        const usedRate = parseFloat(template.commission_used_fixed || 0)
        const commissionPercentage = parseFloat(template.commission_percentage || 0)

        // 判断该员工是否有提成配置
        let hasCommissionConfig = false
        if (commissionType === 'fixed') {
          hasCommissionConfig = (newRate > 0 || usedRate > 0)
        } else if (commissionType === 'percentage') {
          hasCommissionConfig = (commissionPercentage > 0)
        }

        // 如果有提成配置，则只统计有提成的销售
        if (hasCommissionConfig) {
          if (commissionType === 'fixed') {
            if (isNew && newRate <= 0) return  // 全新机没有提成
            if (!isNew && usedRate <= 0) return  // 二手机没有提成
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
          }
        }

        const salePrice = parseFloat(row.sale_price) || 0
        const purchaseCost = parseFloat(row.purchase_cost) || 0
        const profit = salePrice - purchaseCost
        // isNew 已在上面声明，此处无需重复声明

        // 累加统计数据
        result[empId].sales_count += 1
        result[empId].sales_amount += salePrice
        result[empId].total_profit += profit

        if (isNew) {
          result[empId].new_count += 1
          result[empId].new_amount += salePrice
          result[empId].new_profit += profit
        } else {
          result[empId].used_count += 1
          result[empId].used_amount += salePrice
          result[empId].used_profit += profit
        }
      })

      // 调试：输出每个员工的销售统计
      log.debug('  - 过滤后员工销售统计：')
      Object.values(result).forEach(emp => {
        log.debug(`    员工 ${emp.employee_id} (${emp.name}): ${emp.sales_count}台`)
      })

      return result
    })
  }

  /**
   * 获取单个员工的销售明细列表
   * 返回指定时间段内该员工的销售记录详情（含全新机和二手机）
   * 排除请假日期的销售数据（与工资计算逻辑保持一致）
   * 只返回实际有提成的销售
   */
  async getEmployeeSalesDetails(employeeId, periodStart, periodEnd) {
    const db = getDatabase()
    return await withConnection(db, async conn => {
      // 首先获取该员工在周期内的请假记录
      const leaveQuery = `
        SELECT record_date, leave_days, leave_type, leave_reason
        FROM attendance_records
        WHERE employee_id = ?
          AND record_date BETWEEN ? AND ?
          AND status = 'approved'
          AND record_type = 'leave'
      `
      const [leaveRows] = await conn.execute(leaveQuery, [employeeId, periodStart, periodEnd])

      const leaveRules = buildLeaveExclusionRules(leaveRows)

      // 获取该员工的模板信息（用于过滤无提成的销售）
      const templateQuery = `
        SELECT st.*
        FROM users u
        LEFT JOIN salary_templates st ON u.salary_template_id = st.id
        WHERE u.id = ?
      `
      const [templates] = await conn.execute(templateQuery, [employeeId])
      const template = templates[0]

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
          p.sale_time as sale_time,
          p.status,
          p.is_new,
          cust.name as customer_name,
          cust.phone as customer_phone
        FROM phones p
        LEFT JOIN brands b ON p.brand_id = b.id
        LEFT JOIN models m ON p.model_id = m.id
        LEFT JOIN colors c ON p.color_id = c.id
        LEFT JOIN memories mem ON p.memory_id = mem.id
        LEFT JOIN sales latest_sale ON latest_sale.id = (${getLatestActiveSaleIdSql()})
        LEFT JOIN customers cust ON latest_sale.customer_id = cust.id
        WHERE p.sale_operator_id = ?
          AND p.sale_time IS NOT NULL
          AND DATE(p.sale_time) BETWEEN ? AND ?
          AND p.status = 'sold'
          AND (latest_sale.sale_type IS NULL OR latest_sale.sale_type NOT IN ('wholesale', 'supplier_proxy', 'peer_transfer'))
        ORDER BY p.is_new DESC, p.sale_time DESC
      `

      const [rows] = await conn.execute(query, [employeeId, periodStart, periodEnd])

      // 过滤掉请假日期的销售记录和没有提成的销售
      const filteredRows = rows.filter(row => {
        // 排除请假日期的销售
        if (shouldExcludeSaleByLeave(row.sale_time, leaveRules)) return false

        // 排除没有提成的销售（如果模板存在）
        if (template) {
          const commissionType = template.commission_type || 'fixed'
          const isNew = row.is_new === 1
          const newRate = parseFloat(template.commission_new_fixed || template.commission_fixed || 0)
          const usedRate = parseFloat(template.commission_used_fixed || 0)
          const commissionPercentage = parseFloat(template.commission_percentage || 0)

          // 判断该员工是否有提成配置
          let hasCommissionConfig = false
          if (commissionType === 'fixed') {
            hasCommissionConfig = (newRate > 0 || usedRate > 0)
          } else if (commissionType === 'percentage') {
            hasCommissionConfig = (commissionPercentage > 0)
          }

          // 如果有提成配置，则只返回有提成的销售
          if (hasCommissionConfig) {
            if (commissionType === 'fixed') {
              if (isNew && newRate <= 0) return false  // 全新机没有提成
              if (!isNew && usedRate <= 0) return false  // 二手机没有提成
            }
            // percentage 模式不过滤，因为所有销售都有利润提成
          }
        }

        return true
      })

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
        sale_time: row.sale_time,
        customer_name: row.customer_name || '-',
        customer_phone: row.customer_phone || '-'
      }))
    })
  }
}

module.exports = new SalaryRecordService()
