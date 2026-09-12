<template>
  <el-config-provider :locale="zhCn">
    <div id="app">
      <router-view v-slot="{ Component }">
        <component :is="Component" />
      </router-view>
      <GlobalLoading size="medium" />
    </div>
  </el-config-provider>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import { useAuthStore } from '@/stores/auth'
import { clearPersistedAuthData, getBackendDisconnectInfo } from '@/utils/auth-session'
import logger from '@/utils/logger'
import GlobalLoading from '@/components/GlobalLoading.vue'

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

    // 登录页是公开路由，路由守卫不会主动恢复认证。
    // 这里只处理“已有会话打开登录页”的场景，其他恢复统一由 auth store 完成。
    if (currentRoute.path === '/login') {
      await authStore.loadPersistedAuthData()
      if (authStore.isAuthenticated && router.currentRoute.value.path === '/login') {
        await router.replace('/dashboard')
      }
    }
  } catch (error) {
    logger.error('App 启动时认证状态检查失败', error)
  }
})
</script>

<style>
/* 全局样式已移至 styles.css */
</style>
