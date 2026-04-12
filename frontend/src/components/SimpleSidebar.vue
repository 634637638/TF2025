<template>
  <!-- 移动端遮罩层 -->
  <div
    v-if="isMobile && !collapsed"
    class="sidebar-overlay"
    @click="handleOverlayClick"
  ></div>

  <div
    class="modern-sidebar"
    :class="{
      'collapsed': props.collapsed,
      'mobile': isMobile,
      'mobile-open': isMobile && !props.collapsed,
      'theme-dark': isDark
    }"
    v-bind="attrs"
    @touchstart="handleTouchStart"
    @touchend="handleTouchEnd"
  >
  
    <!-- 菜单列表 -->
    <div class="menu-section">
      <template v-for="menu in menuList" :key="menu.id">
        <!-- 菜单项 -->
        <div
          class="menu-item"
          :class="{
            'active': isMenuActive(menu),
            'has-children': menu.children && menu.children.length > 0,
            'mobile-item': isMobile
          }"
          @click="handleMenuClick(menu)"
          :title="isMobile ? menu.name : ''"
          >
          <div class="menu-content">
            <div class="menu-icon">
              <!-- Iconify 图标 -->
              <span
                v-if="menu.icon && menu.icon.startsWith('iconify')"
                class="iconify"
                :data-icon="menu.icon.replace('iconify ', '')"
              ></span>
              <!-- Font Awesome 图标 -->
              <i v-else :class="menu.icon || 'fas fa-circle'"></i>
            </div>
            <div class="menu-text" v-show="!props.collapsed && !isMobile">
              {{ menu.name }}
            </div>
            <!-- 徽章 -->
            <div class="menu-badge" v-if="menu.badge && !props.collapsed && !isMobile">
              <span class="badge-count">{{ menu.badge }}</span>
            </div>
          </div>
          <!-- 展开/折叠图标 -->
          <div
            v-if="menu.children && menu.children.length > 0 && (!props.collapsed)"
            class="menu-arrow"
            :class="{ 'expanded': expandedMenus.has(menu.id) }"
          >
            <i class="fas fa-chevron-down"></i>
          </div>
        </div>

        <!-- 子菜单 -->
        <transition :name="isMobile ? 'slide-down' : 'sub-menu'">
          <div
            v-if="menu.children && menu.children.length > 0 && expandedMenus.has(menu.id)"
            class="sub-menu"
            :class="{ 'mobile-sub-menu': isMobile }"
          >
            <template v-for="child in menu.children" :key="child.id">
              <div
                class="menu-item sub-item"
                :class="{
                  'active': isMenuActive(child),
                  'mobile-item': isMobile
                }"
                @click="navigateToMenu(child)"
                >
                <div class="menu-content">
                  <div class="menu-icon">
                    <!-- Iconify 图标 -->
                    <span
                      v-if="child.icon && child.icon.startsWith('iconify')"
                      class="iconify"
                      :data-icon="child.icon.replace('iconify ', '')"
                    ></span>
                    <!-- Font Awesome 图标 -->
                    <i v-else :class="child.icon || 'fas fa-circle'"></i>
                  </div>
                  <div class="menu-text" v-show="!props.collapsed && !isMobile">
                    {{ child.name }}
                  </div>
                </div>
              </div>
            </template>
          </div>
        </transition>
      </template>
    </div>

  
  
    <!-- 拖动调整宽度的手柄 -->
    <div
      v-if="!isMobile"
      class="resize-handle"
      @mousedown="handleResizeStart"
      title="拖动调整宽度"
    ></div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, useAttrs, watch, nextTick } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useMobile, useMobileGestures } from '../composables/useMobile'
import { useTheme } from '../composables/useTheme'
import { useMenuWidth } from '../composables/useMenuWidth'
import { useAuthStore } from '../stores/auth'
import { useEventBus } from '../composables/core/useEventBus'
import { refreshIconifyIcons, waitForIconify } from '../utils/iconify'
import unifiedApi from '@/utils/unified-api'
import { logger } from '@/utils/logger'

