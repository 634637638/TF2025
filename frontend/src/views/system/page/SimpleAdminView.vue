<template>
  <div class="admin-container">
    <!-- Font Awesome -->
    <link rel="stylesheet" href="https://cdn.bootcdn.net/ajax/libs/font-awesome/6.4.0/css/all.min.css">

    <!-- 屏幕锁定覆盖层 -->
    <ScreenLock :isLocked="isLocked" @update:isLocked="handleLockStateChange" />

    <div class="admin-layout">
      <!-- 桌面端侧边栏 - 仅在非移动端显示 -->
      <SimpleSidebar
        v-if="!isMobile"
        :collapsed="sidebarCollapsed"
        :menu-items="menuItems"
        @menu-click="handleMenuNavigation"
        class="sidebar-component"
      />

      <!-- 移动端响应式菜单 - 仅在移动端显示 -->
      <ResponsiveMenu
        v-else
        ref="responsiveMenuRef"
        :menu-items="menuItems"
        :sidebar-collapsed="sidebarCollapsed"
        :show-menu-button="true"
        :enable-gestures="true"
        :enable-auto-hide="true"
        :quick-actions="quickActions"
        @menu-click="handleMenuNavigation"
      />

      <!-- 全局通知容器 -->
      <NotificationContainer />

      <!-- 主内容区域 -->
      <div class="main-content" :class="{ expanded: sidebarCollapsed }">
        <!-- 顶部栏 -->
        <header class="topbar" :class="{ scrolled: isScrolled }">
          <div class="header-left">
            <!-- 多标签页 - 仅PC端显示 -->
            <TabsBar v-if="!isMobile" />
          </div>
          <div class="topbar-actions">
            <!-- 用户信息显示 -->
            <div class="user-info" v-if="isAuthenticated">
              <!-- 用户头像放在最前面 -->
              <div class="user-avatar">
                <i class="fas fa-user-circle"></i>
              </div>

              <!-- 用户信息区域：姓名和角色 -->
              <div class="user-main-info">
                <div class="user-name">{{ authUser?.name || authUser?.username || '未知用户' }}</div>
                <span class="user-role">{{ userRoleText }}</span>
              </div>

              <!-- 时间信息放在最后 -->
              <div class="user-time-info">
                <span class="last-login">
                  {{ beijingTime }}
                </span>
              </div>
            </div>
            <div class="action-buttons">
              <!-- 屏幕锁定按钮 -->
              <button class="btn btn-lock" @click="toggleScreenLock" :title="isLocked ? '解锁屏幕' : '锁定屏幕'">
                <i :class="isLocked ? 'fas fa-unlock' : 'fas fa-lock'"></i>
                <span>{{ isLocked ? '解锁' : '锁定' }}</span>
              </button>
              <button class="logout-btn" @click="handleLogout" title="退出登录">
                <i class="fas fa-power-off"></i>
                <span class="btn-text">退出登录</span>
              </button>
            </div>
          </div>
        </header>

        <!-- 内容区域 -->
        <div class="content-area" ref="contentAreaRef">
          <!-- 子路由视图 - 简单缓存所有页面 -->
          <router-view />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import ResponsiveMenu from '@/components/ResponsiveMenu.vue'
import SimpleSidebar from '@/components/SimpleSidebar.vue'
import NotificationContainer from '@/components/NotificationContainer.vue'
import ScreenLock from '@/components/ScreenLock.vue'
import TabsBar from '@/components/TabsBar.vue'
import { useMenuWidth } from '@/composables/useMenuWidth'
import { useMobile } from '@/composables/useMobile'
import { useScreenLock } from '@/composables/useScreenLock'
import { unifiedApi as api } from '@/utils/unified-api'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useSiteSettingsStore } from '@/stores/siteSettings'
import { useMenuStore } from '@/stores/menu'
import { useTabsStore } from '@/stores/tabs'
import { storeToRefs } from 'pinia'
import { ElMessageBox } from 'element-plus'
import type { MenuItem } from '@/types/menu'
import { TimeUtil, TIME_FORMATS } from '@/utils/time'
import { storage } from '@/services/storage'
import { SECURITY_STORAGE_KEYS } from '@/constants/storage'

// 路由
const router = useRouter()
const route = useRoute()

// 认证状态管理
const authStore = useAuthStore()
const siteSettingsStore = useSiteSettingsStore()
const menuStore = useMenuStore()
const tabsStore = useTabsStore()
const { user: authUser, isAuthenticated } = storeToRefs(authStore)
const { menuItems } = storeToRefs(menuStore)

