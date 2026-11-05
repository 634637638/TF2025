<template>
  <div
    class="loading-overlay-region"
    :aria-busy="loading"
  >
    <slot />
    <div
      v-if="loading"
      class="loading-overlay-region__cover"
      role="status"
      aria-live="polite"
    >
      <SectionLoading
        :text="text"
        :size="size"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { watch, onBeforeUnmount } from 'vue'
import { useLoadingStore } from '@/stores/loading'
import SectionLoading from '@/components/SectionLoading.vue'

interface Props {
  loading: boolean
  text?: string
  size?: 'compact' | 'normal' | 'large'
}

const props = withDefaults(defineProps<Props>(), {
  text: '加载中...',
  size: 'normal'
})

const loadingStore = useLoadingStore()
let registered = false

const syncLocalLoading = (loading: boolean) => {
  if (loading === registered) return
  registered = loading
  if (loading) loadingStore.startLocalLoading()
  else loadingStore.stopLocalLoading()
}

watch(() => props.loading, syncLocalLoading, { immediate: true })
onBeforeUnmount(() => syncLocalLoading(false))
</script>

<style scoped>
.loading-overlay-region {
  position: relative;
  isolation: isolate;
  min-width: 0;
}

.loading-overlay-region__cover {
  position: absolute;
  inset: 0;
  z-index: var(--tf-z-loading-overlay);
  display: grid;
  place-items: center;
  padding: var(--tf-space-4);
  background: var(--tf-loading-overlay-bg, rgba(255, 255, 255, 0.78));
  -webkit-backdrop-filter: blur(1px);
  backdrop-filter: blur(1px);
}

.loading-overlay-region__cover :deep(.section-loading) {
  width: 100%;
  min-height: 112px;
  border-radius: var(--tf-radius-card);
}

@media (prefers-reduced-motion: reduce) {
  .loading-overlay-region__cover :deep(.section-loading::before) {
    animation: none;
  }
}
</style>
