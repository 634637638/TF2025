import dayjs from 'dayjs'
import type { AttendanceRecord } from '@/api/attendance'

type NumericValue = number | string | null | undefined

export interface SalaryEmployeeDataItem {
  id: number
  salary_template_id?: number | null
  [key: string]: unknown
}

export interface SalaryEmployeeSalaryDetail {
  id: number
  current_salary?: NumericValue
  base_salary?: NumericValue
  salary_adjustment?: NumericValue
  salary_note?: string | null
}

export interface SalaryEmployeeTemplate {
  commission_type?: string | null
  commission_fixed?: NumericValue
  commission_new_fixed?: NumericValue
  commission_used_fixed?: NumericValue
  commission_percentage?: NumericValue
  overtime_hourly_rate?: NumericValue
  rest_days?: NumericValue
}

export interface SalaryEmployeeAttendanceStats {
  leave_days: number
  overtime_hours: number
  monthly_leave_days_used: number
  monthly_leave_days_available: number
  latest_leave_activity_at: string | null
  latest_leave_record_date: string | null
}

export interface SalaryEmployeeSalesSource {
  sales_count?: NumericValue
  sales_amount?: NumericValue
  total_profit?: NumericValue
  new_count?: NumericValue
  new_amount?: NumericValue
  new_profit?: NumericValue
  used_count?: NumericValue
  used_amount?: NumericValue
  used_profit?: NumericValue
}

export interface SalaryEmployeeSalesStats {
  sales_count: number
  sales_amount: number
  total_profit: number
  new_count: number
  new_amount: number
  new_profit: number
  used_count: number
  used_amount: number
  used_profit: number
  commission_amount: number
  overtime_hours: number
  overtime_pay: number
}

export interface SalaryMonthRange {
  attendance_start_date: string
  end_date: string
  start_date: string
}

const toNumber = (value: NumericValue) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export const getSalaryMonthRange = (month?: string): SalaryMonthRange => {
  const requestedMonth = month && /^\d{4}-\d{2}$/.test(month)
    ? dayjs(`${month}-01`)
    : dayjs()
  const selectedMonth = requestedMonth.isValid() ? requestedMonth : dayjs()

  return {
    attendance_start_date: selectedMonth.subtract(1, 'month').startOf('month').format('YYYY-MM-DD'),
    start_date: selectedMonth.startOf('month').format('YYYY-MM-DD'),
    end_date: selectedMonth.endOf('month').format('YYYY-MM-DD')
  }
}

export const mergeEmployeeSalaryDetails = (
  employees: SalaryEmployeeDataItem[],
  salaryDetails: SalaryEmployeeSalaryDetail[]
) => {
  const detailsById = new Map(salaryDetails.map(detail => [detail.id, detail]))
  return employees.map(employee => {
    const salary = detailsById.get(employee.id)
    return {
      ...employee,
      current_salary: toNumber(salary?.current_salary),
      base_salary: toNumber(salary?.base_salary),
      salary_adjustment: toNumber(salary?.salary_adjustment),
      salary_note: salary?.salary_note || ''
    }
  })
}

