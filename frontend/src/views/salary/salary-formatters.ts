import { getPaymentMethodLabel } from '@/constants/paymentMethods'
import { TIME_FORMATS, TimeUtil } from '@/utils/time'

export type SalaryTagType = 'success' | 'warning' | 'info' | 'primary' | 'danger'

export const formatSalarySaleTime = (time: string) => {
  if (!time) return '-'
  return TimeUtil.format(time, TIME_FORMATS.DATE)
}

export const formatSalaryPayoutTime = (time: string) => {
  if (!time) return '-'
  return TimeUtil.toDateInputValue(time) || '-'
}

export const getSalaryPaymentMethodName = (method: string) => getPaymentMethodLabel(method)

export const formatSalaryWorkDays = (days: unknown) => {
  const numericDays = Number(days)
  if (!numericDays || numericDays <= 0) return '-'
  return Number.isInteger(numericDays) ? numericDays : numericDays.toFixed(1)
}

export const formatSalaryLeaveDays = (days: unknown) => {
  const numericDays = Number(days)
  if (Number.isNaN(numericDays)) return '0'
  return Number.isInteger(numericDays) ? numericDays : numericDays.toFixed(1)
}

export const formatSalaryOvertimeHours = (hours: unknown) => {
  const numericHours = Number(hours)
  if (!numericHours || numericHours <= 0) return '0小时'
  return `${numericHours}小时`
}

export const formatSalaryAmount = (amount: unknown) => {
  const numericAmount = Number(amount)
  if (Number.isNaN(numericAmount)) return '0'
  return Number.isInteger(numericAmount) ? numericAmount.toString() : numericAmount.toFixed(2)
}

export const formatSalaryMonth = (periodStart: string) => {
  if (!periodStart) return '-'
  return TimeUtil.format(periodStart, 'YYYY-M月')
}

export const formatSalaryNumber = (value: number | string): string => {
  const number = typeof value === 'string' ? parseFloat(value) : value
  if (Number.isNaN(number)) return '0'
  return number.toLocaleString('zh-CN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  })
}

export const getAttendanceTypeText = (type: string) => {
  const labels: Record<string, string> = {
    monthly_leave: '休假',
    leave: '请假',
    overtime: '加班'
  }
  return labels[type] || type
}

export const getAttendanceTypeTag = (type: string): SalaryTagType => {
  const tags: Record<string, SalaryTagType> = {
    monthly_leave: 'success',
    leave: 'warning',
    overtime: 'primary'
  }
  return tags[type] || 'info'
}
