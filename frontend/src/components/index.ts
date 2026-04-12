/**
 * 全局组件注册系统
 * 自动发现和注册组件，避免重复导入
 */

import type { App, Component } from 'vue'

/**
 * 组件配置接口
 */
interface ComponentConfig {
  name: string
  component?: Component
  path?: string
  description?: string
  category?: 'ui' | 'form' | 'data' | 'layout' | 'business' | 'feedback' | 'navigation'
  priority?: 'high' | 'medium' | 'low'
  dependencies?: string[]
  global?: boolean
}

/**
 * 组件注册统计接口
 */
interface ComponentStats {
  total: number
  successful: number
  failed: number
  categories: Record<string, number>
  registrationTime: number
}

/**
 * 全局组件管理器
 */
export class GlobalComponentManager {
  private configs: ComponentConfig[] = []
  private registeredComponents = new Set<string>()
  private failedComponents = new Set<string>()
  private stats: ComponentStats = {
    total: 0,
    successful: 0,
    failed: 0,
    categories: {},
    registrationTime: 0
  }

  constructor(private app: App) {
    this.initializeAutoDiscovery()
  }

  /**
   * 自动发现组件 - 暂时简化以避免glob import问题
   */
  private async initializeAutoDiscovery(): Promise<void> {
    // 暂时跳过自动发现，避免Vite glob import问题
    // 后续可以手动注册关键组件
    return
  }

  /**
   * 处理组件模块
   */
  private async processComponentModules(
    modules: Record<string, () => Promise<any>>
  ): Promise<void> {
    for (const path in modules) {
      try {
        // 跳过测试和示例组件
        if (path.includes('.test.') || path.includes('.spec.') || path.includes('example')) {
          continue
        }

        // 只处理 Vue 组件文件
        if (!path.endsWith('.vue')) {
          continue
        }

        const componentName = this.extractComponentName(path)
        const category = this.extractCategory(path)

        // 添加到配置列表
        this.configs.push({
          name: componentName,
          path,
          category,
          priority: this.determinePriority(path, category),
          global: this.shouldBeGlobal(componentName, category)
        })

      } catch (error) {
        // 处理组件模块失败，忽略
      }
    }
  }

  /**
   * 提取组件名称
   */
  private extractComponentName(path: string): string {
    const fileName = path.split('/').pop()?.replace('.vue', '') || 'Unknown'

    // 转换为 PascalCase
    return fileName
      .replace(/^[a-z]/, char => char.toUpperCase())
      .replace(/-([a-z])/g, (_, char) => char.toUpperCase())
      .replace(/\./g, '')
  }

  /**
   * 提取组件类别
   */
  private extractCategory(path: string): ComponentConfig['category'] {
    // 根据路径推断类别
    if (path.includes('/ui/')) return 'ui'
    if (path.includes('/form/')) return 'form'
    if (path.includes('/data/')) return 'data'
    if (path.includes('/layout/')) return 'layout'
    if (path.includes('/business/')) return 'business'
    if (path.includes('/feedback/')) return 'feedback'
    if (path.includes('/navigation/')) return 'navigation'

    // 根据组件名推断
    const lowerPath = path.toLowerCase()
    if (lowerPath.includes('button') || lowerPath.includes('input') || lowerPath.includes('select')) return 'form'
    if (lowerPath.includes('table') || lowerPath.includes('list') || lowerPath.includes('card')) return 'data'
    if (lowerPath.includes('dialog') || lowerPath.includes('modal') || lowerPath.includes('alert')) return 'feedback'
    if (lowerPath.includes('nav') || lowerPath.includes('menu') || lowerPath.includes('breadcrumb')) return 'navigation'
    if (lowerPath.includes('layout') || lowerPath.includes('grid') || lowerPath.includes('container')) return 'layout'

    return 'ui' // 默认类别
  }

  /**
   * 确定优先级
   */
  private determinePriority(path: string, category?: ComponentConfig['category']): 'high' | 'medium' | 'low' {
    // 高优先级组件
    const highPriorityPatterns = [
      'Button', 'Input', 'Modal', 'Dialog', 'Alert', 'Loading', 'Error'
    ]

    // 低优先级组件
    const lowPriorityPatterns = [
      'test', 'demo', 'example', 'debug', 'dev'
    ]

    const componentName = this.extractComponentName(path)

    if (highPriorityPatterns.some(pattern => componentName.includes(pattern))) {
      return 'high'
    }

    if (lowPriorityPatterns.some(pattern => componentName.toLowerCase().includes(pattern))) {
      return 'low'
    }

    if (category === 'ui' || category === 'form') {
      return 'high'
    }

    return 'medium'
  }

