<template>
  <!-- 移动端遮罩层 -->
  <div
    v-if="isMobile && !collapsed"
    class="sidebar-overlay"
    @click="handleOverlayClick"
  />

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
      <template
        v-for="menu in menuList"
        :key="menu.id"
      >
        <!-- 菜单项 -->
        <div
          class="menu-item"
          :class="{
            'active': isMenuActive(menu),
            'has-children': menu.children && menu.children.length > 0,
            'mobile-item': isMobile
          }"
          :title="isMobile ? menu.name : ''"
          @click="handleMenuClick(menu)"
        >
          <div class="menu-content">
            <div class="menu-icon">
              <IconRenderer
                :icon="menu.icon"
                :svg="menu.icon_svg"
              />
            </div>
            <div
              v-show="!props.collapsed && !isMobile"
              class="menu-text"
            >
              {{ menu.name }}
            </div>
            <!-- 徽章 -->
            <div
              v-if="menu.badge && !props.collapsed && !isMobile"
              class="menu-badge"
            >
              <span class="badge-count">{{ menu.badge }}</span>
            </div>
          </div>
          <!-- 展开/折叠图标 -->
          <div
            v-if="menu.children && menu.children.length > 0 && !props.collapsed"
            class="menu-arrow"
            :class="{ expanded: expandedMenus.has(menu.id) }"
            aria-hidden="true"
          >
            <i class="fas fa-chevron-down" />
          </div>
        </div>

        <!-- 子菜单 -->
        <transition :name="isMobile ? 'slide-down' : 'sub-menu'">
          <div
            v-if="menu.children && menu.children.length > 0 && expandedMenus.has(menu.id)"
            class="sub-menu"
            :class="{ 'mobile-sub-menu': isMobile }"
          >
            <template
              v-for="child in menu.children"
              :key="child.id"
            >
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
                    <IconRenderer
                      :icon="child.icon"
                      :svg="child.icon_svg"
                    />
                  </div>
                  <div
                    v-show="!props.collapsed && !isMobile"
                    class="menu-text"
                  >
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
      title="拖动调整宽度"
      @mousedown="handleResizeStart"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, useAttrs, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useMobile, useMobileGestures } from '../composables/mobile'
import { useTheme } from '../composables/useTheme'
import { useMenuWidth } from '../composables/useMenuWidth'
import { useMenuStore } from '../stores/menu'
import { useEventBus } from '../composables/core/useEventBus'
import IconRenderer from './IconRenderer.vue'
import logger from '../utils/logger'

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
const route = useRoute()
const menuStore = useMenuStore()

// 获取非props属性
const attrs = useAttrs()

// Mobile Composables
const { isMobile: isPhone, isTablet } = useMobile()
const isMobile = computed(() => isPhone.value || isTablet.value)
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

  if (menuStore.menuItems.length > 0) {
    menuList.value = menuStore.menuItems
    return
  }

  await menuStore.loadMenus()
  menuList.value = menuStore.menuItems
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

const navigateToMenu = (menu) => {
  // 获取目标路径
  const targetPath = menu.url || menu.path

  // 检查是否有有效路径
  if (!targetPath || targetPath === '#' || targetPath === '') {
    return
  }

  // 通知父组件
  emit('menu-click', menu)

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
watch(() => props.menuItems, async (newItems, _oldItems) => {
  // 只有当有数据时才更新，避免空数组覆盖
  if (newItems && newItems.length > 0) {
    menuList.value = newItems
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

  // 监听菜单更新事件 - 也不重新加载，由父组件更新 props
  on('menu:updated', async (_data) => {
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

<style scoped src="./styles/simple-sidebar/desktop.css"></style>
<style scoped src="./styles/simple-sidebar/mobile.css"></style>
<style scoped src="./styles/simple-sidebar/responsive.css"></style>
