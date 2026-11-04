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

/** 统一的查询参数类型，避免页面使用显式 any。 */
export type QueryParamValue = string | number | boolean | null | undefined
export type QueryParams = Record<string, QueryParamValue>

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

export type SharedVisibility = 'public' | 'private'

export interface SharedAttachment {
  url: string
  name: string
  type: string
  size: number
}

export interface SharedAuthor {
  id: number
  name: string
  username: string
}

export interface SharedPost {
  id: number
  title: string
  content: string
  category: string
  visibility: SharedVisibility
  attachments: SharedAttachment[]
  is_pinned: boolean
  author_id: number
  author: SharedAuthor
  created_at: string
  updated_at: string
}

export interface SharedCategory {
  id: number
  name: string
  sort_order: number
  total: number
}

export interface SharedPostForm {
  title: string
  content: string
  category: string
  visibility: SharedVisibility
  attachments: SharedAttachment[]
}
