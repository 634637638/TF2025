/**
 * 设备检测 Composable
 * TypeScript 增强版本
 */

import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useStorage } from '@vueuse/core'
import { BREAKPOINTS } from '@/config/breakpoints'

export interface DeviceInfo {
  isMobile: boolean
  isTablet: boolean
  isDesktop: boolean
  isMobileOrTablet: boolean
  isIOS: boolean
  isAndroid: boolean
  isWindows: boolean
  isMac: boolean
  isLinux: boolean
  isSafari: boolean
  isChrome: boolean
  isFirefox: boolean
  isEdge: boolean
  screenWidth: number
  screenHeight: number
  orientation: 'portrait' | 'landscape'
  isTouchDevice: boolean
  pixelRatio: number
  isSmallScreen: boolean
  isMediumScreen: boolean
  isLargeScreen: boolean
  isDarkMode: boolean
  isOnline: boolean
  connectionType: string
  effectiveConnectionType: string
}

export interface Breakpoints {
  xs: number
  sm: number
  md: number
  lg: number
  xl: number
  xxl: number
}

const DEFAULT_BREAKPOINTS: Breakpoints = {
  xs: 0,
  sm: BREAKPOINTS.SMALL_MOBILE_MAX + 1,
  md: BREAKPOINTS.TABLET_MIN,
  lg: BREAKPOINTS.DESKTOP_MIN,
  xl: BREAKPOINTS.WIDE_MIN,
  xxl: BREAKPOINTS.ULTRA_WIDE_MIN
}

/**
 * 设备检测 Composable
 */
export function useDeviceDetection(breakpoints: Partial<Breakpoints> = {}) {
  const mergedBreakpoints = { ...DEFAULT_BREAKPOINTS, ...breakpoints }

  // 响应式状态
  const screenWidth = ref(0)
  const screenHeight = ref(0)
  const isOnline = ref(typeof navigator !== 'undefined' ? navigator.onLine : true)
  const connectionType = ref('')
  const effectiveConnectionType = ref('')

  // 计算属性
  const deviceInfo = computed<DeviceInfo>(() => {
    const width = screenWidth.value
    const height = screenHeight.value
    const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent.toLowerCase() : ''
    const platform = typeof navigator !== 'undefined' ? navigator.platform.toLowerCase() : ''

    // 屏幕尺寸检测
    const isMobile = width < mergedBreakpoints.md
    const isTablet = width >= mergedBreakpoints.md && width < mergedBreakpoints.lg
    const isDesktop = width >= mergedBreakpoints.lg
    const isMobileOrTablet = isMobile || isTablet

    // 平台检测
    const isIOS = /iphone|ipad|ipod/.test(userAgent) || (/mac/.test(platform) && typeof document !== 'undefined' && 'ontouchend' in document)
    const isAndroid = /android/.test(userAgent)
    const isWindows = /win/.test(platform)
    const isMac = /mac/.test(platform) && !isIOS
    const isLinux = /linux/.test(platform)

    // 浏览器检测
    const isSafari = /safari/.test(userAgent) && !/chrome/.test(userAgent)
    const isChrome = /chrome/.test(userAgent) && !/edge/.test(userAgent)
    const isFirefox = /firefox/.test(userAgent)
    const isEdge = /edge/.test(userAgent) || /edg/.test(userAgent)

    // 屏幕方向
    const orientation = width > height ? 'landscape' : 'portrait'

    // 触摸设备
    const isTouchDevice = typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0)

    // 像素密度
    const pixelRatio = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1

    // 屏幕尺寸分类
    const isSmallScreen = width < mergedBreakpoints.sm
    const isMediumScreen = width >= mergedBreakpoints.sm && width < mergedBreakpoints.lg
    const isLargeScreen = width >= mergedBreakpoints.lg

    // 深色模式检测
    const isDarkMode = typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches

    return {
      isMobile,
      isTablet,
      isDesktop,
      isMobileOrTablet,
      isIOS,
      isAndroid,
      isWindows,
      isMac,
      isLinux,
      isSafari,
      isChrome,
      isFirefox,
      isEdge,
      screenWidth: width,
      screenHeight: height,
      orientation,
      isTouchDevice,
      pixelRatio,
      isSmallScreen,
      isMediumScreen,
      isLargeScreen,
      isDarkMode,
      isOnline: isOnline.value,
      connectionType: connectionType.value,
      effectiveConnectionType: effectiveConnectionType.value
    }
  })

  // 响应式断点检查
  const isXs = computed(() => screenWidth.value < mergedBreakpoints.sm)
  const isSm = computed(() => screenWidth.value >= mergedBreakpoints.sm && screenWidth.value < mergedBreakpoints.md)
  const isMd = computed(() => screenWidth.value >= mergedBreakpoints.md && screenWidth.value < mergedBreakpoints.lg)
  const isLg = computed(() => screenWidth.value >= mergedBreakpoints.lg && screenWidth.value < mergedBreakpoints.xl)
  const isXl = computed(() => screenWidth.value >= mergedBreakpoints.xl && screenWidth.value < mergedBreakpoints.xxl)
  const isXxl = computed(() => screenWidth.value >= mergedBreakpoints.xxl)

  // 当前断点
  const currentBreakpoint = computed(() => {
    if (isXs.value) return 'xs'
    if (isSm.value) return 'sm'
    if (isMd.value) return 'md'
    if (isLg.value) return 'lg'
    if (isXl.value) return 'xl'
    return 'xxl'
  })

  // 响应式工具函数
  const updateScreenSize = () => {
    screenWidth.value = window.innerWidth
    screenHeight.value = window.innerHeight
  }

  // 获取网络连接信息
  const updateConnectionInfo = () => {
    const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection
    if (connection) {
      connectionType.value = connection.type || 'unknown'
      effectiveConnectionType.value = connection.effectiveType || 'unknown'
    }
  }

  // 事件监听器
  const handleResize = () => {
    updateScreenSize()
  }

  const handleOnline = () => {
    isOnline.value = true
  }

  const handleOffline = () => {
    isOnline.value = false
  }

  const handleConnectionChange = () => {
    updateConnectionInfo()
  }

  // 生命周期
  onMounted(() => {
    updateScreenSize()
    updateConnectionInfo()

    // 添加事件监听器
    window.addEventListener('resize', handleResize)
    window.addEventListener('orientationchange', handleResize)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    if ((navigator as any).connection) {
      (navigator as any).connection.addEventListener('change', handleConnectionChange)
    }
  })

  onUnmounted(() => {
    // 移除事件监听器
    window.removeEventListener('resize', handleResize)
    window.removeEventListener('orientationchange', handleResize)
    window.removeEventListener('online', handleOnline)
    window.removeEventListener('offline', handleOffline)

    if ((navigator as any).connection) {
      (navigator as any).connection.removeEventListener('change', handleConnectionChange)
    }
  })

  // 媒体查询工具
  const useMediaQuery = (query: string) => {
    const matches = ref(false)

    if (typeof window !== 'undefined') {
      const mediaQuery = window.matchMedia(query)
      matches.value = mediaQuery.matches

      const updateMatches = (e: MediaQueryListEvent) => {
        matches.value = e.matches
      }

      mediaQuery.addEventListener('change', updateMatches)

      onUnmounted(() => {
        mediaQuery.removeEventListener('change', updateMatches)
      })
    }

    return matches
  }

  // 预定义媒体查询
  const isPortrait = useMediaQuery('(orientation: portrait)')
  const isLandscape = useMediaQuery('(orientation: landscape)')
  const isDarkMode = useMediaQuery('(prefers-color-scheme: dark)')
  const isLightMode = useMediaQuery('(prefers-color-scheme: light)')
  const isReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)')

  // 移动端特定检测
  const isMobileDevice = computed(() => {
    return /Mobi|Android/i.test(navigator.userAgent)
  })

  const isSmallMobileDevice = computed(() => {
    return isMobileDevice.value && screenWidth.value < 375
  })

  const isIPhone = computed(() => {
    return /iPhone/i.test(navigator.userAgent)
  })

  const isIPad = computed(() => {
    return /iPad/i.test(navigator.userAgent)
  })

  // 存储设备信息到本地存储（可选）
  const deviceInfoStorage = useStorage<DeviceInfo | null>('device-info', null)

  return {
    // 设备信息
    deviceInfo,
    deviceInfoStorage,

    // 断点检查
    isXs,
    isSm,
    isMd,
    isLg,
    isXl,
    isXxl,
    currentBreakpoint,

    // 媒体查询
    useMediaQuery,
    isPortrait,
    isLandscape,
    isDarkMode,
    isLightMode,
    isReducedMotion,

    // 移动端检测
    isMobileDevice,
    isSmallMobileDevice,
    isIPhone,
    isIPad,

    // 工具函数
    updateScreenSize,
    updateConnectionInfo
  }
}