// 移动端检测
const { isMobile } = useMobile()

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
    id: 'new-sale',
    name: '新建销售',
    icon: 'fas fa-plus-circle',
    handler: () => {
      router.push('/sales/create')
    }
  },
  {
    id: 'quick-search',
    name: '快速查询',
    icon: 'fas fa-search',
    handler: () => {
      router.push('/query')
    }
  },
  {
    id: 'inventory-check',
    name: '库存盘点',
    icon: 'fas fa-clipboard-check',
    handler: () => {
      router.push('/inventory/check')
    }
  },
  {
    id: 'today-report',
    name: '今日报表',
    icon: 'fas fa-chart-bar',
    badge: '新',
    handler: () => {
      router.push('/analytics/today')
    }
  }
])

// 计算属性
const formatRoleLabel = (role: any) => {
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
let timeInterval = null
const updateBeijingTime = () => {
  const now = TimeUtil.now()
  beijingTime.value = now.format('HH:mm:ss')
}


// 方法
const handleMenuNavigation = async (menu) => {
  // 获取目标路径
  const targetPath = menu.url || menu.path

  // 检查是否有有效路径
  if (!targetPath || targetPath === '#' || targetPath === '') {
    return
  }

  // 检查是否为当前路径，避免冗余导航
  if (route.path === targetPath) {
    return
  }

  try {
    // 使用Vue Router进行导航，添加错误处理防止导航取消错误
    await router.push(targetPath)
  } catch (error) {
    // 静默处理导航取消
  }
}


const handleLogout = async () => {
  try {
    await ElMessageBox.confirm(
      '确定要退出登录吗？',
      '退出确认',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning',
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
    // 如果用户未认证，跳转到登录页
    if (!isAuthenticated.value) {
      window.location.href = '/login'
      return
    }
  } catch (error) {
    logger.error('认证检查失败:', error)
    window.location.href = '/login'
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

// 监听路由变化，自动添加标签页
watch(
  () => route.path,
  (newPath) => {
    if (newPath && !isMobile.value) {
      const pageInfo = getPageInfo(newPath)
      tabsStore.addTab({
        path: newPath,
        title: pageInfo.title as string,
        icon: pageInfo.icon as string
      })
    }
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

<style scoped>
.admin-container {
  height: 100vh;
  width: 100vw;
  overflow: hidden;
}

.admin-layout {
  display: flex;
  height: 100%;
}

.sidebar-component {
  width: var(--sidebar-width, 150px); /* 使用CSS变量，默认150px */
  flex-shrink: 0;
  transition: width 0.3s ease;
}

.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  margin-left: 0;
  transition: margin-left 0.3s ease;
  background-color: #f5f5f5;
  overflow: hidden;
}

.topbar {
  background: white;
  padding: 0;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  border-bottom: 1px solid #e8ecef;
  display: flex;
  justify-content: space-between;
  align-items: stretch;
  flex-shrink: 0;
  position: sticky;
  top: 0;
  z-index: 100;
  transition: box-shadow 0.3s ease, border-color 0.3s ease;
  min-height: 56px;
}

.topbar.scrolled {
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  border-bottom-color: #d8dee9;
}

.header-left {
  flex: 1;
  display: flex;
  align-items: stretch;
  overflow: hidden;
}

.topbar-actions {
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 0 20px;
  flex-shrink: 0;
}

.breadcrumb {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
}

.breadcrumb-item {
  color: #666;
  text-decoration: none;
  display: flex;
  align-items: center;
  gap: 4px;
  transition: color 0.3s ease;
  cursor: pointer;
}

.breadcrumb-item:hover {
  color: #3498db;
}

.breadcrumb-item.current {
  color: #333;
  font-weight: 600;
  cursor: default;
}

.breadcrumb-separator {
  color: #999;
  font-size: 12px;
}

.header-divider {
  width: 1px;
  height: 24px;
  background: #ddd;
  margin: 0 20px;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 40px; /* 与按钮高度保持一致 */
  padding: 0 14px;
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.08) 0%, rgba(118, 75, 162, 0.08) 100%);
  border-radius: 5px; /* 与按钮圆角保持一致 */
  border: 1px solid rgba(102, 126, 234, 0.15);
  backdrop-filter: blur(10px);
  transition: all 0.3s ease;
  box-sizing: border-box;
}

.user-info:hover {
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.12) 0%, rgba(118, 75, 162, 0.12) 100%);
  border-color: rgba(102, 126, 234, 0.25);
  transform: translateY(-1px);
  box-shadow: 0 2px 6px rgba(102, 126, 234, 0.2);
}

.user-avatar {
  width: 28px; /* 调整头像大小以适应40px高度 */
  height: 28px;
  border-radius: 50%;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 14px; /* 调整字体大小 */
  flex-shrink: 0;
  box-shadow: 0 2px 4px rgba(102, 126, 234, 0.3);
  position: relative;
  overflow: hidden;
}

.user-avatar::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(45deg, rgba(255,255,255,0.1) 0%, transparent 50%);
}

