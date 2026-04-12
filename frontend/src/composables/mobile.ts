/**
 * 移动端专用 Composable 工具集
 * 提供手机端特有功能的 Composition API 实现
 */

import { ref, reactive, computed, onMounted, onUnmounted, watch, nextTick, type Ref } from 'vue'
import { useAppStore } from '@/stores/app'
import { BREAKPOINTS } from '@/config/breakpoints'
import logger from '@/utils/logger'
import type {
  DeviceInfo,
  TouchState,
  Breakpoints,
  MobileOptimizeConfig
} from '@/types'

type BatteryManagerLike = {
  level: number
  charging: boolean
  addEventListener: (type: 'levelchange' | 'chargingchange', listener: () => void) => void
  removeEventListener: (type: 'levelchange' | 'chargingchange', listener: () => void) => void
}

type NetworkConnectionLike = {
  type?: string
  effectiveType?: string
  downlink?: number
  rtt?: number
  addEventListener?: (type: 'change', listener: () => void) => void
  removeEventListener?: (type: 'change', listener: () => void) => void
}

// ============ 移动端配置常量 ============

const MOBILE_CONFIG = {
  // 断点配置
  breakpoints: {
    mobile: BREAKPOINTS.MOBILE_MAX,
    tablet: BREAKPOINTS.TABLET_MAX,
    desktop: BREAKPOINTS.DESKTOP_MIN
  },

  // 触摸配置
  touch: {
    tapThreshold: 10, // 点击阈值
    longPressDelay: 500, // 长按延迟
    doubleTapDelay: 300, // 双击延迟
    swipeThreshold: 50, // 滑动阈值
    swipeVelocity: 0.3 // 滑动速度阈值
  },

  // 手势配置
  gestures: {
    enablePan: true,
    enablePinch: true,
    enableRotate: false,
    enableSwipe: true
  },

  // 视口配置
  viewport: {
    enableAdaptive: true, // 自适应视口
    enableSafeArea: true, // 安全区域
    enableOrientationChange: true // 方向变化
  },

  // 性能配置
  performance: {
    enableLazyLoad: true,
    enableVirtualScroll: true,
    enableIntersectionObserver: true,
    enableRequestIdleCallback: true
  },

  // 反馈配置
  feedback: {
    enableHaptic: true, // 触觉反馈
    enableSound: false, // 声音反馈
    enableVisual: true, // 视觉反馈
    hapticIntensity: 'medium' // 'light' | 'medium' | 'heavy'
  }
} as const

// ============ 移动端设备检测 ============

/**
 * 增强的移动端设备检测 Composable
 */
