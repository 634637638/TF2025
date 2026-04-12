import { ref, computed, onMounted, watch } from 'vue'
import { storage } from '@/services/storage'
import { PREFERENCE_STORAGE_KEYS } from '@/constants/storage'
import { logger } from '@/utils/logger'

export type ThemeMode = 'light' | 'dark' | 'auto'
const THEME_MODES: ThemeMode[] = ['light', 'dark', 'auto']

export interface ThemeConfig {
  mode: ThemeMode
  primaryColor: string
  accentColor: string
  backgroundColor: string
  textColor: string
  borderColor: string
  shadowColor: string
  sidebarBg: string
  sidebarText: string
  headerBg: string
  cardBg: string
  inputBg: string
  hoverBg: string
}

/**
 * 主题管理 Composable
 * 提供暗夜模式和主题定制功能
 */
export function useTheme() {
  // 当前主题模式
  const mode = ref<ThemeMode>('light')
  const isDark = ref(false)
  const isSystemDark = ref(false)

  // 主题配置
  const themes = {
    light: {
      primaryColor: '#1890ff',
      accentColor: '#52c41a',
      backgroundColor: '#ffffff',
      textColor: '#333333',
      borderColor: '#d9d9d9',
      shadowColor: 'rgba(0, 0, 0, 0.1)',
      sidebarBg: '#ffffff',
      sidebarText: '#333333',
      headerBg: '#ffffff',
      cardBg: '#ffffff',
      inputBg: '#ffffff',
      hoverBg: '#f5f5f5'
    },
    dark: {
      primaryColor: '#177ddc',
      accentColor: '#49aa19',
      backgroundColor: '#141414',
      textColor: '#ffffff',
      borderColor: '#434343',
      shadowColor: 'rgba(0, 0, 0, 0.3)',
      sidebarBg: '#1f1f1f',
      sidebarText: '#ffffff',
      headerBg: '#1f1f1f',
      cardBg: '#1f1f1f',
      inputBg: '#262626',
      hoverBg: '#262626'
    }
  }

  // 当前主题配置
  const currentTheme = computed<ThemeConfig>(() => {
    const theme = isDark.value ? themes.dark : themes.light
    return {
      ...theme,
      mode: mode.value
    }
  })

  // 检测系统主题偏好
  const detectSystemTheme = () => {
    if (typeof window === 'undefined' || !window.matchMedia) return false

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    isSystemDark.value = mediaQuery.matches

    // 监听系统主题变化
    mediaQuery.addEventListener('change', (e) => {
      isSystemDark.value = e.matches
      if (mode.value === 'auto') {
        updateTheme()
      }
    })

    return mediaQuery.matches
  }

  // 从localStorage加载主题设置
  const loadThemeFromStorage = () => {
    try {
      const saved = storage.getTheme()
      if (saved) {
        mode.value = THEME_MODES.includes(saved.mode as ThemeMode) ? (saved.mode as ThemeMode) : 'light'
      }
    } catch (error) {
      logger.warn('加载主题设置失败:', error)
      mode.value = 'light'
    }
  }

  // 保存主题设置到localStorage
  const saveThemeToStorage = () => {
    try {
      storage.setTheme(mode.value)
    } catch (error) {
      logger.warn('保存主题设置失败:', error)
    }
  }

  // 更新主题
  const updateTheme = () => {
    switch (mode.value) {
      case 'dark':
        isDark.value = true
        break
      case 'light':
        isDark.value = false
        break
      case 'auto':
        isDark.value = isSystemDark.value
        break
    }

    applyThemeToDOM()
  }

  // 应用主题到DOM
  const applyThemeToDOM = () => {
    if (typeof document === 'undefined') return

    const root = document.documentElement
    const theme = currentTheme.value

    // 设置CSS变量
    root.style.setProperty('--theme-primary-color', theme.primaryColor)
    root.style.setProperty('--theme-accent-color', theme.accentColor)
    root.style.setProperty('--theme-bg-color', theme.backgroundColor)
    root.style.setProperty('--theme-text-color', theme.textColor)
    root.style.setProperty('--theme-border-color', theme.borderColor)
    root.style.setProperty('--theme-shadow-color', theme.shadowColor)
    root.style.setProperty('--theme-sidebar-bg', theme.sidebarBg)
    root.style.setProperty('--theme-sidebar-text', theme.sidebarText)
    root.style.setProperty('--theme-header-bg', theme.headerBg)
    root.style.setProperty('--theme-card-bg', theme.cardBg)
    root.style.setProperty('--theme-input-bg', theme.inputBg)
    root.style.setProperty('--theme-hover-bg', theme.hoverBg)

    // 设置主题类
    root.classList.remove('theme-light', 'theme-dark')
    root.classList.add(isDark.value ? 'theme-dark' : 'theme-light')

    // 设置data-theme属性（用于CSS选择器）
    root.setAttribute('data-theme', isDark.value ? 'dark' : 'light')

    // 设置meta标签（用于移动端主题色）
    const metaThemeColor = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null
    if (metaThemeColor) {
      metaThemeColor.setAttribute('content', theme.backgroundColor)
    }
  }

  // 切换主题
  const toggleTheme = () => {
    switch (mode.value) {
      case 'light':
        mode.value = 'dark'
        break
      case 'dark':
        mode.value = 'light'
        break
      case 'auto':
        mode.value = isDark.value ? 'light' : 'dark'
        break
    }
  }

  // 设置主题模式
  const setTheme = (newMode: ThemeMode) => {
    mode.value = newMode
  }

  // 切换暗夜模式
  const toggleDarkMode = () => {
    setTheme(isDark.value ? 'light' : 'dark')
  }

  // 获取主题相关类名
  const getThemeClass = (prefix: string, suffix?: string) => {
    const base = `${prefix}-${isDark.value ? 'dark' : 'light'}`
    return suffix ? `${base}-${suffix}` : base
  }

  // 获取主题相关的CSS变量
  const getCSSVariable = (variable: string) => {
    if (typeof document === 'undefined') return ''
    const root = document.documentElement
    return getComputedStyle(root).getPropertyValue(variable).trim()
  }

  // 生成主题相关的样式对象
  const getThemeStyles = (customTheme?: Partial<ThemeConfig>) => {
    const theme = customTheme ? { ...currentTheme.value, ...customTheme } : currentTheme.value

    return {
      backgroundColor: theme.backgroundColor,
      color: theme.textColor,
      borderColor: theme.borderColor,
      boxShadow: `0 2px 8px ${theme.shadowColor}`
    }
  }

  // 监听主题模式变化
  watch(mode, () => {
    saveThemeToStorage()
    updateTheme()
  }, { immediate: false })

  // 监听系统主题变化（仅在auto模式下）
  watch(isSystemDark, () => {
    if (mode.value === 'auto') {
      updateTheme()
    }
  })

  // 生命周期
  onMounted(() => {
    loadThemeFromStorage()
    detectSystemTheme()
    updateTheme()
  })

  return {
    // 状态
    mode,
    isDark,
    isSystemDark,
    currentTheme,

    // 方法
    toggleTheme,
    setTheme,
    toggleDarkMode,
    updateTheme,

    // 工具方法
    getThemeClass,
    getCSSVariable,
    getThemeStyles,

    // 主题配置
    themes
  }
}

/**
 * 主题过渡动画 Composable
 */
export function useThemeTransition() {
  const isTransitioning = ref(false)
  let transitionTimeout: NodeJS.Timeout

  /**
   * 执行主题切换动画
   */
  const startThemeTransition = (duration: number = 300) => {
    if (typeof document === 'undefined') return

    isTransitioning.value = true

    // 添加过渡效果
    const root = document.documentElement
    root.style.transition = `background-color ${duration}ms ease, color ${duration}ms ease`

    // 清理过渡效果
    if (transitionTimeout) {
      clearTimeout(transitionTimeout)
    }

    transitionTimeout = setTimeout(() => {
      root.style.transition = ''
      isTransitioning.value = false
    }, duration)
  }

  return {
    isTransitioning,
    startThemeTransition
  }
}

export default useTheme
