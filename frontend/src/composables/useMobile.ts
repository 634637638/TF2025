import { ref, onMounted, onUnmounted } from 'vue'
import { BREAKPOINTS, deviceType } from '@/config/breakpoints'

/**
 * 移动端检测和适配 Composable
 * 提供响应式断点检测、触摸事件处理等移动端能力
 */
export function useMobile() {
  // 响应式状态
  const isMobile = ref(false)
  const isTablet = ref(false)
  const isDesktop = ref(false)
  const screenSize = ref({
    width: 0,
    height: 0
  })
  const orientation = ref('portrait')

  const breakpoints = {
    mobile: BREAKPOINTS.MOBILE_MAX,
    tablet: BREAKPOINTS.TABLET_MAX,
    desktop: BREAKPOINTS.DESKTOP_MIN
  }

  // 检测设备类型
  const detectDeviceType = () => {
    if (typeof window === 'undefined') return

    const width = window.innerWidth
    screenSize.value.width = width
    screenSize.value.height = window.innerHeight

    isMobile.value = deviceType.isMobile(width)
    isTablet.value = deviceType.isTablet(width)
    isDesktop.value = deviceType.isDesktop(width)

    // 检测屏幕方向
    orientation.value = width > window.innerHeight ? 'landscape' : 'portrait'
  }

  // 监听窗口大小变化
  const handleResize = () => {
    detectDeviceType()
  }

  // 监听屏幕方向变化
  const handleOrientationChange = () => {
    setTimeout(() => {
      detectDeviceType()
    }, 100) // 延迟执行，确保获取准确的尺寸
  }

  // 防抖函数
  let resizeTimer: ReturnType<typeof setTimeout> | undefined
  const debouncedResize = () => {
    if (resizeTimer) {
      clearTimeout(resizeTimer)
    }
    resizeTimer = setTimeout(handleResize, 150)
  }

  // 获取设备信息
  const getDeviceInfo = () => {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') {
      return {
        userAgent: '',
        platform: '',
        isIOS: false,
        isAndroid: false,
        isSafari: false,
        isChrome: false
      }
    }

    const userAgent = navigator.userAgent
    const platform = navigator.platform || ''

    return {
      userAgent,
      platform,
      isIOS: /iPad|iPhone|iPod/.test(userAgent),
      isAndroid: /Android/.test(userAgent),
      isSafari: /Safari/.test(userAgent) && !/Chrome/.test(userAgent),
      isChrome: /Chrome/.test(userAgent)
    }
  }

  // 检测是否支持触摸
  const isTouchDevice = () => {
    if (typeof window === 'undefined') return false
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0
  }

  // 获取安全区域 (刘海屏适配)
  const getSafeAreaInsets = () => {
    if (typeof window === 'undefined') {
      return { top: 0, right: 0, bottom: 0, left: 0 }
    }

    const computedStyle = getComputedStyle(document.documentElement)
    return {
      top: parseInt(computedStyle.getPropertyValue('--safe-area-inset-top') || '0'),
      right: parseInt(computedStyle.getPropertyValue('--safe-area-inset-right') || '0'),
      bottom: parseInt(computedStyle.getPropertyValue('--safe-area-inset-bottom') || '0'),
      left: parseInt(computedStyle.getPropertyValue('--safe-area-inset-left') || '0')
    }
  }

  // 生命周期
  onMounted(() => {
    detectDeviceType()

    // 添加事件监听器
    window.addEventListener('resize', debouncedResize)
    window.addEventListener('orientationchange', handleOrientationChange)
  })

  onUnmounted(() => {
    // 清理事件监听器
    if (typeof window !== 'undefined') {
      window.removeEventListener('resize', debouncedResize)
      window.removeEventListener('orientationchange', handleOrientationChange)
    }

    if (resizeTimer) {
      clearTimeout(resizeTimer)
    }
  })

  return {
    // 响应式状态
    isMobile,
    isTablet,
    isDesktop,
    screenSize,
    orientation,

    // 方法
    detectDeviceType,
    getDeviceInfo,
    isTouchDevice,
    getSafeAreaInsets,

    // 断点常量
    breakpoints
  }
}

/**
 * 移动端手势处理 Composable
 */
export function useMobileGestures() {
  const touchStartX = ref(0)
  const touchStartY = ref(0)
  const touchEndX = ref(0)
  const touchEndY = ref(0)

  // 滑动阈值
  const swipeThreshold = 50

  // 处理触摸开始
  const handleTouchStart = (event: TouchEvent) => {
    touchStartX.value = event.touches[0].clientX
    touchStartY.value = event.touches[0].clientY
  }

  // 处理触摸结束
  const handleTouchEnd = (event: TouchEvent) => {
    touchEndX.value = event.changedTouches[0].clientX
    touchEndY.value = event.changedTouches[0].clientY
  }

  // 计算滑动方向
  const getSwipeDirection = () => {
    const deltaX = touchEndX.value - touchStartX.value
    const deltaY = touchEndY.value - touchStartY.value

    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      // 水平滑动
      if (Math.abs(deltaX) > swipeThreshold) {
        return deltaX > 0 ? 'right' : 'left'
      }
    } else {
      // 垂直滑动
      if (Math.abs(deltaY) > swipeThreshold) {
        return deltaY > 0 ? 'down' : 'up'
      }
    }

    return 'none'
  }

  // 检测是否为左滑
  const isSwipeLeft = () => getSwipeDirection() === 'left'

  // 检测是否为右滑
  const isSwipeRight = () => getSwipeDirection() === 'right'

  // 检测是否为上滑
  const isSwipeUp = () => getSwipeDirection() === 'up'

  // 检测是否为下滑
  const isSwipeDown = () => getSwipeDirection() === 'down'

  return {
    touchStartX,
    touchStartY,
    touchEndX,
    touchEndY,
    handleTouchStart,
    handleTouchEnd,
    getSwipeDirection,
    isSwipeLeft,
    isSwipeRight,
    isSwipeUp,
    isSwipeDown,
    swipeThreshold
  }
}

/**
 * 移动端性能优化 Composable
 */
export function useMobilePerformance() {
  // 检测是否为低端设备
  const isLowEndDevice = () => {
    if (typeof window === 'undefined') return false

    // 基于硬件并发数和内存判断
    const concurrency = navigator.hardwareConcurrency || 4
    const memory = (navigator as any).deviceMemory || 4

    return concurrency <= 4 || memory <= 2
  }

  // 根据设备性能调整动画参数
  const getAnimationConfig = () => {
    const isLowEnd = isLowEndDevice()

    return {
      duration: isLowEnd ? 200 : 300,
      easing: isLowEnd ? 'ease-out' : 'cubic-bezier(0.4, 0, 0.2, 1)',
      reducedMotion: isLowEnd
    }
  }

  // 优化的防抖函数
  const useDebouncedCallback = (callback: Function, delay: number = 300) => {
    let timeoutId: NodeJS.Timeout

    return (...args: any[]) => {
      clearTimeout(timeoutId)
      timeoutId = setTimeout(() => callback(...args), delay)
    }
  }

  // 优化的节流函数
  const useThrottledCallback = (callback: Function, limit: number = 100) => {
    let inThrottle: boolean

    return (...args: any[]) => {
      if (!inThrottle) {
        callback(...args)
        inThrottle = true
        setTimeout(() => inThrottle = false, limit)
      }
    }
  }

  return {
    isLowEndDevice,
    getAnimationConfig,
    useDebouncedCallback,
    useThrottledCallback
  }
}

export default useMobile
