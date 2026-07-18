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
      @touchstart.passive="handleMenuTouchStart"
      @touchmove.passive="handleMenuTouchMove"
      @touchend.passive="handleMenuTouchEnd"
      @touchcancel.passive="handleMenuTouchEnd"
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
      <div class="menu-content">
        <div v-if="props.isMenuLoading" class="menu-loading-state">
          <InlineLoading text="菜单加载中..." />
        </div>

        <!-- 全部菜单 -->
        <div v-else class="all-menus">
          <div class="section-title">全部功能</div>
          <div class="menu-list">
            <template v-for="(menu, index) in filteredMenuList" :key="menu.id || index">
              <!-- 一级菜单 -->
              <div
                class="menu-item"
                :class="{
                  'active': isActiveMenu(menu),
                  'has-children': menu.children && menu.children.length > 0,
                  'expanded': menu.id && expandedMenus.has(getMenuKey(menu))
                }"
                @click="handleMenuItemClick(menu)"
              >
                <div
                  class="menu-item-content"
                  @click.stop="handleMenuPrimaryAction(menu)"
                >
                  <div class="menu-icon">
                    <IconRenderer :icon="menu.icon" :svg="menu.icon_svg" />
                  </div>
                  <span class="menu-name">{{ menu.name || menu.title || '未命名菜单' }}</span>
                  <button
                    v-if="menu.children && menu.children.length > 0"
                    type="button"
                    class="menu-actions"
                    @click.stop="toggleMenuExpansion(menu)"
                    :aria-label="expandedMenus.has(String(menu.id)) ? '收起子菜单' : '展开子菜单'"
                  >
                    <i class="expand-icon fas fa-chevron-down"></i>
                  </button>
                </div>
              </div>

              <!-- 子菜单 -->
              <transition name="sub-menu">
                <div
                  v-if="menu.children && menu.children.length > 0 && menu.id && expandedMenus.has(getMenuKey(menu))"
                  class="sub-menu-list"
                >
                  <div
                    v-for="(child, childIndex) in (menu.children || [])"
                    :key="child.id || childIndex"
                    class="sub-menu-item"
                    :class="{ 'active': isActiveMenu(child) }"
                    @click.stop="navigateToMenu(child)"
                  >
                    <div class="menu-icon">
                      <IconRenderer :icon="child.icon" :svg="child.icon_svg" />
                    </div>
                    <span class="menu-name">{{ child.name || child.title || '未命名菜单' }}</span>
                  </div>
                </div>
              </transition>
            </template>
          </div>
        </div>

        <!-- 空状态 -->
        <div v-if="!props.isMenuLoading && filteredMenuList.length === 0" class="empty-state">
          <i class="fas fa-search empty-icon"></i>
          <p class="empty-text">没有找到相关菜单</p>
        </div>
      </div>

      </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import { useMenuWidth } from '@/composables/useMenuWidth'
import { storage } from '@/composables/core/useLocalStorage'
import IconRenderer from '@/components/IconRenderer.vue'
import InlineLoading from '@/components/InlineLoading.vue'
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
  isMenuLoading?: boolean
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
  isMenuLoading: false,
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

// 菜单宽度管理
const { menuWidth, loadAllMenuWidths } = useMenuWidth()

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
const dragStartY = ref(0)
const dragCurrentX = ref(0)
const isVerticalScrolling = ref(false)
const bodyScrollTop = ref(0)

const SWIPE_CLOSE_THRESHOLD = 56
const SWIPE_ACTIVATION_THRESHOLD = 12