// 使用菜单宽度组合式函数
const { menuWidth, updateWidth, setMenuWidth, loadAllMenuWidths } = useMenuWidth()

// Props
const props = defineProps({
  collapsed: {
    type: Boolean,
    default: false
  },
  menuItems: {
    type: Array,
    default: undefined  // 改为 undefined，避免空数组覆盖数据
  }
})

// Emits
const emit = defineEmits(['menu-click', 'mobile-close'])

// Router
const router = useRouter()
const route = useRoute()

// 获取非props属性
const attrs = useAttrs()

// Mobile Composables
const { isMobile } = useMobile()
const { handleTouchStart, handleTouchEnd } = useMobileGestures()

// Theme Composable
const { isDark } = useTheme()

// Reactive data
const menuList = ref([])
const expandedMenus = ref(new Set()) // 记录展开的菜单ID
const isResizing = ref(false) // 是否正在拖动调整宽度
let permissionsUpdateHandler = null

// Methods
const loadUserMenus = async () => {
  // 优先使用 props 传入的菜单数据
  if (props.menuItems && props.menuItems.length > 0) {
    menuList.value = props.menuItems
    return
  }

  // 没有 props 时，自己加载菜单
  await loadMenusFromAPI()
}

// 从 API 加载菜单
const loadMenusFromAPI = async () => {
  const authStore = useAuthStore()

  if (!authStore.isAuthenticated) {
    return
  }

  try {
    const response = await unifiedApi.get('/permissions/user-menu', {
      params: { _t: Date.now() }
    })

    if (response && response.success && response.data && response.data.menuPermissions) {
      menuList.value = response.data.menuPermissions
    } else if (response && response.success && response.data) {
      menuList.value = Array.isArray(response.data) ? response.data : []
    }

    // 菜单加载完成后刷新 Iconify 图标
    await nextTick()
    await waitForIconify(3000)
    refreshIconifyIcons()
  } catch (error) {
    logger.error('加载菜单失败:', error)
    menuList.value = []
  }
}

const handleMenuClick = async (menu) => {
  // 如果有子菜单且不是折叠状态，则切换展开/折叠状态
  if (menu.children && menu.children.length > 0 && !props.collapsed) {
    toggleMenuExpansion(menu.id)
  }

  // 检查路径是否有效，如果有效则进行导航
  // 这样既支持有子菜单的一级菜单（路径设为#），也支持有子菜单但同时有链接的菜单
  try {
    await navigateToMenu(menu)
  } catch (error) {
    // Error is already handled in navigateToMenu, just ignore here
  }
}

const toggleMenuExpansion = (menuId) => {
  if (expandedMenus.value.has(menuId)) {
    expandedMenus.value.delete(menuId)
  } else {
    expandedMenus.value.add(menuId)
  }
}

const isMenuActive = (menu) => {
  const currentPath = route.path
  const menuPath = menu.path || menu.url || ''

  // 处理路径格式，确保匹配
  const normalizedMenuPath = menuPath.replace(/\/+$/, '') // 移除末尾斜杠
  const normalizedCurrentPath = currentPath.replace(/\/+$/, '')

  return normalizedCurrentPath === normalizedMenuPath ||
         normalizedCurrentPath.startsWith(normalizedMenuPath + '/')
}

const navigateToMenu = async (menu) => {
  // 通知父组件
  emit('menu-click', menu)

  // 获取目标路径
  const targetPath = menu.url || menu.path

  // 检查是否有有效路径
  if (!targetPath || targetPath === '#' || targetPath === '') {
    return
  }

  // 检查当前路由，避免冗余导航
  const currentRoute = router.currentRoute.value
  if (currentRoute.path === targetPath || currentRoute.path === targetPath + '/') {
    // 已经在目标页面，不需要导航
    return
  }

  try {
    // 使用Vue Router进行导航
    await router.push(targetPath)
  } catch (error) {
    // 忽略导航取消错误和冗余导航错误，这些是正常的用户行为
    if (error.name === 'NavigationCancelledError' ||
        error.message?.includes('Navigation cancelled') ||
        error.message?.includes('Avoided redundant navigation') ||
        error.name === 'NavigationDuplicated' ||
        (error.type === 'async' && error.message?.includes('Navigation cancelled'))) {
      // 这些都是正常的导航行为，不需要显示错误
      return
    }
    // 其他错误仍然需要处理
    logger.error('菜单导航失败:', error)
  }
}


