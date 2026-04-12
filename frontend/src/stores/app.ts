/**
 * 全局应用状态管理
 * 提供应用配置、主题、设置、系统信息等功能
 */

import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { useTime } from '@/utils/time'
import { storage } from '@/services/storage'
import { PREFERENCE_STORAGE_KEYS } from '@/constants/storage'
import type { AppLanguage, DeviceInfo, SystemInfo, ThemeMode } from '@/types'

export const useAppStore = defineStore('app', () => {
  // =========== 主题相关 ===========
  const theme = ref<ThemeMode>('light')
  const primaryColor = ref('#409eff')
  const customColors = ref<Record<string, string>>({})
  const fontSize = ref<number>(14)
  const borderRadius = ref<number>(4)

  // =========== 语言和地区 ===========
  const language = ref<AppLanguage>('zh-CN')
  const timezone = ref<string>('Asia/Shanghai')
  const dateFormat = ref<string>('YYYY-MM-DD')
  const timeFormat = ref<string>('HH:mm:ss')
  const currency = ref<string>('CNY')
  const numberFormat = ref<string>('zh-CN')

  // =========== 布局相关 ===========
  const sidebarCollapsed = ref<boolean>(false)
  const sidebarWidth = ref<number>(240)
  const headerHeight = ref<number>(60)
  const contentPadding = ref<number>(16)
  const isMobile = ref<boolean>(false)
  const isTablet = ref<boolean>(false)
  const breakpoint = ref<string>('md')

  // =========== 设备和系统信息 ===========
  const deviceInfo = ref<DeviceInfo>({
    userAgent: '',
    platform: '',
    isIOS: false,
    isAndroid: false,
    isSafari: false,
    isChrome: false,
    isMobile: false,
    isTablet: false,
    isDesktop: true,
    screenSize: {
      width: 0,
      height: 0
    },
    orientation: 'portrait',
    isTouchDevice: false
  })
  const systemInfo = ref<SystemInfo>({
    browser: {
      name: '',
      version: '',
      engine: ''
    },
    os: {
      name: '',
      version: '',
      platform: ''
    },
    hardware: {
      cores: 0,
      memory: 0,
      screen: {
        width: 0,
        height: 0,
        colorDepth: 0,
        pixelDepth: 0,
        availWidth: 0,
        availHeight: 0
      }
    },
    network: {
      type: '',
      effectiveType: '',
      downlink: 0,
      rtt: 0,
      saveData: false
    },
    features: {
      webGL: false,
      webWorker: false,
      serviceWorker: false,
      pushNotification: false,
      geolocation: false,
      camera: false,
      microphone: false
    }
  })
  const networkStatus = ref<'online' | 'offline' | 'unknown'>('unknown')
  const networkType = ref<string>('')
  const batteryLevel = ref<number>(100)
  const isCharging = ref<boolean>(false)

  // =========== 应用状态 ===========
  const isLoading = ref<boolean>(false)
  const error = ref<string | null>(null)
  const notificationsEnabled = ref<boolean>(true)
  const soundEnabled = ref<boolean>(false)
  const vibrationEnabled = ref<boolean>(true)
  const autoRefreshEnabled = ref<boolean>(true)

  // =========== 导航相关 ===========
  const breadcrumb = ref<Array<{ name: string, path: string }>>([])
  const lastNavigation = ref<{
    from: string
    to: string
    timestamp: number
  } | null>(null)
  const autoRefreshInterval = ref<number>(30000) // 30秒

  // =========== 用户偏好设置 ===========
  const userPreferences = ref<Record<string, any>>({})
  const recentlyVisited = ref<string[]>([])
  const favorites = ref<string[]>([])
  const searchHistory = ref<string[]>([])

  // =========== 计算属性 ===========
  const isDarkMode = computed(() => theme.value === 'dark')
  const isLightMode = computed(() => theme.value === 'light')
  const isAutoMode = computed(() => theme.value === 'auto')

  const currentTheme = computed(() => {
    if (isAutoMode.value) {
      const hour = useTime().getBeijingTime().getHours()
      return hour >= 18 || hour < 6 ? 'dark' : 'light'
    }
    return theme.value
  })

  const isCompactMode = computed(() => fontSize.value <= 12)
  const isLargeMode = computed(() => fontSize.value >= 16)

  const isOnline = computed(() => networkStatus.value === 'online')
  const isOffline = computed(() => networkStatus.value === 'offline')

  const batteryInfo = computed(() => ({
    level: batteryLevel.value,
    charging: isCharging.value,
    low: batteryLevel.value < 20,
    critical: batteryLevel.value < 10
  }))

  const layoutConfig = computed(() => ({
    sidebar: {
      collapsed: sidebarCollapsed.value,
      width: sidebarCollapsed.value ? 64 : sidebarWidth.value
    },
    header: {
      height: headerHeight.value
    },
    content: {
      padding: contentPadding.value
    }
  }))

  // =========== 主题方法 ===========
  const setTheme = (newTheme: ThemeMode): void => {
    theme.value = newTheme
    applyTheme()
    saveUserPreference('theme', newTheme)
  }

  const toggleTheme = (): void => {
    const newTheme = isDarkMode.value ? 'light' : 'dark'
    setTheme(newTheme)
  }

  const setPrimaryColor = (color: string): void => {
    primaryColor.value = color
    applyPrimaryColor()
    saveUserPreference('primaryColor', color)
  }

  const setCustomColors = (colors: Record<string, string>): void => {
    customColors.value = { ...customColors.value, ...colors }
    applyCustomColors()
    saveUserPreference('customColors', customColors.value)
  }

  const setFontSize = (size: number): void => {
    fontSize.value = Math.max(12, Math.min(20, size))
    applyFontSize()
    saveUserPreference('fontSize', fontSize.value)
  }

  const setBorderRadius = (radius: number): void => {
    borderRadius.value = Math.max(0, Math.min(12, radius))
    applyBorderRadius()
    saveUserPreference('borderRadius', borderRadius.value)
  }

  // =========== 语言和地区方法 ===========
  const setLanguage = (lang: AppLanguage): void => {
    language.value = lang
    applyLanguage()
    saveUserPreference('language', lang)
  }

  const setTimezone = (tz: string): void => {
    timezone.value = tz
    saveUserPreference('timezone', tz)
  }

  const setDateFormat = (format: string): void => {
    dateFormat.value = format
    saveUserPreference('dateFormat', format)
  }

  const setTimeFormat = (format: string): void => {
    timeFormat.value = format
    saveUserPreference('timeFormat', format)
  }

  const setCurrency = (newCurrency: string): void => {
    currency.value = newCurrency
    saveUserPreference('currency', newCurrency)
  }

  // =========== 布局方法 ===========
  const toggleSidebar = (): void => {
    sidebarCollapsed.value = !sidebarCollapsed.value
    saveUserPreference('sidebarCollapsed', sidebarCollapsed.value)
  }

  const setSidebarCollapsed = (collapsed: boolean): void => {
    sidebarCollapsed.value = collapsed
    saveUserPreference('sidebarCollapsed', collapsed)
  }

  const setSidebarWidth = (width: number): void => {
    sidebarWidth.value = Math.max(200, Math.min(400, width))
    saveUserPreference('sidebarWidth', sidebarWidth.value)
  }

  const updateDeviceBreakpoint = (): void => {
    const width = window.innerWidth

    if (width < 768) {
      isMobile.value = true
      isTablet.value = false
      breakpoint.value = 'sm'
      sidebarCollapsed.value = true
    } else if (width < 1024) {
      isMobile.value = false
      isTablet.value = true
      breakpoint.value = 'md'
    } else {
      isMobile.value = false
      isTablet.value = false
      breakpoint.value = 'lg'
    }
  }

  // =========== 应用状态方法 ===========
  const setLoading = (loading: boolean): void => {
    isLoading.value = loading
  }

  const setError = (newError: string | null): void => {
    error.value = newError
    if (newError) {
      // 触发错误事件
      window.dispatchEvent(new CustomEvent('tf2025:app:error', {
        detail: { error: newError }
      }))
    }
  }

  const clearError = (): void => {
    error.value = null
  }

  // =========== 导航相关方法 ===========
  const updateBreadcrumb = (crumb: Array<{ name: string, path: string }>): void => {
    breadcrumb.value = crumb
  }

  const updateLastNavigation = (navigation: { from: string, to: string, timestamp: number }): void => {
    lastNavigation.value = navigation
  }

  const setNotificationsEnabled = (enabled: boolean): void => {
    notificationsEnabled.value = enabled
    saveUserPreference('notificationsEnabled', enabled)
  }

  const setSoundEnabled = (enabled: boolean): void => {
    soundEnabled.value = enabled
    saveUserPreference('soundEnabled', enabled)
  }

  const setVibrationEnabled = (enabled: boolean): void => {
    vibrationEnabled.value = enabled
    saveUserPreference('vibrationEnabled', enabled)
  }

  const setAutoRefreshEnabled = (enabled: boolean): void => {
    autoRefreshEnabled.value = enabled
    saveUserPreference('autoRefreshEnabled', enabled)
  }

  const setAutoRefreshInterval = (interval: number): void => {
    autoRefreshInterval.value = Math.max(5000, interval) // 最小5秒
    saveUserPreference('autoRefreshInterval', autoRefreshInterval.value)
  }

  // =========== 用户偏好方法 ===========
  const saveUserPreference = (key: string, value: any): void => {
    try {
      userPreferences.value[key] = value
      storage.setPreferences(userPreferences.value)
    } catch (error) {
      // 保存用户偏好失败，忽略
    }
  }

  const loadUserPreferences = (): void => {
    try {
      const saved = storage.getPreferences()
      if (saved) {
        userPreferences.value = saved as any
        applyUserPreferences()
      }
    } catch (error) {
      // 加载用户偏好失败，忽略
    }
  }

  const applyUserPreferences = (): void => {
    const prefs = userPreferences.value

    if (prefs.theme) theme.value = prefs.theme
    if (prefs.primaryColor) primaryColor.value = prefs.primaryColor
    if (prefs.customColors) customColors.value = prefs.customColors
    if (prefs.fontSize) fontSize.value = prefs.fontSize
    if (prefs.borderRadius) borderRadius.value = prefs.borderRadius
    if (prefs.language) language.value = prefs.language
    if (prefs.timezone) timezone.value = prefs.timezone
    if (prefs.dateFormat) dateFormat.value = prefs.dateFormat
    if (prefs.timeFormat) timeFormat.value = prefs.timeFormat
    if (prefs.currency) currency.value = prefs.currency
    if (prefs.sidebarCollapsed !== undefined) sidebarCollapsed.value = prefs.sidebarCollapsed
    if (prefs.sidebarWidth) sidebarWidth.value = prefs.sidebarWidth
    if (prefs.notificationsEnabled !== undefined) notificationsEnabled.value = prefs.notificationsEnabled
    if (prefs.soundEnabled !== undefined) soundEnabled.value = prefs.soundEnabled
    if (prefs.vibrationEnabled !== undefined) vibrationEnabled.value = prefs.vibrationEnabled
    if (prefs.autoRefreshEnabled !== undefined) autoRefreshEnabled.value = prefs.autoRefreshEnabled
    if (prefs.autoRefreshInterval) autoRefreshInterval.value = prefs.autoRefreshInterval

    // 应用主题和样式
    applyTheme()
    applyPrimaryColor()
    applyFontSize()
    applyBorderRadius()
    applyLanguage()
  }

  // =========== 最近访问和收藏 ===========
  const addToRecentlyVisited = (path: string): void => {
    const index = recentlyVisited.value.indexOf(path)
    if (index > -1) {
      recentlyVisited.value.splice(index, 1)
    }
    recentlyVisited.value.unshift(path)

    // 最多保留20个
    if (recentlyVisited.value.length > 20) {
      recentlyVisited.value = recentlyVisited.value.slice(0, 20)
    }

    saveUserPreference('recentlyVisited', recentlyVisited.value)
  }

  const removeFromRecentlyVisited = (path: string): void => {
    const index = recentlyVisited.value.indexOf(path)
    if (index > -1) {
      recentlyVisited.value.splice(index, 1)
      saveUserPreference('recentlyVisited', recentlyVisited.value)
    }
  }

  const clearRecentlyVisited = (): void => {
    recentlyVisited.value = []
    saveUserPreference('recentlyVisited', [])
  }

  const toggleFavorite = (path: string): void => {
    const index = favorites.value.indexOf(path)
    if (index > -1) {
      favorites.value.splice(index, 1)
    } else {
      favorites.value.push(path)
    }
    saveUserPreference('favorites', favorites.value)
  }

  const isFavorite = (path: string): boolean => {
    return favorites.value.includes(path)
  }

  // =========== 搜索历史 ===========
  const addToSearchHistory = (query: string): void => {
    const index = searchHistory.value.indexOf(query)
    if (index > -1) {
      searchHistory.value.splice(index, 1)
    }
    searchHistory.value.unshift(query)

    // 最多保留50个
    if (searchHistory.value.length > 50) {
      searchHistory.value = searchHistory.value.slice(0, 50)
    }

    saveUserPreference('searchHistory', searchHistory.value)
  }

  const removeFromSearchHistory = (query: string): void => {
    const index = searchHistory.value.indexOf(query)
    if (index > -1) {
      searchHistory.value.splice(index, 1)
      saveUserPreference('searchHistory', searchHistory.value)
    }
  }

  const clearSearchHistory = (): void => {
    searchHistory.value = []
    saveUserPreference('searchHistory', [])
  }

  // =========== 系统信息获取 ===========
  const updateDeviceInfo = (): void => {
    const userAgent = navigator.userAgent
    const platform = navigator.platform
    const width = window.innerWidth
    const height = window.innerHeight

    deviceInfo.value = {
      userAgent,
      platform,
      isIOS: /iPad|iPhone|iPod/.test(userAgent),
      isAndroid: /Android/i.test(userAgent),
      isSafari: /Safari/i.test(userAgent) && !/Chrome|CriOS|Edg/i.test(userAgent),
      isChrome: /Chrome|CriOS/i.test(userAgent),
      isMobile: width < 768,
      isTablet: width >= 768 && width < 1024,
      isDesktop: width >= 1024,
      screenSize: {
        width,
        height
      },
      orientation: width > height ? 'landscape' : 'portrait',
      isTouchDevice: 'ontouchstart' in window || navigator.maxTouchPoints > 0
    }

    updateDeviceBreakpoint()
  }

  const updateNetworkStatus = (): void => {
    networkStatus.value = navigator.onLine ? 'online' : 'offline'

    if ('connection' in navigator) {
      const connection = (navigator as any).connection
      networkType.value = connection.effectiveType || 'unknown'
    }
  }

  const updateBatteryInfo = async (): Promise<void> => {
    if ('getBattery' in navigator) {
      try {
        const battery = await (navigator as any).getBattery()
        batteryLevel.value = Math.round(battery.level * 100)
        isCharging.value = battery.charging

        battery.addEventListener('levelchange', () => {
          batteryLevel.value = Math.round(battery.level * 100)
        })

        battery.addEventListener('chargingchange', () => {
          isCharging.value = battery.charging
        })
      } catch (error) {
        // 获取电池信息失败，忽略
      }
    }
  }

  // =========== 样式应用方法 ===========
  const applyTheme = (): void => {
    const root = document.documentElement
    root.classList.remove('theme-light', 'theme-dark')
    root.classList.add(`theme-${currentTheme.value}`)

    // 更新 meta theme-color
    const metaThemeColor = Array.from(document.getElementsByTagName('meta'))
      .find(meta => meta.getAttribute('name') === 'theme-color') || null
    if (metaThemeColor) {
      metaThemeColor.setAttribute('content', currentTheme.value === 'dark' ? '#1a1a1a' : '#ffffff')
    }
  }

  const applyPrimaryColor = (): void => {
    const root = document.documentElement
    root.style.setProperty('--primary-color', primaryColor.value)
  }

  const applyCustomColors = (): void => {
    const root = document.documentElement
    Object.entries(customColors.value).forEach(([key, value]) => {
      root.style.setProperty(`--${key}`, value)
    })
  }

  const applyFontSize = (): void => {
    const root = document.documentElement
    root.style.setProperty('--font-size-base', `${fontSize.value}px`)
  }

  const applyBorderRadius = (): void => {
    const root = document.documentElement
    root.style.setProperty('--border-radius-base', `${borderRadius.value}px`)
  }

  const applyLanguage = (): void => {
    const html = document.documentElement
    html.setAttribute('lang', language.value)
  }

  // =========== 重置方法 ===========
  const resetSettings = (): void => {
    theme.value = 'light'
    primaryColor.value = '#409eff'
    customColors.value = {}
    fontSize.value = 14
    borderRadius.value = 4
    language.value = 'zh-CN'
    timezone.value = 'Asia/Shanghai'
    dateFormat.value = 'YYYY-MM-DD'
    timeFormat.value = 'HH:mm:ss'
    currency.value = 'CNY'
    notificationsEnabled.value = true
    soundEnabled.value = false
    vibrationEnabled.value = true
    autoRefreshEnabled.value = true
    autoRefreshInterval.value = 30000

    storage.remove(PREFERENCE_STORAGE_KEYS.PREFERENCES, 'local')
    applyUserPreferences()
  }

  // =========== 初始化 ===========
  const initialize = (): void => {
    // 加载用户偏好
    loadUserPreferences()

    // 更新设备信息
    updateDeviceInfo()

    // 更新网络状态
    updateNetworkStatus()

    // 更新电池信息
    updateBatteryInfo()

    // 监听网络状态变化
    window.addEventListener('online', updateNetworkStatus)
    window.addEventListener('offline', updateNetworkStatus)

    // 监听窗口大小变化
    window.addEventListener('resize', updateDeviceInfo)

    // 监听系统主题变化
    if ('matchMedia' in window) {
      const darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)')
      darkModeQuery.addEventListener('change', () => {
        if (isAutoMode.value) {
          applyTheme()
        }
      })
    }
  }

  // =========== 监听器 ===========
  watch(theme, applyTheme)
  watch(primaryColor, applyPrimaryColor)
  watch(customColors, applyCustomColors)
  watch(fontSize, applyFontSize)
  watch(borderRadius, applyBorderRadius)
  watch(language, applyLanguage)

  // 初始化
  initialize()

  // =========== 返回状态和方法 ===========
  return {
    // 主题
    theme,
    primaryColor,
    customColors,
    fontSize,
    borderRadius,

    // 语言地区
    language,
    timezone,
    dateFormat,
    timeFormat,
    currency,
    numberFormat,

    // 布局
    sidebarCollapsed,
    sidebarWidth,
    headerHeight,
    contentPadding,
    isMobile,
    isTablet,
    breakpoint,

    // 设备系统
    deviceInfo,
    systemInfo,
    networkStatus,
    networkType,
    batteryLevel,
    isCharging,

    // 应用状态
    isLoading,
    error,
    notificationsEnabled,
    soundEnabled,
    vibrationEnabled,
    autoRefreshEnabled,
    autoRefreshInterval,

    // 用户偏好
    userPreferences,
    recentlyVisited,
    favorites,
    searchHistory,

    // 计算属性
    isDarkMode,
    isLightMode,
    isAutoMode,
    currentTheme,
    isCompactMode,
    isLargeMode,
    isOnline,
    isOffline,
    batteryInfo,
    layoutConfig,

    // 主题方法
    setTheme,
    toggleTheme,
    setPrimaryColor,
    setCustomColors,
    setFontSize,
    setBorderRadius,

    // 语言地区方法
    setLanguage,
    setTimezone,
    setDateFormat,
    setTimeFormat,
    setCurrency,

    // 布局方法
    toggleSidebar,
    setSidebarCollapsed,
    setSidebarWidth,
    updateDeviceBreakpoint,

    // 应用状态方法
    setLoading,
    setError,
    clearError,
    setNotificationsEnabled,
    setSoundEnabled,
    setVibrationEnabled,
    setAutoRefreshEnabled,
    setAutoRefreshInterval,

    // 导航相关方法
    updateBreadcrumb,
    updateLastNavigation,

    // 用户偏好方法
    saveUserPreference,
    loadUserPreferences,
    applyUserPreferences,

    // 最近访问和收藏
    addToRecentlyVisited,
    removeFromRecentlyVisited,
    clearRecentlyVisited,
    toggleFavorite,
    isFavorite,

    // 搜索历史
    addToSearchHistory,
    removeFromSearchHistory,
    clearSearchHistory,

    // 系统信息
    updateDeviceInfo,
    updateNetworkStatus,
    updateBatteryInfo,

    // 重置
    resetSettings
  }
})