/**
 * 统一API配置和管理
 * 解决多个API实例冲突问题
 */

import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse, AxiosError } from 'axios'
import { ElMessage, ElLoading } from 'element-plus'
import { PermissionMapper } from './permissionMapper'
import { globalErrorLogger } from './error-logger'
import { ErrorLevel, ErrorType } from './error-boundary'
import { clearPersistedAuthData, setBackendDisconnectedState } from './auth-session'
import { storage } from '@/services/storage'
import { AUTH_STORAGE_KEYS, ROUTER_STORAGE_KEYS } from '@/constants/storage'
import type { ApiResponse as GlobalApiResponse } from '@/types'
import logger from '@/utils/logger'

// API基础配置
const API_CONFIG = {
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  timeout: 120000, // 120秒超时，为销售出库等复杂操作提供更长时间
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  }
}

const enableApiLogs = import.meta.env.DEV && import.meta.env.VITE_API_LOGGING === 'true'

// 请求配置接口
export interface RequestConfig extends AxiosRequestConfig {
  showLoading?: boolean
  showError?: boolean
  showSuccess?: boolean
  successMessage?: string
  useCache?: boolean
  cacheTTL?: number
  metadata?: {
    requestId: string
    startTime: number
    url?: string
    method?: string
  }
  cachedResponse?: any
}

// API响应接口 - 使用全局类型定义
export type ApiResponse<T = any> = GlobalApiResponse<T>

/**
 * 统一API管理器
 */
class UnifiedApiManager {
  private instance: AxiosInstance
  private loadingInstance: any = null
  private requestCount = 0
  private cache = new Map<string, { data: any, timestamp: number, ttl: number }>()
  private refreshPromise: Promise<boolean> | null = null
  private static readonly REDIRECT_COOLDOWN_TIME = 3000 // 3秒内不重复跳转

  constructor() {
    this.instance = this.createInstance()
    this.setupInterceptors()
  }

  /**
   * 创建统一的Axios实例
   */
  private createInstance(): AxiosInstance {
    return axios.create({
      baseURL: API_CONFIG.baseURL,
      timeout: API_CONFIG.timeout,
      headers: API_CONFIG.headers,
      withCredentials: true
    })
  }

  /**
   * 设置请求和响应拦截器
   */
  private setupInterceptors(): void {
    // 请求拦截器
    this.instance.interceptors.request.use(
      (config) => this.handleRequest(config),
      (error) => this.handleRequestError(error)
    )

    // 响应拦截器
    this.instance.interceptors.response.use(
      (response) => this.handleResponse(response),
      (error) => this.handleResponseError(error)
    )
  }

  /**
   * 处理请求
   */
  private handleRequest(config: any): any {
    const requestConfig = config as RequestConfig

    // 添加认证信息
    this.addAuthHeaders(config)

    // 添加CSRF防护
    this.addCSRFHeaders(config)

    // 添加请求ID和时间戳
    config.metadata = {
      requestId: this.generateRequestId(),
      startTime: Date.now(),
      url: config.url,
      method: config.method?.toUpperCase()
    }

    // 缓存检查（仅对GET请求）
    if (config.method?.toLowerCase() === 'get' && requestConfig.useCache !== false) {
      const cacheKey = this.generateCacheKey(config)
      const cached = this.cache.get(cacheKey)
      if (cached && Date.now() - cached.timestamp < cached.ttl) {
        config.cachedResponse = cached.data
      }
    }

    // 显示加载状态
    if (requestConfig.showLoading) {
      this.showLoading()
    }

    return config
  }

  /**
   * 处理请求错误
   */
  private handleRequestError(error: any): Promise<never> {
    logger.error('请求配置错误', error)
    this.hideLoading()
    return Promise.reject(error)
  }

