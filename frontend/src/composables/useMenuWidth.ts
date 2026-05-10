/**
 * 菜单宽度管理 Composable
 * 用于响应式管理菜单宽度，支持移动端和桌面端
 */

import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useWindowSize } from './ui/useWindowSize'
import { unifiedApi } from '@/utils/unified-api'
import { storage } from '@/services/storage'
import { PREFERENCE_STORAGE_KEYS } from '@/constants/storage'
import { logger } from '@/utils/logger'

export interface MenuWidthConfig {
  mobile: number
  tablet: number
  desktop: number
  large: number
}

export interface MenuWidthOptions {
  default?: MenuWidthConfig
  breakpoints?: {
    mobile: number
    tablet: number
    desktop: number
  }
  storage?: boolean
  storageKey?: string
}

const DEFAULT_CONFIG: MenuWidthConfig = {
  mobile: 160,  // 移动端默认宽度
  tablet: 160,  // 平板端默认宽度
  desktop: 160, // 桌面端默认宽度
  large: 160    // 大屏端默认宽度
}

const DEFAULT_BREAKPOINTS = {
  mobile: 768,
  tablet: 1024,
  desktop: 1200
}

let sharedLoadMenuWidthsPromise: Promise<{ pc: number; mobile: number }> | null = null

export function useMenuWidth(options: MenuWidthOptions = {}) {
  const {
    default: defaultConfig = DEFAULT_CONFIG,
    breakpoints = DEFAULT_BREAKPOINTS,
    storage: useStorage = true,
    storageKey = PREFERENCE_STORAGE_KEYS.MENU_WIDTH
  } = options

  const { size } = useWindowSize()

  // 当前窗口宽度的响应式引用
  const windowWidth = computed(() => size.value?.innerWidth || 0)

  // 辅助函数：同步获取初始宽度
  const getInitialWidth = () => {
    if (useStorage) {
      try {
        const savedConfig = storage.get<MenuWidthConfig>(storageKey, 'local')
        if (savedConfig) {
          return savedConfig.desktop || defaultConfig.desktop
        }
      } catch (error) {
        // 静默处理
      }
    }
    return defaultConfig.desktop
  }

  // 当前宽度配置
  const config = ref<MenuWidthConfig>({ ...defaultConfig })

  // 当前菜单宽度 - 同步加载初始值避免闪烁
  const currentWidth = ref<number>(getInitialWidth())

  // 菜单是否折叠
  const isCollapsed = ref<boolean>(false)

  // 加载状态
  const isLoading = ref<boolean>(false)

  // 最后同步时间
  const lastSyncTime = ref<number>(0)

  // 用于外部响应式的菜单宽度 - 同步加载初始值避免闪烁
  const menuWidth = ref<number>(getInitialWidth())

  // 是否处于移动端
  const isMobile = computed(() => windowWidth.value < breakpoints.mobile)

  // 是否处于平板端
  const isTablet = computed(() => {
    const width = windowWidth.value
    return width >= breakpoints.mobile && width < breakpoints.tablet
  })

  // 是否处于桌面端
  const isDesktop = computed(() => windowWidth.value >= breakpoints.desktop)

  // 获取当前设备类型对应的宽度
  const getCurrentDeviceWidth = () => {
    // 安全检查：确保config.value存在
    if (!config?.value) {
      return defaultConfig.desktop || 300
    }

    const cfg = config.value
    if (isMobile.value) return cfg?.mobile ?? defaultConfig.mobile
    if (isTablet.value) return cfg?.tablet ?? defaultConfig.tablet  
    if (isDesktop.value) return cfg?.large ?? defaultConfig.large
    return cfg?.desktop ?? defaultConfig.desktop
  }

  // 响应式更新菜单宽度
  const updateWidth = () => {
    if (!isCollapsed.value) {
      const deviceWidth = getCurrentDeviceWidth()
      currentWidth.value = deviceWidth
      menuWidth.value = deviceWidth
    } else {
      menuWidth.value = isMobile.value ? 0 : 60
    }
  }

  // 切换菜单折叠状态
  const toggleCollapse = () => {
    isCollapsed.value = !isCollapsed.value

    if (isCollapsed.value) {
      currentWidth.value = isMobile.value ? 0 : 60
      menuWidth.value = isMobile.value ? 0 : 60
    } else {
      const deviceWidth = getCurrentDeviceWidth()
      currentWidth.value = deviceWidth
      menuWidth.value = deviceWidth
    }

    // 注意：不再保存折叠状态到本地存储，因为折叠状态应该由外部组件控制
  }

  // 设置菜单折叠状态
  const setCollapsed = (collapsed: boolean) => {
    if (isCollapsed.value !== collapsed) {
      toggleCollapse()
    }
  }

  // 更新宽度配置
  const updateConfig = (newConfig: Partial<MenuWidthConfig>) => {
    config.value = { ...config.value, ...newConfig }

    // 保存配置到本地存储
    if (useStorage) {
      storage.set(storageKey, config.value, 'local')
    }

    // 立即更新当前宽度
    updateWidth()
  }

  // 设置菜单宽度
  const setMenuWidth = (width: number) => {
    currentWidth.value = width
    menuWidth.value = width

    // 保存到本地存储
    if (useStorage) {
      storage.set(storageKey, { ...config.value, desktop: width }, 'local')
    }
  }

  
  // 从数据库API加载菜单宽度
  const loadMenuWidthFromAPI = async () => {
    try {

      // 使用批量API获取所有宽度信息
      const response = await fetch('/api/settings/public/menu-widths')

      if (response.ok) {
        const data = await response.json()
        if (data.success && data.data) {
          const pcWidth = parseInt(data.data.pc) || defaultConfig.desktop
          const mobileWidth = parseInt(data.data.mobile) || defaultConfig.mobile
          return {
            pc: pcWidth,
            mobile: mobileWidth
          }
        }
      }

      throw new Error('API响应格式错误')
    } catch (error) {
      return {
        pc: defaultConfig.desktop,
        mobile: defaultConfig.mobile
      }
    }
  }

  // 加载所有菜单宽度（PC和移动端）- 优先从API加载，降级到本地存储
  const loadAllMenuWidths = async () => {
    if (sharedLoadMenuWidthsPromise) {
      return sharedLoadMenuWidthsPromise
    }

    sharedLoadMenuWidthsPromise = (async () => {
    isLoading.value = true
    try {
      // 首先尝试从 API 加载
      const apiWidths = await loadMenuWidthFromAPI()

      if (apiWidths) {
        // API 加载成功，更新配置和本地存储
        config.value = {
          desktop: apiWidths.pc,
          large: apiWidths.pc,
          mobile: apiWidths.mobile,
          tablet: apiWidths.mobile
        }

        // 保存到本地存储
        if (useStorage) {
          storage.set(storageKey, config.value, 'local')
        }

        updateWidth()
        return apiWidths
      }

      // API 加载失败，尝试从本地存储加载
      if (useStorage) {
        const savedConfig = storage.get<MenuWidthConfig>(storageKey, 'local')
        if (savedConfig) {
          try {
            config.value = { ...config.value, ...savedConfig }
            updateWidth()
            return {
              pc: savedConfig.desktop || defaultConfig.desktop,
              mobile: savedConfig.mobile || defaultConfig.mobile
            }
          } catch (parseError) {
            // 静默处理
            // 清除无效数据
            storage.remove(storageKey, 'local')
          }
        }
      }

      // 如果没有本地配置，使用默认配置
      config.value = { ...defaultConfig }
      updateWidth()

      return {
        pc: defaultConfig.desktop,
        mobile: defaultConfig.mobile
      }
    } catch (error) {
      logger.error('加载菜单宽度失败:', error)
      // 确保始终有默认值
      config.value = { ...defaultConfig }
      updateWidth()
      return {
        pc: defaultConfig.desktop,
        mobile: defaultConfig.mobile
      }
    } finally {
      isLoading.value = false
    }
    })().finally(() => {
      sharedLoadMenuWidthsPromise = null
    })

    return sharedLoadMenuWidthsPromise
  }

  // 同时设置PC和移动端菜单宽度
  const setBothMenuWidths = async (pcWidth: number, mobileWidth: number) => {
    isLoading.value = true
    try {

      // 更新本地配置
      updateConfig({
        desktop: pcWidth,
        large: pcWidth,
        mobile: mobileWidth,
        tablet: mobileWidth
      })

      // 如果当前是桌面端，立即更新宽度
      if (!isMobile.value) {
        setMenuWidth(pcWidth)
      }

      // 同步到数据库 - 使用公开API，不需要认证
      // 注意：数据库同步是可选的，失败不会影响本地功能
      setTimeout(async () => {
        try {
          const response = await fetch('/api/settings/public/menu-widths', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              widths: {
                pc: pcWidth,
                mobile: mobileWidth
              }
            })
          })

          const data = await response.json()

          if (response.ok && data.success) {
            // 触发自定义事件，通知其他组件
            window.dispatchEvent(new CustomEvent('menuWidthUpdated', {
              detail: { pc: pcWidth, mobile: mobileWidth }
            }))
          } else {
            logger.error('❌ 数据库同步失败:', data?.message || '未知错误')
            // 抛出错误，让调用者知道数据库同步失败
            throw new Error(data?.message || '数据库同步失败')
          }
        } catch (dbError) {
          logger.error('❌ 同步菜单宽度到数据库失败:', dbError.message || dbError)
          // 不再静默处理，抛出错误让上层处理
          throw dbError
        }
      }, 100) // 延迟100ms执行，不阻塞主要功能

      // 更新最后同步时间
      lastSyncTime.value = Date.now()

    } catch (error) {
      logger.error('❌ 设置菜单宽度失败:', error)
    } finally {
      isLoading.value = false
    }
  }

  // 重置PC和移动端菜单宽度
  const resetBothMenuWidths = async () => {
    isLoading.value = true
    try {

      // 重置本地配置
      resetConfig()
      menuWidth.value = isMobile.value ? defaultConfig.mobile : defaultConfig.desktop

      // 同步默认值到数据库
      try {
        const response = await fetch('/api/settings/public/menu-widths', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            widths: {
              pc: defaultConfig.desktop,
              mobile: defaultConfig.mobile
            }
          })
        })

        if (response.ok) {
          const data = await response.json()
          if (data.success) {
          } else {
            throw new Error(data.message || '数据库同步失败')
          }
        } else {
          throw new Error(`HTTP ${response.status}`)
        }
      } catch (dbError) {
        // 数据库失败不影响本地功能
      }

      // 更新最后同步时间
      lastSyncTime.value = Date.now()
    } catch (error) {
      logger.error('❌ 重置菜单宽度失败:', error)
    } finally {
      isLoading.value = false
    }
  }

  // 重置为默认配置
  const resetConfig = () => {
    config.value = { ...defaultConfig }
    currentWidth.value = config.value.desktop
    isCollapsed.value = false

    // 清除本地存储
    if (useStorage) {
      storage.remove(storageKey, 'local')
      storage.remove(`${storageKey}_collapsed`, 'local')
    }
  }

  // 从本地存储加载配置
  const loadFromStorage = () => {
    if (!useStorage) return

    try {
      // 加载宽度配置
      const savedConfig = storage.get<MenuWidthConfig>(storageKey, 'local')
      if (savedConfig) {
        config.value = { ...config.value, ...savedConfig }
      }

      // 注意：不加载折叠状态，因为折叠状态应该由外部组件控制
      // 移除自动保存的折叠状态，确保菜单默认展开
      storage.remove(`${storageKey}_collapsed`, 'local')
    } catch (error) {
      // 静默处理
      // 清除无效数据
      resetConfig()
    }
  }

  // 监听窗口大小变化
  const handleResize = () => {
    updateWidth()
  }

  // 响应式样式计算
  const menuStyles = computed(() => ({
    width: `${currentWidth.value}px`,
    transition: 'width 0.3s ease-in-out',
    overflow: 'hidden'
  }))

  const contentStyles = computed(() => ({
    marginLeft: isMobile.value ? '0' : `${currentWidth.value}px`,
    transition: 'margin-left 0.3s ease-in-out'
  }))

  // 监听窗口大小变化
  onMounted(() => {
    loadFromStorage()
    updateWidth()
    window.addEventListener('resize', handleResize)
  })

  onUnmounted(() => {
    window.removeEventListener('resize', handleResize)
  })

  return {
    // 响应式状态
    currentWidth: computed(() => currentWidth.value),
    config: computed(() => config.value),
    isCollapsed: computed(() => isCollapsed.value),
    isMobile,
    isTablet,
    isDesktop,
    menuWidth: computed(() => menuWidth.value),
    isLoading: computed(() => isLoading.value),
    lastSyncTime: computed(() => lastSyncTime.value),

    // 样式
    menuStyles,
    contentStyles,

    // 方法
    toggleCollapse,
    setCollapsed,
    updateConfig,
    resetConfig,
    updateWidth,
    setMenuWidth,
    loadAllMenuWidths,
    setBothMenuWidths,
    resetBothMenuWidths,

    // 数据库同步方法
    loadMenuWidthFromAPI,
    syncToDatabase: async (width: number) => {
      try {
        await unifiedApi.post('/settings/menu-width', {
          value: width,
          type: 'number'
        })
        lastSyncTime.value = Date.now()
        return true
      } catch (error) {
        logger.error('❌ 同步到settings表失败:', error)
        return false
      }
    },

    // 计算属性
    currentDeviceWidth: computed(() => getCurrentDeviceWidth())
  }
}

// 默认导出
export default useMenuWidth