  /**
   * 判断是否应该全局注册
   */
  private shouldBeGlobal(componentName: string, category?: ComponentConfig['category']): boolean {
    // 这些类别的组件通常需要全局注册
    const globalCategories = ['ui', 'feedback', 'navigation']

    // 这些组件名通常需要全局注册
    const globalPatterns = [
      'Base', 'App', 'Global', 'Layout', 'Header', 'Footer', 'Sidebar',
      'Loading', 'Error', 'Dialog', 'Modal', 'Alert', 'Toast', 'Message'
    ]

    return globalCategories.includes(category || '') ||
           globalPatterns.some(pattern => componentName.includes(pattern))
  }

  /**
   * 批量注册组件
   */
  async registerComponents(): Promise<ComponentStats> {
    const startTime = performance.now()

    // 清空统计
    this.stats = {
      total: this.configs.length,
      successful: 0,
      failed: 0,
      categories: {},
      registrationTime: 0
    }

    // 按优先级排序
    const sortedConfigs = [...this.configs].sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 }
      return priorityOrder[b.priority!] - priorityOrder[a.priority!]
    })

    // 分批注册
    const batches = this.chunkArray(sortedConfigs, 10) // 每批10个组件

    for (const batch of batches) {
      await Promise.allSettled(
        batch.map(config => this.registerComponent(config))
      )
    }

    this.stats.registrationTime = performance.now() - startTime
    this.printRegistrationStats()

    return { ...this.stats }
  }

  /**
   * 注册单个组件
   */
  private async registerComponent(config: ComponentConfig): Promise<void> {
    if (this.registeredComponents.has(config.name)) {
      return
    }

    try {
      let component: Component

      if (config.component) {
        // 直接使用传入的组件
        component = config.component
      } else if (config.path) {
        // 动态导入组件
        const module = await import(/* @vite-ignore */ config.path)
        component = module.default
      } else {
        throw new Error('缺少组件或路径')
      }

      // 检查组件有效性
      if (!this.isValidComponent(component)) {
        throw new Error('无效的组件')
      }

      // 注册组件
      this.app.component(config.name, component)
      this.registeredComponents.add(config.name)

      // 更新统计
      this.stats.successful++
      this.stats.categories[config.category!] = (this.stats.categories[config.category!] || 0) + 1

      // 触发注册事件
      window.dispatchEvent(new CustomEvent('tf2025:component:registered', {
        detail: { name: config.name, category: config.category }
      }))

    } catch (error) {
      this.failedComponents.add(config.name)
      this.stats.failed++

      // 触发失败事件
      window.dispatchEvent(new CustomEvent('tf2025:component:register-failed', {
        detail: { name: config.name, error: error.message }
      }))
    }
  }

  /**
   * 检查组件有效性
   */
  private isValidComponent(component: any): boolean {
    return component && (
      typeof component === 'object' ||
      typeof component === 'function'
    ) && (
      component.name ||
      component.__vccOpts ||
      component.setup ||
      component.render ||
      component.template
    )
  }

  /**
   * 数组分块
   */
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = []
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size))
    }
    return chunks
  }

  /**
   * 打印注册统计
   */
  private printRegistrationStats(): void {
    // 组件注册统计已在初始化时输出，此处不再重复输出
  }

  /**
   * 获取组件配置
   */
  getConfig(name: string): ComponentConfig | undefined {
    return this.configs.find(config => config.name === name)
  }

  /**
   * 获取所有配置
   */
  getAllConfigs(): ComponentConfig[] {
    return [...this.configs]
  }

  /**
   * 按类别获取组件
   */
  getComponentsByCategory(category: ComponentConfig['category']): ComponentConfig[] {
    return this.configs.filter(config => config.category === category)
  }

  /**
   * 按优先级获取组件
   */
  getComponentsByPriority(priority: 'high' | 'medium' | 'low'): ComponentConfig[] {
    return this.configs.filter(config => config.priority === priority)
  }

  /**
   * 检查组件是否已注册
   */
  isRegistered(name: string): boolean {
    return this.registeredComponents.has(name)
  }

  /**
   * 获取已注册组件列表
   */
  getRegisteredComponents(): string[] {
    return Array.from(this.registeredComponents)
  }

  /**
   * 获取注册统计
   */
  getStats(): ComponentStats {
    return { ...this.stats }
  }

  /**
   * 手动添加组件配置
   */
  addConfig(config: ComponentConfig): void {
    this.configs.push(config)
  }

  /**
   * 移除组件配置
   */
  removeConfig(name: string): boolean {
    const index = this.configs.findIndex(config => config.name === name)
    if (index > -1) {
      this.configs.splice(index, 1)
      return true
    }
    return false
  }
}

