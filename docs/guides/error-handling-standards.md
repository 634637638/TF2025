# TF2025 错误处理规范

## 📋 概述

TF2025 项目采用多层次的错误处理机制，包括全局错误边界、统一错误处理、用户友好的错误提示和完整的错误日志系统。该规范确保了应用的稳定性、用户体验的一致性和问题的可追踪性。

## 🎯 设计原则

1. **用户友好**：提供清晰、可操作的错误提示
2. **系统稳定**：防止未捕获错误导致应用崩溃
3. **可追踪性**：完整的错误日志和上下文信息
4. **一致性**：统一的错误处理模式和展示方式
5. **渐进增强**：优雅降级，提供备选方案

## 🏗️ 错误处理架构

### 错误处理层次

```
错误处理架构
├── 全局错误边界 (Global Error Boundaries)
│   ├── Vue 错误捕获
│   ├── Promise 错误捕获
│   └── 未捕获异常处理
├── API 错误处理 (API Error Handling)
│   ├── HTTP 状态码处理
│   ├── 网络错误处理
│   └── 业务逻辑错误
├── 组件级错误处理 (Component Error Handling)
│   ├── 错误边界组件
│   ├── 异步错误捕获
│   └── 表单验证错误
└── 用户反馈系统 (User Feedback)
    ├── 错误提示组件
    ├── 错误页面
    └── 错误上报机制
```

## 🚨 全局错误处理

### 1. Vue 错误边界

```typescript
// main.ts - 全局错误处理
app.config.errorHandler = (error, instance, info) => {
  console.error('Vue Error:', error)
  console.error('Component Instance:', instance)
  console.error('Error Info:', info)

  // 记录错误
  logger.error('Vue应用错误', {
    error: error.message,
    stack: error.stack,
    component: instance?.$options.name,
    info
  })

  // 显示用户友好提示
  showErrorToast('应用遇到错误，请刷新页面重试')
}

// 处理未捕获的 Promise 错误
window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled Promise Rejection:', event.reason)

  logger.error('未处理的Promise错误', {
    reason: event.reason,
    promise: event.promise
  })

  // 阻止默认的控制台错误输出
  event.preventDefault()

  // 显示错误提示
  showErrorToast('操作失败，请重试')
})
```

### 2. 错误边界组件

```vue
<!-- ErrorBoundary.vue -->
<template>
  <div v-if="hasError" class="error-boundary">
    <el-result
      icon="error"
      title="页面遇到错误"
      :sub-title="errorMessage"
    >
      <template #extra>
        <el-button type="primary" @click="handleRetry">
          重试
        </el-button>
        <el-button @click="handleGoHome">
          返回首页
        </el-button>
      </template>
    </el-result>
  </div>
  <slot v-else />
</template>

<script setup lang="ts">
import { ref, onErrorCaptured } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const hasError = ref(false)
const errorMessage = ref('')

// 捕获子组件错误
onErrorCaptured((error: Error, instance, info) => {
  console.error('组件错误捕获:', error)

  hasError.value = true
  errorMessage.value = error.message || '未知错误'

  // 记录错误
  logger.error('组件错误', {
    error: error.message,
    stack: error.stack,
    component: instance?.$options.name,
    info
  })

  // 阻止错误继续向上传播
  return false
})

const handleRetry = () => {
  hasError.value = false
  errorMessage.value = ''
}

const handleGoHome = () => {
  router.push('/')
}
</script>

<style lang="scss" scoped>
.error-boundary {
  padding: 40px 20px;
  text-align: center;
}
</style>
```

### 3. 路由级错误处理

```typescript
// router/index.ts
router.onError((error) => {
  console.error('路由错误:', error)

  // 根据错误类型进行不同处理
  if (error.name === 'ChunkLoadError') {
    // 代码块加载失败
    showErrorToast('资源加载失败，正在刷新页面...')
    window.location.reload()
  } else {
    // 其他路由错误
    showErrorToast('页面加载失败，请重试')
    router.push('/error')
  }
})
```

## 🔌 API 错误处理

### 1. HTTP 状态码处理