.user-main-info {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1 1 auto;
  min-width: 0;
  height: 100%;
}

.user-time-info {
  flex-shrink: 0;
  margin-left: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  padding: 0 6px;
}


.user-name {
  display: inline-flex;
  align-items: center;
  font-size: 14px;
  font-weight: 600;
  color: #8a3f00;
  line-height: 1;
  white-space: nowrap;
  max-width: 100%;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  padding: 4px 10px;
  border-radius: 10px;
  background: linear-gradient(135deg, rgba(255, 191, 71, 0.22) 0%, rgba(255, 214, 102, 0.16) 100%);
  border: 1px solid rgba(240, 166, 0, 0.28);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.7),
    0 1px 2px rgba(240, 166, 0, 0.08);
}

.user-role {
  font-size: 10px;
  color: #667eea;
  font-weight: 600;
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%);
  padding: 2px 6px;
  border-radius: 12px;
  display: inline-flex;
  align-items: center;
  line-height: 1;
  text-transform: uppercase;
  letter-spacing: 0.3px;
  border: 1px solid rgba(102, 126, 234, 0.2);
  width: fit-content;
  flex-shrink: 0;
}

.last-login {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  color: #667eea;
  white-space: nowrap;
  font-weight: 600;
  letter-spacing: 0.5px;
  font-family: 'Courier New', monospace;
  min-width: 70px;
}

.user-status {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  color: #95a5a6;
}