  /**
   * 处理响应
   */
  private handleResponse(response: AxiosResponse): any {
    const requestConfig = response.config as RequestConfig
    const metadata = requestConfig.metadata

    // 如果是缓存响应，直接返回
    if (requestConfig.cachedResponse) {
      return requestConfig.cachedResponse
    }

    // 计算请求耗时
    const duration = Date.now() - metadata.startTime

    // 缓存成功的GET请求响应
    if (requestConfig.method?.toLowerCase() === 'get' && requestConfig.useCache !== false) {
      const cacheKey = this.generateCacheKey(requestConfig)
      const ttl = requestConfig.cacheTTL || 3000 // 3秒默认缓存 - 平衡性能与实时性
      this.cache.set(cacheKey, {
        data: response.data,
        timestamp: Date.now(),
        ttl
      })
    }

    // 性能监控
    this.recordPerformance(metadata, duration, response.status)

    // 隐藏加载状态
    if (requestConfig.showLoading) {
      this.hideLoading()
    }

    // 显示成功消息
    if (requestConfig.showSuccess && response.data?.success) {
      const message = requestConfig.successMessage || response.data?.message || '操作成功'
      ElMessage.success(message)
    }

    return response.data
  }

  /**
   * 处理响应错误
   */
  private async handleResponseError(error: any): Promise<any> {
    const requestConfig = error.config as RequestConfig
    const metadata = requestConfig?.metadata

    // 隐藏加载状态
    if (requestConfig?.showLoading) {
      this.hideLoading()
    }

    // 对于被取消的请求，不记录错误日志
    if (error.message === 'canceled' || error.code === 'ERR_CANCELED') {
      throw error
    }

    // 错误日志
    if (enableApiLogs && metadata) {
      logger.error(`API错误 [${metadata.requestId}]`, {
        status: error.response?.status,
        message: error.message,
        data: error.response?.data,
        baseURL: error.config?.baseURL,
        url: error.config?.url
      })
    }

    // 记录到错误日志系统
    this.logApiError(error, metadata)

    // 记录性能数据
    if (metadata) {
      const duration = Date.now() - metadata.startTime
      this.recordPerformance(metadata, duration, error.response?.status || 0)
    }

    const recoveredResponse = await this.tryRecoverAuthError(error)
    if (recoveredResponse) {
      if (requestConfig?.showLoading) {
        this.hideLoading()
      }
      return recoveredResponse
    }

    // 处理特定状态码错误
    this.handleHttpError(error)

    // 显示错误消息
    if (requestConfig?.showError !== false) {
      this.showErrorMessage(error)
    }

    return Promise.reject(error)
  }

  private async tryRecoverAuthError(error: AxiosError): Promise<any | null> {
    const status = error.response?.status
    const responseData = error.response?.data as any
    const requestConfig = (error.config || {}) as RequestConfig & { _retry?: boolean }
    const requestUrl = requestConfig.url || ''
    const tokenError = responseData?.code
    const isRefreshRequest = requestUrl.includes('/auth/refresh')
    const isAuthRequest = requestUrl.includes('/auth/login') || requestUrl.includes('/auth/logout')

    if (status !== 401 || requestConfig._retry || isRefreshRequest || isAuthRequest) {
      return null
    }

    // 仅对 access token 明确过期的情况执行静默刷新
    // TOKEN_REVOKED / TOKEN_INVALID 表示登录态已不可信，应直接走退出流程
    if (tokenError && tokenError !== 'TOKEN_EXPIRED') {
      return null
    }

    const refreshed = await this.refreshAccessToken()
    if (!refreshed) {
      return null
    }

    requestConfig._retry = true
    this.addAuthHeaders(requestConfig)
    return this.instance(requestConfig)
  }

  private async refreshAccessToken(): Promise<boolean> {
    if (this.refreshPromise) {
      return this.refreshPromise
    }

    this.refreshPromise = this.performTokenRefresh()
      .finally(() => {
        this.refreshPromise = null
      })

    return this.refreshPromise
  }

