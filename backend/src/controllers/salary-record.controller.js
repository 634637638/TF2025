const SalaryRecordService = require('../services/salary-record.service')
const ApiResponse = require('../utils/response')
const log = require('../utils/log')
const FieldAccessService = require('../services/field-access.service')
const {
  getSalaryAccessScope,
  resolveScopedTargetId,
  canAccessScopedTarget,
  hasUserPermission
} = require('../services/access-control.service')

/**
 * 工资记录控制器
 */
const fieldKeys = {
  'salary.commission_amount': ['commission_amount', 'commission_detail', 'goods_commission'],
  'salary.base_salary': ['base_salary', 'base_salary_adjustment', 'base_salary_note'],
  'salary.net_salary': ['net_salary', 'total_amount'], 'salary.sales_count': ['sales_count'],
  'salary.overtime_pay': ['overtime_pay'], 'salary.overtime_hours': ['overtime_hours'],
  'salary.leave_deduction': ['leave_deduction'], 'salary.leave_days': ['leave_days'],
  'salary.actual_work_days': ['actual_work_days'], 'salary.status': ['status'],
  'salary.paid_at': ['paid_at'], 'salary.payment_method': ['payment_method'],
  'salary.employee_name': ['employee_name'], 'salary.employee_username': ['username'],
  'salary.employee_phone': ['employee_phone'], 'salary.period_start': ['period_start', 'period_end']
}
const writeFields = Object.fromEntries(Object.entries(fieldKeys).flatMap(([field, keys]) => keys.map(key => [key, field])))

class SalaryRecordController {
  constructor({ service = SalaryRecordService, masking, hasPermission = hasUserPermission } = {}) {
    this.service = service
    this.hasPermission = hasPermission
    this.fields = Object.fromEntries(['salary_salaryrecordsview', 'salary_mysalaryview'].map(moduleKey => [moduleKey,
      new FieldAccessService({ moduleKey, responseKeys: fieldKeys, strict: true, ...(masking ? { masking } : {}) })]))
  }

  async fieldContext(userId, isAdmin = true, body = null) {
    const fields = this.fields[isAdmin ? 'salary_salaryrecordsview' : 'salary_mysalaryview']
    const permissions = await fields.getPermissions(userId)
    if (body) {
      if (fields.findDeniedWrite(body, writeFields, permissions)) {
        throw Object.assign(new Error('不能修改无编辑权限的工资字段'), { statusCode: 403, code: 'FIELD_PERMISSION_DENIED' })
      }
    }
    return value => fields.maskPayload(value, permissions)
  }

  async operate(req, res, operation, message, { write = false, status = 200 } = {}) {
    try {
      if (write && req.body?.status === 'approved' && !await this.hasPermission(this.getUserId(req), 'salary_salaryrecordsview', 'approve')) {
        return ApiResponse.forbidden(res, '设置已审批工资需要工资审批权限')
      }
      const mask = await this.fieldContext(this.getUserId(req), true, write ? req.body : null)
      const result = await operation()
      return ApiResponse.success(res, message, mask(result), status)
    } catch (error) {
      if (!error.statusCode || error.statusCode >= 500) log.error('工资记录操作失败:', error)
      return ApiResponse.error(res, error.message, error.statusCode || 500, error.code)
    }
  }

  /**
   * 获取当前用户ID
   */
  getUserId(req) {
    return req.user?.id || req.user?.userId || req.user?.sub
  }

  async getSalaryScope(userId) {
    return getSalaryAccessScope(userId)
  }

  /**
   * 获取工资记录列表
   * 工资数据范围由权限模块控制：
   * - salary_salaryrecordsview:view => 可查看全部员工
   * - salary_mysalaryview:view => 仅查看自己
   */
  async getSalaryRecords(req, res) {
    try {
      const { page, page_size, employee_id, status, period_start, period_end } = req.query
      const userId = this.getUserId(req)

      const scopeInfo = await this.getSalaryScope(userId)
      if (!scopeInfo?.canView) return ApiResponse.forbidden(res, '无权限查看工资记录')

      const filters = {}

      const scopedEmployeeId = resolveScopedTargetId(scopeInfo, userId, employee_id)
      if (scopedEmployeeId !== null) {
        filters.employee_id = scopedEmployeeId
      }

      if (scopeInfo.isAdmin) {
        // 全量查看权限：可以查看所有员工，也可以通过 employee_id 过滤
        if (status) filters.status = status
      } else {
        // 仅本人视角下，未发放工资不可见
        filters.status = 'paid'
      }

      if (period_start) filters.period_start = period_start
      if (period_end) filters.period_end = period_end

      const pageValue = Number.parseInt(String(page || 1), 10)
      const pageSizeValue = Number.parseInt(String(page_size ?? 20), 10)
      const options = {
        page: Number.isSafeInteger(pageValue) ? Math.max(1, pageValue) : 1,
        page_size: Number.isSafeInteger(pageSizeValue) ? Math.min(100, Math.max(1, pageSizeValue)) : 20
      }

      const mask = await this.fieldContext(userId, scopeInfo.isAdmin)
      const result = await this.service.getSalaryRecords(filters, options)
      ApiResponse.success(res, '获取工资记录列表成功', mask(result), 200)
    } catch (error) {
      log.error('获取工资记录列表失败:', error)
      ApiResponse.error(res, error.message, error.statusCode || 500, error.code)
    }
  }

