/**
 * 用户管理 API 服务
 */
import { unifiedApi } from '@/utils/unified-api'

export interface User {
  id: number
  username: string
  name?: string
  email?: string
  phone?: string
  role?: string
  status?: number | string
  store_id?: number
  salary_template_id?: number
  group_name?: string
  created_at?: string
  updated_at?: string
}

export interface UserFilters {
  page?: number
  limit?: number
  role?: string
  status?: string | number
  store_id?: number
}

export interface UserListResponse {
  users: User[]
  pagination: {
    page: number
    limit: number
    total: number
  }
}

export const userApi = {
  /**
   * 获取用户列表
   */
  getUsers: (filters: UserFilters = {}) => {
    return unifiedApi.get('/users', { params: filters })
  },

  /**
   * 获取用户详情
   */
  getUserById: (id: number) => {
    return unifiedApi.get(`/users/${id}`)
  },

  /**
   * 获取用户档案（按用户名）
   */
  getUserProfile: (username: string) => {
    return unifiedApi.get('/users/profile', { params: { username } })
  },

  /**
   * 获取操作员列表（销售员）
   */
  getOperators: (filters: { store_id?: number } = {}) => {
    return unifiedApi.get('/users/operators', { params: filters })
  },

  /**
   * 创建用户
   */
  createUser: (data: Partial<User> & { password: string }) => {
    return unifiedApi.post('/users', data)
  },

  /**
   * 更新用户
   */
  updateUser: (id: number, data: Partial<User>) => {
    return unifiedApi.put(`/users/${id}`, data)
  },

  /**
   * 删除用户
   */
  deleteUser: (id: number) => {
    return unifiedApi.delete(`/users/${id}`)
  },

  /**
   * 切换用户状态
   */
  toggleUserStatus: (id: number) => {
    return unifiedApi.patch(`/users/${id}/toggle`)
  }
}