  private async performTokenRefresh(): Promise<boolean> {
    const authData = this.readPersistedAuthData()
    const storedRefreshToken = authData?.refreshToken

    if (!storedRefreshToken) {
      return false
    }

    try {
      const refreshClient = axios.create({
        baseURL: API_CONFIG.baseURL,
        timeout: API_CONFIG.timeout,
        headers: API_CONFIG.headers,
        withCredentials: true
      })

      const response = await refreshClient.post('/auth/refresh', {
        refreshToken: storedRefreshToken
      })

      const payload = response?.data?.data && typeof response.data.data === 'object'
        ? response.data.data
        : response?.data

      const nextToken = payload?.token || payload?.accessToken || ''
      const nextRefreshToken = payload?.refreshToken || storedRefreshToken

      if (!response?.data?.success || !nextToken) {
        return false
      }

      const nextAuthData = {
        ...(authData || {}),
        ...payload,
        token: nextToken,
        accessToken: nextToken,
        refreshToken: nextRefreshToken,
        user: payload?.user || authData?.user || null,
        roles: payload?.user?.roles || authData?.roles || [],
        permissions: payload?.accessProfile || payload?.permissions || authData?.permissions || [],
        lastActivity: authData?.lastActivity || Date.now()
      }

      storage.setAuth(nextAuthData)
      storage.setToken(nextToken)
      setBackendDisconnectedState(false)
      return true
    } catch (refreshError) {
      logger.warn('刷新 access token 失败', refreshError)
      return false
    }
  }

  private readPersistedAuthData(): Record<string, any> | null {
    try {
      const raw = storage.getAuth()
      if (!raw) {
        return null
      }
      return raw as any
    } catch (error) {
      logger.warn('读取本地认证数据失败', error)
      return null
    }
  }

  /**
   * 记录API错误到日志系统
   */
  private logApiError(error: AxiosError, metadata?: any): void {
    const status = error.response?.status
    const url = error.config?.url || ''
    const method = error.config?.method?.toUpperCase() || 'GET'

    // 确定错误级别
    let level = ErrorLevel.MEDIUM
    if (status === 500 || status === 502 || status === 503 || status === 504) {
      level = ErrorLevel.HIGH
    } else if (status === 401 || status === 403) {
      level = ErrorLevel.HIGH
    } else if (!error.response) {
      // 网络错误
      level = ErrorLevel.CRITICAL
    }

    // 确定错误类型
    let type = ErrorType.NETWORK
    if (!error.response) {
      type = ErrorType.NETWORK
    } else if (status === 401 || status === 403) {
      type = ErrorType.PERMISSION
    } else if (status === 422) {
      type = ErrorType.VALIDATION
    } else if (status >= 500) {
      type = ErrorType.JAVASCRIPT
    }

    // 从URL中提取模块名
    const moduleMatch = url.match(/\/?([a-z]+)/i)
    const module = moduleMatch ? moduleMatch[1].toLowerCase() : 'unknown'

    globalErrorLogger.logError({
      level,
      type,
      message: this.getApiErrorMessage(error),
      stack: error.stack,
      context: {
        requestId: metadata?.requestId,
        url: error.config?.url,
        method,
        status,
        responseData: error.response?.data,
        requestConfig: metadata,
        duration: metadata ? Date.now() - metadata.startTime : undefined
      },
      component: `API:${module}`,
      action: `${method} ${url}`,
      tags: ['api', module.toLowerCase(), method.toLowerCase()]
    })
  }

  /**
   * 获取友好的API错误消息
   */
  private getApiErrorMessage(error: AxiosError): string {
    const status = error.response?.status
    const responseData = error.response?.data as any

    // 优先使用服务器返回的错误消息
    if (responseData?.message) {
      return responseData.message
    }

    // 根据状态码返回默认消息
    if (status) {
      switch (status) {
        case 400:
          return '请求参数错误'
        case 401:
          return '未授权访问'
        case 403:
          return '权限不足'
        case 404:
          return '资源不存在'
        case 408:
          return '请求超时'
        case 409:
          return '请求冲突'
        case 422:
          return '数据验证失败'
        case 429:
          return '请求过于频繁'
        case 500:
          return '服务器内部错误'
        case 502:
          return '网关错误'
        case 503:
          return '服务不可用'
        case 504:
          return '网关超时'
        default:
          return `请求失败 (${status})`
      }
    }

    // 网络错误
    if (!error.response) {
      if (error.code === 'ERR_NETWORK') {
        return '网络连接失败'
      } else if (error.code === 'TIMEOUT') {
        return '请求超时'
      } else if (error.code === 'ECONNABORTED') {
        return '请求被中断'
      }
      return '网络错误'
    }

    // 默认错误消息
    return error.message || '未知错误'
  }