```typescript
// utils/unified-api.ts - 响应拦截器
unifiedApi.interceptors.response.use(
  (response) => {
    return response.data
  },
  (error) => {
    const { response, request, code, message } = error

    if (response) {
      // 服务器响应了错误状态码
      handleHttpError(response)
    } else if (request) {
      // 请求已发出但没有响应
      handleNetworkError(message || code || '网络错误')
    } else {
      // 请求配置错误
      handleRequestError(message || '请求配置错误')
    }

    return Promise.reject(error)
  }
)

// HTTP 状态码处理函数
const handleHttpError = (response: AxiosResponse) => {
  const { status, data } = response
  const { success = false, message: serverMsg } = data || {}

  switch (status) {
    case 400:
      handleValidationError(serverMsg || '请求参数错误')
      break

    case 401:
      handleAuthError()
      break

    case 403:
      handleError('权限不足', '您没有执行此操作的权限', 'warning')
      break

    case 404:
      handleError('资源不存在', `请求的资源${response.config?.url ? ` (${response.config.url})` : ''}未找到`, 'error')
      break

    case 408:
      handleError('请求超时', '请求超时，请检查网络连接并重试', 'warning')
      break

    case 409:
      handleError('请求冲突', '请求的数据已被其他操作修改', 'warning')
      break

    case 422:
      handleValidationError(serverMsg || '数据验证失败', data?.errors)
      break

    case 429:
      handleError('请求过于频繁', '请求过于频繁，请稍后再试', 'warning')
      break

    case 500:
      handleServerError(serverMsg || '服务器内部错误')
      break

    case 502:
      handleError('网关错误', '网关错误，服务暂时不可用', 'warning')
      break

    case 503:
      handleError('服务不可用', '服务正在维护中，请稍后重试', 'warning')
      break

    case 504:
      handleError('网关超时', '网关响应超时，请稍后重试', 'warning')
      break

    default:
      handleError('未知错误', `请求失败 (${status})`, 'error')
  }
}

// 统一错误处理函数
const handleError = (
  title: string,
  message: string,
  type: 'error' | 'warning' | 'info' = 'error',
  details?: any
) => {
  // 记录错误日志
  logger.error(title, { message, details })

  // 使用统一通知服务显示用户友好的错误提示
  if (type === 'error') {
    error(title, message)
  } else if (type === 'warning') {
    warning(title, message)
  } else {
    info(title, message)
  }

  // 上报错误
  errorReporter.report(new Error(message), {
    title,
    type,
    details
  })
}

// 特殊处理：验证错误
const handleValidationError = (message: string, errors?: Record<string, string[]>) => {
  if (errors && Object.keys(errors).length > 0) {
    const errorMessages = Object.entries(errors)
      .flatMap(([field, messages]) => messages.map(msg => `${field}: ${msg}`))
      .join('\n')

    handleError('数据验证失败', errorMessages, 'warning')
  } else {
    handleError('数据验证失败', message, 'warning')
  }
}

// 特殊处理：服务器错误
const handleServerError = (message: string) => {
  // 检查是否是可重试的错误
  const retryableErrors = [
    '数据库连接失败',
    '服务器暂时繁忙',
    '服务暂时不可用'
  ]

  const isRetryable = retryableErrors.some(err => message.includes(err))

  if (isRetryable) {
    handleError('服务器繁忙', message, 'warning')
  } else {
    handleError('服务器错误', message, 'error')
  }
}
```

### 2. 认证错误处理

```typescript
const handleAuthError = () => {
  // 清除认证信息
  clearAuthTokens()

  // 显示提示
  warning('登录已过期，请重新登录')

  // 跳转到登录页
  router.push({
    path: '/login',
    query: { redirect: router.currentRoute.value.fullPath }
  })
}
```

### 3. 验证错误处理

```typescript
const handleValidationError = (errors: Record<string, string[]>) => {
  const errorMessages = Object.entries(errors)
    .flatMap(([field, messages]) => messages.map(msg => `${field}: ${msg}`))
    .join('; ')

  handleError('数据验证失败', errorMessages)

  // 返回详细的验证错误供组件使用
  throw new ValidationError(errors)
}
```

