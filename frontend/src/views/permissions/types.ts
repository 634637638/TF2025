import type { User as BaseUser } from '@/types'

export type Role = {
  id: number
  name: string
  code?: string | null
  description?: string
  role_type?: string | null
  status?: 'active' | 'inactive' | string | number
  is_active?: boolean | string
  user_count?: number
  permissions?: Array<{
    module_key: string
    permission_type: string
    module_category: string
  }>
  created_at: string
  updated_at: string
}

export type User = Omit<BaseUser, 'status' | 'roles'> & {
  full_name?: string
  role_id?: number
  status: number
  roles?: Role[]
}

export interface Module {
  key: string
  module_key?: string
  name: string
  icon: string
  category?: string
  selected?: boolean
  has_permission?: boolean
  permissions: Array<{
    type: string
    permission_type?: string
    granted: boolean
    assigned?: boolean
    selected?: boolean
    has_permission?: boolean
  }>
}

export type StatsPayload = Partial<Record<
  'total_roles' | 'total_users' | 'active_users' | 'system_roles' |
  'business_roles' | 'users_with_roles' | 'total_permissions' |
  'total_modules' | 'unregistered_modules',
  string | number
>>

export interface FieldDefinition {
  description?: string
  id: string
  name: string
  required?: boolean
  sensitivity: string
  type: string
}

export interface FieldGroup {
  fields: FieldDefinition[]
  name: string
  sensitivity: string
}

export interface RoleFieldModule {
  category?: string
  icon: string
  key?: string
  module_key?: string
  name: string
}

export interface StoreBinding {
  is_primary?: boolean | number
  store_id: number
  store_name: string
}

export interface StoreBindingUser {
  id: number
  name?: string
  stores?: StoreBinding[]
  username: string
}

export interface StoreOption {
  id: number
  name: string
}
