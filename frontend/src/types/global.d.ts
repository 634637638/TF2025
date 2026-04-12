/**
 * 全局类型声明文件
 * 扩展 Vue、Window 和其他全局类型
 */

import { ComponentCustomProperties } from 'vue'
import type {
  AppConfig,
  DeviceInfo,
  ThemeConfig,
  EventBus,
  LogItem,
  WebSocketState,
  TaskQueue
} from './index'

// ===== 扩展 Window 接口 =====

declare global {
  interface Window {
    // 应用配置
    TF2025_CONFIG: AppConfig

    // 全局状态管理
    __TF2025__: {
      store: any
      router: any
      performance?: {
        recordMetric: (name: string, value: any) => void
        startMonitoring: () => void
        stopMonitoring: () => void
        generateReport: () => any
        getMetrics?: () => any
      }
      components?: {
        configs: any[]
        usage: Record<string, number>
        list: any[]
        byCategory: (category: string) => any[]
      }
      componentManager?: any
      eventBus?: EventBus
      csrf?: {
        token: any
        isInitialized: boolean
        failures: number
        addCSRFHeader: (headers: Record<string, string>) => Record<string, string>
        refreshToken: () => Promise<any>
        getCurrentToken: () => Promise<any>
      }
      composables?: any
      loading?: {
        start: (text?: string, options?: any) => any
        stop: (id?: string) => void
        updateProgress: (id: string, progress: number) => void
        updateText: (text: string) => void
        stopAll: () => void
        isLoading?: boolean
      }
      loadingManager?: any
      messageManager?: any
      notification?: {
        success: (message: string, options?: any) => void
        error: (message: string, options?: any) => void
        warning: (message: string, options?: any) => void
        info: (message: string, options?: any) => void
      }
      timeUtil?: any
      errorBoundary?: {
        captureError: (error: Error, context?: any) => void
        getErrors: () => any[]
        clearErrors: () => void
        autoRecovery: boolean
      }
      errorLogger?: any
      api?: any
      analytics?: any
      stores?: {
        auth: any
        app: any
        loading: any
        message: any
      }
    }

    // 性能监控
    __TF2025_PERFORMANCE__?: {
      recordMetric: (name: string, value: any) => void
      startMonitoring: () => void
      stopMonitoring: () => void
      generateReport: () => PerformanceReport
    }

    // 组件统计
    __TF2025_COMPONENT_STATS__?: Record<string, number>

    // 组件调试
    __TF2025_COMPONENT_DEBUG__?: {
      getManager: () => any
      getStats: () => any
      getRegistered: () => string[]
      getByCategory: (category: string) => any[]
      isRegistered: (name: string) => boolean
      usage: {
        recordUsage: (componentName: string) => void
        getStats: () => Record<string, number>
        clearStats: () => void
      }
    }

    // 错误边界
    __TF2025_ERROR_BOUNDARY__?: {
      reportError: (error: any) => void
      getErrors: () => any[]
      clearErrors: () => void
    }

    // 日志系统
    __TF2025_LOGGER__?: {
      debug: (message: string, data?: any) => void
      info: (message: string, data?: any) => void
      warn: (message: string, data?: any) => void
      error: (message: string, error?: any) => void
      fatal: (message: string, error?: any) => void
      getLogs: () => LogItem[]
      clearLogs: () => void
    }

    // WebSocket 连接
    __TF2025_WEBSOCKET__?: {
      state: WebSocketState
      connect: () => void
      disconnect: () => void
      send: (data: any) => void
      on: (event: string, callback: Function) => void
      off: (event: string, callback: Function) => void
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
      t: (key: string, params?: Record<string, any>) => string
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
      canShare?: (data?: any) => boolean
    }

    // Payment Request API
    PaymentRequest?: any

    // WebRTC API
    RTCPeerConnection: any
    RTCSessionDescription: any
    RTCIceCandidate: any

    // Service Worker API
    serviceWorker?: ServiceWorkerContainer

    // 腾讯地图 API
    TMap?: {
      LatLng: new (lat: number, lng: number) => { lat: number; lng: number }
      Map: new (container: HTMLElement | string, options: {
        center: any
        zoom?: number
        viewMode?: '2D' | '3D'
        [key: string]: any
      }) => {
        destroy: () => void
        on: (event: string, callback: Function) => void
        off: (event: string, callback: Function) => void
        [key: string]: any
      }
      MultiMarker: new (options: {
        map: any
        geometries: Array<{
          id: string
          position: any
        }>
        styles?: Record<string, any>
      }) => any
      MarkerStyle: new (options: {
        width?: number
        height?: number
        anchor?: { x: number; y: number }
        [key: string]: any
      }) => any
      InfoWindow: new (options: {
        map: any
        position: any
        content: string
        [key: string]: any
      }) => any
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
    execCommand(command: string, showUI?: boolean, value?: any): boolean

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
      listener: (this: HTMLElement, ev: HTMLElementEventMap[K]) => any,
      options?: boolean | AddEventListenerOptions
    ) => void
    addEventListener: (
      type: string,
      listener: EventListenerOrEventListenerObject,
      options?: boolean | AddEventListenerOptions
    ) => void
    removeEventListener: <K extends keyof HTMLElementEventMap>(
      type: K,
      listener: (this: HTMLElement, ev: HTMLElementEventMap[K]) => any,
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
    debug: (...data: any[]) => void
    info: (...data: any[]) => void
    warn: (...data: any[]) => void
    error: (...data: any[]) => void
    log: (...data: any[]) => void

    // 分组
    group: (label?: string) => void
    groupEnd: () => void
    groupCollapsed: (label?: string) => void

    // 时间测量
    time: (label?: string) => void
    timeEnd: (label?: string) => void
    timeLog: (label?: string, ...data: any[]) => void

    // 计数
    count: (label?: string) => void
    countReset: (label?: string) => void

    // 表格
    table: (tabularData?: any, properties?: string[]) => void

    // 断言
    assert: (condition?: boolean, ...data: any[]) => void

    // 清除
    clear: () => void

    // 追踪
    trace: (...data: any[]) => void

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
  interface ComponentCustomProperties extends ComponentCustomProperties {
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
    $notify: (type: 'success' | 'error' | 'warning' | 'info', message: string, options?: any) => void
    $toast: (message: string, options?: any) => void

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
    $t: (key: string, params?: Record<string, any>) => string

    // 日志方法
    $log: {
      debug: (message: string, data?: any) => void
      info: (message: string, data?: any) => void
      warn: (message: string, data?: any) => void
      error: (message: string, error?: any) => void
    }

    // WebSocket 方法
    $websocket: {
      connect: () => void
      disconnect: () => void
      send: (data: any) => void
      on: (event: string, callback: Function) => void
      off: (event: string, callback: Function) => void
      state: WebSocketState
    }
  }

  interface GlobalComponents {
    // Element Plus 组件自动注册
    ElButton: any
    ElInput: any
    ElForm: any
    ElFormItem: any
    ElTable: any
    ElTableColumn: any
    ElPagination: any
    ElDialog: any
    ElDrawer: any
    ElSelect: any
    ElOption: any
    ElRadio: any
    ElRadioGroup: any
    ElCheckbox: any
    ElCheckboxGroup: any
    ElSwitch: any
    ElSlider: any
    ElDatePicker: any
    ElTimePicker: any
    ElUpload: any
    ElTree: any
    ElTreeSelect: any
    ElTransfer: any
    ElSteps: any
    ElStep: any
    ElAlert: any
    ElMessage: any
    ElNotification: any
    ElLoading: any
    ElProgress: any
    ElCard: any
    ElCollapse: any
    ElCollapseItem: any
    ElTabs: any
    ElTabPane: any
    ElMenu: any
    ElMenuItem: any
    ElSubMenu: any
    ElBreadcrumb: any
    ElBreadcrumbItem: any
    ElPageHeader: any
    ElResult: any
    ElSkeleton: any
    ElEmpty: any
    ElDescriptions: any
    ElDescriptionsItem: any
    ElStatistic: any
    ElTimeline: any
    ElTimelineItem: any
    ElCalendar: any
    ElImage: any
    ElAvatar: any
    ElRate: any
    ElColorPicker: any
    ElTransfer: any
    ElForm: any
    ElFormItem: any
    ElInputNumber: any
    ElAutocomplete: any
    ElCascader: any
    ElMention: any
    ElPopconfirm: any
    ElPopover: any
    ElPopper: any
    ElTooltip: any
    ElDropdown: any
    ElDropdownMenu: any
    ElDropdownItem: any
    ElCarousel: any
    ElCarouselItem: any
    ElBackTop: any
    ElAffix: any
    ElAnchor: any
    ElAnchorLink: any
    ElAnchorContainer: any
    ElPageHeader: any
    ElBreadcrumb: any
    ElBreadcrumbItem: any
    ElDescriptions: any
    ElDescriptionsItem: any
    ElResult: any
    ElSkeleton: any
    ElSkeletonItem: any
    ElEmpty: any
    ElStatistic: any
    ElTimeline: any
    ElTimelineItem: any
    ElDivider: any
    ElWatermark: any
    ElConfigProvider: any
    ElIcon: any
    ElRow: any
    ElCol: any
    ElContainer: any
    ElHeader: any
    ElAside: any
    ElMain: any
    ElFooter: any
    ElSpace: any
    ElLayout: any
    ElConfigProvider: any

    // 自定义全局组件
    LoadingSpinner: any
    ErrorBoundary: any
    NotificationContainer: any
    ConfirmDialog: any
    SearchBox: any
    FilterPanel: any
    DataTable: any
    StatusBadge: any
    ActionButtons: any
    PageHeader: any
    PageContainer: any
    SidePanel: any
    UserSelector: any
    StoreSelector: any
    FileUpload: any
    IconPicker: any
    RichTextEditor: any
    ColorPicker: any
    TreeSelect: any
    Transfer: any
    VirtualList: any
    DragDrop: any
    SplitPane: any
    Resizable: any
    Draggable: any
    Sortable: any
  }
}

// ===== 导出所有扩展类型 =====

export {}