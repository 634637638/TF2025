/**
 * 移动端菜单管理 Composable
 * 统一管理移动端菜单的状态、行为和响应式适配
 */
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useMobile } from './mobile'
import { useAuthStore } from '@/stores/auth'
import { useMenuStore } from '@/stores/menu'
import type { MenuItem } from '@/types/menu'
import { useKeyboardShortcut } from '@/composables/useKeyboardShortcut'

export interface MobileMenuConfig {
  // 菜单项配置
  items: MenuItem[]
  // 是否启用手势
  enableGestures?: boolean
  // 快捷操作
  quickActions?: Array<{
    id: string
    name: string
    icon: string
    badge?: string
    handler: () => void
  }>
}

export function useMobileMenu(config: MobileMenuConfig) {
  // ========== 状态管理 ==========
  const route = useRoute()
  const router = useRouter()
  const authStore = useAuthStore()
  const menuStore = useMenuStore()
  const { isMobile, isTablet, screenSize } = useMobile()

  // 菜单状态
  const isSlideMenuOpen = ref(false)
  const isMenuLoading = ref(false)
  const activeQuickActions = ref(config.quickActions || [])

  // 菜单数据
  const menuItems = ref<MenuItem[]>(config.items || [])
  const slideMenuItems = ref<MenuItem[]>([])

  // 触摸手势相关
  let touchStartX = 0
  let touchStartTime = 0
  const SWIPE_THRESHOLD = 50
  const SWIPE_TIME_THRESHOLD = 300

  // ========== 计算属性 ==========

  // 当前用户信息
  const userInfo = computed(() => ({
    name: authStore.user?.name || authStore.user?.username || '用户',
    role: authStore.userRole || '员工'
  }))

  // 当前后台只有侧滑菜单承载完整菜单，不能把项目分流到未渲染的底部导航。
  const computeMenuDistribution = () => {
    // 确保 menuItems.value 存在且是数组
    const items = Array.isArray(menuItems.value) ? menuItems.value : []

    slideMenuItems.value = items
  }

  // ========== 方法 ==========

  // 加载菜单数据
  const loadMenuData = async () => {
    // 检查用户是否已认证
    const authStore = useAuthStore()
    if (!authStore.isAuthenticated) {
      return
    }

    isMenuLoading.value = true
    try {
      if (menuStore.menuItems.length === 0) {
        await menuStore.loadMenus()
      }

      if (menuStore.menuItems.length > 0) {
        menuItems.value = menuStore.menuItems
        computeMenuDistribution()
      } else {
        menuItems.value = []
        computeMenuDistribution()
      }
    } catch (error) {
      menuItems.value = []
      computeMenuDistribution()
    } finally {
      isMenuLoading.value = false
    }
  }

  const syncMenuItems = (items: MenuItem[] = []) => {
    menuItems.value = Array.isArray(items) ? items : []
    computeMenuDistribution()
  }

  const setSlideMenuOpen = (open: boolean) => {
    isSlideMenuOpen.value = open
  }

  // 切换侧滑菜单
  const toggleSlideMenu = async () => {
    if (isSlideMenuOpen.value) {
      closeSlideMenu()
      return
    }

    await openSlideMenu()
  }

  // 关闭侧滑菜单
  const closeSlideMenu = () => {
    setSlideMenuOpen(false)
  }

  // 打开侧滑菜单
  const openSlideMenu = async () => {
    setSlideMenuOpen(true)

    if (slideMenuItems.value.length === 0 && menuItems.value.length === 0) {
      await loadMenuData()
    }
  }

  // 处理快捷操作
  const handleQuickAction = (action: NonNullable<MobileMenuConfig['quickActions']>[number]) => {
    if (action.handler) {
      action.handler()
    }
    closeSlideMenu()
  }

  // 触摸开始（用于手势识别）
  const handleGlobalTouchStart = (e: TouchEvent) => {
    touchStartX = e.touches[0].clientX
    touchStartTime = Date.now()
  }

  // 触摸结束（用于手势识别）
  const handleGlobalTouchEnd = (e: TouchEvent) => {
    if (!config.enableGestures || !isMobile.value) return

    const touchEndX = e.changedTouches[0].clientX
    const touchEndTime = Date.now()
    const deltaX = touchEndX - touchStartX
    const deltaTime = touchEndTime - touchStartTime

    // 检查是否为有效的滑动手势
    if (Math.abs(deltaX) > SWIPE_THRESHOLD && deltaTime < SWIPE_TIME_THRESHOLD) {
      // 从左边缘右滑打开菜单
      if (touchStartX < 20 && deltaX > 0 && !isSlideMenuOpen.value) {
        openSlideMenu()
      }
      // 左滑关闭菜单
      else if (deltaX < 0 && isSlideMenuOpen.value) {
        closeSlideMenu()
      }
    }
  }

  useKeyboardShortcut({ key: 'Escape', enabled: isSlideMenuOpen }, closeSlideMenu)
  useKeyboardShortcut({ key: 'm', ctrlOrMeta: true, enabled: () => !isMobile.value }, toggleSlideMenu)

  // 响应式处理
  const handleResize = () => {
    computeMenuDistribution()

    // 屏幕旋转或尺寸变化时关闭菜单
    if (isSlideMenuOpen.value) {
      closeSlideMenu()
    }
  }

  // 退出登录
  const handleLogout = () => {
    authStore.logout()
    router.push('/login')
  }

  // ========== 生命周期 ==========
  onMounted(() => {
    // 加载菜单数据
    if (Array.isArray(config.items) && config.items.length > 0) {
      syncMenuItems(config.items)
    } else {
      loadMenuData()
    }

    // 添加事件监听器
    if (isMobile.value && config.enableGestures) {
      document.addEventListener('touchstart', handleGlobalTouchStart, { passive: true })
      document.addEventListener('touchend', handleGlobalTouchEnd, { passive: true })
    }

    window.addEventListener('resize', handleResize)

    // 监听屏幕方向变化
    window.addEventListener('orientationchange', handleResize)
  })

  onUnmounted(() => {
    // 清理事件监听器
    document.removeEventListener('touchstart', handleGlobalTouchStart)
    document.removeEventListener('touchend', handleGlobalTouchEnd)
    window.removeEventListener('resize', handleResize)
    window.removeEventListener('orientationchange', handleResize)

    setSlideMenuOpen(false)
  })

  // 监听路由变化
  watch(route, () => {
    closeSlideMenu()
  })

  // 监听屏幕尺寸变化
  watch(screenSize, () => {
    computeMenuDistribution()
  }, { deep: true })

  // ========== 返回值 ==========
  return {
    // 状态
    isMobile,
    isTablet,
    screenSize,
    isSlideMenuOpen,
    isMenuLoading,

    // 数据
    userInfo,
    menuItems,
    slideMenuItems,
    activeQuickActions,

    // 方法
    toggleSlideMenu,
    closeSlideMenu,
    openSlideMenu,
    handleQuickAction,
    handleLogout,
    syncMenuItems,

    // 计算属性
    currentPath: computed(() => route.path),

    // 工具方法
    isActive: (menu: MenuItem) => {
      return route.path === menu.url || route.path === menu.path
    },

    // 刷新菜单数据
    refreshMenu: loadMenuData
  }
}

/**
 * 简化版的移动端菜单 Hook
 * 仅提供基本的菜单控制功能
 */
export function useSimpleMobileMenu() {
  const isMenuOpen = ref(false)
  const { isMobile } = useMobile()

  const toggleMenu = () => {
    isMenuOpen.value = !isMenuOpen.value

    if (isMenuOpen.value) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
  }

  const closeMenu = () => {
    isMenuOpen.value = false
    document.body.style.overflow = ''
  }

  const openMenu = () => {
    isMenuOpen.value = true
    document.body.style.overflow = 'hidden'
  }

  onUnmounted(() => {
    document.body.style.overflow = ''
  })

  return {
    isMobile,
    isMenuOpen,
    toggleMenu,
    closeMenu,
    openMenu
  }
}

export default useMobileMenu