// 拖动调整宽度功能
const handleResizeStart = (event) => {
  isResizing.value = true
  document.body.style.cursor = 'col-resize'
  document.body.style.userSelect = 'none'

  const startX = event.clientX
  const sidebar = document.querySelector('.modern-sidebar')
  const startWidth = sidebar ? sidebar.offsetWidth : 280

  const handleMouseMove = (e) => {
    if (!isResizing.value) return

    const deltaX = e.clientX - startX
    const newWidth = Math.max(200, Math.min(500, startWidth + deltaX))

    if (sidebar) {
      sidebar.style.width = `${newWidth}px`

      // 更新CSS变量以响应布局变化
      document.documentElement.style.setProperty('--sidebar-width', `${newWidth}px`)

      // 立即触发强制重排以实现实时响应
      void sidebar.offsetHeight // 强制重排

      // 触发窗口调整大小事件以更新其他组件
      window.dispatchEvent(new Event('resize'))
    }
  }

  const handleMouseUp = async () => {
    if (isResizing.value && sidebar) {
      // 保存宽度到数据库
      const finalWidth = sidebar.offsetWidth

      try {
        // 使用useMenuWidth的setMenuWidth方法，这会同时更新本地状态和数据库
        setMenuWidth(finalWidth)

        // 更新CSS变量以确保立即生效
        document.documentElement.style.setProperty('--sidebar-width', `${finalWidth}px`)
      } catch (error) {
        logger.error('保存侧边栏宽度失败:', error)
      }
    }

    isResizing.value = false
    document.body.style.cursor = ''
    document.body.style.userSelect = ''

    // 移除事件监听器
    document.removeEventListener('mousemove', handleMouseMove)
    document.removeEventListener('mouseup', handleMouseUp)
  }

  // 添加事件监听器
  document.addEventListener('mousemove', handleMouseMove)
  document.addEventListener('mouseup', handleMouseUp)
}

// 移动端相关方法
const handleOverlayClick = () => {
  emit('mobile-close')
}

// 使用事件总线
const { on } = useEventBus()

// 监听 props.menuItems 变化
watch(() => props.menuItems, async (newItems, oldItems) => {
  // 只有当有数据时才更新，避免空数组覆盖
  if (newItems && newItems.length > 0) {
    menuList.value = newItems

    // 菜单列表更新后刷新 Iconify 图标
    await nextTick()
    await waitForIconify(3000)
    refreshIconifyIcons()
  }
}, { immediate: false, deep: true })  // 改为 immediate: false，避免在 mount 时触发

// Lifecycle
onMounted(async () => {
  // 先加载菜单宽度配置
  await loadAllMenuWidths()

  // 使用组合式函数更新菜单宽度
  updateWidth()

  // 监听菜单宽度变化，实时更新CSS变量
  watch(menuWidth, (newWidth) => {
    document.documentElement.style.setProperty('--sidebar-width', `${newWidth}px`)
  }, { immediate: true })

  // 加载菜单数据
  await loadUserMenus()

  // 组件挂载后刷新 Iconify 图标
  await nextTick()
  await waitForIconify(3000)
  refreshIconifyIcons()

  // 监听菜单更新事件 - 也不重新加载，由父组件更新 props
  on('menu:updated', async (data) => {
  })

  permissionsUpdateHandler = async () => {
    await loadUserMenus()
  }

  window.addEventListener('tf2025:permissions:updated', permissionsUpdateHandler)
})

onUnmounted(() => {
  if (permissionsUpdateHandler) {
    window.removeEventListener('tf2025:permissions:updated', permissionsUpdateHandler)
  }
})
</script>