### 4. 网络错误处理

```typescript
const handleNetworkError = (message: string) => {
  if (message.includes('timeout')) {
    handleError('请求超时', '网络请求超时，请检查网络连接')
  } else if (message.includes('Network Error')) {
    handleError('网络错误', '网络连接失败，请检查网络设置')
  } else {
    handleError('网络错误', '网络请求失败，请稍后重试')
  }
}
```

## 🎨 用户反馈组件

### 1. 错误提示服务

```typescript
// composables/useErrorHandler.ts
import { useNotification } from '@/composables/useNotification'

export const useErrorHandler = () => {
  const { success, error, warning, info } = useNotification()

  const showError = (message: string, details?: string) => {
    console.error('Error:', message, details)
    error(message, {
      title: '错误',
      duration: 6000,
      showClose: true
    })
  }

  const showWarning = (message: string, details?: string) => {
    console.warn('Warning:', message, details)
    warning(message, {
      title: '警告',
      duration: 5000
    })
  }

  const showSuccess = (message: string) => {
    success(message, {
      title: '成功'
    })
  }

  const showInfo = (message: string) => {
    info(message, {
      title: '提示'
    })
  }

  return {
    showError,
    showWarning,
    showSuccess,
    showInfo
  }
}
```

### 2. 错误页面组件

```vue
<!-- ErrorPage.vue -->
<template>
  <div class="error-page">
    <el-result
      :icon="getErrorIcon()"
      :title="errorTitle"
      :sub-title="errorMessage"
    >
      <template #extra>
        <el-space>
          <el-button type="primary" @click="handleRetry">
            重试
          </el-button>
          <el-button @click="handleGoHome">
            返回首页
          </el-button>
          <el-button v-if="showContact" @click="handleContact">
            联系技术支持
          </el-button>
        </el-space>
      </template>
    </el-result>

    <!-- 错误详情（开发环境） -->
    <div v-if="isDev && errorDetails" class="error-details">
      <el-collapse>
        <el-collapse-item title="错误详情">
          <pre>{{ errorDetails }}</pre>
        </el-collapse-item>
      </el-collapse>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

interface Props {
  errorType?: 'network' | '404' | '403' | '500' | 'custom'
  title?: string
  message?: string
  details?: string
}

const props = withDefaults(defineProps<Props>(), {
  errorType: 'custom'
})

const route = useRoute()
const router = useRouter()
const isDev = import.meta.env.DEV

const errorTitle = computed(() => {
  if (props.title) return props.title

  const titles = {
    network: '网络连接错误',
    404: '页面未找到',
    403: '访问被拒绝',
    500: '服务器错误',
    custom: '发生错误'
  }

  return titles[props.errorType] || titles.custom
})

const errorMessage = computed(() => {
  if (props.message) return props.message

  const messages = {
    network: '请检查您的网络连接并重试',
    404: '您访问的页面不存在',
    403: '您没有权限访问此页面',
    500: '服务器遇到了一些问题',
    custom: '应用遇到了意外错误'
  }

  return messages[props.errorType] || messages.custom
})

const errorDetails = computed(() => {
  return props.details || route.query.error as string
})

const showContact = computed(() => {
  return props.errorType === '500' || props.errorType === 'custom'
})

const getErrorIcon = () => {
  const icons = {
    network: 'warning',
    404: 'error',
    403: 'warning',
    500: 'error',
    custom: 'error'
  }

  return icons[props.errorType] || 'error'
}

const handleRetry = () => {
  window.location.reload()
}

const handleGoHome = () => {
  router.push('/')
}

const handleContact = () => {
  // 打开技术支持联系方式
  window.open('mailto:support@tf2025.com')
}
</script>

<style lang="scss" scoped>
.error-page {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
  padding: 20px;
}

.error-details {
  margin-top: 20px;
  width: 100%;
  max-width: 800px;
  text-align: left;

  pre {
    background: #f5f5f5;
    padding: 16px;
    border-radius: 4px;
    font-size: 12px;
    line-height: 1.5;
    overflow-x: auto;
  }
}
</style>
```

