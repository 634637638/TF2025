<template>
  <!-- 移动端侧滑菜单 -->
  <div class="mobile-slide-menu" :class="{ 'is-open': isOpen }">

    <!-- 遮罩层 - 点击可关闭菜单 -->
    <div
      class="menu-overlay"
      v-if="isOpen"
      @click="closeMenu"
    ></div>

    <!-- 菜单容器 -->
    <div
      class="menu-container"
      :class="{ 'is-open': isOpen }"
      :style="menuStyles"
      @touchstart="handleTouchStart"
      @touchmove="handleTouchMove"
      @touchend="handleTouchEnd"
      @transitionend="handleTransitionEnd"
    >
      <!-- 菜单头部 -->
      <div class="menu-header">
        <div class="header-content">
          <!-- 用户信息 -->
          <div class="user-info">
            <div class="user-avatar">
              <i class="fas fa-user-circle"></i>
            </div>
            <div class="user-details">
              <div class="user-name">{{ userName }}</div>
              <div class="user-role">{{ userRole }}</div>
            </div>
          </div>

          </div>
      </div>


      <!-- 菜单内容区域 -->
      <div class="menu-content" ref="menuContent">

        <!-- 全部菜单 -->
        <div class="all-menus">
          <div class="section-title">全部功能</div>
          <div class="menu-list">
            <template v-for="(menu, index) in filteredMenuList" :key="menu.id || index">
              <!-- 一级菜单 -->
              <div
                class="menu-item"
                :class="{
                  'active': isActiveMenu(menu),
                  'has-children': menu.children && menu.children.length > 0,
                  'expanded': menu.id && expandedMenus.has(menu.id)
                }"
                @click="handleMenuClick(menu)"
              >
                <div class="menu-item-content">
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
                  <span class="menu-name">{{ menu.name || menu.title || '未命名菜单' }}</span>
                  <div class="menu-actions">
                    <i
                      v-if="menu.children && menu.children.length > 0"
                      class="expand-icon fas fa-chevron-down"
                    ></i>
                  </div>
                </div>
              </div>

              <!-- 子菜单 -->
              <transition name="sub-menu">
                <div
                  v-if="menu.children && menu.children.length > 0 && menu.id && expandedMenus.has(menu.id)"
                  class="sub-menu-list"
                >
                  <div
                    v-for="(child, childIndex) in (menu.children || [])"
                    :key="child.id || childIndex"
                    class="sub-menu-item"
                    :class="{ 'active': isActiveMenu(child) }"
                    @click="navigateToMenu(child)"
                  >
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
                    <span class="menu-name">{{ child.name || child.title || '未命名菜单' }}</span>
                  </div>
                </div>
              </transition>
            </template>
          </div>
        </div>

        <!-- 空状态 -->
        <div v-if="filteredMenuList.length === 0" class="empty-state">
          <i class="fas fa-search empty-icon"></i>
          <p class="empty-text">没有找到相关菜单</p>
        </div>
      </div>

      </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useSiteSettingsStore } from '@/stores/siteSettings'
import { useMobileGestures } from '@/composables/mobile'
import { useMenuWidth } from '@/composables/useMenuWidth'
import { buildLogoUrl } from '@/utils/logoUtils'
import { refreshIconifyIcons, waitForIconify } from '@/utils/iconify'
import { storage } from '@/composables/core/useLocalStorage'
import type { CloseEmits } from '@/types/component'
import { logger } from '@/utils/logger'

// MenuItem 接口定义
interface MenuItem {
  id: string | number
  name: string
  url?: string
  path?: string
  icon?: string
  children?: MenuItem[]
  [key: string]: any
}

// Props
interface Props {
  isOpen: boolean
  menuList?: MenuItem[] | null
  userName?: string
  userRole?: string
  quickActions?: Array<{
    id: string
    name: string
    icon: string
    badge?: string
    handler: () => void
  }>
}

const props = withDefaults(defineProps<Props>(), {
  menuList: () => [],
  userName: '',
  userRole: '',
  quickActions: () => []
})

