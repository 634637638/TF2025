/**
 * 动态权限服务
 * 提供权限数据的实时获取、缓存和同步功能
 */

import { ref, computed, watch } from 'vue'
import { unifiedApi as api } from '@/utils/unified-api'
import { useAuthStore } from '@/stores/auth'
import { PermissionMapper, PermissionUtils } from '@/utils/permissionMapper'
import permissionEventBus from '@/events/permissionEvents'
import { storage } from '@/services/storage'
import { AUTH_STORAGE_KEYS, CACHE_STORAGE_KEYS } from '@/constants/storage'
import { logger } from '@/utils/logger'

// 权限数据缓存 - 登录时获取，权限变更时强制更新
const permissionCache = ref({
  data: null as any,
  lastUpdated: 0,
  ttl: 2 * 60 * 1000, // 2分钟缓存，更频繁检查权限变更
  forceRefresh: false, // 强制刷新标记
  lastPermissionChange: 0, // 最后权限变更时间
  isLoading: false
})

// 实时权限监听器
const permissionListeners = new Set<() => void>()

/**
 * 动态权限服务
 */
export class DynamicPermissionService {
  private cacheKey = CACHE_STORAGE_KEYS.PERMISSIONS_CACHE
  private authStoreUnsubscribe: (() => void) | null = null
  // 初始化状态标志，防止重复初始化
  private isInitializing = false
  // 防止频繁调用的最后调用时间
  private lastCallTime = 0

  constructor() {
    // 延迟初始化，避免在组件外部使用 Pinia
    this.initAuthWatcher()
  }

  /**
   * 初始化认证状态监听
   */
  private initAuthWatcher(): void {
    try {
      const authStore = useAuthStore()
      this.authStoreUnsubscribe = watch(() => authStore.isAuthenticated, (newValue) => {
        if (!newValue) {
          this.clearCache()
        }
      })
    } catch (error) {
      // 如果 Pinia 还未初始化，等待后续手动调用
      logger.warn('认证状态监听初始化失败，将延迟初始化:', error)
    }
  }

  /**
   * 手动初始化认证监听（用于延迟初始化）
   */
  ensureAuthWatcher(): void {
    if (!this.authStoreUnsubscribe) {
      this.initAuthWatcher()
    }
  }

  /**
   * 获取用户完整权限数据
   * 登录时获取一次，页面刷新时更新
   */
  async getUserPermissions(forceRefresh = false): Promise<any> {
    // 防止无限循环调用
    if (permissionCache.value.isLoading) {
      return permissionCache.value.data || null
    }

    // 防止过于频繁的调用（至少间隔500ms）
    const currentTime = Date.now()
    if (currentTime - this.lastCallTime < 500 && !forceRefresh) {
      return permissionCache.value.data || null
    }
    this.lastCallTime = currentTime

    const cached = this.getCachedData()

    // 页面首次加载时强制刷新（从localStorage检查是否为新的页面会话）
    const isNewSession = !storage.has(AUTH_STORAGE_KEYS.PERMISSIONS_LOADED, 'session')
    if (isNewSession) {
      storage.set(AUTH_STORAGE_KEYS.PERMISSIONS_LOADED, 'true', 'session')
      forceRefresh = true
    }

    // 检查是否有权限变更标记
    const hasPermissionChange = permissionCache.value.forceRefresh ||
      (permissionCache.value.lastPermissionChange > cached?.lastUpdated)

    // 如果有权限变更标记，强制刷新
    if (hasPermissionChange) {
      forceRefresh = true
      permissionCache.value.forceRefresh = false
    }

    // 如果缓存有效且不强制刷新，返回缓存数据
    if (!forceRefresh && cached && (currentTime - cached.lastUpdated < permissionCache.value.ttl)) {
      return cached.data
    }

    try {
      permissionCache.value.isLoading = true

      const response = await api.get('/permissions/user-permissions', {
        showLoading: false,
        showError: false
      })

      if (response?.success) {
        const rawData = response.data || {}
        const summary = rawData.summary && typeof rawData.summary === 'object'
          ? rawData.summary
          : rawData
        const userPermissions = Array.isArray(rawData.userPermissions)
          ? rawData.userPermissions
          : Object.entries(summary).flatMap(([moduleKey, actions]) =>
              Array.isArray(actions)
                ? actions.map(action => `${moduleKey}:${action}`)
                : []
            )
        const data = {
          ...rawData,
          summary,
          userPermissions,
          rolePermissions: rawData.rolePermissions || {},
          roles: rawData.roles || []
        }

        // 更新缓存
        this.setCacheData(data)

        // 更新本地存储
        storage.set(this.cacheKey, {
          data,
          lastUpdated: currentTime
        }, 'local')

        // 通知所有监听器
        this.notifyListeners()

        return data
      } else {
        throw new Error(response?.message || '获取权限数据失败')
      }

    } catch (error: any) {
      // 如果网络请求失败，尝试返回过期的缓存数据
      if (cached) {
        return cached.data
      }

      throw error
    } finally {
      permissionCache.value.isLoading = false
    }
  }

