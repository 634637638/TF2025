/**
 * 全局Loading状态管理系统
 * 提供统一的加载状态管理、进度跟踪、队列管理等功能
 */

import { ref, reactive, computed, nextTick, type App, inject } from 'vue'
import { ElLoading } from 'element-plus'
import type { LoadingInstance } from 'element-plus'

/**
 * Loading配置接口
 */
export interface LoadingConfig {
  text?: string
  target?: string | HTMLElement
  background?: string
  customClass?: string
  delay?: number
  minDuration?: number
  lock?: boolean
  fullscreen?: boolean
  spinner?: string
  showSpinner?: boolean
  icon?: string
  iconSize?: number
  iconColor?: string
  progress?: number
  showProgress?: boolean
  cancellable?: boolean
  onCancel?: () => void
}

/**
 * Loading任务信息
 */
export interface LoadingTask {
  id: string
  name: string
  config: LoadingConfig
  startTime: number
  progress: number
  status: 'pending' | 'running' | 'completed' | 'cancelled' | 'error'
  duration?: number
  instance?: LoadingInstance
  cancellable: boolean
  onCancel?: () => void
}

/**
 * Loading统计信息
 */
export interface LoadingStats {
  total: number
  active: number
  completed: number
  cancelled: number
  errors: number
  averageDuration: number
  totalDuration: number
  longestTask: string
  activeTasks: LoadingTask[]
}

/**
 * Loading系统配置
 */
export interface LoadingSystemConfig {
  maxConcurrent: number
  defaultDelay: number
  defaultMinDuration: number
  enableQueue: boolean
  enableProgress: boolean
  enableGlobalLoading: boolean
  globalLoadingThreshold: number
  taskTimeout: number
  persistOnRouteChange: boolean
  enablePerformanceTracking: boolean
}

/**
 * 全局Loading管理器
 */
export class GlobalLoadingManager {
  private config: LoadingSystemConfig
  private tasks = new Map<string, LoadingTask>()
  private globalLoading: LoadingInstance | null = null
  private nextId = 1
  private isGlobalLoadingActive = false
  private globalTaskCount = 0

  constructor(config: Partial<LoadingSystemConfig> = {}) {
    this.config = {
      maxConcurrent: 10,
      defaultDelay: 0,
      defaultMinDuration: 0,
      enableQueue: true,
      enableProgress: true,
      enableGlobalLoading: true,
      globalLoadingThreshold: 1,
      taskTimeout: 60000, // 60秒超时
      persistOnRouteChange: false,
      enablePerformanceTracking: true,
      ...config
    }

    this.initialize()
  }

  /**
   * 初始化Loading系统
   */
  private initialize(): void {
    // 路由变化时清理Loading
    if (!this.config.persistOnRouteChange) {
      window.addEventListener('popstate', () => {
        this.clearAll()
      })
    }

    // 页面卸载时清理
    window.addEventListener('beforeunload', () => {
      this.cleanup()
    })
  }

  /**
   * 显示Loading
   */
  show(name: string = 'default', config: LoadingConfig = {}): string {
    const taskId = this.generateTaskId()

    const task: LoadingTask = {
      id: taskId,
      name,
      config: {
        text: '加载中...',
        background: 'rgba(0, 0, 0, 0.7)',
        lock: true,
        showSpinner: true,
        showProgress: false,
        cancellable: false,
        delay: this.config.defaultDelay,
        minDuration: this.config.defaultMinDuration,
        ...config
      },
      startTime: Date.now(),
      progress: 0,
      status: 'pending',
      cancellable: config.cancellable || false,
      onCancel: config.onCancel
    }

    // 存储任务
    this.tasks.set(taskId, task)

    // 启动任务
    this.startTask(taskId)

    // 更新全局Loading状态
    this.updateGlobalLoading()

    return taskId
  }

  /**
   * 显示带进度的Loading
   */
  showWithProgress(name: string = 'progress', config: LoadingConfig = {}): string {
    return this.show(name, {
      showProgress: true,
      progress: 0,
      ...config
    })
  }

  /**
   * 更新进度
   */
  updateProgress(taskId: string, progress: number, text?: string): void {
    const task = this.tasks.get(taskId)
    if (!task || task.status !== 'running') return

    task.progress = Math.max(0, Math.min(100, progress))

    // 更新Element Plus Loading实例的文本
    if (task.instance && text) {
      // Element Plus不支持动态更新文本，这里使用自定义逻辑
      this.updateLoadingText(task, text)
    }

    // 如果进度达到100%，自动隐藏
    if (task.progress >= 100) {
      setTimeout(() => {
        this.hide(taskId)
      }, 500)
    }
  }

