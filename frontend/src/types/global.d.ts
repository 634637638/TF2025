/**
 * 全局类型声明文件
 * 扩展 Vue、Window 和其他全局类型
 */

import type { ActionColumnInput, ActionColumnWidthOptions } from '@/utils/table-layout'
import type { Component } from 'vue'
import type { ComponentConfig } from '@/components'
import type { CSRFToken } from '@/utils/csrf'
import type { PerformanceMonitor } from '@/utils/performanceMonitor'
import type {
  AppConfig,
  DeviceInfo,
  ThemeConfig,
  EventBus,
  LogItem,
  ErrorInfo,
  WebSocketState,
  TaskQueue
} from './index'

type GlobalData = Record<string, unknown>
type GlobalComponent = Component

declare module 'vue' {
  interface ComponentCustomProperties {
    $getActionColumnWidth: (actions: ActionColumnInput, options?: ActionColumnWidthOptions) => number
  }
}

// ===== 扩展 Window 接口 =====

declare global {
  interface Window {
    // 应用配置
    TF2025_CONFIG: AppConfig

    // 全局状态管理
    __TF2025__: {
      store: unknown
      router: unknown
      performance?: PerformanceMonitor
      components?: {
        configs: ComponentConfig[]
        usage: Record<string, number>
        list: ComponentConfig[]
        byCategory: (category: string) => ComponentConfig[]
      }
      componentManager?: unknown
      analytics?: import('@/services/telemetry').TelemetryAdapter
      eventBus?: EventBus
      csrf?: {
        token: CSRFToken | null
        isInitialized: boolean
        failures: number
        addCSRFHeader: (headers: Record<string, string>) => Record<string, string>
        refreshToken: () => Promise<CSRFToken | null>
        getCurrentToken: () => Promise<CSRFToken | null>
      }
      composables?: unknown
      loading?: {
        start: (text?: string, options?: GlobalData) => string
        stop: (id?: string) => void
        updateProgress: (id: string, progress: number) => void
        updateText: (text: string) => void
        stopAll: () => void
        isLoading?: boolean
      }
      messageManager?: unknown
      notification?: {
        success: (message: string, options?: GlobalData) => void
        error: (message: string, options?: GlobalData) => void
        warning: (message: string, options?: GlobalData) => void
        info: (message: string, options?: GlobalData) => void
      }
      timeUtil?: unknown
      errorBoundary?: {
        captureError: (error: Error, context?: GlobalData) => void
        getErrors: () => ErrorInfo[]
        clearErrors: () => void
        autoRecovery: boolean
      }
      errorLogger?: unknown
      api?: unknown
      analytics?: unknown
      stores?: {
        auth: unknown
        app: unknown
        loading: unknown
        message: unknown
      }
    }

    // 性能监控
    __TF2025_PERFORMANCE__?: {
      recordMetric: (name: string, value: unknown) => void
      startMonitoring: () => void
      stopMonitoring: () => void
      generateReport: () => PerformanceReport
    }

    // 组件统计
    __TF2025_COMPONENT_STATS__?: Record<string, number>

    // 组件调试
    __TF2025_COMPONENT_DEBUG__?: {
      getManager: () => unknown
      getStats: () => unknown
      getRegistered: () => string[]
      getByCategory: (category: string) => ComponentConfig[]
      isRegistered: (name: string) => boolean
      usage: {
        recordUsage: (componentName: string) => void
        getStats: () => Record<string, number>
        clearStats: () => void
      }
    }

    // 错误边界
    __TF2025_ERROR_BOUNDARY__?: {
      reportError: (error: unknown) => void
      getErrors: () => ErrorInfo[]
      clearErrors: () => void
    }

    // 日志系统
    __TF2025_LOGGER__?: {
      debug: (message: string, data?: unknown) => void
      info: (message: string, data?: unknown) => void
      warn: (message: string, data?: unknown) => void
      error: (message: string, error?: unknown) => void
      fatal: (message: string, error?: unknown) => void
      getLogs: () => LogItem[]
      clearLogs: () => void
    }

    // WebSocket 连接
    __TF2025_WEBSOCKET__?: {
      state: WebSocketState
      connect: () => void
      disconnect: () => void
      send: (data: unknown) => void
      on: (event: string, callback: (...args: unknown[]) => void) => void
      off: (event: string, callback: (...args: unknown[]) => void) => void
    }

    // 任务队列
    __TF2025_TASK_QUEUE__?: {
      create: (name: string, concurrency: number) => TaskQueue
      get: (id: string) => TaskQueue | undefined
      getAll: () => TaskQueue[]
      clear: () => void
    }

    // 缓存系统
    __TF2025_CACHE__?: {
      set: <T>(key: string, value: T, ttl?: number) => void
      get: <T>(key: string) => T | undefined
      del: (key: string) => void
      clear: () => void
      has: (key: string) => boolean
      size: () => number
      keys: () => string[]
      values: <T>() => T[]
    }

    // 国际化
    __TF2025_I18N__?: {
      t: (key: string, params?: GlobalData) => string
      setLocale: (locale: string) => void
      getLocale: () => string
      loadLocale: (locale: string) => Promise<void>
      availableLocales: string[]
    }

    // 通知权限
    Notification: typeof Notification & {
      requestPermission: () => Promise<'granted' | 'denied' | 'default'>
      maxActions: number
    }

    // 电池API
    navigator: Navigator & {
      getBattery?: () => Promise<{
        level: number
        charging: boolean
        addEventListener: (type: string, listener: EventListener) => void
        removeEventListener: (type: string, listener: EventListener) => void
      }>
      connection?: {
        effectiveType: string
        downlink: number
        rtt: number
        saveData: boolean
        addEventListener: (type: string, listener: EventListener) => void
        removeEventListener: (type: string, listener: EventListener) => void
      }
    }

    // 屏幕方向API
    screen: Screen & {
      orientation?: {
        type: string
        angle: number
        lock: (orientation: string) => Promise<void>
        unlock: () => void
        addEventListener: (type: string, listener: EventListener) => void
        removeEventListener: (type: string, listener: EventListener) => void
      }
    }

    // Web Share API
    navigator: Navigator & {
      share?: (data: {
        title?: string
        text?: string
        url?: string
        files?: File[]
      }) => Promise<void>
      canShare?: (data?: { title?: string; text?: string; url?: string; files?: File[] }) => boolean
    }

    // Payment Request API
    PaymentRequest?: typeof PaymentRequest

    // WebRTC API
    RTCPeerConnection: typeof RTCPeerConnection
    RTCSessionDescription: typeof RTCSessionDescription
    RTCIceCandidate: typeof RTCIceCandidate

    // Service Worker API
    serviceWorker?: ServiceWorkerContainer

    // 腾讯地图 API
    TMap?: {
      LatLng: new (lat: number, lng: number) => { lat: number; lng: number }
      Map: new (container: HTMLElement | string, options: {
        center: { lat: number; lng: number }
        zoom?: number
        viewMode?: '2D' | '3D'
        [key: string]: unknown
      }) => {
        destroy: () => void
        on: (event: string, callback: (...args: unknown[]) => void) => void
        off: (event: string, callback: (...args: unknown[]) => void) => void
        [key: string]: unknown
      }
      MultiMarker: new (options: {
        map: unknown
        geometries: Array<{
          id: string
          styleId?: string
          position: { lat: number; lng: number }
          properties?: Record<string, unknown>
        }>
        styles?: Record<string, unknown>
      }) => {
        setGeometries: (geometries: Array<{
          id: string
          styleId?: string
          position: { lat: number; lng: number }
          properties?: Record<string, unknown>
        }>) => void
      }
      MarkerStyle: new (options: {
        width?: number
        height?: number
        anchor?: { x: number; y: number }
        [key: string]: unknown
      }) => unknown
      InfoWindow: new (options: {
        map: unknown
        position: { lat: number; lng: number }
        content: string
        [key: string]: unknown
      }) => unknown
    }
  }

  // ===== 扩展 Document 接口 =====

  interface Document {
    // 元素可见性API
    visibilityState: 'visible' | 'hidden'
    hidden: boolean

    // 全屏API
    webkitFullscreenEnabled?: boolean
    mozFullScreenEnabled?: boolean
    msFullscreenEnabled?: boolean

    // 剪贴板API
    execCommand(command: string, showUI?: boolean, value?: string): boolean

    // 元素选择 - 通用字符串选择器优先
    querySelector: <E extends Element = Element>(
      selectors: string
    ) => E | null
    querySelectorAll: <E extends Element = Element>(
      selectors: string
    ) => NodeListOf<E>
  }

  // ===== 扩展 Navigator 接口 =====

  interface Navigator {
    // 设备内存
    deviceMemory?: number

    // 硬件并发
    hardwareConcurrency?: number

    // 振动API
    vibrate?: (pattern: number | number[]) => boolean

    // 地理定位
    geolocation: Geolocation

    // 媒体设备
    mediaDevices: MediaDevices & {
      getDisplayMedia?: (constraints?: DisplayMediaStreamConstraints) => Promise<MediaStream>
    }

    // 用户代理
    userAgentData?: NavigatorUAData

    // 语言
    languages: readonly string[]
    language: string

    // Cookie启用状态
    cookieEnabled: boolean

    // 在线状态
    onLine: boolean
  }

  // ===== 扩展 HTMLElement 接口 =====

  interface HTMLElement {
    // 滚动行为
    scrollIntoViewIfNeeded?: (centerIfNeeded?: boolean) => void

    // 请求全屏
    webkitRequestFullscreen?: () => Promise<void>
    mozRequestFullScreen?: () => Promise<void>
    msRequestFullscreen?: () => Promise<void>

    // 选择文本
    select?: () => void
    setSelectionRange?: (selectionStart: number, selectionEnd: number, selectionDirection?: 'forward' | 'backward' | 'none') => void

    // 自定义数据属性
    dataset: DOMStringMap

    // 元素尺寸
    offsetWidth: number
    offsetHeight: number
    offsetLeft: number
    offsetTop: number
    scrollWidth: number
    scrollHeight: number
    scrollLeft: number
    scrollTop: number
    clientWidth: number
    clientHeight: number
    clientLeft: number
    clientTop: number

    // 样式
    style: CSSStyleDeclaration

    // 类名操作
    classList: DOMTokenList
    className: string

    // 属性操作
    getAttribute(name: string): string | null
    setAttribute(name: string, value: string): void
    removeAttribute(name: string): void
    hasAttribute(name: string): boolean

    // 事件监听
    addEventListener: <K extends keyof HTMLElementEventMap>(
      type: K,
      listener: (this: HTMLElement, ev: HTMLElementEventMap[K]) => unknown,
      options?: boolean | AddEventListenerOptions
    ) => void
    addEventListener: (
      type: string,
      listener: EventListenerOrEventListenerObject,
      options?: boolean | AddEventListenerOptions
    ) => void
    removeEventListener: <K extends keyof HTMLElementEventMap>(
      type: K,
      listener: (this: HTMLElement, ev: HTMLElementEventMap[K]) => unknown,
      options?: boolean | EventListenerOptions
    ) => void
    removeEventListener: (
      type: string,
      listener: EventListenerOrEventListenerObject,
      options?: boolean | EventListenerOptions
    ) => void
  }

  // ===== 扩展 Canvas 相关接口 =====

  interface CanvasRenderingContext2D {
    // 图像操作
    drawImage: (
      image: CanvasImageSource,
      dx: number,
      dy: number,
      dw?: number,
      dh?: number
    ) => void
    drawImage: (
      image: CanvasImageSource,
      sx: number,
      sy: number,
      sw: number,
      sh: number,
      dx: number,
      dy: number,
      dw: number,
      dh: number
    ) => void

    // 路径操作
    fillRect: (x: number, y: number, w: number, h: number) => void
    strokeRect: (x: number, y: number, w: number, h: number) => void
    clearRect: (x: number, y: number, w: number, h: number) => void

    // 样式设置
    fillStyle: string | CanvasGradient | CanvasPattern
    strokeStyle: string | CanvasGradient | CanvasPattern
    lineWidth: number
    lineCap: CanvasLineCap
    lineJoin: CanvasLineJoin
    miterLimit: number
    lineDashOffset: number

    // 变换
    scale: (x: number, y: number) => void
    rotate: (angle: number) => void
    translate: (x: number, y: number) => void
    transform: (a: number, b: number, c: number, d: number, e: number, f: number) => void
    setTransform: (a: number, b: number, c: number, d: number, e: number, f: number) => void
    resetTransform: () => void

    // 文本操作
    font: string
    textAlign: CanvasTextAlign
    textBaseline: CanvasTextBaseline
    fillText: (text: string, x: number, y: number, maxWidth?: number) => void
    strokeText: (text: string, x: number, y: number, maxWidth?: number) => void
    measureText: (text: string) => TextMetrics
  }

  // ===== 扩展 Console 接口 =====

  interface Console {
    // 日志级别
    debug: (...data: unknown[]) => void
    info: (...data: unknown[]) => void
    warn: (...data: unknown[]) => void
    error: (...data: unknown[]) => void
    log: (...data: unknown[]) => void

    // 分组
    group: (label?: string) => void
    groupEnd: () => void
    groupCollapsed: (label?: string) => void

    // 时间测量
    time: (label?: string) => void
    timeEnd: (label?: string) => void
    timeLog: (label?: string, ...data: unknown[]) => void

    // 计数
    count: (label?: string) => void
    countReset: (label?: string) => void

    // 表格
    table: (tabularData?: unknown, properties?: string[]) => void

    // 断言
    assert: (condition?: boolean, ...data: unknown[]) => void

    // 清除
    clear: () => void

    // 追踪
    trace: (...data: unknown[]) => void

    // 样式化输出
    log: (message: string, ...styles: string[]) => void
  }

  // ===== 扩展 Performance 接口 =====

  interface Performance {
    // 时间戳
    now: () => number

    // 时间标记
    mark: (name: string) => void
    clearMarks: (name?: string) => void
    measure: (name: string, startMark?: string, endMark?: string) => void
    clearMeasures: (name?: string) => void

    // 内存信息
    memory?: {
      usedJSHeapSize: number
      totalJSHeapSize: number
      jsHeapSizeLimit: number
    }

    // 导航计时
    navigation: PerformanceNavigation
    timing: PerformanceTiming

    // 资源计时
    getEntries: () => PerformanceEntry[]
    getEntriesByName: (name: string, type?: string) => PerformanceEntry[]
    getEntriesByType: (type: string) => PerformanceEntry[]
  }

  // ===== 扩展 Storage 接口 =====

  interface Storage {
    length: number
    key: (index: number) => string | null
    getItem: (key: string) => string | null
    setItem: (key: string, value: string) => void
    removeItem: (key: string) => void
    clear: () => void
  }
}