export function useMobileDevice() {
  const appStore = useAppStore()
  let batteryManager: BatteryManagerLike | null = null
  let networkConnection: NetworkConnectionLike | null = null

  // 设备信息状态
  const deviceState = reactive({
    // 基础信息
    isMobile: computed(() => appStore.isMobile),
    isTablet: computed(() => appStore.isTablet),
    isDesktop: computed(() => !appStore.isMobile && !appStore.isTablet),
    breakpoint: computed(() => appStore.breakpoint),

    // 屏幕信息
    screenWidth: window.innerWidth,
    screenHeight: window.innerHeight,
    orientation: 'portrait' as 'portrait' | 'landscape',
    pixelRatio: window.devicePixelRatio || 1,

    // 功能检测
    touchSupported: 'ontouchstart' in window,
    hapticSupported: 'vibrate' in navigator,
    webGLSupported: false,
    webAssemblySupported: 'WebAssembly' in window,

    // 浏览器检测
    isIOS: /iPhone|iPad|iPod/.test(navigator.userAgent),
    isAndroid: /Android/.test(navigator.userAgent),
    isChrome: /Chrome/.test(navigator.userAgent),
    isSafari: /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent),
    isWeChat: /MicroMessenger/.test(navigator.userAgent),

    // 网络信息
    connectionType: '',
    effectiveType: '',
    downlink: 0,
    rtt: 0,

    // 电池信息
    batteryLevel: 1,
    batteryCharging: false,

    // 内存信息
    memoryInfo: null as {
      usedJSHeapSize: number
      totalJSHeapSize: number
      jsHeapSizeLimit: number
    } | null
  })

  // 检测WebGL支持
  const detectWebGLSupport = () => {
    try {
      const canvas = document.createElement('canvas')
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl')
      deviceState.webGLSupported = !!gl
    } catch (error) {
      deviceState.webGLSupported = false
    }
  }

  // 检测WebAssembly支持
  const detectWebAssemblySupport = () => {
    try {
      if (typeof WebAssembly === 'object' && typeof WebAssembly.instantiate === 'function') {
        const module = new WebAssembly.Module(Uint8Array.of(0x0, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00))
        if (module instanceof WebAssembly.Module) {
          deviceState.webAssemblySupported = true
        }
      }
    } catch (error) {
      deviceState.webAssemblySupported = false
    }
  }

  // 更新屏幕方向
  const updateOrientation = () => {
    deviceState.orientation = window.innerWidth > window.innerHeight ? 'landscape' : 'portrait'
  }

  // 更新屏幕尺寸
  const updateScreenSize = () => {
    deviceState.screenWidth = window.innerWidth
    deviceState.screenHeight = window.innerHeight
    updateOrientation()
    appStore.updateDeviceBreakpoint()
  }

  // 更新网络信息
  const updateNetworkInfo = () => {
    const connection = (navigator as Navigator & { connection?: NetworkConnectionLike }).connection
    if (connection) {
      deviceState.connectionType = connection.type || 'unknown'
      deviceState.effectiveType = connection.effectiveType || 'unknown'
      deviceState.downlink = connection.downlink || 0
      deviceState.rtt = connection.rtt || 0
    }
  }

  const handleBatteryLevelChange = () => {
    if (!batteryManager) return
    deviceState.batteryLevel = batteryManager.level
  }

  const handleBatteryChargingChange = () => {
    if (!batteryManager) return
    deviceState.batteryCharging = batteryManager.charging
  }

  // 更新电池信息
  const updateBatteryInfo = async () => {
    if ('getBattery' in navigator) {
      try {
        if (!batteryManager) {
          batteryManager = await (navigator as Navigator & {
            getBattery?: () => Promise<BatteryManagerLike>
          }).getBattery?.() || null
        }

        if (!batteryManager) {
          return
        }

        handleBatteryLevelChange()
        handleBatteryChargingChange()
        batteryManager.removeEventListener('levelchange', handleBatteryLevelChange)
        batteryManager.removeEventListener('chargingchange', handleBatteryChargingChange)
        batteryManager.addEventListener('levelchange', handleBatteryLevelChange)
        batteryManager.addEventListener('chargingchange', handleBatteryChargingChange)
      } catch (error) {
        logger.warn('电池信息获取失败', error)
      }
    }
  }

  // 更新内存信息
  const updateMemoryInfo = () => {
    if ('memory' in performance) {
      const memory = (performance as any).memory
      deviceState.memoryInfo = {
        usedJSHeapSize: memory.usedJSHeapSize,
        totalJSHeapSize: memory.totalJSHeapSize,
        jsHeapSizeLimit: memory.jsHeapSizeLimit
      }
    }
  }

  // 防抖处理
  let resizeTimer: NodeJS.Timeout
  const handleResize = () => {
    clearTimeout(resizeTimer)
    resizeTimer = setTimeout(updateScreenSize, 150)
  }

  onMounted(() => {
    // 初始化检测
    detectWebGLSupport()
    detectWebAssemblySupport()
    updateScreenSize()
    updateNetworkInfo()
    updateBatteryInfo()
    updateMemoryInfo()

    // 监听事件
    window.addEventListener('resize', handleResize)
    window.addEventListener('orientationchange', updateScreenSize)

    networkConnection = (navigator as Navigator & { connection?: NetworkConnectionLike }).connection || null
    networkConnection?.addEventListener?.('change', updateNetworkInfo)
  })

  onUnmounted(() => {
    window.removeEventListener('resize', handleResize)
    window.removeEventListener('orientationchange', updateScreenSize)
    networkConnection?.removeEventListener?.('change', updateNetworkInfo)
    batteryManager?.removeEventListener('levelchange', handleBatteryLevelChange)
    batteryManager?.removeEventListener('chargingchange', handleBatteryChargingChange)
    clearTimeout(resizeTimer)
  })

  return {
    deviceState,
    isMobile: deviceState.isMobile,
    isTablet: deviceState.isTablet,
    isDesktop: deviceState.isDesktop,
    updateScreenSize,
    updateNetworkInfo,
    updateBatteryInfo
  }
}

