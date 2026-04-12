<template>
  <div class="error-boundary">
    <!-- 正常内容 -->
    <div v-if="!hasError" class="error-boundary-content">
      <slot />
    </div>

    <!-- 增强错误状态 -->
    <div v-else class="error-boundary-error">
      <el-result
        icon="warning"
        :title="errorTitle"
        :sub-title="errorMessage"
      >
        <template #extra>
          <div class="error-actions">
            <el-button
              type="primary"
              @click="retry"
              :loading="isRetrying"
              v-if="showRetry"
            >
              <el-icon><Refresh /></el-icon>
              重试
            </el-button>

            <el-button
              @click="goHome"
            >
              <el-icon><House /></el-icon>
              返回首页
            </el-button>

            <el-button
              @click="reload"
            >
              <el-icon><Loading /></el-icon>
              刷新页面
            </el-button>

            <el-dropdown @command="handleReport" v-if="isDevelopment">
              <el-button type="info" plain>
                <el-icon><MessageBox /></el-icon>
                报告问题
                <el-icon class="el-icon--right"><ArrowDown /></el-icon>
              </el-button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="copy">复制错误信息</el-dropdown-item>
                  <el-dropdown-item command="console">在控制台查看</el-dropdown-item>
                  <el-dropdown-item command="screenshot" v-if="canScreenshot">生成错误截图</el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </div>

          <!-- 错误详情（可展开） -->
          <el-collapse v-if="isDevelopment && errorDetails" class="error-details">
            <el-collapse-item title="查看错误详情" name="details">
              <div class="error-info">
                <div class="error-item">
                  <strong>错误类型:</strong> {{ errorType }}
                </div>
                <div class="error-item">
                  <strong>错误消息:</strong> {{ errorInfo?.error?.message || '未知错误' }}
                </div>
                <div class="error-item" v-if="errorInfo?.error?.stack">
                  <strong>错误堆栈:</strong>
                  <pre class="error-stack">{{ errorInfo.error.stack }}</pre>
                </div>
                <div class="error-item" v-if="errorInfo?.errorInfo">
                  <strong>组件信息:</strong> {{ errorInfo.errorInfo }}
                </div>
                <div class="error-item">
                  <strong>发生时间:</strong> {{ formatTime(Date.now()) }}
                </div>
                <div class="error-item">
                  <strong>页面URL:</strong> {{ window.location.href }}
                </div>
                <div class="error-item">
                  <strong>用户代理:</strong> {{ navigator.userAgent }}
                </div>
              </div>
            </el-collapse-item>
          </el-collapse>
        </template>
      </el-result>
    </div>

    <!-- 错误回退插槽 -->
    <slot v-if="hasError" name="fallback" :error="errorInfo" :retry="retry" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, readonly, onErrorCaptured, getCurrentInstance, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useNotification } from '@/composables/useNotification'
import {
  Refresh,
  House,
  Loading,
  MessageBox,
  ArrowDown
} from '@element-plus/icons-vue'
import { useErrorBoundary } from '@/utils/error-boundary'
import { formatBeijingTime } from '@/utils/time'
import { logger } from '@/utils/logger'

interface Props {
  fallback?: string
  title?: string
  message?: string
  showRetry?: boolean
  onError?: (error: unknown, instance: unknown, info: string) => void
  onRecover?: () => void
}

interface Emits {
  error: [{ error: unknown; instance: unknown; info: string }]
  retry: []
}

interface ErrorLike {
  name?: string
  message?: string
  stack?: string
  toString?: () => string
}

interface CapturedErrorInfo {
  error: ErrorLike | null
  errorInfo: string
  vm: unknown
  componentStack: string
}

interface Tf2025ErrorEventDetail {
  error: unknown
  instance: unknown
  info: string
}

const toErrorLike = (value: unknown): ErrorLike | null => {
  if (value && typeof value === 'object') {
    return value as ErrorLike
  }
  return null
}

const props = withDefaults(defineProps<Props>(), {
  showRetry: true
})

const emit = defineEmits<Emits>()

// Composables
const router = useRouter()
const { success, error: showError, warning, info, handleApiError, confirm } = useNotification()
const { handleError } = useErrorBoundary()
const instance = getCurrentInstance()

// 响应式数据
const hasError = ref(false)
const errorInfo = ref<CapturedErrorInfo | null>(null)
const isRetrying = ref(false)
const retryCount = ref(0)
const isDevelopment = ref(import.meta.env.DEV)

// 计算属性
const showRetry = computed(() => props.showRetry && retryCount.value < 3)
const canScreenshot = computed(() => 'html2canvas' in window || import.meta.env.DEV)

