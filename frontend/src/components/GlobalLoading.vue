<template>
  <Teleport to="body">
    <Transition name="loading">
      <div v-if="showGlobalLoading" class="global-loading">
        <div class="loading-backdrop">
          <div class="loading-content">
            <div class="global-loading-ring" :class="`global-loading-ring--${size}`" aria-hidden="true">
              <InlineLoading :size="size" />
            </div>
            <div class="loading-copy">
              <div class="loading-title">{{ loadingStore.loadingText || '正在加载' }}</div>
              <div class="loading-subtitle">正在为你准备页面内容</div>
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
  props: {
    size: {
      type: String,
      default: 'medium',
      validator: (value) => ['small', 'medium', 'large'].includes(value)
    }
  },
  setup(props) {
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
      size: props.size,
      showGlobalLoading
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
  z-index: 9998;
  pointer-events: none;
}

.loading-backdrop {
  width: 100%;
  height: 100%;
  background:
    radial-gradient(circle at 50% 38%, rgba(255, 255, 255, 0.96), rgba(241, 245, 249, 0.82) 38%, rgba(15, 23, 42, 0.1)),
    linear-gradient(135deg, rgba(236, 254, 255, 0.8), rgba(248, 250, 252, 0.92) 48%, rgba(239, 246, 255, 0.82));
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.loading-backdrop::before {
  content: '';
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(15, 23, 42, 0.035) 1px, transparent 1px),
    linear-gradient(90deg, rgba(15, 23, 42, 0.035) 1px, transparent 1px);
  background-size: 42px 42px;
  mask-image: radial-gradient(circle at center, black, transparent 72%);
  opacity: 0.55;
  pointer-events: none;
}

.loading-backdrop::after {
  content: '';
  position: absolute;
  width: min(520px, 76vw);
  height: min(520px, 76vw);
  border-radius: 999px;
  background:
    radial-gradient(circle, rgba(14, 165, 233, 0.18), transparent 56%),
    radial-gradient(circle at 62% 58%, rgba(20, 184, 166, 0.15), transparent 45%);
  filter: blur(10px);
  opacity: 0.85;
  animation: ambient-breathe 3.8s ease-in-out infinite;
  pointer-events: none;
}

.loading-content {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  min-width: 236px;
  background:
    linear-gradient(145deg, rgba(255, 255, 255, 0.92), rgba(248, 250, 252, 0.82));
  padding: 28px 32px 26px;
  border: 1px solid rgba(226, 232, 240, 0.74);
  border-radius: 30px;
  box-shadow:
    0 30px 88px rgba(15, 23, 42, 0.15),
    0 14px 34px rgba(14, 165, 233, 0.1),
    inset 0 1px 0 rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(20px);
  overflow: hidden;
  animation: content-rise 0.34s cubic-bezier(0.22, 1, 0.36, 1);
}

.loading-content::before {
  content: '';
  position: absolute;
  inset: 0;
  background:
    linear-gradient(135deg, rgba(14, 165, 233, 0.08), transparent 34%),
    linear-gradient(120deg, transparent 0 30%, rgba(255, 255, 255, 0.46) 44%, transparent 60% 100%);
  transform: translateX(-120%);
  animation: panel-sheen 2.8s ease-in-out infinite;
}

.global-loading-ring {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 88px;
  height: 88px;
  border-radius: 50%;
  background:
    radial-gradient(circle, rgba(255, 255, 255, 0.98), rgba(239, 246, 255, 0.86) 68%, rgba(186, 230, 253, 0.52));
  box-shadow:
    0 18px 40px rgba(37, 99, 235, 0.14),
    inset 0 0 0 1px rgba(255, 255, 255, 0.9);
}

.global-loading-ring::before {
  content: '';
  position: absolute;
  inset: -14px;
  border-radius: 50%;
  background:
    radial-gradient(circle, rgba(56, 189, 248, 0.18), transparent 58%),
    radial-gradient(circle at 64% 62%, rgba(37, 99, 235, 0.14), transparent 48%);
  filter: blur(8px);
  animation: ambient-breathe 2.6s ease-in-out infinite;
}

.global-loading-ring :deep(.inline-loading) {
  position: relative;
  z-index: 1;
}

.global-loading-ring--small {
  width: 72px;
  height: 72px;
}

.global-loading-ring--large {
  width: 108px;
  height: 108px;
}

.loading-copy {
  position: relative;
  z-index: 1;
  text-align: center;
}

.loading-title {
  font-size: 15px;
  color: #0f172a;
  font-weight: 800;
  letter-spacing: 0.04em;
}

.loading-subtitle {
  margin-top: 6px;
  font-size: 12px;
  color: #64748b;
  font-weight: 600;
  letter-spacing: 0.02em;
}

@keyframes panel-sheen {
  0%,
  38% {
    transform: translateX(-120%);
  }
  72%,
  100% {
    transform: translateX(120%);
  }
}

@keyframes ambient-breathe {
  0%,
  100% {
    transform: scale(0.96);
    opacity: 0.7;
  }
  50% {
    transform: scale(1.04);
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
</style>