// Emits
interface Emits extends CloseEmits {
  'menu-click': [menu: MenuItem]
  'quick-action': [action: any]
}

const emit = defineEmits<Emits>()

// Route
const route = useRoute()

// Stores
const authStore = useAuthStore()
const siteSettingsStore = useSiteSettingsStore()
const { handleTouchStart, handleTouchEnd } = useMobileGestures()

// 菜单宽度管理
const { menuWidth, loadAllMenuWidths, isMobile } = useMenuWidth()

// Local Storage - 使用统一存储服务
const getLocalStorageItem = (key: string, defaultValue: any[] = []) => {
  return storage.get<any[]>(key, 'local', defaultValue)
}

const setLocalStorageItem = (key: string, value: any[]) => {
  storage.set(key, value, 'local')
}

const recentlyUsedMenus = ref(getLocalStorageItem('recently-used-menus', []))

const setRecentlyUsedMenus = (value: any[]) => {
  recentlyUsedMenus.value = value
  setLocalStorageItem('recently-used-menus', value)
}

// Refs
const expandedMenus = ref(new Set<string>())
const isDragging = ref(false)
const dragStartX = ref(0)
const dragCurrentX = ref(0)
const menuContent = ref<HTMLElement>()

const filteredMenuList = computed(() => {
  // 如果菜单列表不存在或为null，返回空数组
  if (!props.menuList || !Array.isArray(props.menuList)) {
    logger.warn('MobileSlideMenu: menuList is null or not an array', props.menuList)
    return []
  }

  // 直接返回菜单列表，不需要过滤
  return props.menuList
})

// Logo URL
const logoUrl = computed(() => {
  const rawUrl = siteSettingsStore.settings.logoUrl
  return buildLogoUrl(rawUrl)
})

// Styles
const menuStyles = computed(() => {
  const baseTransform = isDragging.value
    ? `translateX(${Math.min(Math.max(dragCurrentX.value, -window.innerWidth), 0)}px)`
    : (props.isOpen ? 'translateX(0)' : 'translateX(-100%)')

  const transition = isDragging.value ? 'none' : 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)'

  return {
    transform: baseTransform,
    transition,
    width: `${menuWidth.value}px`,
    maxWidth: 'none'
  }
})

// Methods
const closeMenu = () => {
  emit('close')
}

const handleMenuClick = (menu: MenuItem) => {
  if (menu.children && menu.children.length > 0) {
    // 切换子菜单展开状态
    if (menu.id) {
      if (expandedMenus.value.has(menu.id)) {
        expandedMenus.value.delete(menu.id)
      } else {
        expandedMenus.value.add(menu.id)
      }
    }
  } else {
    navigateToMenu(menu)
  }
}

const navigateToMenu = (menu: MenuItem) => {
  // 记录最近使用的菜单
  addToRecentlyUsed(menu)

  // 导航到菜单
  emit('menu-click', menu)

  // 关闭菜单
  closeMenu()
}

const handleQuickAction = (action: any) => {
  emit('quick-action', action)
  closeMenu()
}


const isActiveMenu = (menu: MenuItem): boolean => {
  return route.path === menu.url || route.path === menu.path
}


const addToRecentlyUsed = (menu: MenuItem) => {
  if (!menu.id) return
  if (!recentlyUsedMenus.value || !Array.isArray(recentlyUsedMenus.value)) return
  const recently = [...recentlyUsedMenus.value]
  const index = recently.findIndex((item: MenuItem) => item.id === menu.id)

  if (index > -1) {
    recently.splice(index, 1)
  }

  recently.unshift(menu)

  // 最多保留10个最近使用的菜单
  if (recently.length > 10) {
    recently.splice(10)
  }

  setRecentlyUsedMenus(recently)
}


// Logo加载错误处理
const handleLogoError = (event: Event) => {
  const img = event.target as HTMLImageElement
  logger.warn('Logo加载失败:', img.src)
  img.style.display = 'none'
}

// Touch handlers for swipe gestures
const handleTouchMove = (event: TouchEvent) => {
  if (!props.isOpen) return

  const touch = event.touches[0]
  const deltaX = touch.clientX - dragStartX.value

  // 只允许向左滑动关闭
  if (deltaX < 0) {
    isDragging.value = true
    dragCurrentX.value = deltaX
  }
}