// ============ 移动端手势处理 ============

/**
 * 移动端手势处理 Composable
 */
export function useMobileGestures(
  element: Ref<HTMLElement | null> | HTMLElement | null,
  options: {
    onTap?: (event: TouchEvent) => void
    onDoubleTap?: (event: TouchEvent) => void
    onLongPress?: (event: TouchEvent) => void
    onSwipe?: (direction: 'left' | 'right' | 'up' | 'down', event: TouchEvent) => void
    onPan?: (deltaX: number, deltaY: number, event: TouchEvent) => void
    onPinch?: (scale: number, event: TouchEvent) => void
    enableHaptic?: boolean
    threshold?: number
    longPressDelay?: number
  } = {}
) {
  const {
    onTap,
    onDoubleTap,
    onLongPress,
    onSwipe,
    onPan,
    onPinch,
    enableHaptic = true,
    threshold = MOBILE_CONFIG.touch.swipeThreshold,
    longPressDelay = MOBILE_CONFIG.touch.longPressDelay
  } = options

  // 手势状态
  const gestureState = reactive({
    isPressed: false,
    isPanning: false,
    isSwiping: false,
    startTime: 0,
    startX: 0,
    startY: 0,
    lastX: 0,
    lastY: 0,
    deltaX: 0,
    deltaY: 0,
    velocity: 0,
    scale: 1,
    lastTapTime: 0,
    tapCount: 0,
    direction: '' as 'left' | 'right' | 'up' | 'down' | '',
    distance: 0
  })

  // 触发触觉反馈
  const triggerHaptic = (type: 'light' | 'medium' | 'heavy' = 'medium') => {
    if (enableHaptic && 'vibrate' in navigator && MOBILE_CONFIG.feedback.enableHaptic) {
      const pattern = {
        light: 10,
        medium: 20,
        heavy: 50
      }
      navigator.vibrate(pattern[type])
    }
  }

  // 处理触摸开始
  const handleTouchStart = (event: TouchEvent) => {
    if (!event.touches.length) return

    const touch = event.touches[0]
    gestureState.isPressed = true
    gestureState.startTime = Date.now()
    gestureState.startX = touch.clientX
    gestureState.startY = touch.clientY
    gestureState.lastX = touch.clientX
    gestureState.lastY = touch.clientY
    gestureState.deltaX = 0
    gestureState.deltaY = 0
    gestureState.velocity = 0
    gestureState.scale = 1

    // 长按检测
    if (onLongPress) {
      setTimeout(() => {
        if (gestureState.isPressed && !gestureState.isPanning) {
          gestureState.isPanning = true
          triggerHaptic('medium')
          onLongPress(event)
        }
      }, longPressDelay)
    }

    // 双击检测
    const now = Date.now()
    if (now - gestureState.lastTapTime < MOBILE_CONFIG.touch.doubleTapDelay) {
      gestureState.tapCount++
      if (gestureState.tapCount === 2) {
        gestureState.tapCount = 0
        triggerHaptic('light')
        onDoubleTap?.(event)
      }
    } else {
      gestureState.tapCount = 1
      setTimeout(() => {
        gestureState.tapCount = 0
      }, MOBILE_CONFIG.touch.doubleTapDelay)
    }
    gestureState.lastTapTime = now
  }

  // 处理触摸移动
  const handleTouchMove = (event: TouchEvent) => {
    if (!event.touches.length || !gestureState.isPressed) return

    const touch = event.touches[0]
    gestureState.deltaX = touch.clientX - gestureState.startX
    gestureState.deltaY = touch.clientY - gestureState.startY
    gestureState.distance = Math.sqrt(gestureState.deltaX ** 2 + gestureState.deltaY ** 2)

    // 计算速度
    const deltaTime = Date.now() - gestureState.startTime
    gestureState.velocity = gestureState.distance / deltaTime

    // 判断是否为拖拽
    if (gestureState.distance > MOBILE_CONFIG.touch.tapThreshold) {
      gestureState.isPanning = true

      // 计算方向
      const absX = Math.abs(gestureState.deltaX)
      const absY = Math.abs(gestureState.deltaY)

      if (absX > absY) {
        gestureState.direction = gestureState.deltaX > 0 ? 'right' : 'left'
      } else {
        gestureState.direction = gestureState.deltaY > 0 ? 'down' : 'up'
      }

      // 拖拽回调
      if (onPan) {
        onPan(gestureState.deltaX, gestureState.deltaY, event)
      }

      gestureState.lastX = touch.clientX
      gestureState.lastY = touch.clientY
    }

    // 处理缩放（双指）
    if (event.touches.length === 2 && onPinch) {
      const distance = Math.hypot(
        event.touches[0].clientX - event.touches[1].clientX,
        event.touches[0].clientY - event.touches[1].clientY
      )
      if (gestureState.scale === 1) {
        gestureState.scale = distance
      } else {
        const scale = distance / gestureState.scale
        gestureState.scale = scale
        onPinch(scale, event)
      }
    }
  }

  // 处理触摸结束
  const handleTouchEnd = (event: TouchEvent) => {
    if (!gestureState.isPressed) return

    const wasPanning = gestureState.isPanning
    gestureState.isPressed = false
    gestureState.isPanning = false

    // 点击处理
    if (!wasPanning && onTap) {
      triggerHaptic('light')
      onTap(event)
      return
    }

    // 滑动处理
    if (wasPanning && gestureState.distance > threshold && onSwipe) {
      const timeDelta = Date.now() - gestureState.startTime
      const velocity = gestureState.distance / timeDelta

      if (velocity > MOBILE_CONFIG.touch.swipeVelocity && gestureState.direction) {
        triggerHaptic('light')
        onSwipe(gestureState.direction, event)
      }
    }

    // 重置状态
    gestureState.deltaX = 0
    gestureState.deltaY = 0
    gestureState.velocity = 0
    gestureState.scale = 1
    gestureState.distance = 0
    gestureState.direction = ''
  }

  // 绑定事件监听器
  const bindEvents = () => {
    const el = element && ('value' in element ? element.value : element)
    if (!el) return

    el.addEventListener('touchstart', handleTouchStart, { passive: true })
    el.addEventListener('touchmove', handleTouchMove, { passive: true })
    el.addEventListener('touchend', handleTouchEnd, { passive: true })
    el.addEventListener('touchcancel', handleTouchEnd, { passive: true })
  }

  // 解绑事件监听器
  const unbindEvents = () => {
    const el = element && ('value' in element ? element.value : element)
    if (!el) return

    el.removeEventListener('touchstart', handleTouchStart)
    el.removeEventListener('touchmove', handleTouchMove)
    el.removeEventListener('touchend', handleTouchEnd)
    el.removeEventListener('touchcancel', handleTouchEnd)
  }

  onMounted(() => {
    bindEvents()
  })

  onUnmounted(() => {
    unbindEvents()
  })

  // 如果element是响应式的，监听其变化
  if (element && 'value' in element) {
    watch(element, (newEl, oldEl) => {
      unbindEvents()
      if (newEl) {
        bindEvents()
      }
    })
  }

  return {
    gestureState,
    triggerHaptic,
    bindEvents,
    unbindEvents
  }
}

