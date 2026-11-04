export type SalaryRecordStatus = 'draft' | 'pending' | 'approved' | 'paid' | 'cancelled'
export type SalaryCommissionType = 'fixed' | 'percentage'
export type SalaryNumericValue = number | string | null

export interface SalaryTemplateAutoRaiseRule {
  enabled?: boolean
  years?: number
  months?: number
  amount?: number
  max_salary?: number
}

export interface SalaryTemplate {
  id: number
  name: string
  description?: string
  base_salary: number
  auto_raise_rule?: SalaryTemplateAutoRaiseRule | string | null
  commission_type: SalaryCommissionType
  commission_fixed?: number
  commission_new_fixed?: number
  commission_used_fixed?: number
  commission_percentage?: number
  overtime_hourly_rate: number
  rest_days: number
  is_active?: boolean | number | null
  is_default?: boolean | number | null
  employee_count?: number
  created_at?: string
  updated_at?: string
}

export type SalaryTemplateInput = Omit<SalaryTemplate, 'id'>

export interface TemplateFilters {
  page?: number
  page_size?: number
  is_active?: boolean
  is_default?: boolean
}

export interface SalaryRecord {
  id: number
  employee_id: number
  employee_name?: string
  username?: string
  store_id?: number
  store_name?: string
  salary_template_id?: number | null
  period_start: string
  period_end: string
  period?: string
  actual_work_days?: number
  base_salary: number
  base_salary_adjustment: number
  base_salary_note?: string
  commission_amount: number
  commission_detail?: string
  sales_count?: number
  overtime_hours: number
  overtime_pay: number
  performance_bonus: number
  other_bonus: number
  leave_days: number
  leave_deduction: number
  other_deduction: number
  net_salary: number
  total_salary?: number
  commission?: number
  allowance?: number
  deduction?: number
  late_count?: number
  absent_count?: number
  remarks?: string
  status?: SalaryRecordStatus
  paid_at?: string | null
  payment_method?: string | null
  created_by?: number
  created_at?: string
  updated_at?: string
}

export type SalaryRecordInput = Omit<SalaryRecord, 'id' | 'employee_name' | 'username' | 'store_id' | 'store_name' | 'created_at' | 'updated_at'>

export interface SalaryFilters {
  page?: number
  page_size?: number
  employee_id?: number
  store_id?: number
  status?: string
  period?: string
  period_start?: string
  period_end?: string
  start_date?: string
  end_date?: string
}

export interface SalaryListResponse {
  records: SalaryRecord[]
  pagination: {
    page: number
    page_size: number
    total: number
    total_pages: number
    has_next: boolean
    has_prev: boolean
  }
  stats?: {
    total_amount: number
    total_count: number
  }
}

export interface DeductionRule {
  type: 'late' | 'absent' | 'other'
  amount: number
  condition?: string
  description?: string
}

export interface SalaryTemplateForm {
  id?: number
  name: string
  description: string
  base_salary: number
  commission_type: SalaryCommissionType
  commission_fixed: number
  commission_new_fixed: number
  commission_used_fixed: number
  commission_percentage: number
  overtime_hourly_rate: number
  rest_days: number
  auto_raise_enabled: boolean
  auto_raise_months: number
  auto_raise_amount: number
  auto_raise_max_salary: number
}

export interface SalaryEmployeeOption {
  id: number
  name?: string | null
  username?: string | null
  salary_template_id?: number | null
}

export type SalaryPayoutStatus = 'paid' | 'unpaid'

export interface SalaryPayoutRecord {
  id?: number
  employee_id: number
  salary_template_id?: number | null
  period_start?: string
  period_end?: string
  base_salary?: number | string | null
  base_salary_adjustment?: number | string | null
  commission_amount?: number | string | null
  overtime_hours?: number | string | null
  overtime_pay?: number | string | null
  performance_bonus?: number | string | null
  other_bonus?: number | string | null
  leave_days?: number | string | null
  leave_deduction?: number | string | null
  other_deduction?: number | string | null
  net_salary?: number | string | null
  status?: string | null
  paid_at?: string | null
  payment_method?: string | null
  created_at?: string
  updated_at?: string
}

export interface SalaryPayoutEmployee extends SalaryEmployeeOption {
  id: number
}

export interface SalaryPayoutRow extends SalaryPayoutEmployee {
  payoutRecord: SalaryPayoutRecord | null
}

export type SalaryTemplateOption = Pick<SalaryTemplate, 'id' | 'name' | 'base_salary' | 'rest_days' | 'commission_type' | 'commission_fixed' | 'commission_new_fixed' | 'commission_used_fixed' | 'commission_percentage' | 'overtime_hourly_rate'> & {
  id: number
  name: string
}

export interface SalarySalesDetail {
  phone_id?: number
  imei?: string | null
  serial_number?: string | null
  brand?: string | null
  model?: string | null
  model_name?: string | null
  color?: string | null
  memory?: string | null
  is_new?: boolean | number | string
  condition_type?: string
  purchase_cost?: number | string | null
  sale_price?: number | string | null
  profit?: number | string | null
  sale_time?: string | null
  customer_name?: string | null
  customer_phone?: string | null
}
