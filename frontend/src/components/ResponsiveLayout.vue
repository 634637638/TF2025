<template>
  <div
    class="responsive-layout"
    :class="layoutClasses"
    :style="layoutStyles"
  >
    <!-- 安全区域适配 -->
    <div class="safe-area-wrapper">
      <!-- 移动端顶部导航 -->
      <div
        v-if="isMobile && showMobileHeader"
        class="mobile-header"
        :class="{ 'safe-area-top': deviceInfo.safeArea.top > 0 }"
      >
        <div class="mobile-header-content">
          <button
            v-if="showBackButton"
            @click="$emit('back')"
            class="back-button"
            aria-label="返回"
          >
            <el-icon><ArrowLeft /></el-icon>
          </button>

          <h2 class="mobile-title">{{ title }}</h2>

          <div class="mobile-header-actions">
            <slot name="header-actions" />
            <button
              v-if="showMenuButton"
              @click="toggleMobileMenu"
              class="menu-button"
              aria-label="菜单"
            >
              <el-icon><Menu /></el-icon>
            </button>
          </div>
        </div>
      </div>

      <!-- 移动端侧边栏遮罩 -->
      <transition name="fade">
        <div
          v-if="isMobile && mobileMenuOpen"
          class="mobile-menu-overlay"
          @click="closeMobileMenu"
        />
      </transition>

      <!-- 侧边栏 -->
      <aside
        class="sidebar"
        :class="sidebarClasses"
        :style="sidebarStyles"
      >
        <slot name="sidebar">
          <!-- 默认侧边栏内容 -->
          <div class="sidebar-content">
            <slot name="sidebar-content" />
          </div>
        </slot>
      </aside>

      <!-- 主内容区域 -->
      <main
        class="main-content"
        :class="{ 'with-header': isMobile && showMobileHeader }"
        :style="mainContentStyles"
      >
        <div class="content-wrapper">
          <!-- 面包屑导航 -->
          <nav v-if="showBreadcrumb && !isMobile" class="breadcrumb">
            <slot name="breadcrumb" />
          </nav>

          <!-- 页面内容 -->
          <div class="page-content" :class="contentClasses">
            <slot />
          </div>
        </div>
      </main>

      <!-- 移动端底部导航 -->
      <div
        v-if="isMobile && showMobileFooter"
        class="mobile-footer"
        :class="{ 'safe-area-bottom': deviceInfo.safeArea.bottom > 0 }"
      >
        <slot name="mobile-footer" />
      </div>

      <!-- 移动端浮动操作按钮 -->
      <transition name="fab-scale">
        <div
          v-if="isMobile && fabActions.length > 0"
          class="fab-container"
          :style="fabContainerStyles"
        >
          <button
            v-for="(action, index) in fabActions"
            :key="action.id"
            @click="action.handler"
            class="fab-button"
            :class="[`fab-${action.type || 'primary'}`, { 'fab-mini': index > 0 }]"
            :style="fabButtonStyles(index)"
            :aria-label="action.label"
          >
            <el-icon v-if="action.icon">
              <component :is="action.icon" />
            </el-icon>
          </button>
        </div>
      </transition>

      <!-- 虚拟键盘适配 -->
      <div
        v-if="isKeyboardVisible"
        class="keyboard-spacer"
        :style="{ height: `${keyboardHeight}px` }"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, onMounted, onUnmounted, type Component } from 'vue'
import {
  useResponsive,
  useVirtualKeyboard,
  useSafeArea,
  clsx
} from '@/composables/responsive'
import { ArrowLeft, Menu } from '@element-plus/icons-vue'

// ============ Props 定义 ============
interface FabAction {
  id: string
  icon: Component
  label: string
  handler: () => void
  type?: 'primary' | 'success' | 'warning' | 'danger' | 'info'
}

interface Props {
  title?: string
  showMobileHeader?: boolean
  showBackButton?: boolean
  showMenuButton?: boolean
  showMobileFooter?: boolean
  showBreadcrumb?: boolean
  sidebarCollapsed?: boolean
  sidebarWidth?: string
  contentPadding?: string
  maxWidth?: string
  centerContent?: boolean
  fabActions?: FabAction[]
  stickyHeader?: boolean
  stickyFooter?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  title: '',
  showMobileHeader: true,
  showBackButton: false,
  showMenuButton: true,
  showMobileFooter: false,
  showBreadcrumb: true,
  sidebarCollapsed: false,
  sidebarWidth: '280px',
  contentPadding: '20px',
  maxWidth: '1200px',
  centerContent: false,
  fabActions: () => [],
  stickyHeader: true,
  stickyFooter: false
})

interface Emits {
  back: []
  menuToggle: [open: boolean]
}

