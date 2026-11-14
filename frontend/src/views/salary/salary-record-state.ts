import type { SalaryPayoutRecord, SalaryCalculation, SalaryCalculatedSaveInput } from '@/types/salary'

/** 发放状态或实际发放时间任一存在，均保留原工资事实。 */
export const isPaidSalaryRecord = (record: Pick<SalaryPayoutRecord, 'status' | 'paid_at'> | null | undefined) =>
  Boolean(record && (record.status === 'paid' || Boolean(record.paid_at)))

/** 自动重算只提交身份与预览版本，不能回传服务器摘要或内部快照。 */
export const salaryCalculationInput = (record: SalaryCalculation): SalaryCalculatedSaveInput => ({
  employee_id: record.employee_id, period_start: record.period_start, period_end: record.period_end,
  expected_calculation_version: record.calculation_version
})

export const salaryPhoneCommission = (record: Pick<SalaryPayoutRecord, 'commission_amount' | 'goods_commission'>) =>
  (Math.round(Number(record.commission_amount || 0) * 100) - Math.round(Number(record.goods_commission?.net_amount || 0) * 100)) / 100
