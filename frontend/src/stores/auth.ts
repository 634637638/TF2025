/**
 * 全局认证状态管理
 * 提供用户认证、权限管理、会话控制等功能
 */

import { defineStore } from 'pinia'
import { ref, computed, watch, nextTick } from 'vue'
import { unifiedApi as api } from '@/utils/unified-api'
import { extractResponseData } from '@/utils/api-response'
import { clearPersistedAuthData, setBackendDisconnectedState } from '@/utils/auth-session'
import { storage } from '@/services/storage'
import { AUTH_STORAGE_KEYS } from '@/constants/storage'
import { PermissionMapper, PermissionUtils } from '@/utils/permissionMapper'
import type { User, LoginCredentials } from '@/types'
import { logger } from '@/utils/logger'

const PERMISSIONS_ADMIN_REQUIREMENTS = [
  'permissions:view',
  'permissions:create',
  'permissions:edit',
  'permissions:delete'
]

type PersistedAuthState = {
  token: string
  refreshToken: string
  user: User | null
  permissions: string[] | Record<string, any> | null
  roles: any[]
  lastActivity: number
}

export const useAuthStore = defineStore('auth', () => {
  // =========== 状态 ===========
  const token = ref<string>('')
  const refreshToken = ref<string>('')
  const user = ref<User | null>(null)
  const permissions = ref<string[] | Record<string, any> | null>(null)
  const permissionVisibility = ref<Record<string, boolean>>({}) // 新增：权限可见性映射
  const roles = ref<any[]>([])
  const isLoading = ref(false)
  const lastActivity = ref<number>(Date.now())
  const sessionTimeout = ref<number>(30 * 60 * 1000) // 30分钟
  const loginAttempts = ref(0)
  const isLocked = ref(false)
  const lockReason = ref<string>('')
  const isAuthenticating = ref(false)  // 认证状态：是否正在认证中
  const backendDisconnected = ref(false) // 新增：后端失联状态
  const backendHealthFailureCount = ref(0)
  let fetchUserInfoPromise: Promise<void> | null = null

  // =========== 计算属性 ===========
  const isAuthenticated = computed(() => {
    // 如果后端失联，立即认为未认证
    if (backendDisconnected.value) {
      return false
    }

    // 更宽松的认证检查：只要有token就认为是已认证状态
    // 用户信息可能在异步加载中，但这不影响已认证的状态
    const hasToken = !!token.value && token.value.length > 10
    return hasToken
  })

  const userRoles = computed<any[]>(() => {
    const roleSource = user.value?.roles ?? roles.value
    if (!roleSource) return []
    return Array.isArray(roleSource) ? roleSource : [roleSource]
  })

  const getRoleTokens = (role: any): string[] => {
    if (!role) return []

    if (typeof role === 'string') {
      return role
        .split(',')
        .map((token) => token.trim())
        .filter(Boolean)
    }

    return [
      role?.roleName,
      role?.name,
      role?.role_name,
      role?.roleCode,
      role?.code,
      role?.role_code
    ]
      .flatMap((token) => typeof token === 'string'
        ? token.split(',').map((item) => item.trim())
        : [])
      .filter((token): token is string => typeof token === 'string' && token.length > 0)
  }

  const getNormalizedRoleTokens = (): string[] => {
    const roleTokens = userRoles.value.flatMap((role) => getRoleTokens(role))
    return Array.from(new Set(roleTokens))
  }

  
  const userRole = computed(() => {
    const normalizedRoles = getNormalizedRoleTokens()
    return normalizedRoles[0] || undefined
  })

  const userPermissions = computed(() => {
    // ⚠️ 容错处理：确保始终返回数组
    try {
      // 1. 如果 permissions 为空或 null，返回空数组
      if (!permissions.value) {
        return []
      }

      // 2. 如果本身就是数组格式，直接使用（最常见的情况）
      if (Array.isArray(permissions.value)) {
        return permissions.value
      }

      // 3. 如果是对象格式，尝试提取权限
      if (typeof permissions.value === 'object') {
        const permissionPayload = permissions.value as Record<string, any>

        // 3.1 检查是否包含新的扁平化权限字段
        if (permissionPayload.userPermissions && Array.isArray(permissionPayload.userPermissions)) {
          return permissionPayload.userPermissions
        }

        // 3.2 处理对象格式的权限数据（兼容性处理）
        const permissionList: string[] = []

        // 遍历权限对象，提取所有模块的权限
        Object.entries(permissions.value).forEach(([moduleKey, modulePerms]) => {
          if (modulePerms && typeof modulePerms === 'object' && modulePerms.permissions && Array.isArray(modulePerms.permissions)) {
            // 处理实际的权限格式：{sales_salesview: {permissions: ["view", "create", "edit", "delete"]}}
            modulePerms.permissions.forEach((permission: string) => {
              const fullPermission = `${moduleKey}:${permission}`
              permissionList.push(fullPermission)
            })
          } else if (modulePerms && Array.isArray(modulePerms)) {
            // 处理数组格式：{sales_salesview: ["view", "create", "edit", "delete"]}
            modulePerms.forEach((permission: string) => {
              const fullPermission = `${moduleKey}:${permission}`
              permissionList.push(fullPermission)
            })
          }
        })

        if (permissionList.length > 0) {
          return permissionList
        }
      }

      // 4. 如果是字符串，尝试解析为 JSON
      if (typeof permissions.value === 'string') {
        try {
          const parsed = JSON.parse(permissions.value)
          if (Array.isArray(parsed)) {
            return parsed
          }
        } catch (e) {
          // 解析失败，忽略
        }
      }

      return []
    } catch (error) {
      return []
    }
  })

  const isAdmin = computed(() => {
    const perms = userPermissions.value
    if (!Array.isArray(perms) || perms.length === 0) return false

    const normalizedPermissions = perms
      .filter(permission => typeof permission === 'string' && permission)
      .map(permission => PermissionMapper.normalizePermission(permission))
      .filter(Boolean)

    return normalizedPermissions.includes('permissions:admin') ||
      PERMISSIONS_ADMIN_REQUIREMENTS.every(permission => normalizedPermissions.includes(permission))
  })

  const isActive = computed(() => {
    const status = user.value?.status as any
    
    // 数据库中status可能是1（数字）或'active'（字符串）
    const statusCheck = status === 'active' || status === 1
    return statusCheck && !isLocked.value
  })

  const sessionExpired = computed(() => {
    return Date.now() - lastActivity.value > sessionTimeout.value
  })

  const canAutoRefresh = computed(() => {
    return !!refreshToken.value && sessionExpired.value && !isLoading.value
  })

  // =========== 权限检查方法 ===========
  const hasPermission = (permission: string | string[], module?: string): boolean => {
    // 特殊处理：如果后端失联，拒绝所有权限检查
    // 这样可以确保断网后所有功能都被禁用
    if (backendDisconnected.value) {
      // 显示友好提示（仅显示一次）
      if (!storage.has(AUTH_STORAGE_KEYS.DISCONNECT_NOTIFIED, 'session')) {
        import('element-plus').then(({ ElMessage }) => {
          ElMessage.warning({
            message: '网络连接已断开，部分功能不可用',
            duration: 3000,
            showClose: true
          })
        })
        storage.set(AUTH_STORAGE_KEYS.DISCONNECT_NOTIFIED, 'true', 'session')
      }

      return false
    }

    if (!isAuthenticated.value) {
      return false
    }

    if (!isActive.value) {
      return false
    }

    // 获取用户权限列表
    const userPerms = userPermissions.value

    // ⚠️ 容错检查：确保 userPerms 是数组
    if (!Array.isArray(userPerms)) {
      return false
    }

    // 处理权限数组
    const permissions = Array.isArray(permission) ? permission : [permission]
    const normalizedUserPermissions = userPerms
      .filter(perm => typeof perm === 'string' && perm)
      .map(perm => PermissionMapper.normalizePermission(perm))
      .filter(Boolean)

    // 检查每个权限
    return permissions.every(perm => {
      if (!perm) return false

      return PermissionUtils.hasPermission(normalizedUserPermissions, perm, module)
    })
  }

  const hasRole = (role: string | string[]): boolean => {
    if (!isAuthenticated.value || !isActive.value) return false

    const roles = Array.isArray(role) ? role : [role]
    const userRoleTokens = getNormalizedRoleTokens()

    return roles.some(roleName => userRoleTokens.includes(roleName))
  }

  const hasAnyRole = (roles: string[]): boolean => {
    if (!isAuthenticated.value || !isActive.value) return false
    const userRoleTokens = getNormalizedRoleTokens()
    return roles.some(role => userRoleTokens.includes(role))
  }

  const hasAnyPermission = (permissions: string[]): boolean => {
    if (!isAuthenticated.value || !isActive.value) return false

    const userPerms = userPermissions.value
      .filter(p => p != null) // 过滤掉null/undefined
      .map(p => typeof p === 'string' ? PermissionMapper.normalizePermission(p) : PermissionMapper.normalizePermission(p.name || p.code))
      .filter(p => p != null) // 再次过滤确保没有空值

    return permissions.some(perm => {
      if (!perm) return false // 检查权限参数是否有效

      if (perm.includes('*')) {
        const pattern = perm.replace(/\*/g, '.*')
        return userPerms.some(userPerm => {
          if (!userPerm) return false
          return new RegExp(pattern).test(userPerm)
        })
      }
      return PermissionUtils.hasPermission(userPerms as string[], perm)
    })
  }

  // 新增：检查权限是否可见（支持可见性控制）
  const isPermissionVisible = (permission: string): boolean => {
    // 如果没有可见性数据，默认为可见
    if (!permissionVisibility.value || typeof permissionVisibility.value !== 'object') {
      return true
    }

    // 检查权限是否在可见性映射中
    const isVisible = permissionVisibility.value[permission]

    // 如果没有设置可见性，默认为可见
    return isVisible !== undefined ? isVisible : true
  }

  // 新增：更新权限可见性
  const updatePermissionVisibility = async (roleId: number, moduleKey: string, permissionType: string, visible: boolean): Promise<boolean> => {
    try {
      const response = await api.put('/permissions/toggle-visibility', {
        roleId,
        moduleKey,
        permissionType,
        visible
      })

      if (response?.success) {
        // 更新本地可见性缓存
        const permissionKey = `${moduleKey}:${permissionType}`
        permissionVisibility.value[permissionKey] = visible

        return true
      } else {
        return false
      }
    } catch (error) {
      return false
    }
  }

  // 新增：获取角色权限可见性配置
  const fetchRolePermissionVisibility = async (roleId: number): Promise<Record<string, boolean> | null> => {
    try {
      const response = await api.get(`/permissions/visibility/${roleId}`)

      if (response?.success && response.data) {
        return response.data.visibility || {}
      }
      return null
    } catch (error) {
      return null
    }
  }

  const normalizeRolesPayload = (rawRoles: any): any[] => {
    if (Array.isArray(rawRoles)) {
      return rawRoles.filter(Boolean)
    }

    return rawRoles ? [rawRoles] : []
  }

  const normalizePermissionsPayload = (rawPermissions: any): string[] | Record<string, any> => {
    if (rawPermissions && typeof rawPermissions === 'object') {
      if (Array.isArray(rawPermissions.userPermissions)) {
        return rawPermissions
      }

      if (Array.isArray(rawPermissions)) {
        return rawPermissions
      }

      const flatPermissions: string[] = []
      Object.entries(rawPermissions).forEach(([moduleKey, modulePerms]) => {
        const modulePermissionValue = modulePerms as any

        if (
          modulePermissionValue &&
          typeof modulePermissionValue === 'object' &&
          Array.isArray(modulePermissionValue.permissions)
        ) {
          modulePermissionValue.permissions.forEach((permission: string) => {
            flatPermissions.push(`${moduleKey}:${permission}`)
          })
        } else if (Array.isArray(modulePerms)) {
          modulePerms.forEach((permission: string) => {
            flatPermissions.push(`${moduleKey}:${permission}`)
          })
        }
      })

      return flatPermissions
    }

    return []
  }

  const extractAuthPayload = (response: any) => {
    const payload = response?.data && typeof response.data === 'object' ? response.data : response
    const userData = payload?.user || response?.user || null
    const normalizedRoles = normalizeRolesPayload(
      userData?.roles || payload?.roles || userData?.role || null
    )
    const primaryRole = (() => {
      const firstRole = normalizedRoles[0]
      if (!firstRole) return null
      return typeof firstRole === 'string'
        ? firstRole
        : (firstRole?.name || firstRole?.code || null)
    })()
    const accessProfile = payload?.accessProfile || userData?.access_profile || null
    const normalizedPermissions = normalizePermissionsPayload(
      accessProfile || payload?.permissions || userData?.permissions || []
    )

    return {
      userData: userData ? {
        ...userData,
        role: userData?.role || primaryRole,
        roles: normalizedRoles,
        status: userData?.status || 'active'
      } : null,
      token: payload?.token || payload?.accessToken || response?.token || response?.accessToken || '',
      refreshToken: payload?.refreshToken || response?.refreshToken || '',
      permissions: normalizedPermissions,
      roles: normalizedRoles
    }
  }

  // =========== 认证方法 ===========
  const login = async (credentials: LoginCredentials): Promise<void> => {
    try {
      // 🔧 登录前清除后端失联状态，允许重新登录
      if (backendDisconnected.value) {
        backendDisconnected.value = false
        setBackendDisconnectedState(false)
      }

      isLoading.value = true

      const response = await api.post('/auth/login', credentials, {
        showLoading: false,
        showError: false
      })

      if (response?.success) {
        const {
          userData,
          token: finalToken,
          refreshToken: refreshTkn,
          permissions: userPermissions,
          roles: userRoles
        } = extractAuthPayload(response)

        // 设置认证信息
        token.value = finalToken
        refreshToken.value = refreshTkn || ''
        user.value = {
          ...userData,
          roles: userRoles,
          status: userData?.status || 'active'
        }
        permissions.value = userPermissions || []
        roles.value = userRoles || []
        lastActivity.value = Date.now()
        loginAttempts.value = 0
        isLocked.value = false
        lockReason.value = ''

        // 验证必要数据
        if (!userData || !finalToken) {
          throw new Error('登录响应数据不完整')
        }

        // 持久化存储（只执行一次）
        persistAuthData()

        // 清除后端失联状态（登录成功说明后端已恢复）
        setBackendDisconnected(false)

        // 启动会话监控
        startSessionMonitor()

        // 触发登录成功事件
        window.dispatchEvent(new CustomEvent('tf2025:auth:login', {
          detail: { user: userData }
        }))

      } else {
        throw new Error(response?.message || '登录失败')
      }

    } catch (error: any) {
      loginAttempts.value++

      // 检查是否需要锁定账户
      if (loginAttempts.value >= 5) {
        lockAccount('登录失败次数过多，请稍后再试')
      }

      throw error

    } finally {
      isLoading.value = false
    }
  }

  const logout = async (reason: string = '用户主动退出'): Promise<void> => {
    // 直接清除本地认证信息，不调用服务器logout API
    // 避免TOKEN_REVOKED等错误提示
    clearAuth()

    // 触发退出事件
    window.dispatchEvent(new CustomEvent('tf2025:auth:logout', {
      detail: { reason }
    }))

    // 跳转到登录页（使用 window.location 避免在 store 中使用 useRouter）
    await nextTick()
    window.location.href = '/login'
  }

  const refreshAuth = async (): Promise<boolean> => {
    if (!refreshToken.value || !canAutoRefresh.value) return false

    try {
      isLoading.value = true

      const response = await api.post('/auth/refresh', {
        refreshToken: refreshToken.value
      }, {
        showLoading: false,
        showError: false
      })

      if (response?.success) {
        const {
          userData,
          token: accessToken,
          refreshToken: nextRefreshToken,
          permissions: userPermissions,
          roles: userRoles
        } = extractAuthPayload(response)

        if (!userData || !accessToken) {
          return false
        }

        // 更新认证信息
        token.value = accessToken
        refreshToken.value = nextRefreshToken || refreshToken.value
        user.value = userData
        permissions.value = userPermissions || []
        roles.value = userRoles || []
        lastActivity.value = Date.now()

        // 持久化存储
        persistAuthData()

        // 触发令牌刷新事件
        window.dispatchEvent(new CustomEvent('tf2025:auth:refresh', {
          detail: { user: userData }
        }))

        return true
      }

    } catch (error) {
      // 刷新失败，清除认证信息
      clearAuth()
      return false

    } finally {
      isLoading.value = false
    }

    return false
  }

  const updateProfile = async (profileData: Partial<User>): Promise<void> => {
    if (!user.value) return

    try {
      isLoading.value = true

      const response = await api.put('/auth/profile', profileData)

      if (response.success) {
        // 更新用户信息
        user.value = { ...user.value, ...extractResponseData<Partial<User>>(response) }

        // 持久化存储
        persistAuthData()

        // 触发信息更新事件
        window.dispatchEvent(new CustomEvent('tf2025:auth:profile-update', {
          detail: { user: user.value }
        }))

      } else {
        throw new Error(response.data?.message || '更新失败')
      }

    } catch (error: any) {
      throw error

    } finally {
      isLoading.value = false
    }
  }

  const changePassword = async (oldPassword: string, newPassword: string): Promise<void> => {
    try {
      isLoading.value = true

      const response = await api.post('/auth/change-password', {
        oldPassword,
        newPassword
      })

      if (response.data?.success) {
        // 密码修改后需要重新登录
        setTimeout(() => {
          logout('密码已修改')
        }, 2000)

      } else {
        throw new Error(response.data?.message || '密码修改失败')
      }

    } catch (error: any) {
      throw error

    } finally {
      isLoading.value = false
    }
  }

  // =========== 锁定方法 ===========
  const lockAccount = (reason: string): void => {
    isLocked.value = true
    lockReason.value = reason

    // 触发账户锁定事件
    window.dispatchEvent(new CustomEvent('tf2025:auth:lock', {
      detail: { reason }
    }))
  }

  const unlockAccount = (): void => {
    isLocked.value = false
    lockReason.value = ''
    loginAttempts.value = 0

    // 触发账户解锁事件
    window.dispatchEvent(new CustomEvent('tf2025:auth:unlock', {
      detail: {}
    }))
  }

  // =========== 工具方法 ===========
  const updateActivity = (): void => {
    lastActivity.value = Date.now()
  }

  const persistAuthData = (): void => {
    try {
      // 如果没有 token，跳过保存
      if (!token.value || token.value.length < 10) {
        return
      }

      // 确保用户对象有正确的role字段
      const firstRole = roles.value.length > 0 ? roles.value[0] : null
      const normalizedRole = typeof firstRole === 'string'
        ? firstRole
        : (firstRole?.name || firstRole?.code || null)
      const userWithRole = user.value ? {
        ...user.value,
        role: user.value.role || normalizedRole,
        roles: roles.value.length > 0 ? roles.value : (user.value.roles || [])
      } : null

      const authData: PersistedAuthState = {
        token: token.value,
        refreshToken: refreshToken.value,
        user: userWithRole,
        permissions: permissions.value,
        roles: roles.value,
        lastActivity: lastActivity.value
      }

      storage.setAuth(authData)

      // 保存到 sessionStorage
      try {
        storage.setToken(token.value)
      } catch (sessionError) {
        // sessionStorage 保存失败，忽略
      }

    } catch (error) {
      // 持久化认证数据失败，忽略
    }
  }

  const loadPersistedAuthData = async (): Promise<void> => {
    try {
      // 防止重复加载
      if (isAuthenticating.value && token.value) {
        return
      }

      isAuthenticating.value = true

      // 增加延迟确保 sessionStorage 已准备就绪（解决页面刷新时序问题）
      await new Promise(resolve => setTimeout(resolve, 100))

      // 优先检查sessionStorage，这是最可靠的token来源
      const sessionToken = storage.getToken()
      const savedAuth = storage.getAuth()

      // 关键修复：如果有 sessionToken，立即设置到 store
      // 这确保在异步操作期间，token 已经可用
      if (sessionToken && sessionToken.length > 10 && !token.value) {
        token.value = sessionToken
        // 不要在这里设置 isAuthenticating = false，因为还需要继续加载用户数据
      }

      // 如果没有任何认证数据，直接返回
      if (!sessionToken && !savedAuth) {
        isAuthenticating.value = false
        return
      }

      // 如果有sessionToken，直接使用
      if (sessionToken && sessionToken.length > 10) {
        token.value = sessionToken

        // 尝试从localStorage恢复权限数据（如果存在）
        if (savedAuth) {
          try {
            const authData: PersistedAuthState = savedAuth as any
            refreshToken.value = authData.refreshToken || ''
            if (authData.user && authData.permissions && authData.permissions.length > 0) {
              // 同步恢复权限数据
              user.value = {
                ...authData.user,
                status: authData.user.status || 'active', // 确保status字段存在
              }
              permissions.value = authData.permissions
              roles.value = authData.roles || []

              
              // 异步刷新权限数据（不阻塞）
              fetchUserInfo().then(() => {
                if (user.value) {
                  persistAuthData()
                }
              }).catch((_error) => {
                // 不清除已恢复的权限数据
              })

              startSessionMonitor()
              isAuthenticating.value = false
              return // 直接返回，使用恢复的权限数据
            }
          } catch (e) {
            storage.remove(AUTH_STORAGE_KEYS.AUTH, 'local')
          }
        }

        // 如果没有保存的权限数据或解析失败，异步获取
        fetchUserInfo().then(() => {
          if (user.value) {
            persistAuthData()
          }
        }).catch((_error) => {
          // 用户信息获取失败，忽略
        }).finally(() => {
          isAuthenticating.value = false
        })

        startSessionMonitor()
        isAuthenticating.value = false
        return
      }

      // 如果没有sessionToken但有localStorage数据
      if (savedAuth) {
        try {
          const authData: PersistedAuthState = savedAuth as any

          if (authData.token && authData.token.length > 10) {
            token.value = authData.token
            refreshToken.value = authData.refreshToken || ''

            // 恢复用户数据并确保有正确的role字段
            if (authData.user) {
              // 优先使用保存的角色数据
              const savedRoles = authData.roles || (authData.user.roles || []);
              const savedRole = authData.user.role || (savedRoles.length > 0 ? savedRoles[0] : null);
              
              const restoredUser = {
                ...authData.user,
                role: savedRole,
                roles: savedRoles
              }
              
              user.value = restoredUser
              roles.value = savedRoles // 确保store中的roles也被正确设置
            } else {
              user.value = null
              roles.value = []
            }

            permissions.value = authData.permissions || []
            roles.value = authData.roles || (user.value?.roles || [])
            lastActivity.value = authData.lastActivity || Date.now()

            // 同步到sessionStorage
            storage.setToken(token.value)

            // 修复：只有当真正缺少关键数据时才调用fetchUserInfo
            // 避免不必要的API调用覆盖正确的角色数据
            const hasValidUserData = user.value && (
              (user.value.role && user.value.role !== '未知角色' && user.value.role !== null) ||
              (roles.value && roles.value.length > 0)
            )

            if (!hasValidUserData) {
              fetchUserInfo().then(() => {
                if (user.value) {
                  persistAuthData()
                }
              }).catch((_error) => {
                // 用户信息刷新失败，忽略
              })
            } else {
              // 额外的安全检查：确保user对象有role字段
              if (user.value && !user.value.role && roles.value.length > 0) {
                user.value.role = roles.value[0]
                persistAuthData()
              }
            }

            startSessionMonitor()
            isAuthenticating.value = false
            return
          }
        } catch (error) {
          // 解析localStorage失败，忽略
        }
      }

      // 不通知其他窗口，避免影响已登录的窗口
      clearAuth(false)

    } catch (error) {
      // 加载持久化认证数据失败，不通知其他窗口
      clearAuth(false)
    } finally {
      isAuthenticating.value = false
    }
  }

  const clearAuth = (notifyOtherWindows: boolean = true): void => {
    const preserveDisconnectState = backendDisconnected.value

    token.value = ''
    refreshToken.value = ''
    user.value = null
    permissions.value = []
    roles.value = []
    isLocked.value = false
    lockReason.value = ''

    if (!preserveDisconnectState) {
      backendDisconnected.value = false
      setBackendDisconnectedState(false)
    }

    clearPersistedAuthData({
      notifyOtherWindows,
      clearDisconnectState: !preserveDisconnectState
    })

    // 停止会话监控
    stopSessionMonitor()
  }

  /**
   * 设置后端失联状态
   */
  const setBackendDisconnected = (disconnected: boolean): void => {
    backendDisconnected.value = disconnected

    try {
      setBackendDisconnectedState(disconnected)
    } catch (error) {
      // 保存后端失联状态失败，忽略
    }
  }

  // =========== 会话监控 ===========
  let sessionMonitorInterval: number | null = null
  let healthCheckInterval: number | null = null

  /**
   * 检查后端健康状态
   */
  const checkBackendHealth = async (silent: boolean = false): Promise<boolean> => {
    try {
      // 使用轻量级的健康检查接口
      const response = await api.get('/health', {
        showLoading: false,
        showError: false,
        timeout: 5000 // 5秒超时
      })

      const isHealthy = !!response?.success

      if (isHealthy) {
        backendHealthFailureCount.value = 0
      }

      if (!silent && isHealthy && backendDisconnected.value) {
        setBackendDisconnected(false)
      }

      return isHealthy
    } catch (error) {
      // 网络错误，标记后端失联
      if (!error.response || error.code === 'ERR_NETWORK' || error.code === 'ECONNREFUSED') {
        backendHealthFailureCount.value += 1

        if (!backendDisconnected.value && backendHealthFailureCount.value >= 2) {
          setBackendDisconnected(true)
        }
      }

      return false
    }
  }

  const startSessionMonitor = (): void => {
    stopSessionMonitor()

    sessionMonitorInterval = window.setInterval(() => {
      if (sessionExpired.value && !isLoading.value) {
        // 会话过期，尝试刷新
        refreshAuth()
      }
    }, 60000) // 每分钟检查一次

    // 启动健康检查（每2分钟检查一次）
    if (!healthCheckInterval) {
      healthCheckInterval = window.setInterval(async () => {
        // 只有在已认证状态下才进行健康检查
        if (isAuthenticated.value) {
          await checkBackendHealth(true) // 静默检查
        }
      }, 120000) // 2分钟检查一次
    }
  }

  const stopSessionMonitor = (): void => {
    if (sessionMonitorInterval) {
      clearInterval(sessionMonitorInterval)
      sessionMonitorInterval = null
    }

    if (healthCheckInterval) {
      clearInterval(healthCheckInterval)
      healthCheckInterval = null
    }
  }

  // 强制刷新权限数据
  const forceRefreshPermissions = async (): Promise<void> => {
    // 清除权限缓存
    permissions.value = null

    // 重新获取用户信息和权限
    await fetchUserInfo()

    }

  const fetchUserInfo = async (): Promise<void> => {
    if (fetchUserInfoPromise) {
      return fetchUserInfoPromise
    }

    fetchUserInfoPromise = (async () => {
    try {
      // 检查是否有有效token
      if (!token.value || token.value.length < 10) {
        return
      }

      // 1. 先获取用户基本信息
      const userResponse = await api.get('/auth/user', {
        showLoading: false,
        showError: false
      })

      // 2. 获取权限数据
      const permissionsResponse = await api.get('/permissions/user-permissions', {
        showLoading: false,
        showError: false
      })

      if (userResponse?.success) {
        // 获取API返回的角色数据
        const apiRoles = userResponse.data?.roles || []
        const permissionRoles = Array.isArray(permissionsResponse?.data?.roles)
          ? permissionsResponse.data.roles
              .map((role: any) => role?.roleName || role?.name || role)
              .filter(Boolean)
          : []

        // 保存当前的角色数据（从localStorage恢复的）- 这是最重要的
        const currentRoles = roles.value || []
        const currentUserRole = user.value?.role

        // 修复：优先保留已有角色数据，避免被API空数据覆盖
        let finalRoles = currentRoles
        let finalUserRole = currentUserRole

        // 只有当API确实返回了有效的角色数据时，才使用API数据
        if (apiRoles.length > 0 && apiRoles[0] && apiRoles[0] !== '未知角色') {
          // API返回了有效的角色数据，使用API数据
          finalRoles = apiRoles
          finalUserRole = userResponse.data?.role || apiRoles[0]
        } else if (permissionRoles.length > 0) {
          finalRoles = permissionRoles
          finalUserRole = permissionRoles[0]
        } else {
          // API没有返回角色数据或返回了无效数据，完全保留现有的角色数据

          // 确保使用所有可能的角色数据源
          const userObjectRoles = user.value?.roles || []
          const storeRoles = roles.value || []

          // 优先级：currentRoles > userObjectRoles > storeRoles
          finalRoles = currentRoles.length > 0 ? currentRoles :
                     (userObjectRoles.length > 0 ? userObjectRoles : storeRoles)

          finalUserRole = currentUserRole || (finalRoles.length > 0 ? finalRoles[0] : null)
        }

        // 更新store中的角色数据
        roles.value = finalRoles

        // 更新用户基本信息，确保不丢失角色数据和状态
        user.value = {
          ...userResponse.data,
          roles: finalRoles,
          role: finalUserRole, // 确保role字段正确
          status: userResponse.data?.status || user.value?.status || 'active' // 确保status字段存在
        }

        // 强制确保user对象有role字段
        if (!user.value.role && finalRoles.length > 0) {
          user.value.role = finalRoles[0]
        }

        // 使用最终的角色数据
        const rolesData = user.value.roles || []

        // 确保roles.value与user.value.roles同步
        if (rolesData.length > 0 && roles.value.length === 0) {
          roles.value = rolesData
        }

        // 处理权限数据
        if (permissionsResponse?.success) {
          // 优先使用新的userPermissions字段（扁平化权限数组）
          if (permissionsResponse.data?.userPermissions && Array.isArray(permissionsResponse.data.userPermissions)) {
            permissions.value = permissionsResponse.data
          } else {
          // 兼容性处理：将对象格式的权限转换为数组格式
          const permissionArray = []
          // 权限数据直接在 data 中，不是 data.permissions
          const permissionsByModule = permissionsResponse.data || {}

          Object.entries(permissionsByModule).forEach(([moduleKey, moduleData]) => {
            if (Array.isArray(moduleData)) {
              // 权限数据是数组格式，如 ["create", "delete", "edit", "menu_view", "view"]
              moduleData.forEach((permission) => {
                const fullPermission = `${moduleKey}:${permission}`
                permissionArray.push(fullPermission)
              })
            }
          })

          permissions.value = permissionArray
          }
        }

        // 处理权限可见性数据
        if (permissionsResponse.data?.permissionVisibility && typeof permissionsResponse.data.permissionVisibility === 'object') {
          permissionVisibility.value = permissionsResponse.data.permissionVisibility
        } else {
          permissionVisibility.value = {}
        }

        // 更新持久化数据
        persistAuthData()
      }
    } catch (error) {
      // 检查是否是token过期错误
      if (error.response?.data?.code === 'TOKEN_EXPIRED' || error.response?.data?.code === 'TOKEN_REVOKED') {
        clearAuth()
        return
      }

      // 如果token验证失败，尝试从localStorage恢复用户信息
      if (error.response?.status === 401) {
        try {
          const savedAuth = storage.getAuth()
          if (savedAuth) {
            const authData: PersistedAuthState = savedAuth as any
            if (authData.user) {
              user.value = authData.user
              roles.value = authData.roles || []
              permissions.value = authData.permissions || []
              return
            }
          }
        } catch (recoverError) {
          // 恢复失败，忽略
        }
        // 如果恢复失败，抛出错误让上层处理
        throw new Error('Token验证失败且无法恢复')
      } else {
        // 其他错误也抛出，让调用方决定如何处理
        throw error
      }
    }
    })().finally(() => {
      fetchUserInfoPromise = null
    })

    return fetchUserInfoPromise
  }

  // =========== 监听器 ===========
  // 监听认证状态变化
  watch([token, user, isLocked], () => {
    persistAuthData()
  })

  // 监听其他窗口的登录/登出事件（多窗口同步）
  if (typeof window !== 'undefined') {
    window.addEventListener('storage', (e) => {
      // 监听退出登录事件
      if (e.key === 'tf2025_logout_event' && e.newValue) {
        // 清除本地状态
        token.value = ''
        refreshToken.value = ''
        user.value = null
        permissions.value = []
        roles.value = []
        isLocked.value = false
        lockReason.value = ''

        storage.remove(AUTH_STORAGE_KEYS.TOKEN, 'session')
        storage.remove(AUTH_STORAGE_KEYS.AUTH, 'session')
        storage.remove(AUTH_STORAGE_KEYS.BACKEND_DISCONNECTED, 'session')
        storage.remove(AUTH_STORAGE_KEYS.BACKEND_DISCONNECT_TIME, 'session')

        // 清除退出标志
        storage.remove(AUTH_STORAGE_KEYS.LOGOUT_EVENT, 'session')

        // 停止会话监控
        stopSessionMonitor()

        // 如果当前在需要认证的页面，跳转到登录页
        const currentPath = window.location.pathname
        const isPublicRoute = ['/login', '/404', '/forgot-password', '/register', '/price-query', '/sales-price-display', '/m'].some(path => currentPath.startsWith(path))

        if (!isPublicRoute) {
          window.location.href = '/login'
        }
      }
    })
  }

  // 监听用户活动
  if (typeof window !== 'undefined') {
    const activityEvents = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart']

    const handleActivity = () => {
      updateActivity()
    }

    activityEvents.forEach(event => {
      window.addEventListener(event, handleActivity, { passive: true })
    })
  }

  // =========== 初始化 ===========
  // 🔒 认证数据仅存 sessionStorage，关闭浏览器后自动清除
  if (typeof window !== 'undefined' && window.sessionStorage) {
    const immediateToken = storage.getToken()
    const savedAuth = storage.getAuth()

    // 📡 检查后端失联状态（从 sessionStorage）
    const backendDisconnectedStr = storage.get<string>(AUTH_STORAGE_KEYS.BACKEND_DISCONNECTED, 'session')
    const backendDisconnectTime = storage.get<string>(AUTH_STORAGE_KEYS.BACKEND_DISCONNECT_TIME, 'session')

    if (backendDisconnectedStr === 'true' && backendDisconnectTime) {
      backendDisconnected.value = true
    }

    // 1. 立即恢复 token（最重要，防止被重定向到登录页）
    if (immediateToken && immediateToken.length > 10) {
      token.value = immediateToken
    }

    // 2. 立即恢复用户数据和权限（防止权限检查失败）
    if (savedAuth) {
      try {
        const authData: PersistedAuthState = savedAuth as any
        if (authData.user) {
          user.value = {
            ...authData.user,
            status: authData.user.status || 'active'
          }
          permissions.value = authData.permissions || []
          roles.value = authData.roles || (authData.user.roles || [])
        }
      } catch (e) {
        // 解析保存的认证数据失败，忽略
      }
    }
  }

  // 确保 isAuthenticating 初始化为 false
  isAuthenticating.value = false

  // 检查当前路由是否为公开路由（不需要认证）
  // 公开路由列表：price-query, sales-price-display, login, 404, H5商城(m) 等
  const isPublicRoute = () => {
    if (typeof window === 'undefined') return false
    const path = window.location.pathname
    const publicRoutes = ['/price-query', '/sales-price-display', '/login', '/404', '/forgot-password', '/register', '/m']
    return publicRoutes.some(route => path.startsWith(route))
  }

  // 只有在非公开路由时才自动加载认证数据
  // 这样可以防止公开页面（如 price-query）触发认证逻辑，影响其他已登录窗口
  if (!isPublicRoute()) {
    // 异步刷新最新的认证数据（不阻塞初始化）
    loadPersistedAuthData().catch((_error) => {
      // 异步刷新认证数据失败，忽略
    })
  }

  // 开发环境：仅在确实没有认证数据时才重新初始化
  // 注意：页面刷新时token和user可能暂时为空，这是正常的
  // if (import.meta.env.DEV && (!token.value || !user.value)) {
  //   console.log('🔧 开发环境：检测到认证状态缺失，强制重新初始化')
  //   // 清除可能的旧数据
  //   clearAuth()
  //   // 延迟重新加载，确保清除操作完成
  //   setTimeout(async () => {
  //     try {
  //       await loadPersistedAuthData()
  //     } catch (error) {
  //       console.error('开发环境重新初始化认证数据失败:', error)
  //     }
  //   }, 100)
  // }

  // =========== 返回状态和方法 ===========
  return {
    // 状态
    token,
    refreshToken,
    user,
    permissions,
    permissionVisibility,
    roles,
    isLoading,
    lastActivity,
    sessionTimeout,
    loginAttempts,
    isLocked,
    lockReason,

    // 计算属性
    isAuthenticated,
    userRole,
    userRoles,
    userPermissions,
    isAdmin,
    isActive,
    sessionExpired,
    canAutoRefresh,

    // 权限检查方法
    hasPermission,
    hasRole,
    hasAnyRole,
    hasAnyPermission,
    isPermissionVisible,
    updatePermissionVisibility,
    fetchRolePermissionVisibility,

    // 认证方法
    login,
    logout,
    refreshAuth,
    updateProfile,
    changePassword,

    // 锁定方法
    lockAccount,
    unlockAccount,

    // 工具方法
    updateActivity,
    clearAuth,
    persistAuthData,
    loadPersistedAuthData,
    fetchUserInfo,
    forceRefreshPermissions,
    setBackendDisconnected,
    checkBackendHealth
  }

  // 监听权限数据变化，自动持久化
  watch(
    () => [user.value, permissions.value, roles.value],
    () => {
      if (isAuthenticated.value && user.value) {
        persistAuthData()
      }
    },
    { deep: true, immediate: false }
  )
})