## 📝 错误日志系统

### 1. 日志服务

```typescript
// utils/logger.ts
interface LogEntry {
  timestamp: string
  level: 'info' | 'warn' | 'error'
  message: string
  context?: Record<string, any>
  stack?: string
  userId?: string
  url?: string
  userAgent?: string
}

class Logger {
  private logBuffer: LogEntry[] = []
  private maxBufferSize = 100

  private createLogEntry(
    level: LogEntry['level'],
    message: string,
    context?: Record<string, any>,
    error?: Error
  ): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      context,
      stack: error?.stack,
      userId: getCurrentUserId(),
      url: window.location.href,
      userAgent: navigator.userAgent
    }
  }

  private addLog(entry: LogEntry) {
    this.logBuffer.push(entry)

    if (this.logBuffer.length > this.maxBufferSize) {
      this.logBuffer.shift()
    }

    // 开发环境输出到控制台
    if (import.meta.env.DEV) {
      console[entry.level](entry.message, entry)
    }

    // 生产环境发送到日志服务
    if (import.meta.env.PROD) {
      this.sendToLogService(entry)
    }
  }

  private async sendToLogService(entry: LogEntry) {
    try {
      await unifiedApi.post('/logs', entry)
    } catch (error) {
      // 日志发送失败时的处理
      console.warn('Failed to send log:', error)
    }
  }

  info(message: string, context?: Record<string, any>) {
    const entry = this.createLogEntry('info', message, context)
    this.addLog(entry)
  }

  warn(message: string, context?: Record<string, any>) {
    const entry = this.createLogEntry('warn', message, context)
    this.addLog(entry)
  }

  error(message: string, context?: Record<string, any>, error?: Error) {
    const entry = this.createLogEntry('error', message, context, error)
    this.addLog(entry)
  }

  getLogBuffer(): LogEntry[] {
    return [...this.logBuffer]
  }

  clearLogBuffer() {
    this.logBuffer = []
  }
}

export const logger = new Logger()
```

### 2. 错误上报

```typescript
// utils/error-reporting.ts
interface ErrorReport {
  error: string
  stack: string
  timestamp: string
  userAgent: string
  url: string
  userId?: string
  buildVersion?: string
}

class ErrorReporter {
  private reportQueue: ErrorReport[] = []
  private maxQueueSize = 50

  report(error: Error, context?: Record<string, any>) {
    const report: ErrorReport = {
      error: error.message,
      stack: error.stack || '',
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      userId: getCurrentUserId(),
      buildVersion: import.meta.env.VITE_APP_VERSION
    }

    this.queueReport(report)
  }

  private queueReport(report: ErrorReport) {
    this.reportQueue.push(report)

    if (this.reportQueue.length >= this.maxQueueSize) {
      this.flushReports()
    }
  }

  async flushReports() {
    if (this.reportQueue.length === 0) return

    const reports = [...this.reportQueue]
    this.reportQueue = []

    try {
      await unifiedApi.post('/error-reports', { reports })
    } catch (error) {
      // 上报失败，重新加入队列
      this.reportQueue.unshift(...reports)
    }
  }
}

export const errorReporter = new ErrorReporter()

// 页面卸载时上报剩余错误
window.addEventListener('beforeunload', () => {
  errorReporter.flushReports()
})
```

## 🎯 组件级错误处理

### 1. 异步错误处理

```typescript
// composables/useAsyncError.ts
import { ref } from 'vue'
import { useErrorHandler } from '@/composables/useErrorHandler'

export const useAsyncError = () => {
  const { showError } = useErrorHandler()
  const loading = ref(false)
  const error = ref<Error | null>(null)

  const executeAsync = async <T>(
    asyncFn: () => Promise<T>,
    errorMessage?: string
  ): Promise<T | null> => {
    loading.value = true
    error.value = null

    try {
      const result = await asyncFn()
      return result
    } catch (err) {
      error.value = err as Error
      showError(errorMessage || '操作失败', (err as Error).message)
      return null
    } finally {
      loading.value = false
    }
  }

  return {
    loading,
    error,
    executeAsync
  }
}
```

