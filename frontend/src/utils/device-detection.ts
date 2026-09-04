export interface DeviceDetectionSnapshot {
  userAgent: string
  platform: string
  isIOS: boolean
  isAndroid: boolean
  isStandalone: boolean
  isTouchDevice: boolean
}

const SAFARI_PHONE_FALLBACK_WIDTH = 430

const getUserAgent = (): string => {
  if (typeof navigator === 'undefined') return ''
  return navigator.userAgent || ''
}

const getPlatform = (): string => {
  if (typeof navigator === 'undefined') return ''
  return navigator.platform || ''
}

const hasTouchLikeInput = (): boolean => {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false
  return (
    navigator.maxTouchPoints > 0 ||
    'ontouchstart' in window ||
    window.matchMedia?.('(pointer: coarse)').matches === true
  )
}

const isAppleSafariRuntime = (userAgent = getUserAgent(), platform = getPlatform()): boolean => {
  const ua = userAgent.toLowerCase()
  const isSafari = /safari/.test(ua) && !/chrome|crios|fxios|edg|opr|android/.test(ua)
  return /iphone|ipad|ipod/.test(ua) || (platform === 'MacIntel' && isSafari) || (/macintosh|mac os x/.test(ua) && isSafari)
}

const getPhoneLikeScreenFallbackWidth = (): number | null => {
  if (typeof window === 'undefined') return null

  const screenWidth = window.screen?.width || 0
  const screenHeight = window.screen?.height || 0
  const shortSide = Math.min(screenWidth, screenHeight)
  const longSide = Math.max(screenWidth, screenHeight)
  const aspectRatio = shortSide > 0 ? longSide / shortSide : 0
  const devicePixelRatio = window.devicePixelRatio || 1
  const logicalShortSide = devicePixelRatio > 1 ? shortSide / devicePixelRatio : 0

  if (!hasTouchLikeInput()) return null
  if (aspectRatio < 1.55) return null
  if (shortSide > 0 && shortSide <= 700) return shortSide
  if (logicalShortSide > 0 && logicalShortSide <= 450) return logicalShortSide
  if (shortSide > 0 && shortSide <= 1100) return SAFARI_PHONE_FALLBACK_WIDTH
  return null
}

export const normalizeSafariPhoneViewportMeta = (): void => {
  if (typeof window === 'undefined' || typeof document === 'undefined') return
  if (!isAppleSafariRuntime()) return

  const fallbackWidth = getPhoneLikeScreenFallbackWidth()
  if (fallbackWidth === null) return

  const visualViewportWidth = window.visualViewport?.width || 0
  const visualViewportScale = window.visualViewport?.scale || 1
  const layoutWidth = window.innerWidth || visualViewportWidth
  const viewportLooksZoomedOut = visualViewportScale < 0.9 || layoutWidth >= fallbackWidth * 1.5

  if (!viewportLooksZoomedOut) return

  const viewport = document.querySelector<HTMLMetaElement>('meta[name="viewport"]')
  const content = `width=${Math.round(fallbackWidth)}, initial-scale=1.0, viewport-fit=cover`

  if (viewport) {
    viewport.content = content
  } else {
    const meta = document.createElement('meta')
    meta.name = 'viewport'
    meta.content = content
    document.head.prepend(meta)
  }
}

export const getViewportDimensions = (): { width: number, height: number, scale: number } => {
  if (typeof window === 'undefined') {
    return { width: 0, height: 0, scale: 1 }
  }

  const visualViewport = window.visualViewport
  const candidatesWidth = [
    visualViewport?.width,
    window.innerWidth,
    window.screen?.width
  ].filter((value): value is number => typeof value === 'number' && value > 0)

  const candidatesHeight = [
    visualViewport?.height,
    window.innerHeight,
    window.screen?.height
  ].filter((value): value is number => typeof value === 'number' && value > 0)

  const width = Math.round(Math.min(...candidatesWidth))
  const height = Math.round(Math.min(...candidatesHeight))
  const phoneFallbackWidth = isAppleSafariRuntime() ? getPhoneLikeScreenFallbackWidth() : null

  return {
    width: phoneFallbackWidth !== null && width >= 768 ? Math.round(Math.min(width, phoneFallbackWidth)) : width,
    height,
    scale: visualViewport?.scale ?? 1
  }
}

