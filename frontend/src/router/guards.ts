import type { RouteLocationNormalized, Router } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useAppStore } from '@/stores/app'
import { useLoadingStore } from '@/stores/loading'
import { unifiedApi as api } from '@/utils/unified-api'
import { showElementNotification, showElementWarning } from '@/utils/element-feedback'
import { canAccessRoutePath, getRoutePermissions } from '@/constants/routePermissions'
import { clearPersistedAuthData, getBackendDisconnectInfo, setBackendDisconnectedState } from '@/utils/auth-session'
import { TimeUtil } from '@/utils/time'
import { storage } from '@/services/storage'
import { AUTH_STORAGE_KEYS, CACHE_STORAGE_KEYS, ROUTER_STORAGE_KEYS } from '@/constants/storage'

// 跳转冷却配置
const REDIRECT_COOLDOWN_TIME = 3000 // 3秒内不重复跳转
const ROLE_STATUS_CACHE_TIME = 5 * 60 * 1000
const ROLE_STATUS_TIMEOUT = 5000
const DEV_TOKEN_BYPASS_FLAG = 'true'
let lastRoleStatusCheckAt = 0
let roleStatusCheckPromise: Promise<void> | null = null

type AuthStore = ReturnType<typeof useAuthStore>
type AppStore = ReturnType<typeof useAppStore>

interface PageVisitData {
  path: string
  title?: string
  from: string
  timestamp: number
  userAgent: string
}

function normalizeStoredStrings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.length > 0)
    : []
}

function normalizeStoredPermissions(value: unknown): string[] {
  if (Array.isArray(value)) return normalizeStoredStrings(value)
  if (!value || typeof value !== 'object') return []
  return normalizeStoredStrings((value as Record<string, unknown>).userPermissions)
}

function normalizeStoredRoles(value: unknown): string[] {
  if (!Array.isArray(value)) return []

  return Array.from(new Set(value.flatMap((role) => {
    if (typeof role === 'string') return role.split(',').map((item) => item.trim()).filter(Boolean)
    if (!role || typeof role !== 'object') return []
    const record = role as Record<string, unknown>
    return [record.roleName, record.name, record.role_name, record.roleCode, record.code, record.role_code]
      .filter((item): item is string => typeof item === 'string' && item.length > 0)
  })))
}

function isLocalDevelopmentHost(): boolean {
  const hostname = window.location.hostname
  return hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname.startsWith('192.168.')
}

function isDevTokenBypassEnabled(): boolean {
  return import.meta.env.DEV &&
    isLocalDevelopmentHost() &&
    import.meta.env.VITE_ENABLE_DEV_TOKEN_BYPASS === DEV_TOKEN_BYPASS_FLAG
}

function clearDevTokenArtifacts(): void {
  const sessionToken = storage.get<string>(AUTH_STORAGE_KEYS.TOKEN, 'session')
  const devToken = storage.get<string>(AUTH_STORAGE_KEYS.DEV_TOKEN, 'local')
  const savedAuth = storage.getAuth()

  if (sessionToken === 'dev-token') {
    storage.remove(AUTH_STORAGE_KEYS.TOKEN, 'session')
  }

  if (devToken === 'dev-token') {
    storage.remove(AUTH_STORAGE_KEYS.DEV_TOKEN, 'local')
  }

  if (savedAuth?.token === 'dev-token') {
    storage.remove(AUTH_STORAGE_KEYS.AUTH, 'local')
    storage.remove(AUTH_STORAGE_KEYS.AUTH_BACKUP, 'local')
  }
}

/**
 * 检查是否可以执行跳转（防止短时间内重复跳转）
 */
function canRedirect(): boolean {
  const now = Date.now()
  const lastRedirect = storage.get<string>(ROUTER_STORAGE_KEYS.REDIRECT_COOLDOWN, 'session')

  if (lastRedirect) {
    const lastRedirectTime = parseInt(lastRedirect, 10)
    if (now - lastRedirectTime < REDIRECT_COOLDOWN_TIME) {
      return false // 还在冷却期内，不能跳转
    }
  }

  return true // 可以跳转
}

/**
 * 标记已执行跳转
 */
