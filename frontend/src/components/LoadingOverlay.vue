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
import SectionLoading from '@/components/SectionLoading.vue'

interface Props {
  loading: boolean
  text?: string
  size?: 'compact' | 'normal' | 'large'
}

withDefaults(defineProps<Props>(), {
  text: '正在读取内容...',
  size: 'normal'
})
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
  place-items: stretch;
  background: var(--tf-loading-overlay-bg, rgba(255, 255, 255, 0.78));
  -webkit-backdrop-filter: blur(1px);
  backdrop-filter: blur(1px);
}

.loading-overlay-region__cover :deep(.section-loading) {
  height: 100%;
  min-height: 0;
  background: transparent;
  border: 0;
  box-shadow: none;
  border-radius: var(--tf-radius-card);
}

.loading-overlay-region__cover :deep(.section-loading::before) {
  display: none;
}
</style>
