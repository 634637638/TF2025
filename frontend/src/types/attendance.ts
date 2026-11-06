export type AttendanceRecordType = 'leave' | 'overtime' | 'monthly_leave'
export type AttendanceStatus = 'pending' | 'approved' | 'rejected'

export interface AttendanceRecord {
  id?: number
  employee_id?: number
  attendance_batch_id?: string
  record_date: string
  record_type: AttendanceRecordType
  leave_type?: string
  leave_days?: number
  leave_reason?: string
  overtime_hours?: number
  overtime_reason?: string
  monthly_leave_days?: number
  status?: AttendanceStatus
  approved_by?: number
  approved_at?: string
  approval_note?: string
  created_by?: number
  created_at?: string
  updated_at?: string
  employee_name?: string
  employee_phone?: string
  approver_name?: string
  creator_name?: string
}

export interface AttendanceFilters {
  page?: number
  page_size?: number
  employee_id?: number
  record_type?: AttendanceRecordType
  status?: AttendanceStatus | ''
  start_date?: string
  end_date?: string
}

export interface AttendancePagination {
  page: number
  page_size: number
  total: number
  total_pages: number
  has_next: boolean
  has_prev: boolean
}

export interface AttendanceListResult {
  records: AttendanceRecord[]
  pagination: AttendancePagination
}

export interface AttendanceLeaveHistory {
  year: number
  month: number
  used: number
  regular_leave_days: number
  monthly_limit: number
  is_full: boolean
  remaining: number
  has_regular_leave: boolean
}

export interface AttendanceLeaveBalance {
  monthly_limit: number
  used: number
  available: number
  total_quota: number
  is_leave_disabled: boolean
  template_bound: boolean
  consecutive_full_months: number
  monthly_history: AttendanceLeaveHistory[]
  last_month_remaining: number
  message: string | null
  monthly_balances?: Array<{
    month: string
    monthly_limit: number
    carry_in: number
    paid_used: number
    unpaid_used: number
    available: number
    carry_out: number
    quota: number
  }>
}

export interface AttendanceDashboardStats {
  last_month: {
    leave_days: number
    overtime_hours: number
  }
  current_month: {
    leave_days: number
    unpaid_leave_days: number
    overtime_hours: number
  }
  pending: {
    overtime_pay: number
    leave_deduction: number
    count: number
  }
}

export interface AttendanceStats {
  total: number
  pending: number
  approved: number
  rejected: number
  monthly_leave: number
  leave: number
  overtime: number
  absent: number
}