const emit = defineEmits<Emits>()

// ============ 响应式逻辑 ============
const {
  isMobile,
  isTablet,
  isDesktop,
  deviceInfo
} = useResponsive()

const {
  isKeyboardVisible,
  keyboardHeight
} = useVirtualKeyboard()

const { safeArea } = useSafeArea()

// 移动端菜单状态
const mobileMenuOpen = ref(false)

const toggleMobileMenu = () => {
  mobileMenuOpen.value = !mobileMenuOpen.value
  emit('menuToggle', mobileMenuOpen.value)
}

const closeMobileMenu = () => {
  mobileMenuOpen.value = false
  emit('menuToggle', false)
}

// 监听键盘显示/隐藏
watch(isKeyboardVisible, (visible) => {
  if (visible && isMobile.value) {
    // 键盘显示时关闭移动菜单
    closeMobileMenu()
  }
})

// 监听窗口大小变化
watch(isMobile, (mobile) => {
  if (!mobile) {
    // 切换到桌面端时关闭移动菜单
    mobileMenuOpen.value = false
  }
})

// ============ 样式计算 ============
const layoutClasses = computed(() => clsx(
  'responsive-layout',
  {
    'is-mobile': isMobile.value,
    'is-tablet': isTablet.value,
    'is-desktop': isDesktop.value,
    'mobile-menu-open': isMobile.value && mobileMenuOpen.value,
    'sidebar-collapsed': props.sidebarCollapsed,
    'keyboard-visible': isKeyboardVisible.value,
    'center-content': props.centerContent
  }
))

const layoutStyles = computed(() => {
  const styles: Record<string, string> = {}

  if (props.maxWidth && !isMobile.value) {
    styles.maxWidth = props.maxWidth
  }

  return styles
})

const sidebarClasses = computed(() => clsx(
  'sidebar',
  {
    'sidebar-mobile': isMobile.value,
    'sidebar-collapsed': props.sidebarCollapsed,
    'sidebar-open': !isMobile.value || mobileMenuOpen.value
  }
))

const sidebarStyles = computed(() => {
  const styles: Record<string, string> = {}

  if (!isMobile.value && !props.sidebarCollapsed) {
    styles.width = props.sidebarWidth
  }

  return styles
})

const mainContentStyles = computed(() => {
  const styles: Record<string, string> = {}

  if (!isMobile.value) {
    styles.paddingLeft = props.sidebarCollapsed ? '0' : props.sidebarWidth
  }

  return styles
})

const contentClasses = computed(() => clsx(
  'page-content',
  {
    'content-centered': props.centerContent,
    'content-mobile': isMobile.value
  }
))

const fabContainerStyles = computed(() => {
  const baseBottom = 80 + (safeArea.value.bottom || 0)
  const bottom = isKeyboardVisible.value
    ? baseBottom + keyboardHeight.value
    : baseBottom

  return {
    bottom: `${bottom}px`
  }
})

const fabButtonStyles = (index: number) => {
  const baseScale = index > 0 ? 0.8 : 1
  const translateX = index > 0 ? -(index * 60) : 0
  const delay = index * 50

  return {
    transform: `scale(${baseScale}) translateX(${translateX}px)`,
    transitionDelay: `${delay}ms`
  }
}

// ============ 生命周期 ============
onMounted(() => {
  // 添加全局事件监听
  document.addEventListener('keydown', handleEscape)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleEscape)
})

// ============ 事件处理 ============
const handleEscape = (e: KeyboardEvent) => {
  if (e.key === 'Escape' && mobileMenuOpen.value) {
    closeMobileMenu()
  }
}

// ============ 暴露方法 ============
defineExpose({
  toggleMobileMenu,
  closeMobileMenu,
  mobileMenuOpen: computed(() => mobileMenuOpen.value)
})
</script>