export const isIOSDevice = (userAgent = getUserAgent(), platform = getPlatform()): boolean => {
  const ua = userAgent.toLowerCase()
  return /iphone|ipad|ipod/.test(ua) || (platform === 'MacIntel' && typeof navigator !== 'undefined' && navigator.maxTouchPoints > 1)
}

export const isIPhoneLikeDevice = (userAgent = getUserAgent(), platform = getPlatform()): boolean => {
  if (/iphone|ipod/.test(userAgent.toLowerCase())) return true

  if (!isAppleSafariRuntime(userAgent, platform)) return false

  // Safari 的“请求桌面网站”会把 iPhone UA 改成 Macintosh，
  // 部分站点设置下可能拿不到 maxTouchPoints，此时用真实屏幕尺寸和比例兜底。
  return getPhoneLikeScreenFallbackWidth() !== null
}

export const isIPadLikeDevice = (userAgent = getUserAgent(), platform = getPlatform()): boolean => {
  const ua = userAgent.toLowerCase()
  if (/ipad/.test(ua)) return true
  if (isIPhoneLikeDevice(userAgent, platform)) return false

  if (
    typeof navigator === 'undefined' ||
    platform !== 'MacIntel' ||
    navigator.maxTouchPoints <= 1 ||
    typeof window === 'undefined'
  ) {
    return false
  }

  const screenWidth = window.screen?.width || 0
  const screenHeight = window.screen?.height || 0
  const shortSide = Math.min(screenWidth, screenHeight)
  const longSide = Math.max(screenWidth, screenHeight)
  const aspectRatio = shortSide > 0 ? longSide / shortSide : 0

  // iPad Safari 的“请求桌面网站”会返回 Macintosh UA；
  // iPad 屏幕比例明显低于 iPhone，仍保留触摸能力。
  return shortSide > 0 && aspectRatio >= 1.2 && aspectRatio < 1.75
}

export const applyDeviceRootClass = (): void => {
  if (typeof document === 'undefined') return

  const root = document.documentElement
  const ios = isIOSDevice()
  const phone = isIPhoneLikeDevice()
  const tablet = !phone && isIPadLikeDevice()

  root.classList.toggle('device-ios', ios)
  root.classList.toggle('device-phone', phone)
  root.classList.toggle('device-tablet', tablet)
  root.classList.toggle('device-standalone', isStandaloneDisplayMode())
}

export const isStandaloneDisplayMode = (): boolean => {
  if (typeof window === 'undefined') return false
  const standalone = window.matchMedia?.('(display-mode: standalone)').matches ?? false
  const legacyStandalone = typeof navigator !== 'undefined' && 'standalone' in navigator
    ? Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
    : false
  return standalone || legacyStandalone
}

export const isIOSStandaloneApp = (): boolean => {
  const userAgent = getUserAgent()
  const platform = getPlatform()
  return isIOSDevice(userAgent, platform) && isStandaloneDisplayMode()
}

export const isMobileViewport = (width: number, userAgent = getUserAgent(), platform = getPlatform()): boolean => {
  const ua = userAgent.toLowerCase()
  if (isIPhoneLikeDevice(userAgent, platform) || isIOSStandaloneApp()) return true
  if (isIPadLikeDevice(userAgent, platform)) return false
  return width < 768 || (/mobi|android/i.test(ua) && !isIOSDevice(userAgent, platform))
}

export const isTabletViewport = (width: number, userAgent = getUserAgent(), platform = getPlatform()): boolean => {
  if (isIPhoneLikeDevice(userAgent, platform) || isIOSStandaloneApp()) return false
  if (isIPadLikeDevice(userAgent, platform)) return true
  if (isMobileViewport(width, userAgent, platform)) return false
  return width >= 768 && width < 1024
}

export const isCurrentMobileViewport = (): boolean => {
  if (typeof window === 'undefined') return false
  return isMobileViewport(getViewportDimensions().width)
}