const errorTitle = computed(() => {
  if (props.title) return props.title

  // 根据错误类型动态设置标题
  const currentErrorMessage = errorInfo.value?.error?.message || ''
  if (currentErrorMessage.includes('Network') || currentErrorMessage.includes('fetch')) {
    return '网络连接错误'
  }
  if (currentErrorMessage.includes('permission') || currentErrorMessage.includes('unauthorized')) {
    return '权限不足'
  }

  return '应用程序错误'
})

const errorMessage = computed(() => {
  if (props.message) return props.message

  // 根据错误类型动态设置消息
  const errorMsg = errorInfo.value?.error?.message || ''
  if (errorMsg.includes('Network') || errorMsg.includes('fetch')) {
    return '请检查您的网络连接，然后重试'
  }
  if (errorMsg.includes('permission') || errorMsg.includes('unauthorized')) {
    return '您没有执行此操作的权限，请联系有权限的角色维护人员'
  }

  return '抱歉，页面遇到了一个错误，请稍后重试'
})

const errorType = computed(() => {
  const error = errorInfo.value?.error
  if (!error) return '未知'

  if (error.name === 'TypeError') return '类型错误'
  if (error.name === 'ReferenceError') return '引用错误'
  if (error.name === 'SyntaxError') return '语法错误'
  if (error.message?.includes('Network')) return '网络错误'
  if (error.message?.includes('permission')) return '权限错误'

  return error.name || '运行时错误'
})

const errorDetails = computed(() => {
  if (!isDevelopment.value || !errorInfo.value) return null

  return {
    error: errorInfo.value.error?.toString(),
    errorInfo: errorInfo.value.errorInfo,
    vmInstance: errorInfo.value.vm,
    componentStack: errorInfo.value.componentStack
  }
})

// 方法
const formatTime = (timestamp?: number) => {
  if (!timestamp) return '未知'
  return formatBeijingTime(new Date(timestamp), 'YYYY-MM-DD HH:mm:ss')
}

const captureError = (capturedError: unknown, instance: unknown, info: string) => {
  logger.error('ErrorBoundary caught an error:', capturedError, info)
  const errorLike = toErrorLike(capturedError)

  hasError.value = true
  errorInfo.value = {
    error: errorLike,
    errorInfo: info,
    vm: instance,
    componentStack: info
  }

  // 记录到全局错误边界
  handleError({
    type: errorType.value,
    message: errorLike?.message || '未知错误',
    stack: errorLike?.stack,
    context: {
      componentName: (instance as { $options?: { name?: string } } | null)?.$options?.name,
      info,
      route: router.currentRoute.value.path
    },
    timestamp: Date.now(),
    url: window.location.href,
    userAgent: navigator.userAgent,
    sessionId: '',
    resolved: false,
    retryCount: 0
  })

  // 调用自定义错误处理
  if (props.onError) {
    props.onError(capturedError, instance, info)
  }

  // 发出错误事件
  emit('error', { error: capturedError, instance, info })

  // 显示错误通知
  showError(errorTitle.value, errorMessage.value, {
    duration: 0,
    showClose: true
  })

  // 记录到性能监控系统
  if (window.__TF2025__?.performance) {
    window.__TF2025__.performance.recordMetric('componentError', {
      type: errorType.value,
      message: errorLike?.message,
      component: (instance as { $options?: { name?: string } } | null)?.$options?.name
    })
  }

  // 阻止错误继续向上传播
  return false
}

// 增强重试逻辑
const retry = async () => {
  if (isRetrying.value || retryCount.value >= 3) {
    return
  }

  isRetrying.value = true
  retryCount.value++

  try {
    // 等待一帧，确保状态更新
    await new Promise(resolve => requestAnimationFrame(resolve))

    // 清除错误状态
    hasError.value = false
    errorInfo.value = null

    // 发出重试事件
    emit('retry')

    success(`重试中... (${retryCount.value}/3)`)

    // 如果有自定义恢复回调，调用它
    if (props.onRecover) {
      props.onRecover()
    }

  } catch (retryError) {
    logger.error('重试失败:', retryError)
    error(`重试失败 (${retryCount.value}/3)`)

    if (retryCount.value >= 3) {
      warning('已达到最大重试次数，请联系技术支持')
    }
  } finally {
    isRetrying.value = false
  }
}

// 返回首页
const goHome = () => {
  router.push('/')
}

// 刷新页面
const reload = () => {
  window.location.reload()
}

// 错误报告功能
const handleReport = async (command: string) => {
  switch (command) {
    case 'copy':
      await copyErrorInfo()
      break
    case 'console':
      consoleError()
      break
    case 'screenshot':
      await takeScreenshot()
      break
  }
}

