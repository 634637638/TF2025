/**
 * 员工管理相关类型定义
 * 集中管理员工、角色等相关类型
 */

// ==================== 员工相关类型 ====================

/**
 * 员工信息接口
 */
export interface Employee {
  id: number
  username: string
  name: string
  phone?: string
  email?: string
  role: string
  status: number
  last_login?: string
  created_at?: string
  updated_at?: string
  hire_date?: string
  salary_template_id?: number
  salary_template_name?: string
  role_names?: string
  role_ids?: string
  roles?: string
  store_id?: number
  store_name?: string
  position?: string
}

/**
 * 员工表单数据
 */
export interface EmployeeForm {
  username: string
  name: string
  phone?: string
  email?: string
  role: string
  role_ids?: number[]
  password?: string
  store_id?: number
  hire_date?: string
  salary_template_id?: number
  status?: number
  position?: string
}

/**
 * 员工状态类型
 */
export type EmployeeStatus = 0 | 1 | 'active' | 'inactive' | 'pending'

/**
 * 员工列表筛选条件
 */
export interface EmployeeFilters {
  search?: string
  status?: string
  role?: string
  store_id?: number
  start_date?: string
  end_date?: string
}

/**
 * 员工列表响应
 */
export interface EmployeeListResponse {
  employees: Employee[]
  pagination: {
    page: number
    limit: number
    total: number
    pages: number
  }
}

// ==================== 角色相关类型 ====================

/**
 * 角色信息接口
 */
export interface Role {
  id: number
  name: string
  code?: string
  description?: string
  user_count: number
  created_at?: string
  updated_at?: string
  status?: number
  permissions?: string[]
}

/**
 * 角色表单数据
 */
export interface RoleForm {
  name: string
  code?: string
  description?: string
  permissions?: string[]
  status?: number
}

/**
 * 角色列表响应
 */
export interface RoleListResponse {
  roles: Role[]
  pagination: {
    page: number
    limit: number
    total: number
    pages: number
  }
}

// ==================== 权限相关类型 ====================

/**
 * 权限信息接口
 */
export interface Permission {
  id: number
  name: string
  code: string
  description?: string
  module: string
  action: string
  resource?: string
  parent_id?: number
  sort_order?: number
  status?: number
  created_at?: string
  updated_at?: string
}

/**
 * 权限组
 */
export interface PermissionGroup {
  id: number
  name: string
  code: string
  description?: string
  children?: Permission[]
  permissions?: Permission[]
}

/**
 * 权限树节点
 */
export interface PermissionTreeNode {
  id: string | number
  label: string
  code?: string
  children?: PermissionTreeNode[]
  disabled?: boolean
  isLeaf?: boolean
}

// ==================== 薪资模板相关类型 ====================

/**
 * 薪资模板接口
 */
export interface SalaryTemplate {
  id: number
  name: string
  base_salary: number
  commission_rate?: number
  allowance?: number
  deduction_rules?: DeductionRule[]
  created_at?: string
  updated_at?: string
  status?: number
}

/**
 * 扣款规则
 */
export interface DeductionRule {
  type: 'late' | 'absent' | 'other'
  amount: number
  condition?: string
  description?: string
}

/**
 * 薪资记录
 */
export interface SalaryRecord {
  id: number
  employee_id: number
  employee_name: string
  store_id: number
  store_name: string
  period: string
  base_salary: number
  commission?: number
  allowance?: number
  deduction?: number
  late_count?: number
  absent_count?: number
  overtime_hours?: number
  overtime_pay?: number
  total_salary: number
  status: 'pending' | 'approved' | 'paid'
  payment_date?: string
  remarks?: string
  created_at?: string
  updated_at?: string
}

/**
 * 薪资筛选条件
 */
export interface SalaryFilters {
  employee_id?: number
  store_id?: number
  period?: string
  status?: string
  start_date?: string
  end_date?: string
}

/**
 * 薪资列表响应
 */
export interface SalaryListResponse {
  records: SalaryRecord[]
  pagination: {
    page: number
    limit: number
    total: number
    pages: number
  }
  stats?: {
    total_amount: number
    total_count: number
  }
}

// ==================== 考勤相关类型 ====================

/**
 * 考勤记录类型
 */
export type AttendanceRecordType = 'monthly_leave' | 'leave' | 'overtime' | 'absent'

/**
 * 考勤状态
 */
export type AttendanceStatus = 'pending' | 'approved' | 'rejected'

/**
 * 考勤记录
 */
export interface AttendanceRecord {
  id: number
  employee_id: number
  employee_name: string
  store_id?: number
  store_name?: string
  record_type: AttendanceRecordType
  record_date: string
  start_date?: string
  end_date?: string
  // 休假类型
  monthly_leave_days?: number
  monthly_leave_type?: string
  // 请假类型
  leave_type?: string
  leave_days?: number
  // 加班类型
  overtime_hours?: number
  overtime_date?: string
  // 旷工类型
  absent_days?: number
  reason?: string
  status: AttendanceStatus
  approval_note?: string
  approved_by?: number
  approved_by_name?: string
  approved_at?: string
  created_at?: string
  updated_at?: string
}

/**
 * 考勤筛选条件
 */
export interface AttendanceFilters {
  employee_id?: number
  store_id?: number
  record_type?: AttendanceRecordType
  status?: AttendanceStatus
  start_date?: string
  end_date?: string
}

/**
 * 考勤列表响应
 */
export interface AttendanceListResponse {
  records: AttendanceRecord[]
  pagination: {
    page: number
    limit: number
    total: number
    pages: number
  }
  stats?: {
    total_count: number
    pending_count: number
    approved_count: number
  }
}

/**
 * 考勤统计
 */
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

// ==================== 补贴相关类型 ====================

/**
 * 补贴类型
 */
export type SubsidyType = 'transport' | 'meal' | 'housing' | 'communication' | 'performance' | 'other'

/**
 * 补贴记录
 */
export interface SubsidyRecord {
  id: number
  employee_id: number
  employee_name: string
  store_id: number
  store_name: string
  subsidy_type: SubsidyType
  amount: number
  period: string
  reason?: string
  status: 'pending' | 'approved' | 'paid'
  approved_by?: number
  approved_by_name?: string
  approved_at?: string
  payment_date?: string
  created_at?: string
  updated_at?: string
}

/**
 * 补贴筛选条件
 */
export interface SubsidyFilters {
  employee_id?: number
  store_id?: number
  subsidy_type?: SubsidyType
  status?: string
  period?: string
  start_date?: string
  end_date?: string
}

/**
 * 补贴列表响应
 */
export interface SubsidyListResponse {
  records: SubsidyRecord[]
  pagination: {
    page: number
    limit: number
    total: number
    pages: number
  }
  stats?: {
    total_amount: number
    total_count: number
  }
}