// ============ 移动端视口管理 ============

/**
 * 移动端视口管理 Composable
 */
export function useMobileViewport() {
  const viewportState = reactive({
    width: window.innerWidth,
    height: window.innerHeight,
    visualViewport: null as {
      width: number
      height: number
      offsetLeft: number
      offsetTop: number
      scale: number
    } | null,
    safeArea: { top: 0, right: 0, bottom: 0, left: 0 },
    isKeyboardVisible: false,
    keyboardHeight: 0,
    orientation: 'portrait' as 'portrait' | 'landscape'
  })

  // 获取安全区域
  const getSafeArea = () => {
    const computedStyle = getComputedStyle(document.documentElement)
    const safeAreaTop = parseInt(computedStyle.getPropertyValue('--safe-area-inset-top') || '0')
    const safeAreaRight = parseInt(computedStyle.getPropertyValue('--safe-area-inset-right') || '0')
    const safeAreaBottom = parseInt(computedStyle.getPropertyValue('--safe-area-inset-bottom') || '0')
    const safeAreaLeft = parseInt(computedStyle.getPropertyValue('--safe-area-inset-left') || '0')

    viewportState.safeArea = {
      top: safeAreaTop,
      right: safeAreaRight,
      bottom: safeAreaBottom,
      left: safeAreaLeft
    }
  }

  // 更新视口尺寸
  const updateViewportSize = () => {
    viewportState.width = window.innerWidth
    viewportState.height = window.innerHeight
    viewportState.orientation = window.innerWidth > window.innerHeight ? 'landscape' : 'portrait'
  }

  // 更新可视视口
  const updateVisualViewport = () => {
    if ('visualViewport' in window) {
      const vv = (window as any).visualViewport
      viewportState.visualViewport = {
        width: vv.width,
        height: vv.height,
        offsetLeft: vv.offsetLeft,
        offsetTop: vv.offsetTop,
        scale: vv.scale
      }
    }
  }

  // 检测键盘状态
  const detectKeyboard = () => {
    const initialHeight = window.innerHeight
    const currentHeight = window.innerHeight
    const keyboardHeight = initialHeight - currentHeight

    viewportState.isKeyboardVisible = keyboardHeight > 150
    viewportState.keyboardHeight = Math.max(0, keyboardHeight)
  }

  // 防抖处理
  let resizeTimer: NodeJS.Timeout
  const handleResize = () => {
    clearTimeout(resizeTimer)
    resizeTimer = setTimeout(() => {
      updateViewportSize()
      updateVisualViewport()
      detectKeyboard()
      getSafeArea()
    }, 100)
  }

  onMounted(() => {
    updateViewportSize()
    updateVisualViewport()
    getSafeArea()

    window.addEventListener('resize', handleResize)

    if ('visualViewport' in window) {
      const vv = (window as any).visualViewport
      vv.addEventListener('resize', updateVisualViewport)
      vv.addEventListener('scroll', updateVisualViewport)
    }

    // 监听焦点事件检测键盘
    document.addEventListener('focusin', detectKeyboard)
    document.addEventListener('focusout', detectKeyboard)

    // 监听方向变化
    window.addEventListener('orientationchange', handleResize)
  })

  onUnmounted(() => {
    window.removeEventListener('resize', handleResize)

    if ('visualViewport' in window) {
      const vv = (window as any).visualViewport
      vv.removeEventListener('resize', updateVisualViewport)
      vv.removeEventListener('scroll', updateVisualViewport)
    }

    document.removeEventListener('focusin', detectKeyboard)
    document.removeEventListener('focusout', detectKeyboard)
    window.removeEventListener('orientationchange', handleResize)
    clearTimeout(resizeTimer)
  })

  return {
    viewportState,
    updateViewportSize,
    getSafeArea
  }
}

