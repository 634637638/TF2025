/**
 * Composable 工具集主入口
 * 统一导出所有 composables
 */

// 核心功能
export { useAsync } from './core/useAsync'
export { useEventBus, createEventBus } from './core/useEventBus'
export { useLocalStorage, useSessionStorage, LocalStorageUtil, storage } from './core/useLocalStorage'

// 导入用于默认导出
import { useAsync } from './core/useAsync'
import { useEventBus, createEventBus } from './core/useEventBus'
import { useConfirm } from './ui/useConfirm'
import { useMediaQuery } from './ui/useMediaQuery'
import { useWindowSize } from './ui/useWindowSize'
import { useLocalStorage, storage } from './core/useLocalStorage'
import { useClipboard, ClipboardUtil } from './utils/useClipboard'
import { useForm, ValidationRules } from './forms/useForm'
import { useLoading, createLoading } from './useLoading'
import { useImportExport } from './useImportExport'
import { useMobileDetection as useMobileDetectionCompat, useMobileForm as useMobileFormCompat } from './mobile'

// UI 功能
export { useConfirm } from './ui/useConfirm'
export { useMediaQuery, useBreakpoints, useDevice, useThemePreference, useCustomMediaQuery } from './ui/useMediaQuery'
export { useWindowSize, useScroll, useViewport } from './ui/useWindowSize'
export { useLoading, createLoading, useLoadingState } from './useLoading'
export { useImportExport } from './useImportExport'

// 工具类
export { useClipboard, ClipboardUtil } from './utils/useClipboard'

// 表单功能
export { useForm, ValidationRules } from './forms/useForm'

// 数据刷新
export { useRefreshData, useRefreshWithPagination } from './useRefreshData'

// 页面视图
export { usePageView } from './usePageView'

// 购物车
export { useCart } from './useCart'

// 认证
export { useAuth } from './useAuth'
export { useMobileDetection, useMobileForm } from './mobile'

// 类型导出
export type { AsyncState } from './types'
export type { ValidationRule, FormFieldConfig, UseFormOptions, UseFormReturn } from './forms/useForm'
export type { UseMediaQueryOptions } from './ui/useMediaQuery'
export type { UseWindowSizeOptions, WindowSize, ScrollPosition } from './ui/useWindowSize'
export type { UseClipboardOptions, UseClipboardReturn } from './utils/useClipboard'

// =================================
// 统一 Composables (从独立文件导入)
// =================================

// 统一分页 composable
export { usePagination, type PaginationOptions, type PaginationReturn } from './usePagination'
import { usePagination } from './usePagination'

// 统一通知 composable
export { useNotification, notifications } from './useNotification'
import { useNotification } from './useNotification'

// 页面状态 composable
export { usePageState, useTableState } from './usePageState'
import { usePageState, useTableState } from './usePageState'

// 防抖 composable（从独立文件导入）
export { useDebounce, useDebouncedValue, useSearchDebounce } from './useDebounce'
import { useDebounce, useDebouncedValue, useSearchDebounce } from './useDebounce'

/**
 * 通用验证规则
 */
export const validationRules = ValidationRules

/**
 * Composable 工具集
 */
export class ComposableToolkit {
  private static instance: ComposableToolkit
  private initialized = false

  static getInstance(): ComposableToolkit {
    if (!ComposableToolkit.instance) {
      ComposableToolkit.instance = new ComposableToolkit()
    }
    return ComposableToolkit.instance
  }

  /**
   * 初始化 Composable 工具集
   */
  static init(): void {
    const toolkit = ComposableToolkit.getInstance()
    if (toolkit.initialized) {
      return
    }

    // 检查浏览器支持
    const features = {
      localStorage: this.checkLocalStorage(),
      sessionStorage: this.checkSessionStorage(),
      clipboard: this.checkClipboard(),
      eventBus: this.checkEventBus(),
      mediaQuery: this.checkMediaQuery()
    }

    toolkit.initialized = true

    if (window.__TF2025__) {
      window.__TF2025__.composables = {
        features,
        toolkit: {
          useAsync,
          useEventBus,
          useConfirm,
          useMediaQuery,
          useLocalStorage,
          useClipboard,
          useForm,
          // 兼容性导出
          usePagination,
          useDebounce,
          useMobileDetection: useMobileDetectionCompat,
          useMobileForm: useMobileFormCompat
        }
      }
    }

    toolkit.initialized = true
  }

  /**
   * 检查本地存储支持
   */
  private static checkLocalStorage(): boolean {
    try {
      const test = '__localStorage_test__'
      localStorage.setItem(test, test)
      localStorage.removeItem(test)
      return true
    } catch {
      return false
    }
  }

  /**
   * 检查会话存储支持
   */
  private static checkSessionStorage(): boolean {
    try {
      const test = '__sessionStorage_test__'
      sessionStorage.setItem(test, test)
      sessionStorage.removeItem(test)
      return true
    } catch {
      return false
    }
  }

  /**
   * 检查剪贴板API支持
   */
  private static checkClipboard(): boolean {
    return !!(navigator.clipboard && typeof ClipboardItem !== 'undefined')
  }

  /**
   * 检查事件总线支持
   */
  private static checkEventBus(): boolean {
    return typeof window !== 'undefined' && typeof CustomEvent !== 'undefined'
  }

  /**
   * 检查媒体查询支持
   */
  private static checkMediaQuery(): boolean {
    return typeof window !== 'undefined' && 'matchMedia' in window
  }

  /**
   * 获取功能支持状态
   */
  static getFeatures(): Record<string, boolean> {
    return {
      localStorage: this.checkLocalStorage(),
      sessionStorage: this.checkSessionStorage(),
      clipboard: this.checkClipboard(),
      eventBus: this.checkEventBus(),
      mediaQuery: this.checkMediaQuery()
    }
  }
}

// 默认导出
export default {
  // 新架构 composables
  useAsync,
  useEventBus,
  useConfirm,
  useMediaQuery,
  useLocalStorage,
  useClipboard,
  useForm,
  useImportExport,

  // 兼容性 composables
  usePagination,
  useDebounce,
  useMobileDetection: useMobileDetectionCompat,
  useMobileForm: useMobileFormCompat,
  validationRules,

  // 工具类
  ComposableToolkit,
  ValidationRules
}
