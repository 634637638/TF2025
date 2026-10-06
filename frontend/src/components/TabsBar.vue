<template>
  <div class="tabs-bar tf-topbar-tabs">
    <div class="tabs-container">
      <el-button
        v-for="tab in tabs"
        :key="tab.path"
        class="tab-item tf-topbar-tab"
        :class="{ 'is-active': tab.path === activeTab }"
        native-type="button"
        @click="switchTab(tab.path)"
      >
        <i
          v-if="tab.icon"
          :class="tab.icon"
          class="tab-icon"
        />
        <span class="tab-title">{{ tab.title }}</span>
        <i
          v-if="!tab.fixed"
          class="fas fa-times tab-close"
          @click.stop="closeTab(tab.path)"
        />
      </el-button>
    </div>
    <div class="tabs-actions">
      <el-dropdown
        trigger="click"
        @command="handleCommand"
      >
        <el-button
          class="tabs-action-btn tf-button--tab-action"
          native-type="button"
          title="标签页操作"
        >
          <i class="fas fa-ellipsis-v" />
        </el-button>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item command="closeOthers">
              <i class="fas fa-times-circle" />
              关闭其他
            </el-dropdown-item>
            <el-dropdown-item command="closeRight">
              <i class="fas fa-arrow-right" />
              关闭右侧
            </el-dropdown-item>
            <el-dropdown-item command="closeAll">
              <i class="fas fa-times" />
              关闭全部
            </el-dropdown-item>
            <el-dropdown-item
              command="refresh"
              divided
            >
              <i class="fas fa-sync-alt" />
              刷新当前
            </el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useTabsStore } from '@/stores/tabs'
import { useAuthStore } from '@/stores/auth'
import { canAccessRoutePath } from '@/constants/routePermissions'
import { ElMessage } from 'element-plus'

const router = useRouter()
const route = useRoute()
const tabsStore = useTabsStore()
const authStore = useAuthStore()

// 标签页列表
const tabs = computed(() => tabsStore.tabs)
const activeTab = computed(() => route.path)

// 切换标签页
const switchTab = (path: string) => {
  if (route.path === path) {
    return
  }

  if (!canAccessRoutePath(path, authStore)) {
    tabsStore.closeTab(path)
    ElMessage.warning('您没有访问此页面的权限')
    return
  }

  router.push(path)
}

// 关闭标签页
const closeTab = (path: string) => {
  tabsStore.closeTab(path)

  // 如果关闭的是当前标签，跳转到最后一个标签
  if (path === route.path && tabs.value.length > 0) {
    const lastTab = tabs.value[tabs.value.length - 1]
    if (canAccessRoutePath(lastTab.path, authStore)) {
      router.push(lastTab.path)
    } else {
      tabsStore.closeTab(lastTab.path)
      router.push('/dashboard')
    }
  }
}

// 处理下拉菜单命令
const handleCommand = (command: string) => {
  switch (command) {
  case 'closeOthers':
    tabsStore.closeOtherTabs(route.path)
    break
  case 'closeRight':
    tabsStore.closeRightTabs(route.path)
    break
  case 'closeAll':
    tabsStore.closeAllTabs()
    router.push('/dashboard')
    break
  case 'refresh':
    // 只刷新当前路由组件，避免整页重载导致菜单、权限、缓存全部重新初始化。
    tabsStore.refreshCurrentTab(route.path)
    break
  }
}
</script>

<style scoped>
.tabs-bar {
  min-width: 0;
}

.tabs-container {
  flex: 1;
  display: flex;
  align-items: center;
  gap: var(--tf-tabs-gap);
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-width: thin;
  scrollbar-color: var(--tf-color-gray-300) transparent;
}

.tabs-container::-webkit-scrollbar {
  height: 4px;
}

.tabs-container::-webkit-scrollbar-thumb {
  background: var(--tf-color-gray-300);
  border-radius: 2px;
}

.tabs-container::-webkit-scrollbar-track {
  background: transparent;
}

.tab-item {
  max-width: 180px;
}

.tab-icon,
.tab-title,
.tab-close {
  flex-shrink: 0;
}

.tab-title {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tab-close {
  padding: 2px;
  border-radius: var(--tf-radius-compact);
  transition: background-color 0.2s ease, color 0.2s ease;
}

.tab-close:hover {
  background: var(--tf-button-danger-bg);
  color: var(--tf-button-danger-color);
}

.tabs-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.tabs-action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.tabs-action-btn i {
  font-size: var(--tf-type-scale-12);
}

/* 响应式 - 移动端隐藏 */
@media (max-width: 767px) {
  .tabs-bar {
    display: none;
  }
}
</style>