<style scoped>
/* 现代侧边栏容器 */
.modern-sidebar {
  width: var(--sidebar-width, 150px);
  height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-right: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  flex-direction: column;
  transition: width 0.3s ease;
  position: relative;
  overflow: hidden;
  box-shadow: 4px 0 20px rgba(0, 0, 0, 0.1);
}

.modern-sidebar.collapsed {
  width: 80px;
}

.modern-sidebar.mobile {
  position: fixed;
  left: calc(-1 * var(--sidebar-width, 150px)); /* 使用CSS变量 */
  top: 0;
  z-index: 1000;
  height: 100vh;
  border-right: none;
}

.modern-sidebar.mobile.mobile-open {
  left: 0;
}


/* 菜单区域 */
.menu-section {
  flex: 1;
  overflow-y: auto;
  padding: 10px 0;
  overscroll-behavior-y: contain;
  -webkit-overflow-scrolling: auto;
  scrollbar-width: thin;
  scrollbar-color: rgba(255, 255, 255, 0.2) transparent;
}

.menu-section::-webkit-scrollbar {
  width: 4px;
}

.menu-section::-webkit-scrollbar-track {
  background: transparent;
}

.menu-section::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 2px;
}

/* 菜单项 */
.menu-item {
  margin: 2px 16px 2px 8px;
  border-radius: 12px;
  cursor: pointer;
  transition: background-color 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
  position: relative;
  background: rgba(255, 255, 255, 0);
  border: 1px solid transparent;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.menu-item:hover {
  background: rgba(255, 255, 255, 0.1);
}

.menu-item.active {
  background: transparent;
  border-color: transparent;
  box-shadow: none;
}

.menu-item.active::before {
  content: '';
  position: absolute;
  inset: 6px 8px;
  border-radius: 9px;
  background: rgba(255, 255, 255, 0.16);
  border: 1px solid rgba(255, 255, 255, 0.22);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  pointer-events: none;
  z-index: 0;
}

.menu-content {
  display: flex;
  align-items: center;
  padding: 14px 16px;
  position: relative;
  flex: 1;
  z-index: 1;
}

.menu-icon {
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #ffffff;
  font-size: 18px;
  margin-right: 12px;
  flex-shrink: 0;
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.1));
}

/* Iconify 图标样式 */
.menu-icon .iconify {
  font-size: 18px;
  width: 18px;
  height: 18px;
  display: inline-block;
  vertical-align: middle;
  color: #ffffff;
}

.menu-text {
  flex: 1;
  color: #ffffff;
  font-size: 14px;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 徽章 */
.menu-badge {
  margin-left: auto;
  flex-shrink: 0;
}

.badge-count {
  background: #ff4757;
  color: #ffffff;
  font-size: 11px;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 10px;
  min-width: 18px;
  text-align: center;
  display: inline-block;
}

/* 箭头图标 */
.menu-arrow {
  color: rgba(255, 255, 255, 0.6);
  font-size: 12px;
  margin-right: 8px;
  flex-shrink: 0;
  position: relative;
  z-index: 1;
}

.menu-arrow.expanded {
  transform: none;
}

/* 子菜单 */
.sub-menu {
  margin-left: 0;
  padding: 8px 0;
  overflow: hidden;
}

.sub-item .menu-content {
  padding: 10px 16px;
}

.sub-item .menu-text {
  font-size: 13px;
  font-weight: 400;
}


/* 折叠状态适配 */
.modern-sidebar.collapsed .menu-text,
.modern-sidebar.collapsed .menu-badge,
.modern-sidebar.collapsed .menu-arrow {
  display: none;
}

.modern-sidebar.collapsed .menu-item {
  margin: 8px 8px 8px 4px;
}

.modern-sidebar.collapsed .menu-content {
  justify-content: center;
  padding: 16px;
}


/* 主题切换 */
.modern-sidebar.theme-dark {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}


.modern-sidebar.theme-dark .action-btn {
  background: rgba(0, 0, 0, 0.2);
  border-color: rgba(255, 255, 255, 0.1);
}



.sub-item {
  padding: 0;
  margin: 2px 16px 2px 8px;
}


/* 子菜单展开动画 */
.sub-menu-enter-active,
.sub-menu-leave-active {
  transition: none;
}

.sub-menu-enter-from {
  max-height: none;
  opacity: 1;
}

.sub-menu-leave-to {
  max-height: none;
  opacity: 1;
}

.sub-menu-enter-to,
.sub-menu-leave-from {
  max-height: none;
  opacity: 1;
}

/* 底部样式 */
.sidebar-footer {
  padding: 16px;
  border-top: 1px solid #f0f0f0;
}

.logout-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 14px;
  color: #666666;
}

