/**
 * 全局认证状态管理
 * 提供用户认证、权限管理、会话控制等功能
 */

import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { unifiedApi as api } from '@/utils/unified-api'
import { extractResponseData, getRequestErrorCode, getRequestErrorStatus } from '@/utils/api-response'
import { clearPersistedAuthData, setBackendDisconnectedState } from '@/utils/auth-session'
import { storage } from '@/services/storage'
import { AUTH_STORAGE_KEYS, SESSION_STORAGE_KEYS } from '@/constants/storage'
import { isPublicSitePath } from '@/constants/routePermissions'
import { PermissionMapper, PermissionUtils } from '@/utils/permissionMapper'
import type { User, LoginCredentials } from '@/types'
import { showElementWarning } from '@/utils/element-feedback'

const PERMISSIONS_ADMIN_REQUIREMENTS = [
  'permissions:view',
  'permissions:create',
  'permissions:edit',
  'permissions:delete'
]

type PersistedAuthState = {
  token?: string
  refreshToken?: string
  user?: User | null
  permissions?: unknown
  roles?: unknown
  lastActivity?: number
}

type UnknownRecord = Record<string, unknown>

interface AuthUserApiPayload extends Omit<User, 'role' | 'roles'> {
  role?: unknown
  roles?: unknown
  access_profile?: unknown
}

const asRecord = (value: unknown): UnknownRecord | null => (
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as UnknownRecord
    : null
)

const stringArray = (value: unknown): string[] => (
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.length > 0)
    : []
)

