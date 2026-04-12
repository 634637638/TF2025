<template>
  <div class="dynamic-sidebar">
    <div class="sidebar-header">
      <h2>腾飞管理系统</h2>
      <div class="user-info">
        <div>{{ user.name }}</div>
        <div>{{ userRoleText }}</div>
        <button @click="refreshUserInfo" class="refresh-user-btn" title="刷新用户信息">
          <el-icon><Refresh /></el-icon>
        </button>
      </div>
    </div>

    <div class="menu-container">
      <el-menu
        :default-active="activeMenu"
        :collapse="collapsed"
        :unique-opened="false"
        :router="true"
        background-color="#304156"
        text-color="#bfcbd9"
        active-text-color="#409EFF"
        class="sidebar-menu"
      >
        <template v-for="menu in menuList" :key="menu.id">
          <!-- 有子菜单的情况 -->
          <el-sub-menu v-if="menu.children && menu.children.length > 0" :index="String(menu.path || menu.url)">
            <template #title>
              <span class="menu-title-wrapper">
                <!-- Iconify 图标 -->
                <span
                  v-if="menu.icon && menu.icon.startsWith('iconify')"
                  class="iconify menu-icon"
                  :data-icon="menu.icon.replace('iconify ', '')"
                ></span>
                <!-- Font Awesome 图标 -->
                <i v-else-if="menu.icon" :class="menu.icon" class="menu-icon"></i>
                <!-- 默认图标 -->
                <i v-else class="fas fa-circle menu-icon"></i>
                <span class="menu-text">{{ menu.title || menu.name }}</span>
              </span>
            </template>
            <template v-for="child in menu.children" :key="child.id">
              <!-- 三级菜单（如果有） -->
              <el-sub-menu v-if="child.children && child.children.length > 0" :index="String(child.path || child.url)">
                <template #title>
                  <span class="menu-title-wrapper">
                    <!-- Iconify 图标 -->
                    <span
                      v-if="child.icon && child.icon.startsWith('iconify')"
                      class="iconify menu-icon"
                      :data-icon="child.icon.replace('iconify ', '')"
                    ></span>
                    <!-- Font Awesome 图标 -->
                    <i v-else-if="child.icon" :class="child.icon" class="menu-icon"></i>
                    <!-- 默认图标 -->
                    <i v-else class="fas fa-circle menu-icon"></i>
                    <span class="menu-text">{{ child.title || child.name }}</span>
                  </span>
                </template>
                <el-menu-item
                  v-for="grandchild in child.children"
                  :key="grandchild.id"
                  :index="String(grandchild.path || grandchild.url)"
                  :route="{ path: grandchild.path || grandchild.url }"
                >
                  <span class="menu-title-wrapper">
                    <!-- Iconify 图标 -->
                    <span
                      v-if="grandchild.icon && grandchild.icon.startsWith('iconify')"
                      class="iconify menu-icon"
                      :data-icon="grandchild.icon.replace('iconify ', '')"
                    ></span>
                    <!-- Font Awesome 图标 -->
                    <i v-else-if="grandchild.icon" :class="grandchild.icon" class="menu-icon"></i>
                    <!-- 默认图标 -->
                    <i v-else class="fas fa-circle menu-icon"></i>
                    <span class="menu-text">{{ grandchild.title || grandchild.name }}</span>
                  </span>
                </el-menu-item>
              </el-sub-menu>
              <!-- 二级菜单 -->
              <el-menu-item
                v-else
                :index="String(child.path || child.url)"
                :route="{ path: child.path || child.url }"
              >
                <span class="menu-title-wrapper">
                  <!-- Iconify 图标 -->
                  <span
                    v-if="child.icon && child.icon.startsWith('iconify')"
                    class="iconify menu-icon"
                    :data-icon="child.icon.replace('iconify ', '')"
                  ></span>
                  <!-- Font Awesome 图标 -->
                  <i v-else-if="child.icon" :class="child.icon" class="menu-icon"></i>
                  <!-- 默认图标 -->
                  <i v-else class="fas fa-circle menu-icon"></i>
                  <span class="menu-text">{{ child.title || child.name }}</span>
                </span>
              </el-menu-item>
            </template>
          </el-sub-menu>
          <!-- 无子菜单的情况 -->
          <el-menu-item
            v-else
            :index="String(menu.path || menu.url)"
            :route="{ path: menu.path || menu.url }"
          >
            <span class="menu-title-wrapper">
              <!-- Iconify 图标 -->
              <span
                v-if="menu.icon && menu.icon.startsWith('iconify')"
                class="iconify menu-icon"
                :data-icon="menu.icon.replace('iconify ', '')"
              ></span>
              <!-- Font Awesome 图标 -->
              <i v-else-if="menu.icon" :class="menu.icon" class="menu-icon"></i>
              <!-- 默认图标 -->
              <i v-else class="fas fa-circle menu-icon"></i>
              <span class="menu-text">{{ menu.title || menu.name }}</span>
            </span>
          </el-menu-item>
        </template>
      </el-menu>
    </div>

  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import { useNotification } from '@/composables/useNotification'
