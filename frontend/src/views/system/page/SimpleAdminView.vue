<template>
  <div
    class="admin-container"
    :class="{ 'compact-device': !isDesktopLayout }"
  >
    <!-- 屏幕锁定覆盖层 -->
    <ScreenLock
      :is-locked="isLocked"
      @update:is-locked="handleLockStateChange"
    />

    <div class="admin-layout">
      <!-- 桌面端侧边栏 - 仅在桌面端常驻显示 -->
      <SimpleSidebar
        v-if="isDesktopLayout"
        :collapsed="sidebarCollapsed"
        :menu-items="menuItems"
        class="sidebar-component"
        @menu-click="handleMenuNavigation"
      />

      <!-- 手机和平板统一使用侧滑菜单 -->
      <ResponsiveMenu
        v-else
        ref="responsiveMenuRef"
        :menu-items="menuItems"
        :show-menu-button="true"
        :enable-gestures="true"
        :quick-actions="quickActions"
        @menu-click="handleMenuNavigation"
      />

      <!-- 全局通知容器 -->
      <NotificationContainer />
      <ReminderHost />

      <!-- 主内容区域 -->
      <div
        class="main-content"
        :class="{ expanded: sidebarCollapsed }"
      >
        <!-- 顶部栏 -->
        <header
          class="topbar"
          :class="{ scrolled: isScrolled }"
        >
          <div class="header-left">
            <!-- 多标签页 - 仅桌面端显示 -->
            <TabsBar v-if="isDesktopLayout" />
          </div>
          <div class="topbar-actions">
            <!-- 用户信息显示 -->
            <div
              v-if="isAuthenticated"
              class="user-info"
            >
              <!-- 用户头像放在最前面 -->
              <div class="user-avatar">
                <i class="fas fa-user-circle" />
              </div>

              <!-- 用户信息区域：姓名和角色 -->
              <div class="user-main-info">
                <div class="user-name">
                  {{ authUser?.name || authUser?.username || '未知用户' }}
                </div>
                <span class="user-role">{{ userRoleText }}</span>
              </div>

              <!-- 时间信息放在最后 -->
              <div class="user-time-info">
                <span class="last-login">
                  {{ beijingTime }}
                </span>
              </div>
            </div>
            <div class="topbar-buttons">
              <!-- 屏幕锁定按钮 -->
              <el-button
                native-type="button"
                type="info"
                class="btn tf-button--topbar tf-button--manage btn-lock"
                :title="isLocked ? '解锁屏幕' : '锁定屏幕'"
                @click="toggleScreenLock"
              >
                <i :class="isLocked ? 'fas fa-unlock' : 'fas fa-lock'" />
                <span>{{ isLocked ? '解锁' : '锁定' }}</span>
              </el-button>
              <el-button
                native-type="button"
                type="danger"
                class="btn tf-button--topbar tf-button--danger logout-btn"
                title="退出登录"
                @click="handleLogout"
              >
                <i class="fas fa-power-off" />
                <span class="btn-text">退出登录</span>
              </el-button>
            </div>
          </div>
        </header>

        <!-- 内容区域 -->
        <div
          ref="contentAreaRef"
          class="content-area"
        >
          <!-- 已打开标签页保持组件实例，切换页面不重载；只有手动刷新当前标签时才重建当前页面 -->
          <router-view v-slot="{ Component, route: viewRoute }">
            <KeepAlive :max="12">
              <component
                :is="Component"
                v-if="!isRefreshingCurrentRoute(viewRoute.path)"
                :key="getRouteCacheKey(viewRoute.path)"
              />
            </KeepAlive>
          </router-view>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { confirmAction } from '@/utils/message-box'
import { ref, computed, nextTick, onMounted, onUnmounted, watch } from 'vue'
import ResponsiveMenu from '@/components/ResponsiveMenu.vue'
import SimpleSidebar from '@/components/SimpleSidebar.vue'
import NotificationContainer from '@/components/NotificationContainer.vue'
import ReminderHost from '@/components/ReminderHost.vue'
import ScreenLock from '@/components/ScreenLock.vue'
import TabsBar from '@/components/TabsBar.vue'
import { useMenuWidth } from '@/composables/useMenuWidth'
import { useMobile } from '@/composables/mobile'
import { useScreenLock } from '@/composables/useScreenLock'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useSiteSettingsStore } from '@/stores/siteSettings'
import { useMenuStore } from '@/stores/menu'
import { useTabsStore } from '@/stores/tabs'
import { storeToRefs } from 'pinia'