export const useAuthStore = defineStore('auth', () => {
  // =========== 状态 ===========
  const token = ref<string>('')
  const refreshToken = ref<string>('')
  const user = ref<User | null>(null)
  const permissions = ref<string[]>([])
  const permissionVisibility = ref<Record<string, boolean>>({}) // 新增：权限可见性映射
  const roles = ref<string[]>([])
  const isLoading = ref(false)
  const exitLock = ref(false)
  const lastActivity = ref<number>(Date.now())
  const sessionTimeout = ref<number>(30 * 60 * 1000) // 30分钟
  const loginAttempts = ref(0)
  const isLocked = ref(false)
  const lockReason = ref<string>('')
  const isAuthenticating = ref(false)  // 认证状态：是否正在认证中
  const authVerified = ref(false)
  const backendDisconnected = ref(false) // 新增：后端失联状态
  const backendHealthFailureCount = ref(0)
  let fetchUserInfoPromise: Promise<void> | null = null
  let authRestorePromise: Promise<void> | null = null
  let logoutInProgress = false
  let sessionGeneration = 0

  // =========== 计算属性 ===========
  const isAuthenticated = computed(() => {
    // 如果后端失联，立即认为未认证
    if (backendDisconnected.value) {
      return false
    }

    // 认证状态必须同时拥有有效令牌和用户资料。
    // 仅凭令牌进入业务页面会让权限和菜单在恢复期间处于不确定状态。
    const hasToken = !!token.value && token.value.length > 10
    return hasToken && !!user.value
  })

  const isAuthReady = computed(() => isAuthenticated.value && authVerified.value && !isAuthenticating.value)

  const userRoles = computed<string[]>(() => {
    const roleSource = user.value?.roles ?? roles.value
    if (!roleSource) return []
    return Array.isArray(roleSource) ? roleSource : [roleSource]
  })

  const getRoleTokens = (role: unknown): string[] => {
    if (!role) return []

    if (typeof role === 'string') {
      return role
        .split(',')
        .map((token) => token.trim())
        .filter(Boolean)
    }

    const roleRecord = asRecord(role)
    if (!roleRecord) return []

    return [
      roleRecord.roleName,
      roleRecord.name,
      roleRecord.role_name,
      roleRecord.roleCode,
      roleRecord.code,
      roleRecord.role_code
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

  const userPermissions = computed<string[]>(() => permissions.value)

  const isAdmin = computed(() => {
    if (!isAuthReady.value || !isActive.value) return false
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
    const status: unknown = user.value?.status
    
    // 数据库中status可能是1（数字）或'active'（字符串）
    const statusCheck = status === 'active' || status === 1
    return statusCheck && !isLocked.value
  })

  const sessionExpired = computed(() => {
    return Date.now() - lastActivity.value > sessionTimeout.value
  })

  const canAutoRefresh = computed(() => {
    return !!token.value && sessionExpired.value && !isLoading.value
  })

  // =========== 权限检查方法 ===========
  const hasPermission = (permission: string | string[], module?: string): boolean => {
    // 特殊处理：如果后端失联，拒绝所有权限检查
    // 这样可以确保断网后所有功能都被禁用
    if (backendDisconnected.value) {
      // 显示友好提示（仅显示一次）
      if (!storage.has(AUTH_STORAGE_KEYS.DISCONNECT_NOTIFIED, 'session')) {
        showElementWarning({
          message: '网络连接已断开，部分功能不可用',
          duration: 3000,
          showClose: true
        })
        storage.set(AUTH_STORAGE_KEYS.DISCONNECT_NOTIFIED, 'true', 'session')
      }

      return false
    }

    if (!isAuthReady.value) {
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

    if (normalizedUserPermissions.includes('*')) {
      return true
    }

    // 检查每个权限
    return permissions.every(perm => {
      if (!perm) return false

      return PermissionUtils.hasPermission(normalizedUserPermissions, perm, module)
    })
  }

  const hasRole = (role: string | string[]): boolean => {
    if (!isAuthReady.value || !isActive.value) return false

    const roles = Array.isArray(role) ? role : [role]
    const userRoleTokens = getNormalizedRoleTokens()

    return roles.some(roleName => userRoleTokens.includes(roleName))
  }

  const hasAnyRole = (roles: string[]): boolean => {
    if (!isAuthReady.value || !isActive.value) return false
    const userRoleTokens = getNormalizedRoleTokens()
    return roles.some(role => userRoleTokens.includes(role))
  }

  const hasAnyPermission = (requiredPermissions: string[]): boolean => (
    requiredPermissions.some(permission => hasPermission(permission))
  )

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
    } catch {
      return false
    }
  }

  // 新增：获取角色权限可见性配置
  const fetchRolePermissionVisibility = async (roleId: number): Promise<Record<string, boolean> | null> => {
    try {
      const response = await api.get<{ visibility?: Record<string, boolean> }>(`/permissions/visibility/${roleId}`)

      if (response?.success && response.data) {
        return response.data.visibility || {}
      }
      return null
    } catch {
      return null
    }
  }

  const normalizeRolesPayload = (rawRoles: unknown): string[] => {
    const roleValues = Array.isArray(rawRoles) ? rawRoles : rawRoles ? [rawRoles] : []
    return Array.from(new Set(roleValues.flatMap((role) => getRoleTokens(role))))
  }

  const normalizePermissionsPayload = (rawPermissions: unknown): string[] => {
    if (Array.isArray(rawPermissions)) {
      return stringArray(rawPermissions)
    }

    const permissionRecord = asRecord(rawPermissions)
    if (permissionRecord) {
      const flattenedPermissions = stringArray(permissionRecord.userPermissions)
      if (Array.isArray(permissionRecord.userPermissions)) {
        return flattenedPermissions
      }

      const summary = asRecord(permissionRecord.summary)
      const permissionSource = summary || permissionRecord

      const flatPermissions: string[] = []
      Object.entries(permissionSource).forEach(([moduleKey, modulePerms]) => {
        const modulePermissionRecord = asRecord(modulePerms)
        const actions = modulePermissionRecord
          ? stringArray(modulePermissionRecord.permissions)
          : stringArray(modulePerms)

        actions.forEach((permission) => {
          flatPermissions.push(`${moduleKey}:${permission}`)
        })
      })

      return Array.from(new Set(flatPermissions))
    }

    return []
  }

  const extractAuthPayload = (response: unknown) => {
    const responseRecord = asRecord(response) || {}
    const payload = asRecord(responseRecord.data) || responseRecord
    const userRecord = asRecord(payload.user) || asRecord(responseRecord.user)
    const normalizedRoles = normalizeRolesPayload(
      userRecord?.roles || payload.roles || userRecord?.role || null
    )
    const primaryRole = normalizedRoles[0] || null
    const accessProfile = payload.accessProfile || userRecord?.access_profile || null
    const normalizedPermissions = normalizePermissionsPayload(
      accessProfile || payload.permissions || userRecord?.permissions || []
    )
    const tokenValue = payload.token || payload.accessToken || responseRecord.token || responseRecord.accessToken
    const refreshTokenValue = payload.refreshToken || responseRecord.refreshToken
    const status = userRecord?.status === 'active' || userRecord?.status === 1 ? 'active' : 'inactive'
    const userData = userRecord && Number.isSafeInteger(Number(userRecord.id)) && Number(userRecord.id) > 0
      ? {
        ...userRecord,
        role: typeof userRecord.role === 'string' ? userRecord.role : primaryRole,
        roles: normalizedRoles,
        status
      } as User
      : null

    return {
      userData,
      token: typeof tokenValue === 'string' ? tokenValue : '',
      refreshToken: typeof refreshTokenValue === 'string' ? refreshTokenValue : '',
      permissions: normalizedPermissions,
      roles: normalizedRoles
    }
  }

  // =========== 认证方法 ===========
  const login = async (credentials: LoginCredentials): Promise<void> => {
    if (logoutInProgress) throw new Error('正在退出登录，请稍后重试')
    const generation = sessionGeneration
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

      if (generation !== sessionGeneration || logoutInProgress) throw new Error('本次登录已取消')
      if (response?.success) {
        const {
          userData,
          token: finalToken,
          permissions: userPermissions,
          roles: userRoles
        } = extractAuthPayload(response)

        if (!userData || !finalToken) {
          throw new Error('登录响应数据不完整')
        }

        // 清理旧版本遗留的 access_token，避免它覆盖本次登录生成的新令牌。
        storage.remove('access_token', 'session')

        // 设置认证信息
        token.value = finalToken
        // 刷新令牌由后端 HttpOnly Cookie 管理，不进入前端存储。
        refreshToken.value = ''
        user.value = { ...userData, roles: userRoles }
        authVerified.value = true
        permissions.value = userPermissions || []
        roles.value = userRoles || []
        lastActivity.value = Date.now()
        loginAttempts.value = 0
        isLocked.value = false
        lockReason.value = ''

        // 持久化存储（只执行一次）
        persistAuthData()

        // 每次重新登录都允许重新提示未处理的审批事项；同一次登录内仍由
        // PendingApprovals 使用该标记避免轮询重复弹窗。
        storage.remove(SESSION_STORAGE_KEYS.PENDING_APPROVAL_NOTIFIED, 'session')

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

    } catch (error: unknown) {
      const status = getRequestErrorStatus(error)

      // 只有真实凭证失败才更新前端计数；服务不可用不能导致本地锁定。
      if (status === 401) {
        loginAttempts.value++

        if (loginAttempts.value >= 5) {
          lockAccount('登录失败次数过多，请稍后再试')
        }
      }

      throw error

    } finally {
      isLoading.value = false
    }
  }

  const logout = async (reason: string = '用户主动退出'): Promise<void> => {
    if (reason === '用户主动退出' && exitLock.value) return
    if (logoutInProgress) return
    logoutInProgress = true
    sessionGeneration++
    authVerified.value = false
    stopSessionMonitor()
    try {
      const result = await api.post('/auth/logout', undefined, { showLoading: false, showError: false })
      if (!result?.success) throw new Error('服务器注销未确认')
    } catch {
      showElementWarning('本地已退出，服务器注销未确认，请恢复网络后重新登录并退出')
    } finally {
      clearAuth()
      logoutInProgress = false
    }

    // 触发退出事件
    window.dispatchEvent(new CustomEvent('tf2025:auth:logout', {
      detail: { reason }
    }))

    // 跳转到登录页（使用 window.location 避免在 store 中使用 useRouter）
    window.location.href = '/login'
  }

  const refreshAuth = async (): Promise<boolean> => {
    if (!canAutoRefresh.value || logoutInProgress) return false
    const generation = sessionGeneration

    try {
      isLoading.value = true
      authVerified.value = false
      permissions.value = []
      permissionVisibility.value = {}

      const response = await api.post('/auth/refresh', undefined, {
        showLoading: false,
        showError: false
      })

      if (generation !== sessionGeneration || logoutInProgress) return false
      if (response?.success) {
        const {
          userData,
          token: accessToken,
          permissions: userPermissions,
          roles: userRoles
        } = extractAuthPayload(response)

        if (!userData || !accessToken) {
          clearAuth()
          return false
        }

        // 更新认证信息
        token.value = accessToken
        refreshToken.value = ''
        user.value = userData
        authVerified.value = true
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

    } catch {
      // 旧会话的失败响应不能清除后续登录的身份。
      if (generation !== sessionGeneration || logoutInProgress) return false
      clearAuth()
      return false

    } finally {
      isLoading.value = false
    }

    clearAuth()
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

    } catch (error: unknown) {
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

    } catch (error: unknown) {
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
      const userWithRole = user.value ? {
        ...user.value,
        role: user.value.role || firstRole,
        roles: roles.value.length > 0 ? roles.value : (user.value.roles || [])
      } : null

      const authData: PersistedAuthState = {
        token: token.value,
        user: userWithRole,
        permissions: permissions.value,
        roles: roles.value,
        lastActivity: lastActivity.value
      }

      storage.setAuth(authData)

      // 保存到 sessionStorage
      try {
        storage.setToken(token.value)
      } catch {
        // sessionStorage 保存失败，忽略
      }

    } catch {
      // 持久化认证数据失败，忽略
    }
  }

  const restorePersistedAuthData = async (): Promise<void> => {
    isAuthenticating.value = true
    authVerified.value = false
    permissions.value = []
    permissionVisibility.value = {}
    try {
      const savedAuth = storage.getAuth<PersistedAuthState>()
      const savedToken = storage.getToken() || savedAuth?.token
      if (!savedToken || savedToken.length <= 10) {
        clearAuth(false)
        return
      }
      token.value = savedToken
      refreshToken.value = ''
      // 缓存仅恢复登录上下文，权限和角色必须由服务端重新确认。
      user.value = savedAuth?.user ?? null
      roles.value = []
      lastActivity.value = savedAuth?.lastActivity || Date.now()
      storage.setToken(savedToken)
      await fetchUserInfo()
      if (isAuthReady.value) startSessionMonitor()
    } catch {
      permissions.value = []
      roles.value = []
      authVerified.value = false
    } finally {
      isAuthenticating.value = false
    }
  }

  // 所有入口共享同一次恢复任务，避免 App、路由守卫和布局组件并发读取认证状态。
  const loadPersistedAuthData = async (): Promise<void> => {
    if (authRestorePromise) {
      return authRestorePromise
    }

    authRestorePromise = restorePersistedAuthData()
    try {
      await authRestorePromise
    } finally {
      authRestorePromise = null
    }
  }

  const clearAuth = (notifyOtherWindows: boolean = true): void => {
    sessionGeneration++
    const preserveDisconnectState = backendDisconnected.value

    authVerified.value = false
    token.value = ''
    refreshToken.value = ''
    user.value = null
    permissions.value = []
    roles.value = []
    isLocked.value = false
    lockReason.value = ''

    // 退出当前登录会话后，下一位用户或下一次登录应重新接收审批提醒。
    storage.remove(SESSION_STORAGE_KEYS.PENDING_APPROVAL_NOTIFIED, 'session')

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
    } catch {
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
      const status = getRequestErrorStatus(error)
      const code = getRequestErrorCode(error)
      if (!status || code === 'ERR_NETWORK' || code === 'ECONNREFUSED') {
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
    permissions.value = []

    // 重新获取用户信息和权限
    await fetchUserInfo()

  }

  const fetchUserInfo = async (): Promise<void> => {
    if (fetchUserInfoPromise) return fetchUserInfoPromise
    const requestToken = token.value
    const generation = sessionGeneration
    isAuthenticating.value = true
    authVerified.value = false
    permissions.value = []
    permissionVisibility.value = {}
    fetchUserInfoPromise = (async () => {
      try {
        if (!requestToken || requestToken.length <= 10) return
        const userResponse = await api.get<AuthUserApiPayload>('/auth/user', {
          showLoading: false, showError: false, useCache: false
        })
        if (token.value !== requestToken || generation !== sessionGeneration || logoutInProgress) return
        const permissionPayload = asRecord(userResponse.data?.access_profile)
        if (
          !userResponse?.success ||
          !userResponse.data?.id ||
          !permissionPayload ||
          !Array.isArray(permissionPayload.userPermissions) ||
          !Array.isArray(permissionPayload.roles)
        ) {
          throw new Error('身份或权限核验失败')
        }
        const finalRoles = normalizeRolesPayload(userResponse.data.roles ?? permissionPayload.roles)
        roles.value = finalRoles
        user.value = {
          ...userResponse.data,
          roles: finalRoles,
          role: typeof userResponse.data.role === 'string' ? userResponse.data.role : finalRoles[0] ?? null,
          status: userResponse.data.status ?? 'inactive'
        }
        permissions.value = normalizePermissionsPayload(permissionPayload)
        const visibility = asRecord(permissionPayload.permissionVisibility)
        permissionVisibility.value = visibility ? Object.fromEntries(
          Object.entries(visibility).filter((entry): entry is [string, boolean] => typeof entry[1] === 'boolean')
        ) : {}
        authVerified.value = true
        persistAuthData()
      } catch (error: unknown) {
        if (token.value !== requestToken || generation !== sessionGeneration || logoutInProgress) return
        permissions.value = []
        roles.value = []
        permissionVisibility.value = {}
        authVerified.value = false
        const code = getRequestErrorCode(error)
        if (getRequestErrorStatus(error) === 401 || code === 'TOKEN_EXPIRED' || code === 'TOKEN_REVOKED') {
          clearAuth()
          return
        }
        throw error
      }
    })().finally(() => {
      isAuthenticating.value = false
      fetchUserInfoPromise = null
    })
    return fetchUserInfoPromise
  }

  // =========== 监听器 ===========
  // 监听其他窗口的登录/登出事件（多窗口同步）
  if (typeof window !== 'undefined') {
    window.addEventListener('storage', (e) => {
      // 监听退出登录事件
      if (e.key === 'tf2025_logout_event' && e.newValue) {
        // 清除本地状态
        authVerified.value = false
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
        storage.remove(AUTH_STORAGE_KEYS.LOGOUT_EVENT, 'local')

        // 停止会话监控
        stopSessionMonitor()

        // 如果当前在需要认证的页面，跳转到登录页
        if (!isPublicSitePath(window.location.pathname)) {
          window.location.href = '/login'
        }
      }
    })
  }

  // 监听用户活动
  if (typeof window !== 'undefined') {
    const activityEvents = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart']
    let lastMouseMoveActivity = 0

    const handleActivity = (event: Event) => {
      // 鼠标移动事件频率很高；限制认证状态更新，避免触发权限指令的重复计算。
      // 点击、键盘、滚动和触摸仍然每次即时刷新活动时间。
      if (event.type === 'mousemove') {
        const now = Date.now()
        if (now - lastMouseMoveActivity < 1000) return
        lastMouseMoveActivity = now
      }

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
    const savedAuth = storage.getAuth<PersistedAuthState>()

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

    // 2. 恢复用户展示上下文，服务端核验前不授权。
    if (savedAuth) {
      try {
        const authData = savedAuth
        if (authData.user) {
          user.value = {
            ...authData.user,
            status: authData.user.status ?? 'inactive'
          }
          // 缓存权限不参与授权，等待统一恢复流程核验。
          roles.value = normalizeRolesPayload(authData.roles || authData.user.roles)
        }
      } catch {
        // 解析保存的认证数据失败，忽略
      }
    }
  }

  // 初始缓存不构成已核验身份。
  authVerified.value = false

  // 监听权限数据变化，自动持久化
  watch(
    () => [token.value, user.value, permissions.value, roles.value, isLocked.value],
    () => {
      if (isAuthenticated.value && user.value) {
        persistAuthData()
      }
    },
    { deep: true, immediate: false }
  )

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
    exitLock,
    isAuthenticating,
    lastActivity,
    sessionTimeout,
    loginAttempts,
    isLocked,
    lockReason,

    // 计算属性
    isAuthenticated,
    isAuthReady,
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
})
