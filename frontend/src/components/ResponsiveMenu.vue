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
      @menu-click="forwardMenuClick"
      @quick-action="handleQuickAction"
    />


    <!-- 手机端默认菜单入口；菜单展开后仍保留此入口，不在面板内复制关闭按钮。 -->
    <el-button
      v-if="isDrawerNavigation && showMenuButton"
      native-type="button"
      class="mobile-menu-button tf-button--menu"
      :class="{ 'is-active': isSlideMenuOpen, 'is-hidden-behind-menu': isSlideMenuOpen }"
      aria-label="菜单"
      @click.stop.prevent="handleMenuButtonClick"
    >
      <IconRenderer :svg="menuBarsIcon" aria-hidden="true" />
    </el-button>


  </div>
</template>

<script setup lang="ts">
import { computed, watch, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useMobileMenu } from '@/composables/useMobileMenu'
import { useMobile } from '@/composables/mobile'
import { isDrawerNavigationViewport } from '@/config/breakpoints'
import IconRenderer from './IconRenderer.vue'
import menuBarsIcon from '@/assets/icons/menu-bars.svg?raw'
import MobileSlideMenu from './mobile/MobileSlideMenu.vue'
import type { MenuItem } from '@/types/menu'

// Props
interface Props {
  menuItems?: MenuItem[]
  showMenuButton?: boolean
  enableGestures?: boolean
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
  showMenuButton: true,
  enableGestures: true,
  quickActions: () => []
})

const emit = defineEmits<{
  'menu-click': [menu: MenuItem]
}>()

// 使用移动端菜单 Composable
const {
  isSlideMenuOpen,
  isMenuLoading,
  userInfo,
  slideMenuItems,
  activeQuickActions,
  toggleSlideMenu,
  closeSlideMenu,
  openSlideMenu,
  handleQuickAction,
  refreshMenu,
  syncMenuItems
} = useMobileMenu({
  items: props.menuItems,
  enableGestures: props.enableGestures,
  quickActions: props.quickActions
})

const { isMobile, isTablet, screenWidth } = useMobile()

const isDrawerNavigation = computed(() => (
  isMobile.value ||
  isTablet.value ||
  isDrawerNavigationViewport(screenWidth.value)
))

watch(() => props.menuItems, (items) => {
  if (Array.isArray(items) && items.length > 0) {
    syncMenuItems(items)
  }
}, { deep: true })

// 路由
const route = useRoute()

const forwardMenuClick = (menu: MenuItem) => {
  emit('menu-click', menu)
}

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

.mobile-menu-button {
  position: fixed;
  top: 8px;
  left: 8px;
  z-index: var(--tf-z-drawer);
  display: flex;
  align-items: center;
  justify-content: center;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
}

.mobile-menu-button.is-hidden-behind-menu {
  z-index: calc(var(--tf-z-drawer-overlay) - 1);
}

@media (min-width: 1025px) {
  .mobile-menu-button {
    display: none;
  }
}

// 暗色模式
</style>
