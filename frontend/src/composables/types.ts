/**
 * Composable工具包类型定义
 * 复用全局类型定义，只定义 composables 专用类型
 */

import type { Ref, ComputedRef } from 'vue'
import type { Router } from 'vue-router'

// 从全局类型导入重复定义
export type {
  PaginationState,
  PaginationConfig,
  SortConfig,
  FilterConfig
} from '@/types'

/**
 * 通用异步状态
 */
export interface AsyncState<T = any> {
  data: Ref<T | null>
  loading: Ref<boolean>
  error: Ref<string | null>
  success: Ref<boolean>
  execute: (...args: any[]) => Promise<T | null>
  reset: () => void
}

/**
 * 列表状态
 */
export interface ListState<T = any> {
  data: Ref<T[]>
  pagination: Ref<import('@/types').PaginationState>
  sort: Ref<import('@/types').SortConfig | null>
  filter: Ref<import('@/types').FilterConfig>
  loading: Ref<boolean>
  error: Ref<string | null>
  refresh: () => Promise<void>
  setPagination: (pagination: Partial<import('@/types').PaginationConfig>) => void
  setSort: (sort: import('@/types').SortConfig | null) => void
  setFilter: (filter: import('@/types').FilterConfig) => void
  nextPage: () => Promise<void>
  prevPage: () => Promise<void>
  gotoPage: (page: number) => Promise<void>
}

/**
 * 表单状态
 */
export interface FormState<T = Record<string, any>> {
  data: Ref<T>
  errors: Ref<Record<string, string[]>>
  touched: Ref<Record<string, boolean>>
  dirty: Ref<boolean>
  valid: Ref<boolean>
  loading: Ref<boolean>
  reset: () => void
  validate: () => Promise<boolean>
  setField: (field: keyof T, value: any) => void
  setError: (field: keyof T, error: string[]) => void
  clearError: (field: keyof T) => void
  setTouched: (field: keyof T, touched: boolean) => void
  setDirty: (dirty: boolean) => void
}

/**
 * 确认对话框配置
 */
export interface ConfirmDialogConfig {
  title?: string
  message: string
  type?: 'warning' | 'info' | 'success' | 'error'
  confirmText?: string
  cancelText?: string
  showCancel?: boolean
}

/**
 * 通知配置
 */
export interface NotificationConfig {
  title?: string
  message: string
  type?: 'success' | 'warning' | 'info' | 'error'
  duration?: number
  showClose?: boolean
}

/**
 * 防抖配置
 */
export interface DebounceConfig {
  wait: number
  immediate?: boolean
}

/**
 * 节流配置
 */
export interface ThrottleConfig {
  wait: number
  leading?: boolean
  trailing?: boolean
}

/**
 * 拖拽状态
 */
export interface DragState {
  isDragging: Ref<boolean>
  dragData: Ref<any>
  dragOffset: Ref<{ x: number, y: number }>
  startDrag: (event: MouseEvent | TouchEvent, data?: any) => void
  onDrag: (event: MouseEvent | TouchEvent) => void
  endDrag: () => void
}

/**
 * 缓存配置
 */
export interface CacheConfig {
  key: string
  ttl?: number
  storage?: 'localStorage' | 'sessionStorage' | 'memory'
}

/**
 * 事件监听器配置
 */
export interface EventListenerConfig {
  target?: EventTarget
  event: string
  handler: EventListener
  options?: boolean | AddEventListenerOptions
}

/**
 * 窗口大小状态
 */
export interface WindowSizeState {
  width: ComputedRef<number>
  height: ComputedRef<number>
  isMobile: ComputedRef<boolean>
  isTablet: ComputedRef<boolean>
  isDesktop: ComputedRef<boolean>
}

/**
 * 媒体查询状态
 */
export interface MediaQueryState {
  matches: Ref<boolean>
  media: Ref<string>
}

/**
 * 在线状态
 */
export interface OnlineState {
  isOnline: Ref<boolean>
  isOffline: Ref<boolean>
}

/**
 * 网络信息
 */
export interface NetworkInfo {
  effectiveType: string
  downlink: number
  rtt: number
  saveData: boolean
}

/**
 * 电池状态
 */
export interface BatteryState {
  charging: Ref<boolean>
  level: Ref<number>
  chargingTime: Ref<number>
  dischargingTime: Ref<number>
}

/**
 * 复制状态
 */
export interface CopyState {
  copied: Ref<boolean>
  copy: (text: string) => Promise<void>
}

/**
 * 全屏状态
 */
export interface FullscreenState {
  isFullscreen: Ref<boolean>
  isSupported: Ref<boolean>
  enter: () => Promise<void>
  exit: () => Promise<void>
  toggle: () => Promise<void>
}

/**
 * 主题状态
 */
export interface ThemeState {
  theme: Ref<'light' | 'dark' | 'auto'>
  isDark: ComputedRef<boolean>
  toggle: () => void
  setTheme: (theme: 'light' | 'dark' | 'auto') => void
}

/**
 * 本地存储状态
 */
export interface StorageState<T = any> {
  data: Ref<T>
  set: (value: T) => void
  remove: () => void
}

/**
 * 会话存储状态
 */
export interface SessionStorageState<T = any> extends StorageState<T> {
  // 继承StorageState的所有属性
}

/**
 * 路由守卫状态
 */
export interface RouteGuardState {
  canAccess: (to: string, from?: string) => boolean
  redirect: (to: string) => void
  block: () => void
}

/**
 * 页面可见性状态
 */
export interface PageVisibilityState {
  isVisible: Ref<boolean>
  visibilityState: Ref<DocumentVisibilityState>
}

/**
 * 闲置检测状态
 */
export interface IdleState {
  isIdle: Ref<boolean>
  idleTime: Ref<number>
  reset: () => void
}