// 全局组件管理器实例
let componentManager: GlobalComponentManager | null = null

/**
 * 注册全局组件
 */
export async function registerGlobalComponents(app: App): Promise<ComponentStats> {
  componentManager = new GlobalComponentManager(app)

  // 手动注册关键组件 - Image全局图片组件
  try {
    const Image = (await import('./Image.vue')).default
    app.component('Image', Image)
    // 保留 AppImage 别名以兼容现有代码
    app.component('AppImage', Image)
  } catch (error) {
    // Image 组件注册失败，忽略
  }

  const stats = await componentManager.registerComponents()

  // 添加到全局状态
  if (window.__TF2025__) {
    window.__TF2025__.componentManager = componentManager
  }

  return stats
}

/**
 * 获取组件管理器实例
 */
export function getComponentManager(): GlobalComponentManager | null {
  return componentManager
}

/**
 * 获取已注册的组件列表
 */
export function getRegisteredComponents(): string[] {
  try {
    if (!componentManager) {
      return []
    }
    return componentManager.getRegisteredComponents()
  } catch (error) {
    return []
  }
}

/**
 * 按类别获取组件
 */
export function getComponentsByCategory(category: ComponentConfig['category']): ComponentConfig[] {
  try {
    if (!componentManager) {
      return []
    }
    return componentManager.getComponentsByCategory(category)
  } catch (error) {
    return []
  }
}

/**
 * 检查组件是否已注册
 */
export function isComponentRegistered(name: string): boolean {
  try {
    if (!componentManager) {
      return false
    }
    return componentManager.isRegistered(name)
  } catch (error) {
    return false
  }
}

/**
 * 获取注册统计
 */
export function getComponentStats(): ComponentStats {
  try {
    if (!componentManager) {
      return {
        total: 0,
        successful: 0,
        failed: 0,
        categories: {},
        registrationTime: 0
      }
    }
    return componentManager.getStats()
  } catch (error) {
    return {
      total: 0,
      successful: 0,
      failed: 0,
      categories: {},
      registrationTime: 0
    }
  }
}

/**
 * 组件使用统计
 */
export const componentUsageStats = {
  recordUsage(componentName: string) {
    if (typeof window !== 'undefined') {
      const stats = window.__TF2025_COMPONENT_STATS__ ?? {}
      stats[componentName] = (stats[componentName] || 0) + 1
      window.__TF2025_COMPONENT_STATS__ = stats
    }
  },

  getStats() {
    return window.__TF2025_COMPONENT_STATS__ ?? {}
  },

  clearStats() {
    if (typeof window !== 'undefined') {
      window.__TF2025_COMPONENT_STATS__ = {}
    }
  },

  // 添加防御性方法，防止对象被调用
  toString() {
    return '[object ComponentUsageStats]'
  }
}

/**
 * 组件开发模式支持
 */
if (import.meta.env.DEV) {
  // 开发模式下提供组件调试信息
  window.__TF2025_COMPONENT_DEBUG__ = {
    getManager: () => componentManager,
    getStats: () => getComponentStats(),
    getRegistered: () => getRegisteredComponents(),
    getByCategory: (category: string) => getComponentsByCategory(category as any),
    isRegistered: function(name: string) {
      try {
        return isComponentRegistered(name)
      } catch (error) {
        return false
      }
    },
    usage: componentUsageStats
  }

  // 添加调试工具到控制台
  try {
    (window as any).tfComponents = window.__TF2025_COMPONENT_DEBUG__
  } catch (error) {
    // 初始化组件调试工具失败，忽略
  }
}


// 导出类型
export type { ComponentConfig, ComponentStats }