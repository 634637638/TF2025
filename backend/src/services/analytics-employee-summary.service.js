'use strict'

const { isConnected } = require('../config/database')
const AnalyticsEmployeeSummaryRepository = require('../repositories/analytics-employee-summary.repository')
const { hasValidQueryValue, parseOptionalDate, getBeijingMonthRange } = require('../utils/analytics-query')
const SalaryCalculatorService = require('./salary-calculator.service')

const RECORD_TYPE_LABELS = {
  late: '迟到',
  early_leave: '早退',
  absent: '缺勤',
  leave: '请假',
  monthly_leave: '月休',
  overtime: '加班',
  normal: '正常'
}

const formatRecordType = (recordType, leaveType) => {
  if (recordType === 'leave' && leaveType) {
    return `${RECORD_TYPE_LABELS[recordType] || recordType}·${leaveType}`
  }
  return RECORD_TYPE_LABELS[recordType] || recordType || '未知'
}

class AnalyticsEmployeeSummaryService {
  constructor({
    repository = new AnalyticsEmployeeSummaryRepository(),
    connected = isConnected,
    now = () => new Date(),
    monthRange = getBeijingMonthRange,
    salaryCalculator = SalaryCalculatorService
  } = {}) {
    this.repository = repository
    this.connected = connected
    this.now = now
    this.monthRange = monthRange
    this.salaryCalculator = salaryCalculator
  }

  assertConnected() {
    if (!this.connected()) throw new Error('数据库连接失败')
  }

  async getSalaryTrend(monthCount, storeId) {
    this.assertConnected()
    const rows = await this.repository.getSalaryTotals(monthCount, storeId)
    const months = []
    const salaries = []
    const now = this.now()

    for (let i = monthCount - 1; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const month = date.toISOString().slice(0, 7)
      months.push(`${date.getMonth() + 1}月`)
      const found = rows.find(row => row.month === month)
      salaries.push(found ? Math.round(found.total) : 0)
    }

    return { months, salaries }
  }

  async getEmployeeOverview({ startDate, endDate, storeId }) {
    if (hasValidQueryValue(startDate) && !parseOptionalDate(startDate)) {
      throw Object.assign(new Error('开始日期格式无效'), { statusCode: 400 })
    }
    if (hasValidQueryValue(endDate) && !parseOptionalDate(endDate)) {
      throw Object.assign(new Error('结束日期格式无效'), { statusCode: 400 })
    }
    this.assertConnected()
    const dateRange = startDate && endDate
      ? { startDate, endDate }
      : this.monthRange(0)
    const overview = await this.repository.getEmployeeOverview({ ...dateRange, storeId })
    const payrollResults = overview.payrollEmployeeIds.length > 0
      ? await this.salaryCalculator.batchCalculateSalary(
        overview.payrollEmployeeIds,
        dateRange.startDate,
        dateRange.endDate,
        { logExpectedErrors: false }
      )
      : []
    const payroll = {
      totalSalary: 0,
      baseSalaryTotal: 0,
      commissionTotal: 0,
      overtimePayTotal: 0,
      deductionTotal: 0,
      templateEmployeeCount: overview.payrollEmployeeIds.length,
      calculatedEmployeeCount: 0,
      failedEmployeeCount: 0
    }
    payrollResults.forEach(result => {
      if (!result.success || !result.data) {
        payroll.failedEmployeeCount += 1
        return
      }
      const salary = result.data
      const baseSalary = parseFloat(salary.base_salary) || 0
      const commissionAmount = parseFloat(salary.commission_amount) || 0
      const overtimePay = parseFloat(salary.overtime_pay) || 0
      const deductionAmount = (parseFloat(salary.leave_deduction) || 0) + (parseFloat(salary.other_deduction) || 0)
      payroll.baseSalaryTotal += baseSalary
      payroll.commissionTotal += commissionAmount
      payroll.overtimePayTotal += overtimePay
      payroll.deductionTotal += deductionAmount
      payroll.totalSalary += baseSalary + commissionAmount + overtimePay - deductionAmount
      payroll.calculatedEmployeeCount += 1
    })

    const totalCount = overview.totalEmployees.count || 0
    const activeCount = overview.activeEmployees.count || 0
    const totalSales = overview.totalSalesAmount.total || 0
    const attendance = overview.attendance
    return {
      totalCount,
      activeCount,
      totalSalary: Math.round(payroll.totalSalary * 100) / 100,
      baseSalaryTotal: Math.round(payroll.baseSalaryTotal * 100) / 100,
      commissionTotal: Math.round(payroll.commissionTotal * 100) / 100,
      overtimePayTotal: Math.round(payroll.overtimePayTotal * 100) / 100,
      deductionTotal: Math.round(payroll.deductionTotal * 100) / 100,
      templateEmployeeCount: payroll.templateEmployeeCount,
      calculatedEmployeeCount: payroll.calculatedEmployeeCount,
      failedEmployeeCount: payroll.failedEmployeeCount,
      avgAttendance: attendance.total > 0 ? Math.round((attendance.approved / attendance.total) * 100) : 0,
      storeCount: overview.stores.count || 0,
      newCount: overview.newPhoneSales.count || 0,
      usedCount: overview.usedPhoneSales.count || 0,
      avgSales: activeCount > 0 ? Math.round(totalSales / activeCount) : 0,
      totalTrend: 'stable',
      totalChange: 0,
      salaryTrend: 'stable',
      salaryChange: 0
    }
  }

