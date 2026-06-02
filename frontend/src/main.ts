import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
// Element Plus 按需导入由 unplugin 自动处理
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

// 导入CSRF/XSRF防护系统
import { initCSRFProtection } from '@/utils/csrf'

// 导入站点设置
import { initializeSiteSettings } from '@/stores/siteSettings'

// 导入 Iconify 工具
import { waitForIconify } from '@/utils/iconify'
import { enhanceGlobalMessageBox } from '@/utils/message-box'
import logger from '@/utils/logger'

// 导入 Token 过期检测
import { startTokenExpiryCheck } from '@/utils/token-expiry-check'

// 移除开发环境模拟认证，使用真实登录

const app = createApp(App)

// 统一增强 Element Plus 确认弹框。延后到空闲时执行，避免首屏同步加载 Element Plus 服务。
setTimeout(() => {
  enhanceGlobalMessageBox()
}, 0)

// 使用Pinia状态管理
const pinia = createPinia()
app.use(pinia)

// 使用路由
app.use(router)

// 注册全局API服务
app.config.globalProperties.$api = unifiedApi
app.provide('api', unifiedApi)

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

    // 初始化 Composable 工具集。该入口会导出较多工具，延后加载避免撑大首屏包。
    setTimeout(async () => {
      try {
        const { ComposableToolkit } = await import('@/composables')
        ComposableToolkit.init()
      } catch (error) {
        // Composable工具集初始化失败，静默处理
      }
    }, 150)

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
    setTimeout(async () => {
      try {
        const { performanceMonitor } = await import('@/utils/performanceMonitor')
        if (window.__TF2025__) {
          window.__TF2025__.performance = performanceMonitor
        }
        performanceMonitor.startMonitoring()
      } catch (error) {
        // 性能监控启动失败，静默处理
      }
    }, 300)

    // 注册全局组件
    setTimeout(async () => {
      try {
        const { registerGlobalComponents } = await import('@/components/index')
        await registerGlobalComponents(app)
      } catch (error) {
        // 全局组件注册失败，静默处理
      }
    }, 350)

    // 滚动动画延后初始化
    setTimeout(async () => {
      try {
        const { initScrollAnimations } = await import('@/utils/scrollAnimation')
        initScrollAnimations()
      } catch (error) {
        // 滚动动画初始化失败，静默处理
      }
    }, 400)

    // 站点设置作为全局公共信息，只初始化一次，避免登录页/路由标题重复触发请求
    initializeSiteSettings().catch(() => {
      // 站点设置初始化失败，静默处理
    })

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
