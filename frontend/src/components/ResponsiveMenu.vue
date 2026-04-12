<template>
  <div class="responsive-menu" :class="{ 'is-mobile': isMobile }">
    <!-- 移动端侧滑菜单 -->
    <MobileSlideMenu
      v-if="isMobile"
      :is-open="isSlideMenuOpen"
      :menu-list="slideMenuItems"
      :user-name="userInfo.name"
      :user-role="userInfo.role"
      :quick-actions="activeQuickActions"
      @close="closeSlideMenu"
      @menu-click="handleMenuClick"
      @quick-action="handleQuickAction"
    />

    
    <!-- 桌面端菜单 -->
    <div v-else class="desktop-menu">
      <SimpleSidebar
        :collapsed="sidebarCollapsed"
        @menu-click="handleMenuClick"
      />
    </div>

    <!-- 移动端菜单按钮（汉堡菜单） -->
    <button
      v-if="isMobile && showMenuButton"
      class="mobile-menu-button"
      @click="toggleSlideMenu"
      :class="{ 'is-active': isSlideMenuOpen }"
      aria-label="菜单"
    >
      <span class="menu-line"></span>
      <span class="menu-line"></span>
      <span class="menu-line"></span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed, watch, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { useMobileMenu } from '@/composables/useMobileMenu'
import { useMenuWidth } from '@/composables/useMenuWidth'
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
  isSlideMenuOpen,
  isBottomNavVisible,
  userInfo,
  menuItems: dynamicMenuItems,
  bottomNavItems,
  slideMenuItems,
  activeQuickActions,
  toggleSlideMenu,
  closeSlideMenu,
  handleMenuClick,
  handleQuickAction,
  refreshMenu
} = useMobileMenu({
  items: props.menuItems,
  maxBottomNavItems: props.maxBottomNavItems,
  enableGestures: props.enableGestures,
  enableAutoHide: props.enableAutoHide,
  quickActions: props.quickActions
})

// 菜单宽度管理
const { isCollapsed, setCollapsed } = useMenuWidth()

// 监听桌面端菜单折叠状态
watch(() => props.sidebarCollapsed, (collapsed) => {
  if (collapsed !== isCollapsed.value) {
    setCollapsed(collapsed)
  }
})

// 路由
const route = useRoute()

// 监听路由变化，同步菜单折叠状态
watch(route, (newRoute) => {
  // 移动端自动关闭菜单
  if (isMobile.value && isSlideMenuOpen.value) {
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
  openMenu: () => toggleSlideMenu(),
  refreshMenu
})
</script>

<style lang="scss" scoped>
.responsive-menu {
  position: relative;
  height: 100%;

  &.is-mobile {
    // 移动端样式
  }
}

.desktop-menu {
  height: 100%;
}

// 移动端菜单按钮（汉堡按钮）
.mobile-menu-button {
  position: fixed;
  top: 8px;
  left: 8px;
  z-index: 1001;
  width: 40px;
  height: 40px;
  background: var(--primary-color, #667eea);
  border: none;
  border-radius: 8px;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  transition: all 0.3s ease;

  &:hover {
    background: var(--primary-dark, #5a6fd8);
    transform: scale(1.05);
  }

  &:active {
    transform: scale(0.95);
  }

  &.is-active {
    background: var(--danger-color, #dc3545);

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
    background: white;
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

// 平板设备（不显示汉堡按钮）
@media (min-width: 768px) {
  .mobile-menu-button {
    display: none;
  }
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
  z-index: 1001;
}

// 暗色模式
:global(body.dark) {
  .mobile-menu-button {
    background: var(--primary-color, #667eea);

    &:hover {
      background: var(--primary-dark, #5a6fd8);
    }

    &.is-active {
      background: var(--danger-color, #e53e3e);
    }
  }
}
</style>
