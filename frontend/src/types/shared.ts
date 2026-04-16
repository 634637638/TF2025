/**
 * 跨模块复用的基础业务类型
 * 避免在 index/system/api 中重复定义
 */

export interface User {
  id: number
  username: string
  name: string
  role?: string | null
  roles?: string[]
  role_id?: number | null
  role_ids?: number[]
  status: 'active' | 'inactive'
  last_login?: string
  employeeId?: string
  position?: string
  permissions?: string[]
  email?: string
  phone?: string
  store_id?: number
  store_ids?: number[]
  stores?: Array<{
    store_id: number
    store_name: string
    is_primary: number
  }>
  created_at?: string
  updated_at?: string
}

export interface Store {
  id: number
  name: string
  code: string
  type?: 'retail' | 'wholesale' | 'service' | 'mixed'
  province?: string
  city?: string
  district?: string
  address?: string
  location?: string
  phone?: string
  contact_person?: string
  manager_id?: number
  manager_name?: string
  manager?: string
  business_hours?: string
  status: number | 0 | 1 | 'active' | 'inactive' | 'suspended'
  is_default?: boolean
  sort_order?: number
  description?: string
  created_at?: string
  updated_at?: string
}