  /**
   * 添加认证头信息
   */
  private addAuthHeaders(config: any): void {
    const urlPath = config.url || ''
    const isH5AuthApi = urlPath.startsWith('/public/auth/')
    const isH5AuthAnonymousApi = isH5AuthApi && (
      urlPath.endsWith('/login') ||
      urlPath.endsWith('/register')
    )
    const isPublicAPI = urlPath.startsWith('/public/') ||
                        urlPath.startsWith('/screen-lock/verify-inventory-query')

    let token = ''

    if (isH5AuthApi) {
      token = isH5AuthAnonymousApi ? '' : (storage.getH5AuthToken() || '')
    } else if (!isPublicAPI) {
      token = this.getValidToken() || ''
    }

    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    } else if (config.headers.Authorization) {
      delete config.headers.Authorization
    }

    // 添加设备信息
    config.headers['X-Device-Info'] = JSON.stringify({
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language,
      screenResolution: `${screen.width}x${screen.height}`,
      timestamp: Date.now()
    });

    // 添加权限映射转换头信息
    // 将前端的详细权限代码转换为后端期望的简单格式
    const method = config.method?.toUpperCase() || 'GET';

    // 根据URL路径和HTTP方法确定需要的权限
    const requiredPermission = this.convertPermissionForAPI(urlPath, method);
    if (requiredPermission) {
      config.headers['X-Required-Permission'] = requiredPermission;
    }
  }

  /**
   * 将前端权限代码转换为后端API期望的格式
   * 先转换为前端模块权限格式，再转换为后端简单格式
   */
  private convertPermissionForAPI(urlPath: string, method: string): string | null {
    // 从URL中提取模块名 - 支持带ID的路径如 customers/123 或 /api/customers/123
    let normalizedPath = urlPath.replace(/^\/+/, ''); // 移除开头的斜杠

    // 移除查询参数
    const queryIndex = normalizedPath.indexOf('?');
    if (queryIndex !== -1) {
      normalizedPath = normalizedPath.substring(0, queryIndex);
    }

    // 移除 /api 前缀（如果存在）
    if (normalizedPath.startsWith('api/')) {
      normalizedPath = normalizedPath.substring(4); // 移除 'api/' 前缀
    }

    const pathParts = normalizedPath.split('/');
    const module = pathParts[0]?.toLowerCase();

    if (!module) {
      return null;
    }

    // 豁免认证相关API和设置API的权限检查
    // Git管理使用requireAdmin中间件检查角色，不需要权限转换
    // employees 路径下的工资相关接口使用 salary:view 权限
    // options 提供基础数据选项（颜色、内存、品牌等），不需要特殊权限
    // stores 提供门店基础数据，不需要特殊权限
    // operators 提供操作员基础数据，不需要特殊权限
    // subsidy 国补管理模块，使用独立权限系统
    // csrf CSRF令牌获取，无需权限检查
    // upload 文件上传，使用统一的上传权限
    // brands, models, colors 提供基础数据，不需要特殊权限
    // database-sync 数据库同步，属于数据优化模块，豁免权限检查
    // system 系统设置（站点信息、品牌设置等），登录前需要访问（如Logo）
    const authExemptPaths = ['auth', 'login', 'logout', 'register', 'refresh', 'permissions', 'permission-logs', 'settings', 'public', 'screen-lock', 'git', 'attendance', 'employees', 'salary', 'salary-records', 'salary-templates', 'options', 'stores', 'operators', 'subsidy', 'csrf', 'upload', 'brands', 'models', 'colors', 'database-sync', 'data-sync', 'system'];
    if (authExemptPaths.includes(module)) {
      return null;
    }

    let action = '';

    // 特殊路径处理
    const isCleanupPath = normalizedPath.includes('/cleanup');
    const isSyncPath = normalizedPath.includes('/sync'); // 同步操作使用 edit 权限

    // 根据HTTP方法确定操作类型
    switch (method) {
      case 'GET':
        action = 'view';
        break;
      case 'POST':
        // cleanup 或 sync 操作使用 edit 权限
        if (isCleanupPath || isSyncPath) {
          action = 'edit';
        } else {
          action = 'create';
        }
        break;
      case 'PUT':
      case 'PATCH':
        action = 'edit';
        break;
      case 'DELETE':
        action = 'delete';
        break;
      default:
        return null;
    }

    // 特殊处理：data-import 模块使用 upload/execute 而不是 create
    if (module === 'data-import') {
      // 检查具体路径
      if (normalizedPath.includes('/upload')) {
        action = 'upload';
      } else if (normalizedPath.includes('/import')) {
        action = 'execute';
      } else if (normalizedPath.includes('/analyze')) {
        action = 'upload'; // analyze 也使用 upload 权限
      }
    }

  // 权限转换
    const frontendPermission = PermissionMapper.toModulePermission(action, module);
    const backendPermission = PermissionMapper.toBackendPermission(frontendPermission);

    return backendPermission;
  }

  /**
   * 处理权限错误
   */
  private handlePermissionError(error: AxiosError): void {
    const responseData = error.response?.data as any;
    const urlPath = error.config?.url || '';
    const method = error.config?.method?.toUpperCase() || 'GET';

    // 只在用户主动操作时显示提示（避免页面初始化时的批量错误）
    const isUserAction = method !== 'GET' || urlPath.includes('/export') || urlPath.includes('/delete');

    if (isUserAction) {
      // 直接使用 ElMessage 显示错误，避免 inject() 警告
      const message = responseData?.message || '您没有权限执行此操作';
      ElMessage.warning({
        message,
        duration: 3000,
        showClose: true
      });
    }
  }

  /**
   * 获取权限的友好显示名称
   */
  private getPermissionDisplayName(permissionCode: string): string {
    if (permissionCode.includes(':')) {
      // 使用PermissionMapper获取权限显示名称
      return PermissionMapper.getPermissionDisplayName(permissionCode);
    }
    return permissionCode;
  }

  /**
   * 获取操作的友好显示名称
   */
  private getActionDisplayName(action: string): string {
    const actionMap: Record<string, string> = {
      'view': '查看',
      'read': '查看',
      'create': '新增',
      'add': '新增',
      'edit': '编辑',
      'update': '编辑',
      'delete': '删除',
      'remove': '删除',
      'export': '导出',
      'import': '导入',
      'approve': '审批',
      'reject': '拒绝'
    };
    return actionMap[action] || action;
  }

  /**
   * 获取模块的友好显示名称
   */
  private getModuleDisplayName(urlPath: string): string {
    const moduleMatch = urlPath.match(/^\/?([a-z]+)/i);
    if (!moduleMatch) return '该模块';

    const module = moduleMatch[1].toLowerCase();
    const moduleMap: Record<string, string> = {
      'customers': '客户管理',
      'employees': '员工管理',
      'suppliers': '供应商管理',
      'stores': '门店管理',
      'inventory': '库存管理',
      'sales': '销售管理',
      'phones': '手机管理',
      'brands': '品牌管理',
      'models': '型号管理',
      'colors': '颜色管理',
      'memories': '内存管理',
      'accessories': '配件管理',
      'repairs': '维修管理',
      'rentals': '租赁管理',
      'query': '综合查询',
      'analytics': '数据分析',
      'permissions': '权限管理',
      'users': '用户管理',
      'roles': '角色管理',
      'menus': '菜单管理',
      'system': '系统管理'
    };
    return moduleMap[module] || '该模块';
  }

  /**
   * 添加CSRF防护头
   */
  private addCSRFHeaders(config: any): void {
    // 获取CSRF token
    const csrfMeta = (document as Document & { querySelector: (selectors: string) => Element | null })
      .querySelector('meta[name="csrf-token"]') as HTMLMetaElement | null
    const csrfToken = csrfMeta?.content
    if (csrfToken) {
      config.headers['X-CSRF-Token'] = csrfToken
    }
  }

  /**
   * 检查是否可以执行跳转（防止短时间内重复跳转）
   */
  private canRedirect(): boolean {
    const now = Date.now()
    const lastRedirect = storage.get<string>(ROUTER_STORAGE_KEYS.REDIRECT_COOLDOWN, 'session')

    if (lastRedirect) {
      const lastRedirectTime = parseInt(lastRedirect, 10)
      if (now - lastRedirectTime < UnifiedApiManager.REDIRECT_COOLDOWN_TIME) {
        return false // 还在冷却期内，不能跳转
      }
    }

    return true // 可以跳转
  }

  /**
   * 标记已执行跳转
   */
  private markRedirected(): void {
    storage.set(ROUTER_STORAGE_KEYS.REDIRECT_COOLDOWN, Date.now().toString(), 'session')
  }

  /**
   * 处理HTTP状态码错误
   */
  private handleHttpError(error: AxiosError): void {
    const status = error.response?.status

    // 检查是否已经在登录页面或H5页面，避免死循环
    const isLoginPage = window.location.pathname === '/login' ||
                        window.location.pathname.includes('/login')
    const isH5Page = window.location.pathname.startsWith('/m')
    // 公开路由列表（无需认证）
    const publicRoutes = ['/price-query', '/sales-price-display']
    const isPublicRoute = publicRoutes.includes(window.location.pathname)

    // 网络错误或后端无法连接：保留本地登录态，只标记后端不可用
    if (!error.response || error.code === 'ERR_NETWORK' || error.code === 'ECONNREFUSED') {
      if (!isLoginPage && !isH5Page && !isPublicRoute) {
        setBackendDisconnectedState(true)
      }
      return
    }

    switch (status) {
      case 401:
        const errorCode = (error.response?.data as any)?.code

        // TOKEN_EXPIRED 已经在 tryRecoverAuthError 中处理，这里跳过
        if (errorCode === 'TOKEN_EXPIRED') {
          return
        }

        // 确定友好的错误提示
        let logoutReason = '认证已失效'
        let notificationTitle = '登录已过期'
        let notificationMessage = '您的登录已过期，请重新登录'

        if (errorCode === 'TOKEN_REVOKED') {
          logoutReason = '登录已失效，请重新登录'
          notificationTitle = '登录已失效'
          notificationMessage = '您的账号在其他地方登录，当前登录已失效'
        } else if (errorCode === 'TOKEN_INVALID') {
          logoutReason = '登录信息无效，请重新登录'
          notificationTitle = '登录信息无效'
          notificationMessage = '登录信息验证失败，请重新登录'
        } else if (errorCode === 'TOKEN_MISSING') {
          logoutReason = '未登录'
          notificationTitle = '需要登录'
          notificationMessage = '请先登录后再继续操作'
        } else if (!errorCode) {
          logoutReason = '登录状态校验失败，请重新登录'
          notificationTitle = '登录状态异常'
          notificationMessage = '登录状态验证失败，请重新登录'
        }

        // 公开页面、H5页面和登录页不跳转
        if (!isLoginPage && !isH5Page && !isPublicRoute && this.canRedirect()) {
          this.markRedirected()

          // 显示友好的通知
          import('element-plus').then(({ ElNotification }) => {
            ElNotification({
              title: notificationTitle,
              message: notificationMessage,
              type: 'warning',
              duration: 4000,
              position: 'top-right'
            })
          })

          setBackendDisconnectedState(false)
          clearPersistedAuthData()
          window.dispatchEvent(new CustomEvent('tf2025:auth:logout', {
            detail: { reason: logoutReason }
          }))

          // 延迟跳转，让用户看到提示
          setTimeout(() => {
            window.location.href = '/login'
          }, 1000)
        }
        break
      case 403:
        this.handlePermissionError(error)
        break
      case 404:
        if (!isLoginPage) {
          ElMessage.error('请求的资源不存在')
        }
        break
      case 422:
        // 表单验证错误，不显示通用错误消息
        break
      case 429:
        ElMessage.error('请求过于频繁，请稍后再试')
        break
      case 500:
        ElMessage.error('服务器内部错误，请稍后再试')
        break
      case 502:
        ElMessage.error('服务器网关错误，请稍后再试')
        break
      case 503:
        ElMessage.error('服务暂时不可用，请稍后再试')
        break
      default:
        if (status && status >= 500) {
          ElMessage.error('服务器错误，请稍后再试')
        }
    }
  }

  /**
   * 显示错误消息
   */
  private showErrorMessage(error: AxiosError): void {
    let message = '请求失败'

    // 从响应中获取错误消息
    if (error.response?.data) {
      const data = error.response.data as any
      message = data.message || data.error || message

      // 特殊处理认证恢复相关错误，不显示重复弹窗
      if (data.code === 'TOKEN_EXPIRED' || data.code === 'TOKEN_REVOKED') {
        return
      }
    } else if (error.message) {
      message = error.message
    }

    // 特殊处理网络错误
    if (!error.response) {
      if (error.code === 'ERR_NETWORK') {
        message = '网络连接失败，请检查网络设置或联系管理员'
      } else if (error.code === 'TIMEOUT') {
        message = '请求超时，请稍后再试'
      }
    }

    ElMessage.error(message)
  }

  /**
   * 显示加载状态
   */
  private showLoading(): void {
    this.requestCount++
    if (!this.loadingInstance) {
      this.loadingInstance = ElLoading.service({
        lock: true,
        text: '加载中...',
        background: 'rgba(0, 0, 0, 0.7)'
      })
    }
  }

  /**
   * 隐藏加载状态
   */
  private hideLoading(): void {
    this.requestCount = Math.max(0, this.requestCount - 1)
    if (this.requestCount === 0 && this.loadingInstance) {
      this.loadingInstance.close()
      this.loadingInstance = null
    }
  }

  /**
   * 生成请求ID
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * 生成缓存键
   */
  private generateCacheKey(config: any): string {
    const { method, url, params, data } = config
    return `${method?.toUpperCase() || 'GET'}:${url}:${JSON.stringify(params || {})}:${JSON.stringify(data || {})}`
  }

  /**
   * 获取有效的JWT Token（浏览器兼容版本）
   */
  private getValidToken(): string | null {
    const invalidTokenMarkers = new Set(['', 'null', 'undefined'])
    const decodeBase64Url = (value: string): string => {
      const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
      const padding = normalized.length % 4
      const padded = padding === 0 ? normalized : normalized + '='.repeat(4 - padding)
      return atob(padded)
    }

    let token = null;
    let tokenSource = '';

    // 尝试从多个来源获取token，按优先级顺序
    // 1. sessionStorage access_token (认证存储)
    token = storage.get<string>('access_token', 'session');
    if (token) {
      tokenSource = 'sessionStorage (access_token)';
    }

    // 2. sessionStorage tf2025_token (兼容旧版本)
    if (!token) {
      token = storage.getToken()
      if (token) {
        tokenSource = 'sessionStorage (tf2025_token)';
      }
    }

    // 3. localStorage (持久化存储)
    if (!token) {
      try {
        const authData = storage.getAuth()
        if (authData) {
          token = (authData as any).token || (authData as any).accessToken || null;
          if (token) {
            tokenSource = 'localStorage (tf2025_auth)';
          }
        }
      } catch (error) {
        logger.warn('解析localStorage认证数据失败', error)
        // 不清除数据，让其他来源有机会提供token
      }
    }

    // 调试信息：显示token来源（用于跨浏览器问题排查）
    // 已移除调试日志

    // 验证token格式
    if (!token) {
      return null;
    }

    if (invalidTokenMarkers.has(String(token).trim().toLowerCase())) {
      this.clearAuthData();
      return null;
    }

    // 验证JWT格式 (应该包含3个部分，用.分隔)
    const parts = token.split('.');
    if (parts.length !== 3) {
      logger.warn(`Token格式无效（包含${parts.length}个部分，应该为3个），来源: ${tokenSource}`)
      this.clearAuthData();
      return null;
    }

    // 验证JWT格式的有效性（只验证header和payload部分）
    // 使用try-catch包裹，防止某些浏览器不支持atob
    try {
      // JWT的header和payload应该是base64编码的
      const [header, payload] = parts;

      // 检查浏览器是否支持atob
      if (typeof atob === 'function') {
        // JWT 使用 base64url 编码，不能直接把原始片段传给 atob
        decodeBase64Url(header)
        decodeBase64Url(payload)
      } else {
        // 降级处理：只检查不为空
        if (!header || !payload) {
          throw new Error('JWT header或payload为空');
        }
      }

      // signature部分不需要base64验证，它是加密签名
    } catch (error) {
      logger.warn(`JWT格式验证失败，清除认证数据 (来源: ${tokenSource})`, error instanceof Error ? error.message : error)
      this.clearAuthData();
      return null;
    }

    return token;
  }

  /**
   * 清除认证数据
   */
  private clearAuthData(): void {
    storage.remove('access_token', 'session')
    storage.remove(AUTH_STORAGE_KEYS.TOKEN, 'session')
    storage.remove(AUTH_STORAGE_KEYS.AUTH, 'local')
  }

  /**
   * 记录性能数据
   */
  private recordPerformance(metadata: any, duration: number, status: number): void {
    if (window.__TF2025_PERFORMANCE__) {
      window.__TF2025_PERFORMANCE__.recordMetric('apiRequest', {
        requestId: metadata.requestId,
        url: metadata.url,
        method: metadata.method,
        duration,
        status,
        timestamp: Date.now()
      })
    }
  }

  /**
   * GET请求
   */
  get<T = any>(url: string, config?: RequestConfig): Promise<ApiResponse<T>> {
    return this.instance.get(url, config)
  }

  /**
   * POST请求
   */
  post<T = any>(url: string, data?: any, config?: RequestConfig): Promise<ApiResponse<T>> {
    return this.instance.post(url, data, config)
  }

  /**
   * PUT请求
   */
  put<T = any>(url: string, data?: any, config?: RequestConfig): Promise<ApiResponse<T>> {
    return this.instance.put(url, data, config)
  }

  /**
   * DELETE请求
   */
  delete<T = any>(url: string, config?: RequestConfig): Promise<ApiResponse<T>> {
    return this.instance.delete(url, config)
  }

  /**
   * PATCH请求
   */
  patch<T = any>(url: string, data?: any, config?: RequestConfig): Promise<ApiResponse<T>> {
    return this.instance.patch(url, data, config)
  }

  /**
   * 上传文件
   */
  upload<T = any>(url: string, formData: FormData, config?: RequestConfig): Promise<ApiResponse<T>> {
    return this.instance.post(url, formData, {
      ...config,
      headers: {
        'Content-Type': 'multipart/form-data',
        ...config?.headers
      }
    })
  }

  /**
   * 下载文件
   */
  download(url: string, filename?: string, config?: RequestConfig): Promise<void> {
    return this.instance.get(url, {
      ...config,
      responseType: 'blob'
    }).then((response: any) => {
      const blob = new Blob([response])
      const downloadUrl = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = downloadUrl
      link.download = filename || 'download'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(downloadUrl)
    })
  }

  /**
   * 清除缓存
   */
  clearCache(): void {
    this.cache.clear()
  }

  /**
   * 获取Axios实例（用于特殊需求）
   */
  getInstance(): AxiosInstance {
    return this.instance
  }
}

// 创建全局统一API实例
export const unifiedApi = new UnifiedApiManager()

// 兼容性导出
export { unifiedApi as api }

export default unifiedApi
