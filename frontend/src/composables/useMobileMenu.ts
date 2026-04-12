/**
 * 移动端菜单管理 Composable
 * 统一管理移动端菜单的状态、行为和响应式适配
 */
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useMobile } from './useMobile'
import { useMobileGestures } from './useMobile'
import { useAuthStore } from '@/stores/auth'
import { unifiedApi } from '@/utils/unified-api'
import type { MenuItem } from '@/types/menu'

export interface MobileMenuConfig {
  // 菜单项配置
  items: MenuItem[]
  // 最大显示数量（底部导航）
  maxBottomNavItems?: number
  // 是否启用手势
  enableGestures?: boolean
  // 是否启用自动隐藏
  enableAutoHide?: boolean
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
  const { isMobile, isTablet, screenSize } = useMobile()
  const { handleTouchStart, handleTouchEnd, isSwipeRight, isSwipeLeft } = useMobileGestures()

  // 菜单状态
  const isSlideMenuOpen = ref(false)
  const isBottomNavVisible = ref(true)
  const activeQuickActions = ref(config.quickActions || [])

  // 菜单数据
  const menuItems = ref<MenuItem[]>(config.items || [])
  const bottomNavItems = ref<MenuItem[]>([])
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

  // 根据屏幕尺寸和菜单项数量动态分配底部导航和侧滑菜单
  const computeMenuDistribution = () => {
    const maxItems = computeMaxBottomNavItems()

    // 确保 menuItems.value 存在且是数组
    const items = Array.isArray(menuItems.value) ? menuItems.value : []

    const important = items
      .filter(item => item.priority !== undefined && item.priority <= 3)
      .slice(0, maxItems)

    bottomNavItems.value = important
    slideMenuItems.value = items.filter(item =>
      !important.find(i => i.id === item.id)
    )

    // 如果 slideMenuItems 为空数组且 items 不为空，则将所有菜单项作为侧滑菜单
    if (slideMenuItems.value.length === 0 && items.length > 0) {
      slideMenuItems.value = items
    }
  }

  // 计算底部导航最大显示数量
  const computeMaxBottomNavItems = () => {
    if (!isMobile.value) return 0

    const width = screenSize.value.width

    // 根据屏幕宽度计算
    if (width < 360) return 4 // 小屏手机
    if (width < 414) return 4 // 标准手机
    if (width < 768) return 5 // 大屏手机
    return config.maxBottomNavItems || 5
  }

  // ========== 方法 ==========

  // 加载菜单数据
  const loadMenuData = async () => {
    // 检查用户是否已认证
    const authStore = useAuthStore()
    if (!authStore.isAuthenticated) {
      return
    }

    try {
      // 使用统一的权限过滤菜单 API（与 PC 端一致）
      const response = await unifiedApi.get('/permissions/user-menu', {
        params: { _t: Date.now() }
      })
      if (response?.success && response?.data?.menuPermissions) {
        menuItems.value = response.data.menuPermissions
        computeMenuDistribution()
      } else {
        // 如果没有认证或获取失败，使用默认菜单
        useDefaultMenu()
      }
    } catch (error) {
      // 使用默认菜单作为后备
      useDefaultMenu()
    }
  }

  // 使用默认菜单结构
  const useDefaultMenu = () => {
    const defaultMenuItems: MenuItem[] = [
      {
        id: 'dashboard',
        name: '仪表盘',
        title: '仪表盘',
        url: '/dashboard',
        icon: 'fas fa-tachometer-alt',
        priority: 1,
        children: []
      },
      {
        id: 'menu',
        name: '菜单管理',
        title: '菜单管理',
        url: '/menu',
        icon: 'fas fa-bars',
        priority: 2,
        children: []
      },
      {
        id: 'sales',
        name: '销售管理',
        title: '销售管理',
        url: '/sales',
        icon: 'fas fa-shopping-cart',
        priority: 3,
        children: []
      },
      {
        id: 'inventory',
        name: '库存管理',
        title: '库存管理',
        url: '/inventory',
        icon: 'fas fa-warehouse',
        priority: 4,
        children: []
      },
      {
        id: 'customers',
        name: '客户管理',
        title: '客户管理',
        url: '/customers',
        icon: 'fas fa-users',
        priority: 5,
        children: []
      },
      {
        id: 'system',
        name: '系统设置',
        title: '系统设置',
        url: '/system',
        icon: 'fas fa-cog',
        priority: 6,
        children: []
      }
    ]
    menuItems.value = defaultMenuItems
    computeMenuDistribution()
  }