// ===== Vue 模块扩展 =====

declare module '@vue/runtime-core' {
  interface ComponentCustomProperties {
    $getActionColumnWidth: (actions: ActionColumnInput, options?: ActionColumnWidthOptions) => number

    // 应用配置
    $config: AppConfig

    // 设备信息
    $device: DeviceInfo
    $isMobile: boolean
    $isTablet: boolean
    $isDesktop: boolean

    // 主题配置
    $theme: ThemeConfig

    // 权限检查方法
    $hasPermission: (permission: string | string[], role?: string | string[]) => boolean
    $hasRole: (role: string | string[]) => boolean

    // 工具方法
    $formatDate: (date: string | Date, format?: string) => string
    $formatCurrency: (amount: number, currency?: string) => string
    $formatNumber: (num: number, options?: Intl.NumberFormatOptions) => string
    $copyToClipboard: (text: string) => Promise<boolean>
    $downloadFile: (url: string, filename?: string) => void

    // 通知方法
    $notify: (type: 'success' | 'error' | 'warning' | 'info', message: string, options?: GlobalData) => void
    $toast: (message: string, options?: GlobalData) => void

    // 路由方法
    $goBack: () => void
    $goForward: () => void
    $refresh: () => void

    // 缓存方法
    $cache: {
      set: <T>(key: string, value: T, ttl?: number) => void
      get: <T>(key: string) => T | undefined
      del: (key: string) => void
      clear: () => void
    }

