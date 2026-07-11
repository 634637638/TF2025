import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useMobile } from './mobile'

type ClassValue = string | number | boolean | null | undefined | Record<string, boolean | null | undefined>

interface SafeAreaInsets {
  top: number
  right: number
  bottom: number
  left: number
}

const readSafeAreaInsets = (): SafeAreaInsets => {
  if (typeof window === 'undefined') {
    return { top: 0, right: 0, bottom: 0, left: 0 }
  }

  const computedStyle = getComputedStyle(document.documentElement)
  return {
    top: parseInt(computedStyle.getPropertyValue('--safe-area-inset-top') || '0', 10) || 0,
    right: parseInt(computedStyle.getPropertyValue('--safe-area-inset-right') || '0', 10) || 0,
    bottom: parseInt(computedStyle.getPropertyValue('--safe-area-inset-bottom') || '0', 10) || 0,
    left: parseInt(computedStyle.getPropertyValue('--safe-area-inset-left') || '0', 10) || 0
  }
}

export const clsx = (...values: ClassValue[]) => {
  const classes: string[] = []

  values.forEach((value) => {
    if (!value) return

    if (typeof value === 'string' || typeof value === 'number') {
      classes.push(String(value))
      return
    }

    if (typeof value === 'object') {
      Object.entries(value).forEach(([className, enabled]) => {
        if (enabled) {
          classes.push(className)
        }
      })
    }
  })

  return classes.join(' ')
}

export const useResponsive = () => {
  const mobile = useMobile()

  const deviceInfo = computed(() => ({
    safeArea: mobile.safeArea.value,
    isTouchDevice: mobile.isTouchDevice.value,
    isIOS: mobile.isIOS.value,
    isAndroid: mobile.isAndroid.value,
    devicePixelRatio: mobile.devicePixelRatio.value,
    orientation: mobile.orientation.value,
    breakpoint: mobile.breakpoint.value,
    screenWidth: mobile.screenWidth.value,
    screenHeight: mobile.screenHeight.value
  }))

  return {
    ...mobile,
    deviceInfo,
    mediaQuery: {
      mobile: mobile.isMobile,
      tablet: mobile.isTablet,
      desktop: mobile.isDesktop,
      smallMobile: mobile.isSmallMobile,
      portrait: computed(() => mobile.orientation.value === 'portrait'),
      landscape: computed(() => mobile.orientation.value === 'landscape'),
      touch: mobile.isTouchDevice
    }
  }
}

export const useSafeArea = () => {
  const safeArea = ref<SafeAreaInsets>(readSafeAreaInsets())

  const updateSafeArea = () => {
    safeArea.value = readSafeAreaInsets()
  }

  onMounted(() => {
    updateSafeArea()
    window.addEventListener('resize', updateSafeArea, { passive: true })
    window.addEventListener('orientationchange', updateSafeArea, { passive: true })
  })

  onUnmounted(() => {
    window.removeEventListener('resize', updateSafeArea)
    window.removeEventListener('orientationchange', updateSafeArea)
  })

  return { safeArea }
}

export const useVirtualKeyboard = () => {
  const initialHeight = typeof window === 'undefined' ? 0 : window.innerHeight
  const viewportHeight = ref(initialHeight)
  const keyboardHeight = ref(0)

  const updateKeyboardState = () => {
    if (typeof window === 'undefined') return

    const visualViewportHeight = window.visualViewport?.height ?? window.innerHeight
    const currentKeyboardHeight = Math.max(0, window.innerHeight - visualViewportHeight)

    viewportHeight.value = visualViewportHeight
    keyboardHeight.value = currentKeyboardHeight > 80 ? Math.round(currentKeyboardHeight) : 0
  }

  onMounted(() => {
    updateKeyboardState()
    window.visualViewport?.addEventListener('resize', updateKeyboardState, { passive: true })
    window.visualViewport?.addEventListener('scroll', updateKeyboardState, { passive: true })
    window.addEventListener('resize', updateKeyboardState, { passive: true })
  })

  onUnmounted(() => {
    window.visualViewport?.removeEventListener('resize', updateKeyboardState)
    window.visualViewport?.removeEventListener('scroll', updateKeyboardState)
    window.removeEventListener('resize', updateKeyboardState)
  })

  return {
    isKeyboardVisible: computed(() => keyboardHeight.value > 0),
    keyboardHeight,
    viewportHeight
  }
}