function markRedirected(): void {
  storage.set(ROUTER_STORAGE_KEYS.REDIRECT_COOLDOWN, Date.now().toString(), 'session')
}

/**
 * 检查用户角色状态
 * 如果用户角色被禁用，强制退出登录
 */
async function checkUserRoleStatus(): Promise<void> {
  const authStore = useAuthStore()

  if (!authStore.isAuthenticated || !authStore.user) {
    return
  }

  const now = Date.now()
  if (now - lastRoleStatusCheckAt < ROLE_STATUS_CACHE_TIME) {
    return
  }

  if (roleStatusCheckPromise) {
    return roleStatusCheckPromise
  }

  roleStatusCheckPromise = (async () => {
    // 获取用户的最新角色信息
    const response = await api.get('/auth/user', {
      showLoading: false,
      showError: false,
      timeout: ROLE_STATUS_TIMEOUT,
      useCache: true,
      cacheTTL: 30 * 1000
    })

    if (response.success && response.data) {
      const userRoles = response.data.roles || []

      // 检查用户是否有激活的角色
      const hasActiveRole = userRoles.some((role: unknown) => {
        // 检查角色是否激活（后端会过滤掉未激活的角色）
        return role && role !== 'undefined' && role !== ''
      })

      if (!hasActiveRole) {
        // 显示友好的提示信息
        showElementNotification({
          title: '账户已被禁用',
          message: '您的账户（或角色）已被禁用，请联系管理员开启角色（或工号）的登录权限。',
          type: 'error',
          duration: 0, // 不自动关闭
          showClose: false,
          position: 'top-right'
        })

        // 清除认证信息
        authStore.logout()

        // 延迟一下再跳转，确保用户能看到提示
        setTimeout(() => {
          // 判断是否是 H5 路由，决定跳转目标
          const isH5Route = window.location.pathname.startsWith('/m')
          const loginPath = isH5Route ? '/m/login' : '/login'
          window.location.href = loginPath
        }, 1000)

        throw new Error('USER_ROLES_DISABLED')
      }

      lastRoleStatusCheckAt = Date.now()
    }
  })().catch((error: unknown) => {
    const routeGuardError = error as {
      message?: string
      response?: unknown
      code?: string
    }

    // 如果是角色禁用错误，不重复处理
    if (routeGuardError.message === 'USER_ROLES_DISABLED') {
      throw error
    }

    // 检查是否是网络错误
    if (!routeGuardError.response || routeGuardError.code === 'ERR_NETWORK' || routeGuardError.code === 'ECONNREFUSED') {
      // 网络错误时静默处理，避免干扰路由守卫
      return
    }

    // 其他错误，静默处理，避免影响正常用户
  }).finally(() => {
    roleStatusCheckPromise = null
  })

  return roleStatusCheckPromise
}

/**
 * 路由守卫管理器
 */
export class RouteGuards {
  private router: Router
  private pageLoadingTasks = new Map<string, string>()
  private navigationAttempts = new Map<string, number>()
  private navigationAttemptTimestamps = new Map<string, number>()
  private readonly MAX_ATTEMPTS = 10

  constructor(router: Router) {
    this.router = router
    this.setupGuards()
  }

  /**
   * 设置所有路由守卫
   */
  private setupGuards(): void {
    this.setupBeforeEach()
    this.setupAfterEach()
    this.setupResolveGuard()
    this.setupErrorHandlers()
  }