import type { MenuItem } from '@/types/menu'
import { isDesktopNavigationViewport } from '@/config/breakpoints'
import { TIME_FORMATS, TimeUtil } from '@/utils/time'
import { storage } from '@/services/storage'
import { canAccessRoutePath } from '@/constants/routePermissions'
import { logger } from '@/utils/logger'
import { useNotification } from '@/composables/useNotification'
const globalNotifications = useNotification()


// 路由
const router = useRouter()
const route = useRoute()

// 认证状态管理
const authStore = useAuthStore()
const _siteSettingsStore = useSiteSettingsStore()
const menuStore = useMenuStore()
const tabsStore = useTabsStore()
const { user: authUser, isAuthenticated } = storeToRefs(authStore)
const { menuItems } = storeToRefs(menuStore)
const scrollPositions = new Map<string, number>()
const getRouteCacheKey = (path: string) => `${path}:${tabsStore.tabRefreshVersions[path] || 0}`
const isRefreshingCurrentRoute = (path: string) => tabsStore.refreshingPath === path

// 移动端检测
const { isDesktop, screenWidth } = useMobile()
const isDesktopLayout = computed(() => (
  isDesktop.value &&
  isDesktopNavigationViewport(screenWidth.value)
))

// 使用菜单宽度组合式函数
const { menuWidth, loadAllMenuWidths } = useMenuWidth()

// 使用屏幕锁定功能
const { isLocked, lockScreen, unlockScreen, initializeLock } = useScreenLock()

// 响应式数据
const sidebarCollapsed = ref(false)
const beijingTime = ref('')
const responsiveMenuRef = ref()
const contentAreaRef = ref<HTMLElement | null>(null)
const isScrolled = ref(false)

// 快捷操作接口定义
interface QuickAction {
  id: string
  name: string
  icon: string
  badge?: string
  handler: () => void
}

// 快捷操作
const quickActions = ref<QuickAction[]>([
  {
    id: 'quick-search',
    name: '快速查询',
    icon: 'fas fa-search',
    handler: () => {
      navigateIfAllowed('/query')
    }
  }
])

// 计算属性
const formatRoleLabel = (role: string | { name?: string; code?: string } | null | undefined) => {
  if (!role) return ''
  if (typeof role === 'string') return role
  return role.name || role.code || ''
}

const userRoleText = computed(() => {
  const currentUser = authStore.user
  const roleLabels = (Array.isArray(authStore.userRoles) ? authStore.userRoles : [])
    .map(formatRoleLabel)
    .filter(Boolean)

  if (roleLabels.length > 0) {
    return roleLabels.join(' / ')
  }

  const fallbackRole = formatRoleLabel(currentUser?.role)
  return fallbackRole || '未分配角色'
})


// 更新北京时间
let timeInterval: ReturnType<typeof setInterval> | null = null
const updateBeijingTime = () => {
  const now = TimeUtil.now()
  beijingTime.value = TimeUtil.format(now, TIME_FORMATS.TIME)
}


// 方法
const navigateIfAllowed = async (targetPath: string) => {
  if (!canAccessRoutePath(targetPath, authStore)) {
    tabsStore.closeTab(targetPath)
    globalNotifications.warning('您没有访问此页面的权限')
    return
  }

  await router.push(targetPath)
}

const handleMenuNavigation = async (menu: MenuItem) => {
  // 获取目标路径
  const targetPath = menu.url || menu.path

  // 检查是否有有效路径
  if (!targetPath || targetPath === '#' || targetPath === '') {
    return
  }

  if (/^https?:\/\//i.test(targetPath)) {
    window.open(targetPath, '_blank', 'noopener,noreferrer')
    return
  }

  // 检查是否为当前路径，避免冗余导航
  if (route.path === targetPath) {
    return
  }

  try {
    // 内部菜单统一经过权限预检后再交给路由守卫处理。
    await navigateIfAllowed(targetPath)
  } catch (error) {
    // 静默处理导航取消
  }
}


const handleLogout = async () => {
  try {
    await confirmAction(
      '确定要退出登录吗？',
      '退出确认',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning',
        customClass: 'message-box-logout',
        center: true
      }
    )

    // 用户点击了确定，执行退出
    try {
      // 使用认证store的退出方法
      await authStore.logout('用户主动退出')
    } catch (err) {
      logger.error('退出登录请求失败:', err)
      // 即使API调用失败，也要清除本地状态并跳转
      authStore.clearAuth()
      window.location.href = '/login'
    }
  } catch {
    // 用户点击了取消，不做任何操作
  }
}

