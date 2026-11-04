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
import type { MenuAction, MenuItem } from '@/types/menu'
import { logger } from '@/utils/logger'

// Props
interface Props {
  isOpen: boolean
  isMenuLoading?: boolean
  menuList?: MenuItem[] | null
  userName?: string
  userRole?: string
  quickActions?: MenuAction[]
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
  'quick-action': [action: MenuAction]
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

const _handleQuickAction = (action: MenuAction) => {
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

<style lang="scss" scoped src="./styles/mobile-slide-menu/main.scss"></style>
<style lang="scss" scoped src="./styles/mobile-slide-menu/submenus.scss"></style>
