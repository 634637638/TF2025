/**
 * TF2025 统一响应式系统
 * 使用统一的断点配置和尺寸系统
 */

import { ref, computed, onMounted, onUnmounted, readonly, type Ref } from 'vue'
import { BREAKPOINTS, BreakpointName, deviceType } from '@/config/breakpoints'
import { SIZES, RESPONSIVE_SIZES, BREAKPOINT_SIZES } from '@/config/sizes'

// 响应式状态接口
export interface ResponsiveState {
  // 屏幕尺寸
  screenWidth: number
  screenHeight: number
  viewportWidth: number
  viewportHeight: number

  // 设备类型
  isSmallMobile: boolean
  isMobile: boolean
  isTablet: boolean
  isDesktop: boolean
  isWide: boolean
  isUltraWide: boolean

  // 当前断点
  currentBreakpoint: BreakpointName

  // 方向
  orientation: 'portrait' | 'landscape'

  // 设备信息
  isTouchDevice: boolean
  isIOS: boolean
  isAndroid: boolean
  devicePixelRatio: number

  // 安全区域
  safeArea: {
    top: number
    right: number
    bottom: number
    left: number
  }
}

// 内部状态
const state = ref<ResponsiveState>({
  screenWidth: 1920,
  screenHeight: 1080,
  viewportWidth: 1920,
  viewportHeight: 1080,
  isSmallMobile: false,
  isMobile: false,
  isTablet: false,
  isDesktop: true,
  isWide: false,
  isUltraWide: false,
  currentBreakpoint: BreakpointName.DESKTOP,
  orientation: 'landscape',
  isTouchDevice: false,
  isIOS: false,
  isAndroid: false,
  devicePixelRatio: 1,
  safeArea: {
    top: 0,
    right: 0,
    bottom: 0,
    left: 0
  }
})

// 更新响应式状态
function updateResponsiveState() {
  if (typeof window === 'undefined') return

  const width = window.innerWidth
  const height = window.innerHeight

  // 更新基础尺寸
  state.value.screenWidth = window.screen.width
  state.value.screenHeight = window.screen.height
  state.value.viewportWidth = width
  state.value.viewportHeight = height

  // 更新设备类型
  state.value.isSmallMobile = deviceType.isSmallMobile(width)
  state.value.isMobile = deviceType.isMobile(width)
  state.value.isTablet = deviceType.isTablet(width)
  state.value.isDesktop = deviceType.isDesktop(width)
  state.value.isWide = deviceType.isWide(width)
  state.value.isUltraWide = deviceType.isUltraWide(width)

  // 更新当前断点
  state.value.currentBreakpoint = getCurrentBreakpoint(width)

  // 更新方向
  state.value.orientation = width > height ? 'landscape' : 'portrait'

  // 更新设备信息
  updateDeviceInfo()

  // 更新安全区域
  updateSafeArea()
}

// 获取当前断点
function getCurrentBreakpoint(width: number): BreakpointName {
  if (width < BREAKPOINTS.SMALL_MOBILE_MAX) return BreakpointName.SMALL_MOBILE
  if (width < BREAKPOINTS.MOBILE_MAX) return BreakpointName.MOBILE
  if (width < BREAKPOINTS.TABLET_MIN) return BreakpointName.MOBILE
  if (width < BREAKPOINTS.DESKTOP_MIN) return BreakpointName.TABLET
  if (width < BREAKPOINTS.WIDE_MIN) return BreakpointName.DESKTOP
  if (width < BREAKPOINTS.ULTRA_WIDE_MIN) return BreakpointName.WIDE
  return BreakpointName.ULTRA_WIDE
}

// 更新设备信息
function updateDeviceInfo() {
  const ua = navigator.userAgent.toLowerCase()

  state.value.isTouchDevice = 'ontouchend' in document
  state.value.isIOS = /iphone|ipad|ipod/.test(ua)
  state.value.isAndroid = /android/.test(ua)
  state.value.devicePixelRatio = window.devicePixelRatio || 1
}

