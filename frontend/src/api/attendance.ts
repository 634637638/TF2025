/**
 * 考勤管理 API 服务
 */
import { unifiedApi } from '@/utils/unified-api'

export interface AttendanceRecord {
  id?: number
  employee_id?: number
  record_date: string
  record_type: 'leave' | 'overtime' | 'absent' | 'monthly_leave'
  leave_type?: string
  leave_days?: number
  leave_reason?: string
  overtime_hours?: number
  overtime_reason?: string
  absent_days?: number
  absent_reason?: string
  monthly_leave_days?: number // 休假天数
  reason?: string // 通用备注字段（前端表单使用）
  status?: 'pending' | 'approved' | 'rejected'
  approved_by?: number
  approved_at?: string
  approval_note?: string
  created_by?: number
}

export interface AttendanceFilters {
  page?: number
  limit?: number
  employee_id?: number
  record_type?: 'leave' | 'overtime' | 'absent'
  status?: string
  start_date?: string
  end_date?: string
}

export const attendanceApi = {
  /**
   * 获取考勤记录列表
   */
  getAttendanceRecords: (filters: AttendanceFilters = {}) => {
    return unifiedApi.get('/attendance', { params: filters })
  },

  /**
   * 获取个人考勤记录
   */
  getMyAttendanceRecords: (filters: AttendanceFilters = {}) => {
    return unifiedApi.get('/attendance/my', { params: filters })
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
  approveAttendanceRecord: (id: number, status: string, note?: string) => {
    return unifiedApi.post(`/attendance/${id}/approve`, { status, note })
  },

  /**
   * 获取考勤统计
   */
  getAttendanceStats: (employeeId: number, startDate: string, endDate: string) => {
    return unifiedApi.get('/attendance/stats/summary', {
      params: { employee_id: employeeId, start_date: startDate, end_date: endDate }
    })
  },

  /**
   * 获取用户休假余额
   */
  getLeaveBalance: (employeeId?: number) => {
    return unifiedApi.get('/attendance/leave-balance', {
      params: employeeId ? { employee_id: employeeId } : {}
    })
  },

  /**
   * 获取休假配置（每月休假天数等）
   */
  getLeaveConfig: () => {
    return unifiedApi.get('/attendance/leave-config')
  },

  /**
   * 获取考勤仪表盘汇总统计
   */
  getDashboardStats: () => {
    return unifiedApi.get('/attendance/stats/dashboard')
  }
}