  /**
   * 增加进度
   */
  incrementProgress(taskId: string, increment: number = 10): void {
    const task = this.tasks.get(taskId)
    if (!task) return

    this.updateProgress(taskId, task.progress + increment)
  }

  /**
   * 隐藏Loading
   */
  hide(taskId: string): void {
    const task = this.tasks.get(taskId)
    if (!task) return

    // 确保最小显示时间
    const minDuration = task.config.minDuration || 0
    const elapsedTime = Date.now() - task.startTime

    if (elapsedTime < minDuration) {
      setTimeout(() => {
        this.completeTask(taskId)
      }, minDuration - elapsedTime)
    } else {
      this.completeTask(taskId)
    }
  }

  /**
   * 取消Loading
   */
  cancel(taskId: string): boolean {
    const task = this.tasks.get(taskId)
    if (!task || !task.cancellable || task.status !== 'running') return false

    task.status = 'cancelled'
    task.duration = Date.now() - task.startTime

    // 调用取消回调
    if (task.onCancel) {
      try {
        task.onCancel()
      } catch (error) {
        // Loading cancel callback error, ignore
      }
    }

    // 关闭Loading实例
    if (task.instance) {
      task.instance.close()
      task.instance = undefined
    }

    // 更新全局Loading状态
    this.updateGlobalLoading()

    // 触发全局事件
    this.emitGlobalEvent('loading:cancel', task)

    return true
  }

  /**
   * 隐藏所有Loading
   */
  hideAll(): void {
    const runningTasks = Array.from(this.tasks.values())
      .filter(task => task.status === 'running')

    runningTasks.forEach(task => {
      this.hide(task.id)
    })
  }

  /**
   * 清空所有Loading
   */
  clearAll(): void {
    this.tasks.forEach(task => {
      if (task.instance) {
        task.instance.close()
      }
    })

    this.tasks.clear()
    this.hideGlobalLoading()
  }

  /**
   * 启动任务
   */
  private startTask(taskId: string): void {
    const task = this.tasks.get(taskId)
    if (!task) return

    // 检查并发限制
    const runningTasks = Array.from(this.tasks.values())
      .filter(t => t.status === 'running')

    if (runningTasks.length >= this.config.maxConcurrent) {
      // 等待队列
      setTimeout(() => {
        this.startTask(taskId)
      }, 100)
      return
    }

    task.status = 'running'

    // 设置超时
    if (this.config.taskTimeout > 0) {
      setTimeout(() => {
        if (task.status === 'running') {
          task.status = 'error'
          this.hide(taskId)
          this.emitGlobalEvent('loading:timeout', task)
        }
      }, this.config.taskTimeout)
    }

    // 创建Loading实例
    this.createLoadingInstance(task)

    // 触发全局事件
    this.emitGlobalEvent('loading:start', task)
  }

  /**
   * 创建Loading实例
   */
  private createLoadingInstance(task: LoadingTask): void {
    try {
      const loadingConfig = {
        text: task.config.showProgress
          ? `${task.config.text} (${Math.round(task.progress)}%)`
          : task.config.text,
        background: task.config.background,
        target: task.config.target,
        customClass: task.config.customClass,
        lock: task.config.lock,
        fullscreen: task.config.fullscreen !== false, // 默认全屏
        spinner: task.config.spinner
      }

      task.instance = ElLoading.service(loadingConfig)

    } catch (error) {
      task.status = 'error'
    }
  }

  /**
   * 更新Loading文本
   */
  private updateLoadingText(task: LoadingTask, text: string): void {
    // 由于Element Plus限制，这里通过重新创建实例来更新文本
    if (task.instance) {
      task.instance.close()
    }

    task.config.text = text
    this.createLoadingInstance(task)
  }

  /**
   * 完成任务
   */
  private completeTask(taskId: string): void {
    const task = this.tasks.get(taskId)
    if (!task) return

    task.status = 'completed'
    task.duration = Date.now() - task.startTime

    // 关闭Loading实例
    if (task.instance) {
      task.instance.close()
      task.instance = undefined
    }

    // 更新全局Loading状态
    this.updateGlobalLoading()

    // 触发全局事件
    this.emitGlobalEvent('loading:complete', task)

    // 清理旧任务
    this.cleanupOldTasks()
  }

