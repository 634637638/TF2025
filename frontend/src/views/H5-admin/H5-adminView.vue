<!--
  H5Admin - H5商城管理布局（手机版式）
  功能：统一的H5商城管理后台布局 + 公共TAB导航
-->
<template>
  <div class="h5-admin-layout admin-page">
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
    <div class="tab-navigation">
      <el-button
        :type="isActiveTab('/H5-admin/page/templates') ? 'primary' : 'default'"
        @click="navigateTo('/H5-admin/page/templates')"
        :icon="Box"
      >
        模板
      </el-button>
      <el-button
        :type="isActiveTab('/H5-admin/page/sold-products') ? 'primary' : 'default'"
        @click="navigateTo('/H5-admin/page/sold-products')"
        :icon="CircleCheck"
      >
        已售
      </el-button>
      <el-button
        :type="isActiveTab('/H5-admin/page/config') ? 'primary' : 'default'"
        @click="navigateTo('/H5-admin/page/config')"
        :icon="Setting"
      >
        配置
      </el-button>
      <el-button
        :type="isActiveTab('/H5-admin/page/banners') ? 'primary' : 'default'"
        @click="navigateTo('/H5-admin/page/banners')"
        :icon="Picture"
      >
        轮播图
      </el-button>
      <el-button
        :type="isActiveTab('/H5-admin/page/home-sections') ? 'primary' : 'default'"
        @click="navigateTo('/H5-admin/page/home-sections')"
        :icon="HomeFilled"
      >
        首页推荐
      </el-button>
      <el-button
        :type="isActiveTab('/H5-admin/page/orders') ? 'primary' : 'default'"
        @click="navigateTo('/H5-admin/page/orders')"
        :icon="List"
      >
        订单
      </el-button>
    </div>

    <!-- 页面内容 -->
    <div class="admin-content">
      <router-view v-slot="{ Component }">
        <transition name="fade" mode="out-in">
          <component :is="Component" />
        </transition>
      </router-view>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, watch, shallowRef, provide, markRaw } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useSiteSettingsStore } from '@/stores/siteSettings'
import { PageHeader } from '@/components/base'
import { logger } from '@/utils/logger'
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

// 导航到指定路径
const navigateTo = (path: string) => {
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
  if (!siteSettingsStore.lastUpdated && !siteSettingsStore.isLoading) {
    siteSettingsStore.loadSiteSettings().catch(err => {
      logger.warn('加载站点设置失败:', err)
    })
  }
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

/* 标签页导航样式 - 与系统管理页面一致 */
.tab-navigation {
  display: flex;
  gap: 0;
  margin-bottom: 24px;
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
  border: 1px solid #e8ecef;
  overflow: hidden;
}

.tab-navigation .el-button {
  flex: 0 1 auto;
  min-width: 120px;
  border-radius: 0;
  border: none;
  border-right: 1px solid #e8ecef;
  padding: 12px 24px;
}

.tab-navigation .el-button:last-child {
  border-right: none;
}

.tab-navigation .el-button--default {
  background: transparent;
  color: #606266;
}

.tab-navigation .el-button--default:hover {
  background: rgba(102, 126, 234, 0.1);
  color: #667eea;
}

.tab-navigation .el-button--primary {
  background: linear-gradient(135deg, #667eea, #764ba2);
  border-color: #667eea;
  color: white;
  box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3);
}

.tab-navigation .el-button--primary:hover {
  background: linear-gradient(135deg, #667eea, #764ba2);
  opacity: 0.9;
}

// 过渡动画
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

// 响应式
@media (max-width: 768px) {
  .h5-admin-layout {
    padding: 12px;
  }

  .tab-navigation {
    margin-bottom: 16px;
    border-radius: 8px;
  }

  .tab-navigation .el-button {
    padding: 12px 16px;
    font-size: 13px;
  }

  .tab-navigation .el-button .el-icon {
    font-size: 14px;
  }
}
</style>