  /**
   * 设置前置守卫（完整功能版）
   */
  private setupBeforeEach(): void {
    this.router.beforeEach(async (to, from, next) => {
      const startTime = Date.now()

      try {
        // 0. 首先检查公开路由 - 无需任何认证检查
        const publicRoutes = ['/login', '/404', '/forgot-password', '/register']
        // 检查路径是否以 /m 开头（H5 移动端公开路由）
        const isH5Route = to.path.startsWith('/m')
        // 检查当前路由或任何父路由的 meta.requiresAuth
        const requiresAuth = to.matched.some(record => record.meta?.requiresAuth === true)

        if (publicRoutes.includes(to.path) || to.meta?.requiresAuth === false || isH5Route || !requiresAuth) {
          return next()
        }

        // 检查后端失联状态 - 改进：先尝试恢复连接再决定是否退出
        const disconnectInfo = getBackendDisconnectInfo()
        if (disconnectInfo.graceExceeded) {
          // 宽限期超时时，先尝试检查后端健康状态
          try {
            const healthResponse = await api.get('/health', {
              showLoading: false,
              showError: false,
              timeout: 5000  // 5秒超时
            })

            // 后端已恢复连接，清除失联状态并继续访问
            if (healthResponse?.success) {
              setBackendDisconnectedState(false)
              // 继续后续认证检查，不强制退出
            }
          } catch (healthError) {
            // 后端仍然无法连接，需要重新登录
            clearPersistedAuthData({
              notifyOtherWindows: false
            })

            const loginPath = to.path.startsWith('/m') ? '/m/login' : '/login'

            if (canRedirect()) {
              markRedirected()
              showElementNotification({
                title: '连接已断开',
                message: '后端失联超过5分钟，请重新登录后再继续操作',
                type: 'warning',
                duration: 4000,
                position: 'top-right'
              })
            }

            return next({
              path: loginPath,
              query: { reason: 'backend_disconnected' }
            })
          }
        }

        // 获取store实例
        const authStore = useAuthStore()
        const appStore = useAppStore()
        const loadingStore = useLoadingStore()

        // 🔧 确保 auth store 完全初始化
        // 如果 store 中没有 token 或 user，显式调用 loadPersistedAuthData
        if (!authStore.token || !authStore.user) {
          await authStore.loadPersistedAuthData()
        }

        // 🔧 额外检查：如果 store 仍然没有数据，尝试从存储恢复
        if (!authStore.token || !authStore.user) {
          // 1. 首先尝试从 sessionStorage 获取 token
          const sessionToken = storage.get<string>(AUTH_STORAGE_KEYS.TOKEN, 'session')
          if (sessionToken && sessionToken.length > 10) {
            authStore.token = sessionToken
          }

          // 2. 从 localStorage 获取完整认证数据
          const savedAuth = storage.getAuth()
          if (savedAuth) {
            try {
              if (savedAuth.token && savedAuth.token.length > 10 && savedAuth.user) {
                authStore.token = savedAuth.token
                authStore.refreshToken = savedAuth.refreshToken || ''
                authStore.user = savedAuth.user
                authStore.permissions = normalizeStoredPermissions(savedAuth.permissions)
                authStore.roles = normalizeStoredRoles(savedAuth.roles)
                // 同步到 sessionStorage
                storage.setToken(savedAuth.token)
              }
            } catch (e) {
              // 解析 localStorage 失败，忽略
            }
          }
        }

        // 开发环境 dev-token 特权默认禁用，只有显式环境开关才允许本地启用
        if (!authStore.isAuthenticated) {
          const sessionToken = storage.get<string>(AUTH_STORAGE_KEYS.TOKEN, 'session')
          const devToken = storage.get<string>(AUTH_STORAGE_KEYS.DEV_TOKEN, 'local')
          const hasDevTokenArtifacts = sessionToken === 'dev-token' || devToken === 'dev-token'

          if (hasDevTokenArtifacts) {
            if (!isDevTokenBypassEnabled()) {
              clearDevTokenArtifacts()
            } else {
              authStore.token = 'dev-token'
              authStore.refreshToken = ''
              authStore.user = {
                id: 999999,
                username: 'dev_test_user',
                name: '开发测试用户',
                email: 'dev-test@localhost.local',
                phone: '',
                status: 'active',
                roles: ['dev_test'],
                permissions: ['*'],
                created_at: TimeUtil.now().toISOString(),
                updated_at: TimeUtil.now().toISOString()
              }
              authStore.permissions = ['*']
              authStore.roles = ['dev_test']
              authStore.lastActivity = Date.now()
            }
          }
        }

        // 2. 检查用户认证状态
        if (!authStore.isAuthenticated) {
          // 判断是 H5 路由还是主站路由，决定重定向目标
          const isH5Route = to.path.startsWith('/m')
          const loginPath = isH5Route ? '/m/login' : '/login'

          // 重定向前保存目标路径
          const redirect = to.fullPath !== '/' && to.fullPath !== loginPath ? to.fullPath : undefined

          // 冷启动时应用尚未挂载，直接进入登录页即可。此时异步通知可能早于
          // Element Plus 样式加载，造成未样式化提示短暂出现在页面底部。
          // 跳转本身不能受通知冷却影响，否则并发认证处理会把首次导航卡住。
          const isInitialNavigation = from.matched.length === 0
          if (!isInitialNavigation && canRedirect()) {
            markRedirected()
            void showElementNotification({
              title: '需要登录',
              message: '请先登录后再访问此页面',
              type: 'warning',
              duration: 3000,
              position: 'top-right'
            })
          }

          return next({
            path: loginPath,
            query: redirect ? { redirect } : undefined
          })
        }

        // 3. 确保权限数据已加载完成
        const requiredPermissions = getRoutePermissions(to.path)
        const hasNoLoadedPermissions = !Array.isArray(authStore.userPermissions) || authStore.userPermissions.length === 0

        // 只对需要权限的路由等待一次权限刷新；普通路由不阻塞跳转
        if (authStore.isAuthenticated && requiredPermissions?.length && hasNoLoadedPermissions) {
          // ⚠️ 容错：检查 token 是否有效
          const token = authStore.token || storage.getToken()
          if (!token || token.length < 10) {
            return next({
              path: '/login',
              query: { redirect: to.fullPath }
            })
          }

          // 进入受限路由前先恢复权限，避免页面先进入再由组件层提示
          const currentRole = authStore.user?.role
          const currentRoles = authStore.roles

          await authStore.fetchUserInfo().then(() => {
            if (!authStore.user?.role && currentRole) {
              authStore.user.role = currentRole
              authStore.roles = currentRoles
            }
          }).catch((error: unknown) => {
            const requestError = error as { response?: { status?: number } }
            // 401 错误时，不强制退出，允许用户继续访问
            if (requestError.response?.status === 401) {
              // Token 可能已过期，但允许继续访问
            }
          })
        }

        // 4. 检查用户角色状态（确保角色未被禁用）
        await checkUserRoleStatus()

        // 5. 权限检查
        if (requiredPermissions && requiredPermissions.length > 0) {
          if (!Array.isArray(authStore.userPermissions) || authStore.userPermissions.length === 0) {
            showElementWarning('权限数据加载失败，无法访问此页面')

            if (to.path === '/dashboard') {
              return next()
            }

            return next('/dashboard')
          }

          if (!canAccessRoutePath(to.path, authStore)) {
            showElementWarning('您没有访问此页面的权限')

            if (to.path === '/dashboard') {
              return next()
            }

            return next('/dashboard')
          }
        }

        // 5. 检查页面访问频率限制（开发环境绕过）
        if (import.meta.env.PROD && this.checkRateLimit(to.path)) {
          showElementWarning('页面访问过于频繁，请稍后再试')
          return next(false)
        }

        // 6. 显示页面加载状态
        if (this.shouldShowPageLoading(to, from)) {
          const loadingTaskId = this.generateLoadingId(to.path)
          this.pageLoadingTasks.set(to.path, loadingTaskId)
          loadingStore.startLoading(`正在加载 ${to.meta?.title || '页面'}...`, loadingTaskId)
        }

        // 7. 预取路由数据（如果配置了）
        await this.preloadRouteData(to, authStore)

        // 8. 更新应用状态
        appStore.updateLastNavigation({
          from: from.path,
          to: to.path,
          timestamp: startTime
        })

        return next()

      } catch (error) {
        showElementNotification({
          title: '路由错误',
          message: '页面跳转时发生错误，请重试',
          type: 'error',
          duration: 5000,
          position: 'top-right'
        })

        // 受保护路由发生异常时必须拒绝访问，禁止权限系统异常后绕过检查。
        if (to.path === '/dashboard') {
          return next(false)
        }
        return next('/dashboard')
      }
    })
  }