import { useAuthStore } from '@/stores/auth'
import { Refresh } from '@element-plus/icons-vue'
import { menuApi } from '@/api/menu'
import { dynamicRouter } from '@/utils/dynamicRouter'
import { refreshIconifyIcons, waitForIconify } from '@/utils/iconify'
import { extractResponseData } from '@/utils/api-response'
import { logger } from '@/utils/logger'

// Props
const props = defineProps({
  collapsed: {
    type: Boolean,
    default: false
  }
})

// Emits
const emit = defineEmits(['menu-click'])

// Route
const route = useRoute()
const { success, error: notifyError } = useNotification()

// Reactive data
const loading = ref(false)
const menuList = ref([])
const activeMenu = ref('')
const user = reactive({
  name: '',
  role: ''
})

// Auth Store - 在顶层调用
const authStore = useAuthStore()

// Computed
const formatRoleLabel = (role) => {
  if (!role) return ''
  if (typeof role === 'string') return role
  return role.name || role.code || ''
}

const getRoleLabels = (roles = []) => {
  return roles
    .map(formatRoleLabel)
    .filter(label => !!label)
}

const userRoleText = computed(() => {
  const roleLabels = getRoleLabels(authStore.userRoles)
  if (roleLabels.length > 0) {
    return roleLabels.join(' / ')
  }

  const fallbackRole = formatRoleLabel(authStore.user?.role)
  if (fallbackRole) {
    return fallbackRole
  }

  return user.role || '未分配角色'
})

// Methods
const loadUserMenus = async () => {
  // 检查用户是否已认证
  if (!authStore.isAuthenticated) {
    loading.value = false
    return
  }

  try {
    loading.value = true
    const response = await menuApi.getUserMenus()

    // 过滤掉按钮类型的菜单，只保留菜单和目录
    const menus = filterMenuItems(extractResponseData(response))
    menuList.value = menus

    // 更新动态路由缓存
    dynamicRouter.clearCache()
    dynamicRouter.flattenMenus(menus)

    // 等待 DOM 更新后刷新 Iconify 图标
    await nextTick()

    // 异步刷新图标，不阻塞菜单加载
    setTimeout(async () => {
      try {
        // 检查 Iconify 是否可用（最多等待500ms）
        const iconifyReady = await waitForIconify(500)
        if (iconifyReady) {
          refreshIconifyIcons()
        }
      } catch (error) {
        logger.warn('⚠️ Iconify 图标刷新失败:', error)
      }
    }, 0)
  } catch (error) {
    logger.error('加载菜单失败:', error)
    notifyError('加载菜单失败')
    menuList.value = []
  } finally {
    loading.value = false
  }
}

const filterMenuItems = (menus) => {
  return menus
    .filter(menu => menu.menu_type !== 'button' && menu.menuType !== 'button') // 过滤掉按钮类型
    .map(menu => {
      const filteredMenu = { ...menu }
      if (menu.children && menu.children.length > 0) {
        filteredMenu.children = filterMenuItems(menu.children)
      }
      return filteredMenu
    })
}

const refreshUserInfo = async () => {
  try {
    const userInfo = authStore.user

    if (userInfo) {
      user.name = userInfo.name || userInfo.username || '未知用户'
      const roleLabels = getRoleLabels(Array.isArray(userInfo.roles) ? userInfo.roles : [])
      user.role = roleLabels.join(' / ') || formatRoleLabel(userInfo.role) || '未分配角色'
      success('用户信息已刷新')
    }
  } catch (err) {
    logger.error('刷新用户信息失败:', err)
    notifyError('刷新失败，请重试')
  }
}

// Watch route change
watch(
  () => route.path,
  (newPath) => {
    activeMenu.value = newPath
  },
  { immediate: true }
)

// 监听 authStore 变化，当权限或用户信息变化时刷新菜单
// 使用防抖避免频繁触发
let authStoreWatchTimer = null
watch(
  () => [authStore.user, authStore.permissions, authStore.isAuthenticated],
  ([newUser, newPermissions, isAuthenticated]) => {
    // 只有在已认证且用户信息存在时才刷新菜单
    if (isAuthenticated && newUser) {
      // 清除之前的定时器
      if (authStoreWatchTimer) {
        clearTimeout(authStoreWatchTimer)
      }

      // 防抖：300ms 后才执行刷新，避免频繁触发
      authStoreWatchTimer = setTimeout(() => {
        refreshUserInfo()
        loadUserMenus()
      }, 300)
    }
  },
  { deep: true }
)

// Lifecycle
onMounted(async () => {
  await refreshUserInfo()
  await loadUserMenus()

  // 监听全局权限更新事件
  const handlePermissionsUpdate = async (event) => {
    // 刷新用户信息和权限
    await authStore.fetchUserInfo()
    // 重新加载菜单
    await loadUserMenus()
  }

  window.addEventListener('tf2025:permissions:updated', handlePermissionsUpdate)

  // 组件卸载时移除事件监听
  onUnmounted(() => {
    window.removeEventListener('tf2025:permissions:updated', handlePermissionsUpdate)
  })
})