  /**
   * 更新全局Loading状态
   */
  private updateGlobalLoading(): void {
    const runningTasks = Array.from(this.tasks.values())
      .filter(task => task.status === 'running')

    const shouldShowGlobal = this.config.enableGlobalLoading &&
                            runningTasks.length >= this.config.globalLoadingThreshold

    if (shouldShowGlobal && !this.isGlobalLoadingActive) {
      this.showGlobalLoading()
    } else if (!shouldShowGlobal && this.isGlobalLoadingActive) {
      this.hideGlobalLoading()
    }
  }

  /**
   * 显示全局Loading
   */
  private showGlobalLoading(): void {
    if (this.isGlobalLoadingActive) return

    try {
      this.globalLoading = ElLoading.service({
        text: '系统处理中，请稍候...',
        background: 'rgba(0, 0, 0, 0.8)',
        lock: true,
        fullscreen: true
      })

      this.isGlobalLoadingActive = true
      this.globalTaskCount++

    } catch (error) {
      // 显示全局Loading失败，忽略
    }
  }

  /**
   * 隐藏全局Loading
   */
  private hideGlobalLoading(): void {
    if (!this.isGlobalLoadingActive || !this.globalLoading) return

    try {
      this.globalLoading.close()
      this.globalLoading = null
      this.isGlobalLoadingActive = false

    } catch (error) {
      // 隐藏全局Loading失败，忽略
    }
  }

  /**
   * 生成任务ID
   */
  private generateTaskId(): string {
    return `loading_${this.nextId++}_${Date.now()}`
  }

  /**
   * 触发全局事件
   */
  private emitGlobalEvent(event: string, data: any): void {
    if (window.__TF2025__?.eventBus) {
      window.__TF2025__.eventBus.emit(event, data)
    }

    // 使用自定义事件
    window.dispatchEvent(new CustomEvent(`tf2025:${event}`, {
      detail: data
    }))
  }

  /**
   * 获取任务信息
   */
  getTask(taskId: string): LoadingTask | undefined {
    return this.tasks.get(taskId)
  }

  /**
   * 获取所有任务
   */
  getAllTasks(): LoadingTask[] {
    return Array.from(this.tasks.values())
  }

  /**
   * 获取正在运行的任务
   */
  getRunningTasks(): LoadingTask[] {
    return this.getAllTasks().filter(task => task.status === 'running')
  }

  /**
   * 获取Loading统计
   */
  getStats(): LoadingStats {
    const allTasks = this.getAllTasks()
    const runningTasks = this.getRunningTasks()

    const stats: LoadingStats = {
      total: allTasks.length,
      active: runningTasks.length,
      completed: allTasks.filter(t => t.status === 'completed').length,
      cancelled: allTasks.filter(t => t.status === 'cancelled').length,
      errors: allTasks.filter(t => t.status === 'error').length,
      averageDuration: 0,
      totalDuration: 0,
      longestTask: '',
      activeTasks: runningTasks
    }

    let totalDuration = 0
    let longestDuration = 0
    let longestTaskName = ''

    allTasks.forEach(task => {
      if (task.duration) {
        totalDuration += task.duration
        if (task.duration > longestDuration) {
          longestDuration = task.duration
          longestTaskName = task.name
        }
      }
    })

    stats.totalDuration = totalDuration
    stats.averageDuration = allTasks.length > 0 ? totalDuration / allTasks.length : 0
    stats.longestTask = longestTaskName

    return stats
  }

  /**
   * 清理旧任务
   */
  private cleanupOldTasks(): void {
    const maxTasks = 100
    if (this.tasks.size <= maxTasks) return

    const completedTasks = Array.from(this.tasks.entries())
      .filter(([, task]) => task.status === 'completed' || task.status === 'cancelled')
      .sort(([, a], [, b]) => (a.startTime || 0) - (b.startTime || 0))

    const toDelete = completedTasks.slice(0, this.tasks.size - maxTasks)
    toDelete.forEach(([id]) => {
      this.tasks.delete(id)
    })
  }

  /**
   * 清理资源
   */
  cleanup(): void {
    this.clearAll()
    this.hideGlobalLoading()
  }