  /**
   * 设置后置守卫
   */
  private setupAfterEach(): void {
    this.router.afterEach((to, from, failure) => {
      const appStore = useAppStore()
      const loadingStore = useLoadingStore()

      try {
        // 清理页面加载任务
        const loadingTaskId = this.pageLoadingTasks.get(to.path)
        if (loadingTaskId) {
          loadingStore.stopLoading(loadingTaskId)
          this.pageLoadingTasks.delete(to.path)
        }

        const previousLoadingTaskId = this.pageLoadingTasks.get(from.path)
        if (previousLoadingTaskId) {
          loadingStore.stopLoading(previousLoadingTaskId)
          this.pageLoadingTasks.delete(from.path)
        }

        // 页面标题由siteSettings store中的watch监听器统一管理，不需要在这里设置

        // 记录路由变化
        if (failure) {
          // 过滤导航取消错误，这是正常的用户行为
          if (failure.name === 'NavigationCancelledError' ||
              failure.message?.includes('Navigation cancelled')) {
            // 路由导航取消，正常行为
          } else {
            // 生产环境不显示错误通知，避免干扰用户体验
            // 大多数导航失败是权限系统导致的，但我们已经允许静默访问
          }
        } else {
          // 成功导航后的处理
          this.handleSuccessfulNavigation(to, from, appStore)
        }

        // 更新应用状态
        appStore.setLoading(false)

        // 滚动到页面顶部
        this.handlePageScroll(to)

      } catch (error) {
        // 后置守卫执行失败，忽略
      }
    })
  }