// Expose methods for parent component
defineExpose({
  loadUserMenus,
  refreshUserInfo
})
</script>

<style scoped>
.dynamic-sidebar {
  height: 100%;
  display: flex;
  flex-direction: column;
  background-color: #304156;
  color: #bfcbd9;
}

.sidebar-header {
  padding: 12px 12px;
  border-bottom: 1px solid #434a5a;
  flex-shrink: 0;
}

.sidebar-header h2 {
  margin: 0 0 8px 0;
  font-size: 16px;
  font-weight: 600;
  color: #fff;
  text-align: center;
}

.user-info {
  text-align: center;
  font-size: 14px;
  line-height: 1.5;
  position: relative;
}

.user-info div {
  margin-bottom: 4px;
}

.user-info div:last-child {
  margin-bottom: 0;
  color: #909399;
  font-size: 12px;
}

.refresh-user-btn {
  position: absolute;
  top: 0;
  right: -10px;
  background: none;
  border: none;
  color: #909399;
  cursor: pointer;
  padding: 2px;
  border-radius: 2px;
  font-size: 10px;
  transition: color 0.3s;
}

.refresh-user-btn:hover {
  color: #409EFF;
}

.menu-container {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
}

/* 隐藏滚动条 */
.menu-container {
  scrollbar-width: none; /* Firefox */
  -ms-overflow-style: none; /* IE/Edge */
}
.menu-container::-webkit-scrollbar {
  display: none; /* Chrome/Safari/Opera */
}

/* 隐藏调整宽度的拖动手柄 */
.resize-handle {
  display: none !important;
}

.sidebar-menu {
  border: none;
  height: 100%;
}

/* 强制覆盖 el-menu 嵌套菜单的所有内边距 */
.sidebar-menu :deep(.el-menu--inline) {
  padding: 0 !important;
  margin: 0 !important;
  border: none !important;
  overflow: visible !important;
}

/* 一级菜单 */
.sidebar-menu :deep(> .el-sub-menu > .el-menu--inline),
.sidebar-menu :deep(> .el-menu-item) {
  padding-left: 0 !important;
}

/* 二级菜单项 - 完全覆盖 */
.sidebar-menu :deep(.el-menu--inline .el-menu-item) {
  height: 44px !important;
  line-height: 44px !important;
  padding-left: 10px !important;
  padding-right: 10px !important;
  margin: 0 !important;
  border-bottom: 1px solid #434a5a !important;
  list-style: none !important;
}

/* 三级菜单项 */
.sidebar-menu :deep(.el-menu--inline .el-menu--inline .el-menu-item) {
  padding-left: 20px !important;
}

/* 覆盖 el-sub-menu 标题 */
.sidebar-menu :deep(.el-sub-menu .el-sub-menu__title) {
  padding-left: 10px !important;
}

/* 调整展开箭头位置 */
.sidebar-menu :deep(.el-sub-menu .el-sub-menu__icon-arrow) {
  right: 8px !important;
}

.sidebar-menu :deep(.el-menu-item.is-active) {
  background-color: #409EFF !important;
  color: #fff !important;
}

.sidebar-menu :deep(.el-menu-item:hover),
.sidebar-menu :deep(.el-sub-menu__title:hover) {
  background-color: #434a5a !important;
  color: #409EFF !important;
}

.sidebar-menu :deep(.el-sub-menu .el-menu-item) {
  background-color: #263445 !important;
  min-width: 100%;
}

.sidebar-menu :deep(.el-sub-menu .el-menu-item.is-active) {
  background-color: #409EFF !important;
}

.sidebar-menu :deep(.el-sub-menu .el-menu-item:hover) {
  background-color: #434a5a !important;
}

.sidebar-menu :deep(.el-menu-item.is-active::before) {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 4px;
  background-color: #409EFF;
}


/* 响应式设计 */
@media (max-width: 768px) {
  .sidebar-header {
    padding: 16px 12px;
  }

  .sidebar-header h2 {
    font-size: 16px;
  }

  .user-info {
    font-size: 12px;
  }

  .sidebar-menu :deep(.el-menu-item),
  .sidebar-menu :deep(.el-sub-menu__title) {
    height: 44px;
    line-height: 44px;
  }
}

/* 滚动条样式 */
.menu-container::-webkit-scrollbar {
  width: 6px;
}

.menu-container::-webkit-scrollbar-track {
  background: #263445;
}

.menu-container::-webkit-scrollbar-thumb {
  background: #434a5a;
  border-radius: 3px;
}

.menu-container::-webkit-scrollbar-thumb:hover {
  background: #5a6978;
}

/* Iconify 图标样式 */
.menu-title-wrapper {
  display: flex;
  align-items: center;
  width: 100%;
}

.menu-icon {
  display: inline-block;
  vertical-align: middle;
  font-size: 16px;
  width: 1em;
  height: 1em;
  margin-right: 10px;
  color: inherit;
  flex-shrink: 0;
}

.menu-text {
  flex: 1;
}

/* Font Awesome 图标样式 */
.menu-icon[class*="fa-"] {
  width: auto;
  height: auto;
}
</style>