  /**
   * 创建进度条组件专用Loading
   */
  createProgressBar(name: string, config: LoadingConfig = {}): {
    taskId: string
    update: (progress: number, text?: string) => void
    increment: (amount?: number) => void
    complete: (text?: string) => void
    error: (error: string) => void
    cancel: () => boolean
  } {
    const taskId = this.showWithProgress(name, config)

    return {
      taskId,
      update: (progress: number, text?: string) => {
        this.updateProgress(taskId, progress, text)
      },
      increment: (amount: number = 10) => {
        this.incrementProgress(taskId, amount)
      },
      complete: (text?: string) => {
        if (text) {
          this.updateProgress(taskId, 100, text)
        }
        this.hide(taskId)
      },
      error: (error: string) => {
        const task = this.tasks.get(taskId)
        if (task) {
          task.status = 'error'
          this.updateLoadingText(task, `错误: ${error}`)
          setTimeout(() => this.hide(taskId), 2000)
        }
      },
      cancel: () => this.cancel(taskId)
    }
  }

  /**
   * 批量处理任务
   */
  async processBatch<T>(
    tasks: Array<{ name: string; task: () => Promise<T> }>,
    batchConfig: { concurrent?: number; showProgress?: boolean } = {}
  ): Promise<T[]> {
    const { concurrent = 3, showProgress = true } = batchConfig
    const results: T[] = []

    if (showProgress) {
      const progress = this.createProgressBar('批量处理', {
        text: `处理 0/${tasks.length} 个任务`,
        showProgress: true
      })

      try {
        // 分批处理
        for (let i = 0; i < tasks.length; i += concurrent) {
          const batch = tasks.slice(i, i + concurrent)
          const batchPromises = batch.map(async ({ name, task }) => {
            const taskId = this.show(name, { text: `处理: ${name}` })
            try {
              const result = await task()
              this.hide(taskId)
              return result
            } catch (error) {
              this.hide(taskId)
              throw error
            }
          })

          const batchResults = await Promise.allSettled(batchPromises)
          batchResults.forEach((result, index) => {
            if (result.status === 'fulfilled') {
              results.push(result.value)
            } else {
              // 任务失败，忽略
            }
          })

          const completed = Math.min(i + concurrent, tasks.length)
          progress.update((completed / tasks.length) * 100, `处理 ${completed}/${tasks.length} 个任务`)
        }

        progress.complete('批量处理完成')
        return results

      } catch (error) {
        progress.error('批量处理失败')
        throw error
      }
    } else {
      // 不显示进度的批量处理
      for (const { name, task } of tasks) {
        const taskId = this.show(name, { text: `处理: ${name}` })
        try {
          const result = await task()
          results.push(result)
          this.hide(taskId)
        } catch (error) {
          this.hide(taskId)
          throw error
        }
      }
      return results
    }
  }
}

/**
 * Vue插件
 */
export const LoadingPlugin = {
  install(app: App, config?: Partial<LoadingSystemConfig>) {
    const loadingManager = new GlobalLoadingManager(config)

    // 提供到全局
    app.config.globalProperties.$loading = loadingManager
    app.provide('loadingManager', loadingManager)

    // 添加到全局状态
    if (window.__TF2025__) {
      window.__TF2025__.loadingManager = loadingManager
    }
  }
}

/**
 * Composable: 使用Loading
 */
export function useLoading() {
  const loadingManager = inject<GlobalLoadingManager>('loadingManager')

  if (!loadingManager) {
    throw new Error('LoadingManager not found. Make sure LoadingPlugin is installed.')
  }

  const runningTasks = computed(() => loadingManager.getRunningTasks())
  const stats = computed(() => loadingManager.getStats())
  const isLoading = computed(() => runningTasks.value.length > 0)

  return {
    loadingManager,
    isLoading,
    runningTasks,
    stats,
    show: loadingManager.show.bind(loadingManager),
    hide: loadingManager.hide.bind(loadingManager),
    hideAll: loadingManager.hideAll.bind(loadingManager),
    clearAll: loadingManager.clearAll.bind(loadingManager),
    cancel: loadingManager.cancel.bind(loadingManager),
    createProgress: loadingManager.createProgressBar.bind(loadingManager),
    processBatch: loadingManager.processBatch.bind(loadingManager)
  }
}

// 默认导出
export default LoadingPlugin