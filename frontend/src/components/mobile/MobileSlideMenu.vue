<template>
  <!-- 移动端侧滑菜单 -->
  <div
    class="mobile-slide-menu"
    :class="{ 'is-open': isOpen }"
  >
    <!-- 遮罩层 - 点击可关闭菜单 -->
    <div
      v-if="isOpen"
      class="menu-overlay"
      @click="closeMenu"
    />

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
            <div class="user-details">
              <div class="user-name">
                {{ userName }}
              </div>
              <div class="user-role">
                {{ userRole }}
              </div>
            </div>
          </div>
        </div>
      </div>


      <!-- 菜单内容区域 -->
      <div class="menu-content">
        <div
          v-if="props.isMenuLoading"
          class="menu-loading-state"
        >
          <InlineLoading text="菜单加载中..." />
        </div>

        <!-- 全部菜单 -->
        <div
          v-else
          class="all-menus"
        >
          <div class="section-title">
            全部功能
          </div>
          <div class="menu-list">
            <template
              v-for="(menu, index) in filteredMenuList"
              :key="menu.id || index"
            >
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
                  :class="{
                    'has-actions': menu.children && menu.children.length > 0
                  }"
                  @click.stop="handleMenuPrimaryAction(menu)"
                >
                  <div class="menu-icon">
                    <IconRenderer
                      :icon="menu.icon"
                      :svg="menu.icon_svg"
                    />
                  </div>
                  <span class="menu-name">{{ menu.name || menu.title || '未命名菜单' }}</span>
                  <el-button
                    v-if="menu.children && menu.children.length > 0"
                    text
                    native-type="button"
                    class="menu-actions tf-button--menu-action"
                    :aria-label="expandedMenus.has(String(menu.id)) ? '收起子菜单' : '展开子菜单'"
                    @click.stop="toggleMenuExpansion(menu)"
                  >
                    <i class="expand-icon fas fa-chevron-down" />
                  </el-button>
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
                      <IconRenderer
                        :icon="child.icon"
                        :svg="child.icon_svg"
                      />
                    </div>
                    <span class="menu-name">{{ child.name || child.title || '未命名菜单' }}</span>
                  </div>
                </div>
              </transition>
            </template>
          </div>
        </div>

        <!-- 空状态 -->
        <DataEmptyState
          v-if="!props.isMenuLoading && filteredMenuList.length === 0"
          state="filtered"
          size="compact"
          description="没有找到相关菜单"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import { useMenuWidth } from '@/composables/useMenuWidth'
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
  // 手机端和 PC 端都严格使用后台菜单宽度配置，不在组件内增加固定宽度兜底。
  const viewportWidth = typeof window === 'undefined' ? 320 : window.innerWidth
  const configuredWidth = Number(menuWidth.value) || 160
  const baseTransform = isDragging.value
    ? `translateX(${Math.min(Math.max(dragCurrentX.value, -viewportWidth), 0)}px)`
    : (props.isOpen ? 'translateX(0)' : 'translateX(-100%)')

  const transition = isDragging.value ? 'none' : 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)'

  return {
    transform: baseTransform,
    transition,
    width: `${configuredWidth}px`,
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
  // 导航到菜单
  emit('menu-click', menu)

  // 关闭菜单
  closeMenu()
}

const _handleQuickAction = (action: any) => {
  emit('quick-action', action)
  closeMenu()
}


const isActiveMenu = (menu: MenuItem): boolean => {
  return route.path === menu.url || route.path === menu.path
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
  z-index: var(--tf-z-drawer-overlay);
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
  width: 100%; /* 实际宽度由 useMenuWidth 的后台配置通过内联样式覆盖 */
  max-width: none; /* 移除最大宽度限制 */
  background: var(--tf-nav-header-bg);
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
  background: var(--tf-nav-item-hover-bg);
  border-bottom: 1px solid var(--tf-nav-border);
  color: var(--tf-nav-header-text);
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
  justify-content: flex-start;
  width: 100%;
  margin: 0;
  color: var(--color-bg-white);
  text-align: left;
}

.user-details {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: var(--tf-space-2);
  width: 100%;
  min-width: 0;
}

.user-name {
  flex: 1 1 auto;
  min-width: 0;
  max-width: none;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: var(--tf-type-scale-14);
  font-weight: 600;
  margin: 0;
  line-height: 1.2;
  color: var(--color-bg-white);
}

.user-role {
  flex: 0 0 auto;
  font-size: var(--tf-type-scale-11);
  line-height: 1.2;
  color: var(--tf-color-neutral-950);
  background: var(--tf-color-emerald-300);
  padding: 2px 8px;
  border-radius: 10px;
  margin: 0;
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
  font-size: var(--tf-type-scale-14);
}

.section-title {
  padding: 20px 20px 12px;
  font-size: var(--tf-type-scale-13);
  font-weight: 600;
  color: rgba(255, 255, 255, 0.8);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}