// ============ 移动端性能优化 ============

/**
 * 移动端性能优化 Composable
 */
export function useMobilePerformance() {
  const performanceState = reactive({
    // 懒加载状态
    lazyLoadedImages: new Set<string>(),
    intersectionObserverSupported: 'IntersectionObserver' in window,

    // 虚拟滚动
    virtualScrollItems: [] as any[],
    visibleRange: { start: 0, end: 0 },
    itemHeight: 50,
    containerHeight: 300,

    // 内存管理
    memoryUsage: 0,
    isLowMemory: false,

    // 网络状态
    isSlowNetwork: false,
    isOnline: navigator.onLine,

    // 动画性能
    frameRate: 60,
    droppedFrames: 0
  })

  // 图片懒加载
  const createImageObserver = () => {
    if (!performanceState.intersectionObserverSupported) return null

    return new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const img = entry.target as HTMLImageElement
            if (img.dataset.src && !performanceState.lazyLoadedImages.has(img.dataset.src)) {
              img.src = img.dataset.src
              img.removeAttribute('data-src')
              performanceState.lazyLoadedImages.add(img.dataset.src)
              img.classList.add('loaded')
            }
          }
        })
      },
      {
        rootMargin: '50px 0px',
        threshold: 0.1
      }
    )
  }

  // 虚拟滚动计算
  const calculateVisibleRange = (scrollTop: number, containerHeight: number, itemHeight: number, totalItems: number) => {
    const start = Math.floor(scrollTop / itemHeight)
    const visibleCount = Math.ceil(containerHeight / itemHeight)
    const end = Math.min(start + visibleCount + 1, totalItems - 1)

    return { start: Math.max(0, start - 2), end }
  }

  // 内存监控
  const monitorMemory = () => {
    if ('memory' in performance) {
      const memory = (performance as any).memory
      const usedMemory = memory.usedJSHeapSize / 1024 / 1024 // MB
      const totalMemory = memory.jsHeapSizeLimit / 1024 / 1024 // MB

      performanceState.memoryUsage = usedMemory
      performanceState.isLowMemory = usedMemory / totalMemory > 0.8

      if (performanceState.isLowMemory) {
        logger.warn('内存使用率过高', usedMemory.toFixed(2) + 'MB')
        // 可以在这里执行内存清理操作
      }
    }
  }

  // 帧率监控
  const monitorFrameRate = () => {
    let lastTime = performance.now()
    let frames = 0

    const countFrames = () => {
      frames++
      const currentTime = performance.now()

      if (currentTime >= lastTime + 1000) {
        performanceState.frameRate = Math.round((frames * 1000) / (currentTime - lastTime))
        performanceState.droppedFrames = Math.max(0, 60 - performanceState.frameRate)
        frames = 0
        lastTime = currentTime
      }

      requestAnimationFrame(countFrames)
    }

    requestAnimationFrame(countFrames)
  }

  // 网络状态监控
  const monitorNetwork = () => {
    if ('connection' in navigator) {
      const connection = (navigator as any).connection
      const updateNetworkStatus = () => {
        performanceState.isSlowNetwork = connection.effectiveType === 'slow-2g' || connection.effectiveType === '2g'
      }

      updateNetworkStatus()
      connection.addEventListener('change', updateNetworkStatus)
    }

    window.addEventListener('online', () => {
      performanceState.isOnline = true
    })

    window.addEventListener('offline', () => {
      performanceState.isOnline = false
    })
  }

  // 优化的图片加载
  const loadImage = (src: string, options: { lazy?: boolean; quality?: number } = {}) => {
    const { lazy = true, quality = 0.8 } = options

    if (!lazy) {
      return new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image()
        img.onload = () => resolve(img)
        img.onerror = reject
        img.src = src
      })
    }

    return new Promise<HTMLImageElement>((resolve, reject) => {
      const observer = createImageObserver()
      if (!observer) {
        // 降级方案
        const img = new Image()
        img.onload = () => resolve(img)
        img.onerror = reject
        img.src = src
        return
      }

      const img = document.createElement('img')
      img.onload = () => {
        observer.unobserve(img)
        resolve(img)
      }
      img.onerror = () => {
        observer.unobserve(img)
        reject(new Error('Image load failed'))
      }

      img.dataset.src = src
      observer.observe(img)
    })
  }

  // 优化的滚动处理
  const createOptimizedScroll = (callback: (scrollTop: number) => void, delay = 16) => {
    let ticking = false

    return (event: Event) => {
      if (!ticking) {
        requestAnimationFrame(() => {
          const scrollTop = (event.target as HTMLElement).scrollTop
          callback(scrollTop)
          ticking = false
        })
        ticking = true
      }
    }
  }

  onMounted(() => {
    if (MOBILE_CONFIG.performance.enableIntersectionObserver) {
      createImageObserver()
    }

    if (MOBILE_CONFIG.performance.enableRequestIdleCallback) {
      requestIdleCallback(() => {
        monitorMemory()
        monitorFrameRate()
        monitorNetwork()
      })
    } else {
      setTimeout(() => {
        monitorMemory()
        monitorFrameRate()
        monitorNetwork()
      }, 100)
    }
  })

  return {
    performanceState,
    loadImage,
    createOptimizedScroll,
    calculateVisibleRange,
    monitorMemory
  }
}

