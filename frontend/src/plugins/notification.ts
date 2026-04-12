/**
 * Vue 通知插件
 * 将通知服务全局注册，方便在所有组件中使用
 */

import type { App } from 'vue'
import { simpleNotification } from '@/services/notification-simple'
import type { NotificationOptions, NotificationConfig } from '@/services/notification-simple'

// 扩展 Vue 组件实例类型
declare module '@vue/runtime-core' {
  interface ComponentCustomProperties {
    $success: (message: string, options?: NotificationOptions) => void
    $error: (message: string, options?: NotificationOptions) => void
    $warning: (message: string, options?: NotificationOptions) => void
    $info: (message: string, options?: NotificationOptions) => void
    $confirm: (message: string, title?: string, options?: any) => Promise<boolean>
    $alert: (message: string, title?: string, type?: string) => Promise<void>
  }
}

export const NotificationPlugin = {
  install(app: App, options: NotificationConfig = {}) {
    // 设置默认配置
    simpleNotification.setDefaultConfig(options)

    // 便捷方法
    app.config.globalProperties.$success = (message: string, opts?: NotificationOptions) => {
      simpleNotification.success(message, opts)
    }

    app.config.globalProperties.$error = (message: string, opts?: NotificationOptions) => {
      simpleNotification.error(message, opts)
    }

    app.config.globalProperties.$warning = (message: string, opts?: NotificationOptions) => {
      simpleNotification.warning(message, opts)
    }

    app.config.globalProperties.$info = (message: string, opts?: NotificationOptions) => {
      simpleNotification.info(message, opts)
    }

    app.config.globalProperties.$confirm = (message: string, title?: string, opts?: any) => {
      return simpleNotification.confirm(message, title, opts)
    }

    app.config.globalProperties.$alert = (message: string, title?: string, type?: string) => {
      return simpleNotification.alert(message, title, type as any)
    }

    // 提供服务
    app.provide('notification', simpleNotification)
  }
}

export default NotificationPlugin