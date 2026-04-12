/**
 * 认证 Composable
 * 提供用户认证状态和登录信息
 */

import { computed } from 'vue'
import { useAuthStore } from '@/stores/auth'

export function useAuth() {
  const authStore = useAuthStore()

  // 是否已登录
  const isLoggedIn = computed(() => authStore.isAuthenticated)

  // 当前用户信息
  const user = computed(() => authStore.user)

  // 用户ID
  const userId = computed(() => authStore.user?.id)

  // 用户名
  const username = computed(() => authStore.user?.username)

  // 用户角色
  const roles = computed(() => authStore.userRoles)

  // 用户权限
  const permissions = computed(() => authStore.userPermissions)

  // 登录方法
  const login = async (credentials: any) => {
    return await authStore.login(credentials)
  }

  // 登出方法
  const logout = async () => {
    return await authStore.logout()
  }

  return {
    isLoggedIn,
    user,
    userId,
    username,
    roles,
    permissions,
    login,
    logout,
    isAuthenticated: authStore.isAuthenticated,
    token: authStore.token
  }
}
