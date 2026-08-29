<template>
  <div class="tabs-bar">
    <div class="tabs-container">
      <div
        v-for="tab in tabs"
        :key="tab.path"
        class="tab-item"
        :class="{ active: tab.path === activeTab }"
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
      </div>
    </div>
    <div class="tabs-actions">
      <el-dropdown
        trigger="click"
        @command="handleCommand"
      >
        <button
          class="tabs-action-btn"
          title="标签页操作"
        >
          <i class="fas fa-ellipsis-v" />
        </button>
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
  display: flex;
  align-items: center;
  background: var(--tf-color-surface);
  border-bottom: 1px solid var(--tf-color-border-element);
  height: 40px;
  padding: 0 8px;
  gap: 8px;
  overflow: hidden;
}

.tabs-container {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 4px;
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
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: white;
  border: 1px solid var(--tf-color-border-element);
  border-radius: 4px 4px 0 0;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
  flex-shrink: 0;
  max-width: 180px;
  position: relative;
}

.tab-item:hover {
  background: var(--tf-color-surface-ant);
}

.tab-item.active {
  background: white;
  border-bottom-color: white;
  box-shadow: 0 -2px 4px rgba(0, 0, 0, 0.05);
}

.tab-item.active::after {
  content: '';
  position: absolute;
  bottom: -1px;
  left: 0;
  right: 0;
  height: 2px;
  background: linear-gradient(135deg, var(--tf-color-indigo-brand) 0%, var(--tf-color-purple-brand) 100%);
}

.tab-icon {
  font-size: 12px;
  color: var(--color-text-regular);
  flex-shrink: 0;
}

.tab-item.active .tab-icon {
  color: var(--tf-color-indigo-brand);
}

.tab-title {
  font-size: 13px;
  color: var(--color-text-regular);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tab-item.active .tab-title {
  color: var(--color-text-primary);
  font-weight: 500;
}

.tab-close {
  font-size: 11px;
  color: var(--color-info);
  padding: 2px;
  border-radius: 2px;
  transition: all 0.2s ease;
  flex-shrink: 0;
  margin-left: 2px;
}

.tab-close:hover {
  background: var(--color-danger);
  color: white;
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
  width: 28px;
  height: 28px;
  background: var(--tf-button-neutral-bg);
  border: 1px solid var(--tf-button-neutral-border);
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s ease;
  color: var(--tf-button-tool-color);
}

.tabs-action-btn:hover {
  background: var(--tf-button-neutral-hover-bg);
  border-color: var(--tf-button-neutral-hover-border);
}

.tabs-action-btn i {
  font-size: 12px;
}

/* 响应式 - 移动端隐藏 */
@media (max-width: 768px) {
  .tabs-bar {
    display: none;
  }
}
</style>