// 更新安全区域
function updateSafeArea() {
  const computedStyle = getComputedStyle(document.documentElement)
  const top = parseInt(computedStyle.getPropertyValue('--safe-area-inset-top') || '0')
  const right = parseInt(computedStyle.getPropertyValue('--safe-area-inset-right') || '0')
  const bottom = parseInt(computedStyle.getPropertyValue('--safe-area-inset-bottom') || '0')
  const left = parseInt(computedStyle.getPropertyValue('--safe-area-inset-left') || '0')

  state.value.safeArea = { top, right, bottom, left }
}

// 响应式组合式函数
export function useResponsive() {
  // 更新状态
  const update = () => updateResponsiveState()

  // 生命周期
  onMounted(() => {
    update()
    window.addEventListener('resize', update, { passive: true })
    window.addEventListener('orientationchange', update, { passive: true })
  })

  onUnmounted(() => {
    window.removeEventListener('resize', update)
    window.removeEventListener('orientationchange', update)
  })

  // 计算属性
  const currentSizeConfig = computed(() =>
    BREAKPOINT_SIZES[state.value.currentBreakpoint] || BREAKPOINT_SIZES[BreakpointName.DESKTOP]
  )

  // 响应式尺寸
  const responsiveSizes = computed(() => ({
    // 当前断点的配置
    ...currentSizeConfig.value,

    // 容器配置
    containerMaxWidth: computed(() => {
      switch (state.value.currentBreakpoint) {
        case BreakpointName.SMALL_MOBILE:
        case BreakpointName.MOBILE:
          return RESPONSIVE_SIZES.CONTAINER_MAX_WIDTH.MOBILE
        case BreakpointName.TABLET:
          return RESPONSIVE_SIZES.CONTAINER_MAX_WIDTH.TABLET
        case BreakpointName.DESKTOP:
          return RESPONSIVE_SIZES.CONTAINER_MAX_WIDTH.DESKTOP
        case BreakpointName.WIDE:
          return RESPONSIVE_SIZES.CONTAINER_MAX_WIDTH.WIDE
        default:
          return RESPONSIVE_SIZES.CONTAINER_MAX_WIDTH.ULTRA_WIDE
      }
    }),

    // 按钮高度
    buttonHeight: computed(() => currentSizeConfig.value.BUTTON_HEIGHT),

    // 容器内边距
    containerPadding: computed(() => currentSizeConfig.value.CONTAINER_PADDING),

    // 字体缩放
    fontScale: computed(() => currentSizeConfig.value.FONT_SCALE || 1)
  }))

  // 媒体查询工具
  const mediaQuery = {
    mobile: computed(() => state.value.isMobile),
    tablet: computed(() => state.value.isTablet),
    desktop: computed(() => state.value.isDesktop),
    smallMobile: computed(() => state.value.isSmallMobile),
    portrait: computed(() => state.value.orientation === 'portrait'),
    landscape: computed(() => state.value.orientation === 'landscape'),
    touch: computed(() => state.value.isTouchDevice)
  }

  // 返回只读状态
  return {
    // 基础信息
    ...readonly(state),

    // 响应式尺寸配置
    responsiveSizes,

    // 媒体查询
    mediaQuery,

    // 工具函数
    BREAKPOINTS,
    SIZES,
    RESPONSIVE_SIZES
  }
}

// 全局响应式状态（用于非组件环境）
let globalResponsiveState: ReturnType<typeof useResponsive> | null = null

export function getGlobalResponsiveState() {
  if (!globalResponsiveState) {
    globalResponsiveState = useResponsive() as any
  }
  return globalResponsiveState
}

// 类型导出
export type ResponsiveReturn = ReturnType<typeof useResponsive>
export type ResponsiveMediaQuery = ResponsiveReturn['mediaQuery']
export type ResponsiveSizes = ResponsiveReturn['responsiveSizes']