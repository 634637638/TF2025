/**
 * TF2025 简化通知服务
 * 专门用于在应用启动时避免 Pinia 初始化问题
 */

import { ElMessage, ElMessageBox, ElNotification, ElLoading } from 'element-plus'
import { logger } from '@/utils/logger'

// 通知方式枚举
export enum NotificationMethod {
  ELEMENT_PLUS = 'element-plus',
  MESSAGE_STORE = 'message-store',
  COMPOSABLE = 'composable',
  AUTO = 'auto'
}

// 通知配置接口
export interface NotificationConfig {
  method?: NotificationMethod
  duration?: number
  showClose?: boolean
  persistent?: boolean
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center' | 'bottom-center'
}

// 通知选项接口
export interface NotificationOptions {
  title?: string
  message?: string
  type?: 'success' | 'error' | 'warning' | 'info'
  duration?: number
  showClose?: boolean
  persistent?: boolean
  position?: string
  center?: boolean
  offset?: number
  customClass?: string
  zIndex?: number
  dangerouslyUseHTMLString?: boolean
}

const DEFAULT_MESSAGE_Z_INDEX = 6000
const DEFAULT_MESSAGE_CLASS = 'tf-global-message'

class SimpleNotificationService {
  private static instance: SimpleNotificationService
  private defaultConfig: NotificationConfig
  private dynamicStyleTag: HTMLStyleElement | null = null

  private constructor() {
    this.defaultConfig = {
      method: NotificationMethod.ELEMENT_PLUS,  // 默认使用 Element Plus
      duration: 4000,
      showClose: true,
      persistent: false,
      position: 'top-right'
    }
  }

  /**
   * 创建动态样式标签来隐藏表格
   */
  private createHideTablesStyle() {
    if (this.dynamicStyleTag) return

    this.dynamicStyleTag = document.createElement('style')
    this.dynamicStyleTag.id = 'message-box-hide-tables'
    this.dynamicStyleTag.textContent = `
      .el-message-box-open .comprehensive-warnings,
      .el-message-box-open .el-table,
      .el-message-box-open .el-table__fixed,
      .el-message-box-open .el-table__fixed-right,
      .el-message-box-open .el-table__fixed-left {
        display: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
        z-index: -9999 !important;
      }
    `
    document.head.appendChild(this.dynamicStyleTag)
  }

  /**
   * 移除动态样式标签
   */
  private removeHideTablesStyle() {
    if (this.dynamicStyleTag) {
      document.head.removeChild(this.dynamicStyleTag)
      this.dynamicStyleTag = null
    }
  }

  /**
   * 获取单例实例
   */
  public static getInstance(): SimpleNotificationService {
    if (!SimpleNotificationService.instance) {
      SimpleNotificationService.instance = new SimpleNotificationService()
    }
    return SimpleNotificationService.instance
  }

  /**
   * 设置默认配置
   */
  public setDefaultConfig(config: Partial<NotificationConfig>): void {
    this.defaultConfig = { ...this.defaultConfig, ...config }
  }

  /**
   * 获取默认配置
   */
  public getDefaultConfig(): NotificationConfig {
    return { ...this.defaultConfig }
  }

  /**
   * 显示成功消息
   */
  public success(message: string, options: NotificationOptions = {}): void {
    ElMessage.success({
      message,
      duration: options.duration || this.defaultConfig.duration,
      showClose: options.showClose ?? this.defaultConfig.showClose,
      offset: options.offset || 20,
      customClass: options.customClass || DEFAULT_MESSAGE_CLASS,
      zIndex: options.zIndex || DEFAULT_MESSAGE_Z_INDEX,
      appendTo: document.body
    } as any)
  }

  /**
   * 显示错误消息
   */
  public error(message: string, options: NotificationOptions = {}): void {
    ElMessage.error({
      message,
      duration: options.duration || 6000,  // 错误消息默认显示更久
      showClose: options.showClose ?? this.defaultConfig.showClose,
      offset: options.offset || 20,
      customClass: options.customClass || DEFAULT_MESSAGE_CLASS,
      zIndex: options.zIndex || DEFAULT_MESSAGE_Z_INDEX,
      appendTo: document.body
    } as any)
  }

  /**
   * 显示警告消息
   */
  public warning(message: string, options: NotificationOptions = {}): void {
    ElMessage.warning({
      message,
      duration: options.duration || this.defaultConfig.duration,
      showClose: options.showClose ?? this.defaultConfig.showClose,
      offset: options.offset || 20,
      customClass: options.customClass || DEFAULT_MESSAGE_CLASS,
      zIndex: options.zIndex || DEFAULT_MESSAGE_Z_INDEX,
      appendTo: document.body
    } as any)
  }

  /**
   * 显示信息消息
   */
  public info(message: string, options: NotificationOptions = {}): void {
    ElMessage.info({
      message,
      duration: options.duration || this.defaultConfig.duration,
      showClose: options.showClose ?? this.defaultConfig.showClose,
      offset: options.offset || 20,
      customClass: options.customClass || DEFAULT_MESSAGE_CLASS,
      zIndex: options.zIndex || DEFAULT_MESSAGE_Z_INDEX,
      appendTo: document.body
    } as any)
  }