### 2. 表单验证错误

```typescript
// composables/useFormError.ts
export const useFormError = () => {
  const formErrors = ref<Record<string, string[]>>({})

  const setFieldError = (field: string, message: string) => {
    formErrors.value[field] = [message]
  }

  const clearFieldError = (field: string) => {
    delete formErrors.value[field]
  }

  const clearAllErrors = () => {
    formErrors.value = {}
  }

  const hasFieldError = (field: string) => {
    return !!formErrors.value[field]?.length
  }

  const getFieldError = (field: string) => {
    return formErrors.value[field]?.[0] || ''
  }

  return {
    formErrors,
    setFieldError,
    clearFieldError,
    clearAllErrors,
    hasFieldError,
    getFieldError
  }
}
```

## 📊 监控和分析

### 1. 错误监控

```typescript
// utils/error-monitor.ts
interface ErrorMetrics {
  totalErrors: number
  errorsByType: Record<string, number>
  errorsByPage: Record<string, number>
  errorRate: number
}

class ErrorMonitor {
  private metrics: ErrorMetrics = {
    totalErrors: 0,
    errorsByType: {},
    errorsByPage: {},
    errorRate: 0
  }

  recordError(error: Error, context?: Record<string, any>) {
    this.metrics.totalErrors++

    // 按类型统计
    const errorType = error.constructor.name
    this.metrics.errorsByType[errorType] =
      (this.metrics.errorsByType[errorType] || 0) + 1

    // 按页面统计
    const page = window.location.pathname
    this.metrics.errorsByPage[page] =
      (this.metrics.errorsByPage[page] || 0) + 1

    // 计算错误率
    this.calculateErrorRate()

    // 上报监控数据
    this.reportMetrics()
  }

  private calculateErrorRate() {
    // 这里可以根据实际业务逻辑计算错误率
    // 例如：错误数 / 总用户操作数
    this.metrics.errorRate = this.metrics.totalErrors / 1000
  }

  private async reportMetrics() {
    try {
      await unifiedApi.post('/metrics/errors', this.metrics)
    } catch (error) {
      console.warn('Failed to report error metrics:', error)
    }
  }

  getMetrics(): ErrorMetrics {
    return { ...this.metrics }
  }
}

export const errorMonitor = new ErrorMonitor()
```

## 📋 错误处理清单

### 开发时检查

- [ ] 所有可能抛出错误的操作都有 try-catch 处理
- [ ] API 调用都有错误处理逻辑
- [ ] 用户操作都有明确的错误反馈
- [ ] 表单验证错误清晰易懂
- [ ] 异步操作有加载状态和错误状态
- [ ] 关键操作有重试机制

### 部署前检查

- [ ] 全局错误边界已配置
- [ ] 错误页面已创建并路由配置
- [ ] 错误上报服务已配置
- [ ] 日志系统正常工作
- [ ] 监控告警已设置

## 🔍 故障排除

### 常见问题

1. **错误边界不工作**
   - 检查组件是否正确使用
   - 确认错误捕获逻辑

2. **API 错误处理失效**
   - 检查拦截器配置
   - 确认错误处理函数

3. **错误日志缺失**
   - 检查日志服务配置
   - 确认网络连接

### 调试技巧

```typescript
// 开发环境开启详细错误信息
if (import.meta.env.DEV) {
  window.__TF2025_DEBUG__ = {
    showErrors: true,
    logLevel: 'debug'
  }
}

// 查看错误统计
console.log('错误统计:', errorMonitor.getMetrics())
console.log('错误日志:', logger.getLogBuffer())
```

## 📚 参考资料

- [Vue.js 错误处理指南](https://vuejs.org/guide/essentials/error-handling.html)
- [JavaScript 错误处理最佳实践](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Control_flow_and_error_handling)
- [前端监控方案](https://github.com/FRSOURCE/frontend-monitoring)

---

**更新日期**：2025-01-15
**版本**：v1.0.0
**维护者**：TF2025 开发团队