.status-indicator {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.status-indicator.online {
  background: #2ecc71;
  box-shadow: 0 0 0 2px rgba(46, 204, 113, 0.2);
}

.login-time {
  font-size: 10px;
  color: #bdc3c7;
}

.action-buttons {
  display: flex;
  gap: 10px;
}

.btn {
  padding: 8px 16px;
  border: none;
  border-radius: 5px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.3s ease;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

.btn-primary {
  background: #3498db;
  color: white;
}

.btn-primary:hover {
  background: #2980b9;
}

.btn-primary:disabled {
  background: #bdc3c7;
  cursor: not-allowed;
}

.btn-lock {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.btn-lock:hover {
  background: linear-gradient(135deg, #5a6fd8 0%, #6a4190 100%);
  transform: translateY(-1px);
  box-shadow: 0 2px 6px rgba(102, 126, 234, 0.3);
}

.btn-lock:active {
  transform: translateY(0);
}

.logout-btn {
  background: #e74c3c;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 5px;
  cursor: pointer;
  transition: background 0.3s ease;
  font-size: 14px;
}

.logout-btn:hover {
  background: #c0392b;
}

.content-area {
  flex: 1;
  padding: 20px;
  overflow-y: auto;
  min-height: 0; /* 确保flex子元素可以滚动 */
  position: relative;
}

/* 禁用路由切换动画，避免闪烁 */
.content-area :deep(.v-enter-active),
.content-area :deep(.v-leave-active) {
  transition: none !important;
}

.content-area :deep(.v-enter-from),
.content-area :deep(.v-leave-to) {
  opacity: 1 !important;
  transform: none !important;
}

.welcome-section {
  background: white;
  padding: 24px;
  border-radius: 8px;
  margin-bottom: 20px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.welcome-section h1 {
  margin: 0 0 8px 0;
  color: #2c3e50;
  font-size: 28px;
}

.welcome-section p {
  margin: 0;
  color: #7f8c8d;
  font-size: 16px;
}

.dashboard h2 {
  margin: 0 0 20px 0;
  color: #2c3e50;
  font-size: 22px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 20px;
}

.stat-card {
  background: white;
  padding: 20px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.stat-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0,0,0,0.15);
}

.stat-icon {
  width: 50px;
  height: 50px;
  background: #409EFF;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 16px;
  flex-shrink: 0;
}

.stat-icon i {
  color: white;
  font-size: 20px;
}

.stat-content h3 {
  margin: 0 0 4px 0;
  color: #2c3e50;
  font-size: 16px;
  font-weight: 600;
}

.stat-content p {
  margin: 0;
  color: #7f8c8d;
  font-size: 14px;
}

.placeholder-content {
  background: white;
  padding: 40px;
  border-radius: 8px;
  text-align: center;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.placeholder-content h2 {
  margin: 0 0 12px 0;
  color: #2c3e50;
  font-size: 24px;
}

.placeholder-content p {
  margin: 0;
  color: #7f8c8d;
  font-size: 16px;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .admin-layout {
    position: relative;
  }

  .main-content {
    margin-left: 0 !important;
    padding-bottom: max(0px, env(safe-area-inset-bottom));
  }

  .stats-grid {
    grid-template-columns: 1fr;
  }

  .content-area {
    padding: 4px 2px;
  }

  .topbar {
    padding: 8px 12px;
    padding-left: 70px; /* 为汉堡按钮预留空间 */
    flex-direction: row;
    gap: 8px;
    align-items: center;
    position: sticky;
    top: 0;
    z-index: 100;
    min-height: 56px; /* 确保最小高度适合触摸 */
  }

  .topbar-actions {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: 6px;
    flex: 1;
    min-width: 0;
  }

  .user-info {
    gap: 6px;
    height: 40px;
    padding: 4px 10px;
    min-width: 0;
    flex: 1 1 auto;
    max-width: none;
  }

  .user-avatar {
    width: 28px;
    height: 28px;
    font-size: 12px;
    flex-shrink: 0; /* 头像不缩小 */
  }

  .user-main-info {
    flex: 1; /* 主要信息区域占据剩余空间 */
    min-width: 0; /* 允许缩小 */
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 2px;
  }

  .user-name {
    font-size: 11px;
    font-weight: 600;
    line-height: 1.2;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 100%;
    padding: 3px 8px;
    border-radius: 8px;
  }

  .user-role {
    font-size: 9px;
    padding: 1px 4px;
    display: inline-flex; /* 显示角色标签 */
    line-height: 1;
    white-space: nowrap;
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .user-time-info {
    display: none; /* 中等屏幕隐藏时间信息 */
  }

  .last-login {
    font-size: 10px;
  }

  .action-buttons {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
  }

  .btn {
    padding: 8px 10px;
    font-size: 12px;
    min-height: 36px;
    white-space: nowrap;
    flex-shrink: 0;
  }

  /* 锁定按钮图标优先，文字可能隐藏 */
  .btn-lock span {
    display: none; /* 隐藏按钮文字，只显示图标 */
  }

  .btn-lock {
    padding: 8px;
    min-width: 36px;
    justify-content: center;
  }
}

@media (max-width: 480px) {
  .topbar {
    padding: 6px 8px;
    padding-left: 56px;
    min-height: 52px;
  }

  .header-left {
    display: none; /* 隐藏网站标题以节省空间 */
  }

  .topbar-actions {
    width: 100%;
    justify-content: space-between;
    gap: 6px;
  }

  .user-info {
    height: 36px;
    padding: 4px 10px;
    justify-content: flex-start;
    width: auto;
    min-width: 0;
    flex: 0 1 auto;
    max-width: calc(100% - 92px);
    gap: 8px;
  }

  .user-avatar {
    width: 24px;
    height: 24px;
    font-size: 10px;
    flex-shrink: 0; /* 头像不缩小 */
  }

  .user-main-info {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 6px;
    flex: 0 1 auto;
    min-width: 0;
    height: 100%;
  }

  .user-name {
    font-size: 12px;
    font-weight: 600;
    line-height: 1;
    white-space: nowrap;
    flex: 0 1 auto;
    min-width: 0;
    width: fit-content;
    max-width: min(36vw, 140px);
    overflow: hidden;
    text-overflow: ellipsis;
    padding: 3px 8px;
    border-radius: 8px;
  }

  .user-role {
    font-size: 10px;
    padding: 3px 6px;
    border-radius: 8px;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .action-buttons {
    gap: 6px;
    flex-shrink: 0;
  }

  /* 强制统一按钮样式 */
  .btn, .btn-lock, .logout-btn {
    padding: 5px !important;
    min-width: 30px !important;
    min-height: 30px !important;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    box-sizing: border-box;
  }

  .btn-lock i {
    font-size: 14px; /* 锁定按钮图标大小 */
  }

  .btn-lock span {
    display: none; /* 隐藏文字，只显示图标 */
  }

  /* 退出登录按钮在小屏幕上只显示图标 */
  .logout-btn {
    font-size: 0; /* 隐藏文字 */
    border-radius: 4px;
  }

  .logout-btn i {
    font-size: 14px; /* 退出按钮图标大小 */
  }

  .logout-btn .btn-text {
    display: none; /* 隐藏文字，只显示图标 */
  }

  /* 添加工具提示说明 */
  .btn {
    position: relative;
  }

  .btn::before {
    content: attr(title);
    position: absolute;
    bottom: 100%;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(0, 0, 0, 0.8);
    color: white;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 12px;
    white-space: nowrap;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.2s;
    z-index: 1000;
    margin-bottom: 4px;
  }

  .btn:hover::before {
    opacity: 1;
  }
}

/* 滚动条样式 */
.content-area::-webkit-scrollbar {
  width: 6px;
}

.content-area::-webkit-scrollbar-track {
  background: #f1f1f1;
}

.content-area::-webkit-scrollbar-thumb {
  background: #c1c1c1;
  border-radius: 3px;
}

.content-area::-webkit-scrollbar-thumb:hover {
  background: #a8a8a8;
}
</style>