    // 国际化方法
    $t: (key: string, params?: GlobalData) => string

    // 日志方法
    $log: {
      debug: (message: string, data?: unknown) => void
      info: (message: string, data?: unknown) => void
      warn: (message: string, data?: unknown) => void
      error: (message: string, error?: unknown) => void
    }

    // WebSocket 方法
    $websocket: {
      connect: () => void
      disconnect: () => void
      send: (data: unknown) => void
      on: (event: string, callback: (...args: unknown[]) => void) => void
      off: (event: string, callback: (...args: unknown[]) => void) => void
      state: WebSocketState
    }
  }

  interface GlobalComponents {
    // Element Plus 组件自动注册
    ElButton: GlobalComponent
    ElInput: GlobalComponent
    ElForm: GlobalComponent
    ElFormItem: GlobalComponent
    ElTable: GlobalComponent
    ElTableColumn: GlobalComponent
    ElPagination: GlobalComponent
    ElDialog: GlobalComponent
    ElDrawer: GlobalComponent
    ElSelect: GlobalComponent
    ElOption: GlobalComponent
    ElRadio: GlobalComponent
    ElRadioGroup: GlobalComponent
    ElCheckbox: GlobalComponent
    ElCheckboxGroup: GlobalComponent
    ElSwitch: GlobalComponent
    ElSlider: GlobalComponent
    ElDatePicker: GlobalComponent
    ElTimePicker: GlobalComponent
    ElUpload: GlobalComponent
    ElTree: GlobalComponent
    ElTreeSelect: GlobalComponent
    ElTransfer: GlobalComponent
    ElSteps: GlobalComponent
    ElStep: GlobalComponent
    ElAlert: GlobalComponent
    ElMessage: GlobalComponent
    ElNotification: GlobalComponent
    ElLoading: GlobalComponent
    ElProgress: GlobalComponent
    ElCard: GlobalComponent
    ElCollapse: GlobalComponent
    ElCollapseItem: GlobalComponent
    ElTabs: GlobalComponent
    ElTabPane: GlobalComponent
    ElMenu: GlobalComponent
    ElMenuItem: GlobalComponent
    ElSubMenu: GlobalComponent
    ElBreadcrumb: GlobalComponent
    ElBreadcrumbItem: GlobalComponent
    ElPageHeader: GlobalComponent
    ElResult: GlobalComponent
    ElSkeleton: GlobalComponent
    ElEmpty: GlobalComponent
    ElDescriptions: GlobalComponent
    ElDescriptionsItem: GlobalComponent
    ElStatistic: GlobalComponent
    ElTimeline: GlobalComponent
    ElTimelineItem: GlobalComponent
    ElCalendar: GlobalComponent
    ElImage: GlobalComponent
    ElAvatar: GlobalComponent
    ElRate: GlobalComponent
    ElColorPicker: GlobalComponent
    ElInputNumber: GlobalComponent
    ElAutocomplete: GlobalComponent
    ElCascader: GlobalComponent
    ElMention: GlobalComponent
    ElPopconfirm: GlobalComponent
    ElPopover: GlobalComponent
    ElPopper: GlobalComponent
    ElTooltip: GlobalComponent
    ElDropdown: GlobalComponent
    ElDropdownMenu: GlobalComponent
    ElDropdownItem: GlobalComponent
    ElCarousel: GlobalComponent
    ElCarouselItem: GlobalComponent
    ElBackTop: GlobalComponent
    ElAffix: GlobalComponent
    ElAnchor: GlobalComponent
    ElAnchorLink: GlobalComponent
    ElAnchorContainer: GlobalComponent
    ElSkeletonItem: GlobalComponent
    ElDivider: GlobalComponent
    ElWatermark: GlobalComponent
    ElConfigProvider: GlobalComponent
    ElIcon: GlobalComponent
    ElRow: GlobalComponent
    ElCol: GlobalComponent
    ElContainer: GlobalComponent
    ElHeader: GlobalComponent
    ElAside: GlobalComponent
    ElMain: GlobalComponent
    ElFooter: GlobalComponent
    ElSpace: GlobalComponent
    ElLayout: GlobalComponent

    // 自定义全局组件
    LoadingSpinner: GlobalComponent
    ErrorBoundary: GlobalComponent
    NotificationContainer: GlobalComponent
    SearchBox: GlobalComponent
    FilterPanel: GlobalComponent
    DataTable: GlobalComponent
    StatusBadge: GlobalComponent
    ActionButtons: GlobalComponent
    PageHeader: GlobalComponent
    PageContainer: GlobalComponent
    SidePanel: GlobalComponent
    UserSelector: GlobalComponent
    StoreSelector: GlobalComponent
    FileUpload: GlobalComponent
    IconPicker: GlobalComponent
    RichTextEditor: GlobalComponent
    ColorPicker: GlobalComponent
    TreeSelect: GlobalComponent
    Transfer: GlobalComponent
    VirtualList: GlobalComponent
    DragDrop: GlobalComponent
    SplitPane: GlobalComponent
    Resizable: GlobalComponent
    Draggable: GlobalComponent
    Sortable: GlobalComponent
  }
}

// ===== 导出所有扩展类型 =====

export {}
