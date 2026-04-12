<template>
  <Teleport to="body">
    <Transition name="loading">
      <div v-if="loadingStore.globalLoading" class="global-loading">
        <div class="loading-backdrop">
          <div class="loading-content">
            <div class="loading-spinner" :class="`loading-spinner--${size}`">
              <div class="spinner" :class="`spinner--${size}`"></div>
            </div>
            <div class="loading-text">{{ loadingStore.loadingText }}</div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script>
import { defineComponent } from 'vue'
import { useLoadingStore } from '@/stores/loading'

export default defineComponent({
  name: 'GlobalLoading',
  props: {
    size: {
      type: String,
      default: 'medium',
      validator: (value) => ['small', 'medium', 'large'].includes(value)
    }
  },
  setup(props) {
    const loadingStore = useLoadingStore()
    return {
      loadingStore,
      size: props.size
    }
  }
})
</script>

<style scoped>
.global-loading {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 9999;
}

.loading-backdrop {
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
}

.loading-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  background-color: rgba(255, 255, 255, 0.9);
  padding: 24px 32px;
  border-radius: 8px;
  backdrop-filter: blur(8px);
}

.loading-spinner {
  display: flex;
  align-items: center;
  justify-content: center;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #f3f3f3;
  border-top: 4px solid #409eff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

/* Small size spinner */
.spinner--small {
  width: 24px;
  height: 24px;
  border-width: 2px;
}

/* Medium size spinner (default) */
.spinner--medium {
  width: 40px;
  height: 40px;
  border-width: 4px;
}

/* Large size spinner */
.spinner--large {
  width: 56px;
  height: 56px;
  border-width: 6px;
}

.loading-text {
  font-size: 14px;
  color: #606266;
  font-weight: 500;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

/* 过渡动画 */
.loading-enter-active,
.loading-leave-active {
  transition: opacity 0.3s ease;
}

.loading-enter-from,
.loading-leave-to {
  opacity: 0;
}
</style>