const handleTransitionEnd = () => {
  isDragging.value = false
  dragCurrentX.value = 0
}

// Watch menu open state
watch(() => props.isOpen, async (isOpen) => {
  if (isOpen) {
    // 禁止背景滚动
    document.body.style.overflow = 'hidden'
    // 确保菜单宽度已加载
    loadAllMenuWidths()
    // 刷新 Iconify 图标
    await nextTick()
    await waitForIconify(3000)
    refreshIconifyIcons()
  } else {
    // 恢复背景滚动
    document.body.style.overflow = ''
    // 清除展开的菜单
    expandedMenus.value.clear()
  }
})

// 组件挂载时加载菜单宽度
onMounted(async () => {
  loadAllMenuWidths()
  // 刷新 Iconify 图标
  await nextTick()
  await waitForIconify(3000)
  refreshIconifyIcons()
})

// Cleanup
onUnmounted(() => {
  document.body.style.overflow = ''
})
</script>

<style lang="scss" scoped>
.mobile-slide-menu {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 1000;
  pointer-events: none;
}

.mobile-slide-menu.is-open {
  pointer-events: auto;
}

// 遮罩层样式
.menu-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: var(--bg-overlay, rgba(0, 0, 0, 0.5));
  z-index: 1;
  backdrop-filter: blur(2px);
  transition: opacity 0.3s ease;
  cursor: pointer;
  animation: fadeIn 0.3s ease;
}