.all-menus .menu-list .menu-item {
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.all-menus .menu-list .menu-item.active {
  background: var(--tf-nav-item-active-bg);
}

.all-menus .menu-list .menu-item.active .menu-item-content .menu-name {
  color: var(--color-bg-white);
  font-weight: 600;
}

.all-menus .menu-list .menu-item.active .menu-item-content i {
  color: var(--color-bg-white);
}

.all-menus .menu-list .menu-item.expanded .expand-icon {
  transform: rotate(180deg);
}

.all-menus .menu-list .menu-item .menu-item-content {
  display: grid;
  grid-template-columns: 20px minmax(0, 1fr);
  column-gap: 8px;
  align-items: center;
  height: var(--tf-nav-menu-item-height);
  min-height: var(--tf-nav-menu-item-height);
  padding: 0 12px;
  box-sizing: border-box;
  cursor: pointer;
  transition: background 0.2s;
}

.all-menus .menu-list .menu-item .menu-item-content.has-actions {
  grid-template-columns: 20px minmax(0, 1fr) 32px;
  column-gap: 8px;
}

.all-menus .menu-list .menu-item .menu-item-content:hover {
  background: var(--tf-nav-item-hover-bg);
}

.all-menus .menu-list .menu-item .menu-item-content .menu-icon {
  width: 20px;
  min-width: 20px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: rgba(255, 255, 255, 0.9);
}

.all-menus .menu-list .menu-item .menu-item-content .menu-name {
  min-width: 0;
  text-align: left;
  color: rgba(255, 255, 255, 0.95);
  font-size: var(--tf-nav-menu-text-size);
  line-height: 1.35;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.all-menus .menu-list .menu-item .menu-item-content .menu-actions {
  flex: 0 0 32px !important;
  width: 32px !important;
  min-width: 32px !important;
  max-width: 32px !important;
  height: 32px !important;
  min-height: 32px !important;
  max-height: 32px !important;
  padding: 0 !important;
  border: 0;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
  justify-self: end;
  display: flex;
  align-items: center;
  justify-content: center;
}

.all-menus .menu-list .menu-item .menu-item-content .menu-actions .expand-icon {
  font-size: var(--tf-nav-menu-arrow-size);
  transition: transform 0.3s;
}

.all-menus .menu-list .menu-item .menu-item-content .menu-actions:hover,
.all-menus .menu-list .menu-item .menu-item-content .menu-actions:focus,
.all-menus .menu-list .menu-item .menu-item-content .menu-actions:active {
  background: transparent;
  box-shadow: none;
}

.all-menus .menu-list .sub-menu-list {
  background: var(--tf-nav-submenu-bg);
}

.all-menus .menu-list .sub-menu-list .sub-menu-item {
  display: grid;
  grid-template-columns: 20px minmax(0, 1fr);
  column-gap: 8px;
  align-items: center;
  width: 100%;
  min-height: 48px;
  padding: 12px;
  border: none;
  background: transparent;
  cursor: pointer;
  transition: background 0.2s;
}

.all-menus .menu-list .sub-menu-list .sub-menu-item:hover {
  background: var(--tf-nav-item-hover-bg);
}

.all-menus .menu-list .sub-menu-list .sub-menu-item.active {
  background: var(--tf-nav-item-active-bg);
}

.all-menus .menu-list .sub-menu-list .sub-menu-item.active .menu-name {
  color: var(--color-bg-white);
  font-weight: 500;
}

.all-menus .menu-list .sub-menu-list .sub-menu-item .menu-icon {
  width: 20px;
  min-width: 20px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: rgba(255, 255, 255, 0.8);
}

.all-menus .menu-list .sub-menu-list .sub-menu-item .menu-name {
  min-width: 0;
  text-align: left;
  color: rgba(255, 255, 255, 0.9);
  font-size: var(--tf-nav-submenu-text-size);
  line-height: 1.55;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
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

// Dark mode
:global(body.dark) {
  .menu-container {
    background: var(--bg-primary-dark, var(--tf-color-neutral-950));
  }

  .menu-header {
    background: linear-gradient(135deg, var(--tf-color-gray-chakra-600) 0%, var(--tf-color-slate-sidebar) 100%);
  }

  .section-title {
    color: var(--text-secondary-dark, var(--tf-color-gray-chakra-400));
  }

  .menu-item {
    border-bottom-color: var(--border-color-dark, var(--tf-color-gray-chakra-600));
  }
}

/* Iconify 图标样式 */
.iconify {
  display: inline-block;
  vertical-align: middle;
  font-size: var(--tf-type-scale-18);
  width: 1em;
  height: 1em;
}

.menu-icon .iconify {
  font-size: var(--tf-type-scale-20);
  width: 20px;
  height: 20px;
}
</style>
