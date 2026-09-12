<template>
  <Teleport to="body">
    <Transition name="loading">
      <div
        v-if="showGlobalLoading"
        v-bind="$attrs"
        class="global-loading"
        role="status"
        aria-live="polite"
        aria-label="正在加载"
      >
        <div class="loading-backdrop">
          <div class="loading-content">
            <div
              class="global-loading-ring"
              :class="`global-loading-ring--${size}`"
              aria-hidden="true"
            >
              <InlineLoading :size="size" />
            </div>
            <div class="loading-copy">
              <div class="loading-title">
                {{ loadingStore.loadingText || '正在加载' }}
              </div>
              <div class="loading-subtitle">
                正在为你准备页面内容
              </div>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script>
import { defineComponent, ref, watch, onBeforeUnmount } from 'vue'
import { useLoadingStore } from '@/stores/loading'
import InlineLoading from '@/components/InlineLoading.vue'

export default defineComponent({
  name: 'GlobalLoading',
  components: {
    InlineLoading
  },
  inheritAttrs: false,
  props: {
    size: {
      type: String,
      default: 'medium',
      validator: (value) => ['small', 'medium', 'large'].includes(value)
    }
  },
  setup(_props) {
    const loadingStore = useLoadingStore()
    const showGlobalLoading = ref(false)
    let showTimer = null

    watch(
      () => loadingStore.isLoading,
      (isLoading) => {
        if (showTimer) {
          clearTimeout(showTimer)
          showTimer = null
        }

        if (isLoading) {
          showTimer = setTimeout(() => {
            showGlobalLoading.value = true
            showTimer = null
          }, 700)
          return
        }

        showGlobalLoading.value = false
      },
      { immediate: true }
    )

    onBeforeUnmount(() => {
      if (showTimer) {
        clearTimeout(showTimer)
      }
    })

    return {
      loadingStore,
      showGlobalLoading
    }
  }
})
</script>

<style scoped>
.global-loading {
  position: fixed;
  inset: 0;
  width: 100%;
  height: 100%;
  min-height: 100dvh;
  box-sizing: border-box;
  z-index: 9998;
  pointer-events: auto;
}

.loading-backdrop {
  position: relative;
  width: 100%;
  height: 100dvh;
  min-height: 100%;
  box-sizing: border-box;
  padding: max(16px, env(safe-area-inset-top)) max(16px, env(safe-area-inset-right)) max(16px, env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left));
  background: rgba(15, 23, 42, 0.22);
  -webkit-backdrop-filter: blur(4px);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.loading-content {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  width: min(280px, 100%);
  min-width: 0;
  padding: 24px 22px 22px;
  border: 1px solid var(--tf-loading-surface-border, rgba(226, 232, 240, 0.78));
  border-radius: var(--tf-loading-surface-radius, 16px);
  background: var(--tf-loading-surface-bg, rgba(255, 255, 255, 0.96));
  box-shadow: var(--tf-loading-surface-shadow, 0 18px 50px rgba(15, 23, 42, 0.2));
  -webkit-backdrop-filter: blur(20px);
  backdrop-filter: blur(20px);
  animation: content-rise 0.34s cubic-bezier(0.22, 1, 0.36, 1);
}

.loading-content::before {
  content: '';
  position: absolute;
  top: -1px;
  left: 20px;
  right: 20px;
  height: 3px;
  border-radius: 0 0 4px 4px;
  background: linear-gradient(90deg, var(--tf-loading-ring-secondary), var(--tf-loading-ring-primary));
}

.global-loading-ring {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 76px;
  height: 76px;
  border-radius: 50%;
  background: rgba(239, 246, 255, 0.9);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.9), 0 12px 26px rgba(37, 99, 235, 0.14);
}

.global-loading-ring::before {
  content: '';
  position: absolute;
  inset: -14px;
  border-radius: 50%;
  border: 1px solid rgba(56, 189, 248, 0.28);
  animation: ring-pulse 1.8s ease-in-out infinite;
}

.global-loading-ring :deep(.inline-loading) {
  position: relative;
  z-index: 1;
}

.global-loading-ring--small {
  width: 64px;
  height: 64px;
}

.global-loading-ring--large {
  width: 92px;
  height: 92px;
}

.loading-copy {
  position: relative;
  z-index: 1;
  text-align: center;
}

.loading-title {
  font-size: 15px;
  color: var(--tf-loading-surface-text, var(--tf-color-slate-900));
  font-weight: 800;
  letter-spacing: 0;
}

.loading-subtitle {
  margin-top: 6px;
  font-size: 12px;
  color: var(--tf-color-slate-500);
  font-weight: 600;
  letter-spacing: 0;
}

@keyframes ring-pulse {
  0%,
  100% {
    transform: scale(1);
    opacity: 0.55;
  }
  50% {
    transform: scale(1.08);
    opacity: 1;
  }
}

@keyframes content-rise {
  from {
    transform: translateY(10px) scale(0.98);
    opacity: 0;
  }
  to {
    transform: translateY(0) scale(1);
    opacity: 1;
  }
}

/* 过渡动画 */
.loading-enter-active,
.loading-leave-active {
  transition: opacity 0.18s ease;
}

.loading-enter-from,
.loading-leave-to {
  opacity: 0;
}

@media (max-width: 480px) {
  .loading-content {
    width: min(248px, 100%);
    padding: 20px 18px 18px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .loading-content,
  .global-loading-ring::before,
  .global-loading-ring :deep(.inline-loading__spinner) {
    animation: none;
  }
}
</style>
