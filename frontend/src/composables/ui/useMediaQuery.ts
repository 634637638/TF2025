/**
 * 媒体查询 Composable
 * 提供响应式的媒体查询功能
 */

import { ref, onMounted, onUnmounted, computed, type Ref } from 'vue'
import { BREAKPOINTS as GLOBAL_BREAKPOINTS } from '@/config/breakpoints'
import logger from '@/utils/logger'

/**
 * 媒体查询选项
 */
export interface UseMediaQueryOptions {
  /**
   * 是否在初始化时立即执行
   */
  immediate?: boolean
  /**
   * 错误回调
   */
  onError?: (error: Error) => void
}

/**
 * 预定义的断点
 */
export const BREAKPOINTS = {
  xs: `${GLOBAL_BREAKPOINTS.SMALL_MOBILE_MAX}px`,
  sm: `${GLOBAL_BREAKPOINTS.TABLET_MIN}px`,
  md: `${GLOBAL_BREAKPOINTS.DESKTOP_MIN}px`,
  lg: `${GLOBAL_BREAKPOINTS.WIDE_MIN}px`,
  xl: `${GLOBAL_BREAKPOINTS.ULTRA_WIDE_MIN}px`,
  xxl: '1920px'
}

/**
 * 预定义的媒体查询
 */
export const MEDIA_QUERIES = {
  // 设备类型
  mobile: `(max-width: ${GLOBAL_BREAKPOINTS.MOBILE_MAX}px)`,
  tablet: `(min-width: ${GLOBAL_BREAKPOINTS.TABLET_MIN}px) and (max-width: ${GLOBAL_BREAKPOINTS.TABLET_MAX}px)`,
  desktop: `(min-width: ${GLOBAL_BREAKPOINTS.DESKTOP_MIN}px)`,

  // 屏幕方向
  portrait: '(orientation: portrait)',
  landscape: '(orientation: landscape)',

  // 像素密度
  retina: '(-webkit-min-device-pixel-ratio: 2), (min-resolution: 192dpi)',

  // 主题偏好
  dark: '(prefers-color-scheme: dark)',
  light: '(prefers-color-scheme: light)',

  // 减少动画偏好
  reducedMotion: '(prefers-reduced-motion: reduce)',

  // 触摸设备
  touch: '(hover: none) and (pointer: coarse)',

  // 鼠标设备
  mouse: '(hover: hover) and (pointer: fine)',

  // 高对比度模式
  highContrast: '(prefers-contrast: high)'
} as const

/**
 * 使用媒体查询
 * @param query 媒体查询字符串
 * @param options 选项
 */
export function useMediaQuery(
  query: string,
  options: UseMediaQueryOptions = {}
): Ref<boolean> {
  const { immediate = true, onError } = options

  const matches = ref<boolean>(false)
  let mediaQuery: MediaQueryList | null = null

  // 检查是否支持媒体查询
  const isSupported = typeof window !== 'undefined' && 'matchMedia' in window

  const updateMatches = (e: MediaQueryListEvent | MediaQueryList) => {
    matches.value = e.matches
  }

  const init = () => {
    if (!isSupported) {
      logger.warn('当前环境不支持媒体查询')
      return
    }

    try {
      mediaQuery = window.matchMedia(query)
      matches.value = mediaQuery.matches

      // 监听变化
      if (mediaQuery.addEventListener) {
        mediaQuery.addEventListener('change', updateMatches)
      } else {
        // 兼容旧浏览器
        mediaQuery.addListener(updateMatches)
      }
    } catch (error) {
      logger.error('创建媒体查询失败', error)
      onError?.(error as Error)
    }
  }

  const cleanup = () => {
    if (mediaQuery) {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener('change', updateMatches)
      } else {
        // 兼容旧浏览器
        mediaQuery.removeListener(updateMatches)
      }
      mediaQuery = null
    }
  }

  if (immediate) {
    onMounted(init)
    onUnmounted(cleanup)
  }

  return matches
}

/**
 * 使用响应式断点
 */