  /**
   * 设置解析守卫
   */
  private setupResolveGuard(): void {
    // 解析守卫用于在路由组件被解析之前执行数据预取等操作
    this.router.beforeResolve(async (to, from, next) => {
      try {
        // 数据预取等操作可以在这里添加
        // 目前保持简单，直接放行
        next()
      } catch (error) {
        next()
      }
    })
  }

  /**
   * 设置错误处理器
   */
  private setupErrorHandlers(): void {
    this.router.onError((_error) => {
      const loadingStore = useLoadingStore()

      // 路由组件懒加载失败、网络波动或导航异常时，确保不会遗留全局加载遮罩。
      loadingStore.clearAllLoading()
      this.pageLoadingTasks.clear()

      // 错误上报
      if (import.meta.env.PROD) {
        // 生产环境下可以上报错误到监控系统
      }
    })
  }

  /**
   * 检查用户角色权限
   */
  private checkRolePermission(userRoles: string[] | string | undefined, requiredRoles: string[]): boolean {
    const authStore = useAuthStore()

    // 如果没有角色要求，直接通过
    if (!requiredRoles.length) {
      return true
    }

    // 如果没有用户角色，拒绝访问
    if (!userRoles) {
      return false
    }

    if (authStore.hasRole(requiredRoles)) {
      return true
    }

    const roles = Array.isArray(userRoles) ? userRoles : [userRoles]
    const normalizedRoles = roles.filter(Boolean)
    const hasPermission = normalizedRoles.some(role => requiredRoles.includes(role))

    return hasPermission
  }

  /**
   * 检查访问频率限制
   */
  private checkRateLimit(path: string): boolean {
    const now = Date.now()
    const attempts = this.navigationAttempts.get(path) || 0

    // 重置过期的访问记录
    if (attempts > 0) {
      const lastAttempt = this.navigationAttemptTimestamps.get(path)
      if (lastAttempt && now - lastAttempt > 10000) { // 10秒
        this.navigationAttempts.delete(path)
        this.navigationAttemptTimestamps.delete(path)
        return false
      }
    }

    // 检查是否超过最大尝试次数
    if (attempts >= this.MAX_ATTEMPTS) {
      return true
    }

    // 增加访问次数
    this.navigationAttempts.set(path, attempts + 1)
    this.navigationAttemptTimestamps.set(path, now)

    return false
  }

  /**
   * 判断是否需要显示页面加载
   */
  private shouldShowPageLoading(to: RouteLocationNormalized, from: RouteLocationNormalized): boolean {
    if (to.meta?.disableRouteLoading) {
      return false
    }

    // 默认关闭全局路由切页 loading，避免弱网、懒加载失败或云端资源波动时
    // 出现“页面一直卡在正在加载 xxx”的问题。
    // 只有明确声明 enableRouteLoading 的页面才启用这层全局反馈。
    return to.meta?.enableRouteLoading === true && to.path !== from.path
  }

