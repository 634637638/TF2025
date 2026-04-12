<template>
  <el-config-provider :locale="zhCn">
    <div id="app">
      <router-view v-slot="{ Component, route }">
        <component :is="Component" />
      </router-view>
    </div>
  </el-config-provider>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { initializeSiteSettings } from '@/stores/siteSettings'
import { clearPersistedAuthData, getBackendDisconnectInfo } from '@/utils/auth-session'
import { ElConfigProvider } from 'element-plus'
import zhCn from 'element-plus/dist/locale/zh-cn.mjs'
import { storage } from '@/services/storage'
import logger from '@/utils/logger'

const router = useRouter()
const authStore = useAuthStore()

// 应用启动时确保认证状态正确初始化
onMounted(async () => {
  try {
    const currentRoute = router.currentRoute.value
    const requiresAuth = currentRoute.matched.some(record => record.meta?.requiresAuth === true)
    const disconnectInfo = getBackendDisconnectInfo()

    if (requiresAuth && disconnectInfo.graceExceeded) {
      clearPersistedAuthData({ notifyOtherWindows: false })
      await router.replace({
        path: currentRoute.path.startsWith('/m') ? '/m/login' : '/login',
        query: { reason: 'backend_disconnected' }
      })
      return
    }

    const sessionToken = storage.getToken()
    const localAuth = storage.getAuth()

    if (sessionToken || localAuth) {
      await authStore.loadPersistedAuthData()
    }

    if (authStore.isAuthenticated && router.currentRoute.value.path === '/login') {
      await router.push('/dashboard')
    }

    if (authStore.isAuthenticated) {
      initializeSiteSettings().catch((error) => {
        logger.warn('全局站点设置初始化失败', error)
      })
    }
  } catch (error) {
    logger.error('App 启动时认证状态检查失败', error)
  }
})
</script>

<style>
/* 全局样式已移至 styles.css */
</style>
