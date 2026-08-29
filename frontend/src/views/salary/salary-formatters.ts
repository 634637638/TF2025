export type SalaryTagType = 'success' | 'warning' | 'info' | 'primary' | 'danger'

export const formatSalarySaleTime = (time: string) => {
  if (!time) return '-'
  try {
    return new Date(time).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    })
  } catch {
    return time
  }
}

export const formatSalaryPayoutTime = (time: string) => {
  if (!time) return '-'
  const date = new Date(time)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export const getSalaryPaymentMethodName = (method: string) => {
  const paymentMethodMap: Record<string, string> = {
    cash: '现金',
    bank_transfer: '银行转账',
    wechat: '微信支付',
    alipay: '支付宝',
    other: '其他'
  }
  return paymentMethodMap[method] || method || '-'
}

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
  const date = new Date(periodStart)
  return `${date.getFullYear()}-${date.getMonth() + 1}月`
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