  /**
   * 获取工资记录详情
   */
  async getSalaryRecordById(req, res) {
    try {
      const { id } = req.params
      const userId = this.getUserId(req)
      const scopeInfo = await this.getSalaryScope(userId)
      if (!scopeInfo?.canView) return ApiResponse.forbidden(res, '无权限查看工资记录')
      const mask = await this.fieldContext(userId, scopeInfo.isAdmin)
      const result = await this.service.getSalaryRecordById(id)

      if (!result) {
        return ApiResponse.error(res, '工资记录不存在', 404)
      }

      if (!canAccessScopedTarget(scopeInfo, userId, result.employee_id)) {
        return ApiResponse.forbidden(res, '无权限查看其他员工工资')
      }

      if (!scopeInfo.isAdmin) {
        if (result.status !== 'paid') {
          return ApiResponse.forbidden(res, '工资尚未发放，暂不可查看')
        }
      }

      ApiResponse.success(res, '获取工资记录详情成功', mask(result), 200)
    } catch (error) {
      log.error('获取工资记录详情失败:', error)
      ApiResponse.error(res, error.message, error.statusCode || 500, error.code)
    }
  }

  /**
   * 创建工资记录
   */
  async createSalaryRecord(req, res) {
    return this.operate(req, res, () => this.service.createSalaryRecord(req.body, this.getUserId(req)), '创建工资记录成功', { write: true, status: 201 })
  }

  /**
   * 更新工资记录
   */
  async updateSalaryRecord(req, res) {
    return this.operate(req, res, () => this.service.updateSalaryRecord(req.params.id, req.body), '更新工资记录成功', { write: true })
  }

  /**
   * 删除工资记录
   */
  async deleteSalaryRecord(req, res) {
    try {
      const { id } = req.params
      await this.service.deleteSalaryRecord(id)
      ApiResponse.success(res, '删除工资记录成功', null, 200)
    } catch (error) {
      if (!error.statusCode || error.statusCode >= 500) log.error('删除工资记录失败:', error)
      ApiResponse.error(res, error.message, error.statusCode || 500, error.code)
    }
  }

  /**
   * 计算工资
   */
  async calculateSalary(req, res) {
    const { employee_id, period_start, period_end } = req.body
    return this.operate(req, res, () => this.service.calculateSalary(employee_id, period_start, period_end), '计算工资成功')
  }

  /**
   * 保存计算的工资
   */
  async saveCalculatedSalary(req, res) {
    const userId = this.getUserId(req)
    return this.operate(req, res, async () => {
      const canApprove = await this.hasPermission(userId, 'salary_salaryrecordsview', 'approve')
      const input = { ...req.body, status: req.body.status ?? (canApprove ? 'approved' : 'pending') }
      return this.service.saveCalculatedSalary(input, userId, async (existing, connection) => {
        if (!await this.hasPermission(userId, 'salary_salaryrecordsview', existing ? 'edit' : 'create', connection)) {
          throw Object.assign(new Error(existing ? '没有编辑已有工资的权限' : '没有创建工资的权限'), { statusCode: 403, code: 'PERMISSION_DENIED' })
        }
      })
    }, '保存工资记录成功', { write: true, status: 201 })
  }

  /**
   * 批量计算工资
   */
  async batchCalculateSalaries(req, res) {
    const { employee_ids, period_start, period_end } = req.body
    return this.operate(req, res, () => this.service.batchCalculateSalaries(employee_ids, period_start, period_end), '批量计算工资完成')
  }

  /**
   * 审批工资记录
   */
  async approveSalaryRecord(req, res) {
    try {
      const { id } = req.params
      const approverId = this.getUserId(req)

      await this.service.approveSalaryRecord(id, approverId)
      ApiResponse.success(res, '审批工资记录成功', null, 200)
    } catch (error) {
      if (!error.statusCode || error.statusCode >= 500) log.error('审批工资记录失败:', error)
      ApiResponse.error(res, error.message, error.statusCode || 500, error.code)
    }
  }

