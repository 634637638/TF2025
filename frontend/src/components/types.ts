/**
 * 全局组件注册系统类型定义
 */

import type { App, Component } from 'vue'

/**
 * 组件注册选项
 */
export interface ComponentRegistryOptions {
  /** 是否启用调试模式 */
  debug?: boolean
  /** 是否自动注册所有组件 */
  autoRegister?: boolean
  /** 组件名称前缀 */
  prefix?: string
  /** 自定义组件 */
  customComponents?: Record<string, Component>
  /** 第三方组件 */
  thirdPartyComponents?: Record<string, Component>
  /** 排除的组件 */
  exclude?: string[]
  /** 包含的组件（如果指定，只注册这些组件） */
  include?: string[]
}

/**
 * 组件信息
 */
export interface ComponentInfo {
  /** 组件实例 */
  component: Component
  /** 组件类别 */
  category: 'base' | 'business' | 'layout' | 'form' | 'custom' | 'third-party'
  /** 注册时间 */
  registeredAt: number
  /** 组件描述 */
  description?: string
  /** 组件版本 */
  version?: string
  /** 组件作者 */
  author?: string
  /** 组件标签 */
  tags?: string[]
}

/**
 * 组件类别配置
 */
export interface ComponentCategoryConfig {
  /** 类别名称 */
  name: string
  /** 类别描述 */
  description: string
  /** 是否启用 */
  enabled: boolean
  /** 前缀 */
  prefix?: string
  /** 排除的组件 */
  exclude?: string[]
}

/**
 * 注册统计信息
 */
export interface RegistryStats {
  /** 总组件数量 */
  total: number
  /** 按类别分组的数量 */
  byCategory: Record<string, number>
  /** 注册耗时 */
  duration: number
  /** 注册时间 */
  registeredAt: number
  /** 失败的组件 */
  failed: string[]
  /** 跳过的组件 */
  skipped: string[]
}

/**
 * 组件搜索选项
 */
export interface ComponentSearchOptions {
  /** 搜索关键词 */
  keyword?: string
  /** 组件类别 */
  category?: string
  /** 标签 */
  tags?: string[]
  /** 是否模糊搜索 */
  fuzzy?: boolean
  /** 搜索限制 */
  limit?: number
}

/**
 * 组件导出配置
 */
export interface ComponentExportConfig {
  /** 导出格式 */
  format: 'json' | 'yaml' | 'typescript'
  /** 是否包含源码 */
  includeSource?: boolean
  /** 是否包含元数据 */
  includeMetadata?: boolean
  /** 输出路径 */
  outputPath?: string
}

/**
 * Vue应用扩展
 */
declare module '@vue/runtime-core' {
  interface ComponentCustomProperties {
    /** 组件注册器实例 */
    $componentRegistry: {
      registered: number
      components: string[]
      duration: number
      registry?: any
    }
  }
}