  /**
   * 检查单个权限
   */
  async checkPermission(permission: string, forceRefresh = false): Promise<boolean> {
    const authStore = useAuthStore()

    try {
      if (forceRefresh) {
        await this.getUserPermissions(true)
      }
      return authStore.hasPermission(permission)
    } catch (error: any) {
      logger.error(`检查权限 ${permission} 失败:`, error)

      // 降级到缓存数据检查
      const permissions = await this.getUserPermissions(forceRefresh)
      return permissions.userPermissions?.includes(permission) || false
    }
  }

  /**
   * 批量检查权限
   */
  async batchCheckPermissions(permissions: string[], forceRefresh = false): Promise<Record<string, boolean>> {
    const authStore = useAuthStore()

    try {
      if (forceRefresh) {
        await this.getUserPermissions(true)
      }
      return permissions.reduce<Record<string, boolean>>((results, permission) => {
        results[permission] = authStore.hasPermission(permission)
        return results
      }, {})
    } catch (error: any) {
      logger.error('批量检查权限失败:', error)

      // 降级到缓存数据检查
      const permissionsData = await this.getUserPermissions(forceRefresh)
      const userPerms = permissionsData.userPermissions || []
      const results: Record<string, boolean> = {}

      permissions.forEach(permission => {
        results[permission] = userPerms.includes(permission)
      })

      return results
    }

    return {}
  }

  /**
   * 获取模块权限
   */
  async getModulePermissions(module: string, forceRefresh = false): Promise<any> {
    const authStore = useAuthStore()

    try {
      const permissionsData = await this.getUserPermissions(forceRefresh)
      const summary = permissionsData?.summary || {}
      const knownActions = ['view', 'create', 'edit', 'delete', 'export', 'import', 'approve', 'manage', 'sell', 'menu_view']
      const permissions = Array.isArray(summary[module])
        ? summary[module]
        : knownActions.filter(action => authStore.hasPermission(`${module}:${action}`))
      return {
        module,
        permissions,
        permissionStrings: permissions.map((action: string) => `${module}:${action}`)
      }
    } catch (error: any) {
      logger.error(`获取模块 ${module} 权限失败:`, error)

      // 降级到缓存数据检查
      const permissions = await this.getUserPermissions(forceRefresh)
      return {
        module,
        permissions: permissions.summary?.[module] || [],
        permissionStrings: permissions.userPermissions?.filter((p: string) => p.startsWith(`${module}:`)) || []
      }
    }
  }

  /**
   * 添加权限变化监听器
   */
  addListener(callback: () => void): () => void {
    permissionListeners.add(callback)
    return () => permissionListeners.delete(callback)
  }

  /**
   * 移除所有监听器
   */
  removeAllListeners(): void {
    permissionListeners.clear()
  }

  /**
   * 强制刷新权限数据
   */
  async refreshPermissions(): Promise<void> {
    await this.getUserPermissions(true)
  }

  /**
   * 清空缓存
   */
  clearCache(): void {
    permissionCache.value = {
      data: null,
      lastUpdated: 0,
      ttl: permissionCache.value.ttl,
      forceRefresh: false,
      lastPermissionChange: 0,
      isLoading: false
    }
    storage.remove(this.cacheKey, 'local')
    storage.remove(AUTH_STORAGE_KEYS.PERMISSIONS_LOADED, 'session')
  }

  /**
   * 强制刷新所有权限缓存
   */
  async forceRefreshAll(): Promise<void> {
    // 1. 设置强制刷新标记
    permissionCache.value.forceRefresh = true
    permissionCache.value.lastPermissionChange = Date.now()

    // 2. 触发全局权限变更事件
    permissionEventBus.emitForceRefresh('permission_service')

    // 3. 清除所有本地缓存
    this.clearCache()

    // 4. 通知所有监听器
    this.notifyListeners()

    // 5. 立即获取新的权限数据
    await this.getUserPermissions(true)
  }

  /**
   * 获取缓存数据
   */
  private getCachedData(): any {
    // 内存缓存优先
    if (permissionCache.value.data && (Date.now() - permissionCache.value.lastUpdated < permissionCache.value.ttl)) {
      return permissionCache.value
    }

    // 尝试从localStorage读取
    try {
      const cached = storage.get<{ data: any; lastUpdated: number }>(this.cacheKey, 'local')
      if (cached && cached.data) {
        permissionCache.value = {
          ...permissionCache.value,
          data: cached.data,
          lastUpdated: cached.lastUpdated
        }
        return permissionCache.value
      }
    } catch (error) {
      logger.warn('读取权限缓存失败:', error)
    }

    return null
  }

  /**
   * 设置缓存数据
   */
  private setCacheData(data: any): void {
    permissionCache.value = {
      data,
      lastUpdated: Date.now(),
      ttl: permissionCache.value.ttl,
      forceRefresh: false,
      lastPermissionChange: permissionCache.value.lastPermissionChange,
      isLoading: false
    }
  }

