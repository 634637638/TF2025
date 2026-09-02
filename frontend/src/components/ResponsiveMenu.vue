<template>
  <div
    class="responsive-menu"
    :class="{ 'is-mobile': isDrawerNavigation }"
  >
    <!-- 移动端侧滑菜单 -->
    <MobileSlideMenu
      v-if="isDrawerNavigation"
      :is-open="isSlideMenuOpen"
      :is-menu-loading="isMenuLoading"
      :menu-list="slideMenuItems"
      :user-name="userInfo.name"
      :user-role="userInfo.role"
      :quick-actions="activeQuickActions"
      @close="closeSlideMenu"
      @menu-click="handleMenuClick"
      @quick-action="handleQuickAction"
    />

    
    <!-- 桌面端菜单 -->
    <div
      v-else
      class="desktop-menu"
    >
      <SimpleSidebar
        :collapsed="sidebarCollapsed"
        @menu-click="handleMenuClick"
      />
    </div>

    <!-- 移动端菜单按钮（汉堡菜单） -->
    <button
      v-if="isDrawerNavigation && showMenuButton"
      type="button"
      class="mobile-menu-button"
      :class="{ 'is-active': isSlideMenuOpen }"
      aria-label="菜单"
      @click.stop.prevent="handleMenuButtonClick"
    >
      <span class="menu-line" />
      <span class="menu-line" />
      <span class="menu-line" />
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed, watch, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useMobileMenu } from '@/composables/useMobileMenu'
import { useMobile } from '@/composables/mobile'
import { useMenuWidth } from '@/composables/useMenuWidth'
import { BREAKPOINTS } from '@/config/breakpoints'
import MobileSlideMenu from './mobile/MobileSlideMenu.vue'
import SimpleSidebar from './SimpleSidebar.vue'
import type { MenuItem } from '@/types/menu'

// Props
interface Props {
  menuItems?: MenuItem[]
  sidebarCollapsed?: boolean
  showMenuButton?: boolean
  maxBottomNavItems?: number
  enableGestures?: boolean
  enableAutoHide?: boolean
  quickActions?: Array<{
    id: string
    name: string
    icon: string
    badge?: string
    handler: () => void
  }>
}

const props = withDefaults(defineProps<Props>(), {
  menuItems: () => [],
  sidebarCollapsed: false,
  showMenuButton: true,
  maxBottomNavItems: 5,
  enableGestures: true,
  enableAutoHide: true,
  quickActions: () => []
})

// 使用移动端菜单 Composable
const {
  isMobile,
  isTablet,
  isSlideMenuOpen,
  isMenuLoading,
  userInfo,
  slideMenuItems,
  activeQuickActions,
  toggleSlideMenu,
  closeSlideMenu,
  openSlideMenu,
  handleMenuClick,
  handleQuickAction,
  refreshMenu,
  syncMenuItems
} = useMobileMenu({
  items: props.menuItems,
  maxBottomNavItems: props.maxBottomNavItems,
  enableGestures: props.enableGestures,
  enableAutoHide: props.enableAutoHide,
  quickActions: props.quickActions
})

const { screenWidth } = useMobile()

// 纯按宽度切换：1024px 以下使用侧滑菜单，1024px 及以上使用常驻侧栏。
const isDrawerNavigation = computed(() => screenWidth.value < BREAKPOINTS.DESKTOP_MIN)

// 菜单宽度管理
const { isCollapsed, setCollapsed } = useMenuWidth()

// 监听桌面端菜单折叠状态
watch(() => props.sidebarCollapsed, (collapsed) => {
  if (collapsed !== isCollapsed.value) {
    setCollapsed(collapsed)
  }
})

watch(() => props.menuItems, (items) => {
  if (Array.isArray(items) && items.length > 0) {
    syncMenuItems(items)
  }
}, { deep: true })

// 路由
const route = useRoute()

const handleMenuButtonClick = async () => {
  await toggleSlideMenu()
}

// 监听路由变化，同步菜单折叠状态
watch(route, () => {
  // 手机/iPad 自动关闭菜单
  if (isDrawerNavigation.value && isSlideMenuOpen.value) {
    closeSlideMenu()
  }
})

// 初始化时加载菜单数据
onMounted(async () => {
  if (props.menuItems.length === 0) {
    await refreshMenu()
  }
})

// 暴露给父组件的方法
defineExpose({
  toggleMenu: toggleSlideMenu,
  closeMenu: closeSlideMenu,
  openMenu: openSlideMenu,
  refreshMenu
})
</script>

<style lang="scss" scoped>
.responsive-menu {
  position: relative;
  height: 100%;
}

.desktop-menu {
  height: 100%;
}

// 移动端菜单按钮（汉堡按钮）
.mobile-menu-button {
  position: fixed;
  top: 8px;
  left: 8px;
  z-index: 3200;
  width: 40px;
  height: 40px;
  background: var(--primary-color, var(--tf-color-indigo-brand));
  border: none;
  border-radius: 8px;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  box-shadow: var(--tf-button-shadow);
  transition: all 0.3s ease;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;

  &:hover {
    background: var(--primary-dark, var(--tf-color-primary-legacy-dark));
    transform: scale(1.05);
  }

  &:active {
    transform: scale(0.95);
  }

  &.is-active {
    background: var(--danger-color, var(--danger-color));

    .menu-line {
      &:nth-child(1) {
        transform: translateY(9px) rotate(45deg);
      }

      &:nth-child(2) {
        opacity: 0;
      }

      &:nth-child(3) {
        transform: translateY(-9px) rotate(-45deg);
      }
    }
  }

  .menu-line {
    width: 20px;
    height: 2px;
    background: var(--tf-button-neutral-bg);
    border-radius: 1px;
    transition: all 0.3s ease;
    transform-origin: center;
  }
}

// 适配不同屏幕尺寸
@media (max-width: 360px) {
  .mobile-menu-button {
    width: 34px;
    height: 34px;
    top: 8px;
    left: 8px;
    border-radius: 8px;

    .menu-line {
      width: 16px;
    }
  }
}

// 大屏手机
@media (min-width: 414px) {
  .mobile-menu-button {
    width: 40px;
    height: 40px;
    top: 8px;
    left: 8px;
    border-radius: 8px;

    .menu-line {
      width: 18px;
      height: 2px;
    }
  }
}

// 桌面设备使用常驻侧栏，不显示侧滑菜单按钮
@media (min-width: 1024px) {
  .mobile-menu-button {
    display: none;
  }
}

/* Safari 的桌面网站模式可能把 iPhone/iPad CSS 视口报告为桌面宽度；
 * 设备检测确认是移动设备时，菜单入口必须继续可见。 */
:global(html.device-phone) .mobile-menu-button {
  display: flex;
}

:global(html.device-tablet) .mobile-menu-button {
  display: flex;
}

// 横屏模式调整
@media (orientation: landscape) and (max-height: 500px) {
  .mobile-menu-button {
    top: 8px;
    left: 8px;
    width: 36px;
    height: 36px;
    border-radius: 8px;
  }
}

// 确保菜单按钮在其他元素之上
.mobile-menu-button {
  position: fixed;
  z-index: 3200;
}

// 暗色模式
:global(body.dark) {
  .mobile-menu-button {
    background: var(--primary-color, var(--tf-color-indigo-brand));

    &:hover {
      background: var(--primary-dark, var(--tf-color-primary-legacy-dark));
    }

    &.is-active {
      background: var(--danger-color, var(--tf-color-red-500));
    }
  }
}
</style>