  /**
   * 显示通知（更丰富的通知形式）
   */
  public notify(options: NotificationOptions): void {
    ElNotification({
      title: options.title,
      message: options.message,
      type: options.type as any,
      duration: options.duration || this.defaultConfig.duration,
      position: options.position as any || (this.defaultConfig.position as any),
      showClose: options.showClose ?? this.defaultConfig.showClose,
      customClass: options.customClass || DEFAULT_MESSAGE_CLASS,
      zIndex: options.zIndex || DEFAULT_MESSAGE_Z_INDEX
    })
  }

  /**
   * 显示确认对话框
   */
  public confirm(
    message: string,
    title: string = '确认',
    options: {
      confirmButtonText?: string
      cancelButtonText?: string
      type?: 'success' | 'warning' | 'info' | 'error'
    } = {}
  ): Promise<boolean> {
    // 添加 class 和动态样式来隐藏表格
    document.body.classList.add('el-message-box-open')
    this.createHideTablesStyle()

    return ElMessageBox.confirm(message, title, {
      confirmButtonText: options.confirmButtonText || '确定',
      cancelButtonText: options.cancelButtonText || '取消',
      type: options.type || 'warning',
      appendTo: document.body  // 确保渲染到 body 下
    })
      .then(() => {
        document.body.classList.remove('el-message-box-open')
        this.removeHideTablesStyle()
        return true
      })
      .catch(() => {
        document.body.classList.remove('el-message-box-open')
        this.removeHideTablesStyle()
        return false
      })
  }

  /**
   * 显示提示对话框
   */
  public alert(
    message: string,
    title: string = '提示',
    type: 'success' | 'warning' | 'info' | 'error' = 'info'
  ): Promise<void> {
    // 添加 class 和动态样式来隐藏表格
    document.body.classList.add('el-message-box-open')
    this.createHideTablesStyle()

    return ElMessageBox.alert(message, title, {
      type,
      appendTo: document.body  // 确保渲染到 body 下
    })
      .then(() => {
        document.body.classList.remove('el-message-box-open')
        this.removeHideTablesStyle()
      })
      .catch(() => {
        document.body.classList.remove('el-message-box-open')
        this.removeHideTablesStyle()
      })
  }

  /**
   * 显示输入对话框
   */
  public prompt(
    message: string,
    title: string = '输入',
    options: {
      confirmButtonText?: string
      cancelButtonText?: string
      inputType?: string
      inputPlaceholder?: string
      inputValue?: string
    } = {}
  ): Promise<{ value: string } | null> {
    // 添加 class 和动态样式来隐藏表格
    document.body.classList.add('el-message-box-open')
    this.createHideTablesStyle()

    return ElMessageBox.prompt(message, title, {
      confirmButtonText: options.confirmButtonText || '确定',
      cancelButtonText: options.cancelButtonText || '取消',
      inputType: options.inputType || 'text',
      inputPlaceholder: options.inputPlaceholder,
      inputValue: options.inputValue,
      appendTo: document.body  // 确保渲染到 body 下
    })
      .then(({ value }) => {
        document.body.classList.remove('el-message-box-open')
        this.removeHideTablesStyle()
        return { value }
      })
      .catch(() => {
        document.body.classList.remove('el-message-box-open')
        this.removeHideTablesStyle()
        return null
      })
  }

  /**
   * 处理API错误的专用方法
   */
  public handleApiError(error: any, defaultMessage: string = '操作失败'): void {
    logger.error('API Error:', error)

    let message = defaultMessage

    // 解析错误响应
    if (error?.response?.data?.message) {
      message = error.response.data.message
    } else if (error?.response?.data?.errors?.length > 0) {
      message = error.response.data.errors.join('; ')
    } else if (error?.message) {
      message = error.message
    }

    // 根据HTTP状态码调整消息
    if (error?.response?.status) {
      switch (error.response.status) {
        case 400:
          message = error?.response?.data?.message || '请求参数错误'
          break
        case 401:
          message = '登录已过期，请重新登录'
          break
        case 403:
          message = '权限不足，无法执行此操作'
          break
        case 404:
          message = '请求的资源不存在'
          break
        case 409:
          // 409 Conflict - 直接使用后端返回的冲突消息
          message = error?.response?.data?.message || message
          break
        case 422:
          message = '数据验证失败：' + message
          break
        case 500:
          message = '服务器内部错误，请稍后重试'
          break
        case 502:
          message = '网关错误，请稍后重试'
          break
        case 503:
          message = '服务暂时不可用，请稍后重试'
          break
      }
    }

    this.error(message, { title: '操作失败' })
  }

  /**
   * 处理API成功响应的专用方法
   */
  public handleApiSuccess(response: any, defaultMessage: string = '操作成功'): void {
    const message = response?.message || defaultMessage
    this.success(message, { title: '操作成功' })
  }

  /**
   * 清除所有通知
   */
  public clearAll(): void {
    ElMessage.closeAll()
  }

  /**
   * 加载状态通知
   */
  public loading(message: string = '加载中...'): () => void {
    const loadingInstance = ElLoading.service({
      lock: true,
      text: message,
      background: 'rgba(0, 0, 0, 0.7)'
    })

    // 返回关闭函数
    return () => {
      loadingInstance.close()
    }
  }

  /**
   * 显示进度通知
   */
  public progress(
    message: string,
    progress: number,
    options: NotificationOptions = {}
  ): void {
    this.notify({
      title: options.title || '进度',
      message: `${message}: ${progress}%`,
      type: 'info',
      duration: 0,
      ...options
    })
  }
}

// 导出单例实例
export const simpleNotification = SimpleNotificationService.getInstance()

// 默认导出服务类
export default SimpleNotificationService