  /**
   * 标记工资为已发放
   */
  async markAsPaid(req, res) {
    const { payment_method, expected_calculation_version } = req.body
    return this.operate(req, res, () => this.service.markAsPaid(req.params.id, { payment_method, expected_calculation_version }), '工资发放成功', { write: true })
  }

  /**
   * 获取工资统计
   */
  async getSalaryStats(req, res) {
    try {
      const userId = this.getUserId(req)
      const scopeInfo = await this.getSalaryScope(userId)
      if (!scopeInfo.isAdmin) {
        return ApiResponse.forbidden(res, '无权限查看工资统计')
      }

      const { period_start, period_end, status } = req.query

      const filters = {}
      if (period_start) filters.period_start = period_start
      if (period_end) filters.period_end = period_end
      if (status) filters.status = status

      const result = await this.service.getSalaryStats(filters)
      ApiResponse.success(res, '获取工资统计成功', result, 200)
    } catch (error) {
      log.error('获取工资统计失败:', error)
      ApiResponse.error(res, error.message, error.statusCode || 500, error.code)
    }
  }

  /**
   * 批量获取员工销售数据（用于薪资计算）
   * 返回指定时间段内所有员工的全新机销售统计
   */
  async getEmployeesSalesData(req, res) {
    try {
      const userId = this.getUserId(req)
      const { isAdmin } = await this.getSalaryScope(userId)
      if (!isAdmin) {
        return ApiResponse.forbidden(res, '无权限查看员工销售数据')
      }

      const { period_start, period_end } = req.query

      if (!period_start || !period_end) {
        return ApiResponse.error(res, '请提供时间范围（period_start 和 period_end）', 400)
      }

      const result = await this.service.getEmployeesSalesData(period_start, period_end)

      ApiResponse.success(res, '获取员工销售数据成功', result, 200)
    } catch (error) {
      log.error('获取员工销售数据失败:', error)
      ApiResponse.error(res, error.message, error.statusCode || 500, error.code)
    }
  }

  /**
   * 获取单个员工的销售明细列表
   * 返回指定时间段内该员工的销售记录详情
   * 只有“工资记录查看”权限可查看全部，否则只能查看自己的销售明细
   */
  async getEmployeeSalesDetails(req, res) {
    try {
      const userId = this.getUserId(req)
      const scopeInfo = await this.getSalaryScope(userId)

      const { employee_id, period_start, period_end } = req.query

      if (!employee_id || !period_start || !period_end) {
        return ApiResponse.error(res, '请提供员工ID和时间范围（employee_id, period_start, period_end）', 400)
      }

      // 检查权限：无全量查看权限时，只能查看自己的销售明细
      if (!canAccessScopedTarget(scopeInfo, userId, employee_id)) {
        return ApiResponse.forbidden(res, '无权限查看其他员工的销售明细')
      }

      const result = await this.service.getEmployeeSalesDetails(
        parseInt(resolveScopedTargetId(scopeInfo, userId, employee_id), 10),
        period_start,
        period_end
      )
      ApiResponse.success(res, '获取员工销售明细成功', result, 200)
    } catch (error) {
      log.error('获取员工销售明细失败:', error)
      ApiResponse.error(res, error.message, error.statusCode || 500, error.code)
    }
  }

  /**
   * 批量重算某月工资
   */
  async bulkRecalculateByPeriod(req, res) {
    try {
      const userId = this.getUserId(req)
      const { isAdmin } = await this.getSalaryScope(userId)
      if (!isAdmin) {
        return ApiResponse.forbidden(res, '无权限批量重算工资')
      }

      const { period_start, period_end } = req.body
      if (!period_start || !period_end) {
        return ApiResponse.error(res, '请提供时间范围（period_start 和 period_end）', 400)
      }

      const result = await this.service.bulkRecalculateByPeriod(period_start, period_end, userId, async (existing, connection) => {
        if (!await this.hasPermission(userId, 'salary_salaryrecordsview', existing ? 'edit' : 'create', connection)) {
          throw Object.assign(new Error(existing ? '没有编辑工资权限' : '没有新增工资权限'), { statusCode: 403 })
        }
      }, await this.hasPermission(userId, 'salary_salaryrecordsview', 'approve'))
      ApiResponse.success(res, '批量重算工资完成', result, 200)
    } catch (error) {
      if (!error.statusCode || error.statusCode >= 500) log.error('批量重算工资失败:', error)
      ApiResponse.error(res, error.message, error.statusCode || 500, error.code)
    }
  }
}

module.exports = new SalaryRecordController()