// ============ 移动端表单优化 ============

/**
 * 移动端表单优化 Composable
 * 提供移动端友好的表单输入属性
 */
export function useMobileForm() {
  const { deviceState } = useMobileDevice()

  // 基础输入属性
  const inputProps = computed(() => ({
    // 移动端输入优化
    inputmode: 'text' as const,
    autocomplete: 'off',
    autocorrect: 'off',
    autocapitalize: 'off',
    spellcheck: false,

    // 移动端触摸优化
    tabindex: 0,

    // 响应式尺寸 - HTML size属性必须是正整数
    size: deviceState.isMobile ? 30 : 20,

    // 移动端样式类
    class: {
      'mobile-input': deviceState.isMobile,
      'tablet-input': deviceState.isTablet,
      'desktop-input': deviceState.isDesktop
    }
  }))

  // 数字输入属性
  const numberInputProps = computed(() => ({
    ...inputProps.value,
    inputmode: 'numeric' as const,
    pattern: '[0-9]*',

    // 数字输入优化
    min: 0,
    step: 'any'
  }))

  // 电话输入属性
  const phoneInputProps = computed(() => ({
    ...inputProps.value,
    inputmode: 'tel' as const,
    pattern: '[0-9]*',
    maxlength: 11,

    // 电话输入优化
    autocomplete: 'tel'
  }))

  // 邮箱输入属性
  const emailInputProps = computed(() => ({
    ...inputProps.value,
    inputmode: 'email' as const,
    type: 'email',

    // 邮箱输入优化
    autocomplete: 'email',
    autocorrect: 'off',
    autocapitalize: 'off'
  }))

  // 密码输入属性
  const passwordInputProps = computed(() => ({
    ...inputProps.value,
    type: 'password',

    // 密码输入优化
    autocomplete: 'current-password',
    autocorrect: 'off',
    autocapitalize: 'off',
    spellcheck: false
  }))

  // 搜索输入属性
  const searchInputProps = computed(() => ({
    ...inputProps.value,
    inputmode: 'search' as const,
    type: 'search',

    // 搜索输入优化
    autocomplete: 'off',
    autocorrect: 'off',
    autocapitalize: 'off',
    spellcheck: false,

    // 搜索特定属性
    enterkeyhint: 'search'
  }))

  // 日期输入属性
  const dateInputProps = computed(() => ({
    ...inputProps.value,
    type: 'date',

    // 日期输入优化
    autocomplete: 'off'
  }))

  // 时间输入属性
  const timeInputProps = computed(() => ({
    ...inputProps.value,
    type: 'time',

    // 时间输入优化
    autocomplete: 'off',
    step: 60 // 1分钟步长
  }))

  // 文本域属性
  const textareaProps = computed(() => ({
    // 移动端文本域优化
    inputmode: 'text' as const,
    autocomplete: 'off',
    autocorrect: 'on',
    autocapitalize: 'sentences',
    spellcheck: true,

    // 响应式尺寸
    rows: deviceState.isMobile ? 3 : 4,

    // 移动端样式类
    class: {
      'mobile-textarea': deviceState.isMobile,
      'tablet-textarea': deviceState.isTablet,
      'desktop-textarea': deviceState.isDesktop
    }
  }))

  // 选择框属性
  const selectProps = computed(() => ({
    // 移动端选择框优化
    tabindex: 0,

    // 响应式尺寸
    size: deviceState.isMobile ? 'large' : 'default',

    // 移动端样式类
    class: {
      'mobile-select': deviceState.isMobile,
      'tablet-select': deviceState.isTablet,
      'desktop-select': deviceState.isDesktop
    }
  }))

  // 表单容器属性
  const formProps = computed(() => ({
    // 移动端表单优化
    autocomplete: 'off',

    // 移动端样式类
    class: {
      'mobile-form': deviceState.isMobile,
      'tablet-form': deviceState.isTablet,
      'desktop-form': deviceState.isDesktop
    }
  }))

  return {
    inputProps,
    numberInputProps,
    phoneInputProps,
    emailInputProps,
    passwordInputProps,
    searchInputProps,
    dateInputProps,
    timeInputProps,
    textareaProps,
    selectProps,
    formProps
  }
}