<style scoped>
/* 布局基础样式 */
.responsive-layout {
  position: relative;
  width: 100%;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background-color: var(--el-bg-color, #f5f5f5);
}

.safe-area-wrapper {
  flex: 1;
  display: flex;
  flex-direction: column;
  position: relative;
}

/* 移动端顶部导航 */
.mobile-header {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 1000;
  background: var(--el-bg-color, #fff);
  border-bottom: 1px solid var(--el-border-color-light, #ebeef5);
  backdrop-filter: blur(10px);
  background: rgba(255, 255, 255, 0.95);
}

.mobile-header.safe-area-top {
  padding-top: var(--safe-area-inset-top, 0);
}

.mobile-header-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  min-height: 44px;
}

.back-button,
.menu-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border: none;
  background: transparent;
  border-radius: 50%;
  cursor: pointer;
  transition: all 0.2s ease;
  color: var(--el-text-color-primary, #303133);
}

.back-button:hover,
.menu-button:hover {
  background-color: var(--el-fill-color-light, #f5f7fa);
}

.mobile-title {
  font-size: 18px;
  font-weight: 600;
  margin: 0;
  color: var(--el-text-color-primary, #303133);
  flex: 1;
  text-align: center;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mobile-header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

/* 移动端菜单遮罩 */
.mobile-menu-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 999;
  backdrop-filter: blur(4px);
}

/* 侧边栏 */
.sidebar {
  position: relative;
  background: var(--el-bg-color-page, #fff);
  border-right: 1px solid var(--el-border-color-light, #ebeef5);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  z-index: 100;
}

.sidebar-mobile {
  position: fixed;
  top: 0;
  left: 0;
  bottom: 0;
  transform: translateX(-100%);
  box-shadow: 2px 0 8px rgba(0, 0, 0, 0.1);
  z-index: 1001;
}

.sidebar-mobile.sidebar-open {
  transform: translateX(0);
}

.sidebar-content {
  height: 100%;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

/* 主内容区域 */
.main-content {
  flex: 1;
  transition: padding-left 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow-x: hidden;
}

.main-content.with-header {
  padding-top: 44px; /* 移动端顶部导航高度 */
}

.content-wrapper {
  max-width: 100%;
  margin: 0 auto;
  padding: var(--content-padding, 8px 4px);
}

.breadcrumb {
  margin-bottom: 20px;
  padding: 12px 0;
}

.page-content {
  min-height: calc(100vh - 88px); /* 减去顶部导航和内容间距 */
}

.page-content.content-centered {
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
}

/* 移动端底部导航 */
.mobile-footer {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: var(--el-bg-color, #fff);
  border-top: 1px solid var(--el-border-color-light, #ebeef5);
  z-index: 1000;
}

.mobile-footer.safe-area-bottom {
  padding-bottom: var(--safe-area-inset-bottom, 0);
}

/* 浮动操作按钮 */
.fab-container {
  position: fixed;
  right: 16px;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.fab-button {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  border: none;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
}

.fab-button.fab-mini {
  width: 40px;
  height: 40px;
  font-size: 18px;
}

.fab-button.fab-primary {
  background: var(--el-color-primary, #409eff);
  color: white;
}

.fab-button.fab-success {
  background: var(--el-color-success, #67c23a);
  color: white;
}

.fab-button.fab-warning {
  background: var(--el-color-warning, #e6a23c);
  color: white;
}

.fab-button.fab-danger {
  background: var(--el-color-danger, #f56c6c);
  color: white;
}

.fab-button.fab-info {
  background: var(--el-color-info, #909399);
  color: white;
}

.fab-button:hover {
  transform: scale(1.1);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
}

.fab-button:active {
  transform: scale(0.95);
}

/* 虚拟键盘适配 */
.keyboard-spacer {
  flex-shrink: 0;
  transition: height 0.3s ease;
}

/* 动画 */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.fab-scale-enter-active {
  transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.fab-scale-leave-active {
  transition: all 0.2s ease;
}

.fab-scale-enter-from {
  opacity: 0;
  transform: scale(0);
}

.fab-scale-leave-to {
  opacity: 0;
  transform: scale(0.8);
}

/* 响应式断点 */
@media (max-width: 767px) {
  .content-wrapper {
    padding: 6px 4px;
  }

  .page-content {
    min-height: calc(100vh - 120px);
  }
}

@media (max-width: 480px) {
  .content-wrapper {
    padding: 4px 2px;
  }

  .mobile-header-content {
    padding: 10px 12px;
  }

  .fab-container {
    right: 12px;
  }

  .fab-button {
    width: 48px;
    height: 48px;
    font-size: 20px;
  }

  .fab-button.fab-mini {
    width: 36px;
    height: 36px;
    font-size: 16px;
  }
}

/* 高对比度模式 */
@media (prefers-contrast: high) {
  .mobile-header {
    border-bottom: 2px solid var(--el-border-color, #dcdfe6);
  }

  .fab-button {
    border: 2px solid currentColor;
  }
}

/* 减少动画模式 */
@media (prefers-reduced-motion: reduce) {
  .sidebar,
  .main-content,
  .fab-button,
  .fade-enter-active,
  .fade-leave-active,
  .fab-scale-enter-active,
  .fab-scale-leave-active {
    transition: none;
  }
}

/* 打印样式 */
@media print {
  .mobile-header,
  .mobile-footer,
  .fab-container,
  .sidebar-mobile {
    display: none !important;
  }

  .main-content {
    padding-left: 0 !important;
  }
}
</style>
