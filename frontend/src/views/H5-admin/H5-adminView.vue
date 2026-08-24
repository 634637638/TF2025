<!--
  H5Admin - H5商城管理布局（手机版式）
  功能：统一的H5商城管理后台布局 + 公共TAB导航
-->
<template>
  <div class="h5-admin-layout admin-page">
    <PermissionGate
      :can-view="canView"
      mode="denied"
      module-key="h5-admin"
      module-name="H5商城管理"
      permission-code="h5-admin:view"
    >
    <!-- 顶部导航栏 -->
    <PageHeader
      icon="fas fa-mobile-alt"
      title="H5商城管理"
    >
      <template #actions>
        <!-- 动态操作按钮 -->
        <template v-for="(action, index) in headerActions" :key="index">
          <el-button
            :type="action.type || 'default'"
            :icon="action.icon"
            :loading="getButtonLoading(action)"
            :disabled="getButtonDisabled(action)"
            @click="action.handler"
          >
            {{ action.label }}
          </el-button>
        </template>
      </template>
    </PageHeader>

    <!-- 标签页导航 -->
    <div class="tab-navigation tf-page-tabs">
      <el-button
        v-if="canAccessTab('/H5-admin/page/templates')"
        data-view-permission="h5-templates:view"
        :type="isActiveTab('/H5-admin/page/templates') ? 'primary' : 'default'"
        @click="navigateTo('/H5-admin/page/templates')"
        :icon="Box"
      >
        模板
      </el-button>
      <el-button
        v-if="canAccessTab('/H5-admin/page/sold-products')"
        data-view-permission="h5-sold-products:view"
        :type="isActiveTab('/H5-admin/page/sold-products') ? 'primary' : 'default'"
        @click="navigateTo('/H5-admin/page/sold-products')"
        :icon="CircleCheck"
      >
        已售
      </el-button>
      <el-button
        v-if="canAccessTab('/H5-admin/page/config')"
        data-view-permission="h5-config:view"
        :type="isActiveTab('/H5-admin/page/config') ? 'primary' : 'default'"
        @click="navigateTo('/H5-admin/page/config')"
        :icon="Setting"
      >
        配置
      </el-button>
      <el-button
        v-if="canAccessTab('/H5-admin/page/banners')"
        data-view-permission="h5-banners:view"
        :type="isActiveTab('/H5-admin/page/banners') ? 'primary' : 'default'"
        @click="navigateTo('/H5-admin/page/banners')"
        :icon="Picture"
      >
        轮播图
      </el-button>
      <el-button
        v-if="canAccessTab('/H5-admin/page/home-sections')"
        data-view-permission="home-sections:view"
        :type="isActiveTab('/H5-admin/page/home-sections') ? 'primary' : 'default'"
        @click="navigateTo('/H5-admin/page/home-sections')"
        :icon="HomeFilled"
      >
        首页推荐
      </el-button>
      <el-button
        v-if="canAccessTab('/H5-admin/page/orders')"
        data-view-permission="h5-orders:view"
        :type="isActiveTab('/H5-admin/page/orders') ? 'primary' : 'default'"
        @click="navigateTo('/H5-admin/page/orders')"
        :icon="List"
      >
        订单
      </el-button>
    </div>

    <!-- 页面内容 -->
    <div class="admin-content tf-tab-content">
      <router-view v-slot="{ Component, route: viewRoute }">
        <KeepAlive :max="6">
          <component :is="Component" :key="viewRoute.name || viewRoute.fullPath" class="tf-tab-panel" />
        </KeepAlive>
      </router-view>
    </div>
    </PermissionGate>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, watch, shallowRef, provide, markRaw } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useSiteSettingsStore } from '@/stores/siteSettings'
import { useAuthStore } from '@/stores/auth'
import { usePagePermissions } from '@/composables/usePagePermissions'
import { PageHeader, PermissionGate } from '@/components/base'
import { canAccessRoutePath } from '@/constants/routePermissions'
import { logger } from '@/utils/logger'
import { ElMessage } from 'element-plus'
import type { HeaderAction } from '@/types'
import {
  Box,
  CircleCheck,
  Setting,
  Picture,
  HomeFilled,
  List
} from '@element-plus/icons-vue'

const route = useRoute()
const router = useRouter()
const siteSettingsStore = useSiteSettingsStore()
const authStore = useAuthStore()
const { canView } = usePagePermissions('h5-admin')

// 头部操作按钮（由子页面注册）
const headerActions = shallowRef<HeaderAction[]>([])

// 注册头部操作按钮的方法
const registerHeaderActions = (actions: HeaderAction[]) => {
  // 使用 markRaw 确保 Component 类型不会被转换为响应式对象
  headerActions.value = actions.map(action => ({
    ...action,
    icon: action.icon ? markRaw(action.icon) : undefined
  }))
}

// 清空头部操作按钮
const clearHeaderActions = () => {
  headerActions.value = []
}

// 获取按钮的实际状态
const getButtonLoading = (action: HeaderAction) => {
  return typeof action.loading === 'function' ? action.loading() : action.loading
}

const getButtonDisabled = (action: HeaderAction) => {
  return typeof action.disabled === 'function' ? action.disabled() : action.disabled
}

// 提供给子页面使用
provide('registerHeaderActions', registerHeaderActions)
provide('clearHeaderActions', clearHeaderActions)

// 判断是否激活
const isActiveTab = (path: string) => {
  return route.path.startsWith(path)
}

const canAccessTab = (path: string) => canAccessRoutePath(path, authStore)

// 导航到指定路径
const navigateTo = (path: string) => {
  if (!canAccessTab(path)) {
    ElMessage.warning('您没有访问此页面的权限')
    return
  }

  if (route.path === path) {
    return
  }

  router.push(path)
}

// 页面标题映射
const titleMap: Record<string, string> = {
  '/H5-admin/page/templates': '全新机模板管理',
  '/H5-admin/page/sold-products': '已售商品管理',
  '/H5-admin/page/config': '商城配置',
  '/H5-admin/page/banners': '轮播图管理',
  '/H5-admin/page/home-sections': '首页推荐',
  '/H5-admin/page/orders': '订单管理',
}

const currentDocumentTitle = computed(() => {
  const title = titleMap[route.path] || 'H5商城管理'
  return `${title} - ${siteSettingsStore.displayName}`
})

const syncDocumentTitle = () => {
  document.title = currentDocumentTitle.value
}

// 监听路由变化，清空按钮（子页面会重新注册）
watch(() => route.path, () => {
  clearHeaderActions()
})

watch(currentDocumentTitle, syncDocumentTitle, { immediate: true })

onMounted(() => {
  syncDocumentTitle()
})
</script>

<style scoped lang="scss">
.h5-admin-layout {
  min-height: 100vh;
  background: #f5f7fa;
  padding: 24px;
}

.header-link {
  text-decoration: none;
  margin-left: 8px;
}

.admin-content {
  min-width: 0;
}

// 响应式
@media (max-width: 768px) {
  .h5-admin-layout {
    padding-inline: var(--admin-page-gap-x);
    padding-top: 10px;
  }

  .admin-content {
    width: 100%;
    min-width: 0;
  }
}
</style>
