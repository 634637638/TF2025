import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
// Element Plus 按需导入由 unplugin 自动处理
// 导入中文语言包和日期格式化
import zhCn from 'element-plus/dist/locale/zh-cn.mjs'
import 'dayjs/locale/zh-cn'
// 导入中文语言包和日期格式化
import './styles.scss'
import './styles/responsive.scss'
import './styles/permission-toast.scss'
import './styles/admin-layout.css'

// 配置 dayjs 中文（如果项目使用 dayjs）
import dayjs from 'dayjs'
dayjs.locale('zh-cn')

// 导入安全工具
import { vSanitize, vEscapeHtml, initCSPReporting } from '@/utils/security'

// 导入全局指令系统
import { installDirectives } from '@/directives'
// 导入友好版权限提示指令
import { setupPermissionTipDirective } from '@/directives/permissionTip'

// 注册安全指令
const installSecurityDirectives = (app: any) => {
  app.directive('sanitize', vSanitize)
  app.directive('escape-html', vEscapeHtml)
}

// 导入全局Loading系统
import { LoadingPlugin } from '@/utils/loading'

// 导入全局时间工具
import { TimePlugin } from '@/utils/time'

// 导入全局错误边界系统
import { ErrorBoundaryPlugin } from '@/utils/error-boundary'

// 导入错误日志系统
import { globalErrorLogger } from '@/utils/error-logger'

// 导入统一API系统
import { unifiedApi } from '@/utils/unified-api'

// 导入统一通知系统
import { NotificationPlugin } from '@/plugins/notification'

// 导入全局组件注册系统
import { registerGlobalComponents } from '@/components/index'

// 导入全局Composable工具集
import { ComposableToolkit } from '@/composables'

// 导入CSRF/XSRF防护系统
import { initCSRFProtection } from '@/utils/csrf'

// 导入站点设置
import { useSiteSettingsStore } from '@/stores/siteSettings'

// 导入全局性能监控系统
import { PerformancePlugin, performanceMonitor } from '@/utils/performanceMonitor'

// 导入滚动动画系统
import { initScrollAnimations } from '@/utils/scrollAnimation'

// 导入 Iconify 工具
import { waitForIconify } from '@/utils/iconify'
import { enhanceGlobalMessageBox } from '@/utils/message-box'
import logger from '@/utils/logger'

// 导入动态权限系统
import { dynamicPermissionService } from '@/services/permissions'

// 导入 Token 过期检测
import { startTokenExpiryCheck } from '@/utils/token-expiry-check'

// 移除开发环境模拟认证，使用真实登录

const app = createApp(App)

// 统一增强 Element Plus 确认弹框
enhanceGlobalMessageBox()

// 使用Pinia状态管理
const pinia = createPinia()
app.use(pinia)

// 使用路由
app.use(router)

// 注册全局API服务
app.config.globalProperties.$api = unifiedApi
app.provide('api', unifiedApi)

// 配置 Element Plus 中文语言包（适用于按需导入）
// 注意：unplugin-auto-import 会自动处理组件导入，但语言包需要手动配置
// 在每个使用日期选择器的地方手动添加 :locale="zh-cn"
// 或者使用全局配置方式（需要安装完整版 Element Plus）

// 为确保所有 Element Plus 组件使用中文，创建一个全局配置对象
if (typeof window !== 'undefined') {
  ;(window as any).__ELEMENT_PLUS_LOCALE__ = zhCn
}

// 安装全局指令系统
installDirectives(app)

// 安装友好版权限提示指令
setupPermissionTipDirective(app)

// 安装安全指令
installSecurityDirectives(app)

// 安装全局Loading系统
app.use(LoadingPlugin, {
  maxConcurrent: 10,
  enableGlobalLoading: true,
  enableProgress: true,
  defaultDelay: 0,
  defaultMinDuration: 0,
  taskTimeout: 60000
})

// 安装全局时间工具
app.use(TimePlugin)

// 安装全局错误边界系统
app.use(ErrorBoundaryPlugin, {
  enabled: true,
  maxErrors: 100,
  enableConsoleLog: true,
  enableReporting: false,
  autoRetry: true,
  maxRetries: 3
})

// 安装统一通知系统
app.use(NotificationPlugin, {
  duration: 4000,
  showClose: true,
  persistent: false,
  position: 'top-center'
})

// 安装全局性能监控系统
app.use(PerformancePlugin)

// 简化的应用初始化 - 专注于动态路由
const initializeApp = async () => {
  try {
    // 立即挂载应用，减少首屏等待时间
    app.mount('#app')

    // 非关键初始化延后执行
    setTimeout(async () => {
      try {
        // 等待 Iconify 加载
        await waitForIconify(5000)
      } catch (error) {
        // Iconify 加载失败，静默处理
      }
    }, 100)

    // 初始化Composable工具集
    try {
      ComposableToolkit.init()
    } catch (error) {
      // Composable工具集初始化失败，静默处理
    }

    // CSRF 初始化延后
    setTimeout(async () => {
      try {
        await initCSRFProtection({
          enableAutoRefresh: true,
          enableStorage: true,
          enableDoubleCookie: true
        })
      } catch (error) {
        // CSRF防护初始化失败，静默处理
      }
    }, 200)

    // 初始化CSP违规监控
    try {
      initCSPReporting()
    } catch (error) {
      // CSP违规监控初始化失败，静默处理
    }

    // 权限系统已临时禁用

    // 启动 Token 过期检测
    try {
      startTokenExpiryCheck()
    } catch (error) {
      // Token 过期检测启动失败，静默处理
    }

    // 性能监控延后初始化
    setTimeout(() => {
      try {
        performanceMonitor.startMonitoring()
      } catch (error) {
        // 性能监控启动失败，静默处理
      }
    }, 300)

    // 注册全局组件
    try {
      await registerGlobalComponents(app)
    } catch (error) {
      // 全局组件注册失败，静默处理
    }

    // 滚动动画延后初始化
    setTimeout(() => {
      try {
        initScrollAnimations()
      } catch (error) {
        // 滚动动画初始化失败，静默处理
      }
    }, 400)

    // 站点设置初始化延后
    setTimeout(async () => {
      try {
        const siteSettingsStore = useSiteSettingsStore()
        await siteSettingsStore.loadSiteSettings()
      } catch (error) {
        // 站点设置初始化失败，静默处理
      }
    }, 500)

    // 添加到全局状态
    if (window.__TF2025__) {
      window.__TF2025__.api = unifiedApi
      window.__TF2025__.errorLogger = globalErrorLogger
      // 注册全局状态管理（store系统）
      window.__TF2025__.stores = {
        auth: null, // 将在store初始化后设置
        app: null,
        loading: null,
        message: null
      }
    }

    // 抑制 ResizeObserver 警告（Element Plus 对话框等组件的常见问题）
    window.addEventListener('error', (e) => {
      if (e.message === 'ResizeObserver loop completed with undelivered notifications.' ||
          e.message === 'ResizeObserver loop limit exceeded') {
        e.stopImmediatePropagation();
        e.preventDefault();
      }
    });

    // 抑制未处理的 Promise rejection 中的 ResizeObserver 警告
    window.addEventListener('unhandledrejection', (e) => {
      if (e.reason?.message === 'ResizeObserver loop completed with undelivered notifications.' ||
          e.reason?.message === 'ResizeObserver loop limit exceeded') {
        e.stopImmediatePropagation();
        e.preventDefault();
      }
    });

    // 应用初始化完成

  } catch (error) {
    logger.error('应用初始化失败', error)
  }
}

// 启动应用
initializeApp()

// 导出app实例供其他地方使用
export default app
