<template>
  <div v-if="visible" class="loading-overlay" :class="{ dark: darkMode }">
    <div class="loading-content">
      <div class="loading-spinner"></div>
      <p v-if="message">{{ message }}</p>
      <div v-if="showProgress" class="progress-bar">
        <div
          class="progress-fill"
          :style="{ width: `${progress}%` }"
        ></div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { VisibleProps } from '@/types/component'

interface Props extends VisibleProps {
  message?: string
  darkMode?: boolean
  showProgress?: boolean
  progress?: number
}

const props = withDefaults(defineProps<Props>(), {
  message: '加载中...',
  darkMode: false,
  showProgress: false,
  progress: 0
})

const progress = computed(() => {
  return Math.min(100, Math.max(0, props.progress))
})
</script>

<style scoped>
.loading-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(255, 255, 255, 0.95);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 9999;
  backdrop-filter: blur(4px);
  transition: opacity 0.3s ease;
}

.loading-overlay.dark {
  background: rgba(0, 0, 0, 0.85);
}

.loading-content {
  text-align: center;
  color: #333;
}

.loading-overlay.dark .loading-content {
  color: white;
}

.loading-spinner {
  width: 50px;
  height: 50px;
  border: 4px solid #f3f3f3;
  border-top: 4px solid #3498db;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 20px auto;
}

.loading-overlay.dark .loading-spinner {
  border-color: #555;
  border-top-color: #3498db;
}

.loading-content p {
  margin: 0 0 16px 0;
  font-size: 16px;
  font-weight: 500;
}

.progress-bar {
  width: 200px;
  height: 4px;
  background: rgba(0, 0, 0, 0.1);
  border-radius: 2px;
  overflow: hidden;
  margin: 0 auto;
}

.loading-overlay.dark .progress-bar {
  background: rgba(255, 255, 255, 0.2);
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #3498db, #2ecc71);
  border-radius: 2px;
  transition: width 0.3s ease;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

/* 响应式设计 */
@media (max-width: 768px) {
  .loading-spinner {
    width: 40px;
    height: 40px;
    margin-bottom: 16px;
  }

  .loading-content p {
    font-size: 14px;
  }

  .progress-bar {
    width: 160px;
  }
}
</style>