  async getAttendanceDistribution(storeId) {
    this.assertConnected()
    const rows = await this.repository.getAttendanceCounts(storeId)
    const stats = { normal: 0, late: 0, early: 0, absent: 0, leave: 0 }

    rows.forEach(item => {
      if (item.status !== 'approved') return
      switch (item.record_type) {
      case 'normal':
        stats.normal += item.count
        break
      case 'late':
        stats.late += item.count
        break
      case 'early_leave':
        stats.early += item.count
        break
      case 'absent':
        stats.absent += item.count
        break
      case 'leave':
        stats.leave += item.count
        break
      }
    })

    const total = Object.values(stats).reduce((sum, value) => sum + value, 0)
    return [
      { value: total > 0 ? Math.round((stats.normal / total) * 100) : 0, name: '正常', color: '#52c41a' },
      { value: total > 0 ? Math.round((stats.late / total) * 100) : 0, name: '迟到', color: '#faad14' },
      { value: total > 0 ? Math.round((stats.early / total) * 100) : 0, name: '早退', color: '#fa8c16' },
      { value: total > 0 ? Math.round((stats.absent / total) * 100) : 0, name: '缺勤', color: '#ff4d4f' }
    ]
  }

  async getAttendanceSummary({ startDate: requestedStartDate, endDate: requestedEndDate, storeId }) {
    if (hasValidQueryValue(requestedStartDate) && !parseOptionalDate(requestedStartDate)) {
      throw Object.assign(new Error('开始日期格式无效'), { statusCode: 400 })
    }
    if (hasValidQueryValue(requestedEndDate) && !parseOptionalDate(requestedEndDate)) {
      throw Object.assign(new Error('结束日期格式无效'), { statusCode: 400 })
    }
    this.assertConnected()

    const { summaryRow = {}, records: recordRows = [], alerts: alertRows = [] } = await this.repository.getAttendanceSummary({
      startDate: requestedStartDate,
      endDate: requestedEndDate,
      storeId
    })
    const records = recordRows.map(item => {
      let detail = '-'
      if (item.record_type === 'leave') {
        detail = `${parseFloat(item.leave_days) || 0}天`
      } else if (item.record_type === 'monthly_leave') {
        detail = `${parseFloat(item.leave_days || item.monthly_leave_days) || 0}天`
      } else if (item.record_type === 'overtime') {
        detail = `${parseFloat(item.overtime_hours) || 0}小时`
      }

      return {
        date: item.record_date,
        employee_name: item.employee_name || '未知',
        store_name: item.store_name || '',
        type: formatRecordType(item.record_type, item.leave_type),
        status: item.status === 'pending' ? 'pending' : item.status === 'approved' ? 'approved' : 'processed',
        detail,
        approved_at: item.approved_at || '',
        approval_note: item.approval_note || ''
      }
    })
    const alerts = alertRows.map(item => ({
      date: item.record_date,
      employee_name: item.employee_name || '未知',
      store_name: item.store_name || '',
      type: formatRecordType(item.record_type),
      status: item.status === 'pending' ? 'pending' : 'processed'
    }))

    return {
      summary: {
        totalRecords: parseInt(summaryRow.total_records, 10) || 0,
        employeeCount: parseInt(summaryRow.employee_count, 10) || 0,
        pendingCount: parseInt(summaryRow.pending_count, 10) || 0,
        approvedCount: parseInt(summaryRow.approved_count, 10) || 0,
        abnormalCount: parseInt(summaryRow.abnormal_count, 10) || 0,
        leaveCount: parseInt(summaryRow.leave_count, 10) || 0,
        overtimeCount: parseInt(summaryRow.overtime_count, 10) || 0
      },
      records,
      alerts
    }
  }

  async getEmployeePerformance({ metric = 'totalSales', pageSize = 20, storeId = null }) {
    if (!Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 100) {
      throw Object.assign(new Error('每页数量无效'), { statusCode: 400 })
    }
    this.assertConnected()
    const employees = await this.repository.getEmployeePerformance({ metric, pageSize, storeId })
    const employeeIds = employees.map(employee => employee.id)
    let salaryData = {}
    let attendanceData = {}

    if (employeeIds.length > 0) {
      const month = this.monthRange(0)
      const salaryResults = await this.salaryCalculator.batchCalculateSalary(
        employeeIds,
        month.startDate,
        month.endDate,
        { logExpectedErrors: false }
      )
      salaryData = Object.fromEntries(
        salaryResults
          .filter(item => item.success && item.data)
          .map(item => {
            const salary = item.data.base_salary + item.data.commission_amount + item.data.overtime_pay -
              (item.data.leave_deduction + item.data.other_deduction)
            return [item.data.employee_id, salary]
          })
      )

      const attendanceResults = await this.repository.getAttendanceRates(employeeIds)
      attendanceData = Object.fromEntries(attendanceResults.map(item => [
        item.employee_id,
        item.total > 0 ? (item.approved / item.total) * 100 : 0
      ]))
    }

    return employees.map(employee => {
      const sales = parseFloat(employee.total_sales) || 0
      return {
        ...employee,
        new_sales: parseInt(employee.new_sales) || 0,
        used_sales: parseInt(employee.used_sales) || 0,
        wholesale_count: parseInt(employee.wholesale_count) || 0,
        allocation_count: parseInt(employee.allocation_count) || 0,
        total_sales: sales,
        salary: Math.round(salaryData[employee.id] || 0),
        attendance_rate: Math.round(attendanceData[employee.id] || 0),
        trend: sales > 50000 ? 'up' : sales > 20000 ? 'stable' : 'down'
      }
    })
  }
}

module.exports = AnalyticsEmployeeSummaryService