.logout-btn:hover {
  background: #f5f5f5;
  color: #ff4d4f;
}

.logout-btn i {
  font-size: 14px;
}


.simple-sidebar.collapsed .menu-text {
  display: none;
}

.simple-sidebar.collapsed .sub-menu {
  display: none;
}

.simple-sidebar.collapsed .sidebar-footer {
  padding: 16px 8px;
}

.simple-sidebar.collapsed .logout-btn span {
  display: none;
}

.simple-sidebar.collapsed .logout-btn {
  justify-content: center;
}


/* ===== 移动端适配样式 ===== */
.sidebar-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 999;
  opacity: 0;
  animation: fadeIn 0.3s ease forwards;
}

@keyframes fadeIn {
  to {
    opacity: 1;
  }
}


/* 移动端顶部操作栏 */
.mobile-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px; /* 更紧凑的padding */
  border-bottom: 1px solid var(--theme-border-color, #e8e8e8);
  background: var(--theme-header-bg, #ffffff);
  min-height: 52px; /* 稍小的高度 */
}

.mobile-close-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  border-radius: 50%;
  cursor: pointer;
  transition: background-color 0.2s ease;
  color: var(--theme-text-color, #333333);
}

.mobile-close-btn:hover {
  background: var(--theme-hover-bg, #f5f5f5);
}

.mobile-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--theme-text-color, #333333);
}

.mobile-actions {
  display: flex;
  gap: 8px;
}

.theme-toggle-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  border-radius: 50%;
  cursor: pointer;
  transition: background-color 0.2s ease;
  color: var(--theme-text-color, #333333);
}

.theme-toggle-btn:hover {
  background: var(--theme-hover-bg, #f5f5f5);
}

/* 移动端菜单列表 */
.mobile-menu {
  flex: 1;
  overflow-y: auto;
  padding: 0;
  overscroll-behavior-y: contain;
  -webkit-overflow-scrolling: auto;
}

/* 手机端网格布局 */
.mobile-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr); /* 4列网格 */
  gap: 1px;
  background: var(--theme-border-color, #f0f0f0);
  padding: 1px;
}

.mobile-grid .mobile-item {
  border-bottom: none;
  border-right: 1px solid var(--theme-border-color, #f0f0f0);
  background: var(--theme-bg, #ffffff);
  padding: 20px 8px; /* 网格项padding */
  min-height: 80px; /* 网格项高度 */
  min-width: 0; /* 允许网格项收缩 */
}

.mobile-grid .mobile-item:nth-child(4n) {
  border-right: none; /* 每4个项目的右边框移除 */
}

.mobile-grid .mobile-item .menu-icon {
  font-size: 20px; /* 网格中图标稍小 */
  margin-bottom: 4px; /* 图标与tooltip间距 */
}

/* 手机端横屏优化 */
@media (max-width: 768px) and (orientation: landscape) {
  .mobile-grid {
    grid-template-columns: repeat(6, 1fr); /* 横屏6列 */
  }
}

/* 小屏幕手机优化 */
@media (max-width: 360px) {
  .mobile-grid {
    grid-template-columns: repeat(3, 1fr); /* 小屏3列 */
  }
}

/* 手机端菜单项通用样式（非网格模式） */
.mobile-item:not(.mobile-grid .mobile-item) {
  padding: 16px; /* 手机端纯图标模式：更大的padding保持触摸区域 */
  margin: 0;
  border-bottom: 1px solid var(--theme-border-color, #f0f0f0);
  touch-action: manipulation;
  min-height: 64px; /* 手机端纯图标模式：更大的触摸区域 */
  display: flex;
  align-items: center;
  justify-content: center; /* 居中显示图标 */
  position: relative;
}

.mobile-item:active {
  background: var(--theme-hover-bg, #f5f5f5);
  transform: scale(0.98);
  transition: all 0.1s ease;
}

.mobile-item:hover {
  background: var(--theme-hover-bg, #fafafa);
}

/* 移动端菜单项间的分隔线优化 */
.mobile-item:not(:last-child) {
  border-bottom-color: var(--theme-border-color, #f0f0f0);
}

/* 优化移动端菜单图标和文字的对齐 */
.mobile-item .menu-content {
  display: flex;
  align-items: center;
  flex: 1;
  min-width: 0; /* 防止内容溢出 */
}

.mobile-item .menu-text {
  font-size: 15px;
  line-height: 1.3;
  flex: 1;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mobile-item .menu-icon {
  font-size: 24px; /* 手机端图标更大 */
  margin: 0; /* 移除边距，居中显示 */
  width: 24px;
  height: 24px;
  text-align: center;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--theme-text-color, #333);
}

/* 移动端子菜单 */
.mobile-sub-menu {
  background: var(--theme-hover-bg, #f8f8f8);
  padding-left: 16px; /* 减少缩进 */
}

.mobile-sub-menu .sub-item {
  padding: 10px 16px 10px 20px; /* 更紧凑的padding */
  min-height: 44px; /* 稍小的高度 */
  border-bottom: 1px solid var(--theme-border-color, #e8e8e8);
  display: flex;
  align-items: center;
  justify-content: flex-start;
}

.mobile-sub-menu .sub-item .menu-text {
  font-size: 14px;
  line-height: 1.3;
  flex: 1;
}

.mobile-sub-menu .sub-item .menu-icon {
  font-size: 14px; /* 子菜单图标更小 */
  margin-right: 10px;
  width: 14px;
  text-align: center;
  flex-shrink: 0;
}

/* 优化移动端箭头图标 */
.mobile-item .menu-arrow {
  margin-left: auto;
  font-size: 12px;
  color: var(--theme-text-color-light, #999);
  transition: transform 0.2s ease;
  flex-shrink: 0;
  width: 20px;
  text-align: center;
}

.mobile-item .menu-arrow.expanded {
  transform: rotate(180deg);
}

/* 移动端菜单项激活状态 */
.mobile-item.active {
  background: var(--theme-primary-bg, #e6f7ff);
  color: var(--theme-primary-color, #1890ff);
}

.mobile-item.active .menu-icon {
  color: var(--theme-primary-color, #1890ff);
  font-size: 26px; /* 激活状态图标稍大 */
}

/* 手机端Tooltip样式 */
.mobile-item[title]:hover::after {
  content: attr(title);
  position: absolute;
  bottom: -32px;
  left: 50%;
  transform: translateX(-50%);
  background: var(--theme-tooltip-bg, #333);
  color: white;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  white-space: nowrap;
  z-index: 1000;
  pointer-events: none;
  opacity: 0;
  animation: fadeInOut 2s ease-in-out;
}

@keyframes fadeInOut {
  0%, 100% { opacity: 0; }
  20%, 80% { opacity: 1; }
}


/* 移动端动画 */
.slide-down-enter-active,
.slide-down-leave-active {
  transition: all 0.3s ease;
  overflow: hidden;
}

.slide-down-enter-from {
  max-height: 0;
  opacity: 0;
  transform: translateY(-20px);
}

.slide-down-leave-to {
  max-height: 0;
  opacity: 0;
  transform: translateY(-20px);
}

.slide-down-enter-to,
.slide-down-leave-from {
  max-height: 1000px;
  opacity: 1;
  transform: translateY(0);
}

/* 暗夜模式适配 */
.simple-sidebar.theme-dark {
  background: var(--theme-sidebar-bg, #1f1f1f);
  border-right-color: var(--theme-border-color, #434343);
}

.simple-sidebar.theme-dark .sidebar-header {
  border-bottom-color: var(--theme-border-color, #434343);
}

.simple-sidebar.theme-dark .menu-item:hover {
  background: var(--theme-hover-bg, #262626);
}

.simple-sidebar.theme-dark .menu-item.active {
  background: rgba(23, 121, 220, 0.15);
  color: var(--theme-primary-color, #177ddc);
}

.simple-sidebar.theme-dark .menu-item.active::before {
  background: var(--theme-primary-color, #177ddc);
}

.simple-sidebar.theme-dark .menu-icon {
  color: var(--theme-sidebar-text, #ffffff);
}

.simple-sidebar.theme-dark .menu-text {
  color: var(--theme-sidebar-text, #ffffff);
}

.simple-sidebar.theme-dark .logout-btn:hover {
  background: var(--theme-hover-bg, #262626);
  color: #ff4d4f;
}

.simple-sidebar.theme-dark .sidebar-footer {
  border-top-color: var(--theme-border-color, #434343);
}

/* 桌面端响应式优化 */
@media (max-width: 1024px) {
  .simple-sidebar {
    width: 240px;
  }

  .simple-sidebar.collapsed {
    width: 60px;
  }

  .menu-item {
    padding: 14px 8px;
  }

  .menu-text {
    font-size: 13px;
  }
}

/* 小屏幕设备优化 */
@media (max-width: 768px) {
  .simple-sidebar:not(.mobile) {
    width: 100%;
    max-width: 280px;
  }

  .mobile-menu .menu-item {
    padding: 18px 16px;
    min-height: 60px;
  }

  .mobile-header {
    padding: 20px 16px;
  }
}

/* 超小屏幕设备优化 */
@media (max-width: 480px) {
  .simple-sidebar.mobile {
    width: 100%;
    max-width: 320px;
  }

  .mobile-item {
    padding: 20px 16px;
    min-height: 64px;
  }

  .mobile-item .menu-text {
    font-size: 18px;
  }

  .mobile-item .menu-icon {
    font-size: 20px;
  }
}

/* 横屏模式优化 */
@media (max-height: 600px) and (orientation: landscape) {
  .mobile-header {
    padding: 12px 16px;
  }

  .mobile-item {
    padding: 12px 16px;
    min-height: 48px;
  }

  .mobile-sub-menu .sub-item {
    padding: 10px 16px 10px 24px;
    min-height: 44px;
  }
}

/* 无障碍访问优化 */
@media (prefers-reduced-motion: reduce) {
  .simple-sidebar.mobile {
    transition: none;
  }

  .sidebar-overlay {
    animation: none;
    opacity: 1;
  }

  .slide-down-enter-active,
  .slide-down-leave-active {
    transition: none;
  }

  .sub-menu-enter-active,
  .sub-menu-leave-active {
    transition: none;
  }
}

/* 拖动调整宽度手柄 */
.resize-handle {
  position: absolute;
  top: 0;
  right: 0;
  width: 6px;
  height: 100%;
  background: transparent;
  cursor: col-resize;
  z-index: 1000;
  transition: background-color 0.2s ease;
}

.resize-handle:hover {
  background: var(--theme-primary-color, #1890ff);
}

.resize-handle:active {
  background: var(--theme-primary-color-dark, #1366c4);
}

.theme-dark .resize-handle:hover {
  background: var(--theme-primary-color, #177ddc);
}

.theme-dark .resize-handle:active {
  background: var(--theme-primary-color-dark, #1355a0);
}

/* 高对比度模式支持 */
@media (prefers-contrast: high) {
  .simple-sidebar {
    border-right: 2px solid currentColor;
  }

  .menu-item {
    border: 1px solid transparent;
  }

  .menu-item:hover,
  .menu-item:focus {
    border-color: var(--theme-primary-color, #1890ff);
    outline: 2px solid var(--theme-primary-color, #1890ff);
    outline-offset: -2px;
  }

  .resize-handle {
    background: rgba(255, 255, 255, 0.1);
  }

  .resize-handle:hover {
    background: rgba(255, 255, 255, 0.3);
  }
}
</style>
