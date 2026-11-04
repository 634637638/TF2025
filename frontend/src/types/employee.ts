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
  status: number
  last_login?: string
  created_at?: string
  updated_at?: string
  hire_date?: string
  salary_template_id?: number
  salary_template_name?: string
  role_names?: string
  role_ids: number[]
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
  role_ids: number[]
  password?: string
  confirm_password?: string
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
    page_size: number
    total: number
    total_pages: number
    has_next: boolean
    has_prev: boolean
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
    page_size: number
    total: number
    total_pages: number
    has_next: boolean
    has_prev: boolean
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