// 切换屏幕锁定状态
const toggleScreenLock = () => {
  if (isLocked.value) {
    unlockScreen()
  } else {
    lockScreen()
  }
}

// 处理屏幕锁定状态变化
const handleLockStateChange = (locked: boolean) => {
  // 直接更新isLocked状态值
  isLocked.value = locked

  // 同步到localStorage
  storage.setScreenLocked(locked)
  document.body.style.overflow = locked ? 'hidden' : ''
}

// 加载菜单数据
const loadMenus = async () => {
  await menuStore.loadMenus()
}

const checkAuth = async () => {
  try {
    if (!isAuthenticated.value) {
      const hasPersistedAuth = Boolean(storage.getToken() || storage.getAuth())
      if (hasPersistedAuth || authStore.isAuthenticating) {
        await authStore.loadPersistedAuthData()
      }
    }

    // 这里不再做页面级强制跳转，交给全局路由守卫统一处理，
    // 避免首次恢复登录态时出现“页面先加载再被踢回登录”的竞态。
    if (!isAuthenticated.value) {
      return
    }
  } catch (error) {
    logger.error('认证检查失败:', error)
  }
}

// 监听菜单宽度变化
watch(menuWidth, (newWidth) => {
  // 更新CSS变量
  document.documentElement.style.setProperty('--sidebar-width', `${newWidth}px`)
}, { immediate: true })

// 滚动监听处理
const handleScroll = () => {
  if (contentAreaRef.value) {
    isScrolled.value = contentAreaRef.value.scrollTop > 10
  }
}

const saveRouteScrollPosition = (path: string) => {
  if (!path || !contentAreaRef.value) return
  scrollPositions.set(path, contentAreaRef.value.scrollTop || 0)
}

const restoreRouteScrollPosition = async (path: string) => {
  await nextTick()
  requestAnimationFrame(() => {
    if (!contentAreaRef.value) return
    contentAreaRef.value.scrollTop = scrollPositions.get(path) || 0
    isScrolled.value = contentAreaRef.value.scrollTop > 10
  })
}

// 根据路由信息获取页面标题和图标
const getPageInfo = (routePath: string) => {
  // 从菜单中查找匹配的菜单项
  const findMenuItem = (items: MenuItem[], path: string): MenuItem | null => {
    for (const item of items) {
      if (item.url === path) return item
      if (item.children) {
        const found = findMenuItem(item.children, path)
        if (found) return found
      }
    }
    return null
  }

  const menuItem = findMenuItem(menuItems.value, routePath)
  return {
    title: menuItem?.name || route.meta?.title || '未命名页面',
    icon: menuItem?.icon || route.meta?.icon || 'fas fa-file'
  }
}

const canAddRouteTab = (routePath: string) => {
  return canAccessRoutePath(routePath, authStore)
}

// 监听路由变化，自动添加标签页
watch(
  () => route.path,
  (newPath, oldPath) => {
    if (oldPath) {
      saveRouteScrollPosition(oldPath)
    }

    if (newPath && isDesktopLayout.value) {
      if (!canAddRouteTab(newPath)) {
        tabsStore.closeTab(newPath)
        return
      }

      const pageInfo = getPageInfo(newPath)
      tabsStore.addTab({
        path: newPath,
        title: pageInfo.title as string,
        icon: pageInfo.icon as string
      })
    }

    void restoreRouteScrollPosition(newPath)
  },
  { immediate: true }
)

// 生命周期
onMounted(async () => {
  await checkAuth()

  // 初始化屏幕锁定
  initializeLock()

  // 加载菜单数据
  await loadMenus()

  // 使用组合式函数加载菜单宽度（从 API 加载）
  await loadAllMenuWidths()

  // 初始化时间显示
  updateBeijingTime()
  // 设置每秒更新一次时间
  timeInterval = setInterval(updateBeijingTime, 1000)

  // 添加滚动监听
  if (contentAreaRef.value) {
    contentAreaRef.value.addEventListener('scroll', handleScroll)
  }
})

onUnmounted(() => {
  // 清除定时器，防止内存泄漏
  if (timeInterval) {
    clearInterval(timeInterval)
    timeInterval = null
  }

  // 移除滚动监听
  if (contentAreaRef.value) {
    contentAreaRef.value.removeEventListener('scroll', handleScroll)
  }
})
</script>

<style scoped src="./styles/simple-admin/shell.css"></style>
<style scoped src="./styles/simple-admin/content-responsive.css"></style>
<style scoped src="./styles/simple-admin/compact-and-scrollbar.css"></style>