const filteredMenuList = computed(() => {
  // 如果菜单列表不存在或为null，返回空数组
  if (!props.menuList || !Array.isArray(props.menuList)) {
    logger.warn('MobileSlideMenu: menuList is null or not an array', props.menuList)
    return []
  }

  // 直接返回菜单列表，不需要过滤
  return props.menuList
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

const getMenuKey = (menu: MenuItem) => String(menu.id)

const hasNavigablePath = (menu: MenuItem) => {
  const targetPath = menu.url || menu.path
  return Boolean(targetPath && targetPath !== '#')
}

const toggleMenuExpansion = (menu: MenuItem) => {
  if (!menu.id) return

  const menuKey = getMenuKey(menu)
  if (expandedMenus.value.has(menuKey)) {
    expandedMenus.value.delete(menuKey)
    return
  }

  expandedMenus.value.add(menuKey)
}

const handleMenuPrimaryAction = (menu: MenuItem) => {
  if (hasNavigablePath(menu)) {
    navigateToMenu(menu)
    return
  }

  if (menu.children && menu.children.length > 0) {
    toggleMenuExpansion(menu)
  }
}

const handleMenuItemClick = (menu: MenuItem) => {
  if (!hasNavigablePath(menu) && menu.children && menu.children.length > 0) {
    toggleMenuExpansion(menu)
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


const lockBodyScroll = () => {
  bodyScrollTop.value = window.scrollY || window.pageYOffset || 0
  document.documentElement.style.overflow = 'hidden'
  document.body.style.position = 'fixed'
  document.body.style.top = `-${bodyScrollTop.value}px`
  document.body.style.left = '0'
  document.body.style.right = '0'
  document.body.style.width = '100%'
  document.body.style.overflow = 'hidden'
}

const unlockBodyScroll = () => {
  const scrollTop = bodyScrollTop.value
  document.documentElement.style.overflow = ''
  document.body.style.position = ''
  document.body.style.top = ''
  document.body.style.left = ''
  document.body.style.right = ''
  document.body.style.width = ''
  document.body.style.overflow = ''
  window.scrollTo(0, scrollTop)
}

const resetDragState = () => {
  isDragging.value = false
  isVerticalScrolling.value = false
  dragCurrentX.value = 0
}

const handleMenuTouchStart = (event: TouchEvent) => {
  if (!props.isOpen || !event.touches.length) return

  const touch = event.touches[0]
  dragStartX.value = touch.clientX
  dragStartY.value = touch.clientY
  dragCurrentX.value = 0
  isDragging.value = false
  isVerticalScrolling.value = false
}

const handleMenuTouchMove = (event: TouchEvent) => {
  if (!props.isOpen) return
  if (!event.touches.length) return

  const touch = event.touches[0]
  const deltaX = touch.clientX - dragStartX.value
  const deltaY = touch.clientY - dragStartY.value
  const absX = Math.abs(deltaX)
  const absY = Math.abs(deltaY)

  if (isVerticalScrolling.value) {
    return
  }

  if (!isDragging.value) {
    if (absY > absX && absY > SWIPE_ACTIVATION_THRESHOLD) {
      isVerticalScrolling.value = true
      return
    }

    if (deltaX < -SWIPE_ACTIVATION_THRESHOLD && absX > absY) {
      isDragging.value = true
    } else {
      return
    }
  }

  // 只允许向左滑动关闭
  if (deltaX < 0) {
    dragCurrentX.value = deltaX
  }
}

const handleMenuTouchEnd = () => {
  if (!props.isOpen) {
    resetDragState()
    return
  }

  if (isDragging.value && Math.abs(dragCurrentX.value) >= SWIPE_CLOSE_THRESHOLD) {
    closeMenu()
    return
  }

  resetDragState()
}

const handleTransitionEnd = () => {
  if (!props.isOpen) {
    resetDragState()
    return
  }

  if (!isDragging.value) {
    dragCurrentX.value = 0
  }
}

// Watch menu open state
watch(() => props.isOpen, async (isOpen) => {
  if (isOpen) {
    lockBodyScroll()
    // 确保菜单宽度已加载
    await nextTick()
    loadAllMenuWidths()
  } else {
    unlockBodyScroll()
    // 清除展开的菜单
    expandedMenus.value.clear()
    resetDragState()
  }
})

// 组件挂载时加载菜单宽度
onMounted(async () => {
  loadAllMenuWidths()
})

// Cleanup
onUnmounted(() => {
  unlockBodyScroll()
})
</script>

<style lang="scss" scoped>
.mobile-slide-menu {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 3100;
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
  overscroll-behavior: contain;
  touch-action: pan-y;
  padding: 0 0 20px 0;
  scrollbar-width: none;
}

.menu-content::-webkit-scrollbar {
  display: none;
}

.menu-loading-state {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  min-height: 180px;
  padding: 24px 20px;
  color: rgba(255, 255, 255, 0.92);
  font-size: 14px;
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
  border: 0;
  background: transparent;
  padding: 0;
  margin: 0;
  cursor: pointer;
  appearance: none;
  -webkit-tap-highlight-color: transparent;
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
