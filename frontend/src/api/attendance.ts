/**
 * 考勤管理 API 服务
 */
import { unifiedApi } from '@/utils/unified-api'

export interface AttendanceRecord {
  id?: number
  employee_id?: number
  record_date: string
  record_type: 'leave' | 'overtime' | 'monthly_leave'
  leave_type?: string
  leave_days?: number
  leave_reason?: string
  overtime_hours?: number
  overtime_reason?: string
  monthly_leave_days?: number // 休假天数
  status?: 'pending' | 'approved' | 'rejected'
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
  record_type?: 'leave' | 'overtime' | 'monthly_leave'
  status?: string
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
  consecutive_full_months: number
  monthly_history: AttendanceLeaveHistory[]
  last_month_remaining: number
  message: string | null
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

export interface AttendanceLeaveConfig {
  monthly_leave_days: number
}

export const attendanceApi = {
  /**
   * 获取考勤记录列表
   */
  getAttendanceRecords: (filters: AttendanceFilters = {}) => {
    return unifiedApi.get<AttendanceListResult>('/attendance', { params: filters })
  },

  /**
   * 获取个人考勤记录
   */
  getMyAttendanceRecords: (filters: AttendanceFilters = {}) => {
    return unifiedApi.get<AttendanceListResult>('/attendance/my', { params: filters })
  },

  /**
   * 获取考勤记录详情
   */
  getAttendanceRecordById: (id: number) => {
    return unifiedApi.get(`/attendance/${id}`)
  },

  /**
   * 创建考勤记录
   */
  createAttendanceRecord: (data: AttendanceRecord) => {
    return unifiedApi.post('/attendance', data)
  },

  /**
   * 更新考勤记录
   */
  updateAttendanceRecord: (id: number, data: Partial<AttendanceRecord>) => {
    return unifiedApi.put(`/attendance/${id}`, data)
  },

  /**
   * 删除考勤记录（管理员）
   */
  deleteAttendanceRecord: (id: number) => {
    return unifiedApi.delete(`/attendance/${id}`)
  },

  /**
   * 取消考勤申请（申请人本人）
   */
  cancelAttendanceRequest: (id: number) => {
    return unifiedApi.post(`/attendance/${id}/cancel`)
  },

  /**
   * 审批考勤记录
   */
  approveAttendanceRecord: (id: number, status: string, approval_note?: string) => {
    return unifiedApi.post(`/attendance/${id}/approve`, { status, approval_note })
  },

  /**
   * 获取考勤统计
   */
  getAttendanceStats: (employee_id: number, start_date: string, end_date: string) => {
    return unifiedApi.get('/attendance/stats/summary', {
      params: { employee_id, start_date, end_date }
    })
  },

  /**
   * 获取用户休假余额
   */
  getLeaveBalance: (employee_id?: number) => {
    return unifiedApi.get<AttendanceLeaveBalance>('/attendance/leave-balance', {
      params: employee_id ? { employee_id } : {}
    })
  },

  /**
   * 获取休假配置（每月休假天数等）
   */
  getLeaveConfig: () => {
    return unifiedApi.get<AttendanceLeaveConfig>('/attendance/leave-config')
  },

  /**
   * 获取考勤仪表盘汇总统计
   */
  getDashboardStats: () => {
    return unifiedApi.get<AttendanceDashboardStats>('/attendance/stats/dashboard')
  }
}
