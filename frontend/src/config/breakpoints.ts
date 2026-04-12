/**
 * TF2025 响应式断点配置
 * 统一管理所有断点值，避免硬编码
 */

// 断点常量定义
export const BREAKPOINTS = {
  // 最小支持宽度
  MIN: 375,

  // 移动端断点
  MOBILE_MAX: 767,  // 所有手机（不包括iPad）
  SMALL_MOBILE_MAX: 479,  // 小屏手机

  // 平板端断点
  TABLET_MIN: 768,
  TABLET_MAX: 1023,

  // 桌面端断点
  DESKTOP_MIN: 1024,
  WIDE_MIN: 1200,
  ULTRA_WIDE_MIN: 1440
} as const

// 断点名称枚举
export enum BreakpointName {
  MIN = 'min',
  SMALL_MOBILE = 'small-mobile',
  MOBILE = 'mobile',
  TABLET = 'tablet',
  DESKTOP = 'desktop',
  WIDE = 'wide',
  ULTRA_WIDE = 'ultra-wide'
}

// 断点值映射
export const BREAKPOINT_VALUES: Record<BreakpointName, number> = {
  [BreakpointName.MIN]: BREAKPOINTS.MIN,
  [BreakpointName.SMALL_MOBILE]: BREAKPOINTS.SMALL_MOBILE_MAX,
  [BreakpointName.MOBILE]: BREAKPOINTS.MOBILE_MAX,
  [BreakpointName.TABLET]: BREAKPOINTS.TABLET_MIN,
  [BreakpointName.DESKTOP]: BREAKPOINTS.DESKTOP_MIN,
  [BreakpointName.WIDE]: BREAKPOINTS.WIDE_MIN,
  [BreakpointName.ULTRA_WIDE]: BREAKPOINTS.ULTRA_WIDE_MIN
}

// 媒体查询生成器
export const mediaQueries = {
  // 移动端（包括小屏）
  mobile: `@media (max-width: ${BREAKPOINTS.MOBILE_MAX}px)`,

  // 小屏手机
  smallMobile: `@media (max-width: ${BREAKPOINTS.SMALL_MOBILE_MAX}px)`,

  // 平板及以上
  tabletUp: `@media (min-width: ${BREAKPOINTS.TABLET_MIN}px)`,

  // 桌面及以上
  desktopUp: `@media (min-width: ${BREAKPOINTS.DESKTOP_MIN}px)`,

  // 大屏及以上
  wideUp: `@media (min-width: ${BREAKPOINTS.WIDE_MIN}px)`,

  // 超大屏
  ultraWideUp: `@media (min-width: ${BREAKPOINTS.ULTRA_WIDE_MIN}px)`,

  // 平板专用
  tabletOnly: `@media (min-width: ${BREAKPOINTS.TABLET_MIN}px) and (max-width: ${BREAKPOINTS.TABLET_MAX}px)`,

  // 移动端和桌面端（不包括平板）
  mobileAndDesktopOnly: `@media (max-width: ${BREAKPOINTS.MOBILE_MAX}px), (min-width: ${BREAKPOINTS.DESKTOP_MIN}px)`
} as const

// CSS 自定义属性生成器
export const generateCSSVariables = () => {
  return {
    '--breakpoint-min': `${BREAKPOINTS.MIN}px`,
    '--breakpoint-small-mobile-max': `${BREAKPOINTS.SMALL_MOBILE_MAX}px`,
    '--breakpoint-mobile-max': `${BREAKPOINTS.MOBILE_MAX}px`,
    '--breakpoint-tablet-min': `${BREAKPOINTS.TABLET_MIN}px`,
    '--breakpoint-tablet-max': `${BREAKPOINTS.TABLET_MAX}px`,
    '--breakpoint-desktop-min': `${BREAKPOINTS.DESKTOP_MIN}px`,
    '--breakpoint-wide-min': `${BREAKPOINTS.WIDE_MIN}px`,
    '--breakpoint-ultra-wide-min': `${BREAKPOINTS.ULTRA_WIDE_MIN}px`
  }
}

// 断点检测工具函数
export const getBreakpoint = (width: number): BreakpointName => {
  if (width < BREAKPOINTS.SMALL_MOBILE_MAX) return BreakpointName.SMALL_MOBILE
  if (width < BREAKPOINTS.MOBILE_MAX) return BreakpointName.MOBILE
  if (width < BREAKPOINTS.TABLET_MIN) return BreakpointName.MOBILE
  if (width < BREAKPOINTS.DESKTOP_MIN) return BreakpointName.TABLET
  if (width < BREAKPOINTS.WIDE_MIN) return BreakpointName.DESKTOP
  if (width < BREAKPOINTS.ULTRA_WIDE_MIN) return BreakpointName.WIDE
  return BreakpointName.ULTRA_WIDE
}

// 判断设备类型
export const deviceType = {
  isSmallMobile: (width: number) => width <= BREAKPOINTS.SMALL_MOBILE_MAX,
  isMobile: (width: number) => width <= BREAKPOINTS.MOBILE_MAX,
  isTablet: (width: number) => width >= BREAKPOINTS.TABLET_MIN && width <= BREAKPOINTS.TABLET_MAX,
  isDesktop: (width: number) => width >= BREAKPOINTS.DESKTOP_MIN,
  isWide: (width: number) => width >= BREAKPOINTS.WIDE_MIN,
  isUltraWide: (width: number) => width >= BREAKPOINTS.ULTRA_WIDE_MIN
} as const

// 导出默认值
export default {
  BREAKPOINTS,
  BreakpointName,
  BREAKPOINT_VALUES,
  mediaQueries,
  generateCSSVariables,
  getBreakpoint,
  deviceType
}