  /**
   * 通知所有监听器 - 启用实时权限更新
   */
  private notifyListeners(): void {
    permissionListeners.forEach(callback => {
      try {
        callback()
      } catch (error) {
        // 权限监听器执行失败，忽略
      }
    })
  }

  /**
   * 应用启动时初始化权限数据
   */
  async initializePermissions(): Promise<boolean> {
    // 防止重复初始化
    if (this.isInitializing) {
      return false
    }

    try {
      this.isInitializing = true
      const authStore = useAuthStore()
      if (!authStore.isAuthenticated) {
        return false
      }

      // 确保权限监听器已初始化
      this.ensureAuthWatcher()

      // 强制刷新权限数据，确保最新
      await this.getUserPermissions(true)

      return true
    } catch (error) {
      return false
    } finally {
      this.isInitializing = false
    }
  }

  /**
   * 获取权限状态
   */
  get permissionStatus() {
    return {
      isLoading: permissionCache.value.isLoading,
      lastUpdated: permissionCache.value.lastUpdated,
      hasData: !!permissionCache.value.data,
      isExpired: Date.now() - permissionCache.value.lastUpdated > permissionCache.value.ttl
    }
  }
}

// 延迟初始化的全局实例
let dynamicPermissionServiceInstance: DynamicPermissionService | null = null

export const dynamicPermissionService = (): DynamicPermissionService => {
  if (!dynamicPermissionServiceInstance) {
    dynamicPermissionServiceInstance = new DynamicPermissionService()
  }
  return dynamicPermissionServiceInstance
}

/**
 * 权限组合式函数
 */
export function useDynamicPermissions() {
  const authStore = useAuthStore()

  // 确保认证监听已初始化 - 使用延迟初始化的服务实例
  dynamicPermissionService().ensureAuthWatcher()

  // 权限数据 - 使用 authStore 的权限数据
  const permissions = computed(() => authStore.userPermissions || [])
  const rolePermissions = computed(() => permissionCache.value.data?.rolePermissions || {})
  const permissionSummary = computed(() => permissionCache.value.data?.summary || {})
  const userRoles = computed(() => permissionCache.value.data?.roles || [])

  // 权限状态
  const isLoading = computed(() => permissionCache.value.isLoading)
  const lastUpdated = computed(() => permissionCache.value.lastUpdated)

  /**
   * 检查权限 - 同步版本（基于当前缓存数据）
   */
  const hasPermission = (permission: string, currentModule?: string): boolean => {
    if (!authStore.isAuthenticated) return false

    // 使用权限工具进行标准化检查
    return PermissionUtils.hasPermission(permissions.value, permission, currentModule)
  }

  /**
   * 异步权限检查 - 强制刷新最新数据
   */
  const hasPermissionAsync = async (permission: string, forceRefresh = false): Promise<boolean> => {
    if (!authStore.isAuthenticated) return false

    // 如果数据较新，先使用缓存快速检查
    if (!forceRefresh && !dynamicPermissionService().permissionStatus.isExpired) {
      return permissions.value.includes(permission)
    }

    // 需要刷新或首次加载
    try {
      return await dynamicPermissionService().checkPermission(permission, forceRefresh)
    } catch (error) {
      logger.error('权限检查失败:', error)
      return permissions.value.includes(permission)
    }
  }

  /**
   * 批量检查权限 - 同步版本（基于当前缓存数据）
   */
  const hasPermissions = (permissionList: string[], currentModule?: string, requireAll: boolean = false): Record<string, boolean> => {
    if (!authStore.isAuthenticated) {
      return permissionList.reduce((acc, perm) => ({ ...acc, [perm]: false }), {})
    }

    // 使用权限工具进行批量检查
    return PermissionUtils.hasPermissions(permissions.value, permissionList, currentModule, requireAll)
  }

  
  /**
   * 获取模块权限 - 同步版本（基于当前缓存数据）
   */
  const getModulePermissions = (module: string): string[] => {
    if (!authStore.isAuthenticated) return []

    // 使用当前的权限缓存数据进行检查
    return permissionSummary.value[module] || []
  }

  /**
   * 刷新权限数据
   */
  const refreshPermissions = async (): Promise<void> => {
    await dynamicPermissionService().refreshPermissions()
  }

  /**
   * 权限变化监听
   */
  const onPermissionChange = (callback: () => void) => {
    return dynamicPermissionService().addListener(callback)
  }

  return {
    // 数据
    permissions,
    rolePermissions,
    permissionSummary,
    userRoles,

    // 状态
    isLoading,
    lastUpdated,

    // 方法
    hasPermission,
    hasPermissions,
    hasPermissionAsync,
    getModulePermissions,
    refreshPermissions,
    onPermissionChange,

    // 服务实例
    service: dynamicPermissionService
  }
}
