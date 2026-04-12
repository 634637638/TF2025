/**
 * H5用户认证API
 * 功能：用户注册、登录、获取用户信息、订单查询、登出
 */

import publicApi from './shop-public'
import { storage } from '@/services/storage'
import { H5_STORAGE_KEYS } from '@/constants/storage'

const unwrapData = <T>(response: any): T => {
  if (response && typeof response === 'object' && 'data' in response) {
    return response.data as T
  }
  return response as T
}

export interface AuthUser {
  id: number
  name: string
  phone: string
  avatar?: string
  member_number?: string
}

export interface AuthResponse {
  token: string
  user: AuthUser
}

export interface LoginParams {
  phone: string
  password: string
}

export interface RegisterParams {
  name: string
  phone: string
  password: string
}

/**
 * 用户注册
 * POST /api/public/auth/register
 */
export function register(data: RegisterParams) {
  return publicApi.post<AuthResponse>('/public/auth/register', data, { showError: false })
    .then((response) => unwrapData<AuthResponse>(response))
}

/**
 * 用户登录
 * POST /api/public/auth/login
 */
export function login(data: LoginParams) {
  return publicApi.post<AuthResponse>('/public/auth/login', data, { showError: false })
    .then((response) => unwrapData<AuthResponse>(response))
}

/**
 * 获取当前用户信息
 * GET /api/public/auth/me
 */
export function getCurrentUser() {
  return publicApi.get<AuthUser>('/public/auth/me').then((response) => unwrapData<AuthUser>(response))
}

/**
 * 获取用户订单列表
 * GET /api/public/auth/orders
 */
export function getUserOrders() {
  return publicApi.get('/public/auth/orders').then((response) => unwrapData(response))
}

/**
 * 获取用户销售记录
 * GET /api/public/auth/sales
 */
export function getUserSales() {
  return publicApi.get('/public/auth/sales').then((response) => unwrapData(response))
}

/**
 * 获取当前 H5 用户完整资料
 * GET /api/public/auth/profile
 * 注意：此函数无参数，用于获取当前登录用户
 * 与 user.ts 中的 getUserProfile(username) 区分（后台管理，按用户名查询）
 */
export function getUserProfile() {
  return publicApi.get<any>('/public/auth/profile').then((response) => unwrapData<any>(response))
}

/**
 * 用户登出
 * POST /api/public/auth/logout
 */
export function logout() {
  return publicApi.post('/public/auth/logout', undefined, { showError: false }).then((response) => unwrapData(response))
}

/**
 * 更新用户资料
 * PUT /api/public/auth/profile
 */
export interface UpdateProfileParams {
  name?: string
  gender?: string
  idCard?: string
  appleId?: string
  address?: string
}

export function updateProfile(data: UpdateProfileParams) {
  return publicApi.put<AuthUser>('/public/auth/profile', data).then((response) => unwrapData<AuthUser>(response))
}

/**
 * Token管理工具
 */
export const tokenManager = {
  // 保存token
  setToken(token: string) {
    storage.setH5AuthToken(token)
  },

  // 获取token
  getToken(): string | null {
    return storage.getH5AuthToken()
  },

  // 移除token
  removeToken() {
    storage.remove(H5_STORAGE_KEYS.AUTH_TOKEN, 'local')
  },

  // 检查是否已登录
  isAuthenticated(): boolean {
    return !!this.getToken()
  }
}

/**
 * 用户信息管理工具
 */
export const userManager = {
  // 保存用户信息
  setUser(user: AuthUser) {
    storage.set(H5_STORAGE_KEYS.AUTH_USER, user, 'local')
  },

  // 获取用户信息
  getUser(): AuthUser | null {
    return storage.get<AuthUser>(H5_STORAGE_KEYS.AUTH_USER, 'local')
  },

  // 移除用户信息
  removeUser() {
    storage.remove(H5_STORAGE_KEYS.AUTH_USER, 'local')
  },

  // 清除所有认证信息
  clearAuth() {
    tokenManager.removeToken()
    this.removeUser()
  }
}
