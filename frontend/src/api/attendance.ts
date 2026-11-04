/**
 * 考勤管理 API 服务
 */
import { unifiedApi } from '@/utils/unified-api'
import type {
  AttendanceDashboardStats,
  AttendanceFilters,
  AttendanceLeaveBalance,
  AttendanceLeaveConfig,
  AttendanceListResult,
  AttendanceRecord
} from '@/types/attendance'

export type {
  AttendanceDashboardStats,
  AttendanceFilters,
  AttendanceLeaveBalance,
  AttendanceLeaveConfig,
  AttendanceLeaveHistory,
  AttendanceListResult,
  AttendancePagination,
  AttendanceRecord,
  AttendanceRecordType,
  AttendanceStats,
  AttendanceStatus
} from '@/types/attendance'

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
    return unifiedApi.get<AttendanceListResult>('/attendance', { params: filters })
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
  getLeaveBalance: (employee_id?: number, range?: { start_date?: string, end_date?: string }) => {
    return unifiedApi.get<AttendanceLeaveBalance>('/attendance/leave-balance', {
      params: { ...(employee_id ? { employee_id } : {}), ...(range || {}) }
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
