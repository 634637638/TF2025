export interface DeviceDetectionSnapshot {
  userAgent: string
  platform: string
  isIOS: boolean
  isAndroid: boolean
  isStandalone: boolean
  isTouchDevice: boolean
}

const getUserAgent = (): string => {
  if (typeof navigator === 'undefined') return ''
  return navigator.userAgent || ''
}

const getPlatform = (): string => {
  if (typeof navigator === 'undefined') return ''
  return navigator.platform || ''
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

  return {
    width: Math.round(Math.min(...candidatesWidth)),
    height: Math.round(Math.min(...candidatesHeight)),
    scale: visualViewport?.scale ?? 1
  }
}

export const isIOSDevice = (userAgent = getUserAgent(), platform = getPlatform()): boolean => {
  const ua = userAgent.toLowerCase()
  return /iphone|ipad|ipod/.test(ua) || (platform === 'MacIntel' && typeof navigator !== 'undefined' && navigator.maxTouchPoints > 1)
}

export const isIPhoneLikeDevice = (userAgent = getUserAgent()): boolean => {
  if (/iphone|ipod/.test(userAgent.toLowerCase())) return true

  if (
    typeof navigator === 'undefined' ||
    navigator.platform !== 'MacIntel' ||
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
  const devicePixelRatio = window.devicePixelRatio || 1
  const logicalShortSide = shortSide / devicePixelRatio

  // Safari 的“请求桌面网站”会把 iPhone UA 改成 Macintosh，
  // 但仍保留触摸能力和手机屏幕比例。
  return (
    (shortSide > 0 && shortSide <= 700 && aspectRatio >= 1.55) ||
    (logicalShortSide > 0 && logicalShortSide <= 450 && aspectRatio >= 1.55)
  )
}

export const isIPadLikeDevice = (userAgent = getUserAgent()): boolean => {
  const ua = userAgent.toLowerCase()
  if (/ipad/.test(ua)) return true

  if (
    typeof navigator === 'undefined' ||
    navigator.platform !== 'MacIntel' ||
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
  const tablet = isIPadLikeDevice()

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
  if (isIPadLikeDevice(userAgent)) return false
  return width < 768 || isIPhoneLikeDevice(userAgent) || isIOSStandaloneApp() || (/mobi|android/i.test(ua) && !isIOSDevice(userAgent, platform))
}

export const isTabletViewport = (width: number, userAgent = getUserAgent(), platform = getPlatform()): boolean => {
  if (isIPadLikeDevice(userAgent)) return true
  if (isMobileViewport(width, userAgent, platform)) return false
  return width >= 768 && width < 1024
}