const copyErrorInfo = async () => {
  if (!errorInfo.value) return

  const errorText = `
错误类型: ${errorType.value}
错误消息: ${errorInfo.value.error?.message || '未知错误'}
发生时间: ${formatTime(Date.now())}
页面URL: ${window.location.href}
用户代理: ${navigator.userAgent}

${errorInfo.value.error?.stack ? `错误堆栈:\n${errorInfo.value.error.stack}` : ''}
${errorInfo.value.errorInfo ? `组件信息:\n${errorInfo.value.errorInfo}` : ''}
  `.trim()

  try {
    await navigator.clipboard.writeText(errorText)
    success('错误信息已复制到剪贴板')
  } catch (err) {
    logger.error('复制失败:', err)
    error('复制失败，请手动复制')
  }
}

const consoleError = () => {
  if (!errorInfo.value) return

  logger.debug('🔍 应用程序错误详情')
  logger.error('错误信息:', errorInfo.value.error)

  info('错误详情已在控制台显示')
}

const takeScreenshot = async () => {
  try {
    // 在开发环境中尝试使用 html2canvas
    if (import.meta.env.DEV && window.html2canvas) {
      const canvas = await window.html2canvas(document.body)
      canvas.toBlob(blob => {
        if (blob) {
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = `error-${Date.now()}.png`
          a.click()
          URL.revokeObjectURL(url)
          success('错误截图已保存')
        }
      })
    } else {
      // 提示用户手动截图
      info('请手动截图当前页面以便报告问题')
    }
  } catch (err) {
    logger.error('截图失败:', err)
    error('截图功能不可用')
  }
}

// 捕获子组件错误
onErrorCaptured((error, instance, info) => {
  return captureError(error, instance, info)
})

// 全局错误监听（增强错误边界能力）
onMounted(() => {
  // 监听全局错误事件
  window.addEventListener('error', (event) => {
    if (!hasError.value) {
      captureError(event.error, null, `Global: ${event.message}`)
    }
  })

  // 监听未处理的 Promise rejection
  window.addEventListener('unhandledrejection', (event) => {
    if (!hasError.value) {
      captureError(event.reason, null, `Unhandled Promise: ${event.reason?.message}`)
    }
  })

  // 监听来自其他组件的错误
  window.addEventListener('tf2025:error', (event: Event) => {
    const customEvent = event as CustomEvent<Tf2025ErrorEventDetail>
    if (!hasError.value && customEvent.detail) {
      captureError(customEvent.detail.error, customEvent.detail.instance, customEvent.detail.info)
    }
  })
})

// 暴露方法给父组件
defineExpose({
  captureError,
  hasError: readonly(hasError),
  errorInfo: readonly(errorInfo),
  retry,
  errorType,
  errorTitle,
  errorMessage
})
</script>

<style scoped>
.error-boundary {
  width: 100%;
  height: 100%;
}

.error-fallback {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 400px;
  padding: 20px;
}

.error-content {
  display: flex;
  align-items: center;
  gap: 20px;
  background-color: #fff;
  padding: 32px;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  text-align: center;
  max-width: 500px;
}

.error-icon {
  font-size: 48px;
  color: #f56c6c;
  flex-shrink: 0;
}

.error-info {
  flex: 1;
}

.error-title {
  font-size: 20px;
  font-weight: 600;
  color: #303133;
  margin: 0 0 8px 0;
}

.error-message {
  font-size: 14px;
  color: #606266;
  margin: 0 0 24px 0;
  line-height: 1.6;
}

.error-actions {
  display: flex;
  gap: 12px;
  justify-content: center;
}

.btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.3s;
  text-decoration: none;
}

.btn-primary {
  background-color: #409eff;
  border-color: #409eff;
  color: #fff;
}

.btn-primary:hover {
  background-color: #66b1ff;
  border-color: #66b1ff;
}

.btn-secondary {
  background-color: #fff;
  border-color: #dcdfe6;
  color: #606266;
}

.btn-secondary:hover {
  background-color: #f5f7fa;
  border-color: #c0c4cc;
}

.error-details {
  margin-top: 20px;
  max-width: 800px;
  width: 100%;
  background-color: #fff;
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.error-details h4 {
  margin: 0 0 12px 0;
  color: #303133;
  font-size: 16px;
}

.error-details pre {
  background-color: #f5f7fa;
  padding: 12px;
  border-radius: 4px;
  font-size: 12px;
  color: #606266;
  overflow-x: auto;
  white-space: pre-wrap;
  word-break: break-word;
}
</style>