// 遮罩层淡入动画
@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.menu-container {
  position: absolute;
  top: 0;
  left: 0;
  bottom: 0;
  /* 宽度现在由 JavaScript 中的 menuStyles 动态设置 */
  width: 280px; /* 默认宽度，会被 JavaScript 覆盖 */
  max-width: none; /* 移除最大宽度限制 */
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  box-shadow: 2px 0 12px rgba(102, 126, 234, 0.3);
  z-index: 2;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.menu-header {
  display: flex;
  align-items: center;
  padding: 16px 20px;
  background: rgba(255, 255, 255, 0.1);
  border-bottom: 1px solid rgba(255, 255, 255, 0.2);
  color: #ffffff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.header-content {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex: 1;
  width: 100%;
}

.menu-logo {
  flex-shrink: 0;
  margin-right: 12px;
}

.menu-logo img {
  height: 36px;
  max-width: 120px;
  object-fit: contain;
  border-radius: var(--radius-lg, 8px);
  background: rgba(255, 255, 255, 0.2);
  padding: 6px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.user-info {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  margin-left: auto;
  color: #ffffff;
  text-align: left;
}

.close-btn {
  width: 32px;
  height: 32px;
  border-radius: var(--radius-full, 50%);
  border: 1px solid var(--border-color, #dee2e6);
  background: var(--bg-secondary, #ffffff);
  color: var(--text-secondary, #666666);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 14px;
}

.close-btn:hover {
  background: var(--primary-color, #dc3545);
  color: white;
  border-color: var(--primary-color, #dc3545);
}

.user-avatar {
  width: 36px;
  height: 36px;
  border-radius: var(--radius-full, 50%);
  background: rgba(255, 255, 255, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  margin-right: 12px;
  margin-left: 0;
  color: #ffffff;
  border: 2px solid rgba(255, 255, 255, 0.3);
}

.user-details {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}

.user-name {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 2px;
  line-height: 1.2;
  color: #ffffff;
}

.user-role {
  font-size: 11px;
  line-height: 1.2;
  color: #1a1a1a;
  background: #69f0ae;
  padding: 2px 8px;
  border-radius: 10px;
  margin-top: 2px;
}


.menu-content {
  flex: 1;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  padding: 0 0 20px 0;
}

.section-title {
  padding: 20px 20px 12px;
  font-size: 13px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.8);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}


.all-menus .menu-list .menu-item {
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.all-menus .menu-list .menu-item.active {
  background: rgba(255, 255, 255, 0.15);
}

.all-menus .menu-list .menu-item.active .menu-item-content .menu-name {
  color: #ffffff;
  font-weight: 600;
}

.all-menus .menu-list .menu-item.active .menu-item-content i {
  color: #ffffff;
}

.all-menus .menu-list .menu-item.expanded .expand-icon {
  transform: rotate(180deg);
}

.all-menus .menu-list .menu-item .menu-item-content {
  display: flex;
  align-items: center;
  padding: 14px 20px;
  cursor: pointer;
  transition: background 0.2s;
}

.all-menus .menu-list .menu-item .menu-item-content:hover {
  background: rgba(255, 255, 255, 0.1);
}

.all-menus .menu-list .menu-item .menu-item-content .menu-icon {
  width: 20px;
  margin-right: 12px;
  color: rgba(255, 255, 255, 0.9);
}

.all-menus .menu-list .menu-item .menu-item-content .menu-name {
  flex: 1;
  text-align: left;
  color: rgba(255, 255, 255, 0.95);
  font-size: 15px;
}

.all-menus .menu-list .menu-item .menu-item-content .menu-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.all-menus .menu-list .menu-item .menu-item-content .menu-actions .expand-icon {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.7);
  transition: transform 0.3s;
}

.all-menus .menu-list .sub-menu-list {
  background: rgba(0, 0, 0, 0.1);
}

.all-menus .menu-list .sub-menu-list .sub-menu-item {
  display: flex;
  align-items: center;
  width: 100%;
  padding: 12px 20px 12px 52px;
  border: none;
  background: transparent;
  cursor: pointer;
  transition: background 0.2s;
}

.all-menus .menu-list .sub-menu-list .sub-menu-item:hover {
  background: rgba(255, 255, 255, 0.08);
}

.all-menus .menu-list .sub-menu-list .sub-menu-item.active {
  background: rgba(255, 255, 255, 0.15);
}

.all-menus .menu-list .sub-menu-list .sub-menu-item.active .menu-name {
  color: #ffffff;
  font-weight: 500;
}

.all-menus .menu-list .sub-menu-list .sub-menu-item .menu-icon {
  width: 18px;
  margin-right: 12px;
  color: rgba(255, 255, 255, 0.8);
}

.all-menus .menu-list .sub-menu-list .sub-menu-item .menu-name {
  flex: 1;
  text-align: left;
  color: rgba(255, 255, 255, 0.9);
  font-size: 14px;
}


.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;

  .empty-icon {
    font-size: 48px;
    color: rgba(255, 255, 255, 0.5);
    margin-bottom: 16px;
  }

  .empty-text {
    color: rgba(255, 255, 255, 0.7);
    font-size: 14px;
  }
}



.sub-menu-enter-active,
.sub-menu-leave-active {
  transition: all 0.3s ease;
  overflow: hidden;
}

.sub-menu-enter-from,
.sub-menu-leave-to {
  max-height: 0;
  opacity: 0;
}

.sub-menu-enter-to,
.sub-menu-leave-from {
  max-height: 500px;
  opacity: 1;
}

// 手机端二级菜单样式优化
@media (max-width: 768px) {
  .all-menus .menu-list .sub-menu-list .sub-menu-item {
    padding: 12px 16px;

    .menu-icon {
      margin-right: 10px;
      flex-shrink: 0;
    }

    .menu-name {
      flex: 1;
      text-align: left;
    }
  }
}

// Dark mode
:global(body.dark) {
  .menu-container {
    background: var(--bg-primary-dark, #1a1a1a);
  }

  .menu-header {
    background: linear-gradient(135deg, #4a5568 0%, #2d3748 100%);
  }

  .section-title {
    color: var(--text-secondary-dark, #a0aec0);
  }

  .menu-item {
    border-bottom-color: var(--border-color-dark, #4a5568);
  }
}

/* Iconify 图标样式 */
.iconify {
  display: inline-block;
  vertical-align: middle;
  font-size: 18px;
  width: 1em;
  height: 1em;
}

.menu-icon .iconify {
  font-size: 20px;
  width: 20px;
  height: 20px;
}
</style>
