<template>
  <Teleport to="body">
    <Transition name="loading">
      <div v-if="showGlobalLoading" class="global-loading">
        <div class="loading-backdrop">
          <div class="loading-content">
            <div class="loading-orb" :class="`loading-orb--${size}`" aria-hidden="true">
              <span class="loading-orb__aura"></span>
              <span class="loading-orb__ring loading-orb__ring--slow"></span>
              <span class="loading-orb__ring loading-orb__ring--fast"></span>
              <div class="loading-orb__core">
                <span class="loading-orb__pulse"></span>
              </div>
            </div>
            <div class="loading-copy">
              <div class="loading-title">{{ loadingStore.loadingText || '正在加载' }}</div>
              <div class="loading-subtitle">正在为你准备页面内容</div>
            </div>
            <div class="loading-progress" aria-hidden="true">
              <span></span>
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
  gap: 18px;
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

.loading-orb {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 82px;
  height: 82px;
}

.loading-orb--small {
  width: 64px;
  height: 64px;
}

.loading-orb--large {
  width: 104px;
  height: 104px;
}

.loading-orb__aura,
.loading-orb__ring,
.loading-orb__core,
.loading-orb__pulse {
  position: absolute;
  border-radius: 50%;
}

.loading-orb__aura {
  inset: -12px;
  background:
    radial-gradient(circle, rgba(14, 165, 233, 0.22), transparent 56%),
    radial-gradient(circle at 62% 64%, rgba(20, 184, 166, 0.18), transparent 46%);
  filter: blur(7px);
  animation: aura-breathe 2.2s ease-in-out infinite;
}

.loading-orb__ring--slow {
  inset: 0;
  border: 1px solid rgba(148, 163, 184, 0.22);
  background:
    conic-gradient(from 180deg, transparent 0 18%, rgba(14, 165, 233, 0.82) 28%, rgba(20, 184, 166, 0.82) 42%, transparent 58% 100%);
  mask: radial-gradient(circle, transparent 0 62%, #000 63% 100%);
  animation: spin 1.45s cubic-bezier(0.65, 0, 0.35, 1) infinite;
  box-shadow:
    0 0 28px rgba(14, 165, 233, 0.2),
    inset 0 0 18px rgba(14, 165, 233, 0.08);
}

.loading-orb__ring--fast {
  inset: 13px;
  background:
    conic-gradient(from 0deg, transparent 0 28%, rgba(37, 99, 235, 0.7) 38%, transparent 52% 100%);
  mask: radial-gradient(circle, transparent 0 68%, #000 69% 100%);
  animation: spin 1s linear infinite reverse;
  opacity: 0.86;
}

.loading-orb__core {
  inset: 27px;
  display: grid;
  place-items: center;
  background:
    radial-gradient(circle at 34% 28%, #ffffff 0 16%, #e0f2fe 46%, #38bdf8 100%);
  box-shadow:
    0 0 0 8px rgba(14, 165, 233, 0.08),
    0 16px 32px rgba(37, 99, 235, 0.24),
    inset 0 -7px 16px rgba(14, 116, 144, 0.16);
  animation: core-breathe 1.8s ease-in-out infinite;
}

.loading-orb--small .loading-orb__core {
  inset: 21px;
}

.loading-orb--large .loading-orb__core {
  inset: 34px;
}

.loading-orb__pulse {
  width: 36%;
  height: 36%;
  background: #ffffff;
  box-shadow:
    0 0 0 3px rgba(255, 255, 255, 0.45),
    0 0 18px rgba(255, 255, 255, 0.94);
  animation: pulse-dot 1.2s ease-in-out infinite;
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

.loading-progress {
  position: relative;
  z-index: 1;
  width: 164px;
  height: 4px;
  border-radius: 999px;
  background: rgba(226, 232, 240, 0.86);
  overflow: hidden;
}

.loading-progress span {
  position: absolute;
  inset: 0;
  width: 46%;
  border-radius: inherit;
  background: linear-gradient(90deg, #0ea5e9, #14b8a6, #67e8f9);
  box-shadow: 0 0 18px rgba(14, 165, 233, 0.5);
  animation: progress-sweep 1.55s ease-in-out infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

@keyframes aura-breathe {
  0%,
  100% {
    transform: scale(0.94);
    opacity: 0.66;
  }
  50% {
    transform: scale(1.08);
    opacity: 1;
  }
}

@keyframes core-breathe {
  0%,
  100% {
    transform: scale(0.96);
  }
  50% {
    transform: scale(1.03);
  }
}

@keyframes pulse-dot {
  0%,
  100% {
    transform: scale(0.74);
    opacity: 0.64;
  }
  50% {
    transform: scale(1.18);
    opacity: 1;
  }
}

@keyframes progress-sweep {
  0% {
    transform: translateX(-115%);
  }
  52% {
    transform: translateX(85%);
  }
  100% {
    transform: translateX(260%);
  }
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