  // 切换侧滑菜单
  const toggleSlideMenu = () => {
    isSlideMenuOpen.value = !isSlideMenuOpen.value

    // 控制背景滚动
    if (isSlideMenuOpen.value) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
  }

  // 关闭侧滑菜单
  const closeSlideMenu = () => {
    isSlideMenuOpen.value = false
    document.body.style.overflow = ''
  }

  // 打开侧滑菜单
  const openSlideMenu = () => {
    isSlideMenuOpen.value = true
    document.body.style.overflow = 'hidden'
  }

  // 处理菜单点击
  const handleMenuClick = (menu: MenuItem) => {
    const path = menu.url || menu.path

    if (path) {
      if (path.startsWith('http')) {
        // 外部链接
        window.open(path, '_blank')
      } else {
        // 内部路由 - 检查是否为当前路由，避免重复导航警告
        if (router.currentRoute.value.path !== path) {
          router.push(path)
        }
      }
    }

    // 移动端点击后自动关闭菜单
    if (isMobile.value) {
      closeSlideMenu()
    }
  }

  // 处理快捷操作
  const handleQuickAction = (action: any) => {
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

  // 处理键盘事件
  const handleKeyDown = (e: KeyboardEvent) => {
    // ESC键关闭菜单
    if (e.key === 'Escape' && isSlideMenuOpen.value) {
      closeSlideMenu()
    }

    // Ctrl/Cmd + M 打开菜单（桌面端）
    if ((e.ctrlKey || e.metaKey) && e.key === 'm' && !isMobile.value) {
      e.preventDefault()
      toggleSlideMenu()
    }
  }

  // 响应式处理
  const handleResize = () => {
    computeMenuDistribution()

    // 屏幕旋转或尺寸变化时关闭菜单
    if (isSlideMenuOpen.value) {
      closeSlideMenu()
    }
  }

  // 处理滚动事件（自动隐藏底部导航）
  let scrollTimer: NodeJS.Timeout
  let lastScrollY = 0
  const handleScroll = () => {
    if (!config.enableAutoHide || !isMobile.value) return

    const currentScrollY = window.scrollY
    const scrollDelta = currentScrollY - lastScrollY

    // 向下滚动超过100px时隐藏
    if (scrollDelta > 100) {
      isBottomNavVisible.value = false
    }
    // 向上滚动超过50px时显示
    else if (scrollDelta < -50) {
      isBottomNavVisible.value = true
    }

    lastScrollY = currentScrollY

    // 停止滚动2秒后自动显示
    if (scrollTimer) {
      clearTimeout(scrollTimer)
    }
    scrollTimer = setTimeout(() => {
      isBottomNavVisible.value = true
    }, 2000)
  }

  // 退出登录
  const handleLogout = () => {
    authStore.logout()
    router.push('/login')
  }

  // ========== 生命周期 ==========
  onMounted(() => {
    // 加载菜单数据
    loadMenuData()

    // 添加事件监听器
    if (isMobile.value && config.enableGestures) {
      document.addEventListener('touchstart', handleGlobalTouchStart, { passive: true })
      document.addEventListener('touchend', handleGlobalTouchEnd, { passive: true })
    }

    window.addEventListener('resize', handleResize)
    window.addEventListener('keydown', handleKeyDown)

    if (config.enableAutoHide) {
      window.addEventListener('scroll', handleScroll, { passive: true })
    }

    // 监听屏幕方向变化
    window.addEventListener('orientationchange', handleResize)
  })

  onUnmounted(() => {
    // 清理事件监听器
    document.removeEventListener('touchstart', handleGlobalTouchStart)
    document.removeEventListener('touchend', handleGlobalTouchEnd)
    window.removeEventListener('resize', handleResize)
    window.removeEventListener('keydown', handleKeyDown)
    window.removeEventListener('scroll', handleScroll)
    window.removeEventListener('orientationchange', handleResize)

    if (scrollTimer) {
      clearTimeout(scrollTimer)
    }

    // 恢复滚动
    document.body.style.overflow = ''
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
    isBottomNavVisible,

    // 数据
    userInfo,
    menuItems,
    bottomNavItems,
    slideMenuItems,
    activeQuickActions,

    // 方法
    toggleSlideMenu,
    closeSlideMenu,
    openSlideMenu,
    handleMenuClick,
    handleQuickAction,
    handleLogout,

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