  /**
   * 生成加载任务ID
   */
  private generateLoadingId(path: string): string {
    return `page_${path}_${Date.now()}`
  }

  /**
   * 预取路由数据
   */
  private async preloadRouteData(to: RouteLocationNormalized, authStore: AuthStore): Promise<void> {
    // 根据路由配置预取必要数据
    const preloadData = to.meta?.preloadData
    if (typeof preloadData === 'function') {
      try {
        await preloadData(to, authStore)
      } catch (error) {
        // 路由数据预取失败，忽略
      }
    }
  }

  /**
   * 处理成功导航
   */
  private handleSuccessfulNavigation(
    to: RouteLocationNormalized,
    from: RouteLocationNormalized,
    appStore: AppStore
  ): void {
    // 更新面包屑导航
    appStore.updateBreadcrumb(this.generateBreadcrumb(to))

    // 记录页面访问统计
    this.recordPageVisit(to, from)

    // 检查并显示页面提示（如果配置了）
    if (typeof to.meta?.pageTip === 'string' && to.meta.pageTip) {
      const pageTip = to.meta.pageTip
      setTimeout(() => {
        showElementNotification({
          title: '页面提示',
          message: pageTip,
          type: 'info',
          duration: 5000,
          position: 'top-right'
        })
      }, 1000)
    }
  }

  /**
   * 处理页面滚动
   */
  private handlePageScroll(to: RouteLocationNormalized): void {
    // 检查是否需要保持滚动位置
    if (to.meta?.keepScrollPosition) {
      // 保持当前滚动位置
      return
    }

    // 检查是否需要滚动到特定位置
    if (typeof to.meta?.scrollTo === 'string' && to.meta.scrollTo) {
      const element = document.querySelector(to.meta.scrollTo)
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' })
      }
    } else {
      // 默认滚动到页面顶部
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  /**
   * 生成面包屑导航
   */
  private generateBreadcrumb(route: RouteLocationNormalized): Array<{ name: string, path: string }> {
    const breadcrumb: Array<{ name: string, path: string }> = []

    // 添加首页
    breadcrumb.push({ name: '首页', path: '/dashboard' })

    // 添加当前页面
    if (typeof route.meta?.title === 'string' && route.meta.title) {
      breadcrumb.push({ name: route.meta.title, path: route.path })
    }

    return breadcrumb
  }

  /**
   * 记录页面访问
   */
  private recordPageVisit(to: RouteLocationNormalized, from: RouteLocationNormalized): void {
    const visitData: PageVisitData = {
      path: to.path,
      title: typeof to.meta?.title === 'string' ? to.meta.title : undefined,
      from: from.path,
      timestamp: Date.now(),
      userAgent: navigator.userAgent
    }

    // 发送到分析服务（如果配置了）
    const analytics = window.__TF2025__?.analytics as {
      trackPageVisit?: (data: PageVisitData) => void
    } | undefined
    if (analytics?.trackPageVisit) {
      analytics.trackPageVisit(visitData)
    }

    // 本地存储访问历史（可选）
    this.saveVisitHistory(visitData)
  }

  /**
   * 保存访问历史
   */
  private saveVisitHistory(visitData: PageVisitData): void {
    try {
      const history = storage.get<PageVisitData[]>(CACHE_STORAGE_KEYS.VISIT_HISTORY, 'local') || []
      history.unshift(visitData)

      // 保留最近50条记录
      if (history.length > 50) {
        history.splice(50)
      }

      storage.set(CACHE_STORAGE_KEYS.VISIT_HISTORY, history, 'local')
    } catch (error) {
      // 保存访问历史失败，忽略
    }
  }

  /**
   * 清理资源
   */
  public destroy(): void {
    // 清理所有加载任务
    this.pageLoadingTasks.clear()
    this.navigationAttempts.clear()
    this.navigationAttemptTimestamps.clear()
  }
}

/**
 * 设置路由守卫
 */
export function setupRouterGuards(router: Router): RouteGuards {
  return new RouteGuards(router)
}

export default RouteGuards
