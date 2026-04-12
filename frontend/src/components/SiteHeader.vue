<template>
  <div class="site-header" v-if="siteSettingsStore.hasLogo">
    <!-- Logo显示 -->
    <div class="site-logo" v-if="siteSettingsStore.hasLogo">
      <Image
        :src="logoUrl"
        :alt="siteSettingsStore.displayName"
        mode="eager"
        fit="contain"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'
import { useSiteSettingsStore } from '@/stores/siteSettings'
import { buildLogoUrl } from '@/utils/logoUtils'
import Image from './Image.vue'

const siteSettingsStore = useSiteSettingsStore()

// 计算 logo 的完整 URL
const logoUrl = computed(() => {
  const rawUrl = siteSettingsStore.settings.logoUrl
  return buildLogoUrl(rawUrl)
})

// 监听站点设置更新事件
const handleSettingsUpdated = (event: CustomEvent) => {
  // 静默处理设置更新
}

const handleLogoUpdated = (event: CustomEvent) => {
  // 静默处理Logo更新
}

const handleSettingsReset = (event: CustomEvent) => {
  // 静默处理设置重置
}

onMounted(() => {
  // 监听全局设置变化事件
  window.addEventListener('tf2025:site-settings-updated', handleSettingsUpdated as EventListener)
  window.addEventListener('tf2025:site-logo-updated', handleLogoUpdated as EventListener)
  window.addEventListener('tf2025:site-settings-reset', handleSettingsReset as EventListener)
})

onUnmounted(() => {
  // 清理事件监听器
  window.removeEventListener('tf2025:site-settings-updated', handleSettingsUpdated as EventListener)
  window.removeEventListener('tf2025:site-logo-updated', handleLogoUpdated as EventListener)
  window.removeEventListener('tf2025:site-settings-reset', handleSettingsReset as EventListener)
})
</script>

<style scoped>
.site-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0;
}

.site-logo {
  flex-shrink: 0;
}

.site-logo img {
  height: 36px;
  max-width: 150px;
  object-fit: contain;
  border-radius: 4px;
}

.site-title {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.site-name {
  font-size: 18px;
  font-weight: 600;
  color: #2c3e50;
  line-height: 1.2;
}

.site-subtitle {
  font-size: 12px;
  color: #7f8c8d;
  line-height: 1.2;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .site-header {
    gap: 8px;
  }

  .site-logo img {
    height: 28px;
    max-width: 100px;
  }

  .site-name {
    font-size: 16px;
  }

  .site-subtitle {
    font-size: 11px;
  }
}

/* 暗色模式支持 */
@media (prefers-color-scheme: dark) {
  .site-name {
    color: #ffffff;
  }

  .site-subtitle {
    color: #bdc3c7;
  }
}
</style>