export const buildEmployeeAttendanceStats = (
  records: AttendanceRecord[],
  currentMonthStart: string,
  currentMonthEnd: string,
  getMonthlyRestDays: (employeeId: number) => number
) => {
  const attendance = new Map<number, SalaryEmployeeAttendanceStats>()
  const lastMonthRest = new Map<number, number>()
  const lastMonthHasLeave = new Set<number>()
  const totalRest = new Map<number, number>()

  const getStats = (employeeId: number) => {
    const existing = attendance.get(employeeId)
    if (existing) return existing

    const created: SalaryEmployeeAttendanceStats = {
      leave_days: 0,
      overtime_hours: 0,
      monthly_leave_days_used: 0,
      monthly_leave_days_available: 0,
      latest_leave_activity_at: null,
      latest_leave_record_date: null
    }
    attendance.set(employeeId, created)
    return created
  }

  records.forEach(record => {
    if (!record.employee_id || !record.record_date) return

    const employeeId = record.employee_id
    const recordDate = record.record_date
    const stats = getStats(employeeId)

    if (record.record_type === 'monthly_leave') {
      totalRest.set(employeeId, (totalRest.get(employeeId) || 0) + toNumber(record.monthly_leave_days))
    }

    if (recordDate < currentMonthStart) {
      if (record.record_type === 'monthly_leave') {
        lastMonthRest.set(employeeId, (lastMonthRest.get(employeeId) || 0) + toNumber(record.monthly_leave_days))
      } else if (record.record_type === 'leave') {
        lastMonthHasLeave.add(employeeId)
      }
      return
    }

    if (recordDate > currentMonthEnd) return

    if (record.record_type === 'leave') {
      stats.leave_days += toNumber(record.leave_days)
      const activityAt = record.approved_at || record.updated_at || record.created_at || null
      if (activityAt && (
        !stats.latest_leave_activity_at ||
        dayjs(activityAt).isAfter(dayjs(stats.latest_leave_activity_at))
      )) {
        stats.latest_leave_activity_at = activityAt
        stats.latest_leave_record_date = recordDate
      }
    } else if (record.record_type === 'overtime') {
      stats.overtime_hours += toNumber(record.overtime_hours)
    } else if (record.record_type === 'monthly_leave') {
      stats.monthly_leave_days_used += toNumber(record.monthly_leave_days)
    }
  })

  attendance.forEach((stats, employeeId) => {
    const monthlyRestDays = Math.max(0, getMonthlyRestDays(employeeId) || 2)
    const excessDays = Math.max(0, (totalRest.get(employeeId) || 0) - monthlyRestDays * 2)
    stats.leave_days += excessDays

    const previousRemaining = lastMonthHasLeave.has(employeeId)
      ? 0
      : Math.max(0, monthlyRestDays - (lastMonthRest.get(employeeId) || 0))
    stats.monthly_leave_days_available = monthlyRestDays + Math.min(previousRemaining, monthlyRestDays)
  })

  return attendance
}

const emptySalesStats = (): SalaryEmployeeSalesStats => ({
  sales_count: 0,
  sales_amount: 0,
  total_profit: 0,
  new_count: 0,
  new_amount: 0,
  new_profit: 0,
  used_count: 0,
  used_amount: 0,
  used_profit: 0,
  commission_amount: 0,
  overtime_hours: 0,
  overtime_pay: 0
})

export const buildEmployeeSalesStats = (
  employees: SalaryEmployeeDataItem[],
  salesData: Record<string, SalaryEmployeeSalesSource>,
  attendance: Map<number, SalaryEmployeeAttendanceStats>,
  getTemplate: (employee: SalaryEmployeeDataItem) => SalaryEmployeeTemplate | undefined
) => {
  const result = new Map<number, SalaryEmployeeSalesStats>()

  employees.forEach(employee => {
    const source = salesData[String(employee.id)] || {}
    const template = getTemplate(employee)
    const newCount = toNumber(source.new_count)
    const usedCount = toNumber(source.used_count)
    const totalProfit = toNumber(source.total_profit)
    const newRate = toNumber(template?.commission_new_fixed ?? template?.commission_fixed)
    const usedRate = toNumber(template?.commission_used_fixed)
    const countedUsed = template?.commission_type === 'fixed' && usedRate > 0 ? usedCount : 0
    const salesCount = template?.commission_type === 'fixed'
      ? newCount + countedUsed
      : toNumber(source.sales_count)
    const commissionAmount = template?.commission_type === 'fixed'
      ? newCount * newRate + countedUsed * usedRate
      : totalProfit * toNumber(template?.commission_percentage) / 100
    const overtimeHours = attendance.get(employee.id)?.overtime_hours || 0

    result.set(employee.id, {
      ...emptySalesStats(),
      sales_count: salesCount,
      sales_amount: toNumber(source.sales_amount),
      total_profit: totalProfit,
      new_count: newCount,
      new_amount: toNumber(source.new_amount),
      new_profit: toNumber(source.new_profit),
      used_count: usedCount,
      used_amount: toNumber(source.used_amount),
      used_profit: toNumber(source.used_profit),
      commission_amount: commissionAmount,
      overtime_hours: overtimeHours,
      overtime_pay: overtimeHours * toNumber(template?.overtime_hourly_rate)
    })
  })

  return result
}

export const buildEmptyEmployeeSalesStats = (employees: SalaryEmployeeDataItem[]) => (
  new Map(employees.map(employee => [employee.id, emptySalesStats()]))
)