// ============ 移动端工具函数 ============

/**
 * 检测是否为移动端浏览器
 */
export function isMobileBrowser(): boolean {
  return /Mobi|Android/i.test(navigator.userAgent)
}

/**
 * 检测是否为微信浏览器
 */
export function isWeChatBrowser(): boolean {
  return /MicroMessenger/.test(navigator.userAgent)
}

/**
 * 获取移动端设备信息
 */
export function getMobileDeviceInfo(): Partial<DeviceInfo> {
  return {
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    isMobile: isMobileBrowser(),
    isIOS: /iPhone|iPad|iPod/.test(navigator.userAgent),
    isAndroid: /Android/.test(navigator.userAgent),
    isSafari: /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent),
    isChrome: /Chrome/.test(navigator.userAgent),
    isTablet: /Tablet|iPad/i.test(navigator.userAgent),
    isDesktop: !isMobileBrowser(),
    screenSize: {
      width: screen.width,
      height: screen.height
    },
    orientation: (screen.orientation?.type?.startsWith('landscape') ? 'landscape' : 'portrait') as 'portrait' | 'landscape',
    isTouchDevice: 'ontouchstart' in window
  }
}

/**
 * 移动端优化的配置获取
 */
export function getMobileOptimizeConfig(): MobileOptimizeConfig {
  return {
    enableRipple: MOBILE_CONFIG.feedback.enableVisual,
    enableTouchFeedback: MOBILE_CONFIG.feedback.enableVisual,
    enableHapticFeedback: MOBILE_CONFIG.feedback.enableHaptic
  }
}

// ============ 导出所有移动端 Composables ============

// 为保持兼容性，添加 useMobileDetection 别名
export const useMobileDetection = useMobileDevice

export default {
  useMobileDevice,
  useMobileDetection,
  useMobileForm,
  useMobileGestures,
  useMobileViewport,
  useMobilePerformance,
  isMobileBrowser,
  isWeChatBrowser,
  getMobileDeviceInfo,
  getMobileOptimizeConfig
}