export function useBreakpoints() {
  const xs = useMediaQuery(`(max-width: ${BREAKPOINTS.xs})`)
  const sm = useMediaQuery(`(min-width: ${GLOBAL_BREAKPOINTS.SMALL_MOBILE_MAX + 1}px) and (max-width: ${GLOBAL_BREAKPOINTS.MOBILE_MAX}px)`)
  const md = useMediaQuery(MEDIA_QUERIES.tablet)
  const lg = useMediaQuery(`(min-width: ${GLOBAL_BREAKPOINTS.DESKTOP_MIN}px) and (max-width: ${GLOBAL_BREAKPOINTS.WIDE_MIN - 1}px)`)
  const xl = useMediaQuery(`(min-width: ${GLOBAL_BREAKPOINTS.WIDE_MIN}px) and (max-width: ${GLOBAL_BREAKPOINTS.ULTRA_WIDE_MIN - 1}px)`)
  const xxl = useMediaQuery(`(min-width: ${GLOBAL_BREAKPOINTS.ULTRA_WIDE_MIN}px)`)

  const current = computed(() => {
    if (xs.value) return 'xs'
    if (sm.value) return 'sm'
    if (md.value) return 'md'
    if (lg.value) return 'lg'
    if (xl.value) return 'xl'
    if (xxl.value) return 'xxl'
    return 'unknown'
  })

  const isMobile = computed(() => xs.value || sm.value)
  const isTablet = computed(() => md.value)
  const isDesktop = computed(() => lg.value || xl.value || xxl.value)
  const isLargeDesktop = computed(() => xl.value || xxl.value)

  const smaller = (breakpoint: keyof typeof BREAKPOINTS) => {
    const query = `(max-width: ${BREAKPOINTS[breakpoint]})`
    return useMediaQuery(query)
  }

  const greater = (breakpoint: keyof typeof BREAKPOINTS) => {
    const query = `(min-width: ${BREAKPOINTS[breakpoint]})`
    return useMediaQuery(query)
  }

  const between = (min: keyof typeof BREAKPOINTS, max: keyof typeof BREAKPOINTS) => {
    const query = `(min-width: ${BREAKPOINTS[min]}) and (max-width: ${BREAKPOINTS[max]})`
    return useMediaQuery(query)
  }

  return {
    xs,
    sm,
    md,
    lg,
    xl,
    xxl,
    current,
    isMobile,
    isTablet,
    isDesktop,
    isLargeDesktop,
    smaller,
    greater,
    between
  }
}

/**
 * 使用设备类型
 */
export function useDevice() {
  const isMobile = useMediaQuery(MEDIA_QUERIES.mobile)
  const isTablet = useMediaQuery(MEDIA_QUERIES.tablet)
  const isDesktop = useMediaQuery(MEDIA_QUERIES.desktop)

  const isTouch = useMediaQuery(MEDIA_QUERIES.touch)
  const isMouse = useMediaQuery(MEDIA_QUERIES.mouse)

  const isPortrait = useMediaQuery(MEDIA_QUERIES.portrait)
  const isLandscape = useMediaQuery(MEDIA_QUERIES.landscape)

  const isRetina = useMediaQuery(MEDIA_QUERIES.retina)

  const deviceType = computed(() => {
    if (isMobile.value) return 'mobile'
    if (isTablet.value) return 'tablet'
    if (isDesktop.value) return 'desktop'
    return 'unknown'
  })

  return {
    isMobile,
    isTablet,
    isDesktop,
    isTouch,
    isMouse,
    isPortrait,
    isLandscape,
    isRetina,
    deviceType
  }
}

/**
 * 使用主题偏好
 */
export function useThemePreference() {
  const isDark = useMediaQuery(MEDIA_QUERIES.dark)
  const isLight = useMediaQuery(MEDIA_QUERIES.light)
  const prefersReducedMotion = useMediaQuery(MEDIA_QUERIES.reducedMotion)
  const prefersHighContrast = useMediaQuery(MEDIA_QUERIES.highContrast)

  const theme = computed(() => isDark.value ? 'dark' : 'light')

  return {
    isDark,
    isLight,
    prefersReducedMotion,
    prefersHighContrast,
    theme
  }
}

/**
 * 自定义媒体查询Hook
 */
export function useCustomMediaQuery(queries: Record<string, string>) {
  const result: Record<string, Ref<boolean>> = {}

  for (const [key, query] of Object.entries(queries)) {
    result[key] = useMediaQuery(query)
  }

  return result
}
