/**
 * 旧版 Loading API 兼容层。
 *
 * 新业务请直接使用 useLoadingStore 或 useLoadingState。
 * 这里仅保留旧插件的最小调用面，避免重复创建 Element Plus 全屏实例。
 */

import { computed, type App, inject } from 'vue'
import { useLoadingStore } from '@/stores/loading'

export interface LoadingConfig {
  text?: string
  progress?: number
  cancellable?: boolean
}

export interface LoadingTask {
  id: string
  name: string
  config: LoadingConfig
  startTime: number
  progress: number
  status: 'running' | 'completed' | 'cancelled'
}

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

export interface LoadingSystemConfig {
  enableGlobalLoading?: boolean
}

export class GlobalLoadingManager {
  private tasks = new Map<string, LoadingTask>()
  private nextId = 1

  constructor(_config: Partial<LoadingSystemConfig> = {}) {}

  show(name = 'default', config: LoadingConfig = {}): string {
    const id = `loading_${this.nextId++}_${Date.now()}`
    const task: LoadingTask = {
      id,
      name,
      config,
      startTime: Date.now(),
      progress: config.progress || 0,
      status: 'running'
    }

    this.tasks.set(id, task)
    useLoadingStore().startLoading(config.text || '加载中...', id)
    return id
  }

  showWithProgress(name = 'progress', config: LoadingConfig = {}): string {
    return this.show(name, { ...config, progress: config.progress || 0 })
  }

  incrementProgress(taskId: string, amount = 10): void {
    const task = this.tasks.get(taskId)
    if (task) {
      this.updateProgress(taskId, task.progress + amount)
    }
  }

  updateProgress(taskId: string, progress: number, text?: string): void {
    const task = this.tasks.get(taskId)
    if (!task || task.status !== 'running') return

    task.progress = Math.max(0, Math.min(100, progress))
    useLoadingStore().updateProgress(task.progress, taskId)
    if (text) {
      task.config.text = text
      useLoadingStore().setLoadingText(text)
    }
  }

  hide(taskId: string): void {
    const task = this.tasks.get(taskId)
    if (!task || task.status !== 'running') return

    task.status = 'completed'
    useLoadingStore().stopLoading(taskId)
  }

  cancel(taskId: string): boolean {
    const task = this.tasks.get(taskId)
    if (!task || task.status !== 'running' || !task.config.cancellable) return false

    task.status = 'cancelled'
    useLoadingStore().stopLoading(taskId)
    return true
  }

  hideAll(): void {
    this.getRunningTasks().forEach(task => this.hide(task.id))
  }

  clearAll(): void {
    this.tasks.clear()
    useLoadingStore().clearAllLoading()
  }

  getTask(taskId: string): LoadingTask | undefined {
    return this.tasks.get(taskId)
  }

  getAllTasks(): LoadingTask[] {
    return Array.from(this.tasks.values())
  }

  getRunningTasks(): LoadingTask[] {
    return this.getAllTasks().filter(task => task.status === 'running')
  }

  getStats(): LoadingStats {
    const tasks = this.getAllTasks()
    const activeTasks = this.getRunningTasks()
    return {
      total: tasks.length,
      active: activeTasks.length,
      completed: tasks.filter(task => task.status === 'completed').length,
      cancelled: tasks.filter(task => task.status === 'cancelled').length,
      errors: 0,
      averageDuration: 0,
      totalDuration: 0,
      longestTask: '',
      activeTasks
    }
  }

  createProgressBar(name: string, config: LoadingConfig = {}) {
    const taskId = this.show(name, { ...config, progress: 0 })
    return {
      taskId,
      update: (progress: number, text?: string) => this.updateProgress(taskId, progress, text),
      increment: (amount = 10) => {
        const task = this.getTask(taskId)
        this.updateProgress(taskId, (task?.progress || 0) + amount)
      },
      complete: (text?: string) => {
        this.updateProgress(taskId, 100, text)
        this.hide(taskId)
      },
      error: (message: string) => {
        this.updateProgress(taskId, 0, `错误: ${message}`)
        this.hide(taskId)
      },
      cancel: () => this.cancel(taskId)
    }
  }

  async processBatch<T>(
    tasks: Array<{ name: string; task: () => Promise<T> }>
  ): Promise<T[]> {
    const results: T[] = []
    for (const item of tasks) {
      const taskId = this.show(item.name, { text: `处理: ${item.name}` })
      try {
        results.push(await item.task())
      } finally {
        this.hide(taskId)
      }
    }
    return results
  }

  cleanup(): void {
    this.clearAll()
  }
}

export const LoadingPlugin = {
  install(app: App, config?: Partial<LoadingSystemConfig>) {
    const manager = new GlobalLoadingManager(config)
    app.config.globalProperties.$loading = manager
    app.provide('loadingManager', manager)
  }
}

/**
 * @deprecated 新业务请使用 useLoadingStore。
 */
export function useLoading() {
  const loadingManager = inject<GlobalLoadingManager>('loadingManager')
  if (!loadingManager) {
    throw new Error('LoadingManager not found. Make sure LoadingPlugin is installed.')
  }

  const runningTasks = computed(() => loadingManager.getRunningTasks())
  return {
    loadingManager,
    isLoading: computed(() => runningTasks.value.length > 0),
    runningTasks,
    stats: computed(() => loadingManager.getStats()),
    show: loadingManager.show.bind(loadingManager),
    hide: loadingManager.hide.bind(loadingManager),
    hideAll: loadingManager.hideAll.bind(loadingManager),
    clearAll: loadingManager.clearAll.bind(loadingManager),
    cancel: loadingManager.cancel.bind(loadingManager),
    createProgress: loadingManager.createProgressBar.bind(loadingManager),
    processBatch: loadingManager.processBatch.bind(loadingManager)
  }
}

export default LoadingPlugin