/**
 * 简化版设备检测 Composable
 */
export function useDevice() {
  const { deviceInfo } = useDeviceDetection()
  return deviceInfo
}

/**
 * 响应式断点 Composable
 */
export function useBreakpoints() {
  const { isXs, isSm, isMd, isLg, isXl, isXxl, currentBreakpoint, deviceInfo } = useDeviceDetection()

  return {
    isXs,
    isSm,
    isMd,
    isLg,
    isXl,
    isXxl,
    currentBreakpoint,
    isMobile: computed(() => deviceInfo.value.isMobile),
    isTablet: computed(() => deviceInfo.value.isTablet),
    isDesktop: computed(() => deviceInfo.value.isDesktop),
    isMobileOrTablet: computed(() => deviceInfo.value.isMobileOrTablet)
  }
}

/**
 * 移动端适配 Composable
 */
export function useMobileAdaptation() {
  const { deviceInfo, isMobileDevice, isSmallMobileDevice, isPortrait } = useDeviceDetection()

  // 移动端样式类
  const mobileClasses = computed(() => ({
    'device-mobile': deviceInfo.value.isMobile,
    'device-tablet': deviceInfo.value.isTablet,
    'device-desktop': deviceInfo.value.isDesktop,
    'device-ios': deviceInfo.value.isIOS,
    'device-android': deviceInfo.value.isAndroid,
    'device-touch': deviceInfo.value.isTouchDevice,
    'orientation-portrait': deviceInfo.value.orientation === 'portrait',
    'orientation-landscape': deviceInfo.value.orientation === 'landscape',
    'device-small': deviceInfo.value.isSmallScreen,
    'device-medium': deviceInfo.value.isMediumScreen,
    'device-large': deviceInfo.value.isLargeScreen
  }))

  // 响应式字体大小
  const responsiveFontSize = computed(() => {
    if (deviceInfo.value.isSmallScreen) return '14px'
    if (deviceInfo.value.isMediumScreen) return '16px'
    return '18px'
  })

  // 触摸友好的点击区域大小
  const touchTargetSize = computed(() => {
    if (deviceInfo.value.isTouchDevice) {
      return {
        minWidth: '44px',
        minHeight: '44px',
        padding: '12px 16px'
      }
    }
    return {
      minWidth: '32px',
      minHeight: '32px',
      padding: '8px 12px'
    }
  })

  return {
    deviceInfo,
    mobileClasses,
    responsiveFontSize,
    touchTargetSize,
    isMobile: isMobileDevice,
    isTablet: isSmallMobileDevice,
    isPortrait
  }
}
